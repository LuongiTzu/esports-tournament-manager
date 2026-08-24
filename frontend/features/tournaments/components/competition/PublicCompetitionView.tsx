"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleNotchIcon,
  TrophyIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { alertErrorClass } from "@/components/ui";
import { tournamentsApi } from "@/features/tournaments/api";
import { ROUND_FORMAT_LABELS } from "@/features/tournaments/round-formats";
import type {
  RoundBracket,
  RoundStandings,
  TournamentStandingsResponse,
} from "@/features/tournaments/types";
import RoundCompetitionView from "../manage/RoundCompetitionView";
import RoundProgressionSummary from "../manage/RoundProgressionSummary";
import RoundStandingsView from "../manage/RoundStandingsView";
import RoundSettingsSummary from "./RoundSettingsSummary";
import { useTournamentRealtime } from "@/features/realtime/provider";
import type { TournamentRealtimeEvent } from "@/features/realtime/types";

const COMPETITION_REFRESH_EVENTS = new Set<TournamentRealtimeEvent>([
  "matchUpdated",
  "scheduleUpdated",
  "bracketGenerated",
  "teamApproved",
  "standingsUpdated",
]);

const ROUND_STATUS_LABELS = {
  UPCOMING: "Sắp diễn ra",
  ONGOING: "Đang diễn ra",
  COMPLETED: "Hoàn tất",
} as const;

const TOURNAMENT_STATUS_LABELS: Record<
  TournamentStandingsResponse["tournament"]["status"],
  string
> = {
  DRAFT: "Bản nháp",
  REGISTRATION: "Đang đăng ký",
  ONGOING: "Đang diễn ra",
  COMPLETED: "Đã hoàn tất",
  CANCELLED: "Đã hủy",
};

