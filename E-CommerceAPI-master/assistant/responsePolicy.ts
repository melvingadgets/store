import { extractExplicitProductName, isAvailabilityQuestion, isExactProductNameMatch } from "./productQueryRouting";
import { formatNaira } from "./productFoundation";
import type {
  AssistantConfidence,
  AssistantHandoffPayload,
  AssistantIntent,
  AssistantQuickReply,
  AssistantResponseKind,
  AssistantResponsePayload,
  AssistantUserContext,
} from "./assistantTypes";

const ADMIN_PHONE = "+2347086758713";

const PRODUCT_TOOL_NAMES = new Set([
  "search_products",
  "get_product_details",
  "get_product_pricing_options",
  "compare_products",
  "find_best_match_product",
  "check_product_availability",
]);

const SWAP_TOOL_NAMES = new Set([
  "evaluate_swap",
  "get_swap_requirements",
  "estimate_swap_from_partial_info",
  "explain_swap_result",
  "get_swap_eligible_models",
  "get_swap_policy_info",
]);

const unsupportedActionPattern =
  /\b(cancel|refund|return|change|update|edit|modify|delete|remove|reschedule|track|deliver|shipping|address|checkout|pay|payment|monthly|installment|loan|speak to|talk to|call|whatsapp)\b/i;

const swapIntentPattern = /\b(trade[\s-]?in|swap|exchange my phone|exchange this phone)\b/i;
const productIntentPattern =
  /\b(price|cost|how much|stock|available|availability|storage|capacity|spec|specs|details|compare|which phone|find a phone|product)\b/i;

type ToolExecution = {
  name: string;
  ok: boolean;
  data?: unknown;
  error?: string;
};

const createQuickReply = (label: string, message = label): AssistantQuickReply => ({
  label,
  message,
});

const createHandoff = (reason: string): AssistantHandoffPayload => ({
  title: "Contact admin",
  reason,
  contactLabel: "Admin",
  contactValue: ADMIN_PHONE,
});

const detectLikelyIntent = ({
  message,
  userContext,
  usedToolNames,
}: {
  message: string;
  userContext?: AssistantUserContext;
  usedToolNames: string[];
}): AssistantIntent => {
  if (usedToolNames.some((name) => SWAP_TOOL_NAMES.has(name)) || swapIntentPattern.test(message)) {
    return "trade_in";
  }

  if (
    usedToolNames.some((name) => PRODUCT_TOOL_NAMES.has(name))
    || Boolean(userContext?.productId)
    || Boolean(userContext?.productName)
    || productIntentPattern.test(message)
  ) {
    return "product";
  }

  return "general";
};

const createBaseResponse = ({
  sessionId,
  reply,
  intent,
  usedTools,
  confidence,
  kind,
  quickReplies,
  handoff,
}: AssistantResponsePayload): AssistantResponsePayload => ({
  sessionId,
  reply,
  intent,
  usedTools,
  confidence,
  kind,
  quickReplies,
  handoff,
});

const getSuccessfulTool = (executions: ToolExecution[], names: string[]) =>
  [...executions].reverse().find((execution) => execution.ok && names.includes(execution.name));

const asRecord = (value: unknown): Record<string, unknown> => (value && typeof value === "object" ? (value as Record<string, unknown>) : {});

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const asNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

