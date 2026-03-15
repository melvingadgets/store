const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { upload, uploads } = require("../dist/utils/multer");

test("multer exports upload middleware for avatars and product images", () => {
  const uploadsDirectory = path.resolve(process.cwd(), "uploads");

  assert.equal(typeof upload, "function");
  assert.equal(typeof uploads, "function");
  assert.equal(fs.existsSync(uploadsDirectory), true);
});
