const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");

const { env } = require("../dist/config/env");
const { mainApp } = require("../dist/mainApp");
const guestCheckoutModel = require("../dist/model/guestCheckoutModel").default;
const orderModel = require("../dist/model/orderModel").default;
const profileModel = require("../dist/model/profileModel").default;
const userModel = require("../dist/model/userModel").default;
const paystackService = require("../dist/services/paystack");
const paymentController = require("../dist/controller/paymentController");
const {
  createMockRequest,
  createMockResponse,
  createPopulateChain,
  stubMethod,
} = require("./helpers/testUtils");

const restoreEnv = (snapshot) => {
  env.paystack.publicKey = snapshot.publicKey;
  env.paystack.secretKey = snapshot.secretKey;
  env.paystack.baseUrl = snapshot.baseUrl;
  env.eventsEnabled = snapshot.eventsEnabled;
  env.corsOrigins = snapshot.corsOrigins;
};

const snapshotEnv = () => ({
  publicKey: env.paystack.publicKey,
  secretKey: env.paystack.secretKey,
  baseUrl: env.paystack.baseUrl,
  eventsEnabled: env.eventsEnabled,
  corsOrigins: [...env.corsOrigins],
});

test("paystackService helpers build references, verify HMAC-SHA512 signatures, and call Paystack REST API", async () => {
  const prev = snapshotEnv();
  const calls = [];
  const server = http.createServer((req, res) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      calls.push({
        method: req.method,
        url: req.url,
        auth: req.headers.authorization,
        body: raw ? JSON.parse(raw) : null,
      });
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/transaction/initialize" && req.method === "POST") {
        res.statusCode = 200;
        res.end(JSON.stringify({
          status: true,
          message: "Authorization URL created",
          data: {
            authorization_url: "https://checkout.paystack.test/abc",
            access_code: "access_abc",
            reference: "psk-u-order1",
          },
        }));
        return;
      }
      if (req.url === "/transaction/verify/psk-u-order1" && req.method === "GET") {
        res.statusCode = 200;
        res.end(JSON.stringify({
          status: true,
          message: "Verification successful",
          data: {
            id: 99001,
            reference: "psk-u-order1",
            status: "success",
            currency: "NGN",
            amount: 45_000_050,
            gateway_response: "Successful",
            channel: "card",
          },
        }));
        return;
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ status: false, message: "Not found" }));
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  env.paystack.publicKey = "pk_test_1";
  env.paystack.secretKey = "sk_test_secret";
  env.paystack.baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    assert.match(paystackService.buildPaystackReference("user", "507f1f77bcf86cd799439011"), /^psk-u-507f1f77bcf86cd799439011-[a-f0-9]{8}$/);
    assert.match(paystackService.buildPaystackReference("guest", "507f1f77bcf86cd799439011"), /^psk-g-507f1f77bcf86cd799439011-[a-f0-9]{8}$/);

    const samplePayload = Buffer.from('{"event":"charge.success","data":{"reference":"psk-u-order1"}}');
    const validSig = crypto.createHmac("sha512", "sk_test_secret").update(samplePayload).digest("hex");
    assert.equal(paystackService.verifyPaystackWebhookSignature(samplePayload, validSig, "sk_test_secret"), true);
    assert.equal(paystackService.verifyPaystackWebhookSignature(samplePayload, validSig.toUpperCase(), "sk_test_secret"), true);
    assert.equal(paystackService.verifyPaystackWebhookSignature(samplePayload, "deadbeef", "sk_test_secret"), false);
    assert.equal(paystackService.verifyPaystackWebhookSignature(samplePayload, undefined, "sk_test_secret"), false);

    const initialized = await paystackService.paystackGateway.initializeTransaction({
      email: "buyer@example.com",
      amountKobo: 45_000_050,
      reference: "psk-u-order1",
      callbackUrl: "https://melvingadgets.com/orderconfirm",
      cancelUrl: "https://melvingadgets.com/orderconfirm?reference=psk-u-order1&status=cancelled",
      metadata: { orderId: "order1" },
    });

    assert.equal(initialized.authorizationUrl, "https://checkout.paystack.test/abc");
    assert.equal(initialized.accessCode, "access_abc");
    assert.equal(initialized.reference, "psk-u-order1");
    assert.equal(calls[0].auth, "Bearer sk_test_secret");
    assert.equal(calls[0].body.amount, 45_000_050);
    assert.equal(calls[0].body.currency, "NGN");
    assert.equal(calls[0].body.metadata.cancel_action, "https://melvingadgets.com/orderconfirm?reference=psk-u-order1&status=cancelled");

    const verified = await paystackService.paystackGateway.verifyTransaction("psk-u-order1");
    assert.equal(verified.id, "99001");
    assert.equal(verified.reference, "psk-u-order1");
    assert.equal(verified.status, "success");
    assert.equal(verified.currency, "NGN");
    assert.equal(verified.amountKobo, 45_000_050);
  } finally {
    restoreEnv(prev);
    await new Promise((resolve) => server.close(resolve));
  }
});

