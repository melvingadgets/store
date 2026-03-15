import apiClient from "../utils/axios";
import type { ApiResponse, Profile, User } from "../types/domain";

export interface ProfilePayload {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  DOB?: string;
}

export interface UserWithProfile extends User {
  profile?: Profile;
}

export const getProfile = () => apiClient.get<ApiResponse<UserWithProfile>>("/single-profile");

export const updateProfile = (profileId: string, payload: ProfilePayload) =>
  apiClient.put<ApiResponse<Profile>>(`/edit/pro/${profileId}`, payload);

export const updateProfileImage = (profileId: string, file: File) => {
  const formData = new FormData();
  formData.append("avatar", file);

  return apiClient.put<ApiResponse<Profile>>(`/edit/pro-Img/${profileId}`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};
