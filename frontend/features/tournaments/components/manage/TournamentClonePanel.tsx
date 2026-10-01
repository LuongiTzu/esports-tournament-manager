"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleNotchIcon, CopyIcon } from "@phosphor-icons/react";
import {
  alertErrorClass,
  inputClass,
  labelClass,
  secondaryButtonClass,
} from "@/components/ui";
import { useLocale } from "@/features/locale/store";
import { tournamentsApi } from "@/features/tournaments/api";
import type { TournamentDetail } from "@/features/tournaments/types";

export default function TournamentClonePanel({
  tournament,
}: {
  tournament: TournamentDetail;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const [name, setName] = useState(`${tournament.name} - Copy`);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const clone = async () => {
    const trimmedName = name.trim();
    if (trimmedName.length < 3 || working) return;
    setWorking(true);
    setError("");
    try {
      const created = await tournamentsApi.clone(tournament.id, trimmedName);
      router.push(`/tournaments/${encodeURIComponent(created.slug)}/manage`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("clone.error"));
      setWorking(false);
    }
  };

  return (
    <section className="rounded-2xl border border-line bg-surface-card p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
        <CopyIcon className="text-brand" />
        {t("clone.title")}
      </h2>
      <p className="mt-2 text-sm leading-6 text-ink-muted">
        {t("clone.description")}
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1">
          <span className={labelClass}>{t("clone.name")}</span>
          <input
            value={name}
            maxLength={150}
            onChange={(event) => setName(event.target.value)}
            className={inputClass}
          />
        </label>
        <button
          type="button"
          disabled={name.trim().length < 3 || working}
          onClick={() => void clone()}
          className={secondaryButtonClass}
        >
          {working ? (
            <CircleNotchIcon className="animate-spin" />
          ) : (
            <CopyIcon />
          )}
          {t("clone.action")}
        </button>
      </div>
      {error && <p className={`${alertErrorClass} mt-4`}>{error}</p>}
    </section>
  );
}