const buildProductReply = ({
  execution,
  message,
  sessionId,
  usedTools,
}: {
  execution: ToolExecution;
  message: string;
  sessionId: string;
  usedTools: Array<{ name: string; ok: boolean }>;
}): AssistantResponsePayload | null => {
  const data = asRecord(execution.data);

  if (execution.name === "get_product_pricing_options") {
    const pricingOptions = asArray(data.pricingOptions);
    const requestedMatch = asRecord(data.requestedCapacityMatch);
    const reply = requestedMatch.capacity
      ? `${asString(data.name)} ${asString(requestedMatch.capacity)} is ${formatNaira(asNumber(requestedMatch.price))}. ${asNumber(requestedMatch.qty) > 0 ? "It is in stock now." : "It is not currently in stock."}`
      : `${asString(data.name)} starts at ${formatNaira(asNumber(data.basePrice))}. Available capacities: ${pricingOptions.map((option) => asString(asRecord(option).capacity)).filter(Boolean).join(", ") || "not listed yet"}.`;

    return createBaseResponse({
      sessionId,
      reply,
      intent: "product",
      usedTools,
      confidence: "high",
      kind: "product_answer",
      quickReplies: [
        createQuickReply("Check stock"),
        createQuickReply("Show storage prices"),
        createQuickReply("Estimate a swap for this phone"),
      ],
      handoff: null,
    });
  }

  if (execution.name === "check_product_availability") {
    return createBaseResponse({
      sessionId,
      reply: asString(data.summary) || "I checked availability for that product.",
      intent: "product",
      usedTools,
      confidence: "high",
      kind: "product_answer",
      quickReplies: [
        createQuickReply("Show storage prices"),
        createQuickReply("Explain this phone briefly"),
        createQuickReply("Estimate a swap for this phone"),
      ],
      handoff: null,
    });
  }

  if (execution.name === "get_product_details") {
    const capacities = asArray(data.capacities)
      .map((option) => asString(asRecord(option).capacity))
      .filter(Boolean);
    const reply = `${asString(data.name)} starts at ${formatNaira(asNumber(data.price))}. ${capacities.length ? `Capacities: ${capacities.join(", ")}.` : ""}`.trim();

    return createBaseResponse({
      sessionId,
      reply,
      intent: "product",
      usedTools,
      confidence: "high",
      kind: "product_answer",
      quickReplies: [
        createQuickReply("What storage options and prices are available?"),
        createQuickReply("Is it in stock?"),
        createQuickReply("Estimate a swap for this phone"),
      ],
      handoff: null,
    });
  }

  if (execution.name === "compare_products") {
    const comparison = asRecord(data.comparison);
    const highlights = asArray(comparison.highlights).map((item) => asString(item)).filter(Boolean);
    const reply = highlights[0] || "I compared those products using current store data.";

    return createBaseResponse({
      sessionId,
      reply,
      intent: "product",
      usedTools,
      confidence: "high",
      kind: "product_answer",
      quickReplies: [
        createQuickReply("Show storage prices"),
        createQuickReply("Check stock"),
      ],
      handoff: null,
    });
  }

  if (execution.name === "search_products") {
    const products = asArray(data.products).map((item) => asRecord(item));
    const explicitProductName = extractExplicitProductName(message);
    const exactProduct = explicitProductName
      ? products.find((item) => isExactProductNameMatch(asString(item.name), explicitProductName))
      : undefined;
    if (!products.length) {
      return createBaseResponse({
        sessionId,
        reply: "I did not find a direct product match. Which phone model should I check?",
        intent: "product",
        usedTools,
        confidence: "medium",
        kind: "clarifier",
        quickReplies: [
          createQuickReply("iPhone 13"),
          createQuickReply("iPhone 14"),
          createQuickReply("iPhone 15"),
        ],
        handoff: null,
      });
    }

    if (explicitProductName && !exactProduct && isAvailabilityQuestion(message)) {
      return createProductNotFoundResponse({
        sessionId,
        productName: explicitProductName,
        usedTools,
        alternatives: products.map((item) => asString(item.name)).filter(Boolean),
      });
    }

    const first = exactProduct ?? products[0];
    return createBaseResponse({
      sessionId,
      reply: `${asString(first.name)} is the closest match I found. It starts at ${formatNaira(asNumber(first.startingPrice))}.`,
      intent: "product",
      usedTools,
      confidence: "high",
      kind: "product_answer",
      quickReplies: [
        createQuickReply("Show storage prices"),
        createQuickReply("Is it in stock?"),
      ],
      handoff: null,
    });
  }

  if (execution.name === "find_best_match_product") {
    const results = asArray(data.results).map((item) => asRecord(item));
    if (!results.length) {
      return createBaseResponse({
        sessionId,
        reply: "I could not find a strong match from the current catalog. Contact admin for a manual recommendation.",
        intent: "product",
        usedTools,
        confidence: "low",
        kind: "handoff",
        quickReplies: undefined,
        handoff: createHandoff("No confident product match was found in the current catalog."),
      });
    }

    const best = results[0];
    return createBaseResponse({
      sessionId,
      reply: `${asString(best.name)} is the best current match I found. It starts at ${formatNaira(asNumber(best.startingPrice))}.`,
      intent: "product",
      usedTools,
      confidence: "high",
      kind: "product_answer",
      quickReplies: [
        createQuickReply("Check stock"),
        createQuickReply("Show storage prices"),
      ],
      handoff: null,
    });
  }

  return null;
};

