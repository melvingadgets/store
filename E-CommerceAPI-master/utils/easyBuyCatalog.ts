import { koboToNaira, type Kobo } from "@melvingadgets/platform-kit";
import { env } from "../config/env";
import { easyBuyClient } from "./platformClients";
import { SimpleTtlCache } from "./simpleTtlCache";

export interface PublicEasyBuyCatalogModel {
  model: string;
  imageUrl: string;
  capacities: string[];
  allowedPlans: Array<"Monthly" | "Weekly">;
  downPaymentPercentage: 40 | 60;
  pricesByCapacity: Record<string, number>;
}

export interface PublicEasyBuyCatalogPayload {
  models: PublicEasyBuyCatalogModel[];
  planRules: {
    monthlyDurations: number[];
    weeklyDurations: number[];
    monthlyMarkupMultipliers: Record<string, number>;
    weeklyMarkupMultipliers: Record<string, number>;
  };
}

const PUBLIC_CATALOG_CACHE_KEY = "public-easybuy-catalog";
const publicCatalogCache = new SimpleTtlCache<string, PublicEasyBuyCatalogPayload>(5 * 60 * 1000, 4);

const normalizeModelName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");

const compactModelName = (value: string) => normalizeModelName(value).replace(/\s+/g, "");

export const findPublicEasyBuyCatalogModel = (
  models: PublicEasyBuyCatalogModel[] | undefined,
  productName: string,
) => {
  const normalizedQuery = normalizeModelName(productName);
  const compactQuery = compactModelName(productName);

  return (
    (models ?? []).find((model) => normalizeModelName(model.model) === normalizedQuery) ??
    (models ?? []).find((model) => compactModelName(model.model) === compactQuery) ??
    (models ?? []).find((model) => compactModelName(model.model).includes(compactQuery)) ??
    (models ?? []).find((model) => compactQuery.includes(compactModelName(model.model))) ??
    null
  );
};

export const getCatalogPriceForCapacity = (
  productName: string,
  capacity: string | undefined,
  models: PublicEasyBuyCatalogModel[] | undefined,
  fallbackPrice: number,
) => {
  const catalogModel = findPublicEasyBuyCatalogModel(models, productName);
  if (!catalogModel) {
    return fallbackPrice;
  }

  const normalizedCapacity = String(capacity ?? "").trim().toUpperCase();
  const externalPrice = normalizedCapacity
    ? Number(catalogModel.pricesByCapacity[normalizedCapacity])
    : Number.NaN;

  if (Number.isFinite(externalPrice) && externalPrice > 0) {
    return externalPrice;
  }

  const lowestCatalogPrice = Object.values(catalogModel.pricesByCapacity)
    .map((price) => Number(price))
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((left, right) => left - right)[0];

  return lowestCatalogPrice ?? fallbackPrice;
};

// EasyBuy's service-token catalog (prices in integer kobo). Converted back to the naira
// shape the rest of the store uses, so callers don't change.
interface InternalEasyBuyCatalog {
  models: Array<Omit<PublicEasyBuyCatalogModel, "pricesByCapacity"> & { pricesByCapacity: Record<string, Kobo> }>;
  planRules: PublicEasyBuyCatalogPayload["planRules"];
}

const fetchInternalEasyBuyCatalog = async (): Promise<PublicEasyBuyCatalogPayload | null> => {
  if (!easyBuyClient) return null;
  try {
    const { data } = await easyBuyClient.request<InternalEasyBuyCatalog>({
      method: "GET",
      path: "/api/v1/internal/catalog",
      scopes: ["easybuy:catalog.read"],
      query: { provider: "aurapay" },
    });
    return {
      models: data.models.map((model) => ({
        ...model,
        pricesByCapacity: Object.fromEntries(
          Object.entries(model.pricesByCapacity).map(([capacity, price]) => [capacity, Number(koboToNaira(price))]),
        ),
      })),
      planRules: data.planRules,
    };
  } catch (error) {
    console.warn(`[easybuy-catalog] service-token catalog failed, using the public one: ${(error as Error).message}`);
    return null;
  }
};

export const fetchPublicEasyBuyCatalog = async () => {
  const cachedCatalog = publicCatalogCache.get(PUBLIC_CATALOG_CACHE_KEY);
  if (cachedCatalog) {
    return cachedCatalog;
  }

  const internalCatalog = await fetchInternalEasyBuyCatalog();
  if (internalCatalog) {
    publicCatalogCache.set(PUBLIC_CATALOG_CACHE_KEY, internalCatalog);
    return internalCatalog;
  }

  try {
    const response = await fetch(`${env.easyBuyTrackerBaseUrl}/api/v1/public/easybuy-catalog`);
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { data?: PublicEasyBuyCatalogPayload };
    if (!payload.data) {
      return null;
    }

    publicCatalogCache.set(PUBLIC_CATALOG_CACHE_KEY, payload.data);
    return payload.data;
  } catch {
    return null;
  }
};

/** EasyBuy's instalment quote, in integer kobo (INTEGRATION-PLAN.md §5), or null when unavailable. */
export interface EasyBuyQuote {
  provider: string;
  model: string;
  capacity: string;
  plan: "Monthly" | "Weekly";
  duration: number;
  unit: "kobo";
  phonePrice: Kobo;
  downPaymentPercentage: number;
  minimumDownPayment: Kobo;
  downPayment: Kobo;
  loanedAmount: Kobo;
  markupMultiplier: number;
  totalRepayable: Kobo;
  instalments: Kobo[];
}

export const fetchEasyBuyQuote = async (input: {
  model: string;
  capacity: string;
  plan: "Monthly" | "Weekly";
  duration: number;
  downPayment?: Kobo;
  traceId?: string;
}): Promise<EasyBuyQuote | null> => {
  if (!easyBuyClient) return null;
  try {
    const { data } = await easyBuyClient.request<EasyBuyQuote>({
      method: "GET",
      path: "/api/v1/internal/quote",
      scopes: ["easybuy:quote.read"],
      query: {
        provider: "aurapay",
        model: input.model,
        capacity: input.capacity,
        plan: input.plan,
        duration: input.duration,
        downPayment: input.downPayment,
      },
      ...(input.traceId ? { traceId: input.traceId } : {}),
    });
    return data;
  } catch {
    return null;
  }
};
