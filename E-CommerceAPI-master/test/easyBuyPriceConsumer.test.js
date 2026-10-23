/**
 * U3 consumer: a signed easybuy.price.updated delivery updates the store's read-only price
 * cache, exactly once and in order. Needs a replica set (MONGO_RS_URL / 27028).
 *   requires the build: npm run build first (the store's test script does this).
 */

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const mongoose = require("mongoose");
const {
  createTokenSigner,
  createDeliverySigner,
  createDeliveryVerifier,
  createTokenVerifier,
  createEventReceiver,
  createEvent,
  easybuyPriceUpdated,
  SIGNATURE_HEADER,
  EVENT_ID_HEADER,
  DELIVERY_ID_HEADER,
} = require("@melvingadgets/platform-kit");
const { storeEventHandlers } = require("../dist/utils/platformReceiver");
const EasyBuyPriceCache = require("../dist/models/easyBuyPriceCache").default;

const RS = process.env.MONGO_RS_URL || "mongodb://127.0.0.1:27028/?directConnection=true";
const ISSUER = "http://auth.test";

const authSigner = createTokenSigner({ issuer: ISSUER, keys: [generateKey("auth-k")], activeKid: "auth-k" });
const relayKey = generateKey("relay-k");
const relaySigner = createDeliverySigner({ kid: relayKey.kid, privateKeyPem: relayKey.privateKeyPem });

function generateKey(kid) {
  const { generateSigningKey } = require("@melvingadgets/platform-kit");
  return generateSigningKey(kid);
}

let server;
let base;

const priceEvent = (seq, priceKobo, eventId) =>
  createEvent(easybuyPriceUpdated, {
    subject: { kind: "price", id: "aurapay:iPhone 13:128GB" },
    seq,
    traceId: "trace-consumer",
    eventId: eventId || crypto.randomUUID(),
    data: { provider: "aurapay", model: "iPhone 13", capacity: "128GB", priceKobo, previousPriceKobo: null },
  });

const deliver = async (event) => {
  const body = Buffer.from(JSON.stringify(event));
  const deliveryId = crypto.randomUUID();
  const token = (await authSigner.signServiceToken({ caller: "relay", audience: "store", scopes: ["events:deliver"] })).token;
  const signature = await relaySigner.sign(body, { eventId: event.eventId, deliveryId });
  const res = await fetch(`${base}/internal/events`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      [SIGNATURE_HEADER]: signature,
      [EVENT_ID_HEADER]: event.eventId,
      [DELIVERY_ID_HEADER]: deliveryId,
    },
    body,
  });
  return { status: res.status, body: await res.json() };
};

test.before(async () => {
  await mongoose.connect(`mongodb://127.0.0.1:27028/store_consumer_test_${crypto.randomUUID().slice(0, 8)}?directConnection=true`);
  await EasyBuyPriceCache.syncIndexes();
  const app = express();
  app.post(
    "/internal/events",
    express.raw({ type: () => true, limit: "1mb" }),
    createEventReceiver({
      service: "store",
      tokens: createTokenVerifier({ issuer: ISSUER, jwks: await authSigner.jwks() }),
      deliveries: createDeliveryVerifier({ jwks: await relaySignerJwks() }),
      client: mongoose.connection.getClient(),
      db: mongoose.connection.db,
      handlers: storeEventHandlers,
    }),
  );
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

async function relaySignerJwks() {
  // The relay's public key, served the way createTokenSigner.jwks() produces it.
  return createTokenSigner({ issuer: "relay", keys: [relayKey], activeKid: relayKey.kid }).jwks();
}

test.after(async () => {
  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test.afterEach(async () => {
  await EasyBuyPriceCache.deleteMany({});
  await mongoose.connection.db.collection("inbox").deleteMany({});
  await mongoose.connection.db.collection("event_cursors").deleteMany({});
});

test("a signed delivery writes the price into the read-only cache", async () => {
  const res = await deliver(priceEvent(1, 42_000_000));
  assert.deepEqual(res, { status: 200, body: { status: "applied" } });
  const row = await EasyBuyPriceCache.findOne({ key: "aurapay:iPhone 13:128GB" }).lean();
  assert.equal(row.priceKobo, 42_000_000);
  assert.equal(row.source, "easybuy");
  assert.equal(row.sourceSeq, 1);
});

test("a redelivery is a no-op duplicate", async () => {
  const event = priceEvent(1, 42_000_000);
  assert.equal((await deliver(event)).body.status, "applied");
  assert.equal((await deliver(event)).body.status, "duplicate");
  assert.equal(await EasyBuyPriceCache.countDocuments(), 1);
});

test("an out-of-order (older seq) delivery is skipped and does not overwrite a newer price", async () => {
  assert.equal((await deliver(priceEvent(2, 40_000_000))).body.status, "applied");
  assert.equal((await deliver(priceEvent(1, 99_000_000))).body.status, "stale");
  const row = await EasyBuyPriceCache.findOne({ key: "aurapay:iPhone 13:128GB" }).lean();
  assert.equal(row.priceKobo, 40_000_000);
});

test("an unauthorised delivery is rejected and writes nothing", async () => {
  const event = priceEvent(1, 42_000_000);
  const body = Buffer.from(JSON.stringify(event));
  const res = await fetch(`${base}/internal/events`, {
    method: "POST",
    headers: { "content-type": "application/json", [EVENT_ID_HEADER]: event.eventId, [DELIVERY_ID_HEADER]: "d" },
    body,
  });
  assert.equal(res.status, 401);
  assert.equal(await EasyBuyPriceCache.countDocuments(), 0);
});
