"use client";

import type { BasicStanding, BracketTeam } from "@/features/tournaments/types";
import ResolvedImage from "@/components/ResolvedImage";
import { useLocale } from "@/features/locale/store";
import QualificationBadge from "./QualificationBadge";

export default function StandingsTable({
  rows,
  qualifiedTeamIds = [],
  teams,
  compact = false,
  cutoff,
}: {
  rows: BasicStanding[];
  qualifiedTeamIds?: string[];
  teams?: ReadonlyMap<string, BracketTeam>;
  compact?: boolean;
  cutoff?: number;
}) {
  const { t } = useLocale();
  if (!rows.length) {
    return (
      <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-muted">
        {t("standings.empty")}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table
        className={`w-full text-sm ${compact ? "min-w-[290px]" : "sm:min-w-[680px]"}`}
      >
        <thead className="bg-surface-sub text-xs uppercase tracking-wide text-ink-faint">
          <tr>
            <th className="px-3 py-3 text-center">{t("standings.rank")}</th>
            <th className="px-3 py-3 text-left">{t("standings.team")}</th>
            {!compact && (
              <>
                <th className="hidden px-3 py-3 text-center sm:table-cell">
                  {t("standings.played")}
                </th>
                <th className="hidden px-3 py-3 text-center sm:table-cell">{t("standings.wins")}</th>
                <th className="hidden px-3 py-3 text-center sm:table-cell">
                  {t("standings.draws")}
                </th>
                <th className="hidden px-3 py-3 text-center sm:table-cell">
                  {t("standings.losses")}
                </th>
                <th className="hidden px-3 py-3 text-center sm:table-cell">
                  {t("standings.difference")}
                </th>
              </>
            )}
            <th className="px-3 py-3 text-center">{t("standings.points")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => {
            const qualified = qualifiedTeamIds.includes(row.id);
            return (
              <tr
                key={row.id}
                className={`${qualified ? "bg-approved/10" : "hover:bg-brand/5"} ${cutoff === row.rank ? "border-b-2 border-brand/40" : ""}`}
              >
                <td className="px-3 py-3 text-center font-semibold text-ink">
                  {row.rank}
                </td>
                <td className="px-3 py-3">
                  <span className="flex items-center gap-2 font-medium text-ink">
                    <span className="grid size-7 shrink-0 place-items-center rounded-md bg-brand/10 text-xs text-brand">
                      <ResolvedImage
                        src={teams?.get(row.id)?.logoUrl}
                        alt=""
                        className="size-6 object-contain"
                        fallback={row.name.slice(0, 1)}
                      />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="min-w-0 flex-1 basis-24" title={row.name}>
                        {row.name}
                      </span>
                      {qualified && <QualificationBadge />}
                    </span>
                  </span>
                </td>
                {!compact && (
                  <>
                    <td className="hidden px-3 py-3 text-center sm:table-cell text-ink-muted">
                      {row.played}
                    </td>
                    <td className="hidden px-3 py-3 text-center sm:table-cell text-ink-muted">
                      {row.wins}
                    </td>
                    <td className="hidden px-3 py-3 text-center sm:table-cell text-ink-muted">
                      {row.draws}
                    </td>
                    <td className="hidden px-3 py-3 text-center sm:table-cell text-ink-muted">
                      {row.losses}
                    </td>
                    <td className="hidden px-3 py-3 text-center sm:table-cell text-ink-muted">
                      {row.scoreDifference > 0 ? "+" : ""}
                      {row.scoreDifference}
                    </td>
                  </>
                )}
                <td className="px-3 py-3 text-center font-bold text-brand">
                  {row.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
