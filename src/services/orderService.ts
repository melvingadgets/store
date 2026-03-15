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
