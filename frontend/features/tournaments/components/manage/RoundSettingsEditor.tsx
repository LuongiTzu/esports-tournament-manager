"use client";

import { useState } from "react";
import { tournamentsApi } from "@/features/tournaments/api";
import type { TournamentRound } from "@/features/tournaments/types";
import { useLocale } from "@/features/locale/store";
import { primaryButtonClass } from "@/components/ui";
import SwissSettingsFields, {
  type SwissSettingsDraft,
} from "../competition/SwissSettingsFields";

export default function RoundSettingsEditor({
  round,
  locked,
  onSaved,
}: {
  round: TournamentRound;
  locked: boolean;
  onSaved: () => Promise<void>;
}) {
  const { t } = useLocale();
  const [draft, setDraft] = useState<SwissSettingsDraft>(() => ({
    mode:
      round.format === "SWISS"
        ? (round.settings.mode ?? "FIXED_ROUNDS")
        : "FIXED_ROUNDS",
    winsToAdvance: String(
      round.format === "SWISS" ? (round.settings.winsToAdvance ?? 3) : 3,
    ),
    lossesToEliminate: String(
      round.format === "SWISS" ? (round.settings.lossesToEliminate ?? 3) : 3,
    ),
    numberOfRounds:
      round.format === "SWISS"
        ? String(round.settings.numberOfRounds ?? "")
        : "",
    advancingTeamCount: String(
      round.format === "SWISS" ? round.settings.advancingTeamCount : 8,
    ),
  }));
  const [reset, setReset] = useState(
    round.format === "DOUBLE_ELIM" && round.settings.grandFinalReset,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  if (round.format !== "SWISS" && round.format !== "DOUBLE_ELIM") return null;
  return (
    <details className="mt-4 rounded-xl border border-line bg-surface-sub/40 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-ink">
        {t("competition.settings.edit")}
      </summary>
      <form
        className="mt-4 space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (locked || saving) return;
          setSaving(true);
          setError("");
          setSaved(false);
          try {
            const settings =
              round.format === "DOUBLE_ELIM"
                ? { grandFinalReset: reset }
                : {
                    mode: draft.mode,
                    numberOfRounds:
                      draft.mode === "THRESHOLD" || !draft.numberOfRounds
                        ? null
                        : Number(draft.numberOfRounds),
                    advancingTeamCount: Number(draft.advancingTeamCount),
                    ...(draft.mode === "THRESHOLD"
                      ? {
                          winsToAdvance: Number(draft.winsToAdvance),
                          lossesToEliminate: Number(draft.lossesToEliminate),
                        }
                      : {}),
                  };
            await tournamentsApi.updateRoundSettings(round.id, settings);
            setSaved(true);
            await onSaved();
          } catch (reason) {
            setError(
              reason instanceof Error
                ? reason.message
                : t("competition.manage.loadError"),
            );
          } finally {
            setSaving(false);
          }
        }}
      >
        {round.format === "SWISS" ? (
          <SwissSettingsFields
            value={draft}
            onChange={(key, value) => {
              setSaved(false);
              setDraft((current) => ({ ...current, [key]: value }));
            }}
            disabled={locked || saving}
          />
        ) : (
          <label className="flex items-start gap-3 rounded-lg border border-line p-4">
            <input
              type="checkbox"
              role="switch"
              checked={reset}
              disabled={locked || saving}
              onChange={(event) => {
                setReset(event.target.checked);
                setSaved(false);
              }}
              className="mt-1 size-5 accent-[var(--color-brand)]"
            />
            <span>
              <strong className="block text-sm text-ink">
                {t("round.settings.grandFinalReset")}
              </strong>
              <span className="mt-1 block text-xs leading-relaxed text-ink-muted">
                {t("tournament.create.grandFinalResetHint")}
              </span>
            </span>
          </label>
        )}
        {locked ? (
          <p className="text-xs text-ink-muted">
            {t("competition.settings.locked")}
          </p>
        ) : (
          <button
            type="submit"
            disabled={saving}
            className={primaryButtonClass}
          >
            {t("competition.settings.save")}
          </button>
        )}
        {error && (
          <p role="alert" className="text-sm text-rejected">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="text-sm text-approved">
            {t("competition.settings.saved")}
          </p>
        )}
      </form>
    </details>
  );
}
