import categoryModel from "../model/categoryModel";
import productModel from "../model/productModel";
import {
  buildCaseInsensitiveRegex,
  findProductByName as findSharedProductByName,
  getProductById as fetchSharedProductById,
  listProducts as listSharedProducts,
  resolveProductReference as resolveSharedProductReference,
  searchProducts as searchSharedProducts,
  type ProductReadRecord as AssistantProductRecord,
} from "../services/productReadService";
import {
  fetchPublicEasyBuyCatalog,
  findPublicEasyBuyCatalogModel,
  type PublicEasyBuyCatalogModel,
} from "../utils/easyBuyCatalog";

type ProductStore = typeof productModel;
type CategoryStore = typeof categoryModel;

const keywordAliases: Record<string, string[]> = {
  phone: ["phones", "smartphone", "iphone", "device"],
  iphone: ["apple phone", "phone"],
  camera: ["photo", "photos", "picture", "pictures"],
  battery: ["power", "long lasting", "lasting"],
  cheap: ["budget", "affordable", "under"],
  premium: ["pro", "flagship", "best"],
};

export const extractString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export const buildRegex = (value: string) => buildCaseInsensitiveRegex(value);

export const normalizeCapacity = (value: string | undefined) => String(value ?? "").trim().toUpperCase();

export const formatNaira = (value: number) => `₦${Math.round(Number(value) || 0).toLocaleString("en-NG")}`;

export const mapStorageOptions = (storageOptions: unknown) =>
  Array.isArray(storageOptions)
    ? storageOptions.map((option: { capacity: string; price: number; qty: number }) => ({
        capacity: String(option.capacity ?? ""),
        price: Number(option.price ?? 0),
        qty: Number(option.qty ?? 0),
        inStock: Number(option.qty ?? 0) > 0,
      }))
    : [];

const normalizeText = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

const expandQueryTerms = (query: string) => {
  const tokens = normalizeText(query)
    .split(/\s+/)
    .filter(Boolean);
  const expanded = new Set<string>();

  tokens.forEach((token) => {
    expanded.add(token);
    (keywordAliases[token] ?? []).forEach((alias) => expanded.add(alias));
  });

  return [...expanded];
};

const buildSearchableText = (product: AssistantProductRecord) =>
  normalizeText(
    [
      String(product.name ?? ""),
      String(product.desc ?? ""),
      getCategoryName(product.category) ?? "",
      ...mapStorageOptions(product.storageOptions).map((option) => option.capacity),
    ].join(" "),
  );

const getCategoryName = (category: unknown) =>
  category && typeof category === "object" && "name" in category ? String((category as { name?: unknown }).name ?? "") : undefined;

const normalizeModelName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

const buildCatalogStorageOptions = (catalogModel: PublicEasyBuyCatalogModel, localProduct?: AssistantProductRecord | null) => {
  const localStorageOptions = mapStorageOptions(localProduct?.storageOptions);

  return Object.entries(catalogModel.pricesByCapacity)
    .map(([capacity, price]) => {
      const localMatch = localStorageOptions.find((option) => normalizeCapacity(option.capacity) === normalizeCapacity(capacity));
      return {
        capacity,
        price: Number(price ?? 0),
        qty: localMatch ? localMatch.qty : Number(localProduct?.qty ?? 0),
        inStock: localMatch ? localMatch.inStock : Number(localProduct?.qty ?? 0) > 0,
      };
    })
    .filter((option) => Number.isFinite(option.price) && option.price > 0);
};

const toCatalogBackedRecord = ({
  catalogModel,
  localProduct,
}: {
  catalogModel: PublicEasyBuyCatalogModel;
  localProduct?: AssistantProductRecord | null;
}): AssistantProductRecord => {
  const storageOptions = buildCatalogStorageOptions(catalogModel, localProduct);
  const lowestPrice =
    storageOptions
      .map((option) => option.price)
      .filter((price) => Number.isFinite(price) && price > 0)
      .sort((left, right) => left - right)[0] ?? Number(localProduct?.price ?? 0);

  return {
    _id: localProduct?._id ?? `catalog:${normalizeModelName(catalogModel.model)}`,
    name: catalogModel.model,
    desc: localProduct?.desc ?? "",
    price: lowestPrice,
    qty: localProduct?.qty ?? 0,
    storageOptions,
    category: localProduct?.category,
    image: localProduct?.image ?? catalogModel.imageUrl,
    createdBy: localProduct?.createdBy,
    stockKnown: Boolean(localProduct),
    allowedPlans: catalogModel.allowedPlans,
    downPaymentPercentage: catalogModel.downPaymentPercentage,
    catalogBacked: true,
  };
};

