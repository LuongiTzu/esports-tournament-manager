import { API_BASE_URL } from "@/lib/api/client";

function backendOrigin() {
  if (API_BASE_URL.startsWith("/")) return "";

  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return "";
  }
}

export function resolveImageUrl(value?: string | null): string | null {
  const url = value?.trim();
  if (!url) return null;

  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/images/")) return url;
  if (url.startsWith("/uploads/")) return `${backendOrigin()}${url}`;

  return null;
}
