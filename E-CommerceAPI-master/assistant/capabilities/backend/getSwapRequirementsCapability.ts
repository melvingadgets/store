import type { AssistantCapability } from "../../assistantTypes";
import { buildSwapRequirements } from "../../swapFoundation";

export const getSwapRequirementsCapability = (): AssistantCapability => ({
  name: "get_swap_requirements",
  description: "Explain what details are required before a swap estimate can be returned.",
  source: "backend_service",
  intentTags: ["trade_in"],
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {},
  },
  async execute() {
    return {
      ok: true,
      data: buildSwapRequirements(),
    };
  },
});
