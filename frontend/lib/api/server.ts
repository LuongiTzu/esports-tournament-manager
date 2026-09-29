import "server-only";

interface ApiSuccessEnvelope<T> {
  statusCode: number;
  message: string;
  data: T;
}

export class ServerApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

function serverApiBaseUrl() {
  const configured =
    process.env.INTERNAL_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://localhost:3001/api";

  if (/^https?:\/\//i.test(configured)) return configured.replace(/\/$/, "");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return new URL(configured, siteUrl).toString().replace(/\/$/, "");
}

function isSuccessEnvelope<T>(
  value: unknown,
  status: number,
): value is ApiSuccessEnvelope<T> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return candidate.statusCode === status && "data" in candidate;
}

export async function serverRequest<T>(
  path: string,
  options: RequestInit & {
    next?: { revalidate?: number; tags?: string[] };
  } = {},
): Promise<T> {
  const response = await fetch(`${serverApiBaseUrl()}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...options.headers,
    },
  });
  const body = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "message" in body
        ? String((body as { message: unknown }).message)
        : `API request failed with status ${response.status}`;
    throw new ServerApiError(message, response.status);
  }

  return isSuccessEnvelope<T>(body, response.status) ? body.data : (body as T);
}
