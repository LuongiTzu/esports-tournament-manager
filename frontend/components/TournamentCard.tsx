import Link from "next/link";
import { UsersThreeIcon, CalendarBlankIcon } from "@phosphor-icons/react";
import type { Tournament } from "@/lib/api";
import { accentVars } from "@/lib/gameAccents";

function formatDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString("vi-VN") : "Chưa xác định";
}

export default function TournamentCard({
  tournament: t,
}: {
  tournament: Tournament;
}) {
  return (
    <Link
      href={`/tournaments/${t.slug}`}
      style={accentVars(t.game?.name)}
      className="group flex h-full flex-col rounded-xl border border-line border-l-2 border-l-accent bg-surface-card p-5 transition hover:border-line-strong hover:border-l-accent"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-ink transition group-hover:text-accent">
          {t.name}
        </h3>
        {t.game && (
          <span className="shrink-0 rounded-full bg-accent/12 px-2.5 py-1 text-xs font-medium text-accent">
            {t.game.name}
          </span>
        )}
      </div>

      <p className="mt-2 line-clamp-2 flex-1 text-sm text-ink-muted">
        {t.description || "Chưa có mô tả."}
      </p>

      <div className="mt-4 flex items-center justify-between text-xs text-ink-faint">
        <span className="inline-flex items-center gap-1.5">
          <UsersThreeIcon size={14} />
          {t._count?.teams ?? 0} đội
          {t.maxTeams ? ` / ${t.maxTeams}` : ""}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CalendarBlankIcon size={14} />
          {formatDate(t.startDate)}
        </span>
      </div>
    </Link>
  );
}
