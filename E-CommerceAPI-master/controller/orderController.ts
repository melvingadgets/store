import type { Request, Response } from "express";
import cartModel from "../model/cartModel";
import guestCheckoutModel from "../model/guestCheckoutModel";
import orderModel from "../model/orderModel";
import productModel from "../model/productModel";
import { findStorageOption, normalizeCapacity, summarizeStorageOptions } from "../utils/storageOptions";

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

    return res.status(200).json({
      success: 1,
      message: "orders loaded successfully",
      data: orders,
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

    return res.status(201).json({
      success: 1,
      message: "order created successfully",
      data: hydratedOrder ?? createOrder,
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
    });

    reservedInventory = [];

    const hydratedGuestCheckout = await guestCheckoutModel.findById(createGuestCheckout._id).populate(orderPopulation);

    return res.status(201).json({
      success: 1,
      message: "guest checkout created successfully",
      data: hydratedGuestCheckout ?? createGuestCheckout,
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
