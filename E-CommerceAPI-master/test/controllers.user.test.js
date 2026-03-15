const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const userModel = require("../dist/model/userModel").default;
const profileModel = require("../dist/model/profileModel").default;
const userSessionModel = require("../dist/model/userSessionModel").default;
const emailVerification = require("../dist/utils/EmailVerification");
const envModule = require("../dist/config/env");
const userController = require("../dist/controller/UserController");
const {
  createDocument,
  createMockRequest,
  createMockResponse,
  createPopulateChain,
  stubMethod,
  stubProperty,
} = require("./helpers/testUtils");

test("createUser validates the required fields", async () => {
  const req = createMockRequest({
    body: {
      email: "",
      password: "",
    },
  });
  const res = createMockResponse();

  await userController.createUser(req, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /required/);
});

test("createUser rejects duplicate emails", async () => {
  const restoreFindOne = stubMethod(userModel, "findOne", async () => ({ _id: "existing-user" }));
  const req = createMockRequest({
    body: {
      firstName: "Mel",
      lastName: "Store",
      email: "mel@example.com",
      password: "password123",
    },
  });
  const res = createMockResponse();

  try {
    await userController.createUser(req, res);

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.message, "email already in use");
  } finally {
    restoreFindOne();
  }
});

test("createUser creates the user and profile while stripping the password from the response", async () => {
  const registerUser = createDocument({
    _id: "user-1",
    userName: "Mel Store",
    email: "mel@example.com",
    password: "hashed-password",
  });
  const profile = createDocument({
    _id: "profile-1",
    firstName: "Mel",
    lastName: "Store",
  });
  const restoreHasMailConfig = stubProperty(envModule, "hasMailConfig", false);
  const restoreFindOne = stubMethod(userModel, "findOne", async () => null);
  const restoreHash = stubMethod(bcrypt, "hash", async () => "hashed-password");
  const restoreUserCreate = stubMethod(userModel, "create", async () => registerUser);
  const restoreProfileCreate = stubMethod(profileModel, "create", async () => profile);
  const restoreSendVerification = stubMethod(
    emailVerification,
    "sendVerificationEmail",
    async () => true,
  );
  const req = createMockRequest({
    body: {
      firstName: "Mel",
      lastName: "Store",
      email: "mel@example.com",
      password: "password123",
    },
  });
  const res = createMockResponse();

  try {
    await userController.createUser(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.data.user.password, undefined);
    assert.equal(res.body.data.user.userName, "Mel Store");
    assert.equal(registerUser.profile, "profile-1");
    assert.equal(registerUser.saveCallCount, 1);
  } finally {
    restoreHasMailConfig();
    restoreFindOne();
    restoreHash();
    restoreUserCreate();
    restoreProfileCreate();
    restoreSendVerification();
  }
});

test("createUser succeeds even when the verification email cannot be sent", async () => {
  const registerUser = createDocument({
    _id: "user-1",
    userName: "Mel Store",
    email: "mel@example.com",
    password: "hashed-password",
  });
  const profile = createDocument({
    _id: "profile-1",
    firstName: "Mel",
    lastName: "Store",
  });
  const restoreHasMailConfig = stubProperty(envModule, "hasMailConfig", true);
  const restoreFindOne = stubMethod(userModel, "findOne", async () => null);
  const restoreHash = stubMethod(bcrypt, "hash", async () => "hashed-password");
  const restoreJwt = stubMethod(jwt, "sign", () => "verification-token");
  const restoreConsoleError = stubMethod(console, "error", () => undefined);
  const restoreUserCreate = stubMethod(userModel, "create", async () => registerUser);
  const restoreProfileCreate = stubMethod(profileModel, "create", async () => profile);
  const restoreSendVerification = stubMethod(
    emailVerification,
    "sendVerificationEmail",
    async () => {
      throw new Error("smtp unavailable");
    },
  );
  const req = createMockRequest({
    body: {
      firstName: "Mel",
      lastName: "Store",
      email: "mel@example.com",
      password: "password123",
    },
  });
  const res = createMockResponse();

  try {
    await userController.createUser(req, res);

    assert.equal(res.statusCode, 201);
    assert.match(res.body.message, /could not send the verification email/i);
    assert.equal(res.body.data.user.password, undefined);
  } finally {
    restoreHasMailConfig();
    restoreFindOne();
    restoreHash();
    restoreJwt();
    restoreConsoleError();
    restoreUserCreate();
    restoreProfileCreate();
    restoreSendVerification();
  }
});

