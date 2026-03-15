export interface StorageOptionSeed {
  capacity: string;
  price: number;
  qty: number;
}

const iphoneCapacityCatalog: Record<string, string[]> = {
  "iPhone XR": ["64GB", "128GB", "256GB"],
  "iPhone XS": ["64GB", "256GB", "512GB"],
  "iPhone XS Max": ["64GB", "256GB", "512GB"],
  "iPhone 11": ["64GB", "128GB", "256GB"],
  "iPhone 11 Pro": ["64GB", "256GB", "512GB"],
  "iPhone 11 Pro Max": ["64GB", "256GB", "512GB"],
  "iPhone 12 Mini": ["64GB", "128GB", "256GB"],
  "iPhone 12": ["64GB", "128GB", "256GB"],
  "iPhone 12 Pro": ["128GB", "256GB", "512GB"],
  "iPhone 12 Pro Max": ["128GB", "256GB", "512GB"],
  "iPhone 13 Mini": ["128GB", "256GB", "512GB"],
  "iPhone 13": ["128GB", "256GB", "512GB"],
  "iPhone 13 Pro": ["128GB", "256GB", "512GB", "1TB"],
  "iPhone 13 Pro Max": ["128GB", "256GB", "512GB", "1TB"],
  "iPhone 14": ["128GB", "256GB", "512GB"],
  "iPhone 14 Plus": ["128GB", "256GB", "512GB"],
  "iPhone 14 Pro": ["128GB", "256GB", "512GB", "1TB"],
  "iPhone 14 Pro Max": ["128GB", "256GB", "512GB", "1TB"],
  "iPhone 15": ["128GB", "256GB", "512GB"],
  "iPhone 15 Plus": ["128GB", "256GB", "512GB"],
  "iPhone 15 Pro": ["128GB", "256GB", "512GB", "1TB"],
  "iPhone 15 Pro Max": ["256GB", "512GB", "1TB"],
  "iPhone 16": ["128GB", "256GB", "512GB"],
  "iPhone 16 Plus": ["128GB", "256GB", "512GB"],
  "iPhone 16 Pro": ["128GB", "256GB", "512GB", "1TB"],
  "iPhone 16 Pro Max": ["256GB", "512GB", "1TB"],
  "iPhone 17": ["128GB", "256GB", "512GB"],
  "iPhone 17 Pro": ["128GB", "256GB", "512GB", "1TB"],
  "iPhone 17 Pro Max": ["256GB", "512GB", "1TB"],
};

const capacityPriceOffsets: Record<string, number> = {
  "64GB": 0,
  "128GB": 90000,
  "256GB": 210000,
  "512GB": 430000,
  "1TB": 680000,
};

const distributeQty = (totalQty: number, count: number) => {
  const safeTotalQty = Math.max(count, Math.floor(totalQty));
  const baseQty = Math.floor(safeTotalQty / count);
  let remainder = safeTotalQty % count;

  return Array.from({ length: count }, () => {
    const value = baseQty + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
    return value;
  });
};

export const getIphoneCapacities = (productName: string) => iphoneCapacityCatalog[productName] ?? [];

export const hasIphoneCapacityPreset = (productName: string) => getIphoneCapacities(productName).length > 0;

export const buildIphoneStorageOptions = (
  productName: string,
  basePrice: number,
  totalQty: number,
): StorageOptionSeed[] => {
  const capacities = getIphoneCapacities(productName);

  if (capacities.length === 0) {
    return [];
  }

  const baseCapacity = capacities[0];
  const baseOffset = capacityPriceOffsets[baseCapacity] ?? 0;
  const qtyDistribution = distributeQty(totalQty, capacities.length);

  return capacities.map((capacity, index) => ({
    capacity,
    price: Math.max(0, Math.round(basePrice + ((capacityPriceOffsets[capacity] ?? 0) - baseOffset))),
    qty: qtyDistribution[index],
  }));
};