test("initializePaystackPayment fails closed when unconfigured and blocks disallowed redirect origins", async () => {
  const prev = snapshotEnv();
  env.paystack.secretKey = null;

  try {
    const resMissing = createMockResponse();
    await paymentController.initializePaystackPayment(
      createMockRequest({ body: { orderId: new mongoose.Types.ObjectId().toString() } }),
      resMissing,
    );
    assert.equal(resMissing.statusCode, 503);
    assert.equal(resMissing.body.code, "PAYMENT_NOT_CONFIGURED");

    env.paystack.secretKey = "sk_test_1";
    env.corsOrigins = ["https://melvingadgets.com"];

    const resRedirect = createMockResponse();
    await paymentController.initializePaystackPayment(
      createMockRequest({
        body: {
          orderId: new mongoose.Types.ObjectId().toString(),
          redirectUrl: "https://evil-phishing.example/steal",
        },
      }),
      resRedirect,
    );
    assert.equal(resRedirect.statusCode, 400);
    assert.match(resRedirect.body.message, /redirectUrl origin is not allowed/i);
  } finally {
    restoreEnv(prev);
  }
});

test("initializePaystackPayment enforces ownership and initializes signed-in and guest checkouts using server kobo", async () => {
  const prev = snapshotEnv();
  env.paystack.publicKey = "pk_test_1";
  env.paystack.secretKey = "sk_test_1";
  env.corsOrigins = ["https://melvingadgets.com"];

  const userOrderId = new mongoose.Types.ObjectId().toString();
  const guestOrderId = new mongoose.Types.ObjectId().toString();
  const gatewayCalls = [];
  const updateCalls = [];

  const restoreUserOrderFind = stubMethod(orderModel, "findById", (id) => ({
    lean: async () => (id === userOrderId
      ? {
          _id: userOrderId,
          user: "user-1",
          bill: 100000,
          totalKobo: 10_500_000,
          paymentStatus: "pending",
          orderStatus: "created",
          paymentReference: "web-123",
        }
      : null),
  }));
  const restoreUserOrderUpdate = stubMethod(orderModel, "updateOne", async (filter, update) => {
    updateCalls.push({ collection: "orders", filter, update });
    return { modifiedCount: 1 };
  });
  const restoreGuestFind = stubMethod(guestCheckoutModel, "findById", (id) => ({
    lean: async () => (id === guestOrderId
      ? {
          _id: guestOrderId,
          guest: {
            fullName: "Guest Buyer",
            email: "guest@example.com",
            whatsappPhoneNumber: "+2348099999999",
          },
          bill: 50000,
          totalKobo: 5_000_000,
          paymentStatus: "pending",
          orderStatus: "created",
          paymentReference: "guest-ref-1",
        }
      : null),
  }));
  const restoreGuestUpdate = stubMethod(guestCheckoutModel, "updateOne", async (filter, update) => {
    updateCalls.push({ collection: "guestCheckouts", filter, update });
    return { modifiedCount: 1 };
  });
  const restoreUserFind = stubMethod(userModel, "findById", () => ({
    select: () => ({
      lean: async () => ({ _id: "user-1", email: "user1@example.com", userName: "Mel" }),
    }),
  }));
  const restoreProfileFind = stubMethod(profileModel, "findOne", () => ({
    select: () => ({
      lean: async () => ({ firstName: "Melvin", lastName: "Buyer", phoneNumber: "+2348011111111" }),
    }),
  }));
  const restoreInit = stubMethod(paystackService.paystackGateway, "initializeTransaction", async (input) => {
    gatewayCalls.push(input);
    return {
      authorizationUrl: `https://checkout.paystack.test/${input.reference}`,
      accessCode: `code_${input.reference}`,
      reference: input.reference,
    };
  });

  try {
    // 1. Different user cannot initialize another person's order.
    const resForbiddenUser = createMockResponse();
    await paymentController.initializePaystackPayment(
      createMockRequest({
        user: { _id: "user-2", userName: "Other", role: "User" },
        body: { orderId: userOrderId, checkoutType: "user" },
      }),
      resForbiddenUser,
    );
    assert.equal(resForbiddenUser.statusCode, 403);

    // 2. Guest without matching paymentReference cannot hijack guest checkout.
    const resForbiddenGuest = createMockResponse();
    await paymentController.initializePaystackPayment(
      createMockRequest({
        body: { orderId: guestOrderId, checkoutType: "guest", paymentReference: "wrong-ref" },
      }),
      resForbiddenGuest,
    );
    assert.equal(resForbiddenGuest.statusCode, 403);

    // 3. Valid signed-in order initialization uses totalKobo (10,500,000 kobo = ₦105,000).
    const resUser = createMockResponse();
    await paymentController.initializePaystackPayment(
      createMockRequest({
        user: { _id: "user-1", userName: "Mel", role: "User" },
        body: {
          orderId: userOrderId,
          checkoutType: "user",
          amount: 1, // ignored: server uses totalKobo
          redirectUrl: "https://melvingadgets.com/orderconfirm",
        },
      }),
      resUser,
    );
    assert.equal(resUser.statusCode, 200);
    assert.equal(resUser.body.data.amountKobo, 10_500_000);
    assert.equal(resUser.body.data.amount, 105000);
    assert.equal(resUser.body.data.accessCode.startsWith("code_psk-u-"), true);
    assert.equal(gatewayCalls[0].amountKobo, 10_500_000);
    assert.equal(gatewayCalls[0].email, "user1@example.com");
    assert.equal(updateCalls[0].collection, "orders");

    // 4. Valid guest checkout initialization works with matching paymentReference.
    const resGuest = createMockResponse();
    await paymentController.initializePaystackPayment(
      createMockRequest({
        body: {
          orderId: guestOrderId,
          checkoutType: "guest",
          paymentReference: "guest-ref-1",
        },
      }),
      resGuest,
    );
    assert.equal(resGuest.statusCode, 200);
    assert.equal(resGuest.body.data.checkoutType, "guest");
    assert.equal(resGuest.body.data.amountKobo, 5_000_000);
    assert.equal(gatewayCalls[1].email, "guest@example.com");
    assert.equal(updateCalls[1].collection, "guestCheckouts");
  } finally {
    restoreEnv(prev);
    restoreUserOrderFind();
    restoreUserOrderUpdate();
    restoreGuestFind();
    restoreGuestUpdate();
    restoreUserFind();
    restoreProfileFind();
    restoreInit();
  }
});

