const test = require("node:test");
const assert = require("node:assert/strict");

const userRouter = require("../dist/router/userRouter").default;
const profileRouter = require("../dist/router/profile.Router").default;
const categoryRouter = require("../dist/router/categoryRouter").default;
const productRouter = require("../dist/router/productRouter").default;
const cartRouter = require("../dist/router/cartRouter").default;
const orderRouter = require("../dist/router/orderRouter").default;
const swapRouter = require("../dist/router/swapRouter").default;
const assistantRouter = require("../dist/router/assistantRouter").default;
const { getRouteHandlerNames, getRouteLayer } = require("./helpers/testUtils");

test("userRouter exposes registration, login, user, and verification routes", () => {
  assert.ok(getRouteLayer(userRouter, "/register"));
  assert.ok(getRouteLayer(userRouter, "/login"));
  assert.ok(getRouteLayer(userRouter, "/single-profile"));
  assert.ok(getRouteLayer(userRouter, "/single-profile/:id"));
  assert.ok(getRouteLayer(userRouter, "/all-users"));
  assert.ok(getRouteLayer(userRouter, "/logout-user"));
  assert.ok(getRouteLayer(userRouter, "/session/presence"));
  assert.ok(getRouteLayer(userRouter, "/session/presence-beacon"));
  assert.ok(getRouteLayer(userRouter, "/admin/user-sessions"));
  assert.ok(getRouteLayer(userRouter, "/admin/user-sessions/summary"));
  assert.deepEqual(getRouteHandlerNames(userRouter, "/all-users", "get"), [
    "verifyToken",
    "requireAdmin",
    "getAllUsers",
  ]);
  assert.deepEqual(getRouteHandlerNames(userRouter, "/logout-user", "post"), [
    "verifyToken",
    "logOut",
  ]);
  assert.deepEqual(getRouteHandlerNames(userRouter, "/session/presence", "post"), [
    "verifyToken",
    "updateUserSessionPresence",
  ]);
  assert.deepEqual(getRouteHandlerNames(userRouter, "/session/presence-beacon", "post"), [
    "updateUserSessionPresenceFromBeacon",
  ]);
  assert.deepEqual(getRouteHandlerNames(userRouter, "/admin/user-sessions", "get"), [
    "verifyToken",
    "requireAdmin",
    "getAdminUserSessions",
  ]);
  assert.deepEqual(getRouteHandlerNames(userRouter, "/admin/user-sessions/summary", "get"), [
    "verifyToken",
    "requireAdmin",
    "getAdminUserSessionSummary",
  ]);
});

test("profileRouter protects profile update endpoints", () => {
  assert.deepEqual(getRouteHandlerNames(profileRouter, "/edit/pro/:proId", "put"), [
    "verifyToken",
    "updateProfile",
  ]);
  assert.deepEqual(getRouteHandlerNames(profileRouter, "/edit/pro-Img/:proId", "put"), [
    "verifyToken",
    "multerMiddleware",
    "editImage",
  ]);
});

test("categoryRouter exposes public reads and admin writes", () => {
  assert.ok(getRouteLayer(categoryRouter, "/categories"));
  assert.deepEqual(getRouteHandlerNames(categoryRouter, "/categories", "post"), [
    "verifyToken",
    "requireAdmin",
    "createCategory",
  ]);
  assert.deepEqual(getRouteHandlerNames(categoryRouter, "/categories/:id", "delete"), [
    "verifyToken",
    "requireAdmin",
    "deleteCate",
  ]);
});

test("productRouter protects creation and keeps public reads available", () => {
  assert.deepEqual(getRouteHandlerNames(productRouter, "/create-product/:userId/:catId", "post"), [
    "verifyToken",
    "requireAdmin",
    "multerMiddleware",
    "createProduct",
  ]);
  assert.deepEqual(getRouteHandlerNames(productRouter, "/products", "get"), ["ViewAllProduct"]);
  assert.deepEqual(getRouteHandlerNames(productRouter, "/products/:id", "get"), [
    "ViewSingleProduct",
  ]);
  assert.deepEqual(getRouteHandlerNames(productRouter, "/products/:id/storage-options", "put"), [
    "verifyToken",
    "requireAdmin",
    "updateProductStorageOptions",
  ]);
});

test("cartRouter protects add and remove operations", () => {
  assert.deepEqual(getRouteHandlerNames(cartRouter, "/cart-items", "get"), ["verifyToken", "getCart"]);
  assert.deepEqual(getRouteHandlerNames(cartRouter, "/cart-items/:prodId", "post"), [
    "verifyToken",
    "addToCart",
  ]);
  assert.deepEqual(getRouteHandlerNames(cartRouter, "/remove-item", "delete"), [
    "verifyToken",
    "removeCartItem",
  ]);
  assert.deepEqual(getRouteHandlerNames(cartRouter, "/cart-items/:userId", "get"), [
    "verifyToken",
    "getCart",
  ]);
  assert.deepEqual(getRouteHandlerNames(cartRouter, "/cart-items/:userId/:prodId", "post"), [
    "verifyToken",
    "addToCart",
  ]);
  assert.deepEqual(getRouteHandlerNames(cartRouter, "/cart-items/:userId/:prodId", "delete"), [
    "verifyToken",
    "removeCartItem",
  ]);
});

test("orderRouter protects checkout", () => {
  assert.deepEqual(getRouteHandlerNames(orderRouter, "/orders", "get"), [
    "verifyToken",
    "getOrders",
  ]);
  assert.deepEqual(getRouteHandlerNames(orderRouter, "/order-checkout", "post"), [
    "verifyToken",
    "checkOut",
  ]);
  assert.deepEqual(getRouteHandlerNames(orderRouter, "/orders/:userId", "get"), [
    "verifyToken",
    "getOrders",
  ]);
  assert.deepEqual(getRouteHandlerNames(orderRouter, "/order-checkout/:userId", "post"), [
    "verifyToken",
    "checkOut",
  ]);
  assert.deepEqual(getRouteHandlerNames(orderRouter, "/guest-checkout", "post"), [
    "guestCheckoutRateLimiter",
    "guestCheckOut",
  ]);
});

test("swapRouter exposes public metadata and evaluation endpoints", () => {
  assert.deepEqual(getRouteHandlerNames(swapRouter, "/swap/metadata", "get"), [
    "getSwapMetadata",
  ]);
  assert.deepEqual(getRouteHandlerNames(swapRouter, "/swap/evaluate", "post"), [
    "evaluateSwap",
  ]);
});

test("assistantRouter exposes a public assistant message endpoint", () => {
  assert.ok(getRouteLayer(assistantRouter, "/assistant/message"));
  assert.deepEqual(getRouteHandlerNames(assistantRouter, "/assistant/message", "post"), [
    "verifyToken",
    "assistantMessage",
  ]);
  assert.deepEqual(getRouteHandlerNames(assistantRouter, "/assistant/message/stream", "post"), [
    "verifyToken",
    "assistantMessageStream",
  ]);
  assert.deepEqual(getRouteHandlerNames(assistantRouter, "/assistant/admin/timings", "get"), [
    "verifyToken",
    "requireAdmin",
    "assistantTimingSummary",
  ]);
});