const buildSwapReply = ({
  execution,
  sessionId,
  usedTools,
  userContext,
}: {
  execution: ToolExecution;
  sessionId: string;
  usedTools: Array<{ name: string; ok: boolean }>;
  userContext?: AssistantUserContext;
}): AssistantResponsePayload | null => {
  const data = asRecord(execution.data);

  if (execution.name === "estimate_swap_from_partial_info") {
    if (asString(data.status) === "needs_more_info") {
      const missingFields = asArray(data.missingRequiredFields).map((item) => asString(item));
      const quickReplies =
        missingFields[0] === "targetProductId" && userContext?.productId
          ? [createQuickReply("Use this phone as the one I want to buy")]
          : missingFields[0] === "tradeInStorage"
            ? [createQuickReply("64GB"), createQuickReply("128GB"), createQuickReply("256GB")]
            : missingFields[0] === "tradeInModel"
              ? [createQuickReply("iPhone 11"), createQuickReply("iPhone 12"), createQuickReply("iPhone 13")]
              : undefined;

      return createBaseResponse({
        sessionId,
        reply: asString(data.nextQuestion) || "I need one more detail before I can estimate that swap.",
        intent: "trade_in",
        usedTools,
        confidence: "medium",
        kind: "clarifier",
        quickReplies,
        handoff: null,
      });
    }

    return createBaseResponse({
      sessionId,
      reply:
        asString(data.summary) ||
        `Estimated trade-in credit ${formatNaira(asNumber(data.customerEstimateMin))} to ${formatNaira(asNumber(data.customerEstimateMax))}. Final value is confirmed after inspection.`,
      intent: "trade_in",
      usedTools,
      confidence: "high",
      kind: "swap_answer",
      quickReplies: [
        createQuickReply("What do I need for the swap?"),
        createQuickReply("Explain the estimate"),
      ],
      handoff: null,
    });
  }

  if (execution.name === "evaluate_swap" || execution.name === "explain_swap_result") {
    return createBaseResponse({
      sessionId,
      reply:
        asString(data.explanation) ||
        asString(data.summary) ||
        `Estimated trade-in credit ${formatNaira(asNumber(data.customerEstimateMin))} to ${formatNaira(asNumber(data.customerEstimateMax))}. Final value is confirmed after inspection.`,
      intent: "trade_in",
      usedTools,
      confidence: "high",
      kind: "swap_answer",
      quickReplies: [
        createQuickReply("What do I need for the swap?"),
        createQuickReply("Explain swap policy"),
      ],
      handoff: null,
    });
  }

  if (execution.name === "get_swap_requirements" || execution.name === "get_swap_policy_info") {
    const required = asArray(data.requiredFields ?? data.required).map((item) => asString(item)).filter(Boolean);
    const note = asString(data.note) || asString(data.summary);
    return createBaseResponse({
      sessionId,
      reply: `${required.length ? `I need ${required.slice(0, 3).join(", ")}.` : "I can help with the swap requirements."} ${note}`.trim(),
      intent: "trade_in",
      usedTools,
      confidence: "high",
      kind: "swap_answer",
      quickReplies: [
        createQuickReply("Estimate my swap"),
        createQuickReply("Explain swap policy"),
      ],
      handoff: null,
    });
  }

  if (execution.name === "get_swap_eligible_models") {
    const suggestions = asArray(data.suggestions).map((item) => asRecord(item));
    if (data.eligible === true) {
      return createBaseResponse({
        sessionId,
        reply: `${asString(data.model)} is eligible for trade-in. Supported capacities: ${asArray(data.capacities).map((item) => asString(item)).filter(Boolean).join(", ")}.`,
        intent: "trade_in",
        usedTools,
        confidence: "high",
        kind: "swap_answer",
        quickReplies: asArray(data.capacities).slice(0, 3).map((item) => createQuickReply(asString(item))),
        handoff: null,
      });
    }

    return createBaseResponse({
      sessionId,
      reply: suggestions.length
        ? `I did not get an exact eligible model match. Closest options: ${suggestions.map((item) => asString(item.model)).filter(Boolean).join(", ")}.`
        : "I could not confirm that model from the current eligible trade-in list.",
      intent: "trade_in",
      usedTools,
      confidence: suggestions.length ? "medium" : "low",
      kind: suggestions.length ? "clarifier" : "handoff",
      quickReplies: suggestions.slice(0, 3).map((item) => createQuickReply(asString(item.model))).filter((item) => item.label),
      handoff: suggestions.length ? null : createHandoff("The assistant could not confidently match that trade-in model."),
    });
  }

  return null;
};

