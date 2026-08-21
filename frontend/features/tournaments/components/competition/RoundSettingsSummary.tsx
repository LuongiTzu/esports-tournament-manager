import type { TournamentRound } from "@/features/tournaments/types";

function SettingPill({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <span className="rounded-lg border border-line bg-surface-sub px-3 py-2 text-xs text-ink-muted">
      {label}: <strong className="font-semibold text-ink">{value}</strong>
    </span>
  );
}

export default function RoundSettingsSummary({
  round,
}: {
  round: TournamentRound;
}) {
  const common = <SettingPill label="Best of" value={`BO${round.bestOf}`} />;

  switch (round.format) {
    case "ROUND_ROBIN":
      return (
        <div className="flex flex-wrap gap-2">
          {common}
          <SettingPill
            label="Số lượt gặp"
            value={round.settings.meetingsPerPair}
          />
          <SettingPill
            label="Điểm W/D/L"
            value={`${round.settings.winPoints}/${round.settings.drawPoints}/${round.settings.lossPoints}`}
          />
          <SettingPill
            label="Kết quả hòa"
            value={round.settings.allowDraws ? "Cho phép" : "Không"}
          />
        </div>
      );
    case "GROUP_STAGE":
      return (
        <div className="flex flex-wrap gap-2">
          {common}
          <SettingPill label="Số bảng" value={round.settings.numberOfGroups} />
          <SettingPill
            label="Đi tiếp / bảng"
            value={round.settings.advancingTeamsPerGroup}
          />
          <SettingPill
            label="Số lượt gặp"
            value={round.settings.meetingsPerPair}
          />
          <SettingPill
            label="Điểm W/D/L"
            value={`${round.settings.winPoints}/${round.settings.drawPoints}/${round.settings.lossPoints}`}
          />
          <SettingPill
            label="Kết quả hòa"
            value={round.settings.allowDraws ? "Cho phép" : "Không"}
          />
        </div>
      );
    case "SWISS":
      return (
        <div className="flex flex-wrap gap-2">
          {common}
          <SettingPill
            label="Số lượt Swiss"
            value={round.settings.numberOfRounds ?? "Tự động"}
          />
          <SettingPill
            label="Số đội đi tiếp"
            value={round.settings.advancingTeamCount}
          />
        </div>
      );
    case "PLAYOFF":
      return (
        <div className="flex flex-wrap gap-2">
          {common}
          <SettingPill
            label="Tranh hạng ba"
            value={round.settings.thirdPlaceMatch ? "Có" : "Không"}
          />
        </div>
      );
    case "DOUBLE_ELIM":
      return (
        <div className="flex flex-wrap gap-2">
          {common}
          <SettingPill
            label="Grand Final Reset"
            value={round.settings.grandFinalReset ? "Có" : "Không"}
          />
        </div>
      );
  }
}
