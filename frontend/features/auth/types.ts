import type { Gender } from "@/shared/types/gender";

export type { Gender } from "@/shared/types/gender";

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  birthDate?: string | null;
  currentAddress?: string | null;
  phoneNumber?: string | null;
  gender?: Gender | null;
  bio?: string | null;
  role: "ADMIN" | "SIGNED_UP_USER";
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateProfileRequest {
  displayName?: string;
  birthDate?: string;
  currentAddress?: string;
  phoneNumber?: string;
  gender?: Gender;
  bio?: string;
}

export interface RegisterAccountRequest {
  email: string;
  password: string;
  displayName: string;
  birthDate?: string;
  currentAddress?: string;
  phoneNumber?: string;
  gender?: Gender;
}

export interface LoginResponse {
  message: string;
  user: User;
  accessToken: string;
  refreshToken: string;
}
