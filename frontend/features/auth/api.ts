import type {
  ChangePasswordRequest,
  GoogleLoginRequest,
  LoginRequest,
  LoginResponse,
  RegisterAccountRequest,
  UpdateProfileRequest,
  User,
} from "@/features/auth/types";
import { request } from "@/lib/api/client";
import { uploadImage } from "@/lib/api/upload";

export const authApi = {
  login: (data: LoginRequest) =>
    request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  googleLogin: (data: GoogleLoginRequest) =>
    request<LoginResponse>("/auth/google", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  register: (data: RegisterAccountRequest) =>
    request<{ message: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  logout: () =>
    request<{ message: string }>("/auth/logout", {
      method: "POST",
      auth: true,
    }),
  changePassword: (data: ChangePasswordRequest) =>
    request<{ message: string }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify(data),
      auth: true,
    }),
  getMe: () => request<User>("/users/me", { auth: true }),
  updateProfile: (data: UpdateProfileRequest) =>
    request<User>("/users/me", {
      method: "PATCH",
      body: JSON.stringify(data),
      auth: true,
    }),
  uploadAvatar: (file: File) => uploadImage("/users/me/avatar", file),
};
