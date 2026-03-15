import apiClient from "../utils/axios";
import type { ApiResponse, CartRecord } from "../types/domain";

export interface SessionCartItemPayload {
  productId: string;
  quantity: number;
  capacity?: string;
}

export interface SyncSessionCartPayload {
  sessionId: string;
  items: SessionCartItemPayload[];
}

export const getCart = () => apiClient.get<ApiResponse<CartRecord>>("/cart-items");

export const addCartItem = (productId: string, capacity?: string) =>
  apiClient.post<ApiResponse<CartRecord>>(`/cart-items/${productId}`, { capacity });

export const decrementCartItem = (productId: string, capacity?: string) =>
  apiClient.delete<ApiResponse<CartRecord>>(`/cart-items/${productId}`, {
    params: {
      capacity,
    },
  });

export const removeCartItemCompletely = (productId: string, capacity?: string) =>
  apiClient.delete<ApiResponse<CartRecord>>("/remove-item", {
    params: {
      productId,
      capacity,
      removeAll: true,
    },
  });

export const syncSessionCart = (payload: SyncSessionCartPayload) =>
  apiClient.post<ApiResponse<CartRecord>>("/cart-sync", payload);