const mergeCatalogWithLocalProducts = ({
  models,
  localProducts,
}: {
  models: PublicEasyBuyCatalogModel[];
  localProducts: AssistantProductRecord[];
}) => {
  const localByName = new Map(
    localProducts.map((product) => [normalizeModelName(String(product.name ?? "")), product]),
  );

  return models.map((catalogModel) =>
    toCatalogBackedRecord({
      catalogModel,
      localProduct: localByName.get(normalizeModelName(catalogModel.model)) ?? null,
    }),
  );
};

const getCatalogBackedProducts = async ({
  productStore = productModel,
}: {
  productStore?: ProductStore;
}) => {
  const catalog = await fetchPublicEasyBuyCatalog();
  if (!catalog?.models?.length) {
    return null;
  }

  const localProducts = await listSharedProducts({
    productStore,
    limit: Math.max(catalog.models.length, 50),
  });

  return {
    catalog,
    products: mergeCatalogWithLocalProducts({
      models: catalog.models,
      localProducts,
    }),
  };
};

export const fetchProductById = async (productStore: ProductStore, productId: string) =>
  fetchSharedProductById({
    productStore,
    productId,
  });

export const findProductByName = async (productStore: ProductStore, productName: string) => {
  return findSharedProductByName({
    productStore,
    productName,
  });
};

export const resolveProductReference = async ({
  productStore,
  productId,
  productName,
}: {
  productStore: ProductStore;
  productId?: string;
  productName?: string;
}) => {
  const normalizedProductId = extractString(productId);
  const normalizedProductName = extractString(productName);
  const catalogBacked = await getCatalogBackedProducts({
    productStore,
  });

  if (catalogBacked) {
    if (normalizedProductId) {
      const localProduct = await fetchSharedProductById({
        productStore,
        productId: normalizedProductId,
      });
      const localProductName = extractString(localProduct?.name);
      if (localProductName) {
        const catalogModel = findPublicEasyBuyCatalogModel(catalogBacked.catalog.models, localProductName);
        if (catalogModel) {
          return toCatalogBackedRecord({
            catalogModel,
            localProduct,
          });
        }
      }

      if (localProduct) {
        return localProduct;
      }
    }

    if (normalizedProductName) {
      const exactCatalogModel =
        findPublicEasyBuyCatalogModel(catalogBacked.catalog.models, normalizedProductName) ??
        catalogBacked.catalog.models.find((model) => buildRegex(model.model).test(normalizedProductName)) ??
        catalogBacked.catalog.models.find((model) => buildRegex(normalizedProductName).test(model.model));

      if (exactCatalogModel) {
        const localProduct = await findSharedProductByName({
          productStore,
          productName: exactCatalogModel.model,
        });
        return toCatalogBackedRecord({
          catalogModel: exactCatalogModel,
          localProduct,
        });
      }
    }
  }

  return resolveSharedProductReference({
    productStore,
    productId: normalizedProductId,
    productName: normalizedProductName,
  });
};

export const searchProducts = async ({
  query,
  productStore = productModel,
  categoryStore = categoryModel,
  limit = 5,
}: {
  query: string;
  productStore?: ProductStore;
  categoryStore?: CategoryStore;
  limit?: number;
}) => {
  const normalizedQuery = extractString(query);
  if (!normalizedQuery) {
    return [];
  }

  const catalogBacked = await getCatalogBackedProducts({
    productStore,
  });

  if (catalogBacked) {
    const expandedTerms = expandQueryTerms(normalizedQuery);
    return catalogBacked.products
      .filter((product) => {
        const searchableText = buildSearchableText(product);
        return expandedTerms.some((term) => searchableText.includes(normalizeText(term)));
      })
      .slice(0, limit);
  }

  return searchSharedProducts({
    query: normalizedQuery,
    productStore,
    categoryStore,
    limit,
    expandQueryTerms,
  });
};

