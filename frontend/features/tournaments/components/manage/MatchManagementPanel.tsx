"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarBlankIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  LinkIcon,
  PlusIcon,
  TrashIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
import ResolvedImage from "@/components/ResolvedImage";
import {
  alertErrorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { matchesApi } from "@/features/matches/api";
import type { MatchDetail } from "@/features/matches/types";
import { ROUND_FORMAT_LABELS } from "@/features/tournaments/round-formats";
import type {
  MatchStatus,
  TournamentRound,
} from "@/features/tournaments/types";
import type { TournamentStatus } from "@/shared/types/tournament-status";

interface EditableGameScore {
  teamAScore: string;
  teamBScore: string;
}

const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  PENDING: "Chưa diễn ra",
  ONGOING: "Đang diễn ra",
  COMPLETED: "Đã hoàn thành",
};

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatDateTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Chưa lên lịch";
}

function TeamHeading({ match, slot }: { match: MatchDetail; slot: "A" | "B" }) {
  const team = slot === "A" ? match.teamA : match.teamB;
  return (
    <div className="min-w-0 text-center">
      <span className="mx-auto grid size-12 place-items-center overflow-hidden rounded-xl bg-brand/10 font-bold text-brand">
        {team ? (
          <ResolvedImage
            src={team.logoUrl}
            alt={`Logo ${team.name}`}
            className="size-full object-cover object-center"
            fallback={team.name.charAt(0).toUpperCase()}
          />
        ) : (
          "?"
        )}
      </span>
      <p className="mt-2 truncate text-sm font-semibold text-ink">
        {team?.name ?? "Chờ xác định"}
      </p>
      {team?.seed != null && (
        <p className="text-[11px] text-ink-faint">Seed #{team.seed}</p>
      )}
    </div>
  );
}

function allowsDraws(round: TournamentRound) {
  return (
    (round.format === "ROUND_ROBIN" || round.format === "GROUP_STAGE") &&
    round.settings.allowDraws
  );
}

