import {
  changedScreenRules,
  maxSwapConditionDeductionRate,
  stackPenaltyRules,
  type SwapConditionSelections,
  universalFaultRules,
} from "../data/swapConditionConfig";
import { getIphoneSwapRate } from "../data/iphoneSwapCatalog";
import { getCatalogPriceForCapacity, type PublicEasyBuyCatalogModel } from "./easyBuyCatalog";

export interface SwapProductRecord {
  name: string;
  price: number;
  storageOptions?: Array<{
    capacity: string;
    price: number;
    qty?: number;
  }>;
}

export interface SwapEvaluationResult {
  targetPrice: number;
  referencePrice: number;
  swapRate: number;
  totalDeductionRate: number;
  baseInternalResaleValue: number;
  internalAdjustedResaleValue: number;
  customerEstimateMin: number;
  customerEstimateMax: number;
  estimatedBalanceMin: number;
  estimatedBalanceMax: number;
}

type InternalFaultKey =
  | "roughBody"
  | "cleanScreen"
  | "scratchedScreen"
  | "crackedScreen"
  | "changedScreen"
  | "batteryBelow80"
  | "batteryBelow75"
  | "changedBattery"
  | "noFaceId"
  | "changedCamera"
  | "rearCameraFault"
  | "frontCameraFault"
  | "bothCamerasFaulty";

const roundCurrency = (value: number) => Math.round(value);

const bodyDeductionByCondition: Record<SwapConditionSelections["overallCondition"], number> = {
  excellent: 0.03,
  good: 0.08,
  fair: 0.13,
  poor: universalFaultRules.roughBody / 100,
};

const getNormalizedCapacity = (value: string | undefined) => String(value ?? "").trim().toUpperCase();

const getFallbackPriceForCapacity = (product: SwapProductRecord, capacity: string | undefined) => {
  const normalizedCapacity = getNormalizedCapacity(capacity);
  const matchingStorageOption = (product.storageOptions ?? []).find(
    (option) => getNormalizedCapacity(option.capacity) === normalizedCapacity,
  );

  return matchingStorageOption?.price ?? product.price;
};

const getChangedScreenDeductionRate = (model: string) => {
  const groups = [
    changedScreenRules.legacy,
    changedScreenRules.baseModern,
    changedScreenRules.premium,
  ] as const;

  for (const group of groups) {
    if ((group.models as readonly string[]).includes(model)) {
      return group.deductionPercent / 100;
    }
  }

  return 0;
};

const getNormalizedFaults = (model: string, selections: SwapConditionSelections) => {
  const faults: Array<{ key: InternalFaultKey; rate: number; countsAsMajor: boolean }> = [];

  const bodyRate = bodyDeductionByCondition[selections.overallCondition];
  faults.push({
    key: "roughBody",
    rate: bodyRate,
    countsAsMajor: selections.overallCondition === "poor",
  });

  if (selections.screenCondition === "original") {
    faults.push({
      key: "cleanScreen",
      rate: 0.03,
      countsAsMajor: false,
    });
  }

  if (selections.screenCondition === "scratched") {
    faults.push({
      key: "scratchedScreen",
      rate: universalFaultRules.scratchedScreen / 100,
      countsAsMajor: false,
    });
  }

  if (selections.screenCondition === "cracked") {
    faults.push({
      key: "crackedScreen",
      rate: universalFaultRules.crackedScreen / 100,
      countsAsMajor: true,
    });
  }

  if (selections.screenCondition === "changed-screen") {
    faults.push({
      key: "changedScreen",
      rate: getChangedScreenDeductionRate(model),
      countsAsMajor: true,
    });
  }

  if (selections.batteryCondition === "80-89") {
    faults.push({
      key: "batteryBelow80",
      rate: universalFaultRules.batteryBelow80 / 100,
      countsAsMajor: false,
    });
  }

  if (selections.batteryCondition === "79-75") {
    faults.push({
      key: "batteryBelow75",
      rate: universalFaultRules.batteryBelow75 / 100,
      countsAsMajor: false,
    });
  }

  if (selections.batteryCondition === "changed-battery") {
    faults.push({
      key: "changedBattery",
      rate: universalFaultRules.changedBattery / 100,
      countsAsMajor: true,
    });
  }

  if (selections.faceIdStatus === "no-face-id") {
    faults.push({
      key: "noFaceId",
      rate: universalFaultRules.noFaceId / 100,
      countsAsMajor: true,
    });
  }

  if (selections.cameraStatus === "changed") {
    faults.push({
      key: "changedCamera",
      rate: universalFaultRules.changedCamera / 100,
      countsAsMajor: true,
    });
  }

  if (selections.cameraStatus === "rear-fault") {
    faults.push({
      key: "rearCameraFault",
      rate: universalFaultRules.rearCameraFault / 100,
      countsAsMajor: true,
    });
  }

  if (selections.cameraStatus === "front-fault") {
    faults.push({
      key: "frontCameraFault",
      rate: universalFaultRules.frontCameraFault / 100,
      countsAsMajor: true,
    });
  }

  if (selections.cameraStatus === "both-faulty") {
    faults.push({
      key: "bothCamerasFaulty",
      rate: universalFaultRules.bothCamerasFaulty / 100,
      countsAsMajor: true,
    });
  }

  return faults;
};

