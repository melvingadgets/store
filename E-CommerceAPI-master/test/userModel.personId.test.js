const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const mongoose = require("mongoose");

const userModel = require("../dist/model/userModel").default;

// The personId index must let any number of accounts exist without a personId (every account
// today) and still allow only one account per person. Runs the real schema against a throwaway
// database on the local MongoDB (a standalone server is enough), dropped at the end. It uses its
// own connection, so it never touches the default one other test files share.

const base = process.env.MONGO_TEST_URL || "mongodb://127.0.0.1:27017";
let conn;
let Users;

before(async () => {
  conn = await mongoose.createConnection(`${base}/store_personid_${crypto.randomUUID().slice(0, 8)}`).asPromise();
  Users = conn.model("users", userModel.schema);
  await Users.init();
});

after(async () => {
  await conn.dropDatabase();
  await conn.close();
});

const account = (n, extra = {}) => ({ userName: `User ${n}`, email: `user${n}@example.test`, password: "x", ...extra });

test("personId index is a unique partial index on string values, not a sparse one", async () => {
  const index = (await Users.collection.indexes()).find((entry) => entry.key && "personId" in entry.key);
  assert.ok(index, "personId index exists");
  assert.equal(index.unique, true);
  assert.deepEqual(index.partialFilterExpression, { personId: { $type: "string" } });
  assert.equal(index.sparse, undefined);
});

test("any number of accounts can exist without a personId, and no null is stored", async () => {
  for (const n of [1, 2, 3]) await Users.create(account(n));
  assert.equal(await Users.countDocuments({ email: /^user\d@/ }), 3);
  const raw = await Users.collection.findOne({ email: "user1@example.test" });
  assert.equal("personId" in raw, false);
});

test("only one account per person", async () => {
  await Users.create(account(10, { personId: "person-1" }));
  const second = await Users.create(account(11));
  await assert.rejects(Users.updateOne({ _id: second._id }, { $set: { personId: "person-1" } }), (error) => error.code === 11000);
});

test("the index builds over rows that predate the field", async () => {
  await conn.collection("legacy_users").insertMany([
    { userName: "Legacy 1", email: "legacy1@example.test", password: "x" },
    { userName: "Legacy 2", email: "legacy2@example.test", password: "x" },
  ]);
  const Legacy = conn.model("legacy", userModel.schema, "legacy_users");
  await Legacy.init();
  await Legacy.create(account(20));
  assert.equal(await Legacy.countDocuments(), 3);
});
