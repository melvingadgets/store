import apiClient from "../utils/axios";
import type { ApiResponse, CheckoutRecord, GuestCheckoutGuest, OrderRecord } from "../types/domain";

export interface CheckoutItemPayload {
  productId: string;
  quantity: number;
  capacity?: string;
}

export interface CheckoutPayload {
  paymentReference?: string;
  items?: CheckoutItemPayload[];
}

export const checkoutOrder = (payload: CheckoutPayload) =>
  apiClient.post<ApiResponse<OrderRecord>>("/order-checkout", payload);

export interface GuestCheckoutPayload {
  paymentReference?: string;
  items: CheckoutItemPayload[];
  guest: GuestCheckoutGuest;
}

export const checkoutGuestOrder = (payload: GuestCheckoutPayload) =>
  apiClient.post<ApiResponse<CheckoutRecord>>("/guest-checkout", payload);

export const getOrders = () => apiClient.get<ApiResponse<OrderRecord[]>>("/orders");

// What an order costs before checkout (Shortwork/RESELLER-PLAN.md §8a), in integer kobo. While
// fees are off on the API, `enabled` is false and the checkout shows the item total only.
export interface DeliveryQuote {
  enabled: boolean;
  subtotalKobo: number;
  deliveryFeeKobo: number;
  serviceFeeKobo: number;
  totalKobo: number;
  mock: boolean;
}

export const getDeliveryQuote = (items: CheckoutItemPayload[], destination?: string) =>
  apiClient.post<ApiResponse<DeliveryQuote>>("/delivery-quote", { items, ...(destination ? { destination } : {}) });
