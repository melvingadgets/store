import categoryModel from "../model/categoryModel";
import productModel from "../model/productModel";
import {
  defaultSwapConditionSelections,
  resolveSwapConditionSelections,
  type SwapConditionSelections,
} from "../data/swapConditionConfig";
import { resolveSwapEvaluationRequest } from "../utils/swapResolver";
import { SimpleTtlCache } from "../utils/simpleTtlCache";
import type { AssistantToolRegistry } from "./assistantTypes";
import {
  buildAvailabilityDetails,
  buildBestMatchResults,
  buildPricingOptions,
  buildProductComparison,
  extractString,
  fetchProductById,
  listProducts,
  resolveProductReference,
  searchProducts,
  toProductDetail,
  toProductListItem,
} from "./productFoundation";
import {
  buildSwapConditionOptions,
  buildSwapExplanation,
  buildSwapPolicyInfo,
  buildSwapRequirements,
  buildSwapSummary,
  findEligibleSwapModels,
  resolvePartialSwapInputs,
} from "./swapFoundation";

const summarizeData = (value: unknown) => {
  const serialized = JSON.stringify(value);
  return serialized.length > 220 ? `${serialized.slice(0, 217)}...` : serialized;
};

const toolResultCache = new SimpleTtlCache<string, { ok: boolean; data?: unknown; error?: string }>(60 * 1000, 250);
const cacheableToolNames = new Set([
  "evaluate_swap",
  "search_products",
  "get_product_details",
  "get_product_pricing_options",
  "compare_products",
  "find_best_match_product",
  "check_product_availability",
  "get_swap_requirements",
  "estimate_swap_from_partial_info",
  "explain_swap_result",
  "get_swap_eligible_models",
  "get_swap_policy_info",
]);

