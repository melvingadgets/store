/**
 * Reseller programme, store side (Shortwork/RESELLER-PLAN.md §7, §8a):
 *   - fee maths: service fee = 2.5 × the courier's delivery quote, half-up to the kobo;
 *   - the mock courier's placeholder prices; fees stay off by default;
 *   - the order lifecycle state machine writes store.order.* events with each step (outbox),
 *     refuses steps that aren't allowed, and writes nothing when it refuses;
 *   - GET /internal/people/:personId/orders needs the reseller's store:orders.read scope.
 * Needs a replica set (MONGO_RS_URL / 27028). Requires the build (npm test runs it first).
 */

"use strict";

const { describe, it, before, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const mongoose = require("mongoose");
const { createTokenSigner, createTokenVerifier, generateSigningKey, kobo, OUTBOX_COLLECTION } = require("@melvingadgets/platform-kit");
const { env } = require("../dist/config/env");
const orderModel = require("../dist/model/orderModel").default;
const orderController = require("../dist/controller/orderController");
const { createInternalRouter } = require("../dist/router/internalRouter");
const { computeOrderFees, feesFromQuote, serviceFeeFor, subtotalKoboOf } = require("../dist/utils/orderFees");
const { mockCourier } = require("../dist/services/courier");
const { createMockRequest, createMockResponse } = require("./helpers/testUtils");

const RS = process.env.MONGO_RS_URL || "mongodb://127.0.0.1:27028/?directConnection=true";
const ISSUER = "http://auth.test";
const signer = createTokenSigner({ issuer: ISSUER, keys: [generateSigningKey("k-orders")], activeKid: "k-orders" });
const PRODUCT_ID = new mongoose.Types.ObjectId();

let server;
let base;
let previousEventsEnabled;
// With --experimental-test-isolation=none every test file shares one process and one mongoose
// connection; reuse it when another file opened it, and only drop what this file created.
let ownConnection = false;

const outbox = () => mongoose.connection.db.collection(OUTBOX_COLLECTION);
const step = async (orderId, action) => {
  const req = createMockRequest({ params: { orderId: String(orderId) }, body: { action } });
  const res = createMockResponse();
  await orderController.updateOrderStatus(req, res);
  return res;
};
const newOrder = (overrides = {}) =>
  orderModel.create({
    user: new mongoose.Types.ObjectId(),
    orderItem: [{ products: PRODUCT_ID, capacity: "", quantity: 2, price: 450000 }],
    bill: 900000,
    personId: "person-shopper",
    subtotalKobo: 90_000_000,
    deliveryFeeKobo: 450_000,
    serviceFeeKobo: 1_125_000,
    totalKobo: 91_575_000,
    feeSource: "courier:mock",
    feeQuoteMock: true,
    ...overrides,
  });

describe("reseller orders (store)", () => {
before(async () => {
  if (mongoose.connection.readyState === 0) {
    const url = new URL(RS);
    url.pathname = `/store_reseller_test_${crypto.randomUUID().slice(0, 8)}`;
    await mongoose.connect(url.toString());
    ownConnection = true;
  }
  await orderModel.syncIndexes();
  await mongoose.connection.db.collection("products").insertOne({ _id: PRODUCT_ID, name: "iPhone 12 Pro", price: 450000, qty: 3 });
  previousEventsEnabled = env.eventsEnabled;
  env.eventsEnabled = true;

  const app = express();
  app.use("/internal", createInternalRouter(createTokenVerifier({ issuer: ISSUER, jwks: await signer.jwks() })));
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  env.eventsEnabled = previousEventsEnabled;
  server.close();
  await mongoose.connection.db.collection("products").deleteOne({ _id: PRODUCT_ID });
  if (ownConnection) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

afterEach(async () => {
  await orderModel.deleteMany({});
  await outbox().deleteMany({});
  await mongoose.connection.db.collection("event_seqs").deleteMany({});
});

it("service fee is 2.5 × the delivery quote, half-up to the kobo", () => {
  assert.equal(serviceFeeFor(kobo(500_000), "2.5"), 1_250_000);
  assert.equal(serviceFeeFor(kobo(333), "2.5"), 833); // 832.5 -> 833
  assert.equal(serviceFeeFor(kobo(0), "2.5"), 0);
  for (let i = 0; i < 300; i += 1) {
    const delivery = Math.floor(Math.random() * 10_000_000);
    const exact = Number((BigInt(delivery) * 25n + 5n) / 10n); // round half up of delivery × 2.5
    assert.equal(serviceFeeFor(kobo(delivery), "2.5"), exact);
  }
});

it("fees add up exactly, and the subtotal is in kobo from naira prices", async () => {
  assert.equal(subtotalKoboOf([{ price: 450000.5, quantity: 2 }]), 90_000_100);
  const quote = await mockCourier.quote({ items: [{ quantity: 2 }, { quantity: 1 }] });
  assert.equal(quote.deliveryFeeKobo, 350_000 + 2 * 100_000);
  assert.equal(quote.mock, true);
  const fees = feesFromQuote(kobo(90_000_000), quote, "2.5");
  assert.deepEqual(
    { delivery: fees.deliveryFeeKobo, service: fees.serviceFeeKobo, total: fees.totalKobo, source: fees.feeSource },
    { delivery: 550_000, service: 1_375_000, total: 90_000_000 + 550_000 + 1_375_000, source: "courier:mock" },
  );
});

it("fees are off by default: the order costs its items only", async () => {
  assert.equal(env.fees.enabled, false);
  const fees = await computeOrderFees([{ price: 1000, quantity: 1 }]);
  assert.deepEqual(
    { delivery: fees.deliveryFeeKobo, service: fees.serviceFeeKobo, total: fees.totalKobo, source: fees.feeSource },
    { delivery: 0, service: 0, total: 100_000, source: "disabled" },
  );
});

it("paid → completed writes store.order.paid then store.order.completed with the change", async () => {
  const order = await newOrder();
  const paid = await step(order._id, "mark_paid");
  assert.equal(paid.statusCode, 200);
  const done = await step(order._id, "complete");
  assert.equal(done.statusCode, 200);

  const saved = await orderModel.findById(order._id).lean();
  assert.equal(saved.paymentStatus, "paid");
  assert.equal(saved.orderStatus, "completed");
  assert.ok(saved.paidAt && saved.completedAt);

  const events = await outbox().find({}).sort({ createdAt: 1 }).toArray();
  assert.deepEqual(events.map((event) => [event.type, event.seq]), [["store.order.paid", 1], ["store.order.completed", 2]]);
  assert.deepEqual(events[0].subject, { kind: "order", id: String(order._id), personId: "person-shopper" });
  assert.deepEqual(events[0].data.items, [{ name: "iPhone 12 Pro", quantity: 2, priceKobo: 45_000_000 }]);
  assert.equal(events[0].data.serviceFeeKobo, 1_125_000);
  assert.equal(events[1].data.serviceFeeKobo, 1_125_000);
});

it("refuses steps that aren't allowed, and writes no event for them", async () => {
  const order = await newOrder();
  assert.equal((await step(order._id, "complete")).statusCode, 409); // not paid yet
  assert.equal((await step(order._id, "refund")).statusCode, 409); // not completed
  assert.equal((await step(order._id, "teleport")).statusCode, 400);
  assert.equal((await step(new mongoose.Types.ObjectId(), "mark_paid")).statusCode, 404);
  assert.equal(await outbox().countDocuments({}), 0);
});

it("rejection at delivery and refunds publish store.order.cancelled with the reason", async () => {
  const rejected = await newOrder();
  await step(rejected._id, "mark_paid");
  assert.equal((await step(rejected._id, "reject_at_delivery")).statusCode, 200);
  const refunded = await newOrder({ personId: undefined });
  await step(refunded._id, "mark_paid");
  await step(refunded._id, "complete");
  assert.equal((await step(refunded._id, "refund")).statusCode, 200);

  const cancelled = await outbox().find({ type: "store.order.cancelled" }).toArray();
  assert.deepEqual(
    cancelled.map((event) => [event.data.reason, event.data.personId]).sort(),
    [["refunded", null], ["rejected_at_delivery", "person-shopper"]],
  );
});

it("GET /internal/people/:personId/orders needs store:orders.read and returns kobo without contact details", async () => {
  await newOrder({ guest: { name: "Ada", email: "ada@example.com", phone: "+2348030000000", address: "Ikeja" } });
  await newOrder({ personId: "someone-else" });
  const url = `${base}/internal/people/person-shopper/orders`;
  const token = async (scopes) => `Bearer ${(await signer.signServiceToken({ caller: "reseller", audience: "store", scopes })).token}`;

  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(url, { headers: { authorization: await token(["auth:people.read"]) } })).status, 403);
  const res = await fetch(url, { headers: { authorization: await token(["store:orders.read"]) } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.orders.length, 1);
  assert.deepEqual(body.orders[0].items, [{ name: "iPhone 12 Pro", quantity: 2, priceKobo: 45_000_000 }]);
  assert.equal(body.orders[0].serviceFeeKobo, 1_125_000);
  assert.doesNotMatch(JSON.stringify(body), /example\.com|\+234|Ikeja/);
});
});
