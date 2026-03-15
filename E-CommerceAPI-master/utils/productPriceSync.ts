import type { PublicEasyBuyCatalogModel } from "./easyBuyCatalog";
import { normalizeCapacity, type StorageOption } from "./storageOptions";

export interface ProductPriceSyncTarget {
  name: string;
  price: number;
  storageOptions?: StorageOption[];
}

export interface ProductPriceSyncResult {
  changed: boolean;
  matchedModel: boolean;
  matchedCapacities: string[];
  updatedProduct: {
    price: number;
    storageOptions: StorageOption[];
  };
}

const normalizeProductName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
const MIN_REASONABLE_CATALOG_PRICE = 100000;

const getCatalogPriceEntries = (catalogModel: PublicEasyBuyCatalogModel) =>
  Object.entries(catalogModel.pricesByCapacity)
    .map(([capacity, price]) => ({
      capacity: normalizeCapacity(capacity),
      price: Math.round(Number(price)),
    }))
    .filter(
      (entry) =>
        entry.capacity &&
        Number.isFinite(entry.price) &&
        entry.price >= MIN_REASONABLE_CATALOG_PRICE,
    );

export const findCatalogModelForProduct = (
  productName: string,
  catalogModels: PublicEasyBuyCatalogModel[],
) =>
  catalogModels.find(
    (catalogModel) => normalizeProductName(catalogModel.model) === normalizeProductName(productName),
  ) ?? null;

export const syncProductPricesFromCatalog = (
  product: ProductPriceSyncTarget,
  catalogModel: PublicEasyBuyCatalogModel | null,
): ProductPriceSyncResult => {
  const existingStorageOptions = Array.isArray(product.storageOptions) ? product.storageOptions : [];

  if (!catalogModel) {
    return {
      changed: false,
      matchedModel: false,
      matchedCapacities: [],
      updatedProduct: {
        price: product.price,
        storageOptions: existingStorageOptions,
      },
    };
  }

  const catalogPriceEntries = getCatalogPriceEntries(catalogModel);
  const catalogPriceByCapacity = new Map(
    catalogPriceEntries.map((entry) => [entry.capacity, entry.price] as const),
  );

  const matchedCapacities: string[] = [];

  const updatedStorageOptions = existingStorageOptions.map((option) => {
    const normalizedCapacity = normalizeCapacity(option.capacity);
    const catalogPrice = catalogPriceByCapacity.get(normalizedCapacity);

    if (!catalogPrice) {
      return {
        capacity: normalizedCapacity,
        price: Math.round(Number(option.price)),
        qty: Math.max(0, Math.floor(Number(option.qty))),
      };
    }

    matchedCapacities.push(normalizedCapacity);

    return {
      capacity: normalizedCapacity,
      price: catalogPrice,
      qty: Math.max(0, Math.floor(Number(option.qty))),
    };
  });

  const lowestMatchedCatalogPrice = matchedCapacities
    .map((capacity) => catalogPriceByCapacity.get(capacity))
    .filter((price): price is number => Number.isFinite(price))
    .sort((left, right) => left - right)[0];

  const nextPrice =
    lowestMatchedCatalogPrice ??
    getCatalogPriceEntries(catalogModel)
      .map((entry) => entry.price)
      .sort((left, right) => left - right)[0] ??
    Math.round(Number(product.price));

  const normalizedCurrentPrice = Math.round(Number(product.price));
  const changed =
    normalizedCurrentPrice !== nextPrice ||
    updatedStorageOptions.length !== existingStorageOptions.length ||
    updatedStorageOptions.some((option, index) => {
      const currentOption = existingStorageOptions[index];

      return (
        normalizeCapacity(currentOption?.capacity) !== option.capacity ||
        Math.round(Number(currentOption?.price)) !== option.price ||
        Math.max(0, Math.floor(Number(currentOption?.qty))) !== option.qty
      );
    });

  return {
    changed,
    matchedModel: true,
    matchedCapacities,
    updatedProduct: {
      price: nextPrice,
      storageOptions: updatedStorageOptions,
    },
  };
};
