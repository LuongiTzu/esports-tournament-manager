import type { TournamentRound } from "@/features/tournaments/types";
import { useLocale } from "@/features/locale/store";

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
  const { t } = useLocale();
  const scoringMode = round.settings.scoringMode ?? "SERIES_SCORE";
  const common = (
    <>
      <SettingPill
        label={t("round.settings.scoringMode")}
        value={t(`round.settings.scoringMode.${scoringMode}`)}
      />
      <SettingPill
        label={t("round.settings.bestOf")}
        value={`BO${round.bestOf}`}
      />
    </>
  );

  switch (round.format) {
    case "ROUND_ROBIN":
      return (
        <div className="flex flex-wrap gap-2">
          {common}
          <SettingPill
            label={t("round.settings.advancingTeams")}
            value={round.settings.advancingTeamCount}
          />
          <SettingPill
            label={t("round.settings.meetings")}
            value={round.settings.meetingsPerPair}
          />
          <SettingPill
            label={t("round.settings.pointsWdl")}
            value={`${round.settings.winPoints}/${round.settings.drawPoints}/${round.settings.lossPoints}`}
          />
          <SettingPill
            label={t("round.settings.draws")}
            value={
              round.settings.allowDraws
                ? t("round.settings.allowed")
                : t("common.no")
            }
          />
        </div>
      );
    case "GROUP_STAGE":
      return (
        <div className="flex flex-wrap gap-2">
          {common}
          <SettingPill
            label={t("round.settings.groups")}
            value={round.settings.numberOfGroups}
          />
          <SettingPill
            label={t("round.settings.advancePerGroup")}
            value={round.settings.advancingTeamsPerGroup}
          />
          <SettingPill
            label={t("round.settings.meetings")}
            value={round.settings.meetingsPerPair}
          />
          <SettingPill
            label={t("round.settings.pointsWdl")}
            value={`${round.settings.winPoints}/${round.settings.drawPoints}/${round.settings.lossPoints}`}
          />
          <SettingPill
            label={t("round.settings.draws")}
            value={
              round.settings.allowDraws
                ? t("round.settings.allowed")
                : t("common.no")
            }
          />
        </div>
      );
    case "SWISS":
      return (
        <div className="flex flex-wrap gap-2">
          {common}
          <SettingPill
            label={t("round.settings.swissRounds")}
            value={
              round.settings.numberOfRounds ?? t("round.settings.automatic")
            }
          />
          <SettingPill
            label={t("round.settings.advancingTeams")}
            value={round.settings.advancingTeamCount}
          />
        </div>
      );
    case "PLAYOFF":
      return (
        <div className="flex flex-wrap gap-2">
          {common}
          <SettingPill
            label={t("round.settings.thirdPlace")}
            value={
              round.settings.thirdPlaceMatch ? t("common.yes") : t("common.no")
            }
          />
        </div>
      );
    case "DOUBLE_ELIM":
      return (
        <div className="flex flex-wrap gap-2">
          {common}
          <SettingPill
            label={t("round.settings.grandFinalReset")}
            value={
              round.settings.grandFinalReset ? t("common.yes") : t("common.no")
            }
          />
        </div>
      );
  }
}
