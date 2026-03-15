export interface IphoneSwapCatalogEntry {
  model: string;
  capacities: string[];
}

export const iphoneSwapCatalog: IphoneSwapCatalogEntry[] = [
  { model: "iPhone XR", capacities: ["64GB", "128GB", "256GB"] },
  { model: "iPhone XS", capacities: ["64GB", "256GB", "512GB"] },
  { model: "iPhone XS Max", capacities: ["64GB", "256GB", "512GB"] },
  { model: "iPhone 11", capacities: ["64GB", "128GB", "256GB"] },
  { model: "iPhone 11 Pro", capacities: ["64GB", "256GB", "512GB"] },
  { model: "iPhone 11 Pro Max", capacities: ["64GB", "256GB", "512GB"] },
  { model: "iPhone 12 Mini", capacities: ["64GB", "128GB", "256GB"] },
  { model: "iPhone 12", capacities: ["64GB", "128GB", "256GB"] },
  { model: "iPhone 12 Pro", capacities: ["128GB", "256GB", "512GB"] },
  { model: "iPhone 12 Pro Max", capacities: ["128GB", "256GB", "512GB"] },
  { model: "iPhone 13 Mini", capacities: ["128GB", "256GB", "512GB"] },
  { model: "iPhone 13", capacities: ["128GB", "256GB", "512GB"] },
  { model: "iPhone 13 Pro", capacities: ["128GB", "256GB", "512GB", "1TB"] },
  { model: "iPhone 13 Pro Max", capacities: ["128GB", "256GB", "512GB", "1TB"] },
  { model: "iPhone 14", capacities: ["128GB", "256GB", "512GB"] },
  { model: "iPhone 14 Plus", capacities: ["128GB", "256GB", "512GB"] },
  { model: "iPhone 14 Pro", capacities: ["128GB", "256GB", "512GB", "1TB"] },
  { model: "iPhone 14 Pro Max", capacities: ["128GB", "256GB", "512GB", "1TB"] },
  { model: "iPhone 15", capacities: ["128GB", "256GB", "512GB"] },
  { model: "iPhone 15 Plus", capacities: ["128GB", "256GB", "512GB"] },
  { model: "iPhone 15 Pro", capacities: ["128GB", "256GB", "512GB", "1TB"] },
  { model: "iPhone 15 Pro Max", capacities: ["256GB", "512GB", "1TB"] },
  { model: "iPhone 16", capacities: ["128GB", "256GB", "512GB"] },
  { model: "iPhone 16 Plus", capacities: ["128GB", "256GB", "512GB"] },
  { model: "iPhone 16 Pro", capacities: ["128GB", "256GB", "512GB", "1TB"] },
  { model: "iPhone 16 Pro Max", capacities: ["256GB", "512GB", "1TB"] },
  { model: "iPhone 17", capacities: ["128GB", "256GB", "512GB"] },
  { model: "iPhone 17 Pro", capacities: ["128GB", "256GB", "512GB", "1TB"] },
  { model: "iPhone 17 Pro Max", capacities: ["256GB", "512GB", "1TB"] },
];

const baseSeriesPercentages = {
  XR: 79,
  "XS Max": 79,
  "11": 80,
  "12": 80,
  "13": 81,
  "14": 81,
  "15": 82,
  "16": 82,
  "17": 82,
} as const;

const variantAdders = {
  base: 0,
  Pro: 3,
  "Pro Max": 3.5,
} as const;

const parseSwapFactorPercentage = (model: string) => {
  const normalizedModel = model.replace(/^iPhone\s+/i, "").trim();

  if (normalizedModel === "XR") {
    return baseSeriesPercentages.XR;
  }

  if (normalizedModel === "XS Max") {
    return baseSeriesPercentages["XS Max"];
  }

  const proMaxMatch = normalizedModel.match(/^(\d+)\s+Pro Max$/i);
  if (proMaxMatch) {
    const series = proMaxMatch[1] as keyof typeof baseSeriesPercentages;
    const basePercentage = baseSeriesPercentages[series];
    if (basePercentage !== undefined) {
      return basePercentage + variantAdders["Pro Max"];
    }
  }

  const proMatch = normalizedModel.match(/^(\d+)\s+Pro$/i);
  if (proMatch) {
    const series = proMatch[1] as keyof typeof baseSeriesPercentages;
    const basePercentage = baseSeriesPercentages[series];
    if (basePercentage !== undefined) {
      return basePercentage + variantAdders.Pro;
    }
  }

  const baseMatch = normalizedModel.match(/^(\d+)(?:\s+(?:Mini|Plus))?$/i);
  if (baseMatch) {
    const series = baseMatch[1] as keyof typeof baseSeriesPercentages;
    const basePercentage = baseSeriesPercentages[series];
    if (basePercentage !== undefined) {
      return basePercentage + variantAdders.base;
    }
  }

  return null;
};

export const getIphoneSwapRate = (model: string) => {
  const percentage = parseSwapFactorPercentage(model);
  return (percentage ?? baseSeriesPercentages["11"]) / 100;
};