test("loginUser rejects incorrect passwords", async () => {
  const loginUser = createDocument({
    _id: "user-1",
    userName: "Mel",
    email: "mel@example.com",
    password: "hashed-password",
    verify: true,
    role: "user",
  });
  const restoreFindOne = stubMethod(userModel, "findOne", () => createPopulateChain(loginUser));
  const restoreCompare = stubMethod(bcrypt, "compare", async () => false);
  const req = createMockRequest({
    body: {
      email: "mel@example.com",
      password: "wrong-password",
    },
  });
  const res = createMockResponse();

  try {
    await userController.loginUser(req, res);

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.message, "incorrect password");
  } finally {
    restoreFindOne();
    restoreCompare();
  }
});

test("loginUser blocks unverified accounts", async () => {
  const loginUser = createDocument({
    _id: "user-1",
    userName: "Mel",
    email: "mel@example.com",
    password: "hashed-password",
    verify: false,
    role: "user",
  });
  const restoreHasMailConfig = stubProperty(envModule, "hasMailConfig", false);
  const restoreFindOne = stubMethod(userModel, "findOne", () => createPopulateChain(loginUser));
  const restoreCompare = stubMethod(bcrypt, "compare", async () => true);
  const req = createMockRequest({
    body: {
      email: "mel@example.com",
      password: "password123",
    },
  });
  const res = createMockResponse();

  try {
    await userController.loginUser(req, res);

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.message, "your account is not verified yet");
  } finally {
    restoreHasMailConfig();
    restoreFindOne();
    restoreCompare();
  }
});

test("loginUser still returns 403 when resending the verification email fails", async () => {
  const loginUser = createDocument({
    _id: "user-1",
    userName: "Mel",
    email: "mel@example.com",
    password: "hashed-password",
    verify: false,
    role: "user",
  });
  const restoreHasMailConfig = stubProperty(envModule, "hasMailConfig", true);
  const restoreFindOne = stubMethod(userModel, "findOne", () => createPopulateChain(loginUser));
  const restoreCompare = stubMethod(bcrypt, "compare", async () => true);
  const restoreJwt = stubMethod(jwt, "sign", () => "verification-token");
  const restoreConsoleError = stubMethod(console, "error", () => undefined);
  const restoreSendVerification = stubMethod(
    emailVerification,
    "sendVerificationEmail",
    async () => {
      throw new Error("smtp unavailable");
    },
  );
  const req = createMockRequest({
    body: {
      email: "mel@example.com",
      password: "password123",
    },
  });
  const res = createMockResponse();

  try {
    await userController.loginUser(req, res);

    assert.equal(res.statusCode, 403);
    assert.match(res.body.message, /could not resend the verification email/i);
  } finally {
    restoreHasMailConfig();
    restoreFindOne();
    restoreCompare();
    restoreJwt();
    restoreConsoleError();
    restoreSendVerification();
  }
});

test("loginUser returns a token and sanitized user payload for verified accounts", async () => {
  const loginUser = createDocument({
    _id: "user-1",
    userName: "Mel",
    email: "mel@example.com",
    password: "hashed-password",
    verify: true,
    role: "admin",
  });
  const restoreFindOne = stubMethod(userModel, "findOne", () => createPopulateChain(loginUser));
  const restoreCompare = stubMethod(bcrypt, "compare", async () => true);
  const restoreJwt = stubMethod(jwt, "sign", () => "signed-token");
  const restoreDecode = stubMethod(jwt, "decode", () => ({ exp: 1_800_000_000 }));
  const restoreSessionCreate = stubMethod(userSessionModel, "create", async (payload) => createDocument({
    ...payload,
    user: {
      _id: "user-1",
      userName: "Mel",
      email: "mel@example.com",
      role: "admin",
    },
  }));
  const req = createMockRequest({
    body: {
      email: "mel@example.com",
      password: "password123",
      clientContext: {
        platform: "Win32",
        language: "en-US",
        timezone: "Africa/Lagos",
        path: "/login",
        screen: {
          width: 1440,
          height: 900,
          pixelRatio: 1.5,
        },
      },
    },
    headers: {
      "user-agent": "Mozilla/5.0 Chrome/122.0.0.0 Safari/537.36",
      "x-forwarded-for": "41.217.0.10",
    },
  });
  const res = createMockResponse();

  try {
    await userController.loginUser(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.token, "signed-token");
    assert.equal(res.body.data.user.password, undefined);
    assert.equal(res.body.data.user.role, "admin");
    assert.equal(res.body.data.session.status, "online");
    assert.equal(res.body.data.session.browser, "Chrome");
    assert.equal(res.body.data.session.ipAddress, "41.217.0.10");
  } finally {
    restoreFindOne();
    restoreCompare();
    restoreJwt();
    restoreDecode();
    restoreSessionCreate();
  }
});

