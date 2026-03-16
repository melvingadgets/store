const test = require("node:test");
const assert = require("node:assert/strict");

const { createAssistantService } = require("../dist/assistant/assistantService");
const { createDocument } = require("./helpers/testUtils");

const createSessionStore = ({ existingSession } = {}) => {
  const state = {
    findCalls: [],
    createCalls: [],
    createdSession: null,
  };

  return {
    state,
    model: {
      findOne: async (query) => {
        state.findCalls.push(query);
        return existingSession ?? null;
      },
      create: async (payload) => {
        state.createCalls.push(payload);
        state.createdSession = createDocument({
          ...payload,
          messages: payload.messages ?? [],
          toolCalls: payload.toolCalls ?? [],
        });
        return state.createdSession;
      },
    },
  };
};

test("assistantService creates a new session when sessionId is absent", async () => {
  const sessionStore = createSessionStore();
  const providerCalls = [];
  const service = createAssistantService({
    provider: {
      run: async (input) => {
        providerCalls.push(input);
        return {
          type: "final",
          reply: "How can I help?",
          intent: "general",
        };
      },
    },
    sessionModel: sessionStore.model,
    registry: {
      listTools: () => [],
      executeToolCall: async () => ({ ok: false, error: "unused" }),
    },
  });

  const result = await service.handleMessage({
    message: "Hi there",
  });

  assert.equal(sessionStore.state.findCalls.length, 0);
  assert.equal(sessionStore.state.createCalls.length, 1);
  assert.equal(result.reply, "How can I help?");
  assert.equal(result.intent, "general");
  assert.equal(result.kind, "clarifier");
  assert.equal(result.confidence, "medium");
  assert.equal(typeof result.sessionId, "string");
  assert.equal(providerCalls.length, 1);
  assert.equal(sessionStore.state.createdSession.messages.length, 2);
  assert.equal(sessionStore.state.createdSession.saveCallCount, 1);
});

test("assistantService reuses an existing session when sessionId is present", async () => {
  const existingSession = createDocument({
    sessionId: "session-1",
    messages: [{ role: "assistant", content: "Earlier reply" }],
    toolCalls: [],
    intent: "unknown",
    context: {
      productId: "prod-1",
      productName: "iPhone 15",
      route: "/product/prod-1",
    },
  });
  const sessionStore = createSessionStore({ existingSession });
  const providerCalls = [];
  const service = createAssistantService({
    provider: {
      run: async (input) => {
        providerCalls.push(input);
        return {
          type: "final",
          reply: "Do you want the price, stock status, or storage options for this phone?",
          intent: "product",
        };
      },
    },
    sessionModel: sessionStore.model,
    registry: {
      listTools: () => [],
      executeToolCall: async () => ({ ok: false, error: "unused" }),
    },
  });

  const result = await service.handleMessage({
    sessionId: "session-1",
    message: "Tell me more",
    userId: "user-1",
  });

  assert.deepEqual(sessionStore.state.findCalls, [{ sessionId: "session-1", userId: "user-1" }]);
  assert.equal(sessionStore.state.createCalls.length, 0);
  assert.equal(result.sessionId, "session-1");
  assert.equal(result.intent, "product");
  assert.equal(result.kind, "clarifier");
  assert.equal(providerCalls[0].messages[0].content, "Earlier reply");
  assert.equal(existingSession.saveCallCount, 1);
});

