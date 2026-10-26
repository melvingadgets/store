import type { Request, Response } from "express";
import mongoose from "mongoose";
import cartModel from "../model/cartModel";
import guestCheckoutModel from "../model/guestCheckoutModel";
import orderModel from "../model/orderModel";
import productModel from "../model/productModel";
import userModel from "../model/userModel";
import { inTransaction } from "@melvingadgets/platform-kit";
import { env } from "../config/env";
import { loadCatalogModels, withCatalogImagesForOrders } from "../utils/catalogImagePresenter";
import { computeOrderFees, nairaNumberToKobo, type OrderFees } from "../utils/orderFees";
import {
  mongoClient,
  publishOrderCancelled,
  publishOrderCompleted,
  publishOrderPaid,
  traceIdOf,
} from "../utils/platformMessaging";
import { findStorageOption, normalizeCapacity, summarizeStorageOptions } from "../utils/storageOptions";

// Fee fields stored on an order (Shortwork/RESELLER-PLAN.md §8a), integer kobo.
const feeFields = (fees: OrderFees) => ({
  subtotalKobo: fees.subtotalKobo,
  deliveryFeeKobo: fees.deliveryFeeKobo,
  serviceFeeKobo: fees.serviceFeeKobo,
  totalKobo: fees.totalKobo,
  feeSource: fees.feeSource,
  feeQuoteMock: fees.mock,
});

// The buyer's platform person, from their own account. Never from the request body. Best-effort:
// a lookup problem leaves the order without a person (no reseller attribution) rather than
// blocking the checkout.
const personIdOf = async (userId: string): Promise<string | null> => {
  if (!mongoose.isValidObjectId(userId)) return null;
  try {
    const account = await userModel.findById(userId).select("personId").lean();
    const personId = (account as { personId?: unknown } | null)?.personId;
    return typeof personId === "string" && personId ? personId : null;
  } catch {
    return null;
  }
};

const orderPopulation = {
  path: "orderItem.products",
  select: "name image price qty desc storageOptions",
} as const;

const insufficientStockMessage = "one or more items are out of stock";
const invalidEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface RawCheckoutItem {
  productId?: string;
  quantity?: number;
  capacity?: string;
}

interface NormalizedCheckoutItem {
  products: string;
  capacity: string;
  quantity: number;
  price: number;
}

const sanitizeValue = (value: unknown) => String(value ?? "").trim();

const getCartProductId = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object" && "_id" in value) {
    return getCartProductId((value as { _id?: unknown })._id);
  }

  if (value && typeof value === "object" && "toString" in value && typeof value.toString === "function") {
    const stringValue = value.toString();
    return stringValue === "[object Object]" ? "" : stringValue;
  }

  return "";
};

const normalizePaymentReference = (value: unknown, prefix: string) => {
  const sanitizedReference = sanitizeValue(value).slice(0, 128);
  return sanitizedReference || `${prefix}-${Date.now()}`;
};

const resolveProductSelection = (
  product: {
    price?: number;
    qty?: number;
    storageOptions?: Array<{ capacity?: string; price?: number; qty?: number }>;
  },
  capacity: unknown,
) => {
  const normalizedSelectionCapacity = normalizeCapacity(capacity);
  const productHasStorageOptions = Array.isArray(product.storageOptions) && product.storageOptions.length > 0;

  if (!productHasStorageOptions) {
    return {
      success: true as const,
      capacity: "",
      price: Number(product.price ?? 0),
      availableQuantity: Number(product.qty ?? 0),
    };
  }

  if (!normalizedSelectionCapacity) {
    return {
      success: false as const,
      message: "capacity is required for this product",
    };
  }

  const selectedStorageOption = findStorageOption(product, normalizedSelectionCapacity);

  if (!selectedStorageOption) {
    return {
      success: false as const,
      message: "selected capacity is not available for this product",
    };
  }

  return {
    success: true as const,
    capacity: normalizedSelectionCapacity,
    price: Number(selectedStorageOption.price ?? 0),
    availableQuantity: Number(selectedStorageOption.qty ?? 0),
  };
};

