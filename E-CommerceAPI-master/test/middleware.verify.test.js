const test = require("node:test");
const assert = require("node:assert/strict");

const jwt = require("jsonwebtoken");
const { verifyToken } = require("../dist/Middleware/Verify");
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
  const payload = { _id: "user-1", userName: "Mel", role: "User" };
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

// `requireAdmin` is gone — it compared lowercase strings and so refused a `SuperAdmin`
// (`"SuperAdmin" !== "superadmin"`). Its replacements are the kit's `requirePermission` guards,
// covered by test/rbac.test.js.

test("verifyToken refuses a legacy token whose role is not canonical", () => {
  // No fallback: the store used to treat an unreadable role as `user`, which made a broken
  // token look like a working customer login.
  for (const role of ["admin", "superadmin", "owner", undefined, 1]) {
    const restoreJwt = stubMethod(jwt, "verify", () => ({ _id: "user-1", userName: "Mel", role }));
    const req = createMockRequest({ headers: { authorization: "Bearer valid-token" } });
    const res = createMockResponse();
    const next = createNextSpy();
    try {
      verifyToken(req, res, next);
      assert.equal(res.statusCode, 401, `role ${JSON.stringify(role)} should be refused`);
      assert.equal(next.called(), false);
    } finally {
      restoreJwt();
    }
  }
});
