import type { Request, Response } from "express";
import orderModel from "../model/orderModel";
import { nairaNumberToKobo } from "../utils/orderFees";

// Service-token routes for other platform services (Shortwork/AGENTS.md §2). Money leaves the
// store only as integer kobo (§4.1).

const PERSON_ID = /^[A-Za-z0-9_-]{1,64}$/;

// GET /internal/people/:personId/orders  (scope store:orders.read)
// One person's store orders, for the reseller service's stages and its reconciliation check
// (Shortwork/RESELLER-PLAN.md §14). Product names, quantities, statuses and kobo; never the
// delivery address, phone or email.
export const getPersonOrders = async (req: Request, res: Response): Promise<Response> => {
  const personId = String(req.params.personId ?? "");
  if (!PERSON_ID.test(personId)) return res.status(400).json({ message: "invalid personId" });

  const orders = await orderModel
    .find({ personId })
    .sort({ createdAt: 1 })
    .limit(200)
    .populate({ path: "orderItem.products", select: "name" })
    .lean();

  res.set("Cache-Control", "no-store");
  return res.status(200).json({
    personId,
    currency: "NGN",
    unit: "kobo",
    asOf: new Date().toISOString(),
    orders: orders.map((order: Record<string, any>) => {
      const items = (order.orderItem ?? []).map((item: any) => ({
        name: String(item.products?.name || "Item"),
        quantity: Math.max(1, Number(item.quantity) || 1),
        priceKobo: nairaNumberToKobo(item.price),
      }));
      const subtotalKobo = Number.isSafeInteger(order.subtotalKobo)
        ? order.subtotalKobo
        : items.reduce((total: number, item: { priceKobo: number; quantity: number }) => total + item.priceKobo * item.quantity, 0);
      return {
        orderId: String(order._id),
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        cancelReason: order.cancelReason ?? null,
        items,
        subtotalKobo,
        deliveryFeeKobo: Number.isSafeInteger(order.deliveryFeeKobo) ? order.deliveryFeeKobo : 0,
        serviceFeeKobo: Number.isSafeInteger(order.serviceFeeKobo) ? order.serviceFeeKobo : 0,
        totalKobo: Number.isSafeInteger(order.totalKobo) ? order.totalKobo : subtotalKobo,
        createdAt: order.createdAt,
        paidAt: order.paidAt ?? null,
        completedAt: order.completedAt ?? null,
        cancelledAt: order.cancelledAt ?? null,
      };
    }),
  });
};
