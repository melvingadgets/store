import categoryModel from "../../../model/categoryModel";
import productModel from "../../../model/productModel";
import type { AssistantCapability } from "../../assistantTypes";
import { extractString, searchProducts, toProductListItem } from "../../productFoundation";

export const searchProductsCapability = ({
  productStore = productModel,
  categoryStore = categoryModel,
}: {
  productStore?: typeof productModel;
  categoryStore?: typeof categoryModel;
} = {}): AssistantCapability => ({
  name: "search_products",
  description: "Search the product catalog by model, description, or category keywords.",
  source: "backend_service",
  intentTags: ["product"],
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      query: { type: "string" },
    },
    required: ["query"],
  },
  async execute({ arguments: capabilityArguments }) {
    const query = extractString(capabilityArguments.query);
    if (!query) {
      return {
        ok: false,
        error: "A search query is required.",
      };
    }

    const products = await searchProducts({
      query,
      productStore,
      categoryStore,
    });

    return {
      ok: true,
      data: {
        products: products.map(toProductListItem),
      },
    };
  },
});