test("logOut marks the tracked session as logged out", async () => {
  const sessionRecord = createDocument({
    sessionId: "session-1",
    user: "user-1",
    status: "online",
    loginAt: new Date("2026-03-15T09:00:00.000Z"),
    lastSeenAt: new Date("2026-03-15T09:01:00.000Z"),
    userAgent: "Mozilla/5.0 Chrome/122.0.0.0 Safari/537.36",
    deviceType: "desktop",
    browser: "Chrome",
    os: "Windows",
    platform: "Win32",
    language: "en-US",
    timezone: "Africa/Lagos",
    referrer: "",
    screen: { width: 1440, height: 900, pixelRatio: 1.5 },
    utm: { source: "", medium: "", campaign: "", term: "", content: "" },
  });
  const restoreFindSession = stubMethod(userSessionModel, "findOne", async () => sessionRecord);
  const req = createMockRequest({
    body: {
      sessionId: "session-1",
      clientContext: {
        path: "/account",
        visibilityState: "visible",
      },
    },
    user: { _id: "user-1", userName: "Mel", role: "user" },
    headers: {
      "x-forwarded-for": "41.217.0.11",
    },
  });
  const res = createMockResponse();

  try {
    await userController.logOut(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.status, "logged_out");
    assert.equal(sessionRecord.status, "logged_out");
    assert.equal(sessionRecord.lastPath, "/account");
  } finally {
    restoreFindSession();
  }
});

test("getSingleUser always uses the token user id", async () => {
  const userRecord = createDocument({
    _id: "owner-1",
    userName: "Mel",
    email: "mel@example.com",
  });
  const restoreFindById = stubMethod(userModel, "findById", () => createPopulateChain(userRecord));
  const req = createMockRequest({
    params: { id: "owner-2" },
    user: { _id: "owner-1", userName: "Mel", role: "user" },
  });
  const res = createMockResponse();

  try {
    await userController.getSingleUser(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data._id, "owner-1");
  } finally {
    restoreFindById();
  }
});

test("getAllUsers returns sanitized users", async () => {
  const users = [
    createDocument({
      _id: "user-1",
      userName: "Mel",
      email: "mel@example.com",
      password: "secret-1",
    }),
    createDocument({
      _id: "user-2",
      userName: "Store",
      email: "store@example.com",
      password: "secret-2",
    }),
  ];
  const restoreFind = stubMethod(userModel, "find", () => createPopulateChain(users));
  const res = createMockResponse();

  try {
    await userController.getAllUsers(createMockRequest(), res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.length, 2);
    assert.equal(res.body.data[0].password, undefined);
  } finally {
    restoreFind();
  }
});

test("verifyUser reports success when a matching user is updated", async () => {
  const restoreVerify = stubMethod(jwt, "verify", () => ({
    purpose: "verify-account",
    userId: "user-1",
  }));
  const restoreFindByIdAndUpdate = stubMethod(userModel, "findByIdAndUpdate", async () => ({
    _id: "user-1",
  }));
  const req = createMockRequest({
    params: { id: "signed-verification-token" },
  });
  const res = createMockResponse();

  try {
    await userController.verifyUser(req, res);

    assert.equal(res.statusCode, 200);
    assert.match(res.body.message, /account has been verified/i);
  } finally {
    restoreVerify();
    restoreFindByIdAndUpdate();
  }
});

test("verifyUser rejects invalid or expired verification tokens", async () => {
  const restoreVerify = stubMethod(jwt, "verify", () => {
    throw new Error("jwt expired");
  });
  const req = createMockRequest({
    params: { id: "expired-token" },
  });
  const res = createMockResponse();

  try {
    await userController.verifyUser(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /invalid or has expired/i);
  } finally {
    restoreVerify();
  }
});