export const listProducts = async ({
  productStore = productModel,
  limit = 50,
}: {
  productStore?: ProductStore;
  limit?: number;
}) => {
  const catalogBacked = await getCatalogBackedProducts({
    productStore,
  });

  if (catalogBacked) {
    return catalogBacked.products.slice(0, limit);
  }

  return listSharedProducts({
    productStore,
    limit,
  });
};

export const toProductListItem = (product: AssistantProductRecord) => ({
  productId: String(product._id ?? ""),
  name: String(product.name ?? ""),
  description: String(product.desc ?? ""),
  startingPrice: Number(product.price ?? 0),
  capacities: mapStorageOptions(product.storageOptions).map((option) => option.capacity),
  inStock: Number(product.qty ?? 0) > 0 || mapStorageOptions(product.storageOptions).some((option) => option.inStock),
  categoryName: getCategoryName(product.category),
});

export const toProductDetail = (product: AssistantProductRecord) => ({
  productId: String(product._id ?? ""),
  name: String(product.name ?? ""),
  description: String(product.desc ?? ""),
  price: Number(product.price ?? 0),
  qty: Number(product.qty ?? 0),
  capacities: mapStorageOptions(product.storageOptions).map((option) => ({
    capacity: option.capacity,
    price: option.price,
    qty: option.qty,
  })),
  categoryName: getCategoryName(product.category),
});

export const buildPricingOptions = (product: AssistantProductRecord, requestedCapacity?: string) => {
  const normalizedCapacity = normalizeCapacity(requestedCapacity);
  const storageOptions = mapStorageOptions(product.storageOptions);
  const matchedOption = normalizedCapacity
    ? storageOptions.find((option) => normalizeCapacity(option.capacity) === normalizedCapacity) ?? null
    : null;

  return {
    productId: String(product._id ?? ""),
    name: String(product.name ?? ""),
    basePrice: Number(product.price ?? 0),
    currency: "NGN",
    inStock: Number(product.qty ?? 0) > 0 || storageOptions.some((option) => option.inStock),
    pricingOptions: storageOptions,
    requestedCapacity: normalizedCapacity || undefined,
    requestedCapacityMatch: matchedOption,
    requestedCapacityAvailable: normalizedCapacity ? Boolean(matchedOption) : undefined,
  };
};

export const buildAvailabilityDetails = (product: AssistantProductRecord, requestedCapacity?: string) => {
  const pricingOptions = buildPricingOptions(product, requestedCapacity);
  const availableCapacities = pricingOptions.pricingOptions.filter((option) => option.inStock).map((option) => option.capacity);
  const matched = pricingOptions.requestedCapacityMatch;
  const stockKnown = product.catalogBacked ? Boolean(product.stockKnown) : true;

  return {
    productId: pricingOptions.productId,
    name: pricingOptions.name,
    requestedCapacity: pricingOptions.requestedCapacity,
    available: stockKnown ? (matched ? matched.inStock : pricingOptions.inStock) : undefined,
    availableCapacities,
    unavailableCapacities: pricingOptions.pricingOptions.filter((option) => !option.inStock).map((option) => option.capacity),
    requestedCapacityInStock: stockKnown ? (matched ? matched.inStock : undefined) : undefined,
    stockKnown,
    summary: !stockKnown
      ? matched
        ? `${pricingOptions.name} ${matched.capacity} is listed at ${formatNaira(matched.price)}. Live stock is not confirmed in the current catalog feed.`
        : `${pricingOptions.name} pricing is available in ${pricingOptions.pricingOptions.map((option) => option.capacity).join(", ")}. Live stock is not confirmed in the current catalog feed.`
      : matched
        ? matched.inStock
          ? `${pricingOptions.name} ${matched.capacity} is currently available at ${formatNaira(matched.price)}.`
          : `${pricingOptions.name} ${matched.capacity} is currently unavailable.`
        : availableCapacities.length
          ? `${pricingOptions.name} is available in ${availableCapacities.join(", ")}.`
          : `${pricingOptions.name} is currently unavailable.`,
  };
};

