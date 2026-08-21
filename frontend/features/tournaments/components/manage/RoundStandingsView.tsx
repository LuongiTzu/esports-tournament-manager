import { CheckCircleIcon, TrophyIcon } from "@phosphor-icons/react/dist/ssr";
import type {
  RoundStandings,
  SwissStanding,
  TournamentRound,
  TournamentStandingsResponse,
} from "@/features/tournaments/types";
import StandingsTable from "./StandingsTable";

function SwissTable({
  rows,
  qualifiedTeamIds,
}: {
  rows: SwissStanding[];
  qualifiedTeamIds: string[];
}) {
  if (!rows.length) {
    return (
      <p className="text-sm text-ink-muted">Chưa có dữ liệu xếp hạng Swiss.</p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[820px] text-sm">
        <thead className="bg-surface-sub text-xs uppercase tracking-wide text-ink-faint">
          <tr>
            <th className="px-3 py-3 text-center">Hạng</th>
            <th className="px-3 py-3 text-left">Đội</th>
            <th className="px-3 py-3 text-center">Đã đấu</th>
            <th className="px-3 py-3 text-center">W-L</th>
            <th className="px-3 py-3 text-center">Điểm</th>
            <th className="px-3 py-3 text-center">BYE</th>
            <th className="px-3 py-3 text-center">Buchholz</th>
            <th className="px-3 py-3 text-center">Cut-1</th>
            <th className="px-3 py-3 text-center">Hiệu số</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => {
            const qualified = qualifiedTeamIds.includes(row.teamId);
            return (
              <tr key={row.teamId} className={qualified ? "bg-approved/5" : ""}>
                <td className="px-3 py-3 text-center font-semibold text-ink">
                  {row.rank}
                </td>
                <td className="px-3 py-3 font-medium text-ink">
                  <span className="flex items-center gap-2">
                    {row.team?.name ?? `Đội ${row.teamId.slice(0, 8)}`}
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
                  {row.wins}-{row.losses}
                </td>
                <td className="px-3 py-3 text-center font-bold text-brand">
                  {row.points}
                </td>
                <td className="px-3 py-3 text-center text-ink-muted">
                  {row.byes}
                </td>
                <td className="px-3 py-3 text-center text-ink-muted">
                  {row.buchholz}
                </td>
                <td className="px-3 py-3 text-center text-ink-muted">
                  {row.buchholzCut1}
                </td>
                <td className="px-3 py-3 text-center text-ink-muted">
                  {row.scoreDifference > 0 ? "+" : ""}
                  {row.scoreDifference}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function RoundStandingsView({
  data,
  round,
  tournament,
}: {
  data: RoundStandings;
  round: TournamentRound;
  tournament: TournamentStandingsResponse["tournament"];
}) {
  const qualifiedTeamIds = data.advancement.qualifiedTeams.map(
    ({ team }) => team.id,
  );

  if (data.format === "PLAYOFF" || data.format === "DOUBLE_ELIM") {
    return (
      <div className="rounded-xl border border-line bg-surface-sub p-4">
        <p className="text-sm font-semibold text-ink">Kết quả loại trực tiếp</p>
        {tournament.champion ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-approved">
            <TrophyIcon weight="fill" /> Nhà vô địch:{" "}
            <strong>{tournament.champion.name}</strong>
          </p>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">
            Thể thức loại trực tiếp không sử dụng bảng xếp hạng. Nhà vô địch sẽ
            xuất hiện khi hệ thống hoàn tất giải đấu.
          </p>
        )}
      </div>
    );
  }

  if (data.format === "GROUP_STAGE") {
    return (
      <div className="space-y-5">
        <p className="text-sm text-ink-muted">
          {round.format === "GROUP_STAGE" &&
            `${round.settings.advancingTeamsPerGroup} đội đi tiếp mỗi bảng. Dấu “Đi tiếp” chỉ phản ánh dữ liệu chuyển vòng đã được hệ thống lưu.`}
        </p>
        {data.standings.map((group) => (
          <section
            key={group.groupId}
            aria-labelledby={`standing-${group.groupId}`}
          >
            <h4
              id={`standing-${group.groupId}`}
              className="mb-2 font-semibold text-ink"
            >
              {group.name}
            </h4>
            <StandingsTable
              rows={group.standings}
              qualifiedTeamIds={qualifiedTeamIds}
            />
          </section>
        ))}
      </div>
    );
  }

  if (data.format === "SWISS") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink-muted">
          Hệ thống xếp hạng theo thành tích và các chỉ số tiebreak cố định.
          Swiss không chấp nhận kết quả hòa.
        </p>
        <SwissTable rows={data.standings} qualifiedTeamIds={qualifiedTeamIds} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">
        Điểm W/D/L:{" "}
        {round.format === "ROUND_ROBIN" &&
          `${round.settings.winPoints}/${round.settings.drawPoints}/${round.settings.lossPoints}`}
        . Vòng tròn hiện không có quy tắc chuyển vòng được cấu hình, nên không
        hiển thị đội đi tiếp.
      </p>
      <StandingsTable rows={data.standings} />
    </div>
  );
}
