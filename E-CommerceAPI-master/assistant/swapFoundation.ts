import {
  cameraStatusOptions,
  defaultSwapConditionSelections,
  faceIdStatusOptions,
  batteryConditionOptions,
  overallConditionOptions,
  resolveSwapConditionSelections,
  screenConditionOptions,
  type SwapConditionSelections,
} from "../data/swapConditionConfig";
import { iphoneSwapCatalog } from "../data/iphoneSwapCatalog";
import { formatNaira } from "./productFoundation";

type SwapEvaluationData = {
  customerEstimateMin: number;
  customerEstimateMax: number;
  estimatedBalanceMin: number;
  estimatedBalanceMax: number;
};

const SWAP_REQUIRED_FIELDS = ["targetProductId", "tradeInModel", "tradeInStorage"] as const;

const swapFieldLabels: Record<(typeof SWAP_REQUIRED_FIELDS)[number], string> = {
  targetProductId: "Target product",
  tradeInModel: "Current iPhone model",
  tradeInStorage: "Current iPhone storage",
};

const optionalFieldLabels = {
  overallCondition: "Overall condition",
  screenCondition: "Screen condition",
  batteryCondition: "Battery condition",
  faceIdStatus: "Face ID status",
  cameraStatus: "Camera status",
} as const;

const nextQuestionMap: Record<(typeof SWAP_REQUIRED_FIELDS)[number], string> = {
  targetProductId: "Which phone do you want to buy with this trade-in?",
  tradeInModel: "What iPhone model are you trading in?",
  tradeInStorage: "What storage does your current iPhone have?",
};

export const buildSwapSummary = (evaluation: SwapEvaluationData) => ({
  customerEstimateMin: evaluation.customerEstimateMin,
  customerEstimateMax: evaluation.customerEstimateMax,
  estimatedBalanceMin: evaluation.estimatedBalanceMin,
  estimatedBalanceMax: evaluation.estimatedBalanceMax,
  note: "Final trade-in value is confirmed after device inspection.",
  summary: `Estimated trade-in credit ${formatNaira(evaluation.customerEstimateMin)} to ${formatNaira(
    evaluation.customerEstimateMax,
  )}. Estimated balance ${formatNaira(evaluation.estimatedBalanceMin)} to ${formatNaira(evaluation.estimatedBalanceMax)}.`,
});

export const buildSwapExplanation = ({
  evaluation,
  tradeInModel,
  tradeInStorage,
  targetProductName,
}: {
  evaluation: SwapEvaluationData;
  tradeInModel: string;
  tradeInStorage: string;
  targetProductName?: string;
}) => ({
  ...buildSwapSummary(evaluation),
  explanation: targetProductName
    ? `For your ${tradeInModel} ${tradeInStorage}, the current trade-in estimate toward ${targetProductName} is ${formatNaira(
        evaluation.customerEstimateMin,
      )} to ${formatNaira(evaluation.customerEstimateMax)}. You would likely pay about ${formatNaira(
        evaluation.estimatedBalanceMin,
      )} to ${formatNaira(evaluation.estimatedBalanceMax)} after the trade-in.`
    : `For your ${tradeInModel} ${tradeInStorage}, the current trade-in estimate is ${formatNaira(
        evaluation.customerEstimateMin,
      )} to ${formatNaira(evaluation.customerEstimateMax)}. Your remaining balance would likely be ${formatNaira(
        evaluation.estimatedBalanceMin,
      )} to ${formatNaira(evaluation.estimatedBalanceMax)}.`,
  nextStep: "Final value is confirmed after inspection of the device.",
});

export const resolvePartialSwapInputs = ({
  targetProductId,
  tradeInModel,
  tradeInStorage,
  conditionSelections,
}: {
  targetProductId?: string;
  tradeInModel?: string;
  tradeInStorage?: string;
  conditionSelections?: Partial<SwapConditionSelections>;
}) => {
  const missingRequiredFields = SWAP_REQUIRED_FIELDS.filter((field) => {
    if (field === "targetProductId") {
      return !targetProductId;
    }

    if (field === "tradeInModel") {
      return !tradeInModel;
    }

    return !tradeInStorage;
  });

  const resolvedSelections = resolveSwapConditionSelections(conditionSelections ?? defaultSwapConditionSelections);

  return {
    targetProductId,
    tradeInModel,
    tradeInStorage,
    missingRequiredFields,
    missingRequiredFieldLabels: missingRequiredFields.map((field) => swapFieldLabels[field]),
    nextQuestion: missingRequiredFields.length ? nextQuestionMap[missingRequiredFields[0]] : null,
    optionalFields: Object.values(optionalFieldLabels),
    resolvedSelections,
  };
};

export const findEligibleSwapModels = (query?: string) => {
  const normalizedQuery = String(query ?? "").trim().toLowerCase();
  const exactMatch = normalizedQuery
    ? iphoneSwapCatalog.find((entry) => entry.model.toLowerCase() === normalizedQuery) ?? null
    : null;
  const partialMatches = normalizedQuery
    ? iphoneSwapCatalog.filter((entry) => entry.model.toLowerCase().includes(normalizedQuery)).slice(0, 8)
    : iphoneSwapCatalog.slice(0, 8);

  return {
    exactMatch,
    suggestions: partialMatches,
  };
};

export const buildSwapPolicyInfo = () => ({
  summary: "Trade-in estimates are provisional until the device is inspected.",
  policies: [
    "The estimate depends on the iPhone model, storage, and condition information provided.",
    "Final trade-in value is confirmed after the device is inspected.",
    "If the condition is different from what was described, the final offer may change.",
    "The assistant can help with estimates, but it does not give a final confirmed trade-in value.",
  ],
  requiredFields: Object.values(swapFieldLabels),
  optionalFields: Object.values(optionalFieldLabels),
});

export const buildSwapRequirements = () => ({
  required: Object.values(swapFieldLabels),
  helpful: Object.values(optionalFieldLabels),
  note: "Final credit is confirmed after physical inspection.",
});

export const buildSwapConditionOptions = () => ({
  overallCondition: [...overallConditionOptions],
  screenCondition: [...screenConditionOptions],
  batteryCondition: [...batteryConditionOptions],
  faceIdStatus: [...faceIdStatusOptions],
  cameraStatus: [...cameraStatusOptions],
});
