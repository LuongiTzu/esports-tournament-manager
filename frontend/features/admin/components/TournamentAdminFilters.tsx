"use client";

import { FunnelIcon, XIcon } from "@phosphor-icons/react";
import { inputClass, secondaryButtonClass } from "@/components/ui";
import type { AdminTournamentModerationStatus } from "@/features/admin/types";
import { useLocale } from "@/features/locale/store";

export default function TournamentAdminFilters({
  moderationStatus,
  onChange,
}: {
  moderationStatus?: AdminTournamentModerationStatus;
  onChange: (value?: AdminTournamentModerationStatus) => void;
}) {
  const { t } = useLocale();
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface-card p-4 shadow-sm">
      <FunnelIcon className="text-brand" size={20} weight="duotone" />
      <label className="min-w-56 flex-1 sm:max-w-xs">
        <span className="sr-only">{t("admin.tournaments.filterAria")}</span>
        <select
          value={moderationStatus ?? "ALL"}
          onChange={(event) =>
            onChange(
              event.target.value === "ALL"
                ? undefined
                : (event.target.value as AdminTournamentModerationStatus),
            )
          }
          className={inputClass}
        >
          <option value="ALL">{t("admin.tournaments.allModeration")}</option>
          <option value="ACTIVE">{t("admin.tournaments.active")}</option>
          <option value="HIDDEN_BY_ADMIN">{t("admin.tournaments.hidden")}</option>
        </select>
      </label>
      {moderationStatus && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className={`${secondaryButtonClass} px-4`}
        >
          <XIcon /> {t("admin.users.clearFilters")}
        </button>
      )}
      <p className="basis-full text-xs text-ink-faint">
        {t("admin.tournaments.filterLimitation")}
      </p>
    </div>
  );
}