test("assistantService merges persisted session context into the next tool call and refreshes working memory", async () => {
  const existingSession = createDocument({
    sessionId: "session-2",
    messages: [{ role: "assistant", content: "We were discussing that phone." }],
    toolCalls: [],
    intent: "product",
    context: {
      productId: "prod-9",
      productName: "iPhone 15 Pro",
      route: "/product/prod-9",
    },
  });
  const registryCalls = [];
  let providerTurn = 0;
  const service = createAssistantService({
    provider: {
      run: async () => {
        providerTurn += 1;

        if (providerTurn === 1) {
          return {
            type: "tool_calls",
            toolCalls: [
              {
                id: "tool-1",
                name: "check_product_availability",
                arguments: { capacity: "128GB" },
              },
            ],
          };
        }

        return {
          type: "final",
          reply: "Here is the updated pricing.",
          intent: "product",
        };
      },
    },
    sessionModel: createSessionStore({ existingSession }).model,
    registry: {
      listTools: () => [{ name: "check_product_availability", description: "", parameters: {} }],
      executeToolCall: async (input) => {
        registryCalls.push(input);
        return {
          ok: true,
          data: {
            productId: "prod-9",
            name: "iPhone 15 Pro",
            requestedCapacity: "128GB",
            requestedCapacityMatch: {
              capacity: "128GB",
              price: 1550000,
              qty: 2,
            },
            summary: "iPhone 15 Pro 128GB is currently available.",
          },
        };
      },
    },
  });

  const result = await service.handleMessage({
    sessionId: "session-2",
    message: "What about 128GB?",
    userId: "user-1",
  });

  assert.equal(result.intent, "product");
  assert.equal(registryCalls.length, 1);
  assert.equal(registryCalls[0].name, "check_product_availability");
  assert.deepEqual(registryCalls[0].arguments, { capacity: "128GB" });
  assert.equal(registryCalls[0].userContext.productId, "prod-9");
  assert.equal(registryCalls[0].userContext.productName, "iPhone 15 Pro");
  assert.equal(registryCalls[0].userContext.route, "/product/prod-9");
  assert.equal(registryCalls[0].userId, "user-1");
  assert.equal(existingSession.context.productId, "prod-9");
  assert.equal(existingSession.context.productName, "iPhone 15 Pro");
  assert.equal(existingSession.context.productCapacity, "128GB");
});

test("assistantService creates a new session when the provided sessionId belongs to another user", async () => {
  const foreignSession = createDocument({
    sessionId: "session-1",
    userId: "user-2",
    messages: [],
    toolCalls: [],
    intent: "unknown",
  });
  const state = {
    findCalls: [],
    createCalls: [],
    createdSession: null,
  };
  const sessionModel = {
    findOne: async (query) => {
      state.findCalls.push(query);

      if (query.sessionId === "session-1" && query.userId === "user-1") {
        return null;
      }

      if (query.sessionId === "session-1" && !query.userId) {
        return foreignSession;
      }

      return null;
    },
    create: async (payload) => {
      state.createCalls.push(payload);
      state.createdSession = createDocument({
        ...payload,
        messages: payload.messages ?? [],
        toolCalls: payload.toolCalls ?? [],
      });
      return state.createdSession;
    },
  };
  const service = createAssistantService({
    provider: {
      run: async () => ({
        type: "final",
        reply: "Fresh session reply",
        intent: "general",
      }),
    },
    sessionModel,
    registry: {
      listTools: () => [],
      executeToolCall: async () => ({ ok: false, error: "unused" }),
    },
  });

  const result = await service.handleMessage({
    sessionId: "session-1",
    message: "Hi",
    userId: "user-1",
  });

  assert.deepEqual(state.findCalls, [
    { sessionId: "session-1", userId: "user-1" },
    { sessionId: "session-1" },
  ]);
  assert.equal(state.createCalls.length, 1);
  assert.equal(state.createCalls[0].userId, "user-1");
  assert.notEqual(result.sessionId, "session-1");
});