export default function MatchManagementPanel({
  matchId,
  round,
  tournamentStatus,
  onClose,
  onMutation,
}: {
  matchId: string;
  round: TournamentRound;
  tournamentStatus: TournamentStatus;
  onClose: () => void;
  onMutation: () => Promise<void>;
}) {
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"schedule" | "result" | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [discordLink, setDiscordLink] = useState("");
  const [scoreA, setScoreA] = useState("0");
  const [scoreB, setScoreB] = useState("0");
  const [resultStatus, setResultStatus] = useState<MatchStatus>("PENDING");
  const [usePerGameScores, setUsePerGameScores] = useState(false);
  const [gameScores, setGameScores] = useState<EditableGameScore[]>([]);

  const populate = useCallback((value: MatchDetail) => {
    setMatch(value);
    setScheduledAt(toLocalDateTime(value.scheduledAt));
    setDiscordLink(value.discordLink ?? "");
    setScoreA(String(value.scoreA));
    setScoreB(String(value.scoreB));
    setResultStatus(value.status);
    setUsePerGameScores(value.scores.length > 0);
    setGameScores(
      value.scores.map((score) => ({
        teamAScore: String(score.teamAScore),
        teamBScore: String(score.teamBScore),
      })),
    );
  }, []);

  const loadMatch = useCallback(async () => {
    setLoading(true);
    try {
      populate(await matchesApi.findOne(matchId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được trận đấu");
    } finally {
      setLoading(false);
    }
  }, [matchId, populate]);

  useEffect(() => {
    let cancelled = false;
    matchesApi
      .findOne(matchId)
      .then((response) => {
        if (!cancelled) populate(response);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Không tải được trận đấu",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [matchId, populate]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, saving]);

  const editingReason = !match
    ? "Không có dữ liệu trận đấu"
    : match.isBye
      ? "Trận BYE được backend tự xử lý"
      : !match.isActive
        ? "Trận điều kiện chưa được backend kích hoạt"
        : !match.teamA || !match.teamB
          ? "Chưa đủ hai đội tham gia"
          : tournamentStatus === "CANCELLED"
            ? "Giải đấu đã bị hủy"
            : null;
  const editable = editingReason === null;
  const drawAllowed = allowsDraws(round);
  const resultIsCorrection = match?.status === "COMPLETED";

  const refreshAfterMutation = async (message: string) => {
    await Promise.all([onMutation(), loadMatch()]);
    setSuccess(message);
  };

  const saveSchedule = async () => {
    if (!match || !editable || saving) return;
    const trimmedLink = discordLink.trim();
    if (trimmedLink) {
      try {
        new URL(trimmedLink);
      } catch {
        setError("Link phòng đấu phải là URL đầy đủ, ví dụ https://...");
        return;
      }
    }
    setSaving("schedule");
    setError("");
    setSuccess("");
    try {
      await matchesApi.update(match.id, {
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        discordLink: trimmedLink || null,
      });
      await refreshAfterMutation("Đã cập nhật lịch thi đấu.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể cập nhật lịch");
    } finally {
      setSaving(null);
    }
  };

  const validateAggregateResult = () => {
    if (!match) return null;
    const parsedA = Number(scoreA);
    const parsedB = Number(scoreB);
    if (
      !Number.isInteger(parsedA) ||
      !Number.isInteger(parsedB) ||
      parsedA < 0 ||
      parsedB < 0
    ) {
      return "Tỷ số series phải là số nguyên không âm.";
    }
    const winsRequired = Math.floor(match.bestOf / 2) + 1;
    if (
      parsedA > winsRequired ||
      parsedB > winsRequired ||
      parsedA + parsedB > match.bestOf
    ) {
      return `Tỷ số không hợp lệ với BO${match.bestOf}.`;
    }
    if (resultStatus === "COMPLETED") {
      if (parsedA === parsedB && !drawAllowed) {
        return "Thể thức này yêu cầu một đội thắng.";
      }
      if (
        parsedA !== parsedB &&
        parsedA !== winsRequired &&
        parsedB !== winsRequired
      ) {
        return `Đội thắng phải đạt ${winsRequired} ván.`;
      }
    } else if (parsedA === winsRequired || parsedB === winsRequired) {
      return "Series đã đủ số ván thắng và phải chuyển sang Đã hoàn thành.";
    }
    return { scoreA: parsedA, scoreB: parsedB };
  };

  const saveAggregateResult = async () => {
    if (!match || !editable || saving) return;
    const validated = validateAggregateResult();
    if (typeof validated === "string") {
      setError(validated);
      return;
    }
    if (!validated) return;
    if (
      resultIsCorrection &&
      !window.confirm(
        "Sửa kết quả đã hoàn thành có thể rollback và cập nhật các slot downstream. Backend sẽ từ chối nếu downstream đã hoàn tất. Tiếp tục?",
      )
    ) {
      return;
    }
    setSaving("result");
    setError("");
    setSuccess("");
    try {
      await matchesApi.update(match.id, {
        ...validated,
        status: resultStatus,
      });
      await refreshAfterMutation("Đã cập nhật kết quả từ backend.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không thể cập nhật kết quả",
      );
    } finally {
      setSaving(null);
    }
  };

  const savePerGameScores = async () => {
    if (!match || !editable || saving) return;
    if (!gameScores.length) {
      setError("Cần ít nhất một game score.");
      return;
    }
    const parsed = gameScores.map((score, index) => ({
      setNumber: index + 1,
      teamAScore: Number(score.teamAScore),
      teamBScore: Number(score.teamBScore),
    }));
    if (
      parsed.some(
        (score) =>
          !Number.isInteger(score.teamAScore) ||
          !Number.isInteger(score.teamBScore) ||
          score.teamAScore < 0 ||
          score.teamBScore < 0 ||
          score.teamAScore === score.teamBScore,
      )
    ) {
      setError("Điểm từng game phải là số nguyên không âm và không được hòa.");
      return;
    }
    if (
      resultIsCorrection &&
      !window.confirm(
        "Sửa game scores đã hoàn thành có thể rollback và cập nhật các slot downstream. Tiếp tục?",
      )
    ) {
      return;
    }
    setSaving("result");
    setError("");
    setSuccess("");
    try {
      await matchesApi.putScores(match.id, { scores: parsed });
      await refreshAfterMutation("Đã cập nhật game scores từ backend.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không thể cập nhật game scores",
      );
    } finally {
      setSaving(null);
    }
  };

  const chooseDraw = () => {
    if (!match || !drawAllowed || usePerGameScores) return;
    const drawScore = Math.floor(match.bestOf / 2);
    setScoreA(String(drawScore));
    setScoreB(String(drawScore));
    setResultStatus("COMPLETED");
    setError("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-panel-title"
        className="max-h-[94vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-surface-card shadow-2xl sm:max-w-2xl sm:rounded-2xl"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-surface-card/95 px-4 py-4 backdrop-blur sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
              {ROUND_FORMAT_LABELS[round.format]} · {round.name}
            </p>
            <h2
              id="match-panel-title"
              className="mt-1 text-lg font-bold text-ink"
            >
              Quản lý trận {match?.matchNumber ?? ""}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Đóng"
            onClick={onClose}
            disabled={Boolean(saving)}
            className="grid size-10 shrink-0 place-items-center rounded-full text-ink-muted transition hover:bg-surface-hover hover:text-ink disabled:opacity-50"
          >
            <XIcon size={20} />
          </button>
        </header>

        {loading ? (
          <div className="grid min-h-80 place-items-center">
            <CircleNotchIcon className="animate-spin text-brand" size={30} />
          </div>
        ) : match ? (
          <div className="space-y-6 p-4 sm:p-6">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-2xl bg-surface-sub p-4">
              <TeamHeading match={match} slot="A" />
              <div className="text-center">
                <p className="font-mono text-2xl font-bold text-ink">
                  {match.scoreA} : {match.scoreB}
                </p>
                <p className="mt-1 text-[11px] text-ink-faint">
                  BO{match.bestOf}
                </p>
              </div>
              <TeamHeading match={match} slot="B" />
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-surface-sub px-3 py-1.5 text-ink-muted">
                {MATCH_STATUS_LABELS[match.status]}
              </span>
              {match.outcome === "DRAW" && (
                <span className="rounded-full bg-pending/10 px-3 py-1.5 font-semibold text-pending">
                  Kết quả hòa
                </span>
              )}
              {match.winner && (
                <span className="rounded-full bg-approved/10 px-3 py-1.5 text-approved">
                  Thắng: {match.winner.name}
                </span>
              )}
              {match.isBye && (
                <span className="rounded-full bg-brand/10 px-3 py-1.5 text-brand">
                  BYE
                </span>
              )}
              {!match.isActive && (
                <span className="rounded-full bg-rejected/10 px-3 py-1.5 text-rejected">
                  Chưa kích hoạt
                </span>
              )}
            </div>

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl border border-line p-3">
                <dt className="text-xs text-ink-faint">Vòng / lượt</dt>
                <dd className="mt-1 font-medium text-ink">
                  {match.bracketRound ?? "Không áp dụng"}
                </dd>
              </div>
              <div className="rounded-xl border border-line p-3">
                <dt className="text-xs text-ink-faint">Lịch hiện tại</dt>
                <dd className="mt-1 font-medium text-ink">
                  {formatDateTime(match.scheduledAt)}
                </dd>
              </div>
            </dl>

            {editingReason && (
              <p className="rounded-xl border border-pending/30 bg-pending/10 px-4 py-3 text-sm text-pending">
                {editingReason}. Chỉ có thể xem chi tiết trận này.
              </p>
            )}

            {error && (
              <p
                role="alert"
                className={`${alertErrorClass} flex items-start gap-2`}
              >
                <WarningCircleIcon className="mt-0.5 shrink-0" />
                {error}
              </p>
            )}
            {success && (
              <p
                role="status"
                className="flex items-start gap-2 rounded-xl border border-approved/30 bg-approved/10 px-4 py-3 text-sm text-approved"
              >
                <CheckCircleIcon className="mt-0.5 shrink-0" />
                {success}
              </p>
            )}

            {editable && (
              <>
                <section
                  aria-labelledby="schedule-heading"
                  className="rounded-2xl border border-line p-4"
                >
                  <h3 id="schedule-heading" className="font-bold text-ink">
                    Lịch thi đấu
                  </h3>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label>
                      <span className={labelClass}>Ngày và giờ</span>
                      <span className="relative block">
                        <CalendarBlankIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                        <input
                          type="datetime-local"
                          value={scheduledAt}
                          onChange={(event) =>
                            setScheduledAt(event.target.value)
                          }
                          className={`${inputClass} pl-10`}
                        />
                      </span>
                    </label>
                    <label>
                      <span className={labelClass}>Link phòng đấu</span>
                      <span className="relative block">
                        <LinkIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                        <input
                          type="url"
                          value={discordLink}
                          onChange={(event) =>
                            setDiscordLink(event.target.value)
                          }
                          placeholder="https://..."
                          className={`${inputClass} pl-10`}
                        />
                      </span>
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={saveSchedule}
                    disabled={Boolean(saving)}
                    className={`${secondaryButtonClass} mt-4`}
                  >
                    {saving === "schedule" && (
                      <CircleNotchIcon className="animate-spin" />
                    )}
                    Lưu lịch thi đấu
                  </button>
                </section>

                <section
                  aria-labelledby="result-heading"
                  className="rounded-2xl border border-line p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 id="result-heading" className="font-bold text-ink">
                        Kết quả
                      </h3>
                      <p className="mt-1 text-xs text-ink-faint">
                        {drawAllowed
                          ? "Round này cho phép kết quả hòa."
                          : "Round này yêu cầu kết quả phân thắng bại."}
                      </p>
                    </div>
                    {match.scores.length === 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setUsePerGameScores((current) => !current);
                          setError("");
                        }}
                        className="text-xs font-semibold text-brand hover:underline"
                      >
                        {usePerGameScores
                          ? "Nhập tỷ số series"
                          : "Nhập theo từng game"}
                      </button>
                    )}
                  </div>

                  {usePerGameScores ? (
                    <div className="mt-4 space-y-3">
                      {gameScores.map((score, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-2"
                        >
                          <span className="text-xs text-ink-faint">
                            G{index + 1}
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={score.teamAScore}
                            aria-label={`Điểm game ${index + 1} của ${match.teamA?.name}`}
                            onChange={(event) =>
                              setGameScores((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        teamAScore: event.target.value,
                                      }
                                    : item,
                                ),
                              )
                            }
                            className={inputClass}
                          />
                          <span className="text-ink-faint">–</span>
                          <input
                            type="number"
                            min={0}
                            value={score.teamBScore}
                            aria-label={`Điểm game ${index + 1} của ${match.teamB?.name}`}
                            onChange={(event) =>
                              setGameScores((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        teamBScore: event.target.value,
                                      }
                                    : item,
                                ),
                              )
                            }
                            className={inputClass}
                          />
                          <button
                            type="button"
                            aria-label={`Xóa game ${index + 1}`}
                            onClick={() =>
                              setGameScores((current) =>
                                current.filter(
                                  (_, itemIndex) => itemIndex !== index,
                                ),
                              )
                            }
                            className="grid size-9 place-items-center rounded-lg text-ink-faint hover:bg-rejected/10 hover:text-rejected"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      ))}
                      {gameScores.length < match.bestOf && (
                        <button
                          type="button"
                          onClick={() =>
                            setGameScores((current) => [
                              ...current,
                              { teamAScore: "", teamBScore: "" },
                            ])
                          }
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
                        >
                          <PlusIcon /> Thêm game
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={savePerGameScores}
                        disabled={Boolean(saving)}
                        className={`${primaryButtonClass} mt-2 w-full sm:w-auto`}
                      >
                        {saving === "result" && (
                          <CircleNotchIcon className="animate-spin" />
                        )}
                        {resultIsCorrection
                          ? "Xác nhận sửa game scores"
                          : "Lưu game scores"}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4">
                      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
                        <label>
                          <span className={labelClass}>
                            {match.teamA?.shortName ?? match.teamA?.name}
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={scoreA}
                            onChange={(event) => setScoreA(event.target.value)}
                            className={`${inputClass} text-center font-mono text-lg font-bold`}
                          />
                        </label>
                        <span className="pb-4 text-ink-faint">–</span>
                        <label>
                          <span className={labelClass}>
                            {match.teamB?.shortName ?? match.teamB?.name}
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={scoreB}
                            onChange={(event) => setScoreB(event.target.value)}
                            className={`${inputClass} text-center font-mono text-lg font-bold`}
                          />
                        </label>
                      </div>
                      <label className="mt-4 block">
                        <span className={labelClass}>Trạng thái kết quả</span>
                        <select
                          value={resultStatus}
                          onChange={(event) =>
                            setResultStatus(event.target.value as MatchStatus)
                          }
                          className={inputClass}
                        >
                          <option value="PENDING">Chưa diễn ra</option>
                          <option value="ONGOING">Đang diễn ra</option>
                          <option value="COMPLETED">Đã hoàn thành</option>
                        </select>
                      </label>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={saveAggregateResult}
                          disabled={Boolean(saving)}
                          className={primaryButtonClass}
                        >
                          {saving === "result" && (
                            <CircleNotchIcon className="animate-spin" />
                          )}
                          {resultIsCorrection
                            ? "Xác nhận sửa kết quả"
                            : "Lưu kết quả"}
                        </button>
                        {drawAllowed && (
                          <button
                            type="button"
                            onClick={chooseDraw}
                            disabled={Boolean(saving)}
                            className={secondaryButtonClass}
                          >
                            Đặt kết quả hòa
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        ) : (
          <div className="p-6">
            <p className={alertErrorClass}>
              {error || "Không tìm thấy trận đấu"}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
