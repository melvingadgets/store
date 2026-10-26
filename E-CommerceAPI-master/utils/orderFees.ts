import { addKobo, kobo, multiplyKobo, nairaToKobo, type Kobo } from "@melvingadgets/platform-kit";
import { env } from "../config/env";
import { getCourier, type DeliveryQuote } from "../services/courier";

// What a store order costs (Shortwork/RESELLER-PLAN.md §8a). Product prices are the vendors' own,
// unmarked; the service fee (2.5 × the courier's delivery quote, half-up to the kobo) is our
// income and is never refunded. Everything here is integer kobo (Shortwork/AGENTS.md §4.1).

export interface OrderFees {
  subtotalKobo: Kobo;
  deliveryFeeKobo: Kobo;
  serviceFeeKobo: Kobo;
  totalKobo: Kobo;
  /** "courier:<name>" when a quote was used, "disabled" while fees are off. */
  feeSource: string;
  /** True when the delivery quote is placeholder data (no real courier yet). */
  mock: boolean;
}

/** The store keeps naira as plain numbers; fix to two decimals before converting. */
export const nairaNumberToKobo = (naira: number): Kobo => nairaToKobo(Number(naira).toFixed(2));

export const subtotalKoboOf = (items: ReadonlyArray<{ quantity: number; price: number }>): Kobo =>
  addKobo(...items.map((item) => kobo(nairaNumberToKobo(item.price) * Math.max(1, Math.floor(item.quantity)))), kobo(0));

export const serviceFeeFor = (deliveryFeeKobo: Kobo, multiplier: string = env.fees.serviceFeeMultiplier): Kobo =>
  multiplyKobo(deliveryFeeKobo, multiplier);

export const feesFromQuote = (subtotalKobo: Kobo, quote: DeliveryQuote, multiplier?: string): OrderFees => {
  const serviceFeeKobo = serviceFeeFor(quote.deliveryFeeKobo, multiplier);
  return {
    subtotalKobo,
    deliveryFeeKobo: quote.deliveryFeeKobo,
    serviceFeeKobo,
    totalKobo: addKobo(subtotalKobo, quote.deliveryFeeKobo, serviceFeeKobo),
    feeSource: `courier:${quote.courier}`,
    mock: quote.mock,
  };
};

/** Fees for a checkout. With fees off, the order costs its items only, as before. */
export const computeOrderFees = async (
  items: ReadonlyArray<{ quantity: number; price: number }>,
  destination?: string,
): Promise<OrderFees> => {
  const subtotalKobo = subtotalKoboOf(items);
  if (!env.fees.enabled) {
    return { subtotalKobo, deliveryFeeKobo: kobo(0), serviceFeeKobo: kobo(0), totalKobo: subtotalKobo, feeSource: "disabled", mock: false };
  }
  const quote = await getCourier(env.fees.courier).quote({ items, destination });
  return feesFromQuote(subtotalKobo, quote);
};
