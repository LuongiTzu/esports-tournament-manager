"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  UsersThreeIcon,
  CalendarBlankIcon,
} from "@phosphor-icons/react";
import ResolvedImage from "@/components/ResolvedImage";
import { useAuth } from "@/features/auth/store";
import { formatLocalizedDate } from "@/features/locale/format";
import { useLocale } from "@/features/locale/store";
import { teamsApi } from "@/features/teams/api";
import type { MyTeam, TeamStatus } from "@/features/teams/types";
import StatusBadge from "./StatusBadge";
import styles from "./MyTeamsPage.module.css";

const STATUS_FILTERS = ["ALL", "APPROVED", "PENDING", "REJECTED"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];
const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();

export default function MyTeamsPage() {
  const router = useRouter();
  const { user, ready } = useAuth();
  const { locale, t } = useLocale();
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [gameId, setGameId] = useState("");
  const [result, setResult] = useState<{
    userId: string;
    teams: MyTeam[];
    error: boolean;
  } | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace(
        `/login?returnTo=${encodeURIComponent("/users/me/teams")}`,
      );
      return;
    }
    let cancelled = false;
    teamsApi.findMine().then(
      (teams) => {
        if (!cancelled) setResult({ userId: user.id, teams, error: false });
      },
      () => {
        if (!cancelled) setResult({ userId: user.id, teams: [], error: true });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt, ready, router, user]);

  const loading = !ready || Boolean(user && result?.userId !== user.id);
  if (ready && !user) return null;
  const teams = result?.userId === user?.id ? (result?.teams ?? []) : [];
  const counts = teams.reduce<Record<TeamStatus, number>>(
    (total, team) => {
      total[team.status]++;
      return total;
    },
    { APPROVED: 0, PENDING: 0, REJECTED: 0 },
  );
  const games = [
    ...new Map(
      teams.map((team) => [team.tournament.game.id, team.tournament.game]),
    ).values(),
  ];
  const query = normalizeSearch(search.trim());
  const visibleTeams = teams.filter(
    (team) =>
      (status === "ALL" || team.status === status) &&
      (!gameId || team.tournament.game.id === gameId) &&
      (!query ||
        normalizeSearch(
          `${team.name} ${team.shortName ?? ""} ${team.tournament.name} ${team.tournament.displayGameName}`,
        ).includes(query)),
  );
  const resetFilters = () => {
    setSearch("");
    setStatus("ALL");
    setGameId("");
  };

  return (
    <div className={styles.page}>
      <title>{`${t("pageTitle.myTeams")} | ArenaVerse`}</title>
      <div className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-9">
        <Link href="/users/me" className={styles.backLink}>
          <ArrowLeftIcon aria-hidden />
          {t("profile.myTournaments")}
        </Link>
        <header className={styles.header}>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                {t("myTeams.title")}
              </h1>
              {!loading && !result?.error && (
                <span className={styles.total}>{teams.length}</span>
              )}
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
              {t("myTeams.description")}
            </p>
          </div>
          <Link href="/tournaments" className={styles.primaryButton}>
            <PlusIcon aria-hidden size={18} weight="bold" />
            {t("myTeams.register")}
          </Link>
        </header>

        {loading ? (
          <div
            className={styles.loading}
            role="status"
            aria-label={t("myTeams.loading")}
          >
            {[0, 1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-20 border-b border-line bg-surface-card motion-safe:animate-pulse last:border-0"
              />
            ))}
            <span className="sr-only">{t("myTeams.loading")}</span>
          </div>
        ) : result?.error ? (
          <div className={styles.empty}>
            <p role="alert" className="text-sm text-rejected">
              {t("myTeams.loadError")}
            </p>
            <button
              type="button"
              className={styles.outlineButton}
              onClick={() => {
                setResult(null);
                setAttempt((value) => value + 1);
              }}
            >
              {t("common.retry")}
            </button>
          </div>
        ) : teams.length === 0 ? (
          <div className={styles.empty}>
            <UsersThreeIcon aria-hidden size={40} className="text-ink-muted" />
            <h2 className="text-lg font-semibold text-ink">
              {t("myTeams.empty")}
            </h2>
            <p className="max-w-md text-sm leading-6 text-ink-muted">
              {t("myTeams.emptyHint")}
            </p>
            <Link href="/tournaments" className={styles.outlineButton}>
              {t("teamDetail.browse")}
              <ArrowRightIcon aria-hidden />
            </Link>
          </div>
        ) : (
          <section aria-label={t("myTeams.directory")}>
            <div
              className={styles.statusFilters}
              role="group"
              aria-label={t("myTeams.statusFilter")}
            >
              {STATUS_FILTERS.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={status === item}
                  onClick={() => setStatus(item)}
                  className={styles.statusFilter}
                >
                  {t(item === "ALL" ? "myTeams.all" : `team.status.${item}`)}
                  <span className={styles.filterCount}>
                    {item === "ALL" ? teams.length : counts[item]}
                  </span>
                </button>
              ))}
            </div>
            <div className={styles.toolbar}>
              <label className={styles.search}>
                <MagnifyingGlassIcon aria-hidden size={19} />
                <span className="sr-only">{t("myTeams.search")}</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("myTeams.search")}
                />
              </label>
              <label className={styles.gameFilter}>
                <span className="sr-only">{t("myTeams.gameFilter")}</span>
                <select
                  aria-label={t("myTeams.gameFilter")}
                  value={gameId}
                  onChange={(event) => setGameId(event.target.value)}
                >
                  <option value="">{t("myTeams.allGames")}</option>
                  {games.map((game) => (
                    <option key={game.id} value={game.id}>
                      {game.name}
                    </option>
                  ))}
                </select>
              </label>
              {(search || gameId || status !== "ALL") && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className={styles.clearButton}
                >
                  {t("myTeams.clearFilters")}
                </button>
              )}
            </div>
            <p className="mb-3 text-[13px] text-ink-muted" role="status">
              {visibleTeams.length} {t("myTeams.results")}
            </p>

            {visibleTeams.length === 0 ? (
              <div className={styles.empty}>
                <MagnifyingGlassIcon
                  aria-hidden
                  size={32}
                  className="text-ink-muted"
                />
                <h2 className="font-semibold text-ink">
                  {t("myTeams.noResults")}
                </h2>
                <p className="text-sm text-ink-muted">
                  {t("myTeams.noResultsHint")}
                </p>
                <button
                  type="button"
                  className={styles.outlineButton}
                  onClick={resetFilters}
                >
                  {t("myTeams.clearFilters")}
                </button>
              </div>
            ) : (
              <div className={styles.directory}>
                <div className={styles.columnHeadings} aria-hidden>
                  <span>{t("myTeams.teamColumn")}</span>
                  <span>{t("myTeams.tournamentColumn")}</span>
                  <span>{t("myTeams.rosterColumn")}</span>
                  <span>{t("myTeams.statusColumn")}</span>
                  <span>{t("myTeams.startDate")}</span>
                  <span />
                </div>
                <ul className={styles.list}>
                  {visibleTeams.map((team) => (
                    <li key={team.id} className={styles.row}>
                      <div className={styles.identity}>
                        <span className={styles.logo}>
                          <ResolvedImage
                            src={team.logoUrl}
                            alt=""
                            className="size-full object-cover"
                            fallback={
                              team.shortName?.slice(0, 3) ||
                              team.name.charAt(0).toUpperCase()
                            }
                          />
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={`/teams/${encodeURIComponent(team.id)}`}
                            className={styles.teamName}
                          >
                            {team.name}
                          </Link>
                          <p className="mt-1 text-[13px] text-ink-muted">
                            {t(
                              team.captainId === user?.id
                                ? "myTeams.captain"
                                : "myTeams.member",
                            )}
                          </p>
                        </div>
                      </div>
                      <div className={styles.tournament}>
                        <Link
                          href={`/tournaments/${encodeURIComponent(team.tournament.slug)}`}
                          className={styles.tournamentName}
                        >
                          {team.tournament.name}
                        </Link>
                        <p className="mt-1 text-[13px] text-ink-muted">
                          {team.tournament.displayGameName}
                        </p>
                      </div>
                      <span className={styles.roster}>
                        <UsersThreeIcon aria-hidden size={16} />
                        {team._count?.members ?? 0}
                        <span className="sr-only">
                          {" "}
                          {t("myTeams.memberCount")}
                        </span>
                      </span>
                      <div className={styles.status}>
                        <StatusBadge
                          status={team.status}
                          className="whitespace-nowrap !rounded-sm !text-[13px]"
                        />
                      </div>
                      <div className={styles.date}>
                        <CalendarBlankIcon
                          aria-hidden
                          size={16}
                          className="lg:hidden"
                        />
                        <span className="sr-only">
                          {t("myTeams.startDate")}:{" "}
                        </span>
                        {team.tournament.startDate ? (
                          <time dateTime={team.tournament.startDate}>
                            {formatLocalizedDate(
                              team.tournament.startDate,
                              locale,
                              {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              },
                            )}
                          </time>
                        ) : (
                          t("myTeams.unscheduled")
                        )}
                      </div>
                      <Link
                        href={`/teams/${encodeURIComponent(team.id)}`}
                        className={styles.rowAction}
                      >
                        {t("myTeams.viewTeam")}
                        <span className="sr-only">: {team.name}</span>
                        <ArrowRightIcon aria-hidden size={15} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-4 text-[13px] leading-5 text-ink-muted">
              {t("myTeams.registrationNote")}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
