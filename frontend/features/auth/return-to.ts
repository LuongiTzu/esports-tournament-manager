"use client";

import { useSyncExternalStore } from "react";

export const PENDING_AUTH_RETURN_TO_KEY = "etm-auth-return-to";

export function safeReturnTo(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\")) return null;
  return value;
}

const subscribeToLocation = () => () => {};
const getLocationSearch = () => window.location.search;
const getServerLocationSearch = () => "";

export function useAuthParams() {
  const search = useSyncExternalStore(
    subscribeToLocation,
    getLocationSearch,
    getServerLocationSearch,
  );
  const params = new URLSearchParams(search);
  return {
    returnTo: safeReturnTo(params.get("returnTo")),
    email: params.get("email")?.trim().toLowerCase() ?? "",
  };
}
