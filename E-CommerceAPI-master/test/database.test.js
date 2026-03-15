const test = require("node:test");
const assert = require("node:assert/strict");

const mongoose = require("mongoose");
const envModule = require("../dist/config/env");
const { stubMethod } = require("./helpers/testUtils");

test("database module connects with the configured Mongo URI", async () => {
  const calls = [];
  const restoreLog = stubMethod(console, "log", () => undefined);
  const restoreMongo = stubMethod(mongoose, "connect", async (uri, options) => {
    calls.push({ uri, options });
    return { connection: { host: "stubbed-host" } };
  });
  const restoreEnv = stubMethod(envModule.env, "mongoUri", () => "mongodb://127.0.0.1:27017/test-db");

  try {
    delete require.cache[require.resolve("../dist/database/database")];
    const databaseModule = require("../dist/database/database");
    const connection = await databaseModule.default;

    assert.deepEqual(connection, { connection: { host: "stubbed-host" } });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].uri, "mongodb://127.0.0.1:27017/test-db");
    assert.equal(calls[0].options, undefined);
  } finally {
    restoreLog();
    restoreMongo();
    restoreEnv();
    delete require.cache[require.resolve("../dist/database/database")];
  }
});
