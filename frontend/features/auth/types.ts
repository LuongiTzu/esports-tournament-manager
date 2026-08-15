export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  role: "ADMIN" | "SIGNED_UP_USER";
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterAccountRequest {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginResponse {
  message: string;
  user: User;
  accessToken: string;
  refreshToken: string;
}
