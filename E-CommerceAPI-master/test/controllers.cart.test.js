const test = require("node:test");
const assert = require("node:assert/strict");

const cartModel = require("../dist/model/cartModel").default;
const productModel = require("../dist/model/productModel").default;
const userModel = require("../dist/model/userModel").default;
const easyBuyCatalog = require("../dist/utils/easyBuyCatalog");
const cartController = require("../dist/controller/cartController");
const {
  createDocument,
  createMockRequest,
  createMockResponse,
  createObjectIdRef,
  createPopulateChain,
  stubMethod,
} = require("./helpers/testUtils");

const createSortedResult = (result) => ({
  sort: async () => result,
});

test("addToCart requires authentication from token context", async () => {
  const req = createMockRequest({
    params: { prodId: "product-1" },
  });
  const res = createMockResponse();

  await cartController.addToCart(req, res);

  assert.equal(res.statusCode, 401);
  assert.match(res.body.message, /authentication is required/i);
});

test("addToCart creates a cart when the user does not already have one", async () => {
  const createdCart = { _id: "cart-1", bill: 500 };
  const restoreUserFind = stubMethod(userModel, "findById", async () => ({ _id: "user-1" }));
  const restoreProductFind = stubMethod(productModel, "findById", async () => ({
    _id: "product-1",
    price: 500,
    qty: 3,
  }));
  const restoreCartFind = stubMethod(cartModel, "findOne", () => createSortedResult(null));
  const restoreCartCreate = stubMethod(cartModel, "create", async () => createdCart);
  const restoreCartFindById = stubMethod(cartModel, "findById", () => createPopulateChain(createdCart));
  const req = createMockRequest({
    params: { prodId: "product-1" },
    user: { _id: "user-1", userName: "Mel", role: "user" },
  });
  const res = createMockResponse();

  try {
    await cartController.addToCart(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data._id, createdCart._id);
  } finally {
    restoreUserFind();
    restoreProductFind();
    restoreCartFind();
    restoreCartCreate();
    restoreCartFindById();
  }
});

