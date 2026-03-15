const test = require("node:test");
const assert = require("node:assert/strict");

const {
  clearAssistantTimingSummary,
  getAssistantTimingSummary,
  recordAssistantTiming,
} = require("../dist/assistant/timingTelemetry");

test("assistant timing telemetry groups marks into hierarchy and overview", () => {
  clearAssistantTimingSummary();

  recordAssistantTiming({
    sessionId: "session-1",
    intent: "product",
    source: "model",
    usedTools: ["search_products"],
    totalMs: 500,
    marks: [
      { stage: "session_lookup", durationMs: 20 },
      { stage: "provider_ready", durationMs: 5 },
      { stage: "provider_turn_1", durationMs: 320 },
      { stage: "tool_search_products", durationMs: 95 },
      { stage: "session_save", durationMs: 50 },
    ],
  });

  recordAssistantTiming({
    sessionId: "session-2",
    intent: "trade_in",
    source: "fallback",
    usedTools: ["get_swap_requirements"],
    totalMs: 120,
    marks: [
      { stage: "session_lookup", durationMs: 15 },
      { stage: "provider_ready", durationMs: 40 },
      { stage: "session_save", durationMs: 35 },
    ],
  });

  const summary = getAssistantTimingSummary();

  assert.equal(summary.overview.totalRequests, 2);
  assert.equal(summary.overview.modelCount, 1);
  assert.equal(summary.overview.fallbackCount, 1);
  assert.ok(summary.stageHierarchy.some((entry) => entry.key === "model"));
  assert.ok(summary.stageHierarchy.some((entry) => entry.key === "tools"));
  assert.equal(summary.recentSlowRequests[0].sessionId, "session-1");

  clearAssistantTimingSummary();
});
