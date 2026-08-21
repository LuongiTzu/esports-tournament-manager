import {
  ArrowDownIcon,
  CheckCircleIcon,
  UsersIcon,
} from "@phosphor-icons/react/dist/ssr";
import { ROUND_FORMAT_LABELS } from "@/features/tournaments/round-formats";
import type {
  RoundProgressionState,
  RoundStandings,
} from "@/features/tournaments/types";

const STATE_LABELS: Record<RoundProgressionState, string> = {
  NOT_GENERATED: "Giai đoạn chưa được tạo",
  IN_PROGRESS: "Đang chờ hoàn tất các trận bắt buộc",
  TERMINAL_COMPLETE: "Giai đoạn cuối đã hoàn tất",
  ADVANCEMENT_UNSUPPORTED: "Không có quy tắc chuyển vòng được cấu hình",
  AWAITING_ADVANCEMENT: "Đang chờ hệ thống ghi nhận đội đi tiếp",
  READY_FOR_GENERATION: "Đội đi tiếp đã sẵn sàng; vòng sau chờ tạo cấu trúc",
  NEXT_STAGE_GENERATED: "Vòng tiếp theo đã được tạo",
  NEXT_STAGE_COMPLETED: "Vòng tiếp theo đã hoàn tất",
};

export default function RoundProgressionSummary({
  data,
}: {
  data: RoundStandings;
}) {
  const { progress, advancement } = data;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-stretch">
      <div className="rounded-xl border border-line bg-surface-sub p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Tiến độ giai đoạn
        </p>
        <p className="mt-2 text-lg font-bold text-ink">
          {progress.completedRequiredMatches} / {progress.requiredMatches} trận
          bắt buộc hoàn tất
        </p>
        {progress.totalMatches !== progress.requiredMatches && (
          <p className="mt-1 text-xs text-ink-faint">
            {progress.totalMatches} trận trong cấu trúc, gồm trận điều kiện chưa
            kích hoạt.
          </p>
        )}
        <p className="mt-1 text-sm text-ink-muted">
          {STATE_LABELS[advancement.state]}
        </p>
      </div>

      {advancement.nextRound && (
        <ArrowDownIcon
          className="mx-auto self-center text-brand lg:-rotate-90"
          size={24}
        />
      )}

      {advancement.nextRound ? (
        <div className="rounded-xl border border-brand/30 bg-brand/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">
            Vòng tiếp theo
          </p>
          <p className="mt-2 font-bold text-ink">
            {advancement.nextRound.name}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {ROUND_FORMAT_LABELS[advancement.nextRound.format]} ·{" "}
            {advancement.nextRound.participantCount} đội được gán ·{" "}
            {advancement.nextRound.matchCount} trận
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-surface-sub p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Đầu ra
          </p>
          <p className="mt-2 text-sm text-ink-muted">
            Không có Tournament Round kế tiếp.
          </p>
        </div>
      )}

      {advancement.qualifiedTeams.length > 0 && (
        <div className="lg:col-span-3 rounded-xl border border-approved/30 bg-approved/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-approved">
            <CheckCircleIcon weight="fill" />{" "}
            {advancement.qualifiedTeams.length} đội đã được hệ thống xác nhận đi
            tiếp
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {advancement.qualifiedTeams.map(({ team }) => (
              <span
                key={team.id}
                className="rounded-full border border-approved/30 bg-surface-card px-3 py-1 text-xs font-medium text-ink"
              >
                {team.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {data.participants.length > 0 && (
        <div className="lg:col-span-3 flex items-start gap-3 rounded-xl border border-line px-4 py-3 text-sm text-ink-muted">
          <UsersIcon className="mt-0.5 shrink-0 text-brand" />
          <span>
            Giai đoạn này có{" "}
            <strong className="text-ink">{data.participants.length} đội</strong>{" "}
            được gán
            {data.participants.some((item) => item.advancedFromRound)
              ? " từ kết quả giai đoạn trước."
              : "."}
          </span>
        </div>
      )}
    </div>
  );
}