test("addToCart increments quantity when the product already exists in the cart", async () => {
  const cart = createDocument({
    _id: "cart-1",
    user: "user-1",
    bill: 500,
    cartItem: [
      {
        products: createObjectIdRef("product-1"),
        quantity: 1,
        price: 500,
      },
    ],
  });
  const restoreUserFind = stubMethod(userModel, "findById", async () => ({ _id: "user-1" }));
  const restoreProductFind = stubMethod(productModel, "findById", async () => ({
    _id: "product-1",
    price: 500,
    qty: 3,
  }));
  const restoreCartFind = stubMethod(cartModel, "findOne", () => createSortedResult(cart));
  const restoreCartFindById = stubMethod(cartModel, "findById", () => createPopulateChain(cart));
  const req = createMockRequest({
    params: { prodId: "product-1" },
    user: { _id: "user-1", userName: "Mel", role: "user" },
  });
  const res = createMockResponse();

  try {
    await cartController.addToCart(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(cart.cartItem[0].quantity, 2);
    assert.equal(cart.bill, 1000);
    assert.equal(cart.saveCallCount, 1);
  } finally {
    restoreUserFind();
    restoreProductFind();
    restoreCartFind();
    restoreCartFindById();
  }
});

test("addToCart rejects requests when the available stock is exhausted", async () => {
  const cart = createDocument({
    _id: "cart-1",
    user: "user-1",
    bill: 500,
    cartItem: [
      {
        products: createObjectIdRef("product-1"),
        quantity: 1,
        price: 500,
      },
    ],
  });
  const restoreUserFind = stubMethod(userModel, "findById", async () => ({ _id: "user-1" }));
  const restoreProductFind = stubMethod(productModel, "findById", async () => ({
    _id: "product-1",
    price: 500,
    qty: 1,
  }));
  const restoreCartFind = stubMethod(cartModel, "findOne", () => createSortedResult(cart));
  const req = createMockRequest({
    params: { prodId: "product-1" },
    user: { _id: "user-1", userName: "Mel", role: "user" },
  });
  const res = createMockResponse();

  try {
    await cartController.addToCart(req, res);

    assert.equal(res.statusCode, 409);
    assert.match(res.body.message, /not enough stock/i);
  } finally {
    restoreUserFind();
    restoreProductFind();
    restoreCartFind();
  }
});

test("addToCart falls back to product qty when legacy storage option quantities are all zero", async () => {
  const createdCart = { _id: "cart-legacy", bill: 900000 };
  const restoreUserFind = stubMethod(userModel, "findById", async () => ({ _id: "user-1" }));
  const restoreProductFind = stubMethod(productModel, "findById", async () => ({
    _id: "product-1",
    price: 900000,
    qty: 4,
    storageOptions: [
      { capacity: "128GB", price: 900000, qty: 0 },
      { capacity: "256GB", price: 1020000, qty: 0 },
    ],
  }));
  const restoreCartFind = stubMethod(cartModel, "findOne", () => createSortedResult(null));
  const restoreCartCreate = stubMethod(cartModel, "create", async () => createdCart);
  const restoreCartFindById = stubMethod(cartModel, "findById", () => createPopulateChain(createdCart));
  const req = createMockRequest({
    params: { prodId: "product-1" },
    body: { capacity: "128GB" },
    user: { _id: "user-1", userName: "Mel", role: "user" },
  });
  const res = createMockResponse();

  try {
    await cartController.addToCart(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data._id, createdCart._id);
  } finally {
    restoreUserFind();
    restoreProductFind();
    restoreCartFind();
    restoreCartCreate();
    restoreCartFindById();
  }
});

test("removeCartItem requires a product identifier", async () => {
  const req = createMockRequest({
    params: {},
    user: { _id: "user-1", userName: "Mel", role: "user" },
  });
  const res = createMockResponse();

  await cartController.removeCartItem(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, "productId is required");
});

test("removeCartItem decreases quantity and recalculates the bill", async () => {
  const cart = createDocument({
    _id: "cart-1",
    user: "user-1",
    bill: 1000,
    cartItem: [
      {
        products: createObjectIdRef("product-1"),
        quantity: 2,
        price: 500,
      },
    ],
  });
  const restoreCartFind = stubMethod(cartModel, "findOne", () => createSortedResult(cart));
  const restoreCartFindById = stubMethod(cartModel, "findById", () => createPopulateChain(cart));
  const req = createMockRequest({
    params: {},
    query: { productId: "product-1" },
    user: { _id: "user-1", userName: "Mel", role: "user" },
  });
  const res = createMockResponse();

  try {
    await cartController.removeCartItem(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(cart.cartItem[0].quantity, 1);
    assert.equal(cart.bill, 500);
    assert.equal(cart.saveCallCount, 1);
  } finally {
    restoreCartFind();
    restoreCartFindById();
  }
});

test("removeCartItem removes the cart item when quantity reaches zero", async () => {
  const cart = createDocument({
    _id: "cart-1",
    user: "user-1",
    bill: 500,
    cartItem: [
      {
        products: createObjectIdRef("product-1"),
        quantity: 1,
        price: 500,
      },
    ],
  });
  const restoreCartFind = stubMethod(cartModel, "findOne", () => createSortedResult(cart));
  const restoreCartFindById = stubMethod(cartModel, "findById", () => createPopulateChain(cart));
  const req = createMockRequest({
    params: {},
    query: { productId: "product-1" },
    user: { _id: "user-1", userName: "Mel", role: "user" },
  });
  const res = createMockResponse();

  try {
    await cartController.removeCartItem(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(cart.cartItem.length, 0);
    assert.equal(cart.bill, 0);
  } finally {
    restoreCartFind();
    restoreCartFindById();
  }
});

test("getCart returns an empty cart payload when the user has no saved cart", async () => {
  const restoreCartFind = stubMethod(cartModel, "findOne", () => createPopulateChain(null));
  const restoreCatalogFetch = stubMethod(easyBuyCatalog, "fetchPublicEasyBuyCatalog", async () => null);
  const req = createMockRequest({
    params: {},
    user: { _id: "user-1", userName: "Mel", role: "user" },
  });
  const res = createMockResponse();

  try {
    await cartController.getCart(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.user, "user-1");
    assert.deepEqual(res.body.data.cartItem, []);
    assert.equal(res.body.data.bill, 0);
  } finally {
    restoreCartFind();
    restoreCatalogFetch();
  }
});

test("getCart prefers EasyBuy catalog images for populated products", async () => {
  const cart = {
    _id: "cart-1",
    user: "user-1",
    bill: 900000,
    cartItem: [
      {
        quantity: 1,
        price: 900000,
        products: {
          _id: "product-1",
          name: "iPhone 15",
          image: "http://localhost:2222/uploads/phone.png",
        },
      },
    ],
  };
  const restoreCartFind = stubMethod(cartModel, "findOne", () => createPopulateChain(cart));
  const restoreCatalogFetch = stubMethod(easyBuyCatalog, "fetchPublicEasyBuyCatalog", async () => ({
    models: [
      {
        model: "iPhone 15",
        imageUrl: "https://easybuy.example/iphone-15.png",
        capacities: ["128GB"],
        allowedPlans: ["Monthly"],
        downPaymentPercentage: 40,
        pricesByCapacity: { "128GB": 900000 },
      },
    ],
    planRules: {
      monthlyDurations: [],
      weeklyDurations: [],
      monthlyMarkupMultipliers: {},
      weeklyMarkupMultipliers: {},
    },
  }));
  const req = createMockRequest({
    params: {},
    user: { _id: "user-1", userName: "Mel", role: "user" },
  });
  const res = createMockResponse();

  try {
    await cartController.getCart(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.cartItem[0].products.image, "https://easybuy.example/iphone-15.png");
  } finally {
    restoreCartFind();
    restoreCatalogFetch();
  }
});

test("removeCartItem supports full removal through the removeAll query flag", async () => {
  const cart = createDocument({
    _id: "cart-1",
    user: "user-1",
    bill: 1500,
    cartItem: [
      {
        products: createObjectIdRef("product-1"),
        quantity: 3,
        price: 500,
      },
    ],
  });
  const restoreCartFind = stubMethod(cartModel, "findOne", () => createSortedResult(cart));
  const restoreCartFindById = stubMethod(cartModel, "findById", () => createPopulateChain(cart));
  const req = createMockRequest({
    params: {},
    query: { productId: "product-1", removeAll: "true" },
    user: { _id: "user-1", userName: "Mel", role: "user" },
  });
  const res = createMockResponse();

  try {
    await cartController.removeCartItem(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(cart.cartItem.length, 0);
    assert.equal(cart.bill, 0);
  } finally {
    restoreCartFind();
    restoreCartFindById();
  }
});
