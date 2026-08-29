import { tokenStore } from "@/lib/api/token-store";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

interface ApiSuccessEnvelope {
  statusCode: number;
  message: string;
  data: unknown;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const RATE_LIMIT_MESSAGE =
  "Bạn thao tác quá nhiều lần. Vui lòng chờ rồi thử lại sau.";

let refreshRequest: Promise<string | null> | null = null;

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
  code?: string;
  errors?: Array<{
    field: string;
    memberIndex: number | null;
    message: string;
  }>;

  constructor(
    message: string,
    status: number,
    details?: {
      code?: string;
      errors?: ApiError["errors"];
    },
  ) {
    super(message);
    this.status = status;
    this.code = details?.code;
    this.errors = details?.errors;
  }
}

async function readResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json")
    ? response.json()
    : response.text();
}

function isTokenPair(value: unknown): value is TokenPair {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.accessToken === "string" &&
    typeof candidate.refreshToken === "string"
  );
}

async function performTokenRefresh(): Promise<string | null> {
  const refreshToken = tokenStore.refreshToken;
  if (!refreshToken) {
    tokenStore.clear();
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${refreshToken}`,
      },
    });
    const body = await readResponseBody(response);
    const payload = isApiSuccessEnvelope(body, response.status)
      ? body.data
      : body;

    if (!response.ok || !isTokenPair(payload)) {
      tokenStore.clear();
      return null;
    }

    tokenStore.accessToken = payload.accessToken;
    tokenStore.refreshToken = payload.refreshToken;
    return payload.accessToken;
  } catch {
    tokenStore.clear();
    return null;
  }
}

function refreshAccessToken() {
  if (!refreshRequest) {
    refreshRequest = performTokenRefresh().finally(() => {
      refreshRequest = null;
    });
  }
  return refreshRequest;
}

export async function request<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = false, headers = {}, ...rest } = options;

  const finalHeaders = new Headers(headers);
  if (!(rest.body instanceof FormData) && !finalHeaders.has("Content-Type")) {
    finalHeaders.set("Content-Type", "application/json");
  }

  if (auth) {
    const token = tokenStore.accessToken;
    if (token) finalHeaders.set("Authorization", `Bearer ${token}`);
  }

  let res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
  });

  if (auth && res.status === 401) {
    const refreshedAccessToken = await refreshAccessToken();
    if (refreshedAccessToken) {
      finalHeaders.set("Authorization", `Bearer ${refreshedAccessToken}`);
      res = await fetch(`${API_BASE_URL}${path}`, {
        ...rest,
        headers: finalHeaders,
      });
    } else {
      throw new ApiError(
        "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
        401,
      );
    }
  }

  const body = await readResponseBody(res);

  if (!res.ok) {
    const errorBody =
      typeof body === "object" && body !== null
        ? (body as Record<string, unknown>)
        : undefined;
    const message =
      res.status === 429
        ? RATE_LIMIT_MESSAGE
        : (body as { message?: string | string[] })?.message ||
          (typeof body === "string" ? body : "Có lỗi xảy ra");
    const validationErrors = Array.isArray(errorBody?.errors)
      ? errorBody.errors.filter(
          (
            error,
          ): error is {
            field: string;
            memberIndex: number | null;
            message: string;
          } => {
            if (typeof error !== "object" || error === null) return false;
            const candidate = error as Record<string, unknown>;
            return (
              typeof candidate.field === "string" &&
              typeof candidate.message === "string" &&
              (typeof candidate.memberIndex === "number" ||
                candidate.memberIndex === null)
            );
          },
        )
      : undefined;
    throw new ApiError(
      Array.isArray(message) ? message.join(", ") : message,
      res.status,
      {
        code:
          typeof errorBody?.code === "string" ? errorBody.code : undefined,
        errors: validationErrors,
      },
    );
  }

  return (isApiSuccessEnvelope(body, res.status) ? body.data : body) as T;
}
