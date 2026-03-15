import categoryModel from "../model/categoryModel";
import productModel from "../model/productModel";

export type ProductReadRecord = Record<string, unknown> & {
  _id?: unknown;
  name?: unknown;
  desc?: unknown;
  price?: unknown;
  qty?: unknown;
  image?: unknown;
  storageOptions?: unknown;
  category?: unknown;
  createdBy?: unknown;
};

type ProductStore = typeof productModel;
type CategoryStore = typeof categoryModel;

const PRODUCT_POPULATE = [
  {
    path: "category",
    select: "name slug",
  },
  {
    path: "createdBy",
    select: "userName email",
  },
];

const PRODUCT_SELECT = "name desc price qty storageOptions category createdBy image";

const normalizeText = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

export const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const buildCaseInsensitiveRegex = (value: string) => new RegExp(escapeRegex(value), "i");

const populateProductQuery = async (query: unknown) => {
  if (query && typeof query === "object" && "populate" in query && typeof query.populate === "function") {
    return (await query.populate(PRODUCT_POPULATE)) as ProductReadRecord | ProductReadRecord[] | null;
  }

  return (await Promise.resolve(query)) as ProductReadRecord | ProductReadRecord[] | null;
};

const resolveQueryResult = async (query: unknown) => {
  if (query && typeof query === "object" && "populate" in query && typeof query.populate === "function") {
    return populateProductQuery(query);
  }

  if (query && typeof query === "object" && "select" in query && typeof query.select === "function") {
    return (await Promise.resolve(query.select(PRODUCT_SELECT))) as ProductReadRecord | ProductReadRecord[] | null;
  }

  return (await Promise.resolve(query)) as ProductReadRecord | ProductReadRecord[] | null;
};

const defaultExpandQueryTerms = (query: string) =>
  normalizeText(query)
    .split(/\s+/)
    .filter(Boolean);

export const getProductById = async ({
  productId,
  productStore = productModel,
}: {
  productId: string;
  productStore?: ProductStore;
}) => {
  const normalizedProductId = String(productId ?? "").trim();
  if (!normalizedProductId) {
    return null;
  }

  return (await resolveQueryResult(productStore.findById(normalizedProductId))) as ProductReadRecord | null;
};

export const findProductByName = async ({
  productName,
  productStore = productModel,
}: {
  productName: string;
  productStore?: ProductStore;
}) => {
  const normalizedProductName = String(productName ?? "").trim();
  if (!normalizedProductName) {
    return null;
  }

  const exactMatch = (await resolveQueryResult(
    productStore.findOne({
      name: new RegExp(`^${escapeRegex(normalizedProductName)}$`, "i"),
    }),
  )) as ProductReadRecord | null;

  if (exactMatch) {
    return exactMatch;
  }

  return (await resolveQueryResult(
    productStore.findOne({
      name: buildCaseInsensitiveRegex(normalizedProductName),
    }),
  )) as ProductReadRecord | null;
};

export const resolveProductReference = async ({
  productId,
  productName,
  productStore = productModel,
}: {
  productId?: string;
  productName?: string;
  productStore?: ProductStore;
}) => {
  const byId = await getProductById({
    productId: String(productId ?? ""),
    productStore,
  });

  if (byId) {
    return byId;
  }

  return findProductByName({
    productName: String(productName ?? ""),
    productStore,
  });
};

export const listProducts = async ({
  productStore = productModel,
  limit = 50,
}: {
  productStore?: ProductStore;
  limit?: number;
}) => {
  const chain = productStore.find({}) as unknown as {
    limit?: (value: number) => unknown;
  };
  const limited = typeof chain.limit === "function" ? chain.limit(limit) : chain;

  return (await resolveQueryResult(limited)) as ProductReadRecord[];
};

export const searchProducts = async ({
  query,
  productStore = productModel,
  categoryStore = categoryModel,
  limit = 5,
  expandQueryTerms = defaultExpandQueryTerms,
}: {
  query: string;
  productStore?: ProductStore;
  categoryStore?: CategoryStore;
  limit?: number;
  expandQueryTerms?: (query: string) => string[];
}) => {
  const normalizedQuery = String(query ?? "").trim();
  if (!normalizedQuery) {
    return [];
  }

  const expandedTerms = expandQueryTerms(normalizedQuery);
  const matchingCategories = await categoryStore
    .find({ $or: expandedTerms.map((term) => ({ name: buildCaseInsensitiveRegex(term) })) })
    .select("_id name");
  const categoryIds = matchingCategories.map((category) => String(category._id));
  const chain = productStore.find({
    $or: [
      ...expandedTerms.flatMap((term) => [{ name: buildCaseInsensitiveRegex(term) }, { desc: buildCaseInsensitiveRegex(term) }]),
      ...(categoryIds.length ? [{ category: { $in: categoryIds } }] : []),
    ],
  }) as unknown as {
    limit?: (value: number) => unknown;
  };
  const limited = typeof chain.limit === "function" ? chain.limit(limit) : chain;

  return (await resolveQueryResult(limited)) as ProductReadRecord[];
};
