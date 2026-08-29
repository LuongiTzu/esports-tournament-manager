import type { User } from "@/features/auth/types";
import { ApiError } from "@/lib/api/client";

export const EMAIL_NOT_VERIFIED_CODE = "EMAIL_NOT_VERIFIED";
export const PENDING_VERIFICATION_EMAIL_KEY = "pendingVerificationEmail";

export function hasVerifiedEmail(user: User | null | undefined) {
  return Boolean(user && user.emailVerifiedAt !== null);
}

export function isEmailNotVerifiedError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.code === EMAIL_NOT_VERIFIED_CODE;
}