const updateReservedInventory = async ({
  productId,
  capacity,
  quantityDelta,
}: {
  productId: string;
  capacity: string;
  quantityDelta: number;
}) => {
  const product = await productModel.findById(productId);

  if (!product) {
    return false;
  }

  const normalizedSelectionCapacity = normalizeCapacity(capacity);
  const productHasStorageOptions = Array.isArray(product.storageOptions) && product.storageOptions.length > 0;

  if (!productHasStorageOptions) {
    const nextQuantity = Number(product.qty ?? 0) + quantityDelta;

    if (nextQuantity < 0) {
      return false;
    }

    product.qty = nextQuantity;
    await product.save();
    return true;
  }

  const selectedStorageOption = product.storageOptions.find(
    (option) => normalizeCapacity(option.capacity) === normalizedSelectionCapacity,
  );

  if (!selectedStorageOption) {
    return false;
  }

  const nextOptionQty = Number(selectedStorageOption.qty ?? 0) + quantityDelta;
  if (nextOptionQty < 0) {
    return false;
  }

  selectedStorageOption.qty = nextOptionQty;
  const inventorySummary = summarizeStorageOptions(
    product.storageOptions.map((option) => ({
      capacity: normalizeCapacity(option.capacity),
      price: Number(option.price ?? 0),
      qty: Number(option.qty ?? 0),
    })),
  );
  product.qty = inventorySummary.qty;
  product.price = inventorySummary.price;
  await product.save();
  return true;
};

const rollbackReservedInventory = async (
  reservations: Array<{ productId: string; quantity: number; capacity: string }>,
) => {
  await Promise.all(
    reservations.map(({ productId, quantity, capacity }) =>
      updateReservedInventory({
        productId,
        capacity,
        quantityDelta: quantity,
      }),
    ),
  );
};

const reserveInventory = async (items: Array<{ products: string; quantity: number; capacity: string }>) => {
  const reservations: Array<{ productId: string; quantity: number; capacity: string }> = [];

  for (const item of items) {
    const productId = getCartProductId(item.products);
    const quantity = Number(item.quantity ?? 0);

    if (!productId || quantity <= 0) {
      await rollbackReservedInventory(reservations);
      return {
        success: false as const,
        message: "order items are invalid",
      };
    }

    const updated = await updateReservedInventory({
      productId,
      capacity: item.capacity,
      quantityDelta: -quantity,
    });

    if (!updated) {
      await rollbackReservedInventory(reservations);
      return {
        success: false as const,
        message: insufficientStockMessage,
      };
    }

    reservations.push({
      productId,
      quantity,
      capacity: normalizeCapacity(item.capacity),
    });
  }

  return {
    success: true as const,
    reservations,
  };
};

const calculateBill = (items: Array<{ quantity: number; price: number }>) =>
  items.reduce((accumulator, currentItem) => accumulator + currentItem.quantity * currentItem.price, 0);

const getTokenUserId = (req: Request, res: Response) => {
  const userId = req.user?._id;

  if (!userId) {
    res.status(401).json({
      success: 0,
      message: "authentication is required",
    });
    return null;
  }

  return userId;
};

