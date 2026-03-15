const test = require("node:test");
const assert = require("node:assert/strict");

const assistantController = require("../dist/controller/assistantController");
const assistantServiceModule = require("../dist/assistant/assistantService");
const telemetryModule = require("../dist/assistant/timingTelemetry");
const {
  createMockRequest,
  createMockResponse,
  stubMethod,
} = require("./helpers/testUtils");

test("assistantMessage validates that a message is provided", async () => {
  const req = createMockRequest({
    body: {
      message: "   ",
    },
  });
  const res = createMockResponse();

  await assistantController.assistantMessage(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, "message is required");
});

test("assistantMessage delegates to the assistant service and returns the response payload", async () => {
  const restoreHandleMessage = stubMethod(
    assistantServiceModule.assistantService,
    "handleMessage",
    async () => ({
      sessionId: "session-1",
      reply: "Here is the answer.",
      intent: "product",
      usedTools: [{ name: "get_product_details", ok: true }],
    }),
  );
  const req = createMockRequest({
    body: {
      sessionId: " session-1 ",
      message: "Tell me about this phone",
      userContext: {
        productId: "prod-1",
        route: "/products/prod-1",
      },
    },
    user: {
      _id: "user-1",
    },
  });
  const res = createMockResponse();

  try {
    await assistantController.assistantMessage(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, 1);
    assert.deepEqual(res.body.data, {
      sessionId: "session-1",
      reply: "Here is the answer.",
      intent: "product",
      usedTools: [{ name: "get_product_details", ok: true }],
    });
  } finally {
    restoreHandleMessage();
  }
});

test("assistantTimingSummary returns the aggregated telemetry payload", () => {
  const restoreSummary = stubMethod(
    telemetryModule,
    "getAssistantTimingSummary",
    () => ({
      overview: {
        totalRequests: 3,
        avgTotalMs: 420.5,
        p95TotalMs: 800,
        maxTotalMs: 900,
        modelCount: 2,
        fallbackCount: 1,
      },
      stageHierarchy: [],
      recentSlowRequests: [],
    }),
  );
  const req = createMockRequest();
  const res = createMockResponse();

  try {
    assistantController.assistantTimingSummary(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, 1);
    assert.equal(res.body.data.overview.totalRequests, 3);
  } finally {
    restoreSummary();
  }
});
