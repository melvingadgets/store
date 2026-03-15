import apiClient from "../utils/axios";
import type { ApiResponse, Category } from "../types/domain";

export interface CategoryPayload {
  name: string;
  parent?: string;
}

export const getCategories = () => apiClient.get<ApiResponse<Category[]>>("/categories");

export const getCategoryById = (categoryId: string) =>
  apiClient.get<ApiResponse<Category>>(`/categories/${categoryId}`);

export const createCategory = (payload: CategoryPayload) =>
  apiClient.post<ApiResponse<Category>>("/create-category", payload);

export const deleteCategory = (categoryId: string) =>
  apiClient.delete<ApiResponse<null>>(`/categories/${categoryId}`);
