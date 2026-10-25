import { test } from "node:test";
import assert from "node:assert/strict";
import { createBridgeGate } from "../src/lib/bridgeGate.ts";

// Run with `npm test` (Node runs the TypeScript directly).

test("sends nothing until the OS has handed over a token", () => {
  assert.equal(createBridgeGate().token(), null);
});

test("uses the OS token it was given", () => {
  const gate = createBridgeGate();
  gate.setToken("t1");
  assert.equal(gate.token(), "t1");
});

test("a backend that accepts the token: a later 401 is just expiry and asks for a fresh one", () => {
  const gate = createBridgeGate();
  gate.setToken("t1");
  gate.accepted("t1");
  assert.equal(gate.unauthorized("t1"), "refresh");
  gate.setToken("t2");
  gate.accepted("t2");
  assert.equal(gate.token(), "t2");
  // It keeps working across further expiries: it is never given up on once it has answered.
  assert.equal(gate.unauthorized("t2"), "refresh");
  gate.setToken("t3");
  assert.equal(gate.unauthorized("t3"), "refresh");
  assert.equal(gate.token(), "t3");
});

test("a backend that refuses the token: one refresh, then the app falls back to its own login", () => {
  const gate = createBridgeGate();
  gate.setToken("t1");
  assert.equal(gate.unauthorized("t1"), "refresh");
  assert.equal(gate.token(), "t1", "keeps the token while the refresh is pending");
  gate.setToken("t2");
  assert.equal(gate.unauthorized("t2"), "rejected");
  assert.equal(gate.token(), null);
});

test("parallel 401s for the same token trigger a single refresh and never a rejection", () => {
  const gate = createBridgeGate();
  gate.setToken("t1");
  assert.equal(gate.unauthorized("t1"), "refresh");
  assert.equal(gate.unauthorized("t1"), "ignore");
  assert.equal(gate.unauthorized("t1"), "ignore");
  assert.equal(gate.token(), "t1");
});

test("a late answer for a token that was already replaced is ignored", () => {
  const gate = createBridgeGate();
  gate.setToken("t1");
  gate.setToken("t2");
  assert.equal(gate.unauthorized("t1"), "ignore");
  assert.equal(gate.token(), "t2");
  gate.accepted("t1");
  assert.equal(gate.unauthorized("t2"), "refresh", "an answer for t1 must not have proven t2");
});

test("once refused, new tokens are not tried again for this page load", () => {
  const gate = createBridgeGate();
  gate.setToken("t1");
  gate.unauthorized("t1");
  gate.setToken("t2");
  gate.unauthorized("t2");
  gate.setToken("t3");
  assert.equal(gate.token(), null);
  assert.equal(gate.unauthorized("t3"), "ignore");
});

test("signing out forgets what was learned, so the next sign-in starts fresh", () => {
  const gate = createBridgeGate();
  gate.setToken("t1");
  gate.unauthorized("t1");
  gate.setToken("t2");
  gate.unauthorized("t2");
  assert.equal(gate.token(), null);
  gate.setToken(null);
  gate.setToken("t3");
  assert.equal(gate.token(), "t3");
  assert.equal(gate.unauthorized("t3"), "refresh");
});

test("an answer that arrives after sign-out changes nothing", () => {
  const gate = createBridgeGate();
  gate.setToken("t1");
  gate.setToken(null);
  gate.accepted("t1");
  assert.equal(gate.unauthorized("t1"), "ignore");
  assert.equal(gate.token(), null);
});
