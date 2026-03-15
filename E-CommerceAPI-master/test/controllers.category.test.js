const test = require("node:test");
const assert = require("node:assert/strict");

const categoryModel = require("../dist/model/categoryModel").default;
const userModel = require("../dist/model/userModel").default;
const categoryController = require("../dist/controller/categoryController");
const {
  createMockRequest,
  createMockResponse,
  createPopulateChain,
  stubMethod,
} = require("./helpers/testUtils");

test("createCategory validates the category name", async () => {
  const req = createMockRequest({
    body: { name: "" },
    user: { _id: "admin-1", userName: "Admin", role: "admin" },
  });
  const res = createMockResponse();

  await categoryController.createCategory(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, "enter category name");
});

test("createCategory requires a valid owner", async () => {
  const restoreFindById = stubMethod(userModel, "findById", async () => null);
  const req = createMockRequest({
    body: { name: "Phones" },
    user: { _id: "admin-1", userName: "Admin", role: "admin" },
  });
  const res = createMockResponse();

  try {
    await categoryController.createCategory(req, res);

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, "category owner not found");
  } finally {
    restoreFindById();
  }
});

test("createCategory creates a category with a slug", async () => {
  const restoreFindById = stubMethod(userModel, "findById", async () => ({ _id: "admin-1" }));
  const restoreCreate = stubMethod(categoryModel, "create", async (payload) => payload);
  const req = createMockRequest({
    body: { name: "Phones", parent: "Devices" },
    user: { _id: "admin-1", userName: "Admin", role: "admin" },
  });
  const res = createMockResponse();

  try {
    await categoryController.createCategory(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.data.name, "Phones");
    assert.match(res.body.data.slug, /^phones-/);
  } finally {
    restoreFindById();
    restoreCreate();
  }
});

test("getAllCategory returns the populated category list", async () => {
  const categories = [{ _id: "cat-1", name: "Phones" }];
  const restoreFind = stubMethod(categoryModel, "find", () => createPopulateChain(categories));
  const res = createMockResponse();

  try {
    await categoryController.getAllCategory(createMockRequest(), res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.data, categories);
  } finally {
    restoreFind();
  }
});

test("singleCategory returns 404 when the category is missing", async () => {
  const restoreFindById = stubMethod(categoryModel, "findById", () => createPopulateChain(null));
  const req = createMockRequest({ params: { id: "missing-category" } });
  const res = createMockResponse();

  try {
    await categoryController.singleCategory(req, res);

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, "category not found");
  } finally {
    restoreFindById();
  }
});

test("deleteCate removes an existing category", async () => {
  const restoreDelete = stubMethod(categoryModel, "findByIdAndDelete", async () => ({ _id: "cat-1" }));
  const req = createMockRequest({ params: { id: "cat-1" } });
  const res = createMockResponse();

  try {
    await categoryController.deleteCate(req, res);

    assert.equal(res.statusCode, 200);
    assert.match(res.body.message, /successfully deleted/);
  } finally {
    restoreDelete();
  }
});
