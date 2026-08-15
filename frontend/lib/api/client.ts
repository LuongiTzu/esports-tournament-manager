import { tokenStore } from "@/lib/api/token-store";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

interface ApiSuccessEnvelope {
  statusCode: number;
  message: string;
  data: unknown;
}

function isApiSuccessEnvelope(
  value: unknown,
  responseStatus: number,
): value is ApiSuccessEnvelope {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;

  return (
    Object.prototype.hasOwnProperty.call(candidate, "statusCode") &&
    candidate.statusCode === responseStatus &&
    Object.prototype.hasOwnProperty.call(candidate, "message") &&
    typeof candidate.message === "string" &&
    Object.prototype.hasOwnProperty.call(candidate, "data")
  );
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function request<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = false, headers = {}, ...rest } = options;

  const finalHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string>),
  };

  if (auth) {
    const token = tokenStore.accessToken;
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
  });

  const contentType = res.headers.get("content-type") || "";
  const body: unknown = contentType.includes("application/json")
    ? await res.json()
    : await res.text();

  if (!res.ok) {
    const message =
      (body as { message?: string | string[] })?.message ||
      (typeof body === "string" ? body : "Có lỗi xảy ra");
    throw new ApiError(
      Array.isArray(message) ? message.join(", ") : message,
      res.status,
    );
  }

  return (isApiSuccessEnvelope(body, res.status) ? body.data : body) as T;
}
