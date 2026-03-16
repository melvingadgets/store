import { SimpleTtlCache } from "../utils/simpleTtlCache";
import type { AssistantCapability, AssistantCapabilityDefinition, AssistantCapabilityResult, AssistantUserContext } from "./assistantTypes";

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

const buildCapabilityCacheKey = ({
  name,
  capabilityArguments,
  userContext,
  userId,
}: {
  name: string;
  capabilityArguments: Record<string, unknown>;
  userContext?: AssistantUserContext;
  userId?: string;
}) =>
  `${name}:${stableSerialize({
    arguments: capabilityArguments,
    context: {
      productId: userContext?.productId ?? "",
      productName: userContext?.productName ?? "",
      route: userContext?.route ?? "",
      tradeInModel: userContext?.tradeInModel ?? "",
      tradeInStorage: userContext?.tradeInStorage ?? "",
    },
    userId: userId ?? "",
  })}`;

const defaultCacheableCapabilities = new Set([
  "search_products",
  "get_product_details",
  "check_product_availability",
  "estimate_swap",
  "get_swap_requirements",
]);

export const createCapabilityExecutor = ({
  capabilities,
  cache = new SimpleTtlCache<string, AssistantCapabilityResult>(60 * 1000, 250),
  cacheableCapabilities = defaultCacheableCapabilities,
}: {
  capabilities: AssistantCapability[];
  cache?: SimpleTtlCache<string, AssistantCapabilityResult>;
  cacheableCapabilities?: Set<string>;
}) => {
  const capabilityMap = new Map(capabilities.map((capability) => [capability.name, capability]));

  return {
    listCapabilityDefinitions(): AssistantCapabilityDefinition[] {
      return capabilities.map(({ execute: _execute, ...definition }) => ({ ...definition }));
    },
    async executeCapability({
      name,
      arguments: capabilityArguments,
      userContext,
      userId,
    }: {
      name: string;
      arguments: Record<string, unknown>;
      userContext?: AssistantUserContext;
      userId?: string;
    }): Promise<AssistantCapabilityResult> {
      const capability = capabilityMap.get(name);
      if (!capability) {
        return {
          ok: false,
          error: `Unknown assistant capability: ${name}`,
        };
      }

      const cacheKey = buildCapabilityCacheKey({
        name,
        capabilityArguments,
        userContext,
        userId,
      });
      const cachedResult = cacheableCapabilities.has(name) ? cache.get(cacheKey) : undefined;
      if (cachedResult) {
        return cachedResult;
      }

      const result = await capability.execute({
        arguments: capabilityArguments,
        userContext,
        userId,
      });

      if (cacheableCapabilities.has(name)) {
        cache.set(cacheKey, result);
      }

      return result;
    },
  };
};

export const summarizeCapabilityResult = (value: unknown) => {
  const serialized = JSON.stringify(value);
  return serialized.length > 220 ? `${serialized.slice(0, 217)}...` : serialized;
};
