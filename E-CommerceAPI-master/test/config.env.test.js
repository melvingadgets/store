const test = require("node:test");
const assert = require("node:assert/strict");

const { env, hasAiConfig } = require("../dist/config/env");

test("env exposes parsed runtime configuration", () => {
  assert.equal(typeof env.port, "number");
  assert.equal(Array.isArray(env.corsOrigins), true);
  assert.ok(env.corsOrigins.length >= 1);
  assert.equal(typeof env.appBaseUrl, "string");
  assert.equal(typeof env.nodeEnv, "string");
  assert.equal(typeof env.ai.provider, "string");
  assert.equal(typeof env.ai.model, "string");
  assert.equal(typeof hasAiConfig, "boolean");
});

test("env.mongoUri throws when Mongo config is unavailable at access time", () => {
  const original = process.env.MONGODB_URI;
  delete process.env.MONGODB_URI;

  try {
    assert.throws(() => env.mongoUri(), /MONGODB_URI/);
  } finally {
    process.env.MONGODB_URI = original;
  }
});

test("env.mongoFallbackUri returns a development fallback when no explicit fallback is configured", () => {
  const originalFallback = process.env.MONGODB_URI_FALLBACK;
  const originalNodeEnv = process.env.NODE_ENV;
  delete process.env.MONGODB_URI_FALLBACK;
  process.env.NODE_ENV = "development";

  try {
    assert.equal(env.mongoFallbackUri(), "mongodb://127.0.0.1:27017/ecommerce");
  } finally {
    process.env.MONGODB_URI_FALLBACK = originalFallback;
    process.env.NODE_ENV = originalNodeEnv;
  }
});

test("env.jwtSecret throws when JWT config is unavailable at access time", () => {
  const original = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;

  try {
    assert.throws(() => env.jwtSecret(), /JWT_SECRET/);
  } finally {
    process.env.JWT_SECRET = original;
  }
});
