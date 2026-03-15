const test = require("node:test");
const assert = require("node:assert/strict");

const { createToolRegistry } = require("../dist/assistant/toolRegistry");

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

test("toolRegistry rejects unknown tools", async () => {
  const registry = createToolRegistry();

  const result = await registry.executeToolCall({
    name: "unknown_tool",
    arguments: {},
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /Unknown assistant tool/);
});

test("toolRegistry exposes the full assistant tool list", () => {
  const registry = createToolRegistry();
  const toolNames = registry.listTools().map((tool) => tool.name);

  assert.equal(toolNames.length, 12);
  assert.deepEqual(toolNames, [
    "evaluate_swap",
    "search_products",
    "get_product_details",
    "get_product_pricing_options",
    "compare_products",
    "find_best_match_product",
    "check_product_availability",
    "get_swap_requirements",
    "estimate_swap_from_partial_info",
    "explain_swap_result",
    "get_swap_eligible_models",
    "get_swap_policy_info",
  ]);
});

test("toolRegistry searches products by query and returns list items", async () => {
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
    {
      _id: "prod-2",
      name: "AirPods Pro",
      desc: "Wireless earbuds",
      price: 320000,
      qty: 4,
      storageOptions: [],
      category: { name: "Accessories" },
    },
  ];
  const registry = createToolRegistry({
    productStore: createProductStore(products),
    categoryStore: createCategoryStore(),
  });

  const result = await registry.executeToolCall({
    name: "search_products",
    arguments: {
      query: "iphone",
    },
  });

  assert.equal(result.ok, true);
  assert.ok(result.data.products.length >= 1);
  assert.equal(result.data.products[0].name, "iPhone 15");
  assert.equal(result.data.products[0].categoryName, "Phones");
});

