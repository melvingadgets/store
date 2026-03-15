const test = require("node:test");
const assert = require("node:assert/strict");

const cartModel = require("../dist/model/cartModel").default;
const guestCheckoutModel = require("../dist/model/guestCheckoutModel").default;
const orderModel = require("../dist/model/orderModel").default;
const productModel = require("../dist/model/productModel").default;
const orderController = require("../dist/controller/orderController");
const {
  createDocument,
  createMockRequest,
  createMockResponse,
  createPopulateChain,
  stubMethod,
} = require("./helpers/testUtils");

const createSortedResult = (result) => ({
  sort: async () => result,
});

test("checkOut requires authentication from token context", async () => {
  const req = createMockRequest({
    params: {},
  });
  const res = createMockResponse();

  await orderController.checkOut(req, res);

  assert.equal(res.statusCode, 401);
  assert.match(res.body.message, /authentication is required/i);
});

test("checkOut rejects empty carts", async () => {
  const restoreCartFind = stubMethod(cartModel, "findOne", () => createSortedResult({
    _id: "cart-1",
    cartItem: [],
  }));
  const req = createMockRequest({
    params: {},
    user: { _id: "user-1", userName: "Mel", role: "user" },
  });
  const res = createMockResponse();

  try {
    await orderController.checkOut(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, "cart is empty");
  } finally {
    restoreCartFind();
  }
});

test("checkOut creates an order and deletes the source cart", async () => {
  const cart = {
    _id: "cart-1",
    user: "user-1",
    cartItem: [{ products: "product-1", quantity: 2, price: 500 }],
    bill: 1000,
  };
  const reservedProduct = createDocument({
    _id: "product-1",
    price: 500,
    qty: 10,
    storageOptions: [],
  });
  const createdOrder = { _id: "order-1", bill: 1000 };
  const restoreCartFind = stubMethod(cartModel, "findOne", () => createSortedResult(cart));
  const restoreProductFind = stubMethod(productModel, "find", () => ({
    select: async () => [{ _id: { toString: () => "product-1" }, price: 500, qty: 10, storageOptions: [] }],
  }));
  const restoreProductFindById = stubMethod(productModel, "findById", async () => reservedProduct);
  const restoreOrderCreate = stubMethod(orderModel, "create", async (payload) => ({
    ...createdOrder,
    ...payload,
  }));
  const restoreOrderFind = stubMethod(orderModel, "findById", () =>
    createPopulateChain({
      ...createdOrder,
      paymentReference: "pay-1",
      paymentStatus: "pending",
    }),
  );
  const restoreCartDelete = stubMethod(cartModel, "findByIdAndDelete", async () => null);
  const req = createMockRequest({
    params: {},
    body: { paymentReference: "pay-1", paymentStatus: "paid" },
    user: { _id: "user-1", userName: "Mel", role: "user" },
  });
  const res = createMockResponse();

  try {
    await orderController.checkOut(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.data.paymentReference, "pay-1");
    assert.equal(res.body.data.paymentStatus, "pending");
    assert.equal(reservedProduct.qty, 8);
    assert.equal(reservedProduct.saveCallCount, 1);
  } finally {
    restoreCartFind();
    restoreProductFind();
    restoreProductFindById();
    restoreOrderCreate();
    restoreOrderFind();
    restoreCartDelete();
  }
});

test("checkOut rejects carts when inventory cannot be reserved", async () => {
  const cart = {
    _id: "cart-1",
    user: "user-1",
    cartItem: [{ products: "product-1", quantity: 2, price: 500 }],
    bill: 1000,
  };
  const restoreCartFind = stubMethod(cartModel, "findOne", () => createSortedResult(cart));
  const restoreProductFind = stubMethod(productModel, "find", () => ({
    select: async () => [{ _id: { toString: () => "product-1" }, price: 500, qty: 1, storageOptions: [] }],
  }));
  const req = createMockRequest({
    params: {},
    user: { _id: "user-1", userName: "Mel", role: "user" },
  });
  const res = createMockResponse();

  try {
    await orderController.checkOut(req, res);

    assert.equal(res.statusCode, 409);
    assert.match(res.body.message, /out of stock/i);
  } finally {
    restoreCartFind();
    restoreProductFind();
  }
});

test("getOrders returns the current user's order history", async () => {
  const orders = [{ _id: "order-1", bill: 1000 }];
  const restoreOrderFind = stubMethod(orderModel, "find", () => ({
    sort() {
      return {
        populate: async () => orders,
      };
    },
  }));
  const req = createMockRequest({
    params: {},
    user: { _id: "user-1", userName: "Mel", role: "user" },
  });
  const res = createMockResponse();

  try {
    await orderController.getOrders(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.data, orders);
  } finally {
    restoreOrderFind();
  }
});

test("guestCheckOut validates the required guest fields", async () => {
  const req = createMockRequest({
    params: {},
    body: {
      items: [{ productId: "product-1", quantity: 1 }],
      guest: {
        fullName: "",
        email: "guest@example.com",
        whatsappPhoneNumber: "",
        address: "",
        state: "",
      },
    },
  });
  const res = createMockResponse();

  await orderController.guestCheckOut(req, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /fullName, email, whatsappPhoneNumber, address, and state are required/i);
});

test("guestCheckOut creates a guest checkout in the separate collection", async () => {
  const reservedProduct = createDocument({
    _id: "product-1",
    price: 500,
    qty: 10,
    storageOptions: [],
  });
  const createdGuestCheckout = { _id: "guest-checkout-1", bill: 1000 };
  const restoreProductFind = stubMethod(productModel, "find", () => ({
    select: async () => [{ _id: { toString: () => "product-1" }, price: 500, qty: 10 }],
  }));
  const restoreProductFindById = stubMethod(productModel, "findById", async () => reservedProduct);
  const restoreGuestCreate = stubMethod(guestCheckoutModel, "create", async (payload) => ({
    ...createdGuestCheckout,
    ...payload,
  }));
  const restoreGuestFind = stubMethod(guestCheckoutModel, "findById", () =>
    createPopulateChain({
      ...createdGuestCheckout,
      paymentReference: "guest-pay-1",
      paymentStatus: "pending",
    }),
  );
  const req = createMockRequest({
    params: {},
    body: {
      items: [{ productId: "product-1", quantity: 2 }],
      paymentReference: "guest-pay-1",
      guest: {
        fullName: "Guest User",
        email: "guest@example.com",
        whatsappPhoneNumber: "08012345678",
        callPhoneNumber: "",
        address: "1 Example Street",
        state: "Lagos",
      },
    },
  });
  const res = createMockResponse();

  try {
    await orderController.guestCheckOut(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.data.paymentReference, "guest-pay-1");
    assert.equal(res.body.message, "guest checkout created successfully");
    assert.equal(reservedProduct.qty, 8);
    assert.equal(reservedProduct.saveCallCount, 1);
  } finally {
    restoreProductFind();
    restoreProductFindById();
    restoreGuestCreate();
    restoreGuestFind();
  }
});
