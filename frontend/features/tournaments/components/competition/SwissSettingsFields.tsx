"use client";

import { inputClass, labelClass } from "@/components/ui";
import { useLocale } from "@/features/locale/store";

export interface SwissSettingsDraft {
  mode: string;
  winsToAdvance: string;
  lossesToEliminate: string;
  numberOfRounds: string;
  advancingTeamCount: string;
}

export default function SwissSettingsFields({
  value,
  onChange,
  disabled = false,
}: {
  value: SwissSettingsDraft;
  onChange: (key: keyof SwissSettingsDraft, value: string) => void;
  disabled?: boolean;
}) {
  const { t } = useLocale();
  const threshold = value.mode === "THRESHOLD";
  const fields = threshold
    ? ([
        { key: "winsToAdvance", label: t("swiss.winsTarget"), max: 10 },
        { key: "lossesToEliminate", label: t("swiss.lossesTarget"), max: 10 },
      ] as const)
    : ([
        {
          key: "numberOfRounds",
          label: t("tournament.create.swissRounds"),
          max: 20,
        },
        {
          key: "advancingTeamCount",
          label: t("round.settings.advancingTeams"),
          max: 256,
        },
      ] as const);
  return (
    <fieldset disabled={disabled} className="space-y-3 disabled:opacity-60">
      <legend className="mb-3 text-sm font-semibold text-ink">
        {t("swiss.mode")}
      </legend>
      <div className="flex flex-wrap gap-2">
        {(["FIXED_ROUNDS", "THRESHOLD"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={value.mode === mode}
            onClick={() => onChange("mode", mode)}
            className={`min-h-10 rounded-lg border px-4 text-sm font-medium ${value.mode === mode ? "border-brand bg-brand/10 text-brand" : "border-line text-ink-muted"}`}
          >
            {t(mode === "THRESHOLD" ? "swiss.threshold" : "swiss.fixed")}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <label key={field.key} className={labelClass}>
            {field.label}
            <input
              type="number"
              min={1}
              max={field.max}
              step={1}
              required={field.key !== "numberOfRounds"}
              value={value[field.key]}
              placeholder={
                field.key === "numberOfRounds"
                  ? t("round.settings.automatic")
                  : undefined
              }
              onChange={(event) => onChange(field.key, event.target.value)}
              className={`${inputClass} mt-1`}
            />
          </label>
        ))}
      </div>
      <p className="rounded-lg bg-brand/5 p-3 text-xs leading-relaxed text-ink-muted">
        {t(
          threshold ? "swiss.thresholdHint" : "tournament.create.swissBehavior",
        )}
      </p>
    </fieldset>
  );
}
