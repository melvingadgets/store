const test = require("node:test");
const assert = require("node:assert/strict");

const userSessionModel = require("../dist/model/userSessionModel").default;
const userSessionController = require("../dist/controller/userSessionController");
const {
  createDocument,
  createMockRequest,
  createMockResponse,
  createPopulateChain,
  stubMethod,
} = require("./helpers/testUtils");

test("updateUserSessionPresence requires an authenticated session id", async () => {
  const req = createMockRequest({
    user: { _id: "user-1", userName: "Mel", role: "user" },
    body: {},
  });
  const res = createMockResponse();

  await userSessionController.updateUserSessionPresence(req, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /sessionId is required/i);
});

test("updateUserSessionPresence refreshes session metadata and marks hidden tabs idle", async () => {
  const session = createDocument({
    sessionId: "session-1",
    user: "user-1",
    loginAt: new Date("2026-03-15T09:00:00.000Z"),
    lastSeenAt: new Date("2026-03-15T09:01:00.000Z"),
    status: "online",
    userAgent: "Mozilla/5.0 Chrome/122.0.0.0 Safari/537.36",
    deviceType: "desktop",
    browser: "Chrome",
    os: "Windows",
    platform: "Win32",
    language: "en-US",
    timezone: "Africa/Lagos",
    referrer: "",
    screen: { width: 1440, height: 900, pixelRatio: 1 },
    utm: { source: "", medium: "", campaign: "", term: "", content: "" },
  });
  const restoreFindSession = stubMethod(userSessionModel, "findOne", async () => session);
  const req = createMockRequest({
    user: { _id: "user-1", userName: "Mel", role: "user" },
    body: {
      sessionId: "session-1",
      event: "visibilitychange",
      clientContext: {
        path: "/product",
        visibilityState: "hidden",
        online: true,
        platform: "Win32",
        language: "en-US",
      },
    },
    headers: {
      "user-agent": "Mozilla/5.0 Chrome/122.0.0.0 Safari/537.36",
      "x-forwarded-for": "41.217.0.12",
    },
  });
  const res = createMockResponse();

  try {
    await userSessionController.updateUserSessionPresence(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.status, "idle");
    assert.equal(session.lastEvent, "visibilitychange");
    assert.equal(session.lastPath, "/product");
    assert.equal(session.ipAddress, "41.217.0.12");
  } finally {
    restoreFindSession();
  }
});

test("getAdminUserSessions returns normalized recent sessions", async () => {
  const sessions = [
    createDocument({
      sessionId: "session-1",
      user: { _id: "user-1", userName: "Mel", email: "mel@example.com", role: "user" },
      loginAt: new Date("2026-03-15T10:00:00.000Z"),
      lastSeenAt: new Date("2026-03-15T10:00:30.000Z"),
      status: "online",
      lastEvent: "heartbeat",
      lastPath: "/",
      lastVisibilityState: "visible",
      lastOnlineState: true,
      ipAddress: "41.217.0.13",
      userAgent: "Mozilla/5.0",
      deviceType: "desktop",
      browser: "Chrome",
      os: "Windows",
      platform: "Win32",
      language: "en-US",
      timezone: "Africa/Lagos",
      referrer: "",
      screen: { width: 1440, height: 900, pixelRatio: 1 },
      utm: { source: "", medium: "", campaign: "", term: "", content: "" },
    }),
  ];
  const restoreFind = stubMethod(userSessionModel, "find", () => createPopulateChain(sessions));
  const req = createMockRequest({
    query: {
      limit: "25",
    },
  });
  const res = createMockResponse();

  try {
    await userSessionController.getAdminUserSessions(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].user.email, "mel@example.com");
  } finally {
    restoreFind();
  }
});

test("getAdminUserSessionSummary aggregates counts and breakdowns", async () => {
  const sessions = [
    createDocument({
      sessionId: "session-1",
      user: { _id: "user-1", userName: "Mel", email: "mel@example.com", role: "user" },
      loginAt: new Date("2026-03-15T10:00:00.000Z"),
      lastSeenAt: new Date(),
      status: "online",
      lastVisibilityState: "visible",
      deviceType: "desktop",
      browser: "Chrome",
      os: "Windows",
      screen: { width: 1440, height: 900, pixelRatio: 1 },
      utm: { source: "", medium: "", campaign: "", term: "", content: "" },
    }),
    createDocument({
      sessionId: "session-2",
      user: { _id: "user-2", userName: "Store", email: "store@example.com", role: "admin" },
      loginAt: new Date("2026-03-15T09:00:00.000Z"),
      lastSeenAt: new Date("2026-03-15T09:00:00.000Z"),
      logoutAt: new Date("2026-03-15T09:30:00.000Z"),
      status: "logged_out",
      lastVisibilityState: "visible",
      deviceType: "mobile",
      browser: "Safari",
      os: "iOS",
      screen: { width: 390, height: 844, pixelRatio: 3 },
      utm: { source: "instagram", medium: "social", campaign: "", term: "", content: "" },
    }),
  ];
  const restoreFind = stubMethod(userSessionModel, "find", () => createPopulateChain(sessions));
  const res = createMockResponse();

  try {
    await userSessionController.getAdminUserSessionSummary(createMockRequest(), res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.overview.totalSessions, 2);
    assert.equal(res.body.data.overview.loggedOutCount, 1);
    assert.equal(res.body.data.breakdowns.deviceTypes[0].count, 1);
  } finally {
    restoreFind();
  }
});
