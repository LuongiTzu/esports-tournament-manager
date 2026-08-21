import ResolvedImage from "@/components/ResolvedImage";
import type { BracketMatch, BracketTeam } from "@/features/tournaments/types";

const STATUS_LABELS: Record<BracketMatch["status"], string> = {
  PENDING: "Chưa đấu",
  ONGOING: "Đang đấu",
  COMPLETED: "Đã xong",
};

function TeamSlot({
  team,
  score,
  winner,
}: {
  team: BracketTeam | null;
  score: number;
  winner: boolean;
}) {
  return (
    <div
      className={`flex min-h-11 items-center gap-2 rounded-lg px-2.5 py-2 ${
        winner ? "bg-approved/10 text-ink" : "bg-surface-sub text-ink-muted"
      }`}
    >
      <span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-md bg-brand/10 text-xs font-bold text-brand">
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
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {team?.name ?? "Chờ xác định"}
      </span>
      {team?.seed != null && (
        <span className="text-[10px] text-ink-faint">#{team.seed}</span>
      )}
      <span
        className={`font-mono text-sm font-bold ${winner ? "text-approved" : "text-ink"}`}
      >
        {score}
      </span>
    </div>
  );
}

export default function BracketMatchCard({
  match,
  label,
  linkLabels,
  onSelect,
}: {
  match: BracketMatch;
  label?: string;
  linkLabels?: { winner?: string; loser?: string };
  onSelect?: (match: BracketMatch) => void;
}) {
  const winnerId = match.winner?.id;

  return (
    <article
      className={`w-64 shrink-0 rounded-xl border p-3 ${
        match.isActive
          ? "border-line bg-surface-card"
          : "border-dashed border-line bg-surface-card/55 opacity-70"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2 text-[11px]">
        <span className="truncate font-semibold uppercase tracking-[0.12em] text-ink-faint">
          {label ?? `Trận ${match.matchNumber ?? "–"}`}
        </span>
        <span
          className={
            match.status === "COMPLETED"
              ? "text-approved"
              : match.status === "ONGOING"
                ? "text-pending"
                : "text-ink-faint"
          }
        >
          {STATUS_LABELS[match.status]}
        </span>
      </div>

      {match.isBye ? (
        <div className="rounded-lg border border-dashed border-brand/30 bg-brand/5 px-3 py-3 text-sm">
          <span className="font-semibold text-brand">BYE</span>
          <span className="ml-2 text-ink-muted">
            {match.slots.A?.name ?? match.slots.B?.name ?? "Không có đội"}
          </span>
        </div>
      ) : (
        <div className="space-y-1.5">
          <TeamSlot
            team={match.slots.A}
            score={match.score.A}
            winner={Boolean(winnerId && winnerId === match.slots.A?.id)}
          />
          <TeamSlot
            team={match.slots.B}
            score={match.score.B}
            winner={Boolean(winnerId && winnerId === match.slots.B?.id)}
          />
        </div>
      )}

      {match.outcome === "DRAW" && (
        <p className="mt-2 rounded-md bg-pending/10 px-2 py-1 text-center text-[11px] font-semibold text-pending">
          Kết quả hòa
        </p>
      )}

      {match.scheduledAt && (
        <p className="mt-2 text-[10px] text-ink-faint">
          {new Intl.DateTimeFormat("vi-VN", {
            dateStyle: "short",
            timeStyle: "short",
          }).format(new Date(match.scheduledAt))}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between text-[10px] text-ink-faint">
        <span>BO{match.bestOf}</span>
        {!match.isActive && <span>Chưa kích hoạt</span>}
      </div>
      {(linkLabels?.winner || linkLabels?.loser) && (
        <div className="mt-2 border-t border-line/70 pt-2 text-[10px] text-ink-faint">
          {linkLabels.winner && <p>Thắng → {linkLabels.winner}</p>}
          {linkLabels.loser && (
            <p className="mt-0.5">Thua → {linkLabels.loser}</p>
          )}
        </div>
      )}
      {onSelect && (
        <button
          type="button"
          onClick={() => onSelect(match)}
          className="mt-3 w-full rounded-lg border border-line py-2 text-xs font-semibold text-ink-muted transition hover:border-brand/50 hover:bg-brand/5 hover:text-brand"
        >
          {match.isBye || !match.isActive ? "Xem chi tiết" : "Xem / quản lý"}
        </button>
      )}
    </article>
  );
}
