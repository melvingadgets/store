import apiClient from "../utils/axios";
import type { ApiResponse, AuthPayload } from "../types/domain";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export const loginUser = (payload: LoginPayload) =>
  apiClient.post<ApiResponse<AuthPayload>>("/login", payload);

export const registerUser = (payload: RegisterPayload) =>
  apiClient.post<ApiResponse<{ user: AuthPayload["user"] }>>("/register", payload);

export const logoutUser = () => apiClient.get<ApiResponse<null>>("/logout-user");
