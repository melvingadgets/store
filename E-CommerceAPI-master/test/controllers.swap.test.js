const test = require("node:test");
const assert = require("node:assert/strict");

const productModel = require("../dist/model/productModel").default;
const easyBuyCatalog = require("../dist/utils/easyBuyCatalog");
const swapController = require("../dist/controller/swapController");
const {
  createMockRequest,
  createMockResponse,
  stubMethod,
} = require("./helpers/testUtils");

test("evaluateSwap requires targetProductId, tradeInModel, and tradeInStorage", async () => {
  const req = createMockRequest({
    body: {},
  });
  const res = createMockResponse();

  await swapController.evaluateSwap(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, "targetProductId, tradeInModel, and tradeInStorage are required");
});

test("getSwapMetadata returns backend-defined swap options", async () => {
  const req = createMockRequest();
  const res = createMockResponse();

  await swapController.getSwapMetadata(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.body.data.models));
  assert.ok(res.body.data.models.length > 0);
  assert.equal(res.body.data.defaultConditionSelections.overallCondition, "excellent");
  assert.equal(res.body.data.conditionFactors[0].key, "overallCondition");
});

test("evaluateSwap returns 404 when the target product is missing", async () => {
  const restoreTargetFind = stubMethod(productModel, "findById", async () => null);
  const restoreTradeInFind = stubMethod(productModel, "findOne", async () => ({
    _id: "trade-in-1",
    name: "iPhone 13",
    price: 600,
    storageOptions: [{ capacity: "128GB", price: 700, qty: 1 }],
  }));
  const restoreCatalogFetch = stubMethod(easyBuyCatalog, "fetchPublicEasyBuyCatalog", async () => null);
  const req = createMockRequest({
    body: {
      targetProductId: "target-1",
      tradeInModel: "iPhone 13",
      tradeInStorage: "128GB",
    },
  });
  const res = createMockResponse();

  try {
    await swapController.evaluateSwap(req, res);

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, "target product not found");
  } finally {
    restoreTargetFind();
    restoreTradeInFind();
    restoreCatalogFetch();
  }
});

test("evaluateSwap calculates a swap estimate using catalog-overridden prices", async () => {
  const restoreTargetFind = stubMethod(productModel, "findById", async () => ({
    _id: "target-1",
    name: "iPhone 16 Pro",
    price: 1000,
    storageOptions: [{ capacity: "128GB", price: 1100, qty: 1 }],
  }));
  const restoreTradeInFind = stubMethod(productModel, "findOne", async () => ({
    _id: "trade-in-1",
    name: "iPhone 13",
    price: 600,
    storageOptions: [{ capacity: "128GB", price: 700, qty: 1 }],
  }));
  const restoreCatalogFetch = stubMethod(easyBuyCatalog, "fetchPublicEasyBuyCatalog", async () => ({
    models: [
      {
        model: "iPhone 16 Pro",
        imageUrl: "https://example.com/iphone-16-pro.png",
        capacities: ["128GB"],
        allowedPlans: ["Monthly"],
        downPaymentPercentage: 40,
        pricesByCapacity: {
          "128GB": 1200,
        },
      },
      {
        model: "iPhone 13",
        imageUrl: "https://example.com/iphone-13.png",
        capacities: ["128GB"],
        allowedPlans: ["Monthly"],
        downPaymentPercentage: 40,
        pricesByCapacity: {
          "128GB": 750,
        },
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
    body: {
      targetProductId: "target-1",
      targetCapacity: "128GB",
      tradeInModel: "iPhone 13",
      tradeInStorage: "128GB",
      conditionSelections: {
        overallCondition: "excellent",
        screenCondition: "original",
        batteryCondition: "90-plus",
        faceIdStatus: "original",
        cameraStatus: "original",
      },
    },
  });
  const res = createMockResponse();

  try {
    await swapController.evaluateSwap(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.data, {
      targetPrice: 1200,
      referencePrice: 750,
      swapRate: 0.81,
      totalDeductionRate: 0.06,
      baseInternalResaleValue: 608,
      internalAdjustedResaleValue: 572,
      customerEstimateMin: 561,
      customerEstimateMax: 583,
      estimatedBalanceMin: 617,
      estimatedBalanceMax: 639,
    });
  } finally {
    restoreTargetFind();
    restoreTradeInFind();
    restoreCatalogFetch();
  }
});
