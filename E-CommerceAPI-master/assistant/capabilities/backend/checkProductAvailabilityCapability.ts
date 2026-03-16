import productModel from "../../../model/productModel";
import type { AssistantCapability } from "../../assistantTypes";
import { buildAvailabilityDetails, extractString, resolveProductReference } from "../../productFoundation";

export const checkProductAvailabilityCapability = ({
  productStore = productModel,
}: {
  productStore?: typeof productModel;
} = {}): AssistantCapability => ({
  name: "check_product_availability",
  description: "Check whether a product or one of its capacities is currently available.",
  source: "backend_service",
  intentTags: ["product"],
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      productId: { type: "string" },
      productName: { type: "string" },
      capacity: { type: "string" },
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
      data: buildAvailabilityDetails(product, extractString(capabilityArguments.capacity)),
    };
  },
});