export const createUnsupportedActionResponse = ({
  sessionId,
  usedTools,
}: {
  sessionId: string;
  usedTools: Array<{ name: string; ok: boolean }>;
}): AssistantResponsePayload =>
  createBaseResponse({
    sessionId,
    reply: `I can’t complete that action in this chat. Contact admin on ${ADMIN_PHONE}.`,
    intent: "unknown",
    usedTools,
    confidence: "low",
    kind: "handoff",
    quickReplies: undefined,
    handoff: createHandoff("This request needs manual help because the assistant does not have a tool for it."),
  });

export const createProductNotFoundResponse = ({
  sessionId,
  productName,
  usedTools,
  alternatives,
}: {
  sessionId: string;
  productName: string;
  usedTools: Array<{ name: string; ok: boolean }>;
  alternatives?: string[];
}): AssistantResponsePayload =>
  createBaseResponse({
    sessionId,
    reply: alternatives?.length
      ? `I could not find ${productName} in the current catalog. Closest alternatives I can check are ${alternatives.join(", ")}.`
      : `I could not find ${productName} in the current catalog.`,
    intent: "product",
    usedTools,
    confidence: "high",
    kind: "clarifier",
    quickReplies: alternatives?.slice(0, 3).map((name) => createQuickReply(name)),
    handoff: null,
  });

export const shouldDeclineUnsupportedAction = (message: string) => unsupportedActionPattern.test(message);

export const buildFinalAssistantResponse = ({
  sessionId,
  message,
  providerReply,
  providerIntent,
  usedTools,
  toolExecutions,
  userContext,
}: {
  sessionId: string;
  message: string;
  providerReply: string;
  providerIntent: AssistantIntent;
  usedTools: Array<{ name: string; ok: boolean }>;
  toolExecutions: ToolExecution[];
  userContext?: AssistantUserContext;
}): AssistantResponsePayload => {
  const usedToolNames = usedTools.filter((tool) => tool.ok).map((tool) => tool.name);
  const likelyIntent = detectLikelyIntent({
    message,
    userContext,
    usedToolNames,
  });
  const productExecution = getSuccessfulTool(toolExecutions, [...PRODUCT_TOOL_NAMES]);
  const swapExecution = getSuccessfulTool(toolExecutions, [...SWAP_TOOL_NAMES]);

  if (swapExecution) {
    const reply = buildSwapReply({
      execution: swapExecution,
      sessionId,
      usedTools,
      userContext,
    });
    if (reply) {
      return reply;
    }
  }

  if (productExecution) {
    const reply = buildProductReply({
      execution: productExecution,
      message,
      sessionId,
      usedTools,
    });
    if (reply) {
      return reply;
    }
  }

  if (providerIntent === "trade_in" || likelyIntent === "trade_in") {
    return createBaseResponse({
      sessionId,
      reply: userContext?.tradeInModel
        ? "What storage does your current iPhone have?"
        : userContext?.productId
          ? "What iPhone model are you trading in?"
        : `I need the phone you want to buy first. Contact admin on ${ADMIN_PHONE} if you want manual help now.`,
      intent: "trade_in",
      usedTools,
      confidence: userContext?.tradeInModel || userContext?.productId ? "medium" : "low",
      kind: userContext?.tradeInModel || userContext?.productId ? "clarifier" : "handoff",
      quickReplies: userContext?.tradeInModel
        ? [createQuickReply("64GB"), createQuickReply("128GB"), createQuickReply("256GB")]
        : userContext?.productId
          ? [createQuickReply("iPhone 11"), createQuickReply("iPhone 12"), createQuickReply("iPhone 13")]
        : undefined,
      handoff: userContext?.tradeInModel || userContext?.productId ? null : createHandoff("The assistant could not choose a safe swap tool path."),
    });
  }

  if (providerIntent === "product" || likelyIntent === "product") {
    return createBaseResponse({
      sessionId,
      reply: userContext?.productId || userContext?.productName
        ? "Do you want the price, stock status, or storage options for this phone?"
        : "Which phone model should I check for you?",
      intent: "product",
      usedTools,
      confidence: "medium",
      kind: "clarifier",
      quickReplies: userContext?.productId || userContext?.productName
        ? [
            createQuickReply("What is the price?"),
            createQuickReply("Is it in stock?"),
            createQuickReply("Show storage options"),
          ]
        : [createQuickReply("iPhone 13"), createQuickReply("iPhone 14"), createQuickReply("iPhone 15")],
      handoff: null,
    });
  }

  return createBaseResponse({
    sessionId,
    reply: providerReply,
    intent: providerIntent === "unknown" ? likelyIntent : providerIntent,
    usedTools,
    confidence: usedToolNames.length ? "high" : "medium",
    kind: "general_answer",
    quickReplies: undefined,
    handoff: null,
  });
};
