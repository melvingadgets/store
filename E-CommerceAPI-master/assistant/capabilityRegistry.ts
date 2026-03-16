import categoryModel from "../model/categoryModel";
import productModel from "../model/productModel";
import { resolveSwapEvaluationRequest } from "../utils/swapResolver";
import type { AssistantToolRegistry } from "./assistantTypes";
import { createCapabilityExecutor, summarizeCapabilityResult } from "./capabilityExecutor";
import { checkProductAvailabilityCapability } from "./capabilities/backend/checkProductAvailabilityCapability";
import { estimateSwapCapability } from "./capabilities/backend/estimateSwapCapability";
import { getProductDetailsCapability } from "./capabilities/backend/getProductDetailsCapability";
import { getSwapRequirementsCapability } from "./capabilities/backend/getSwapRequirementsCapability";
import { searchProductsCapability } from "./capabilities/backend/searchProductsCapability";

export const createCapabilityRegistry = ({
  productStore = productModel,
  categoryStore = categoryModel,
  resolveSwapEvaluation = resolveSwapEvaluationRequest,
}: {
  productStore?: typeof productModel;
  categoryStore?: typeof categoryModel;
  resolveSwapEvaluation?: typeof resolveSwapEvaluationRequest;
} = {}): AssistantToolRegistry => {
  const executor = createCapabilityExecutor({
    capabilities: [
      searchProductsCapability({
        productStore,
        categoryStore,
      }),
      getProductDetailsCapability({
        productStore,
      }),
      checkProductAvailabilityCapability({
        productStore,
      }),
      estimateSwapCapability({
        resolveSwapEvaluation,
      }),
      getSwapRequirementsCapability(),
    ],
  });

  return {
    listCapabilities: () => executor.listCapabilityDefinitions(),
    listTools: () => executor.listCapabilityDefinitions(),
    executeCapability: (input) => executor.executeCapability(input),
    executeToolCall: (input) => executor.executeCapability(input),
  };
};

export const capabilityRegistry = createCapabilityRegistry();

export { summarizeCapabilityResult };
