import type { CheckoutRecord, OrderRecord } from "../types/domain";
import type { VerifiedOrderPayment } from "../services/paymentService";

export const resolveOrderCheckoutType = (order: Pick<CheckoutRecord, "_id"> & { guest?: unknown }): "user" | "guest" =>
  "guest" in order && Boolean(order.guest) ? "guest" : "user";

export const resolveOrderDisplayAmount = (order: { bill?: number; totalKobo?: number } | null | undefined): number => {
  if (!order) {
    return 0;
  }
  if (typeof order.totalKobo === "number" && Number.isFinite(order.totalKobo) && order.totalKobo > 0) {
    return order.totalKobo / 100;
  }
  return typeof order.bill === "number" && Number.isFinite(order.bill) ? order.bill : 0;
};

export const buildOrderConfirmQuery = ({
  reference,
  status,
  pending,
}: {
  reference?: string;
  status?: string;
  pending?: boolean;
}): string => {
  const query = new URLSearchParams();
  if (reference) {
    query.set("reference", reference);
  }
  if (status) {
    query.set("status", status);
  }
  if (pending) {
    query.set("pending", "1");
  }
  const encoded = query.toString();
  return encoded ? `/orderconfirm?${encoded}` : "/orderconfirm";
};

export const canPayOrder = (
  order: Pick<OrderRecord, "paymentStatus" | "orderStatus"> | Pick<VerifiedOrderPayment, "paymentStatus" | "orderStatus"> | null | undefined,
): boolean => Boolean(order && order.paymentStatus === "pending" && order.orderStatus !== "cancelled");
