import mongoose from "mongoose";
import {
  ensureOutboxIndexes,
  publishInTransaction,
  storeOrderCancelled,
  storeOrderCompleted,
  storeOrderPaid,
  type MongoClientLike,
  type MongoDbLike,
  type MongoSession,
} from "@melvingadgets/platform-kit";
import { env } from "../config/env";

// The producing end of the event pipeline for the store (Shortwork/AGENTS.md §3.1). An order's
// status change and its event are written in ONE transaction: the mongoose write and the outbox
// insert share the driver session. Events carry IDs, product names and kobo, never contact details.

export const mongoClient = (): MongoClientLike => mongoose.connection.getClient() as unknown as MongoClientLike;

export const rawDb = (): MongoDbLike => {
  const db = mongoose.connection.db;
  if (!db) throw new Error("mongoose is not connected");
  return db as unknown as MongoDbLike;
};

/** The outbox indexes the relay reads by. Called on boot only when events are on. */
export const initOutbox = async (): Promise<void> => {
  if (env.eventsEnabled) await ensureOutboxIndexes(rawDb());
};

const FALLBACK_TRACE_ID = "00000000-0000-0000-0000-000000000000";
export const traceIdOf = (req: { traceId?: string }): string => req.traceId ?? FALLBACK_TRACE_ID;

const subjectFor = (orderId: string, personId: string | null) =>
  personId ? { kind: "order", id: orderId, personId } : { kind: "order", id: orderId };

export interface OrderEventFacts {
  orderId: string;
  personId: string | null;
  items: Array<{ name: string; quantity: number; priceKobo: number }>;
  subtotalKobo: number;
  deliveryFeeKobo: number;
  serviceFeeKobo: number;
  totalKobo: number;
}

export const publishOrderPaid = (session: MongoSession, traceId: string, order: OrderEventFacts) =>
  publishInTransaction(rawDb(), session, storeOrderPaid, {
    subject: subjectFor(order.orderId, order.personId),
    traceId,
    data: {
      orderId: order.orderId,
      personId: order.personId,
      items: order.items,
      subtotalKobo: order.subtotalKobo,
      deliveryFeeKobo: order.deliveryFeeKobo,
      serviceFeeKobo: order.serviceFeeKobo,
      totalKobo: order.totalKobo,
    },
  });

export const publishOrderCompleted = (
  session: MongoSession,
  traceId: string,
  order: { orderId: string; personId: string | null; serviceFeeKobo: number },
) =>
  publishInTransaction(rawDb(), session, storeOrderCompleted, {
    subject: subjectFor(order.orderId, order.personId),
    traceId,
    data: { orderId: order.orderId, personId: order.personId, serviceFeeKobo: order.serviceFeeKobo },
  });

export const publishOrderCancelled = (
  session: MongoSession,
  traceId: string,
  order: { orderId: string; personId: string | null; reason: "rejected_at_delivery" | "cancelled" | "refunded" },
) =>
  publishInTransaction(rawDb(), session, storeOrderCancelled, {
    subject: subjectFor(order.orderId, order.personId),
    traceId,
    data: { orderId: order.orderId, personId: order.personId, reason: order.reason },
  });
