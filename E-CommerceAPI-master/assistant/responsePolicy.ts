import type {
  AssistantConfidence,
  AssistantIntent,
  AssistantResponseKind,
  AssistantResponsePayload,
  AssistantUserContext,
} from "./assistantTypes";

const ADMIN_PHONE = "+2347086758713";

const PRODUCT_TOOL_NAMES = new Set([
  "search_products",
  "get_product_details",
  "check_product_availability",
]);

const SWAP_TOOL_NAMES = new Set([
  "get_swap_requirements",
  "estimate_swap",
]);

const unsupportedActionPattern =
  /\b(cancel|refund|return|change|update|edit|modify|delete|remove|reschedule|track|deliver|shipping|address|checkout|pay|payment|monthly|installment|loan|speak to|talk to|call|whatsapp)\b/i;

const unsupportedCapabilityReplyPattern =
  /\b(notify|notification|alert|used units?|used device|reserve|hold for you|place (?:an )?order|process payment|monthly plan|installment plan|loan approval)\b/i;

const swapIntentPattern = /\b(trade[\s-]?in|swap|exchange my phone|exchange this phone)\b/i;
const productIntentPattern =
  /\b(price|cost|how much|stock|available|availability|storage|capacity|spec|specs|details|compare|which phone|find a phone|product)\b/i;

const clarifierPattern =
  /\?\s*$|^(which|what|when|where|who|how|do you|would you|can you|could you|tell me|please share)\b/i;

const handoffPattern = /\bcontact admin|admin on \+?\d+|manual help\b/i;

const detectLikelyIntent = ({
  message,
  providerIntent,
  userContext,
  usedToolNames,
}: {
  message: string;
  providerIntent: AssistantIntent;
  userContext?: AssistantUserContext;
  usedToolNames: string[];
}): AssistantIntent => {
  if (providerIntent !== "unknown") {
    return providerIntent;
  }

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

const classifyReplyKind = ({
  reply,
  intent,
}: {
  reply: string;
  intent: AssistantIntent;
}): AssistantResponseKind => {
  if (handoffPattern.test(reply)) {
    return "handoff";
  }

  if (clarifierPattern.test(reply.trim())) {
    return "clarifier";
  }

  if (intent === "trade_in") {
    return "swap_answer";
  }

  if (intent === "product") {
    return "product_answer";
  }

  return "general_answer";
};

const classifyConfidence = ({
  kind,
  intent,
  usedToolNames,
}: {
  kind: AssistantResponseKind;
  intent: AssistantIntent;
  usedToolNames: string[];
}): AssistantConfidence => {
  if (kind === "handoff") {
    return "low";
  }

  if (intent === "product" && usedToolNames.some((name) => PRODUCT_TOOL_NAMES.has(name))) {
    return "high";
  }

  if (intent === "trade_in" && usedToolNames.some((name) => SWAP_TOOL_NAMES.has(name))) {
    return "high";
  }

  return "medium";
};

export const shouldDeclineUnsupportedAction = (message: string) => unsupportedActionPattern.test(message);

export const validateFinalAssistantReply = ({
  message,
  providerReply,
  providerIntent,
  usedTools,
  userContext,
}: {
  message: string;
  providerReply: string;
  providerIntent: AssistantIntent;
  usedTools: Array<{ name: string; ok: boolean }>;
  userContext?: AssistantUserContext;
}) => {
  const usedToolNames = usedTools.filter((tool) => tool.ok).map((tool) => tool.name);
  const intent = detectLikelyIntent({
    message,
    providerIntent,
    userContext,
    usedToolNames,
  });
  const kind = classifyReplyKind({
    reply: providerReply,
    intent,
  });

  if (unsupportedCapabilityReplyPattern.test(providerReply)) {
    return {
      ok: false,
      retryInstruction:
        `Your last reply offered unsupported actions. Do not offer notifications, used-device checks, reservations, orders, payments, or installment handling unless a matching tool exists and you used it. ` +
        `If no supported tool can help, tell the user to contact admin on ${ADMIN_PHONE}.`,
    };
  }

  if (intent === "product" && kind === "product_answer" && !usedToolNames.some((name) => PRODUCT_TOOL_NAMES.has(name))) {
    return {
      ok: false,
      retryInstruction:
        "Your last reply made a factual product claim without using a product tool. Use an appropriate product tool first, then answer using the tool result. If no tool can safely answer, hand off to admin.",
    };
  }

  if (intent === "trade_in" && kind === "swap_answer" && !usedToolNames.some((name) => SWAP_TOOL_NAMES.has(name))) {
    return {
      ok: false,
      retryInstruction:
        "Your last reply made a factual swap claim without using a swap tool. Use an appropriate swap tool first, then answer using the tool result. If no tool can safely answer, hand off to admin.",
    };
  }

  if (shouldDeclineUnsupportedAction(message) && kind !== "handoff") {
    return {
      ok: false,
      retryInstruction: `This request is outside supported assistant actions. Tell the user to contact admin on ${ADMIN_PHONE}.`,
    };
  }

  return {
    ok: true,
  };
};

export const buildFinalAssistantResponse = ({
  sessionId,
  message,
  providerReply,
  providerIntent,
  usedTools,
  userContext,
}: {
  sessionId: string;
  message: string;
  providerReply: string;
  providerIntent: AssistantIntent;
  usedTools: Array<{ name: string; ok: boolean }>;
  userContext?: AssistantUserContext;
}): AssistantResponsePayload => {
  const usedToolNames = usedTools.filter((tool) => tool.ok).map((tool) => tool.name);
  const intent = detectLikelyIntent({
    message,
    providerIntent,
    userContext,
    usedToolNames,
  });
  const kind = classifyReplyKind({
    reply: providerReply,
    intent,
  });

  return {
    sessionId,
    reply: providerReply,
    intent,
    usedTools,
    confidence: classifyConfidence({
      kind,
      intent,
      usedToolNames,
    }),
    kind,
    quickReplies: undefined,
    handoff: null,
  };
};
