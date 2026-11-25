import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildOrderConfirmQuery,
  canPayOrder,
  resolveOrderCheckoutType,
  resolveOrderDisplayAmount,
} from "../src/lib/paymentState.ts";

test("resolveOrderCheckoutType distinguishes guest checkouts from signed-in orders", () => {
  assert.equal(resolveOrderCheckoutType({ _id: "order-1", user: "u1" } as never), "user");
  assert.equal(
    resolveOrderCheckoutType({
      _id: "guest-1",
      guest: {
        fullName: "Ada",
        email: "ada@example.com",
        whatsappPhoneNumber: "+2348012345678",
        address: "1 Ikeja",
        state: "Lagos",
      },
    }),
    "guest",
  );
});

test("resolveOrderDisplayAmount prefers totalKobo when positive and falls back to naira bill", () => {
  assert.equal(resolveOrderDisplayAmount({ bill: 450000, totalKobo: 46225000 }), 462250);
  assert.equal(resolveOrderDisplayAmount({ bill: 450000, totalKobo: 0 }), 450000);
  assert.equal(resolveOrderDisplayAmount({ bill: 450000 }), 450000);
  assert.equal(resolveOrderDisplayAmount(null), 0);
});

test("buildOrderConfirmQuery serializes Paystack reference and pending params cleanly", () => {
  assert.equal(buildOrderConfirmQuery({}), "/orderconfirm");
  assert.equal(
    buildOrderConfirmQuery({ reference: "psk-u-1", status: "success" }),
    "/orderconfirm?reference=psk-u-1&status=success",
  );
  assert.equal(
    buildOrderConfirmQuery({ reference: "psk-g-2", pending: true }),
    "/orderconfirm?reference=psk-g-2&pending=1",
  );
});

test("canPayOrder allows payment only on pending non-cancelled orders", () => {
  assert.equal(canPayOrder({ paymentStatus: "pending", orderStatus: "created" }), true);
  assert.equal(canPayOrder({ paymentStatus: "pending", orderStatus: "processing" }), true);
  assert.equal(canPayOrder({ paymentStatus: "paid", orderStatus: "processing" }), false);
  assert.equal(canPayOrder({ paymentStatus: "pending", orderStatus: "cancelled" }), false);
  assert.equal(canPayOrder(null), false);
});