export const buildProductComparison = (primary: AssistantProductRecord, secondary: AssistantProductRecord) => {
  const primaryPricing = buildPricingOptions(primary);
  const secondaryPricing = buildPricingOptions(secondary);
  const primaryCapacities = new Set(primaryPricing.pricingOptions.map((option) => option.capacity));
  const secondaryCapacities = new Set(secondaryPricing.pricingOptions.map((option) => option.capacity));
  const commonCapacities = [...primaryCapacities].filter((capacity) => secondaryCapacities.has(capacity));
  const priceDifference = Math.abs(primaryPricing.basePrice - secondaryPricing.basePrice);
  const cheaperProductId =
    primaryPricing.basePrice === secondaryPricing.basePrice
      ? undefined
      : primaryPricing.basePrice < secondaryPricing.basePrice
        ? primaryPricing.productId
        : secondaryPricing.productId;

  const highlights: string[] = [];
  if (priceDifference > 0) {
    const cheaperName = cheaperProductId === primaryPricing.productId ? primaryPricing.name : secondaryPricing.name;
    highlights.push(`${cheaperName} starts at ${formatNaira(Math.min(primaryPricing.basePrice, secondaryPricing.basePrice))}.`);
  }
  if (commonCapacities.length) {
    highlights.push(`Both models are available in ${commonCapacities.join(", ")}.`);
  }
  if (primaryPricing.inStock !== secondaryPricing.inStock) {
    highlights.push(
      `${primaryPricing.inStock ? primaryPricing.name : secondaryPricing.name} is currently easier to buy because it has stock available.`,
    );
  }

  return {
    products: [
      {
        ...toProductListItem(primary),
        pricingOptions: primaryPricing.pricingOptions,
      },
      {
        ...toProductListItem(secondary),
        pricingOptions: secondaryPricing.pricingOptions,
      },
    ],
    comparison: {
      commonCapacities,
      priceDifference,
      cheaperProductId,
      cheaperProductName:
        cheaperProductId === primaryPricing.productId
          ? primaryPricing.name
          : cheaperProductId === secondaryPricing.productId
            ? secondaryPricing.name
            : undefined,
      sameCategory: getCategoryName(primary.category) === getCategoryName(secondary.category),
      highlights,
    },
  };
};

const scoreProductMatch = ({
  product,
  query,
  maxBudget,
  preferredCapacity,
}: {
  product: AssistantProductRecord;
  query?: string;
  maxBudget?: number;
  preferredCapacity?: string;
}) => {
  const text = `${String(product.name ?? "")} ${String(product.desc ?? "")} ${getCategoryName(product.category) ?? ""}`.toLowerCase();
  const tokens = expandQueryTerms(query ?? "");
  const storageOptions = mapStorageOptions(product.storageOptions);
  let score = 0;

  tokens.forEach((token) => {
    if (text.includes(token)) {
      score += 3;
    }
  });

  if (buildSearchableText(product).includes(normalizeText(query ?? ""))) {
    score += 4;
  }

  if (Number(product.qty ?? 0) > 0 || storageOptions.some((option) => option.inStock)) {
    score += 4;
  }

  if (typeof maxBudget === "number" && maxBudget > 0) {
    if (Number(product.price ?? 0) <= maxBudget) {
      score += 5;
    } else {
      score -= Math.min(6, Math.ceil((Number(product.price ?? 0) - maxBudget) / 100000));
    }
  }

  if (preferredCapacity) {
    const normalizedCapacity = normalizeCapacity(preferredCapacity);
    if (storageOptions.some((option) => normalizeCapacity(option.capacity) === normalizedCapacity)) {
      score += 4;
    }
  }

  return score;
};

export const buildBestMatchResults = ({
  products,
  query,
  maxBudget,
  preferredCapacity,
  limit = 3,
}: {
  products: AssistantProductRecord[];
  query?: string;
  maxBudget?: number;
  preferredCapacity?: string;
  limit?: number;
}) => {
  const ranked = [...products]
    .map((product) => ({
      product,
      score: scoreProductMatch({
        product,
        query,
        maxBudget,
        preferredCapacity,
      }),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      const leftInStock =
        Number(left.product.qty ?? 0) > 0 || mapStorageOptions(left.product.storageOptions).some((option) => option.inStock);
      const rightInStock =
        Number(right.product.qty ?? 0) > 0 || mapStorageOptions(right.product.storageOptions).some((option) => option.inStock);

      if (leftInStock !== rightInStock) {
        return rightInStock ? 1 : -1;
      }

      return Number(left.product.price ?? 0) - Number(right.product.price ?? 0);
    })
    .slice(0, limit);

  return ranked.map(({ product, score }) => ({
    ...toProductListItem(product),
    score,
  }));
};