const normalizeCheckoutItems = async (items: RawCheckoutItem[]) => {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      success: false as const,
      statusCode: 400,
      message: "cart items are required",
      items: [] as NormalizedCheckoutItem[],
    };
  }

  const productIds = items
    .map((item) => sanitizeValue(item.productId))
    .filter((productId) => productId.length > 0);

  if (productIds.length === 0) {
    return {
      success: false as const,
      statusCode: 400,
      message: "items must include valid product ids",
      items: [] as NormalizedCheckoutItem[],
    };
  }

  const products = await productModel.find({ _id: { $in: productIds } }).select("_id price qty storageOptions");
  const productMap = new Map(products.map((product) => [product._id.toString(), product]));
  let hasInsufficientStock = false;
  let invalidCapacityMessage = "";

  const normalizedItems = items
    .map((item) => {
      const productId = sanitizeValue(item.productId);
      const quantity = Math.max(1, Number(item.quantity ?? 1));
      const product = productMap.get(productId);

      if (!product) {
        return null;
      }

      const selection = resolveProductSelection(product, item.capacity);
      if (!selection.success) {
        invalidCapacityMessage = selection.message;
        return null;
      }

      if (quantity > selection.availableQuantity) {
        hasInsufficientStock = true;
        return null;
      }

      return {
        products: product._id.toString(),
        capacity: selection.capacity,
        quantity,
        price: selection.price,
      };
    })
    .filter((item): item is NormalizedCheckoutItem => item !== null);

  if (invalidCapacityMessage) {
    return {
      success: false as const,
      statusCode: 400,
      message: invalidCapacityMessage,
      items: [] as NormalizedCheckoutItem[],
    };
  }

  if (hasInsufficientStock) {
    return {
      success: false as const,
      statusCode: 409,
      message: insufficientStockMessage,
      items: [] as NormalizedCheckoutItem[],
    };
  }

  if (normalizedItems.length === 0) {
    return {
      success: false as const,
      statusCode: 400,
      message: "no valid products were found for checkout",
      items: [] as NormalizedCheckoutItem[],
    };
  }

  return {
    success: true as const,
    statusCode: 200,
    message: "ok",
    items: normalizedItems,
  };
};

const validateGuestDetails = (guest: {
  fullName?: unknown;
  email?: unknown;
  whatsappPhoneNumber?: unknown;
  callPhoneNumber?: unknown;
  address?: unknown;
  state?: unknown;
}) => {
  const normalizedGuest = {
    fullName: sanitizeValue(guest.fullName),
    email: sanitizeValue(guest.email).toLowerCase(),
    whatsappPhoneNumber: sanitizeValue(guest.whatsappPhoneNumber),
    callPhoneNumber: sanitizeValue(guest.callPhoneNumber),
    address: sanitizeValue(guest.address),
    state: sanitizeValue(guest.state),
  };

  if (
    !normalizedGuest.fullName ||
    !normalizedGuest.email ||
    !normalizedGuest.whatsappPhoneNumber ||
    !normalizedGuest.address ||
    !normalizedGuest.state
  ) {
    return {
      success: false as const,
      statusCode: 400,
      message: "fullName, email, whatsappPhoneNumber, address, and state are required",
      guest: normalizedGuest,
    };
  }

  if (!invalidEmailPattern.test(normalizedGuest.email)) {
    return {
      success: false as const,
      statusCode: 400,
      message: "email is invalid",
      guest: normalizedGuest,
    };
  }

  return {
    success: true as const,
    statusCode: 200,
    message: "ok",
    guest: normalizedGuest,
  };
};

export const getOrders = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = getTokenUserId(req, res);
    if (!userId) {
      return res;
    }

    const orders = await orderModel
      .find({ user: userId })
      .sort({ createdAt: -1 })
      .populate(orderPopulation);
    const catalogModels = await loadCatalogModels();

    return res.status(200).json({
      success: 1,
      message: "orders loaded successfully",
      data: withCatalogImagesForOrders(orders, catalogModels),
    });
  } catch {
    return res.status(500).json({
      success: 0,
      message: "failed to load orders",
    });
  }
};

