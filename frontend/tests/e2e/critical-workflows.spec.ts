import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

const API_URL = "http://localhost:3101/api";
const PASSWORD = "SmokePass123!";
const users = {
  admin: "smoke-admin@e2e.test",
  organizer: "smoke-organizer@e2e.test",
  participant: "smoke-participant@e2e.test",
} as const;

interface UserSession {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    role: "ADMIN" | "SIGNED_UP_USER";
  };
}

interface TournamentFixture {
  id: string;
  slug: string;
  name: string;
}

interface RoundFixture {
  id: string;
}

interface TeamFixture {
  id: string;
}

interface BracketFixture {
  matches: Array<{ id: string }>;
}

async function api<T>(
  request: APIRequestContext,
  method: string,
  path: string,
  options: { token?: string; data?: unknown } = {},
): Promise<T> {
  const response = await request.fetch(`${API_URL}${path}`, {
    method,
    data: options.data,
    headers: options.token
      ? { Authorization: `Bearer ${options.token}` }
      : undefined,
  });
  if (!response.ok()) {
    throw new Error(
      `${method} ${path} failed with ${response.status()}: ${await response.text()}`,
    );
  }
  const body = (await response.json()) as { data: T };
  return body.data;
}

function login(request: APIRequestContext, email: string) {
  return api<UserSession>(request, "POST", "/auth/login", {
    data: { email, password: PASSWORD },
  });
}

async function useSession(page: Page, session: UserSession) {
  await page.addInitScript((value: UserSession) => {
    localStorage.setItem("accessToken", value.accessToken);
    localStorage.setItem("refreshToken", value.refreshToken);
    localStorage.setItem("user", JSON.stringify(value.user));
  }, session);
}

function teamBody(name: string, ign: string, email: string) {
  return {
    name,
    contactName: name,
    contactEmail: email,
    contactPhone: "0900000000",
    members: [
      {
        realName: name,
        ign,
        email,
        memberRole: "CAPTAIN",
      },
    ],
  };
}

test.describe.serial("critical full-stack smoke workflows", () => {
  let adminSession: UserSession;
  let organizerSession: UserSession;
  let participantSession: UserSession;
  let tournament: TournamentFixture;
  const tournamentName = "ArenaVerse Sprint 1 Smoke Cup";
  const participantTeamName = "Smoke Team Alpha";
  const organizerTeamName = "Smoke Team Beta";
  const reportDescription = "Sprint 1 moderation smoke report";

  test.beforeAll(async ({ request }) => {
    [adminSession, organizerSession, participantSession] = await Promise.all([
      login(request, users.admin),
      login(request, users.organizer),
      login(request, users.participant),
    ]);

    const games = await api<Array<{ id: string; code: string }>>(
      request,
      "GET",
      "/games",
    );
    const game = games.find((candidate) => candidate.code === "TEKKEN_8");
    if (!game) throw new Error("TEKKEN_8 is missing from the game catalog.");

    tournament = await api<TournamentFixture>(request, "POST", "/tournaments", {
      token: organizerSession.accessToken,
      data: {
        name: tournamentName,
        gameId: game.id,
        teamSize: 1,
        maxTeamSize: 1,
        maxTeams: 2,
        status: "REGISTRATION",
        registrationOpen: true,
        visibility: "PUBLIC",
        requireMemberFullInfo: false,
      },
    });

    const participantTeam = await api<TeamFixture>(
      request,
      "POST",
      `/tournaments/${tournament.slug}/register`,
      {
        token: participantSession.accessToken,
        data: teamBody(participantTeamName, "smoke-alpha", users.participant),
      },
    );
    await api(request, "PATCH", `/teams/${participantTeam.id}/status`, {
      token: organizerSession.accessToken,
      data: { status: "APPROVED" },
    });
    await api(request, "POST", `/tournaments/${tournament.slug}/teams`, {
      token: organizerSession.accessToken,
      data: teamBody(organizerTeamName, "smoke-beta", users.organizer),
    });

    const round = await api<RoundFixture>(
      request,
      "POST",
      `/tournaments/${tournament.slug}/rounds`,
      {
        token: organizerSession.accessToken,
        data: { name: "Smoke Final", format: "PLAYOFF", bestOf: 1 },
      },
    );
    await api(request, "PATCH", `/tournaments/${tournament.id}`, {
      token: organizerSession.accessToken,
      data: { registrationOpen: false },
    });
    await api(request, "POST", `/rounds/${round.id}/generate`, {
      token: organizerSession.accessToken,
    });
    const bracket = await api<BracketFixture>(
      request,
      "GET",
      `/rounds/${round.id}/bracket`,
    );
    const match = bracket.matches[0];
    if (!match) throw new Error("Smoke bracket did not produce a match.");
    await api(request, "PUT", `/matches/${match.id}/scores`, {
      token: organizerSession.accessToken,
      data: {
        scores: [{ setNumber: 1, teamAScore: 1, teamBScore: 0 }],
      },
    });
    await api(request, "POST", `/tournaments/${tournament.slug}/reports`, {
      token: participantSession.accessToken,
      data: { reason: "OTHER", description: reportDescription },
    });
  });

  test("1. a verified organizer can log in through the browser", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(users.organizer);
    await page
      .getByRole("textbox", { name: "Mật khẩu", exact: true })
      .fill(PASSWORD);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("Smoke Organizer").first()).toBeVisible();
  });

  test("2. a created public tournament is available to its organizer", async ({
    page,
  }) => {
    await useSession(page, organizerSession);
    await page.goto(`/tournaments/${tournament.slug}`);

    await expect(
      page.getByRole("heading", { name: tournamentName, level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Quản lý giải", exact: true }),
    ).toBeVisible();
  });

  test("3. an approved registration is visible to the participant", async ({
    page,
  }) => {
    await useSession(page, participantSession);
    await page.goto(`/tournaments/${tournament.slug}`);

    await expect(page.getByText(participantTeamName).first()).toBeVisible();
    await expect(page.getByText(organizerTeamName).first()).toBeVisible();
  });

  test("4. the generated bracket exposes the completed match", async ({
    page,
  }) => {
    await page.goto(`/tournaments/${tournament.slug}#competition`);

    await expect(
      page.getByRole("heading", { name: "Smoke Final" }),
    ).toBeVisible();
    const match = page.locator(
      `[aria-label*="${participantTeamName}"][aria-label*="${organizerTeamName}"]`,
    );
    await expect(match.first()).toBeVisible();
    await expect(match.first()).toHaveAttribute("aria-label", /1.*0|0.*1/);
  });

  test("5. an admin can review a pending report", async ({ page }) => {
    await useSession(page, adminSession);
    page.on("dialog", (dialog) => dialog.accept());
    await page.goto("/admin/reports");

    await expect(page.getByText(reportDescription)).toBeVisible();
    await page.getByRole("button", { name: "Đánh dấu đã xem xét" }).click();
    await expect(page.getByRole("status")).toContainText(
      "Đã đánh dấu báo cáo là đã xem xét",
    );
  });
});