test("toolRegistry returns product details for a known product reference", async () => {
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
  const registry = createToolRegistry({
    productStore: createProductStore(products),
  });

  const result = await registry.executeToolCall({
    name: "get_product_details",
    arguments: {
      productId: "prod-1",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.productId, "prod-1");
  assert.equal(result.data.name, "iPhone 15");
  assert.deepEqual(result.data.capacities, [
    { capacity: "128GB", price: 900000, qty: 2 },
    { capacity: "256GB", price: 1020000, qty: 1 },
  ]);
});

test("toolRegistry rejects evaluate_swap when required fields are missing", async () => {
  const registry = createToolRegistry();

  const result = await registry.executeToolCall({
    name: "evaluate_swap",
    arguments: {
      tradeInModel: "iPhone 13",
    },
  });

  assert.equal(result.ok, false);
  assert.equal(
    result.error,
    "Missing required fields for swap evaluation: targetProductId, tradeInModel, tradeInStorage.",
  );
});

test("toolRegistry executes evaluate_swap against the backend resolver and returns a summary", async () => {
  const calls = [];
  const registry = createToolRegistry({
    resolveSwapEvaluation: async (payload) => {
      calls.push(payload);

      return {
        ok: true,
        status: 200,
        data: {
          targetPrice: 1200,
          referencePrice: 750,
          swapRate: 0.81,
          totalDeductionRate: 0.06,
          baseInternalResaleValue: 608,
          internalAdjustedResaleValue: 572,
          customerEstimateMin: 543,
          customerEstimateMax: 601,
          estimatedBalanceMin: 599,
          estimatedBalanceMax: 657,
        },
      };
    },
  });

  const result = await registry.executeToolCall({
    name: "evaluate_swap",
    arguments: {
      tradeInModel: "iPhone 13",
      tradeInStorage: "128GB",
      conditionSelections: {
        overallCondition: "good",
      },
    },
    userContext: {
      productId: "target-1",
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(calls, [
    {
      targetProductId: "target-1",
      targetCapacity: undefined,
      tradeInModel: "iPhone 13",
      tradeInStorage: "128GB",
      conditionSelections: {
        overallCondition: "good",
        screenCondition: "original",
        batteryCondition: "90-plus",
        faceIdStatus: "original",
        cameraStatus: "original",
      },
    },
  ]);
  assert.deepEqual(result.data, {
    customerEstimateMin: 543,
    customerEstimateMax: 601,
    estimatedBalanceMin: 599,
    estimatedBalanceMax: 657,
    note: "Final trade-in value is confirmed after device inspection.",
    summary: "Estimated trade-in credit ₦543 to ₦601. Estimated balance ₦599 to ₦657.",
  });
});

test("toolRegistry returns structured pricing options for a product", async () => {
  const registry = createToolRegistry({
    productStore: {
      findById: () => ({
        populate: async () => ({
          _id: "prod-1",
          name: "iPhone 15",
          price: 900000,
          qty: 0,
          storageOptions: [
            { capacity: "128GB", price: 900000, qty: 2 },
            { capacity: "256GB", price: 1020000, qty: 0 },
          ],
        }),
      }),
    },
  });

  const result = await registry.executeToolCall({
    name: "get_product_pricing_options",
    arguments: {
      capacity: "256gb",
    },
    userContext: {
      productId: "prod-1",
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.data, {
    productId: "prod-1",
    name: "iPhone 15",
    basePrice: 900000,
    currency: "NGN",
    inStock: true,
    pricingOptions: [
      { capacity: "128GB", price: 900000, qty: 2, inStock: true },
      { capacity: "256GB", price: 1020000, qty: 0, inStock: false },
    ],
    requestedCapacity: "256GB",
    requestedCapacityMatch: {
      capacity: "256GB",
      price: 1020000,
      qty: 0,
      inStock: false,
    },
    requestedCapacityAvailable: true,
  });
});

test("toolRegistry reports unavailable requested capacity while still returning valid product pricing", async () => {
  const registry = createToolRegistry({
    productStore: {
      findById: () => ({
        populate: async () => ({
          _id: "prod-2",
          name: "iPhone 14 Pro",
          price: 1100000,
          qty: 1,
          storageOptions: [
            { capacity: "128GB", price: 1100000, qty: 1 },
            { capacity: "512GB", price: 1450000, qty: 1 },
          ],
        }),
      }),
    },
  });

  const result = await registry.executeToolCall({
    name: "get_product_pricing_options",
    arguments: {
      productId: "prod-2",
      capacity: "256GB",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.requestedCapacity, "256GB");
  assert.equal(result.data.requestedCapacityMatch, null);
  assert.equal(result.data.requestedCapacityAvailable, false);
  assert.equal(result.data.pricingOptions.length, 2);
});

test("toolRegistry caches repeatable tool responses", async () => {
  let findByIdCalls = 0;
  const registry = createToolRegistry({
    productStore: {
      findById: () => {
        findByIdCalls += 1;
        return {
          populate: async () => ({
            _id: "prod-1",
            name: "iPhone 15",
            price: 900000,
            qty: 0,
            storageOptions: [
              { capacity: "128GB", price: 900000, qty: 2 },
              { capacity: "256GB", price: 1020000, qty: 0 },
            ],
          }),
        };
      },
    },
  });

  const first = await registry.executeToolCall({
    name: "get_product_pricing_options",
    arguments: { productId: "prod-1" },
  });
  const second = await registry.executeToolCall({
    name: "get_product_pricing_options",
    arguments: { productId: "prod-1" },
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(findByIdCalls, 1);
});

test("toolRegistry compares two products using stored facts", async () => {
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
    {
      _id: "prod-2",
      name: "iPhone 15 Pro",
      desc: "Pro model",
      price: 1200000,
      qty: 0,
      storageOptions: [
        { capacity: "128GB", price: 1200000, qty: 0 },
        { capacity: "256GB", price: 1380000, qty: 1 },
      ],
      category: { name: "Phones" },
    },
  ];
  const registry = createToolRegistry({
    productStore: createProductStore(products),
    categoryStore: createCategoryStore(),
  });

  const result = await registry.executeToolCall({
    name: "compare_products",
    arguments: {
      primaryProductId: "prod-1",
      compareToProductId: "prod-2",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.products.length, 2);
  assert.deepEqual(result.data.comparison.commonCapacities, ["128GB", "256GB"]);
  assert.equal(result.data.comparison.cheaperProductName, "iPhone 15");
  assert.equal(result.data.comparison.sameCategory, true);
});

test("toolRegistry ranks best match products from budget and capacity preference", async () => {
  const products = [
    {
      _id: "prod-1",
      name: "iPhone 14",
      desc: "Reliable everyday phone",
      price: 780000,
      qty: 2,
      storageOptions: [{ capacity: "128GB", price: 780000, qty: 2 }],
      category: { name: "Phones" },
    },
    {
      _id: "prod-2",
      name: "iPhone 15",
      desc: "Newer camera features",
      price: 900000,
      qty: 1,
      storageOptions: [{ capacity: "256GB", price: 1020000, qty: 1 }],
      category: { name: "Phones" },
    },
    {
      _id: "prod-3",
      name: "iPhone 15 Pro",
      desc: "Premium option",
      price: 1300000,
      qty: 1,
      storageOptions: [{ capacity: "256GB", price: 1300000, qty: 1 }],
      category: { name: "Phones" },
    },
  ];
  const registry = createToolRegistry({
    productStore: createProductStore(products),
    categoryStore: createCategoryStore(),
  });

  const result = await registry.executeToolCall({
    name: "find_best_match_product",
    arguments: {
      maxBudget: 950000,
      preferredCapacity: "256GB",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.results[0].name, "iPhone 15");
  assert.equal(result.data.results[0].inStock, true);
});

test("toolRegistry checks product availability by requested capacity", async () => {
  const registry = createToolRegistry({
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

  const result = await registry.executeToolCall({
    name: "check_product_availability",
    arguments: {
      productId: "prod-1",
      capacity: "256GB",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.available, false);
  assert.equal(result.data.requestedCapacityInStock, false);
  assert.match(result.data.summary, /currently unavailable/);
});

test("toolRegistry returns swap requirements guidance", async () => {
  const registry = createToolRegistry();

  const result = await registry.executeToolCall({
    name: "get_swap_requirements",
    arguments: {},
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.data.required, [
    "Target product",
    "Current iPhone model",
    "Current iPhone storage",
  ]);
  assert.ok(result.data.helpful.includes("Overall condition"));
  assert.match(result.data.note, /physical inspection/i);
});

test("toolRegistry returns missing swap fields before estimating", async () => {
  const registry = createToolRegistry();

  const result = await registry.executeToolCall({
    name: "estimate_swap_from_partial_info",
    arguments: {
      tradeInModel: "iPhone 13",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.status, "needs_more_info");
  assert.deepEqual(result.data.missingRequiredFields, ["targetProductId", "tradeInStorage"]);
  assert.equal(result.data.nextQuestion, "Which phone do you want to buy with this trade-in?");
});

test("toolRegistry returns ready swap estimate from partial info when enough details are present", async () => {
  const registry = createToolRegistry({
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

  const result = await registry.executeToolCall({
    name: "estimate_swap_from_partial_info",
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
  assert.equal(result.data.summary, "Estimated trade-in credit ₦400,000 to ₦450,000. Estimated balance ₦500,000 to ₦550,000.");
});

test("toolRegistry explains swap results without exposing mechanics", async () => {
  const registry = createToolRegistry({
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
    productStore: createProductStore([
      {
        _id: "prod-1",
        name: "iPhone 15",
        desc: "Base model",
        price: 900000,
        qty: 1,
        storageOptions: [{ capacity: "128GB", price: 900000, qty: 1 }],
        category: { name: "Phones" },
      },
    ]),
  });

  const result = await registry.executeToolCall({
    name: "explain_swap_result",
    arguments: {
      targetProductId: "prod-1",
      tradeInModel: "iPhone 13",
      tradeInStorage: "128GB",
    },
  });

  assert.equal(result.ok, true);
  assert.match(result.data.explanation, /iPhone 13 128GB/);
  assert.match(result.data.explanation, /₦400,000 to ₦450,000/);
  assert.equal("referencePrice" in result.data, false);
});

test("toolRegistry returns eligible swap models and policy info", async () => {
  const registry = createToolRegistry();

  const eligible = await registry.executeToolCall({
    name: "get_swap_eligible_models",
    arguments: {
      model: "iPhone 13",
    },
  });
  const policy = await registry.executeToolCall({
    name: "get_swap_policy_info",
    arguments: {},
  });

  assert.equal(eligible.ok, true);
  assert.equal(eligible.data.eligible, true);
  assert.deepEqual(eligible.data.capacities, ["128GB", "256GB", "512GB"]);
  assert.equal(policy.ok, true);
  assert.match(policy.data.summary, /provisional/);
});
