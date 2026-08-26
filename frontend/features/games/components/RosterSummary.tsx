import { useLocale } from "@/features/locale/store";

export default function RosterSummary({
  activeSize,
  maxRosterSize,
}: {
  activeSize?: number;
  maxRosterSize?: number;
}) {
  const { t } = useLocale();
  if (!activeSize || !maxRosterSize) return null;
  const substitutes = Math.max(0, maxRosterSize - activeSize);

  return (
    <div className="grid gap-2 rounded-xl border border-brand/20 bg-brand/8 p-4 text-sm sm:grid-cols-3">
      <p>
        <span className="font-bold text-ink">{activeSize}</span>{" "}
        <span className="text-ink-muted">{t("game.structure.activePlayers")}</span>
      </p>
      <p>
        <span className="font-bold text-ink">{maxRosterSize}</span>{" "}
        <span className="text-ink-muted">{t("game.structure.maximumRoster")}</span>
      </p>
      <p className="text-ink-muted">
        {substitutes === 0
          ? t("game.structure.noSubstitutes")
          : `${t("game.structure.upTo")} ${substitutes} ${t("game.structure.substitutes")}`}
      </p>
    </div>
  );
}
