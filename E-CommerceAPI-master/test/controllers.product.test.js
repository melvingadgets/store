const test = require("node:test");
const assert = require("node:assert/strict");

const categoryModel = require("../dist/model/categoryModel").default;
const productModel = require("../dist/model/productModel").default;
const userModel = require("../dist/model/userModel").default;
const cloudinary = require("../dist/utils/cloudinary").default;
const easyBuyCatalog = require("../dist/utils/easyBuyCatalog");
const envModule = require("../dist/config/env");
const productController = require("../dist/controller/productController");
const {
  createDocument,
  createMockRequest,
  createMockResponse,
  createPopulateChain,
  stubMethod,
  stubProperty,
} = require("./helpers/testUtils");

test("createProduct requires a product name", async () => {
  const req = createMockRequest({
    params: { catId: "cat-1" },
    body: { name: "" },
    user: { _id: "admin-1", userName: "Admin", role: "admin" },
  });
  const res = createMockResponse();

  await productController.createProduct(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, "product name is required");
});

test("createProduct requires an uploaded image", async () => {
  const req = createMockRequest({
    params: { catId: "cat-1" },
    body: { name: "Phone" },
    user: { _id: "admin-1", userName: "Admin", role: "admin" },
  });
  const res = createMockResponse();

  await productController.createProduct(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, "product image is required");
});

test("createProduct requires an existing category", async () => {
  const restoreCategoryFind = stubMethod(categoryModel, "findById", async () => null);
  const req = createMockRequest({
    params: { catId: "cat-1" },
    body: { name: "Phone" },
    file: { filename: "phone.png", path: "uploads/phone.png" },
    user: { _id: "admin-1", userName: "Admin", role: "admin" },
  });
  const res = createMockResponse();

  try {
    await productController.createProduct(req, res);

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, "category not found");
  } finally {
    restoreCategoryFind();
  }
});

test("createProduct creates a product and appends it to the category", async () => {
  const category = createDocument({
    _id: "cat-1",
    products: [],
  });
  const creator = { _id: "admin-1" };
  const createdProduct = { _id: "product-1", name: "Phone" };
  const restoreCloudinaryFlag = stubProperty(envModule, "hasCloudinaryConfig", false);
  const restoreCategoryFind = stubMethod(categoryModel, "findById", async () => category);
  const restoreUserFind = stubMethod(userModel, "findById", async () => creator);
  const restoreUpload = stubMethod(cloudinary.uploader, "upload", async () => ({
    secure_url: "https://cloudinary.example/product.png",
  }));
  const restoreCreate = stubMethod(productModel, "create", async (payload) => ({
    ...createdProduct,
    ...payload,
  }));
  const req = createMockRequest({
    params: { catId: "cat-1" },
    body: { name: "Phone", desc: "Great phone", qty: "3", price: "500" },
    file: { filename: "phone.png", path: "uploads/phone.png" },
    user: { _id: "admin-1", userName: "Admin", role: "admin" },
  });
  const res = createMockResponse();

  try {
    await productController.createProduct(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.data.image, `${envModule.env.appBaseUrl}/uploads/phone.png`);
    assert.deepEqual(category.products, ["product-1"]);
    assert.equal(category.saveCallCount, 1);
  } finally {
    restoreCloudinaryFlag();
    restoreCategoryFind();
    restoreUserFind();
    restoreUpload();
    restoreCreate();
  }
});

test("ViewAllProduct returns the full product collection", async () => {
  const products = [{ _id: "product-1", name: "Phone" }];
  const restoreFind = stubMethod(productModel, "find", () => createPopulateChain(products));
  const restoreCatalogFetch = stubMethod(easyBuyCatalog, "fetchPublicEasyBuyCatalog", async () => null);
  const res = createMockResponse();

  try {
    await productController.ViewAllProduct(createMockRequest(), res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.data, products);
  } finally {
    restoreFind();
    restoreCatalogFetch();
  }
});

test("ViewAllProduct prefers EasyBuy catalog images when available", async () => {
  const products = [{ _id: "product-1", name: "iPhone 15", image: "http://localhost:2222/uploads/phone.png" }];
  const restoreFind = stubMethod(productModel, "find", () => createPopulateChain(products));
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
  const res = createMockResponse();

  try {
    await productController.ViewAllProduct(createMockRequest(), res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data[0].image, "https://easybuy.example/iphone-15.png");
  } finally {
    restoreFind();
    restoreCatalogFetch();
  }
});

test("ViewSingleProduct returns 404 for an unknown product", async () => {
  const restoreFindById = stubMethod(productModel, "findById", () => createPopulateChain(null));
  const req = createMockRequest({
    params: { id: "missing-product" },
  });
  const res = createMockResponse();

  try {
    await productController.ViewSingleProduct(req, res);

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, "product not found");
  } finally {
    restoreFindById();
  }
});
