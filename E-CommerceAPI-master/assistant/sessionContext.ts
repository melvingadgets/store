import type { AssistantToolCall, AssistantToolResult, AssistantUserContext } from "./assistantTypes";

const cleanString = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);
const asRecord = (value: unknown): Record<string, unknown> => (value && typeof value === "object" ? (value as Record<string, unknown>) : {});
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const assignIfPresent = (target: Record<string, string | undefined>, key: string, value: unknown) => {
  const cleaned = cleanString(value);
  if (cleaned) {
    target[key] = cleaned;
  }
};

export const normalizeAssistantUserContext = (value?: AssistantUserContext | null): AssistantUserContext => ({
  ...(cleanString(value?.productId) ? { productId: cleanString(value?.productId) } : {}),
  ...(cleanString(value?.productName) ? { productName: cleanString(value?.productName) } : {}),
  ...(cleanString(value?.productCapacity) ? { productCapacity: cleanString(value?.productCapacity) } : {}),
  ...(cleanString(value?.route) ? { route: cleanString(value?.route) } : {}),
  ...(cleanString(value?.tradeInModel) ? { tradeInModel: cleanString(value?.tradeInModel) } : {}),
  ...(cleanString(value?.tradeInStorage) ? { tradeInStorage: cleanString(value?.tradeInStorage) } : {}),
});

export const mergeAssistantUserContext = ({
  persisted,
  incoming,
}: {
  persisted?: AssistantUserContext | null;
  incoming?: AssistantUserContext | null;
}): AssistantUserContext => {
  const base = normalizeAssistantUserContext(persisted);
  const override = normalizeAssistantUserContext(incoming);

  return {
    productId: override.productId ?? base.productId,
    productName: override.productName ?? base.productName,
    productCapacity: override.productCapacity ?? base.productCapacity,
    route: override.route ?? base.route,
    tradeInModel: override.tradeInModel ?? base.tradeInModel,
    tradeInStorage: override.tradeInStorage ?? base.tradeInStorage,
  };
};

export const updateAssistantUserContextFromTool = ({
  current,
  toolCall,
  toolResult,
}: {
  current?: AssistantUserContext | null;
  toolCall: AssistantToolCall;
  toolResult: AssistantToolResult;
}): AssistantUserContext => {
  const next = { ...normalizeAssistantUserContext(current) };
  const args = asRecord(toolCall.arguments);
  const data = asRecord(toolResult.data);

  if (toolCall.name === "get_product_details") {
    assignIfPresent(next, "productId", data.productId ?? args.productId);
    assignIfPresent(next, "productName", data.name ?? args.productName);
    return next;
  }

  if (toolCall.name === "check_product_availability") {
    const requestedCapacityMatch = asRecord(data.requestedCapacityMatch);
    assignIfPresent(next, "productId", data.productId ?? args.productId);
    assignIfPresent(next, "productName", data.name ?? args.productName);
    assignIfPresent(next, "productCapacity", requestedCapacityMatch.capacity ?? data.requestedCapacity ?? args.capacity);
    return next;
  }

  if (toolCall.name === "search_products") {
    const firstProduct = asRecord(asArray(data.products)[0]);
    assignIfPresent(next, "productId", firstProduct.productId);
    assignIfPresent(next, "productName", firstProduct.name);
    return next;
  }

  if (toolCall.name === "estimate_swap") {
    const collected = asRecord(data.collected);
    assignIfPresent(next, "productId", args.targetProductId ?? collected.targetProductId ?? current?.productId);
    assignIfPresent(next, "productCapacity", args.targetCapacity);
    assignIfPresent(next, "tradeInModel", args.tradeInModel ?? collected.tradeInModel);
    assignIfPresent(next, "tradeInStorage", args.tradeInStorage ?? collected.tradeInStorage);
    return next;
  }

  return next;
};
