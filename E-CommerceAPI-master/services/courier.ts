import { kobo, type Kobo } from "@melvingadgets/platform-kit";

// Delivery quotes (Shortwork/RESELLER-PLAN.md R7). The delivery fee is whatever the integrated
// courier's API quotes; the store's service fee is 2.5 × that quote (utils/orderFees.ts).
//
// No courier is integrated yet, so the only provider is a MOCK with placeholder prices. It is
// logged in Shortwork/MOCK-DATA-REVIEW.md. A real courier implements CourierProvider and is
// selected with COURIER_PROVIDER; nothing else changes.

export interface DeliveryQuoteRequest {
  /** Items being delivered; a courier may price by count or weight. */
  readonly items: ReadonlyArray<{ readonly quantity: number }>;
  /** Free-text delivery address, when the checkout has one. */
  readonly destination?: string;
}

export interface DeliveryQuote {
  readonly courier: string;
  readonly deliveryFeeKobo: Kobo;
  /** True for placeholder prices that must never be charged to a real customer. */
  readonly mock: boolean;
  readonly quotedAt: Date;
}

export interface CourierProvider {
  readonly name: string;
  quote(request: DeliveryQuoteRequest): Promise<DeliveryQuote>;
}

// MOCK prices: ₦3,500 for the first item plus ₦1,000 for each extra item, in kobo.
// Placeholder numbers only, to exercise the fee pipeline; see MOCK-DATA-REVIEW.md.
export const MOCK_FIRST_ITEM_KOBO = kobo(350_000);
export const MOCK_EXTRA_ITEM_KOBO = kobo(100_000);

export const mockCourier: CourierProvider = {
  name: "mock",
  quote: async ({ items }) => {
    const count = items.reduce((total, item) => total + Math.max(1, Math.floor(item.quantity)), 0);
    const extra = Math.max(0, count - 1);
    return {
      courier: "mock",
      deliveryFeeKobo: kobo(MOCK_FIRST_ITEM_KOBO + extra * MOCK_EXTRA_ITEM_KOBO),
      mock: true,
      quotedAt: new Date(),
    };
  },
};

const PROVIDERS: Record<string, CourierProvider> = { mock: mockCourier };

export const getCourier = (name: string): CourierProvider => {
  const provider = PROVIDERS[name];
  if (!provider) throw new Error(`Unknown COURIER_PROVIDER "${name}"`);
  return provider;
};
