const test = require("node:test");
const assert = require("node:assert/strict");

const jwt = require("jsonwebtoken");
const { verifyToken, requireAdmin } = require("../dist/Middleware/Verify");
const {
  createMockRequest,
  createMockResponse,
  createNextSpy,
  stubMethod,
} = require("./helpers/testUtils");

test("verifyToken rejects requests without a bearer token", () => {
  const req = createMockRequest();
  const res = createMockResponse();
  const next = createNextSpy();

  verifyToken(req, res, next);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.message, "Please provide a valid bearer token");
  assert.equal(next.called(), false);
});

test("verifyToken rejects invalid tokens", () => {
  const restoreJwt = stubMethod(jwt, "verify", () => {
    throw new Error("bad token");
  });
  const req = createMockRequest({
    headers: {
      authorization: "Bearer broken",
    },
  });
  const res = createMockResponse();
  const next = createNextSpy();

  try {
    verifyToken(req, res, next);

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.message, "Token has expired or is invalid");
    assert.equal(next.called(), false);
  } finally {
    restoreJwt();
  }
});

test("verifyToken attaches the decoded payload to the request", () => {
  const payload = { _id: "user-1", userName: "Mel", role: "user" };
  const restoreJwt = stubMethod(jwt, "verify", () => payload);
  const req = createMockRequest({
    headers: {
      authorization: "Bearer valid-token",
    },
  });
  const res = createMockResponse();
  const next = createNextSpy();

  try {
    verifyToken(req, res, next);

    assert.deepEqual(req.user, payload);
    assert.equal(next.called(), true);
  } finally {
    restoreJwt();
  }
});

test("requireAdmin allows admin users", () => {
  const req = createMockRequest({
    user: { _id: "user-1", userName: "Admin", role: "admin" },
  });
  const res = createMockResponse();
  const next = createNextSpy();

  requireAdmin(req, res, next);

  assert.equal(next.called(), true);
  assert.equal(res.body, undefined);
});

test("requireAdmin blocks non-admin users", () => {
  const req = createMockRequest({
    user: { _id: "user-1", userName: "Mel", role: "user" },
  });
  const res = createMockResponse();
  const next = createNextSpy();

  requireAdmin(req, res, next);

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.message, "Admin access is required for this action");
  assert.equal(next.called(), false);
});
