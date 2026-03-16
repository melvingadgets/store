import productModel from "../../../model/productModel";
import type { AssistantCapability } from "../../assistantTypes";
import { extractString, resolveProductReference, toProductDetail } from "../../productFoundation";

export const getProductDetailsCapability = ({
  productStore = productModel,
}: {
  productStore?: typeof productModel;
} = {}): AssistantCapability => ({
  name: "get_product_details",
  description: "Get details, pricing, and capacity information for one product.",
  source: "backend_service",
  intentTags: ["product"],
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      productId: { type: "string" },
      productName: { type: "string" },
    },
  },
  async execute({ arguments: capabilityArguments, userContext }) {
    const product = await resolveProductReference({
      productStore,
      productId: extractString(capabilityArguments.productId) || extractString(userContext?.productId),
      productName: extractString(capabilityArguments.productName) || extractString(userContext?.productName),
    });

    if (!product) {
      return {
        ok: false,
        error: "Product not found.",
      };
    }

    return {
      ok: true,
      data: toProductDetail(product),
    };
  },
});
