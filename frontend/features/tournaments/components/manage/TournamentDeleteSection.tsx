"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TrashIcon } from "@phosphor-icons/react";
import { alertErrorClass } from "@/components/ui";
import { useLocale } from "@/features/locale/store";
import { tournamentsApi } from "@/features/tournaments/api";
import type { TournamentDetail } from "@/features/tournaments/types";

export default function TournamentDeleteSection({
  tournament,
}: {
  tournament: TournamentDetail;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const pending = useRef(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const remove = async () => {
    if (
      pending.current ||
      !window.confirm(
        t("deleteTournament.confirm").replace("{name}", tournament.name),
      )
    )
      return;
    pending.current = true;
    setWorking(true);
    setError("");
    try {
      await tournamentsApi.remove(tournament.id);
      router.replace("/users/me");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : t("deleteTournament.error"),
      );
      pending.current = false;
      setWorking(false);
    }
  };

  return (
    <section
      aria-labelledby="delete-tournament-heading"
      className="rounded-2xl border border-rejected/30 bg-surface-card p-5 sm:p-6"
    >
      <h2
        id="delete-tournament-heading"
        className="text-lg font-bold text-rejected"
      >
        {t("deleteTournament.title")}
      </h2>
      <p className="mt-2 text-sm text-ink-muted">
        {t("deleteTournament.hint")}
      </p>
      <p className="mt-2 break-words font-semibold">{tournament.name}</p>
      {error && (
        <p role="alert" className={`${alertErrorClass} mt-4`}>
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={working}
        onClick={() => void remove()}
        className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg border border-rejected/40 px-4 py-2 text-sm font-semibold text-rejected hover:bg-rejected/10 disabled:opacity-50"
      >
        <TrashIcon aria-hidden />
        {t(working ? "deleteTournament.deleting" : "deleteTournament.title")}
      </button>
    </section>
  );
}