const stableSerialize = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  const objectValue = value as Record<string, unknown>;
  return `{${Object.keys(objectValue)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(objectValue[key])}`)
    .join(",")}}`;
};

const extractNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = Number(value.replace(/[, ]+/g, ""));
    return Number.isFinite(normalized) ? normalized : undefined;
  }

  return undefined;
};

const resolveSwapSelections = (toolArguments: Record<string, unknown>) =>
  resolveSwapConditionSelections(
    (toolArguments.conditionSelections as Partial<SwapConditionSelections> | undefined) ?? defaultSwapConditionSelections,
  );

const resolveSwapToolPayload = ({
  toolArguments,
  userContext,
}: {
  toolArguments: Record<string, unknown>;
  userContext?: { productId?: string };
}) => {
  const targetProductId = extractString(toolArguments.targetProductId) || extractString(userContext?.productId);
  const targetCapacity = extractString(toolArguments.targetCapacity) || undefined;
  const tradeInModel = extractString(toolArguments.tradeInModel);
  const tradeInStorage = extractString(toolArguments.tradeInStorage);
  const conditionSelections = resolveSwapSelections(toolArguments);

  return {
    targetProductId,
    targetCapacity,
    tradeInModel,
    tradeInStorage,
    conditionSelections,
  };
};

const buildToolCacheKey = ({
  name,
  toolArguments,
  userContext,
}: {
  name: string;
  toolArguments: Record<string, unknown>;
  userContext?: { productId?: string; route?: string };
}) =>
  `${name}:${stableSerialize({
    arguments: toolArguments,
    context: {
      productId: userContext?.productId ?? "",
      route: userContext?.route ?? "",
    },
  })}`;

const cacheToolResult = (name: string, cacheKey: string, result: { ok: boolean; data?: unknown; error?: string }) => {
  if (cacheableToolNames.has(name)) {
    toolResultCache.set(cacheKey, result);
  }

  return result;
};

export const createToolRegistry = ({
  resolveSwapEvaluation = resolveSwapEvaluationRequest,
  productStore = productModel,
  categoryStore = categoryModel,
}: {
  resolveSwapEvaluation?: typeof resolveSwapEvaluationRequest;
  productStore?: typeof productModel;
  categoryStore?: typeof categoryModel;
} = {}): AssistantToolRegistry => {
  const toolDefinitions = [
    {
      name: "evaluate_swap",
      description: "Get a backend-calculated trade-in estimate and balance for a target product.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          targetProductId: { type: "string" },
          targetCapacity: { type: "string" },
          tradeInModel: { type: "string" },
          tradeInStorage: { type: "string" },
          conditionSelections: {
            type: "object",
            additionalProperties: false,
            properties: {
              overallCondition: { type: "string" },
              screenCondition: { type: "string" },
              batteryCondition: { type: "string" },
              faceIdStatus: { type: "string" },
              cameraStatus: { type: "string" },
            },
          },
        },
        required: ["tradeInModel", "tradeInStorage"],
      },
    },
    {
      name: "search_products",
      description: "Search products by name, description, or category keywords.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          query: { type: "string" },
        },
        required: ["query"],
      },
    },
    {
      name: "get_product_details",
      description: "Get product details, capacities, price, and stock for a product.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          productId: { type: "string" },
          productName: { type: "string" },
        },
      },
    },
    {
      name: "get_product_pricing_options",
      description: "Get storage pricing options and stock availability for one product.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          productId: { type: "string" },
          productName: { type: "string" },
          capacity: { type: "string" },
        },
      },
    },
    {
      name: "compare_products",
      description: "Compare two products using stored product facts only.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          primaryProductId: { type: "string" },
          primaryProductName: { type: "string" },
          compareToProductId: { type: "string" },
          compareToProductName: { type: "string" },
        },
      },
    },
    {
      name: "find_best_match_product",
      description: "Shortlist products that best fit the customer's stated need or budget.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          query: { type: "string" },
          maxBudget: { type: "number" },
          preferredCapacity: { type: "string" },
        },
      },
    },
    {
      name: "check_product_availability",
      description: "Check whether a product or capacity is currently available.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          productId: { type: "string" },
          productName: { type: "string" },
          capacity: { type: "string" },
        },
      },
    },
    {
      name: "get_swap_requirements",
      description: "Explain what information is required for a swap estimate.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
    },
    {
      name: "estimate_swap_from_partial_info",
      description: "Check missing swap details and return an estimate when enough information is available.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          targetProductId: { type: "string" },
          targetCapacity: { type: "string" },
          tradeInModel: { type: "string" },
          tradeInStorage: { type: "string" },
          conditionSelections: {
            type: "object",
            additionalProperties: false,
            properties: {
              overallCondition: { type: "string" },
              screenCondition: { type: "string" },
              batteryCondition: { type: "string" },
              faceIdStatus: { type: "string" },
              cameraStatus: { type: "string" },
            },
          },
        },
      },
    },
    {
      name: "explain_swap_result",
      description: "Return a customer-friendly explanation of a swap estimate without exposing internal calculations.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          targetProductId: { type: "string" },
          targetCapacity: { type: "string" },
          tradeInModel: { type: "string" },
          tradeInStorage: { type: "string" },
          conditionSelections: {
            type: "object",
            additionalProperties: false,
            properties: {
              overallCondition: { type: "string" },
              screenCondition: { type: "string" },
              batteryCondition: { type: "string" },
              faceIdStatus: { type: "string" },
              cameraStatus: { type: "string" },
            },
          },
        },
      },
    },
    {
      name: "get_swap_eligible_models",
      description: "Check whether an iPhone model is eligible for trade-in and list supported storage options.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          model: { type: "string" },
        },
      },
    },
    {
      name: "get_swap_policy_info",
      description: "Explain the high-level swap estimate policy and what happens before final confirmation.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
    },
  ] as const;

  return {
    listTools: () => [...toolDefinitions],
    async executeToolCall({ name, arguments: toolArguments, userContext }) {
      const cacheKey = buildToolCacheKey({
        name,
        toolArguments,
        userContext,
      });
      const cachedResult = cacheableToolNames.has(name) ? toolResultCache.get(cacheKey) : undefined;
      if (cachedResult) {
        return cachedResult;
      }

      if (name === "evaluate_swap") {
        const payload = resolveSwapToolPayload({ toolArguments, userContext });

        if (!payload.targetProductId || !payload.tradeInModel || !payload.tradeInStorage) {
          return {
            ok: false,
            error: "Missing required fields for swap evaluation: targetProductId, tradeInModel, tradeInStorage.",
          };
        }

        if (!payload.conditionSelections) {
          return {
            ok: false,
            error: "Invalid condition selections were provided for swap evaluation.",
          };
        }

        const evaluation = await resolveSwapEvaluation({
          targetProductId: payload.targetProductId,
          targetCapacity: payload.targetCapacity,
          tradeInModel: payload.tradeInModel,
          tradeInStorage: payload.tradeInStorage,
          conditionSelections: payload.conditionSelections,
        });
        if (!evaluation.ok) {
          return {
            ok: false,
            error: evaluation.message,
          };
        }

        return cacheToolResult(name, cacheKey, {
          ok: true,
          data: buildSwapSummary(evaluation.data),
        });
      }

      if (name === "search_products") {
        const query = extractString(toolArguments.query);
        if (!query) {
          return {
            ok: false,
            error: "A search query is required.",
          };
        }

        const results = await searchProducts({
          query,
          productStore,
          categoryStore,
        });

        return cacheToolResult(name, cacheKey, {
          ok: true,
          data: {
            products: results.map(toProductListItem),
          },
        });
      }

      if (name === "get_product_details") {
        const product = await resolveProductReference({
          productStore,
          productId: extractString(toolArguments.productId) || extractString(userContext?.productId),
          productName: extractString(toolArguments.productName),
        });

        if (!product) {
          return {
            ok: false,
            error: "Product not found.",
          };
        }

        return cacheToolResult(name, cacheKey, {
          ok: true,
          data: toProductDetail(product),
        });
      }

      if (name === "get_product_pricing_options") {
        const product = await resolveProductReference({
          productStore,
          productId: extractString(toolArguments.productId) || extractString(userContext?.productId),
          productName: extractString(toolArguments.productName),
        });

        if (!product) {
          return {
            ok: false,
            error: "Product not found.",
          };
        }

        return cacheToolResult(name, cacheKey, {
          ok: true,
          data: buildPricingOptions(product, extractString(toolArguments.capacity)),
        });
      }

      if (name === "compare_products") {
        const primary = await resolveProductReference({
          productStore,
          productId: extractString(toolArguments.primaryProductId) || extractString(userContext?.productId),
          productName: extractString(toolArguments.primaryProductName),
        });
        const secondary = await resolveProductReference({
          productStore,
          productId: extractString(toolArguments.compareToProductId),
          productName: extractString(toolArguments.compareToProductName),
        });

        if (!primary || !secondary) {
          return {
            ok: false,
            error: "Two valid products are required for comparison.",
          };
        }

        return cacheToolResult(name, cacheKey, {
          ok: true,
          data: buildProductComparison(primary, secondary),
        });
      }

      if (name === "find_best_match_product") {
        const query = extractString(toolArguments.query);
        const maxBudget = extractNumber(toolArguments.maxBudget);
        const preferredCapacity = extractString(toolArguments.preferredCapacity);
        const candidateProducts =
          query.length > 0
            ? await searchProducts({
                query,
                productStore,
                categoryStore,
                limit: 12,
              })
            : await listProducts({
                productStore,
                limit: 20,
              });

        return cacheToolResult(name, cacheKey, {
          ok: true,
          data: {
            results: buildBestMatchResults({
              products: candidateProducts,
              query,
              maxBudget,
              preferredCapacity,
            }),
            filters: {
              query: query || undefined,
              maxBudget,
              preferredCapacity: preferredCapacity || undefined,
            },
          },
        });
      }

      if (name === "check_product_availability") {
        const product = await resolveProductReference({
          productStore,
          productId: extractString(toolArguments.productId) || extractString(userContext?.productId),
          productName: extractString(toolArguments.productName),
        });

        if (!product) {
          return {
            ok: false,
            error: "Product not found.",
          };
        }

        return cacheToolResult(name, cacheKey, {
          ok: true,
          data: buildAvailabilityDetails(product, extractString(toolArguments.capacity)),
        });
      }

      if (name === "get_swap_requirements") {
        return cacheToolResult(name, cacheKey, {
          ok: true,
          data: buildSwapRequirements(),
        });
      }

      if (name === "estimate_swap_from_partial_info") {
        const payload = resolveSwapToolPayload({ toolArguments, userContext });
        const partial = resolvePartialSwapInputs({
          targetProductId: payload.targetProductId,
          tradeInModel: payload.tradeInModel,
          tradeInStorage: payload.tradeInStorage,
          conditionSelections: payload.conditionSelections ?? undefined,
        });

        if (!partial.resolvedSelections) {
          return {
            ok: false,
            error: "Invalid condition selections were provided for swap evaluation.",
          };
        }

        if (partial.missingRequiredFields.length) {
          return cacheToolResult(name, cacheKey, {
            ok: true,
            data: {
              status: "needs_more_info",
              missingRequiredFields: partial.missingRequiredFields,
              missingRequiredFieldLabels: partial.missingRequiredFieldLabels,
              nextQuestion: partial.nextQuestion,
              optionalFields: partial.optionalFields,
              collected: {
                targetProductId: payload.targetProductId || undefined,
                tradeInModel: payload.tradeInModel || undefined,
                tradeInStorage: payload.tradeInStorage || undefined,
              },
              acceptedConditionOptions: buildSwapConditionOptions(),
            },
          });
        }

        const evaluation = await resolveSwapEvaluation({
          targetProductId: payload.targetProductId,
          targetCapacity: payload.targetCapacity,
          tradeInModel: payload.tradeInModel,
          tradeInStorage: payload.tradeInStorage,
          conditionSelections: partial.resolvedSelections,
        });

        if (!evaluation.ok) {
          return {
            ok: false,
            error: evaluation.message,
          };
        }

        return cacheToolResult(name, cacheKey, {
          ok: true,
          data: {
            status: "ready",
            missingRequiredFields: [],
            nextQuestion: null,
            ...buildSwapSummary(evaluation.data),
          },
        });
      }

      if (name === "explain_swap_result") {
        const payload = resolveSwapToolPayload({ toolArguments, userContext });
        if (!payload.targetProductId || !payload.tradeInModel || !payload.tradeInStorage) {
          return {
            ok: false,
            error: "Missing required fields for swap explanation: targetProductId, tradeInModel, tradeInStorage.",
          };
        }

        if (!payload.conditionSelections) {
          return {
            ok: false,
            error: "Invalid condition selections were provided for swap evaluation.",
          };
        }

        const [evaluation, targetProduct] = await Promise.all([
          resolveSwapEvaluation({
            targetProductId: payload.targetProductId,
            targetCapacity: payload.targetCapacity,
            tradeInModel: payload.tradeInModel,
            tradeInStorage: payload.tradeInStorage,
            conditionSelections: payload.conditionSelections,
          }),
          fetchProductById(productStore, payload.targetProductId),
        ]);

        if (!evaluation.ok) {
          return {
            ok: false,
            error: evaluation.message,
          };
        }

        return cacheToolResult(name, cacheKey, {
          ok: true,
          data: buildSwapExplanation({
            evaluation: evaluation.data,
            tradeInModel: payload.tradeInModel,
            tradeInStorage: payload.tradeInStorage,
            targetProductName: targetProduct ? String(targetProduct.name ?? "") : undefined,
          }),
        });
      }

      if (name === "get_swap_eligible_models") {
        const modelQuery = extractString(toolArguments.model);
        const { exactMatch, suggestions } = findEligibleSwapModels(modelQuery);

        return cacheToolResult(name, cacheKey, {
          ok: true,
          data: {
            eligible: exactMatch ? true : modelQuery ? false : undefined,
            model: exactMatch?.model,
            capacities: exactMatch?.capacities,
            suggestions,
          },
        });
      }

      if (name === "get_swap_policy_info") {
        return cacheToolResult(name, cacheKey, {
          ok: true,
          data: buildSwapPolicyInfo(),
        });
      }

      return {
        ok: false,
        error: `Unknown assistant tool: ${name}`,
      };
    },
  };
};

export const summarizeToolResult = (value: unknown) => summarizeData(value);

export const toolRegistry = createToolRegistry();