export default function PublicCompetitionView({
  slug,
  tournamentId,
}: {
  slug: string;
  tournamentId: string;
}) {
  const [rounds, setRounds] = useState<RoundBracket[]>([]);
  const [standings, setStandings] =
    useState<TournamentStandingsResponse | null>(null);
  const [selectedRoundId, setSelectedRoundId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      tournamentsApi.getTournamentBracket(slug),
      tournamentsApi.getStandings(slug),
    ])
      .then(([bracketResponse, standingsResponse]) => {
        if (cancelled) return;
        const orderedRounds = [...bracketResponse.rounds].sort(
          (a, b) => a.round.orderIndex - b.round.orderIndex,
        );
        setRounds(orderedRounds);
        setStandings(standingsResponse);
        setSelectedRoundId((current) =>
          orderedRounds.some(({ round }) => round.id === current)
            ? current
            : (orderedRounds[0]?.round.id ?? ""),
        );
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "Không tải được dữ liệu thi đấu.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshVersion, slug]);

  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    [],
  );

  useTournamentRealtime(tournamentId, (event) => {
    if (!COMPETITION_REFRESH_EVENTS.has(event)) return;
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(
      () => setRefreshVersion((version) => version + 1),
      150,
    );
  });

  const selectedBracket = useMemo(
    () => rounds.find(({ round }) => round.id === selectedRoundId) ?? rounds[0],
    [rounds, selectedRoundId],
  );
  const selectedStandings = standings?.rounds.find(
    (round): round is RoundStandings =>
      round.roundId === selectedBracket?.round.id,
  );

  return (
    <section
      aria-labelledby="public-competition-heading"
      className="mt-6 min-w-0 overflow-hidden rounded-xl border border-line bg-surface-card p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
            Competition
          </p>
          <h2
            id="public-competition-heading"
            className="mt-1 text-xl font-bold text-ink sm:text-2xl"
          >
            Diễn biến giải đấu
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            Lịch đấu, kết quả, xếp hạng và tiến trình chính thức từ hệ thống.
          </p>
        </div>
        {standings && (
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                standings.tournament.status === "COMPLETED"
                  ? "border-approved/30 bg-approved/10 text-approved"
                  : standings.tournament.status === "CANCELLED"
                    ? "border-rejected/30 bg-rejected/10 text-rejected"
                    : "border-line bg-surface-sub text-ink-muted"
              }`}
            >
              {TOURNAMENT_STATUS_LABELS[standings.tournament.status]}
            </span>
            {standings.tournament.champion && (
              <span className="inline-flex items-center gap-2 rounded-full border border-approved/30 bg-approved/10 px-3 py-1.5 text-sm font-semibold text-approved">
                <TrophyIcon weight="fill" />{" "}
                {standings.tournament.champion.name}
              </span>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div
          className="grid min-h-52 place-items-center"
          aria-label="Đang tải dữ liệu thi đấu"
        >
          <CircleNotchIcon className="animate-spin text-brand" size={28} />
        </div>
      ) : error ? (
        <p
          role="alert"
          className={`${alertErrorClass} mt-5 flex items-start gap-2`}
        >
          <WarningCircleIcon className="mt-0.5 shrink-0" /> {error}
        </p>
      ) : !selectedBracket ? (
        <div className="mt-5 rounded-xl border border-dashed border-line px-5 py-12 text-center text-sm text-ink-muted">
          Giải đấu chưa có giai đoạn thi đấu.
        </div>
      ) : (
        <>
          <nav
            aria-label="Các giai đoạn thi đấu"
            className="mt-5 flex max-w-full gap-2 overflow-x-auto pb-2"
          >
            {rounds.map(({ round }, index) => {
              const active = round.id === selectedBracket.round.id;
              return (
                <button
                  key={round.id}
                  type="button"
                  onClick={() => setSelectedRoundId(round.id)}
                  aria-current={active ? "step" : undefined}
                  className={`min-w-44 rounded-xl border px-4 py-3 text-left transition ${
                    active
                      ? "border-brand bg-brand/10"
                      : "border-line bg-surface-sub hover:border-line-strong"
                  }`}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                    Giai đoạn {index + 1}
                  </span>
                  <span className="mt-1 block truncate text-sm font-semibold text-ink">
                    {round.name}
                  </span>
                  <span className="mt-1 block text-xs text-ink-muted">
                    {ROUND_FORMAT_LABELS[round.format]}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="mt-4 min-w-0 rounded-2xl border border-line bg-surface-sub/25 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-ink">
                  {selectedBracket.round.name}
                </h3>
                <p className="mt-1 text-sm text-ink-muted">
                  {ROUND_FORMAT_LABELS[selectedBracket.round.format]}
                </p>
              </div>
              <span className="rounded-full bg-surface-card px-3 py-1 text-xs font-medium text-ink-muted">
                {ROUND_STATUS_LABELS[selectedBracket.round.status]}
              </span>
            </div>

            <div className="mt-4">
              <RoundSettingsSummary round={selectedBracket.round} />
            </div>

            {selectedStandings && (
              <div className="mt-5">
                <RoundProgressionSummary data={selectedStandings} />
              </div>
            )}

            <div className="mt-6 min-w-0">
              <h3 className="mb-4 font-semibold text-ink">
                Trận đấu và lịch thi đấu
              </h3>
              <RoundCompetitionView bracket={selectedBracket} />
            </div>

            <div className="mt-8 border-t border-line pt-6">
              <h3 className="mb-4 font-semibold text-ink">
                {selectedBracket.round.format === "PLAYOFF" ||
                selectedBracket.round.format === "DOUBLE_ELIM"
                  ? "Kết quả giai đoạn"
                  : "Bảng xếp hạng"}
              </h3>
              {selectedStandings && standings ? (
                <RoundStandingsView
                  data={selectedStandings}
                  round={selectedBracket.round}
                  tournament={standings.tournament}
                />
              ) : (
                <p className="text-sm text-ink-muted">
                  Chưa có dữ liệu xếp hạng hoặc tiến trình.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
