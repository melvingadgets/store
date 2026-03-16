import type { AssistantCapability } from "../../assistantTypes";
import {
  buildSwapConditionOptions,
  buildSwapRequirements,
  buildSwapSummary,
  resolvePartialSwapInputs,
} from "../../swapFoundation";
import { resolveSwapEvaluationRequest } from "../../../utils/swapResolver";

const cleanString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export const estimateSwapCapability = ({
  resolveSwapEvaluation = resolveSwapEvaluationRequest,
}: {
  resolveSwapEvaluation?: typeof resolveSwapEvaluationRequest;
} = {}): AssistantCapability => ({
  name: "estimate_swap",
  description: "Collect missing trade-in details and return a current swap estimate when enough details are available.",
  source: "backend_service",
  intentTags: ["trade_in"],
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
  async execute({ arguments: capabilityArguments, userContext }) {
    const targetProductId = cleanString(capabilityArguments.targetProductId) || cleanString(userContext?.productId);
    const targetCapacity = cleanString(capabilityArguments.targetCapacity) || cleanString(userContext?.productCapacity) || undefined;
    const tradeInModel = cleanString(capabilityArguments.tradeInModel) || cleanString(userContext?.tradeInModel);
    const tradeInStorage = cleanString(capabilityArguments.tradeInStorage) || cleanString(userContext?.tradeInStorage);
    const conditionSelections =
      capabilityArguments.conditionSelections && typeof capabilityArguments.conditionSelections === "object"
        ? capabilityArguments.conditionSelections
        : undefined;

    const partial = resolvePartialSwapInputs({
      targetProductId,
      tradeInModel,
      tradeInStorage,
      conditionSelections: conditionSelections as Record<string, string> | undefined,
    });

    if (!partial.resolvedSelections) {
      return {
        ok: false,
        error: "Invalid condition selections were provided for swap estimation.",
      };
    }

    if (partial.missingRequiredFields.length) {
      return {
        ok: true,
        data: {
          status: "needs_more_info",
          missingRequiredFields: partial.missingRequiredFields,
          missingRequiredFieldLabels: partial.missingRequiredFieldLabels,
          nextQuestion: partial.nextQuestion,
          requirements: buildSwapRequirements(),
          acceptedConditionOptions: buildSwapConditionOptions(),
          collected: {
            targetProductId: targetProductId || undefined,
            targetCapacity,
            tradeInModel: tradeInModel || undefined,
            tradeInStorage: tradeInStorage || undefined,
          },
        },
      };
    }

    const evaluation = await resolveSwapEvaluation({
      targetProductId,
      targetCapacity,
      tradeInModel,
      tradeInStorage,
      conditionSelections: partial.resolvedSelections,
    });

    if (!evaluation.ok) {
      return {
        ok: false,
        error: evaluation.message,
      };
    }

    return {
      ok: true,
      data: {
        status: "ready",
        ...buildSwapSummary(evaluation.data),
        collected: {
          targetProductId,
          targetCapacity,
          tradeInModel,
          tradeInStorage,
        },
      },
    };
  },
});
