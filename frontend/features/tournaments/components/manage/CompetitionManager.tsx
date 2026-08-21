"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRightIcon,
  ArrowsClockwiseIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  PlayIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import {
  alertErrorClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { tournamentsApi } from "@/features/tournaments/api";
import { ROUND_FORMAT_LABELS } from "@/features/tournaments/round-formats";
import type {
  BracketMatch,
  RoundBracket,
  RoundStandings,
  TournamentDetail,
  TournamentRound,
  TournamentStandingsResponse,
} from "@/features/tournaments/types";
import RoundCompetitionView from "./RoundCompetitionView";
import MatchManagementPanel from "./MatchManagementPanel";
import RoundProgressionSummary from "./RoundProgressionSummary";
import RoundStandingsView from "./RoundStandingsView";
import RoundSettingsSummary from "../competition/RoundSettingsSummary";

const ROUND_STATUS_LABELS: Record<TournamentRound["status"], string> = {
  UPCOMING: "Sắp diễn ra",
  ONGOING: "Đang diễn ra",
  COMPLETED: "Hoàn tất",
};

export default function CompetitionManager({
  tournament,
  onTournamentRefresh,
}: {
  tournament: TournamentDetail;
  onTournamentRefresh: () => Promise<void>;
}) {
  const rounds = useMemo(
    () =>
      [...(tournament.rounds ?? [])].sort(
        (a, b) => a.orderIndex - b.orderIndex,
      ),
    [tournament.rounds],
  );
  const [selectedRoundId, setSelectedRoundId] = useState(rounds[0]?.id ?? "");
  const [bracket, setBracket] = useState<RoundBracket | null>(null);
  const [standings, setStandings] =
    useState<TournamentStandingsResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(rounds.length));
  const [working, setWorking] = useState<
    "generate" | "swiss" | "advance" | null
  >(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  const selectedRound =
    rounds.find((round) => round.id === selectedRoundId) ?? rounds[0];
  const activeRound = bracket?.round ?? selectedRound;
  const activeStandings = standings?.rounds.find(
    (round): round is RoundStandings => round.roundId === selectedRound?.id,
  );

  const loadCompetition = useCallback(
    async (roundId: string) => {
      setLoading(true);
      setError("");
      try {
        const [bracketResponse, standingsResponse] = await Promise.all([
          tournamentsApi.getTournamentBracket(tournament.slug),
          tournamentsApi.getStandings(tournament.slug),
        ]);
        const selected = bracketResponse.rounds.find(
          (item) => item.round.id === roundId,
        );
        if (!selected) throw new Error("Không tìm thấy cấu trúc của giai đoạn");
        setBracket(selected);
        setStandings(standingsResponse);
      } catch (err) {
        setBracket(null);
        setStandings(null);
        setError(
          err instanceof Error
            ? err.message
            : "Không tải được cấu trúc thi đấu",
        );
      } finally {
        setLoading(false);
      }
    },
    [tournament.slug],
  );

  useEffect(() => {
    if (!selectedRound?.id) return;
    let cancelled = false;
    Promise.all([
      tournamentsApi.getTournamentBracket(tournament.slug),
      tournamentsApi.getStandings(tournament.slug),
    ])
      .then(([bracketResponse, standingsResponse]) => {
        if (cancelled) return;
        const selected = bracketResponse.rounds.find(
          (item) => item.round.id === selectedRound.id,
        );
        if (!selected) throw new Error("Không tìm thấy cấu trúc của giai đoạn");
        setBracket(selected);
        setStandings(standingsResponse);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setBracket(null);
        setStandings(null);
        setError(
          err instanceof Error
            ? err.message
            : "Không tải được cấu trúc thi đấu",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRound?.id, tournament.slug]);

  const generate = async () => {
    if (!selectedRound || working) return;
    const force = Boolean(
      bracket && (bracket.matches.length || bracket.groups.length),
    );
    if (
      force &&
      !window.confirm(
        "Tạo lại sẽ thay thế cấu trúc hiện tại nếu backend xác nhận chưa có kết quả hoặc tiến độ. Bạn muốn tiếp tục?",
      )
    ) {
      return;
    }

    setWorking("generate");
    setError("");
    setNotice("");
    try {
      const result = await tournamentsApi.generateRound(
        selectedRound.id,
        force,
      );
      setNotice(
        `Đã tạo ${result.matchCount} trận từ ${result.approvedTeamCount} đội được duyệt.`,
      );
      await loadCompetition(selectedRound.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không thể tạo cấu trúc thi đấu",
      );
    } finally {
      setWorking(null);
    }
  };

  const generateNextSwiss = async () => {
    if (!selectedRound || working) return;
    setWorking("swiss");
    setError("");
    setNotice("");
    try {
      const result = await tournamentsApi.generateNextSwissIteration(
        selectedRound.id,
      );
      const warning = result.warnings.length
        ? ` ${result.warnings.join(" ")}`
        : "";
      setNotice(
        `Đã tạo lượt Swiss ${result.bracketRound}/${result.numberOfRounds}.${warning}`,
      );
      await loadCompetition(selectedRound.id);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể tạo lượt Swiss tiếp theo",
      );
    } finally {
      setWorking(null);
    }
  };

  const advanceRound = async () => {
    if (!selectedRound || working) return;
    setWorking("advance");
    setError("");
    setNotice("");
    try {
      const result = await tournamentsApi.advanceRound(selectedRound.id);
      setNotice(
        `Đã đưa ${result.advanceCount} đội vào ${result.nextRound?.name ?? "vòng tiếp theo"}.`,
      );
      await Promise.all([
        loadCompetition(selectedRound.id),
        onTournamentRefresh(),
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể chuyển đội vào vòng tiếp theo",
      );
    } finally {
      setWorking(null);
    }
  };

  if (!rounds.length) {
    return (
      <section className="rounded-2xl border border-dashed border-line px-6 py-14 text-center">
        <h2 className="font-semibold text-ink">Chưa có giai đoạn thi đấu</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Tournament này chưa cấu hình round nào để tạo cấu trúc.
        </p>
      </section>
    );
  }

  const hasStructure = Boolean(
    bracket && (bracket.matches.length || bracket.groups.length),
  );
  const canRequestRegeneration = Boolean(
    bracket?.matches.length &&
    bracket.matches.every(
      (match) =>
        match.status === "PENDING" &&
        match.score.A === 0 &&
        match.score.B === 0 &&
        match.winner === null,
    ),
  );
  const currentSwissRound = bracket
    ? Math.max(0, ...bracket.matches.map((match) => match.bracketRound ?? 0))
    : 0;
  const currentSwissMatches = bracket?.matches.filter(
    (match) => (match.bracketRound ?? 0) === currentSwissRound,
  );
  const swissIterationComplete = Boolean(
    currentSwissMatches?.length &&
    currentSwissMatches.every((match) => match.status === "COMPLETED"),
  );
  const swissHasAnotherConfiguredIteration =
    activeRound?.format === "SWISS" &&
    (activeRound.settings.numberOfRounds === null ||
      currentSwissRound < activeRound.settings.numberOfRounds);
  const actionsAllowed =
    tournament.status !== "CANCELLED" &&
    tournament.status !== "COMPLETED" &&
    activeRound?.status !== "COMPLETED";
  const advancementAllowed =
    tournament.status !== "CANCELLED" && tournament.status !== "COMPLETED";
  const canAdvance =
    advancementAllowed &&
    activeStandings?.advancement.state === "AWAITING_ADVANCEMENT" &&
    (activeRound?.format === "GROUP_STAGE" || activeRound?.format === "SWISS");

  return (
    <section aria-labelledby="competition-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
            Competition control
          </p>
          <h2
            id="competition-heading"
            className="mt-1 text-xl font-bold text-ink sm:text-2xl"
          >
            Cấu trúc thi đấu
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            {tournament.teams.length} đội được duyệt
            {tournament.maxTeams
              ? ` / tối đa ${tournament.maxTeams}`
              : ""} · {tournament._count?.teams ?? tournament.teams.length} lượt
            đăng ký
          </p>
        </div>
        <span className="rounded-full border border-line bg-surface-sub px-3 py-1.5 text-xs text-ink-muted">
          {rounds.length} giai đoạn
        </span>
      </div>

      <nav
        aria-label="Các giai đoạn thi đấu"
        className="mt-5 flex gap-2 overflow-x-auto pb-2"
      >
        {rounds.map((round, index) => {
          const active = round.id === selectedRound?.id;
          return (
            <button
              key={round.id}
              type="button"
              onClick={() => {
                if (round.id === selectedRound?.id) return;
                setLoading(true);
                setError("");
                setBracket(null);
                setSelectedMatchId(null);
                setSelectedRoundId(round.id);
                setNotice("");
              }}
              className={`min-w-44 rounded-xl border px-4 py-3 text-left transition ${
                active
                  ? "border-brand bg-brand/10"
                  : "border-line bg-surface-card hover:border-line-strong"
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

      {selectedRound && (
        <div className="mt-4 rounded-2xl border border-line bg-surface-card p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold text-ink">
                  {selectedRound.name}
                </h3>
                <span className="rounded-full bg-surface-sub px-2.5 py-1 text-[11px] text-ink-muted">
                  {ROUND_STATUS_LABELS[selectedRound.status]}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] ${hasStructure ? "bg-approved/10 text-approved" : "bg-pending/10 text-pending"}`}
                >
                  {hasStructure ? "Đã tạo cấu trúc" : "Chưa tạo"}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink-muted">
                {ROUND_FORMAT_LABELS[selectedRound.format]}
              </p>
            </div>

            {!loading && (actionsAllowed || canAdvance) && (
              <div className="flex flex-wrap gap-2">
                {actionsAllowed &&
                  selectedRound.format === "SWISS" &&
                  hasStructure &&
                  swissIterationComplete &&
                  swissHasAnotherConfiguredIteration && (
                    <button
                      type="button"
                      onClick={generateNextSwiss}
                      disabled={Boolean(working)}
                      className={primaryButtonClass}
                    >
                      {working === "swiss" ? (
                        <CircleNotchIcon className="animate-spin" />
                      ) : (
                        <PlayIcon weight="fill" />
                      )}
                      Tạo lượt Swiss tiếp
                    </button>
                  )}
                {actionsAllowed &&
                  (!hasStructure || canRequestRegeneration) && (
                    <button
                      type="button"
                      onClick={generate}
                      disabled={Boolean(working)}
                      className={
                        hasStructure ? secondaryButtonClass : primaryButtonClass
                      }
                    >
                      {working === "generate" ? (
                        <CircleNotchIcon className="animate-spin" />
                      ) : hasStructure ? (
                        <ArrowsClockwiseIcon />
                      ) : (
                        <PlayIcon weight="fill" />
                      )}
                      {hasStructure ? "Tạo lại cấu trúc" : "Tạo cấu trúc"}
                    </button>
                  )}
                {canAdvance && (
                  <button
                    type="button"
                    onClick={advanceRound}
                    disabled={Boolean(working)}
                    className={primaryButtonClass}
                  >
                    {working === "advance" ? (
                      <CircleNotchIcon className="animate-spin" />
                    ) : (
                      <ArrowRightIcon weight="bold" />
                    )}
                    Đưa đội vào vòng tiếp theo
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="mt-4">
            <RoundSettingsSummary round={activeRound} />
          </div>

          {notice && (
            <p
              role="status"
              className="mt-4 flex items-start gap-2 rounded-xl border border-approved/30 bg-approved/10 px-4 py-3 text-sm text-approved"
            >
              <CheckCircleIcon className="mt-0.5 shrink-0" />
              {notice}
            </p>
          )}
          {error && (
            <p
              role="alert"
              className={`${alertErrorClass} mt-4 flex items-start gap-2`}
            >
              <WarningCircleIcon className="mt-0.5 shrink-0" />
              {error}
            </p>
          )}

          <div className="mt-6">
            {loading ? (
              <div
                aria-label="Đang tải cấu trúc"
                className="grid min-h-48 place-items-center rounded-xl border border-line"
              >
                <CircleNotchIcon
                  className="animate-spin text-brand"
                  size={28}
                />
              </div>
            ) : bracket ? (
              <RoundCompetitionView
                bracket={bracket}
                onSelectMatch={(match: BracketMatch) =>
                  setSelectedMatchId(match.id)
                }
              />
            ) : (
              <div className="rounded-xl border border-dashed border-line px-5 py-10 text-center text-sm text-ink-muted">
                Không có dữ liệu cấu trúc để hiển thị.
              </div>
            )}
          </div>

          <div className="mt-8 border-t border-line pt-6">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
                Standings &amp; progression
              </p>
              <h3 className="mt-1 text-lg font-bold text-ink">
                Xếp hạng và chuyển vòng
              </h3>
            </div>
            {activeStandings && activeRound && standings ? (
              <div className="space-y-6">
                <RoundProgressionSummary data={activeStandings} />
                <RoundStandingsView
                  data={activeStandings}
                  round={activeRound}
                  tournament={standings.tournament}
                />
              </div>
            ) : !loading ? (
              <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-muted">
                Không có dữ liệu xếp hạng hoặc tiến độ để hiển thị.
              </p>
            ) : null}
          </div>
        </div>
      )}

      {selectedMatchId && activeRound && (
        <MatchManagementPanel
          key={selectedMatchId}
          matchId={selectedMatchId}
          round={activeRound}
          tournamentStatus={tournament.status}
          onClose={() => setSelectedMatchId(null)}
          onMutation={async () => {
            await Promise.all([
              loadCompetition(activeRound.id),
              onTournamentRefresh(),
            ]);
          }}
        />
      )}
    </section>
  );
}
