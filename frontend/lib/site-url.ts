const DEFAULT_SITE_URL = "http://localhost:3000";

export function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  try {
    return new URL(configured || DEFAULT_SITE_URL);
  } catch {
    return new URL(DEFAULT_SITE_URL);
  }
}

export function absoluteSiteUrl(pathOrUrl: string) {
  try {
    return new URL(pathOrUrl, getSiteUrl()).toString();
  } catch {
    return getSiteUrl().toString();
  }
}
