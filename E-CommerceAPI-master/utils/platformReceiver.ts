import mongoose from "mongoose";
import {
  createDeliveryVerifier,
  createEventReceiver,
  createTokenVerifier,
  type EventEffect,
  type MongoClientLike,
  type MongoDbLike,
} from "@melvingadgets/platform-kit";
import { env } from "../config/env";
import EasyBuyPriceCache from "../models/easyBuyPriceCache";

// The receiving end of the event pipeline for the store (Shortwork/AGENTS.md §3.2, §3.4).
// Enabled only once auth's and the relay's JWKS are configured, so the rollout is additive.
export const platformReceiverEnabled = Boolean(env.platform.authIssuer && env.platform.authJwksUrl && env.platform.relayJwksUrl);

// Upsert EasyBuy's new price into the read-only cache, through the inbox transaction's session.
const applyPriceUpdate: EventEffect = async (event, session) => {
  const data = event.data as { provider: string; model: string; capacity: string; priceKobo: number; previousPriceKobo: number | null };
  const key = `${data.provider}:${data.model}:${data.capacity}`;
  await EasyBuyPriceCache.updateOne(
    { key },
    {
      $set: {
        key,
        provider: data.provider,
        model: data.model,
        capacity: data.capacity,
        priceKobo: data.priceKobo,
        previousPriceKobo: data.previousPriceKobo ?? null,
        source: "easybuy",
        sourceSeq: event.seq,
        asOf: new Date(event.occurredAt),
      },
    },
    { upsert: true, session: session as never },
  );
};

/** Effects the store applies, keyed by event type. Exported so tests exercise the real effect. */
export const storeEventHandlers: Record<string, EventEffect> = {
  "easybuy.price.updated": applyPriceUpdate,
};

export const buildEventReceiver = () =>
  createEventReceiver({
    service: "store",
    tokens: createTokenVerifier({ issuer: env.platform.authIssuer, jwks: env.platform.authJwksUrl as string }),
    deliveries: createDeliveryVerifier({ jwks: env.platform.relayJwksUrl as string }),
    client: mongoose.connection.getClient() as unknown as MongoClientLike,
    db: mongoose.connection.db as unknown as MongoDbLike,
    handlers: storeEventHandlers,
  });
