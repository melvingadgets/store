const test = require("node:test");
const assert = require("node:assert/strict");

const userModel = require("../dist/model/userModel").default;
const profileModel = require("../dist/model/profileModel").default;
const categoryModel = require("../dist/model/categoryModel").default;
const productModel = require("../dist/model/productModel").default;
const cartModel = require("../dist/model/cartModel").default;
const orderModel = require("../dist/model/orderModel").default;

test("user schema protects passwords and defaults role to user", () => {
  assert.equal(userModel.schema.path("password").options.select, false);
  assert.equal(userModel.schema.path("role").defaultValue, "user");
  assert.deepEqual(userModel.schema.path("role").enumValues, ["user", "admin", "superadmin"]);
});

test("profile schema includes phoneNumber and requires a user reference", () => {
  assert.equal(profileModel.schema.path("phoneNumber").instance, "String");
  assert.equal(profileModel.schema.path("user").isRequired, true);
});

test("category schema requires a unique slug and user owner", () => {
  assert.equal(categoryModel.schema.path("slug").options.unique, true);
  assert.equal(categoryModel.schema.path("user").isRequired, true);
});

test("product schema requires category and creator references", () => {
  assert.equal(productModel.schema.path("category").isRequired, true);
  assert.equal(productModel.schema.path("createdBy").isRequired, true);
});

test("cart schema supports multiple carts per user and bill cannot be negative", () => {
  assert.equal(cartModel.schema.path("user").options.unique, undefined);
  assert.deepEqual(cartModel.schema.path("cartType").enumValues, ["saved", "synced_session"]);
  assert.equal(cartModel.schema.path("bill").options.min, 0);
});

test("order schema limits payment and order state values", () => {
  assert.deepEqual(orderModel.schema.path("paymentStatus").enumValues, ["pending", "paid"]);
  assert.deepEqual(orderModel.schema.path("orderStatus").enumValues, [
    "created",
    "processing",
    "completed",
    "cancelled",
  ]);
  assert.equal(orderModel.schema.path("orderStatus").defaultValue, "created");
});
