const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export type TeamStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  role: "ADMIN" | "SIGNED_UP_USER";
}

export interface LoginResponse {
  message: string;
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface Game {
  id: string;
  name: string;
  iconUrl?: string | null;
  teamSize: number;
}

/** Các endpoint chỉ select một phần Game (list bỏ teamSize, create bỏ iconUrl) */
export type GameRef = Pick<Game, "id" | "name"> & Partial<Game>;

export interface Tournament {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  rules?: string | null;
  bannerUrl?: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  moderationStatus?: "ACTIVE" | "HIDDEN_BY_ADMIN";
  isVerified?: boolean;
  registrationOpen: boolean;
  maxTeams?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  game?: GameRef;
  organizer?: { id: string; displayName: string; avatarUrl?: string | null };
  rounds?: Array<{ id: string; name: string; format: string }>;
  _count?: { teams: number; comments?: number };
  createdAt: string;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// ─── Token storage ───────────────────────────────────────────
const isClient = () => typeof window !== "undefined";

export const tokenStore = {
  get accessToken() {
    return isClient() ? localStorage.getItem("accessToken") : null;
  },
  set accessToken(v: string | null) {
    if (!isClient()) return;
    if (v) localStorage.setItem("accessToken", v);
    else localStorage.removeItem("accessToken");
  },
  get refreshToken() {
    return isClient() ? localStorage.getItem("refreshToken") : null;
  },
  set refreshToken(v: string | null) {
    if (!isClient()) return;
    if (v) localStorage.setItem("refreshToken", v);
    else localStorage.removeItem("refreshToken");
  },
  get user(): User | null {
    if (!isClient()) return null;
    const raw = localStorage.getItem("user");
    return raw ? (JSON.parse(raw) as User) : null;
  },
  set user(v: User | null) {
    if (!isClient()) return;
    if (v) localStorage.setItem("user", JSON.stringify(v));
    else localStorage.removeItem("user");
  },
  clear() {
    if (!isClient()) return;
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
  },
};

// ─── Fetch wrapper ───────────────────────────────────────────
async function request<T>(
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
  const body = contentType.includes("application/json")
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

  return body as T;
}

// ─── Auth API ────────────────────────────────────────────────
export const authApi = {
  login: (data: { email: string; password: string }) =>
    request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  register: (data: {
    email: string;
    password: string;
    displayName: string;
  }) =>
    request<{ message: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  logout: () =>
    request<{ message: string }>("/auth/logout", {
      method: "POST",
      auth: true,
    }),
};

// ─── Games API ───────────────────────────────────────────────
export const gamesApi = {
  findAll: () => request<Game[]>("/games"),
};

// ─── Tournaments API ─────────────────────────────────────────
export interface FindAllParams {
  search?: string;
  gameId?: string;
  page?: number;
  limit?: number;
}

export interface Paginated<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TeamWithMembers {
  id: string;
  name: string;
  logoUrl?: string | null;
  status: TeamStatus;
  seed?: number | null;
  captain?: { id: string; displayName: string; avatarUrl?: string | null };
  members?: Array<{ id: string; ign: string; contactInfo?: string | null }>;
  _count?: { members: number };
  registeredAt: string;
}

/** findBySlug chỉ trả đội APPROVED và KHÔNG include members — chỉ có _count */
export type ApprovedTeam = Omit<TeamWithMembers, "members">;

export interface TournamentDetail extends Tournament {
  game?: Game;
  teams: ApprovedTeam[];
}

export const tournamentsApi = {
  findAll: (params: FindAllParams = {}) => {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    if (params.gameId) qs.set("gameId", params.gameId);
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    const q = qs.toString();
    return request<Paginated<Tournament>>(`/tournaments${q ? `?${q}` : ""}`);
  },
  findBySlug: (slug: string) =>
    request<TournamentDetail>(`/tournaments/slug/${slug}`),
  create: (data: Record<string, unknown>) =>
    request<Tournament>(`/tournaments`, {
      method: "POST",
      body: JSON.stringify(data),
      auth: true,
    }),
  addRound: (tournamentId: string, data: Record<string, unknown>) =>
    request<unknown>(`/tournaments/${tournamentId}/rounds`, {
      method: "POST",
      body: JSON.stringify(data),
      auth: true,
    }),
};

// ─── Teams API ───────────────────────────────────────────────
export interface TeamRegistration {
  name: string;
  logoUrl?: string;
  members?: Array<{ ign: string; contactInfo?: string }>;
}

export const teamsApi = {
  /** Bỏ trống `status` sẽ trả về cả PENDING và REJECTED, không chỉ đội đã duyệt */
  findByTournament: (tournamentId: string, status?: string) =>
    request<TeamWithMembers[]>(
      `/tournaments/${tournamentId}/teams${status ? `?status=${status}` : ""}`,
    ),
  register: (tournamentId: string, data: TeamRegistration) =>
    request<TeamWithMembers>(`/tournaments/${tournamentId}/teams`, {
      method: "POST",
      body: JSON.stringify(data),
      auth: true,
    }),
  updateStatus: (
    tournamentId: string,
    teamId: string,
    status: "APPROVED" | "REJECTED",
  ) =>
    request<TeamWithMembers>(
      `/tournaments/${tournamentId}/teams/${teamId}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status }),
        auth: true,
      },
    ),
};

// ─── Users API ───────────────────────────────────────────────
export const usersApi = {
  getMe: () => request<User>("/users/me", { auth: true }),
  getMyTournaments: (tab: "organized" | "joined") =>
    request<Tournament[]>(`/users/me/tournaments?tab=${tab}`, { auth: true }),
};

