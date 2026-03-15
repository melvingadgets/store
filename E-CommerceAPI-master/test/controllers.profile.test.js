const test = require("node:test");
const assert = require("node:assert/strict");

const profileModel = require("../dist/model/profileModel").default;
const cloudinary = require("../dist/utils/cloudinary").default;
const envModule = require("../dist/config/env");
const profileController = require("../dist/controller/profileController");
const {
  createMockRequest,
  createMockResponse,
  stubMethod,
  stubProperty,
} = require("./helpers/testUtils");

test("updateProfile returns 404 when the profile does not exist", async () => {
  const restoreFindById = stubMethod(profileModel, "findById", async () => null);
  const req = createMockRequest({
    params: { proId: "profile-1" },
    user: { _id: "user-1", userName: "Mel", role: "user" },
  });
  const res = createMockResponse();

  try {
    await profileController.updateProfile(req, res);

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, "profile not found");
  } finally {
    restoreFindById();
  }
});

test("updateProfile blocks edits from other non-admin users", async () => {
  const restoreFindById = stubMethod(profileModel, "findById", async () => ({
    _id: "profile-1",
    user: { toString: () => "owner-2" },
  }));
  const req = createMockRequest({
    params: { proId: "profile-1" },
    user: { _id: "owner-1", userName: "Mel", role: "user" },
  });
  const res = createMockResponse();

  try {
    await profileController.updateProfile(req, res);

    assert.equal(res.statusCode, 403);
    assert.match(res.body.message, /do not have permission/);
  } finally {
    restoreFindById();
  }
});

test("updateProfile updates the allowed fields for the owner", async () => {
  const updatedProfile = { _id: "profile-1", firstName: "Updated" };
  const restoreFindById = stubMethod(profileModel, "findById", async () => ({
    _id: "profile-1",
    user: { toString: () => "owner-1" },
  }));
  const restoreFindByIdAndUpdate = stubMethod(
    profileModel,
    "findByIdAndUpdate",
    async (_id, payload) => ({ ...updatedProfile, ...payload }),
  );
  const req = createMockRequest({
    params: { proId: "profile-1" },
    body: { firstName: "Updated", phoneNumber: "12345" },
    user: { _id: "owner-1", userName: "Mel", role: "user" },
  });
  const res = createMockResponse();

  try {
    await profileController.updateProfile(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.firstName, "Updated");
    assert.equal(res.body.data.phoneNumber, "12345");
  } finally {
    restoreFindById();
    restoreFindByIdAndUpdate();
  }
});

test("editImage requires an uploaded file", async () => {
  const restoreFindById = stubMethod(profileModel, "findById", async () => ({
    _id: "profile-1",
    user: { toString: () => "owner-1" },
  }));
  const req = createMockRequest({
    params: { proId: "profile-1" },
    user: { _id: "owner-1", userName: "Mel", role: "user" },
  });
  const res = createMockResponse();

  try {
    await profileController.editImage(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, "image upload is required");
  } finally {
    restoreFindById();
  }
});

test("editImage stores a local avatar URL when Cloudinary is disabled", async () => {
  const restoreCloudinaryFlag = stubProperty(envModule, "hasCloudinaryConfig", false);
  const restoreFindById = stubMethod(profileModel, "findById", async () => ({
    _id: "profile-1",
    user: { toString: () => "owner-1" },
  }));
  const restoreUpload = stubMethod(cloudinary.uploader, "upload", async () => ({
    secure_url: "https://cloudinary.example/avatar.png",
  }));
  const restoreFindByIdAndUpdate = stubMethod(
    profileModel,
    "findByIdAndUpdate",
    async (_id, payload) => payload,
  );
  const req = createMockRequest({
    params: { proId: "profile-1" },
    file: {
      filename: "avatar.png",
      path: "uploads/avatar.png",
    },
    user: { _id: "owner-1", userName: "Mel", role: "user" },
  });
  const res = createMockResponse();

  try {
    await profileController.editImage(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.avatar, `${envModule.env.appBaseUrl}/uploads/avatar.png`);
  } finally {
    restoreCloudinaryFlag();
    restoreFindById();
    restoreUpload();
    restoreFindByIdAndUpdate();
  }
});
