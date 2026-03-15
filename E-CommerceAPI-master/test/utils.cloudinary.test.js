const test = require("node:test");
const assert = require("node:assert/strict");

const envModule = require("../dist/config/env");
const cloudinaryUtil = require("../dist/utils/cloudinary");
const { stubProperty } = require("./helpers/testUtils");

test("ensureCloudinaryConfigured throws when Cloudinary config is disabled", () => {
  const restore = stubProperty(envModule, "hasCloudinaryConfig", false);

  try {
    assert.throws(
      () => cloudinaryUtil.ensureCloudinaryConfigured(),
      /Cloudinary configuration is missing/,
    );
  } finally {
    restore();
  }
});

test("ensureCloudinaryConfigured does not throw when Cloudinary config is available", () => {
  const restore = stubProperty(envModule, "hasCloudinaryConfig", true);

  try {
    assert.doesNotThrow(() => cloudinaryUtil.ensureCloudinaryConfigured());
    assert.ok(cloudinaryUtil.default.uploader);
  } finally {
    restore();
  }
});
