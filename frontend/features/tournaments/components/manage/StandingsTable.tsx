import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr";
import type { BasicStanding } from "@/features/tournaments/types";

export default function StandingsTable({
  rows,
  qualifiedTeamIds = [],
}: {
  rows: BasicStanding[];
  qualifiedTeamIds?: string[];
}) {
  if (!rows.length) {
    return (
      <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-muted">
        Chưa có dữ liệu xếp hạng.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[680px] text-sm">
        <thead className="bg-surface-sub text-xs uppercase tracking-wide text-ink-faint">
          <tr>
            <th className="px-3 py-3 text-center">Hạng</th>
            <th className="px-3 py-3 text-left">Đội</th>
            <th className="px-3 py-3 text-center">Đã đấu</th>
            <th className="px-3 py-3 text-center">Thắng</th>
            <th className="px-3 py-3 text-center">Hòa</th>
            <th className="px-3 py-3 text-center">Thua</th>
            <th className="px-3 py-3 text-center">Hiệu số</th>
            <th className="px-3 py-3 text-center">Điểm</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => {
            const qualified = qualifiedTeamIds.includes(row.id);
            return (
              <tr key={row.id} className={qualified ? "bg-approved/5" : ""}>
                <td className="px-3 py-3 text-center font-semibold text-ink">
                  {row.rank}
                </td>
                <td className="px-3 py-3">
                  <span className="flex items-center gap-2 font-medium text-ink">
                    {row.name}
                    {qualified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-approved/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-approved">
                        <CheckCircleIcon weight="fill" /> Đi tiếp
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-3 py-3 text-center text-ink-muted">
                  {row.played}
                </td>
                <td className="px-3 py-3 text-center text-ink-muted">
                  {row.wins}
                </td>
                <td className="px-3 py-3 text-center text-ink-muted">
                  {row.draws}
                </td>
                <td className="px-3 py-3 text-center text-ink-muted">
                  {row.losses}
                </td>
                <td className="px-3 py-3 text-center text-ink-muted">
                  {row.scoreDifference > 0 ? "+" : ""}
                  {row.scoreDifference}
                </td>
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
