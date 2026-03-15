import apiClient from "../utils/axios";
import type { ApiResponse, Product, ProductStorageOption } from "../types/domain";

export const getProducts = () => apiClient.get<ApiResponse<Product[]>>("/products");

export const getProductById = (productId: string) =>
  apiClient.get<ApiResponse<Product>>(`/products/${productId}`);

export const createProduct = (categoryId: string, formData: FormData) =>
  apiClient.post<ApiResponse<Product>>(`/create-product/${categoryId}`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

export const updateProductStorageOptions = (productId: string, storageOptions: ProductStorageOption[]) =>
  apiClient.put<ApiResponse<Product>>(`/products/${productId}/storage-options`, {
    storageOptions,
  });