test("assistantService handles a tool call and persists the result", async () => {
  const sessionStore = createSessionStore();
  let providerTurn = 0;
  const registryCalls = [];
  const service = createAssistantService({
    provider: {
      run: async () => {
        providerTurn += 1;

        if (providerTurn === 1) {
          return {
            type: "tool_calls",
            toolCalls: [
              {
                id: "tool-1",
                name: "estimate_swap",
                arguments: { tradeInModel: "iPhone 13" },
              },
            ],
          };
        }

        return {
          type: "final",
          reply: "Your estimated trade-in credit is ready.",
          intent: "trade_in",
        };
      },
    },
    sessionModel: sessionStore.model,
    registry: {
      listTools: () => [{ name: "estimate_swap", description: "", parameters: {} }],
      executeToolCall: async (input) => {
        registryCalls.push(input);
        return {
          ok: true,
          data: {
            status: "ready",
            customerEstimateMin: 500,
            customerEstimateMax: 550,
            collected: {
              targetProductId: "target-1",
              tradeInModel: "iPhone 13",
            },
          },
        };
      },
    },
  });

  const result = await service.handleMessage({
    message: "Please calculate this based on the details provided.",
    userContext: {
      productId: "target-1",
    },
  });

  assert.equal(result.intent, "trade_in");
  assert.equal(result.kind, "swap_answer");
  assert.equal(result.confidence, "high");
  assert.deepEqual(result.usedTools, [{ name: "estimate_swap", ok: true }]);
  assert.equal(registryCalls.length, 1);
  assert.equal(registryCalls[0].name, "estimate_swap");
  assert.deepEqual(registryCalls[0].arguments, { tradeInModel: "iPhone 13" });
  assert.equal(registryCalls[0].userContext.productId, "target-1");
  assert.equal(sessionStore.state.createdSession.toolCalls.length, 1);
  assert.match(sessionStore.state.createdSession.toolCalls[0].resultSummary, /customerEstimateMin/);
});

test("assistantService uses remembered swap context to continue the clarifier flow", async () => {
  const existingSession = createDocument({
    sessionId: "session-3",
    messages: [{ role: "assistant", content: "You want to trade in for that phone." }],
    toolCalls: [],
    intent: "trade_in",
    context: {
      productId: "target-1",
      tradeInModel: "iPhone 12",
      route: "/product/target-1",
    },
  });
  const service = createAssistantService({
    provider: {
      run: async () => ({
        type: "final",
        reply: "What storage does your current iPhone have?",
        intent: "trade_in",
      }),
    },
    sessionModel: createSessionStore({ existingSession }).model,
    registry: {
      listTools: () => [],
      executeToolCall: async () => ({ ok: false, error: "unused" }),
    },
  });

  const result = await service.handleMessage({
    sessionId: "session-3",
    message: "Yes",
    userId: "user-1",
  });

  assert.equal(result.intent, "trade_in");
  assert.equal(result.kind, "clarifier");
  assert.equal(result.reply, "What storage does your current iPhone have?");
});

test("assistantService requires the model to choose product availability tools", async () => {
  const sessionStore = createSessionStore();
  let providerTurn = 0;
  const registryCalls = [];
  const service = createAssistantService({
    provider: {
      run: async () => {
        providerTurn += 1;
        if (providerTurn === 1) {
          return {
            type: "tool_calls",
            toolCalls: [
              {
                id: "tool-1",
                name: "check_product_availability",
                arguments: { productName: "iPhone 16" },
              },
            ],
          };
        }

        return {
          type: "final",
          reply: "iPhone 16 is currently available.",
          intent: "product",
        };
      },
    },
    sessionModel: sessionStore.model,
    registry: {
      listTools: () => [{ name: "check_product_availability", description: "", parameters: {} }],
      executeToolCall: async (input) => {
        registryCalls.push(input);
        return {
          ok: true,
          data: {
            productId: "prod-16",
            name: "iPhone 16",
            summary: "iPhone 16 is currently available.",
          },
        };
      },
    },
  });

  const result = await service.handleMessage({
    message: "Is iPhone 16 available?",
  });

  assert.equal(providerTurn, 2);
  assert.equal(registryCalls.length, 1);
  assert.equal(registryCalls[0].name, "check_product_availability");
  assert.deepEqual(registryCalls[0].arguments, { productName: "iPhone 16" });
  assert.equal(result.intent, "product");
  assert.equal(result.reply, "iPhone 16 is currently available.");
});

