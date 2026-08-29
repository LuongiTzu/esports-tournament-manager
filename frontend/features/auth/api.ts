import type {
  ChangePasswordRequest,
  GoogleLoginRequest,
  LoginRequest,
  LoginResponse,
  RegisterAccountRequest,
  UpdateProfileRequest,
  User,
  ResetPasswordRequest,
  RequestEmailChangeRequest,
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
  verifyEmail: (token: string) =>
    request<{ message: string }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  resendVerification: (email: string) =>
    request<{ message: string }>("/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  forgotPassword: (email: string) =>
    request<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (data: ResetPasswordRequest) =>
    request<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  requestEmailChange: (data: RequestEmailChangeRequest) =>
    request<{ message: string }>("/auth/request-email-change", {
      method: "POST",
      body: JSON.stringify(data),
      auth: true,
    }),
  confirmEmailChange: (token: string) =>
    request<{ message: string }>("/auth/confirm-email-change", {
      method: "POST",
      body: JSON.stringify({ token }),
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
