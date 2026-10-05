"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  CopyIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import {
  alertErrorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/components/ui";
import { useLocale } from "@/features/locale/store";
import { tournamentsApi } from "@/features/tournaments/api";
import type { TournamentDetail } from "@/features/tournaments/types";
import { ApiError } from "@/lib/api/client";

const MAX_NAME_LENGTH = 150;

export default function TournamentClonePanel({
  tournament,
}: {
  tournament: TournamentDetail;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const suffix = t("clone.nameSuffix");
  const [name, setName] = useState(
    () => `${tournament.name.slice(0, MAX_NAME_LENGTH - suffix.length)}${suffix}`,
  );
  const pending = useRef(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const clone = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (pending.current) return;
    if (trimmedName.length < 3) {
      setError(t("clone.nameError"));
      return;
    }
    pending.current = true;
    setWorking(true);
    setError("");
    try {
      const created = await tournamentsApi.clone(tournament.id, trimmedName);
      router.push(`/tournaments/${encodeURIComponent(created.slug)}/manage`);
    } catch (reason) {
      setError(
        reason instanceof ApiError && reason.status === 401
          ? t("clone.unauthorized")
          : reason instanceof ApiError && reason.status === 403
            ? t("clone.forbidden")
            : reason instanceof ApiError && reason.status === 404
              ? t("clone.notFound")
              : reason instanceof Error
                ? reason.message
                : t("clone.error"),
      );
      pending.current = false;
      setWorking(false);
    }
  };

  return (
    <section
      id="clone-tournament"
      aria-labelledby="clone-tournament-heading"
      className="scroll-mt-28 rounded-2xl border border-line bg-surface-card p-5 sm:p-6"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
        {t("clone.eyebrow")}
      </p>
      <h2
        id="clone-tournament-heading"
        className="mt-1 flex items-center gap-2 text-lg font-bold text-ink"
      >
        <CopyIcon aria-hidden className="text-brand" />
        {t("clone.title")}
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">
        {t("clone.description")}
      </p>

      <div className="mt-5 rounded-xl border border-brand/20 bg-brand/5 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">
          {t("clone.source")}
        </p>
        <p className="mt-1 break-words text-sm font-semibold text-ink">
          {tournament.name} · {tournament.game.name} ·{" "}
          {t("clone.roundCount").replace(
            "{count}",
            String(tournament.rounds?.length ?? 0),
          )}
        </p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-line p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
            <CheckCircleIcon aria-hidden className="text-approved" />
            {t("clone.copiedTitle")}
          </h3>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-ink-muted">
            <li>{t("clone.copiedGame")}</li>
            <li>{t("clone.copiedInfo")}</li>
            <li>
              {t(
                tournament.rounds?.length
                  ? "clone.copiedRounds"
                  : "clone.noRounds",
              )}
            </li>
          </ul>
        </div>
        <div className="rounded-xl border border-line p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
            <WarningCircleIcon aria-hidden className="text-pending" />
            {t("clone.resetTitle")}
          </h3>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-ink-muted">
            <li>{t("clone.resetDates")}</li>
            <li>{t("clone.resetPeople")}</li>
            <li>{t("clone.resetMatches")}</li>
          </ul>
        </div>
      </div>

      <p className="mt-4 text-sm font-medium text-ink">
        {t("clone.draftState")}
      </p>

      <form onSubmit={(event) => void clone(event)} className="mt-5">
        <label htmlFor="clone-tournament-name" className={labelClass}>
          {t("clone.name")}
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <input
              id="clone-tournament-name"
              name="cloneTournamentName"
              type="text"
              required
              minLength={3}
              maxLength={MAX_NAME_LENGTH}
              value={name}
              disabled={working}
              aria-describedby="clone-tournament-name-hint"
              aria-invalid={Boolean(error) && name.trim().length < 3}
              onChange={(event) => {
                setName(event.target.value);
                if (error) setError("");
              }}
              className={inputClass}
            />
            <p
              id="clone-tournament-name-hint"
              className="mt-1 text-xs text-ink-muted"
            >
              {t("clone.nameHint")}
            </p>
          </div>
          <button
            type="submit"
            disabled={working}
            className={`${primaryButtonClass} justify-center sm:shrink-0`}
          >
            {working ? (
              <CircleNotchIcon aria-hidden className="animate-spin" />
            ) : (
              <ArrowRightIcon aria-hidden />
            )}
            {t(working ? "clone.creating" : "clone.action")}
          </button>
        </div>
        {error && (
          <p role="alert" className={`${alertErrorClass} mt-4`}>
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