test("assistantService rejects ungrounded product answers and retries through a tool", async () => {
  const sessionStore = createSessionStore();
  let providerTurn = 0;
  const registryCalls = [];
  const service = createAssistantService({
    provider: {
      run: async () => {
        providerTurn += 1;

        if (providerTurn === 1) {
          return {
            type: "final",
            reply: "I can't find the iPhone 16 in our current inventory.",
            intent: "product",
          };
        }

        if (providerTurn === 2) {
          return {
            type: "tool_calls",
            toolCalls: [
              {
                id: "tool-1",
                name: "check_product_availability",
                arguments: { productName: "iPhone 16" },
              },
            ],
          };
        }

        return {
          type: "final",
          reply: "I checked the current catalog and I could not find iPhone 16. Contact admin on +2347086758713 if you want manual help.",
          intent: "product",
        };
      },
    },
    sessionModel: sessionStore.model,
    registry: {
      listTools: () => [{ name: "check_product_availability", description: "", parameters: {} }],
      executeToolCall: async (input) => {
        registryCalls.push(input);
        return {
          ok: false,
          error: "Product not found.",
        };
      },
    },
  });

  const result = await service.handleMessage({
    message: "Is iPhone 16 available?",
  });

  assert.equal(providerTurn, 3);
  assert.equal(registryCalls.length, 1);
  assert.equal(result.intent, "product");
  assert.equal(result.kind, "handoff");
  assert.match(result.reply, /could not find iPhone 16/i);
});

test("assistantService supports multiple tool calls before a final reply", async () => {
  const sessionStore = createSessionStore();
  let providerTurn = 0;
  const toolNames = [];
  const service = createAssistantService({
    provider: {
      run: async () => {
        providerTurn += 1;

        if (providerTurn === 1) {
          return {
            type: "tool_calls",
            toolCalls: [
              { id: "tool-1", name: "search_products", arguments: { query: "iPhone 15" } },
              { id: "tool-2", name: "get_product_details", arguments: { productId: "prod-1" } },
            ],
          };
        }

        return {
          type: "final",
          reply: "I found a matching iPhone 15 and its details.",
          intent: "product",
        };
      },
    },
    sessionModel: sessionStore.model,
    registry: {
      listTools: () => [
        { name: "search_products", description: "", parameters: {} },
        { name: "get_product_details", description: "", parameters: {} },
      ],
      executeToolCall: async ({ name }) => {
        toolNames.push(name);
        return {
          ok: true,
          data: { name },
        };
      },
    },
  });

  const result = await service.handleMessage({
    message: "Tell me about iPhone 15",
  });

  assert.equal(result.intent, "product");
  assert.equal(result.kind, "product_answer");
  assert.deepEqual(toolNames, ["search_products", "get_product_details"]);
  assert.deepEqual(result.usedTools, [
    { name: "search_products", ok: true },
    { name: "get_product_details", ok: true },
  ]);
  assert.equal(sessionStore.state.createdSession.toolCalls.length, 2);
});

test("assistantService returns a fallback reply when the provider fails", async () => {
  const sessionStore = createSessionStore();
  const service = createAssistantService({
    provider: {
      run: async () => {
        throw new Error("provider failed");
      },
    },
    sessionModel: sessionStore.model,
    registry: {
      listTools: () => [],
      executeToolCall: async () => ({ ok: false, error: "unused" }),
    },
  });

  const result = await service.handleMessage({
    message: "Need help",
  });

  assert.equal(
    result.reply,
    "I can't answer that confidently right now. Contact admin on +2347086758713.",
  );
  assert.equal(result.intent, "unknown");
  assert.equal(result.kind, "handoff");
  assert.equal(result.confidence, "low");
  assert.equal(sessionStore.state.createdSession.messages.at(-1).content, result.reply);
  assert.equal(sessionStore.state.createdSession.saveCallCount, 1);
});