test("verifyPaystackPayment rejects failed/underpaid/wrong-currency payments and marks valid orders paid idempotently", async () => {
  const prev = snapshotEnv();
  env.paystack.secretKey = "sk_test_1";
  env.eventsEnabled = false;

  const userOrderId = new mongoose.Types.ObjectId().toString();
  const guestOrderId = new mongoose.Types.ObjectId().toString();
  let userOrderState = {
    _id: userOrderId,
    user: "user-1",
    bill: 200000,
    totalKobo: 20_000_000,
    paymentStatus: "pending",
    orderStatus: "created",
    paymentReference: "web-1",
    paystackReference: "psk-u-tx-1",
  };
  let guestOrderState = {
    _id: guestOrderId,
    guest: { fullName: "Guest", email: "g@example.com", whatsappPhoneNumber: "+2348000000000" },
    bill: 150000,
    totalKobo: 15_000_000,
    paymentStatus: "pending",
    orderStatus: "created",
    paymentReference: "guest-1",
    paystackReference: "psk-g-tx-1",
  };

  let mockVerified = {
    id: "777",
    reference: "psk-u-tx-1",
    status: "success",
    currency: "NGN",
    amountKobo: 20_000_000,
    gatewayResponse: "Successful",
    channel: "card",
  };

  const restoreOrderFindOne = stubMethod(orderModel, "findOne", (filter) => ({
    lean: async () => {
      const refs = (filter.$or || []).flatMap((entry) => Object.values(entry));
      return refs.includes(userOrderState.paystackReference) || refs.includes(userOrderState.paymentReference)
        ? userOrderState
        : null;
    },
  }));
  const restoreGuestFindOne = stubMethod(guestCheckoutModel, "findOne", (filter) => ({
    lean: async () => {
      const refs = (filter.$or || []).flatMap((entry) => Object.values(entry));
      return refs.includes(guestOrderState.paystackReference) || refs.includes(guestOrderState.paymentReference)
        ? guestOrderState
        : null;
    },
  }));
  const restoreOrderUpdate = stubMethod(orderModel, "findOneAndUpdate", (filter, update) => {
    const canTransition =
      filter._id === userOrderState._id &&
      userOrderState.paymentStatus === "pending" &&
      ["created", "processing"].includes(userOrderState.orderStatus);
    if (!canTransition) {
      return createPopulateChain(null);
    }
    userOrderState = { ...userOrderState, ...update.$set };
    return createPopulateChain(userOrderState);
  });
  const restoreOrderFindById = stubMethod(orderModel, "findById", () => ({
    select: () => ({ lean: async () => userOrderState }),
  }));
  const restoreGuestUpdate = stubMethod(guestCheckoutModel, "findOneAndUpdate", (filter, update) => {
    const canTransition =
      filter._id === guestOrderState._id &&
      guestOrderState.paymentStatus === "pending" &&
      ["created", "processing"].includes(guestOrderState.orderStatus);
    if (!canTransition) {
      return createPopulateChain(null);
    }
    guestOrderState = { ...guestOrderState, ...update.$set };
    return createPopulateChain(guestOrderState);
  });
  const restoreGuestFindById = stubMethod(guestCheckoutModel, "findById", () => ({
    select: () => ({ lean: async () => guestOrderState }),
  }));
  const restoreVerify = stubMethod(paystackService.paystackGateway, "verifyTransaction", async () => mockVerified);

  try {
    // 1. Failed/abandoned status from Paystack -> 402
    mockVerified = { ...mockVerified, status: "abandoned" };
    const resFailed = createMockResponse();
    await paymentController.verifyPaystackPayment(
      createMockRequest({ body: { reference: "psk-u-tx-1" } }),
      resFailed,
    );
    assert.equal(resFailed.statusCode, 402);
    assert.equal(userOrderState.paymentStatus, "pending");

    // 2. Wrong currency -> 400
    mockVerified = { ...mockVerified, status: "success", currency: "USD" };
    const resCurrency = createMockResponse();
    await paymentController.verifyPaystackPayment(
      createMockRequest({ body: { reference: "psk-u-tx-1" } }),
      resCurrency,
    );
    assert.equal(resCurrency.statusCode, 400);
    assert.equal(resCurrency.body.code, "CURRENCY_MISMATCH");

    // 3. Underpayment -> 400
    mockVerified = { ...mockVerified, currency: "NGN", amountKobo: 19_999_900 };
    const resUnderpaid = createMockResponse();
    await paymentController.verifyPaystackPayment(
      createMockRequest({ body: { reference: "psk-u-tx-1" } }),
      resUnderpaid,
    );
    assert.equal(resUnderpaid.statusCode, 400);
    assert.equal(resUnderpaid.body.code, "AMOUNT_MISMATCH");
    assert.equal(userOrderState.paymentStatus, "pending");

    // 4. Valid verification marks signed-in order paid and processing.
    mockVerified = { ...mockVerified, amountKobo: 20_000_000 };
    const resPaid = createMockResponse();
    await paymentController.verifyPaystackPayment(
      createMockRequest({ body: { trxref: "psk-u-tx-1" } }),
      resPaid,
    );
    assert.equal(resPaid.statusCode, 200);
    assert.equal(resPaid.body.data.paymentStatus, "paid");
    assert.equal(resPaid.body.data.orderStatus, "processing");
    assert.equal(resPaid.body.data.alreadyPaid, false);

    // 5. Repeat verification is idempotent (alreadyPaid: true).
    const resRepeat = createMockResponse();
    await paymentController.verifyPaystackPayment(
      createMockRequest({ body: { reference: "psk-u-tx-1" } }),
      resRepeat,
    );
    assert.equal(resRepeat.statusCode, 200);
    assert.equal(resRepeat.body.data.alreadyPaid, true);

    // 6. Guest checkout verification also marks guest order paid and never leaks guest PII.
    mockVerified = {
      id: "888",
      reference: "psk-g-tx-1",
      status: "success",
      currency: "NGN",
      amountKobo: 15_000_000,
      gatewayResponse: "Successful",
      channel: "bank_transfer",
    };
    const resGuestPaid = createMockResponse();
    await paymentController.verifyPaystackPayment(
      createMockRequest({ body: { reference: "psk-g-tx-1" } }),
      resGuestPaid,
    );
    assert.equal(resGuestPaid.statusCode, 200);
    assert.equal(resGuestPaid.body.data.checkoutType, "guest");
    assert.equal(resGuestPaid.body.data.paymentStatus, "paid");
    assert.equal("guest" in resGuestPaid.body.data, false);
  } finally {
    restoreEnv(prev);
    restoreOrderFindOne();
    restoreGuestFindOne();
    restoreOrderUpdate();
    restoreOrderFindById();
    restoreGuestUpdate();
    restoreGuestFindById();
    restoreVerify();
  }
});

