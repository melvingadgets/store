const test = require("node:test");
const assert = require("node:assert/strict");

const {
  findCatalogModelForProduct,
  syncProductPricesFromCatalog,
} = require("../dist/utils/productPriceSync");

test("findCatalogModelForProduct matches by normalized product name", () => {
  const catalogModel = findCatalogModelForProduct("  iphone   13 pro max ", [
    {
      model: "iPhone 13 Pro Max",
      pricesByCapacity: {
        "128GB": 580000,
      },
    },
  ]);

  assert.equal(catalogModel?.model, "iPhone 13 Pro Max");
});

test("syncProductPricesFromCatalog updates matching storage option prices and base price", () => {
  const result = syncProductPricesFromCatalog(
    {
      name: "iPhone 13",
      price: 400000,
      storageOptions: [
        { capacity: "128GB", price: 400000, qty: 2 },
        { capacity: "256GB", price: 450000, qty: 1 },
        { capacity: "512GB", price: 500000, qty: 1 },
      ],
    },
    {
      model: "iPhone 13",
      pricesByCapacity: {
        "128GB": 420000,
        "256GB": 470000,
      },
    },
  );

  assert.equal(result.changed, true);
  assert.equal(result.updatedProduct.price, 420000);
  assert.deepEqual(result.updatedProduct.storageOptions, [
    { capacity: "128GB", price: 420000, qty: 2 },
    { capacity: "256GB", price: 470000, qty: 1 },
    { capacity: "512GB", price: 500000, qty: 1 },
  ]);
  assert.deepEqual(result.matchedCapacities, ["128GB", "256GB"]);
});

test("syncProductPricesFromCatalog can update a base price even without local storage options", () => {
  const result = syncProductPricesFromCatalog(
    {
      name: "iPhone XR",
      price: 190000,
      storageOptions: [],
    },
    {
      model: "iPhone XR",
      pricesByCapacity: {
        "64GB": 200000,
        "128GB": 230000,
      },
    },
  );

  assert.equal(result.changed, true);
  assert.equal(result.updatedProduct.price, 200000);
  assert.deepEqual(result.updatedProduct.storageOptions, []);
});

test("syncProductPricesFromCatalog leaves the product unchanged when there is no model match", () => {
  const result = syncProductPricesFromCatalog(
    {
      name: "iPhone 12 mini",
      price: 300000,
      storageOptions: [{ capacity: "64GB", price: 300000, qty: 1 }],
    },
    null,
  );

  assert.equal(result.changed, false);
  assert.equal(result.matchedModel, false);
  assert.equal(result.updatedProduct.price, 300000);
});

test("syncProductPricesFromCatalog ignores obviously invalid catalog prices", () => {
  const result = syncProductPricesFromCatalog(
    {
      name: "iPhone 15 Plus",
      price: 1420000,
      storageOptions: [
        { capacity: "128GB", price: 1420000, qty: 1 },
        { capacity: "256GB", price: 1520000, qty: 1 },
      ],
    },
    {
      model: "iPhone 15 Plus",
      pricesByCapacity: {
        "128GB": 680000,
        "256GB": 75000,
      },
    },
  );

  assert.equal(result.updatedProduct.price, 680000);
  assert.deepEqual(result.updatedProduct.storageOptions, [
    { capacity: "128GB", price: 680000, qty: 1 },
    { capacity: "256GB", price: 1520000, qty: 1 },
  ]);
  assert.deepEqual(result.matchedCapacities, ["128GB"]);
});