export const checkOut = async (req: Request, res: Response): Promise<Response> => {
  let reservedInventory: Array<{ productId: string; quantity: number; capacity: string }> = [];

  try {
    const userId = getTokenUserId(req, res);
    if (!userId) {
      return res;
    }

    const { paymentReference = "", items = [] } = req.body as {
      paymentReference?: string;
      items?: RawCheckoutItem[];
    };

    let checkoutItems: NormalizedCheckoutItem[] = [];
    let sourceCartId: string | null = null;

    if (Array.isArray(items) && items.length > 0) {
      const normalizedCheckoutItems = await normalizeCheckoutItems(items);

      if (!normalizedCheckoutItems.success) {
        return res.status(normalizedCheckoutItems.statusCode).json({
          success: 0,
          message: normalizedCheckoutItems.message,
        });
      }

      checkoutItems = normalizedCheckoutItems.items;
    } else {
      const findUserCart = await cartModel.findOne({ user: userId, isActive: true }).sort({ updatedAt: -1 });

      if (!findUserCart || findUserCart.cartItem.length === 0) {
        return res.status(400).json({
          success: 0,
          message: "cart is empty",
        });
      }

      const normalizedCheckoutItems = await normalizeCheckoutItems(
        findUserCart.cartItem.map((item) => ({
          productId: getCartProductId(item.products),
          quantity: Number(item.quantity),
          capacity: item.capacity ?? "",
        })),
      );

      if (!normalizedCheckoutItems.success) {
        return res.status(normalizedCheckoutItems.statusCode).json({
          success: 0,
          message: normalizedCheckoutItems.message,
        });
      }

      checkoutItems = normalizedCheckoutItems.items;
      sourceCartId = findUserCart._id.toString();
    }

    // Priced before stock is reserved, so a failing courier quote never strands a reservation.
    const fees = await computeOrderFees(checkoutItems);
    const personId = await personIdOf(userId);

    const stockReservation = await reserveInventory(checkoutItems);

    if (!stockReservation.success) {
      return res.status(409).json({
        success: 0,
        message: stockReservation.message,
      });
    }

    reservedInventory = stockReservation.reservations;

    const createOrder = await orderModel.create({
      user: userId,
      orderItem: checkoutItems,
      bill: calculateBill(checkoutItems),
      paymentStatus: "pending",
      paymentReference: normalizePaymentReference(paymentReference, "web"),
      orderStatus: "created",
      ...feeFields(fees),
      ...(personId ? { personId } : {}),
    });

    reservedInventory = [];

    if (sourceCartId) {
      try {
        await cartModel.findByIdAndDelete(sourceCartId);
      } catch (error) {
        console.error("Order was created but the source cart could not be deleted", error);
      }
    }

    const hydratedOrder = await orderModel.findById(createOrder._id).populate(orderPopulation);
    const catalogModels = await loadCatalogModels();

    return res.status(201).json({
      success: 1,
      message: "order created successfully",
      data: withCatalogImagesForOrders([hydratedOrder ?? createOrder], catalogModels)[0],
    });
  } catch {
    if (reservedInventory.length > 0) {
      await rollbackReservedInventory(reservedInventory).catch(() => undefined);
    }

    return res.status(500).json({
      success: 0,
      message: "failed to create order",
    });
  }
};

export const guestCheckOut = async (req: Request, res: Response): Promise<Response> => {
  let reservedInventory: Array<{ productId: string; quantity: number; capacity: string }> = [];

  try {
    const {
      items = [],
      paymentReference = "",
      guest = {},
    } = req.body as {
      items?: RawCheckoutItem[];
      paymentReference?: string;
      guest?: {
        fullName?: unknown;
        email?: unknown;
        whatsappPhoneNumber?: unknown;
        callPhoneNumber?: unknown;
        address?: unknown;
        state?: unknown;
      };
    };

    const validatedGuest = validateGuestDetails(guest);
    if (!validatedGuest.success) {
      return res.status(validatedGuest.statusCode).json({
        success: 0,
        message: validatedGuest.message,
      });
    }

    const normalizedCheckoutItems = await normalizeCheckoutItems(items);
    if (!normalizedCheckoutItems.success) {
      return res.status(normalizedCheckoutItems.statusCode).json({
        success: 0,
        message: normalizedCheckoutItems.message,
      });
    }

    // Guests pay the same fees; they have no person, so their orders never reach a reseller.
    const fees = await computeOrderFees(normalizedCheckoutItems.items, validatedGuest.guest.address);

    const stockReservation = await reserveInventory(normalizedCheckoutItems.items);

    if (!stockReservation.success) {
      return res.status(409).json({
        success: 0,
        message: stockReservation.message,
      });
    }

    reservedInventory = stockReservation.reservations;

    const createGuestCheckout = await guestCheckoutModel.create({
      guest: validatedGuest.guest,
      orderItem: normalizedCheckoutItems.items,
      bill: calculateBill(normalizedCheckoutItems.items),
      paymentStatus: "pending",
      paymentReference: normalizePaymentReference(paymentReference, "guest"),
      orderStatus: "created",
      ...feeFields(fees),
    });

    reservedInventory = [];

    const hydratedGuestCheckout = await guestCheckoutModel.findById(createGuestCheckout._id).populate(orderPopulation);
    const catalogModels = await loadCatalogModels();

    return res.status(201).json({
      success: 1,
      message: "guest checkout created successfully",
      data: withCatalogImagesForOrders([hydratedGuestCheckout ?? createGuestCheckout], catalogModels)[0],
    });
  } catch {
    if (reservedInventory.length > 0) {
      await rollbackReservedInventory(reservedInventory).catch(() => undefined);
    }

    return res.status(500).json({
      success: 0,
      message: "failed to create guest checkout",
    });
  }
};

