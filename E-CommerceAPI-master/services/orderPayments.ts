import { inTransaction, type MongoSession } from "@melvingadgets/platform-kit";
import { env } from "../config/env";
import guestCheckoutModel from "../model/guestCheckoutModel";
import orderModel from "../model/orderModel";
import { nairaNumberToKobo } from "../utils/orderFees";
import { mongoClient, publishOrderPaid, type OrderEventFacts } from "../utils/platformMessaging";

export type StoreOrderKind = "user" | "guest";

export interface StoreOrderLineItem {
  price?: number;
  quantity?: number;
  products?: { name?: string } | unknown;
}

export interface StoreOrderRecord {
  _id?: unknown;
  user?: unknown;
  personId?: unknown;
  guest?: Record<string, unknown>;
  orderItem?: StoreOrderLineItem[];
  bill?: number;
  subtotalKobo?: number;
  deliveryFeeKobo?: number;
  serviceFeeKobo?: number;
  totalKobo?: number;
  paymentStatus?: string;
  orderStatus?: string;
  paymentReference?: string;
  paystackReference?: string;
  paystackTransactionId?: string;
  paidAt?: Date | string | null;
}

export const orderMoney = (order: StoreOrderRecord) => {
  const itemSubtotalKobo = (order.orderItem ?? []).reduce(
    (total: number, item: StoreOrderLineItem) =>
      total + nairaNumberToKobo(Number(item.price ?? 0)) * Math.max(1, Number(item.quantity ?? 1)),
    0,
  );
  const subtotalKobo = typeof order.subtotalKobo === "number" && Number.isSafeInteger(order.subtotalKobo)
    ? order.subtotalKobo
    : itemSubtotalKobo > 0
      ? itemSubtotalKobo
      : nairaNumberToKobo(Number(order.bill ?? 0));
  const deliveryFeeKobo = typeof order.deliveryFeeKobo === "number" && Number.isSafeInteger(order.deliveryFeeKobo)
    ? order.deliveryFeeKobo
    : 0;
  const serviceFeeKobo = typeof order.serviceFeeKobo === "number" && Number.isSafeInteger(order.serviceFeeKobo)
    ? order.serviceFeeKobo
    : 0;
  const totalKobo = typeof order.totalKobo === "number" && Number.isSafeInteger(order.totalKobo)
    ? order.totalKobo
    : subtotalKobo + deliveryFeeKobo + serviceFeeKobo;
  return { subtotalKobo, deliveryFeeKobo, serviceFeeKobo, totalKobo };
};

export const buildOrderPaidFacts = (
  orderId: string,
  order: StoreOrderRecord,
): OrderEventFacts => {
  const personId = typeof order.personId === "string" && order.personId ? order.personId : null;
  const money = orderMoney(order);
  return {
    orderId,
    personId,
    items: (order.orderItem ?? []).slice(0, 100).map((item) => {
      const populatedProduct = item.products && typeof item.products === "object"
        ? (item.products as { name?: unknown })
        : null;
      return {
        name: String(populatedProduct?.name || "Item").slice(0, 200),
        quantity: Math.max(1, Number(item.quantity) || 1),
        priceKobo: nairaNumberToKobo(Number(item.price ?? 0)),
      };
    }),
    ...money,
  };
};

export interface GatewayPaidTransitionInput {
  kind: StoreOrderKind;
  orderId: string;
  reference: string;
  paystackTransactionId: string;
  traceId: string;
}

export type GatewayPaidTransitionResult =
  | { outcome: "paid"; order: StoreOrderRecord }
  | { outcome: "already_paid"; order: StoreOrderRecord }
  | { outcome: "conflict"; order: StoreOrderRecord; message: string }
  | { outcome: "not_found" };

export const markOrderPaidByGateway = async ({
  kind,
  orderId,
  reference,
  paystackTransactionId,
  traceId,
}: GatewayPaidTransitionInput): Promise<GatewayPaidTransitionResult> => {
  const targetModel = (kind === "guest" ? guestCheckoutModel : orderModel) as typeof orderModel;
  const now = new Date();
  const filter = {
    _id: orderId,
    paymentStatus: "pending",
    orderStatus: { $in: ["created", "processing"] },
  };
  const update = {
    $set: {
      paymentStatus: "paid",
      orderStatus: "processing",
      paidAt: now,
      paymentProvider: "paystack",
      paymentReference: reference,
      paystackReference: reference,
      paystackTransactionId,
    },
  };

  const apply = async (session?: unknown): Promise<StoreOrderRecord | null> => {
    const doc = await targetModel
      .findOneAndUpdate(filter, update, {
        returnDocument: "after",
        ...(session ? { session: session as never } : {}),
      })
      .populate({ path: "orderItem.products", select: "name" });

    if (!doc) {
      return null;
    }

    const withToObject = doc as unknown as { toObject?: () => StoreOrderRecord };
    return typeof withToObject.toObject === "function"
      ? withToObject.toObject()
      : (doc as unknown as StoreOrderRecord);
  };

  const updated = env.eventsEnabled
    ? await inTransaction(mongoClient(), async (session: MongoSession) => {
        const doc = await apply(session);
        if (doc) {
          await publishOrderPaid(session, traceId, buildOrderPaidFacts(orderId, doc));
        }
        return doc;
      })
    : await apply();

  if (updated) {
    return { outcome: "paid", order: updated };
  }

  const existing = await targetModel
    .findById(orderId)
    .select("paymentStatus orderStatus paymentReference paystackReference paystackTransactionId bill totalKobo paidAt")
    .lean<StoreOrderRecord>();

  if (!existing) {
    return { outcome: "not_found" };
  }

  if (existing.paymentStatus === "paid") {
    return { outcome: "already_paid", order: existing };
  }

  return {
    outcome: "conflict",
    order: existing,
    message: `cannot mark paid an order that is ${String(existing.orderStatus ?? "unknown")} (payment ${String(existing.paymentStatus ?? "unknown")})`,
  };
};