test("handlePaystackWebhook enforces HMAC-SHA512 over raw HTTP body bytes via mainApp and settles orders idempotently", async () => {
  const prev = snapshotEnv();
  env.paystack.secretKey = "sk_test_webhook_secret";
  env.eventsEnabled = false;

  const orderId = new mongoose.Types.ObjectId().toString();
  let orderState = {
    _id: orderId,
    user: "user-1",
    bill: 300000,
    totalKobo: 30_000_000,
    paymentStatus: "pending",
    orderStatus: "created",
    paymentReference: "web-2",
    paystackReference: "psk-u-hook-1",
  };

  const restoreOrderFindOne = stubMethod(orderModel, "findOne", () => ({ lean: async () => orderState }));
  const restoreGuestFindOne = stubMethod(guestCheckoutModel, "findOne", () => ({ lean: async () => null }));
  const restoreOrderUpdate = stubMethod(orderModel, "findOneAndUpdate", (_filter, update) => {
    orderState = { ...orderState, ...update.$set };
    return createPopulateChain(orderState);
  });
  const restoreVerify = stubMethod(paystackService.paystackGateway, "verifyTransaction", async () => ({
    id: "555",
    reference: "psk-u-hook-1",
    status: "success",
    currency: "NGN",
    amountKobo: 30_000_000,
    gatewayResponse: "Successful",
    channel: "card",
  }));

  const app = express();
  mainApp(app);
  const server = await new Promise((resolve) => {
    const active = app.listen(0, "127.0.0.1", () => resolve(active));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    // 1. Rejects invalid x-paystack-signature over HTTP.
    const badRes = await fetch(`${baseUrl}/api/v1/webhooks/paystack`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-paystack-signature": "invalid-sig",
      },
      body: JSON.stringify({ event: "charge.success", data: { reference: "psk-u-hook-1", status: "success" } }),
    });
    assert.equal(badRes.status, 401);

    // 2. Ignores unrelated event types when signature is valid.
    const ignoredPayload = JSON.stringify({ event: "transfer.success", data: { status: "success" } });
    const ignoredSig = crypto.createHmac("sha512", "sk_test_webhook_secret").update(ignoredPayload).digest("hex");
    const ignoredRes = await fetch(`${baseUrl}/api/v1/webhooks/paystack`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-paystack-signature": ignoredSig,
      },
      body: ignoredPayload,
    });
    assert.equal(ignoredRes.status, 200);
    assert.equal((await ignoredRes.json()).ignored, true);

    // 3. Processes valid charge.success webhook with exact raw body whitespace preserved.
    const validRawBody = '{\n  "event": "charge.success",\n  "data": { "id": 555, "reference": "psk-u-hook-1", "status": "success" }\n}';
    const validSig = crypto.createHmac("sha512", "sk_test_webhook_secret").update(validRawBody).digest("hex");
    const validRes = await fetch(`${baseUrl}/api/v1/webhooks/paystack`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-paystack-signature": validSig,
      },
      body: validRawBody,
    });
    assert.equal(validRes.status, 200);
    const validJson = await validRes.json();
    assert.equal(validJson.received, true);
    assert.equal(orderState.paymentStatus, "paid");
    assert.equal(orderState.paystackTransactionId, "555");
  } finally {
    restoreEnv(prev);
    restoreOrderFindOne();
    restoreGuestFindOne();
    restoreOrderUpdate();
    restoreVerify();
    await new Promise((resolve) => server.close(resolve));
  }
});
