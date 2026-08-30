"use client";

import { useState } from "react";
import {
  CalendarBlankIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  EyeIcon,
  LockKeyIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { alertErrorClass, secondaryButtonClass } from "@/components/ui";
import { tournamentsApi } from "@/features/tournaments/api";
import type { TournamentDetail } from "@/features/tournaments/types";
import { formatLocalizedDate } from "@/features/locale/format";
import { useLocale, type TranslationKey } from "@/features/locale/store";

export default function TournamentLifecycleControls({
  tournament,
  onRefresh,
}: {
  tournament: TournamentDetail;
  onRefresh: () => Promise<void>;
}) {
  const { locale, t } = useLocale();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [publishVisibility, setPublishVisibility] = useState<
    "PUBLIC" | "PRIVATE"
  >("PRIVATE");
  const [publishRegistrationOpen, setPublishRegistrationOpen] = useState(false);
  const canPublishDraft = tournament.status === "DRAFT";
  const registrationCanBeToggled = tournament.status === "REGISTRATION";

  const publishDraft = async () => {
    if (working || !canPublishDraft) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await tournamentsApi.updateLifecycle(tournament.id, {
        status: "REGISTRATION",
        visibility: publishVisibility,
        registrationOpen: publishRegistrationOpen,
      });
      await onRefresh();
      setNotice(t("lifecycle.published"));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : t("lifecycle.publishError"),
      );
    } finally {
      setWorking(false);
    }
  };

  const toggleVisibility = async () => {
    if (working || tournament.status === "DRAFT") return;
    const nextVisibility =
      tournament.visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC";
    if (
      !window.confirm(
        t(`lifecycle.visibilityConfirm.${nextVisibility}` as TranslationKey),
      )
    ) {
      return;
    }
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await tournamentsApi.updateLifecycle(tournament.id, {
        visibility: nextVisibility,
      });
      await onRefresh();
      setNotice(t("lifecycle.visibilityUpdated"));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : t("lifecycle.visibilityUpdateError"),
      );
    } finally {
      setWorking(false);
    }
  };

  const toggleRegistration = async () => {
    if (working || !registrationCanBeToggled) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const nextOpen = !tournament.registrationOpen;
      await tournamentsApi.updateLifecycle(tournament.id, {
        registrationOpen: nextOpen,
      });
      await onRefresh();
      setNotice(nextOpen ? t("lifecycle.opened") : t("lifecycle.closed"));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : t("lifecycle.updateError"),
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <section
      aria-labelledby="lifecycle-heading"
      className="rounded-2xl border border-line bg-surface-card p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
            {t("lifecycle.eyebrow")}
          </p>
          <h2
            id="lifecycle-heading"
            className="mt-1 text-xl font-bold text-ink"
          >
            {t("lifecycle.title")}
          </h2>
        </div>
        <span className="rounded-full border border-line bg-surface-sub px-3 py-1.5 text-xs font-semibold text-ink-muted">
          {t(`tournament.status.${tournament.status}` as TranslationKey)}
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface-sub/45 p-4">
          <div className="flex items-center gap-2">
            <LockKeyIcon className="text-brand" />
            <h3 className="font-semibold text-ink">
              {t("lifecycle.transitionTitle")}
            </h3>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            {canPublishDraft
              ? t("lifecycle.draftDescription")
              : t("lifecycle.transitionUnavailable")}
          </p>
          {canPublishDraft && (
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-medium text-ink-muted">
                {t("lifecycle.publishVisibility")}
                <select
                  value={publishVisibility}
                  onChange={(event) =>
                    setPublishVisibility(
                      event.target.value as "PUBLIC" | "PRIVATE",
                    )
                  }
                  className="mt-1 block w-full rounded-lg border border-line bg-surface-card px-3 py-2 text-sm text-ink"
                >
                  <option value="PRIVATE">
                    {t("tournament.visibility.PRIVATE")}
                  </option>
                  <option value="PUBLIC">
                    {t("tournament.visibility.PUBLIC")}
                  </option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-ink-muted">
                <input
                  type="checkbox"
                  checked={publishRegistrationOpen}
                  onChange={(event) =>
                    setPublishRegistrationOpen(event.target.checked)
                  }
                  className="accent-[var(--color-brand)]"
                />
                {t("lifecycle.publishRegistrationOpen")}
              </label>
              <button
                type="button"
                onClick={publishDraft}
                disabled={working}
                className={secondaryButtonClass}
              >
                {working && <CircleNotchIcon className="animate-spin" />}
                {t("lifecycle.publishDraft")}
              </button>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-line bg-surface-sub/45 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <EyeIcon className="text-brand" />
                <h3 className="font-semibold text-ink">
                  {t("lifecycle.visibility")}
                </h3>
              </div>
              <p className="mt-2 text-sm font-medium text-ink">
                {t(
                  `tournament.visibility.${tournament.visibility}` as TranslationKey,
                )}
              </p>
            </div>
            {tournament.status !== "DRAFT" && (
              <button
                type="button"
                onClick={toggleVisibility}
                disabled={working}
                className={secondaryButtonClass}
              >
                {working && <CircleNotchIcon className="animate-spin" />}
                {tournament.visibility === "PUBLIC"
                  ? t("lifecycle.makePrivate")
                  : t("lifecycle.makePublic")}
              </button>
            )}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink-faint">
            {t("lifecycle.visibilityRule")}
          </p>
        </div>

        <div className="rounded-xl border border-line bg-surface-sub/45 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <CalendarBlankIcon className="text-brand" />
                <h3 className="font-semibold text-ink">
                  {t("lifecycle.registration")}
                </h3>
              </div>
              <p className="mt-2 text-sm font-medium text-ink">
                {tournament.registrationOpen
                  ? t("lifecycle.enabled")
                  : t("lifecycle.disabled")}
              </p>
            </div>
            {registrationCanBeToggled && (
              <button
                type="button"
                onClick={toggleRegistration}
                disabled={working}
                className={secondaryButtonClass}
              >
                {working && <CircleNotchIcon className="animate-spin" />}
                {tournament.registrationOpen
                  ? t("lifecycle.closeRegistration")
                  : t("lifecycle.openRegistration")}
              </button>
            )}
          </div>
          <dl className="mt-4 grid gap-2 text-xs text-ink-muted sm:grid-cols-2">
            <div>
              <dt className="text-ink-faint">
                {t("lifecycle.registrationStart")}
              </dt>
              <dd className="mt-0.5">
                {tournament.registrationStartDate
                  ? formatLocalizedDate(
                      tournament.registrationStartDate,
                      locale,
                      { dateStyle: "medium", timeStyle: "short" },
                    )
                  : t("common.unlimited")}
              </dd>
            </div>
            <div>
              <dt className="text-ink-faint">
                {t("lifecycle.registrationDeadline")}
              </dt>
              <dd className="mt-0.5">
                {tournament.registrationDeadline
                  ? formatLocalizedDate(
                      tournament.registrationDeadline,
                      locale,
                      { dateStyle: "medium", timeStyle: "short" },
                    )
                  : t("common.unlimited")}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-ink-faint">
            {t("lifecycle.registrationRule")}
          </p>
          {!registrationCanBeToggled && (
            <p className="mt-3 flex items-start gap-2 text-xs text-pending">
              <WarningCircleIcon className="mt-0.5 shrink-0" />{" "}
              {t("lifecycle.currentStatusClosed")}
            </p>
          )}
        </div>
      </div>

      {notice && (
        <p
          className="mt-4 flex items-center gap-2 text-sm text-approved"
          role="status"
        >
          <CheckCircleIcon weight="fill" /> {notice}
        </p>
      )}
      {error && <p className={`${alertErrorClass} mt-4`}>{error}</p>}
    </section>
  );
}