// POST /api/v1/delivery-quote  { items: [{ productId, quantity, capacity }], destination? }
// What an order would cost before checkout: item subtotal, the courier's delivery quote and the
// service fee, in kobo (Shortwork/RESELLER-PLAN.md §8a). While fees are off it returns the subtotal
// with zero fees and enabled:false, so the web checkout shows no fee lines.
export const getDeliveryQuote = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { items = [], destination } = req.body as { items?: RawCheckoutItem[]; destination?: unknown };
    const normalized = await normalizeCheckoutItems(items);
    if (!normalized.success) {
      return res.status(normalized.statusCode).json({ success: 0, message: normalized.message });
    }
    const fees = await computeOrderFees(normalized.items, sanitizeValue(destination) || undefined);
    return res.status(200).json({
      success: 1,
      message: "delivery quote",
      data: {
        enabled: env.fees.enabled,
        currency: "NGN",
        unit: "kobo",
        ...fees,
        // The product price is refundable; the service fee never is; the delivery fee follows the
        // courier's terms (RESELLER-PLAN.md R8).
        refunds: { productPrice: true, serviceFee: false, deliveryFee: "courier_terms" },
      },
    });
  } catch {
    return res.status(500).json({ success: 0, message: "failed to quote delivery" });
  }
};

// ── Order lifecycle (admin) ────────────────────────────────────────────────────────────────
// An explicit state machine (Shortwork/AGENTS.md §3.7). Each allowed step is one conditional
// update, so a concurrent change makes it fail instead of overwriting (§3.8), and the step and its
// event commit together (§3.1). Any step not listed is refused. Until a courier webhook exists,
// admins drive these by hand.
type OrderAction = "mark_paid" | "complete" | "cancel" | "reject_at_delivery" | "refund";

const ORDER_STEPS: Record<OrderAction, { from: Record<string, unknown>; set: (now: Date) => Record<string, unknown> }> = {
  mark_paid: {
    from: { paymentStatus: "pending", orderStatus: { $in: ["created", "processing"] } },
    set: (now) => ({ paymentStatus: "paid", orderStatus: "processing", paidAt: now }),
  },
  complete: {
    from: { paymentStatus: "paid", orderStatus: "processing" },
    set: (now) => ({ orderStatus: "completed", completedAt: now }),
  },
  cancel: {
    from: { orderStatus: { $in: ["created", "processing"] } },
    set: (now) => ({ orderStatus: "cancelled", cancelledAt: now, cancelReason: "cancelled" }),
  },
  reject_at_delivery: {
    from: { paymentStatus: "paid", orderStatus: "processing" },
    set: (now) => ({ orderStatus: "cancelled", cancelledAt: now, cancelReason: "rejected_at_delivery" }),
  },
  refund: {
    from: { orderStatus: "completed" },
    set: (now) => ({ orderStatus: "cancelled", cancelledAt: now, cancelReason: "refunded" }),
  },
};

const isOrderAction = (value: unknown): value is OrderAction =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(ORDER_STEPS, value);

const orderMoney = (order: Record<string, any>) => {
  const subtotalKobo = Number.isSafeInteger(order.subtotalKobo)
    ? order.subtotalKobo
    : (order.orderItem ?? []).reduce(
        (total: number, item: { price: number; quantity: number }) => total + nairaNumberToKobo(item.price) * Math.max(1, item.quantity),
        0,
      );
  const deliveryFeeKobo = Number.isSafeInteger(order.deliveryFeeKobo) ? order.deliveryFeeKobo : 0;
  const serviceFeeKobo = Number.isSafeInteger(order.serviceFeeKobo) ? order.serviceFeeKobo : 0;
  const totalKobo = Number.isSafeInteger(order.totalKobo) ? order.totalKobo : subtotalKobo + deliveryFeeKobo + serviceFeeKobo;
  return { subtotalKobo, deliveryFeeKobo, serviceFeeKobo, totalKobo };
};

