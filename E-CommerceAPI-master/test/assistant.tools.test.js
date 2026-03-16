const test = require("node:test");
const assert = require("node:assert/strict");

const { createCapabilityRegistry } = require("../dist/assistant/capabilityRegistry");

const createProductStore = (products) => ({
  findById: (productId) => ({
    populate: async () => products.find((product) => String(product._id) === String(productId)) ?? null,
  }),
  findOne: (query) => ({
    populate: async () => {
      const matchByName = (value) => {
        if (!query?.name) {
          return false;
        }

        if (query.name instanceof RegExp) {
          return query.name.test(value);
        }

        return String(value) === String(query.name);
      };

      return products.find((product) => matchByName(product.name)) ?? null;
    },
  }),
  find: () => ({
    limit: (limit) => ({
      populate: async () => products.slice(0, limit),
      select: async () => products.slice(0, limit),
    }),
    populate: async () => products,
    select: async () => products,
  }),
});

const createCategoryStore = (categories = []) => ({
  find: () => ({
    select: async () => categories,
  }),
});

test("capabilityRegistry rejects unknown capabilities", async () => {
  const registry = createCapabilityRegistry();

  const result = await registry.executeCapability({
    name: "unknown_capability",
    arguments: {},
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /Unknown assistant capability/);
});

test("capabilityRegistry exposes the first five assistant capabilities", () => {
  const registry = createCapabilityRegistry();
  const capabilityNames = registry.listCapabilities().map((capability) => capability.name);

  assert.deepEqual(capabilityNames, [
    "search_products",
    "get_product_details",
    "check_product_availability",
    "estimate_swap",
    "get_swap_requirements",
  ]);
});

test("capabilityRegistry searches products by query and returns list items", async () => {
  const products = [
    {
      _id: "prod-1",
      name: "iPhone 15",
      desc: "Base model with strong camera",
      price: 900000,
      qty: 2,
      storageOptions: [
        { capacity: "128GB", price: 900000, qty: 2 },
        { capacity: "256GB", price: 1020000, qty: 1 },
      ],
      category: { name: "Phones" },
    },
  ];
  const registry = createCapabilityRegistry({
    productStore: createProductStore(products),
    categoryStore: createCategoryStore(),
  });

  const result = await registry.executeCapability({
    name: "search_products",
    arguments: {
      query: "iphone",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.products[0].name, "iPhone 15");
});

test("capabilityRegistry returns product details for a known product reference", async () => {
  const products = [
    {
      _id: "prod-1",
      name: "iPhone 15",
      desc: "Base model",
      price: 900000,
      qty: 2,
      storageOptions: [
        { capacity: "128GB", price: 900000, qty: 2 },
        { capacity: "256GB", price: 1020000, qty: 1 },
      ],
      category: { name: "Phones" },
    },
  ];
  const registry = createCapabilityRegistry({
    productStore: createProductStore(products),
  });

  const result = await registry.executeCapability({
    name: "get_product_details",
    arguments: {
      productId: "prod-1",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.productId, "prod-1");
  assert.equal(result.data.name, "iPhone 15");
});

test("capabilityRegistry checks product availability by requested capacity", async () => {
  const registry = createCapabilityRegistry({
    productStore: createProductStore([
      {
        _id: "prod-1",
        name: "iPhone 15",
        desc: "Base model",
        price: 900000,
        qty: 0,
        storageOptions: [
          { capacity: "128GB", price: 900000, qty: 2 },
          { capacity: "256GB", price: 1020000, qty: 0 },
        ],
        category: { name: "Phones" },
      },
    ]),
  });

  const result = await registry.executeCapability({
    name: "check_product_availability",
    arguments: {
      productId: "prod-1",
      capacity: "256GB",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.available, false);
  assert.match(result.data.summary, /currently unavailable/);
});

test("capabilityRegistry returns missing swap fields before estimating", async () => {
  const registry = createCapabilityRegistry();

  const result = await registry.executeCapability({
    name: "estimate_swap",
    arguments: {
      tradeInModel: "iPhone 13",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.status, "needs_more_info");
  assert.deepEqual(result.data.missingRequiredFields, ["targetProductId", "tradeInStorage"]);
});

test("capabilityRegistry returns a ready swap estimate when enough details are present", async () => {
  const registry = createCapabilityRegistry({
    resolveSwapEvaluation: async () => ({
      ok: true,
      status: 200,
      data: {
        customerEstimateMin: 400000,
        customerEstimateMax: 450000,
        estimatedBalanceMin: 500000,
        estimatedBalanceMax: 550000,
      },
    }),
  });

  const result = await registry.executeCapability({
    name: "estimate_swap",
    arguments: {
      tradeInModel: "iPhone 13",
      tradeInStorage: "128GB",
    },
    userContext: {
      productId: "prod-1",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.status, "ready");
  assert.match(result.data.summary, /Estimated trade-in credit/);
});

test("capabilityRegistry returns swap requirements guidance", async () => {
  const registry = createCapabilityRegistry();

  const result = await registry.executeCapability({
    name: "get_swap_requirements",
    arguments: {},
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.data.required, [
    "Target product",
    "Current iPhone model",
    "Current iPhone storage",
  ]);
});
