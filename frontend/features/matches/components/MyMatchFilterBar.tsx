"use client";

import { useState } from "react";
import { inputClass, secondaryButtonClass } from "@/components/ui";
import { useLocale } from "@/features/locale/store";
import type { MyMatchFilters } from "../api";
import type { MyMatchesResponse } from "../types";

export default function MyMatchFilterBar({
  filters,
  teams,
  onChange,
}: {
  filters: MyMatchFilters;
  teams: MyMatchesResponse["filterTeams"];
  onChange: (filters: MyMatchFilters) => void;
}) {
  const { t } = useLocale();
  const [search, setSearch] = useState(filters.search ?? "");
  const games = [
    ...new Map(
      teams.map((team) => [team.tournament.game.id, team.tournament.game]),
    ).values(),
  ];
  const tournaments = [
    ...new Map(
      teams
        .filter(
          (team) =>
            !filters.gameId || team.tournament.game.id === filters.gameId,
        )
        .map((team) => [team.tournament.id, team.tournament]),
    ).values(),
  ];
  const availableTeams = teams.filter(
    (team) =>
      (!filters.gameId || team.tournament.game.id === filters.gameId) &&
      (!filters.tournamentId || team.tournament.id === filters.tournamentId),
  );
  const update = (patch: Partial<MyMatchFilters>) =>
    onChange({ ...filters, ...patch });
  const setPeriod = (period: "today" | "week" | "month") => {
    const from = new Date();
    const to = new Date();
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    if (period === "week") to.setDate(to.getDate() + 6);
    if (period === "month") from.setDate(from.getDate() - 29);
    update({ from: from.toISOString(), to: to.toISOString() });
  };
  const dateValue = (value?: string) =>
    value
      ? new Date(
          new Date(value).getTime() -
            new Date(value).getTimezoneOffset() * 60_000,
        )
          .toISOString()
          .slice(0, 10)
      : "";
  return (
    <form
      className="mt-5 space-y-3 rounded-2xl border border-line bg-surface-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        update({ search: search.trim() || undefined });
      }}
    >
      <div className="flex gap-2">
        <input
          aria-label={t("myMatches.filter.search")}
          placeholder={t("myMatches.filter.search")}
          type="search"
          maxLength={100}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className={`${inputClass} min-w-0 flex-1`}
        />
        <button className={secondaryButtonClass} type="submit">
          {t("myMatches.filter.find")}
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-ink-muted">
          {t("myMatches.filter.game")}
          <select
            aria-label={t("myMatches.filter.game")}
            className={`${inputClass} mt-1 w-full`}
            value={filters.gameId ?? ""}
            onChange={(event) =>
              update({
                gameId: event.target.value || undefined,
                tournamentId: undefined,
                teamId: undefined,
              })
            }
          >
            <option value="">{t("myMatches.filter.allGames")}</option>
            {games.map((game) => (
              <option key={game.id} value={game.id}>
                {game.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-ink-muted">
          {t("myMatches.filter.tournament")}
          <select
            aria-label={t("myMatches.filter.tournament")}
            className={`${inputClass} mt-1 w-full`}
            value={filters.tournamentId ?? ""}
            onChange={(event) =>
              update({
                tournamentId: event.target.value || undefined,
                teamId: undefined,
              })
            }
          >
            <option value="">{t("myMatches.filter.allTournaments")}</option>
            {tournaments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-ink-muted">
          {t("myTeams.title")}
          <select
            aria-label={t("myTeams.title")}
            className={`${inputClass} mt-1 w-full`}
            value={filters.teamId ?? ""}
            onChange={(event) =>
              update({ teamId: event.target.value || undefined })
            }
          >
            <option value="">{t("myMatches.filter.allTeams")}</option>
            {availableTeams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-ink-muted">
          {t("myMatches.filter.attention")}
          <select
            aria-label={t("myMatches.filter.attention")}
            className={`${inputClass} mt-1 w-full`}
            value={filters.attention ?? ""}
            onChange={(event) =>
              update({
                attention:
                  (event.target.value as MyMatchFilters["attention"]) ||
                  undefined,
              })
            }
          >
            <option value="">{t("myMatches.filter.all")}</option>
            <option value="NEEDS_ACTION">
              {t("myMatches.filter.needsAction")}
            </option>
            <option value="CHECK_IN">{t("myMatches.compact.checkIn")}</option>
            <option value="OVERDUE_CHECK_IN">
              {t("myMatches.filter.overdueCheckIn")}
            </option>
            <option value="CONFIRM">{t("myMatches.compact.confirm")}</option>
            <option value="DISPUTED">
              {t("myMatches.resultReview.status.DISPUTED")}
            </option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["today", "week", "month"] as const).map((period) => (
          <button
            key={period}
            type="button"
            onClick={() => setPeriod(period)}
            className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-muted hover:border-brand hover:text-ink"
          >
            {t(`myMatches.filter.${period}`)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 text-xs text-ink-muted">
          {t("myMatches.filter.from")}
          <input
            type="date"
            className={`${inputClass} mt-1 block`}
            value={dateValue(filters.from)}
            max={dateValue(filters.to) || undefined}
            onChange={(event) =>
              update({
                from: event.target.value
                  ? new Date(`${event.target.value}T00:00:00`).toISOString()
                  : undefined,
              })
            }
          />
        </label>
        <label className="min-w-0 text-xs text-ink-muted">
          {t("myMatches.filter.to")}
          <input
            type="date"
            className={`${inputClass} mt-1 block`}
            value={dateValue(filters.to)}
            min={dateValue(filters.from) || undefined}
            onChange={(event) =>
              update({
                to: event.target.value
                  ? new Date(`${event.target.value}T23:59:59.999`).toISOString()
                  : undefined,
              })
            }
          />
        </label>
        <label className="text-xs text-ink-muted">
          {t("myMatches.filter.sort")}
          <select
            className={`${inputClass} mt-1 block`}
            value={filters.sort ?? "DEFAULT"}
            onChange={(event) =>
              update({ sort: event.target.value as MyMatchFilters["sort"] })
            }
          >
            <option value="DEFAULT">{t("myMatches.filter.defaultSort")}</option>
            <option value="NEWEST">{t("myMatches.filter.newest")}</option>
            <option value="OLDEST">{t("myMatches.filter.oldest")}</option>
          </select>
        </label>
        <button
          type="button"
          className={`${secondaryButtonClass} sm:ml-auto`}
          onClick={() => {
            setSearch("");
            onChange({});
          }}
        >
          {t("myMatches.filter.clear")}
        </button>
      </div>
    </form>
  );
}