// PATCH /api/v1/orders/:orderId/status  { action }   (admin only)
export const updateOrderStatus = async (req: Request, res: Response): Promise<Response> => {
  const orderId = sanitizeValue(req.params.orderId);
  const action = (req.body as { action?: unknown })?.action;
  if (!/^[a-f0-9]{24}$/i.test(orderId)) {
    return res.status(400).json({ success: 0, message: "invalid order id" });
  }
  if (!isOrderAction(action)) {
    return res.status(400).json({ success: 0, message: `action must be one of ${Object.keys(ORDER_STEPS).join(", ")}` });
  }

  const step = ORDER_STEPS[action];
  const now = new Date();
  try {
    const apply = (session?: unknown) =>
      orderModel
        .findOneAndUpdate({ _id: orderId, ...step.from }, { $set: step.set(now) }, {
          returnDocument: "after",
          ...(session ? { session: session as never } : {}),
        })
        .populate({ path: "orderItem.products", select: "name" })
        .lean();

    const publish = async (order: Record<string, any>, session: Parameters<typeof publishOrderPaid>[0]) => {
      const personId = typeof order.personId === "string" && order.personId ? order.personId : null;
      const money = orderMoney(order);
      const traceId = traceIdOf(req as { traceId?: string });
      if (action === "mark_paid") {
        await publishOrderPaid(session, traceId, {
          orderId,
          personId,
          items: (order.orderItem ?? []).slice(0, 100).map((item: any) => ({
            name: String(item.products?.name || "Item").slice(0, 200),
            quantity: Math.max(1, Number(item.quantity) || 1),
            priceKobo: nairaNumberToKobo(item.price),
          })),
          ...money,
        });
      } else if (action === "complete") {
        await publishOrderCompleted(session, traceId, { orderId, personId, serviceFeeKobo: money.serviceFeeKobo });
      } else {
        await publishOrderCancelled(session, traceId, { orderId, personId, reason: step.set(now).cancelReason as "cancelled" });
      }
    };

    const updated = env.eventsEnabled
      ? await inTransaction(mongoClient(), async (session) => {
          const order = await apply(session);
          if (order) await publish(order as Record<string, any>, session);
          return order;
        })
      : await apply();

    if (!updated) {
      const existing = await orderModel.findById(orderId).select("paymentStatus orderStatus").lean();
      if (!existing) return res.status(404).json({ success: 0, message: "order not found" });
      // A step that isn't allowed from the current state is refused and logged (AGENTS.md §3.7).
      console.warn(JSON.stringify({ event: "order_step_refused", orderId, action, paymentStatus: existing.paymentStatus, orderStatus: existing.orderStatus }));
      return res.status(409).json({
        success: 0,
        message: `cannot ${action} an order that is ${existing.orderStatus} (payment ${existing.paymentStatus})`,
      });
    }

    // Compensation for a cancelled order: release the stock it reserved at checkout. The product
    // id is read directly: getCartProductId recurses forever on an ObjectId (its _id is itself).
    if (action === "cancel" || action === "reject_at_delivery") {
      await rollbackReservedInventory(
        ((updated as Record<string, any>).orderItem ?? []).map((item: any) => ({
          productId: String(item.products && typeof item.products === "object" && item.products._id ? item.products._id : item.products),
          quantity: Number(item.quantity) || 1,
          capacity: String(item.capacity ?? ""),
        })),
      ).catch((error) => console.error(JSON.stringify({ event: "order_stock_release_failed", orderId, message: (error as Error).message })));
    }

    return res.status(200).json({ success: 1, message: `order ${action} done`, data: updated });
  } catch {
    return res.status(500).json({ success: 0, message: "failed to update order" });
  }
};