const getMajorFaultStackPenaltyRate = (majorFaultCount: number) => {
  if (majorFaultCount >= 3) {
    return stackPenaltyRules.threeOrMoreMajorFaultsExtraDeductionPercent / 100;
  }

  if (majorFaultCount >= 2) {
    return stackPenaltyRules.twoMajorFaultsExtraDeductionPercent / 100;
  }

  return 0;
};

const createCustomerEstimateRange = (internalAdjustedResaleValue: number) => {
  const sanitizedInternalValue = Math.max(0, roundCurrency(internalAdjustedResaleValue));

  return {
    customerEstimateMin: roundCurrency(sanitizedInternalValue * 0.95),
    customerEstimateMax: roundCurrency(sanitizedInternalValue * 1.05),
    internalAdjustedResaleValue: sanitizedInternalValue,
  };
};

export const calculateInternalAdjustedResaleValue = (
  referencePrice: number,
  swapRate: number,
  selections: SwapConditionSelections,
  model: string,
) => {
  const baseInternalResaleValue = Math.max(0, roundCurrency(referencePrice * swapRate));
  const normalizedFaults = getNormalizedFaults(model, selections);
  const majorFaultCount = normalizedFaults.filter((fault) => fault.countsAsMajor).length;
  const baseDeductionRate = normalizedFaults.reduce((total, fault) => total + fault.rate, 0);
  const totalDeductionRate = Math.min(
    maxSwapConditionDeductionRate,
    baseDeductionRate + getMajorFaultStackPenaltyRate(majorFaultCount),
  );

  return {
    baseInternalResaleValue,
    internalAdjustedResaleValue: Math.max(0, roundCurrency(baseInternalResaleValue * (1 - totalDeductionRate))),
    totalDeductionRate,
  };
};

export const evaluateSwapEstimate = ({
  targetProduct,
  targetCapacity,
  tradeInProduct,
  tradeInStorage,
  conditionSelections,
  catalogModels,
}: {
  targetProduct: SwapProductRecord;
  targetCapacity?: string;
  tradeInProduct: SwapProductRecord;
  tradeInStorage: string;
  conditionSelections: SwapConditionSelections;
  catalogModels?: PublicEasyBuyCatalogModel[];
}): SwapEvaluationResult => {
  const targetPrice = getCatalogPriceForCapacity(
    targetProduct.name,
    targetCapacity,
    catalogModels,
    getFallbackPriceForCapacity(targetProduct, targetCapacity),
  );
  const referencePrice = getCatalogPriceForCapacity(
    tradeInProduct.name,
    tradeInStorage,
    catalogModels,
    getFallbackPriceForCapacity(tradeInProduct, tradeInStorage),
  );

  if (targetPrice <= 0) {
    throw new Error("Unable to resolve a valid target price for the selected device.");
  }

  if (referencePrice <= 0) {
    throw new Error("Unable to resolve a valid trade-in reference price for the selected device.");
  }

  const swapRate = getIphoneSwapRate(tradeInProduct.name);
  const internalValuation = calculateInternalAdjustedResaleValue(
    referencePrice,
    swapRate,
    conditionSelections,
    tradeInProduct.name,
  );
  const customerEstimate = createCustomerEstimateRange(internalValuation.internalAdjustedResaleValue);

  return {
    targetPrice,
    referencePrice,
    swapRate,
    totalDeductionRate: internalValuation.totalDeductionRate,
    baseInternalResaleValue: internalValuation.baseInternalResaleValue,
    internalAdjustedResaleValue: customerEstimate.internalAdjustedResaleValue,
    customerEstimateMin: customerEstimate.customerEstimateMin,
    customerEstimateMax: customerEstimate.customerEstimateMax,
    estimatedBalanceMin: Math.max(0, targetPrice - customerEstimate.customerEstimateMax),
    estimatedBalanceMax: Math.max(0, targetPrice - customerEstimate.customerEstimateMin),
  };
};
