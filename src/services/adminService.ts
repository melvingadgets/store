import apiClient from "../utils/axios";
import type { ApiResponse, User } from "../types/domain";

export const getAllUsers = () => apiClient.get<ApiResponse<User[]>>("/all-users");
