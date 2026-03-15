import type { Request, Response } from "express";
import {
  batteryConditionOptions,
  cameraStatusOptions,
  defaultSwapConditionSelections,
  faceIdStatusOptions,
  overallConditionOptions,
  screenConditionOptions,
} from "../data/swapConditionConfig";
import { iphoneSwapCatalog } from "../data/iphoneSwapCatalog";
import { SimpleTtlCache } from "../utils/simpleTtlCache";
import type { SwapEvaluationResult } from "../utils/swapValuation";
import { resolveSwapEvaluationRequest } from "../utils/swapResolver";

const swapEvaluationCache = new SimpleTtlCache<string, SwapEvaluationResult>(60 * 1000, 1000);

const buildSwapEvaluationCacheKey = ({
  targetProductId,
  targetCapacity,
  tradeInModel,
  tradeInStorage,
  conditionSelections,
}: {
  targetProductId: string;
  targetCapacity?: string;
  tradeInModel: string;
  tradeInStorage: string;
  conditionSelections: Record<string, string>;
}) =>
  JSON.stringify({
    targetProductId,
    targetCapacity: String(targetCapacity ?? "").trim().toUpperCase(),
    tradeInModel: tradeInModel.trim().toLowerCase(),
    tradeInStorage: tradeInStorage.trim().toUpperCase(),
    conditionSelections,
  });

const swapConditionFactors = [
  {
    key: "overallCondition",
    label: "Overall",
    options: overallConditionOptions.map((value) => ({
      value,
      label:
        value === "excellent"
          ? "Excellent"
          : value === "good"
            ? "Good"
            : value === "fair"
              ? "Fair"
              : "Poor",
    })),
  },
  {
    key: "screenCondition",
    label: "Screen",
    options: screenConditionOptions.map((value) => ({
      value,
      label:
        value === "original"
          ? "Original"
          : value === "scratched"
            ? "Scratched"
            : value === "cracked"
              ? "Cracked"
              : "Changed screen",
    })),
  },
  {
    key: "batteryCondition",
    label: "Battery",
    options: batteryConditionOptions.map((value) => ({
      value,
      label:
        value === "90-plus"
          ? "90%+"
          : value === "80-89"
            ? "80-89%"
            : value === "79-75"
              ? "79-75%"
              : "Changed battery",
    })),
  },
  {
    key: "faceIdStatus",
    label: "Face ID",
    compact: true,
    options: faceIdStatusOptions.map((value) => ({
      value,
      label: value === "original" ? "Original" : "No Face ID",
    })),
  },
  {
    key: "cameraStatus",
    label: "Camera",
    compact: true,
    options: cameraStatusOptions.map((value) => ({
      value,
      label:
        value === "original"
          ? "Original"
          : value === "changed"
            ? "Changed"
            : value === "rear-fault"
              ? "Rear fault"
              : value === "front-fault"
                ? "Front fault"
                : "Both faulty",
    })),
  },
] as const;

export const getSwapMetadata = async (_req: Request, res: Response): Promise<Response> => {
  return res.status(200).json({
    success: 1,
    message: "swap metadata loaded successfully",
    data: {
      models: iphoneSwapCatalog,
      defaultConditionSelections: defaultSwapConditionSelections,
      conditionFactors: swapConditionFactors,
    },
  });
};

export const evaluateSwap = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { targetProductId, targetCapacity, tradeInModel, tradeInStorage, conditionSelections } = req.body as {
      targetProductId?: string;
      targetCapacity?: string;
      tradeInModel?: string;
      tradeInStorage?: string;
      conditionSelections?: Record<string, string>;
    };

    if (!targetProductId?.trim() || !tradeInModel?.trim() || !tradeInStorage?.trim()) {
      return res.status(400).json({
        success: 0,
        message: "targetProductId, tradeInModel, and tradeInStorage are required",
      });
    }

    const cacheKey = buildSwapEvaluationCacheKey({
      targetProductId,
      targetCapacity,
      tradeInModel,
      tradeInStorage,
      conditionSelections: conditionSelections ?? {},
    });
    const cachedEvaluation = swapEvaluationCache.get(cacheKey);

    if (cachedEvaluation) {
      return res.status(200).json({
        success: 1,
        message: "swap estimate calculated successfully",
        data: cachedEvaluation,
      });
    }

    const evaluation = await resolveSwapEvaluationRequest({
      targetProductId,
      targetCapacity,
      tradeInModel,
      tradeInStorage,
      conditionSelections,
    });

    if (!evaluation.ok) {
      return res.status(evaluation.status).json({
        success: 0,
        message: evaluation.message,
      });
    }

    swapEvaluationCache.set(cacheKey, evaluation.data);

    return res.status(200).json({
      success: 1,
      message: "swap estimate calculated successfully",
      data: evaluation.data,
    });
  } catch {
    return res.status(500).json({
      success: 0,
      message: "failed to calculate swap estimate",
    });
  }
};
