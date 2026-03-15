import { resolveSwapConditionSelections, type SwapConditionSelections } from "../data/swapConditionConfig";
import productModel from "../model/productModel";
import { fetchPublicEasyBuyCatalog } from "./easyBuyCatalog";
import { evaluateSwapEstimate } from "./swapValuation";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const resolveSwapEvaluationRequest = async ({
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
  conditionSelections?: Partial<SwapConditionSelections>;
}) => {
  const resolvedSelections = resolveSwapConditionSelections(conditionSelections);

  if (!resolvedSelections) {
    return {
      ok: false as const,
      status: 400,
      message: "invalid swap condition selections provided",
    };
  }

  const [targetProduct, tradeInProduct, publicCatalog] = await Promise.all([
    productModel.findById(targetProductId.trim()),
    productModel.findOne({
      name: new RegExp(`^${escapeRegExp(tradeInModel.trim())}$`, "i"),
    }),
    fetchPublicEasyBuyCatalog(),
  ]);

  if (!targetProduct) {
    return {
      ok: false as const,
      status: 404,
      message: "target product not found",
    };
  }

  if (!tradeInProduct) {
    return {
      ok: false as const,
      status: 404,
      message: "trade-in product not found",
    };
  }

  try {
    const evaluation = evaluateSwapEstimate({
      targetProduct,
      targetCapacity,
      tradeInProduct,
      tradeInStorage,
      conditionSelections: resolvedSelections,
      catalogModels: publicCatalog?.models,
    });

    return {
      ok: true as const,
      status: 200,
      data: evaluation,
    };
  } catch (error) {
    return {
      ok: false as const,
      status: 422,
      message: error instanceof Error ? error.message : "failed to calculate swap estimate",
    };
  }
};
