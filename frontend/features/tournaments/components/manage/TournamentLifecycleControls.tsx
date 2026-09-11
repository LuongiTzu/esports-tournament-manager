"use client";

import { useState } from "react";
import {
  CalendarBlankIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  EyeIcon,
  FlagIcon,
  LockKeyIcon,
  PlayIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import {
  alertErrorClass,
  inputClass,
  primaryButtonClass,
} from "@/components/ui";
import { tournamentsApi } from "@/features/tournaments/api";
import type {
  TournamentDetail,
  UpdateTournamentLifecycleRequest,
} from "@/features/tournaments/types";
import { formatLocalizedDate } from "@/features/locale/format";
import { useLocale } from "@/features/locale/store";

type Action = "publish" | "start" | "cancel" | "visibility" | "registration";
const controlClass =
  "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line-strong px-3 py-2 text-xs font-semibold text-ink transition hover:bg-surface-hover disabled:opacity-50";

export default function TournamentLifecycleControls({
  tournament,
  onRefresh,
}: {
  tournament: TournamentDetail;
  onRefresh: () => Promise<void>;
}) {
  const { locale, t } = useLocale();
  const [working, setWorking] = useState<Action | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [publishVisibility, setPublishVisibility] = useState<
    "PUBLIC" | "PRIVATE"
  >("PRIVATE");
  const [publishRegistrationOpen, setPublishRegistrationOpen] = useState(false);
  const isDraft = tournament.status === "DRAFT";
  const isRegistration = tournament.status === "REGISTRATION";
  const canCancel = ["DRAFT", "REGISTRATION", "ONGOING"].includes(
    tournament.status,
  );
  const registration = tournament.management?.registration;
  const canToggleRegistration =
    isRegistration &&
    Boolean(tournament.management) &&
    (tournament.registrationOpen ||
      tournament.management?.participants.allowed);
  const statusTone =
    tournament.status === "ONGOING"
      ? "bg-pending/10 text-pending"
      : tournament.status === "COMPLETED"
        ? "bg-approved/10 text-approved"
        : tournament.status === "CANCELLED"
          ? "bg-rejected/10 text-rejected"
          : "bg-brand/10 text-brand-hover";

  const mutate = async (
    data: UpdateTournamentLifecycleRequest,
    action: Action,
    message: string,
  ) => {
    if (working) return;
    setWorking(action);
    setError("");
    setNotice("");
    try {
      await tournamentsApi.updateLifecycle(tournament.id, data);
      await onRefresh();
      setNotice(message);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : t("lifecycle.updateError"),
      );
      await onRefresh().catch(() => {});
    } finally {
      setWorking(null);
    }
  };

  const start = () => {
    if (!isRegistration || !tournament.management?.start.allowed || working)
      return;
    if (!window.confirm(t("lifecycle.startConfirm"))) return;
    void mutate({ status: "ONGOING" }, "start", t("lifecycle.started"));
  };
  const cancel = () => {
    if (!canCancel || working || !window.confirm(t("lifecycle.cancelConfirm")))
      return;
    void mutate({ status: "CANCELLED" }, "cancel", t("lifecycle.cancelled"));
  };
  const toggleVisibility = () => {
    if (isDraft || working) return;
    const visibility =
      tournament.visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC";
    if (!window.confirm(t(`lifecycle.visibilityConfirm.${visibility}`))) return;
    void mutate({ visibility }, "visibility", t("lifecycle.visibilityUpdated"));
  };
  const toggleRegistration = () => {
    if (!canToggleRegistration || working) return;
    const registrationOpen = !tournament.registrationOpen;
    void mutate(
      { registrationOpen },
      "registration",
      t(registrationOpen ? "lifecycle.opened" : "lifecycle.closed"),
    );
  };
  const dateLabel = (value: string | null | undefined) =>
    value
      ? formatLocalizedDate(value, locale, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : t("common.unlimited");

  return (
    <section
      aria-labelledby="lifecycle-heading"
      className="overflow-hidden rounded-2xl border border-line bg-surface-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2
              id="lifecycle-heading"
              className="flex items-center gap-2 font-bold text-ink"
            >
              <FlagIcon size={19} className="text-brand-hover" />
              {t("lifecycle.stateTitle")}
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusTone}`}
            >
              <span aria-hidden className="size-1.5 rounded-full bg-current" />
              {t(`tournament.status.${tournament.status}`)}
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">
            {t(`lifecycle.summary.${tournament.status}`)}
          </p>
        </div>
        {isRegistration && (
          <button
            type="button"
            onClick={start}
            disabled={Boolean(working) || !tournament.management?.start.allowed}
            className={`${primaryButtonClass} w-full sm:w-auto`}
          >
            {working === "start" ? (
              <CircleNotchIcon className="animate-spin" />
            ) : (
              <PlayIcon weight="fill" />
            )}
            {t("lifecycle.start")}
          </button>
        )}
      </div>

      {isRegistration &&
        Boolean(tournament.management?.start.reasons.length) && (
          <div className="mx-4 mb-4 rounded-xl border border-pending/20 bg-pending/5 px-3 py-3 sm:mx-5">
            <p className="text-xs font-semibold text-pending">
              {t("lifecycle.beforeStart")}
            </p>
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              {tournament.management?.start.reasons.map((reason) => (
                <li
                  key={reason}
                  className="flex items-start gap-1.5 text-xs text-ink-muted"
                >
                  <WarningCircleIcon
                    size={14}
                    className="mt-0.5 shrink-0 text-pending"
                  />
                  {t(`manage.reason.${reason}`)}
                </li>
              ))}
            </ul>
          </div>
        )}

      {isDraft && (
        <form
          className="mx-4 mb-4 grid items-end gap-3 rounded-xl border border-brand/20 bg-brand/5 p-4 sm:mx-5 sm:grid-cols-[1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            if (!isDraft || working) return;
            void mutate(
              {
                status: "REGISTRATION",
                visibility: publishVisibility,
                registrationOpen: publishRegistrationOpen,
              },
              "publish",
              t("lifecycle.published"),
            );
          }}
        >
          <div>
            <label className="block text-xs font-medium text-ink-muted">
              {t("lifecycle.publishVisibility")}
              <select
                value={publishVisibility}
                onChange={(event) =>
                  setPublishVisibility(
                    event.target.value as "PUBLIC" | "PRIVATE",
                  )
                }
                disabled={Boolean(working)}
                className={`${inputClass} mt-1.5`}
              >
                <option value="PRIVATE">
                  {t("tournament.visibility.PRIVATE")}
                </option>
                <option value="PUBLIC">
                  {t("tournament.visibility.PUBLIC")}
                </option>
              </select>
            </label>
            <label className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
              <input
                type="checkbox"
                checked={publishRegistrationOpen}
                onChange={(event) =>
                  setPublishRegistrationOpen(event.target.checked)
                }
                disabled={Boolean(working)}
                className="accent-brand"
              />
              {t("lifecycle.publishRegistrationOpen")}
            </label>
          </div>
          <button
            type="submit"
            disabled={Boolean(working)}
            className={primaryButtonClass}
          >
            {working === "publish" && (
              <CircleNotchIcon className="animate-spin" />
            )}
            {t("lifecycle.publishDraft")}
          </button>
        </form>
      )}

      <div className="grid border-t border-line md:grid-cols-2">
        <div className="flex min-w-0 flex-col p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <CalendarBlankIcon size={18} className="text-brand-hover" />
                {t("lifecycle.registration")}
              </h3>
              <p
                className={`mt-2 text-xs font-medium ${registration?.allowed ? "text-approved" : "text-ink-muted"}`}
              >
                {t(
                  registration?.allowed
                    ? "lifecycle.acceptingTeams"
                    : "lifecycle.notAcceptingTeams",
                )}
              </p>
            </div>
            {canToggleRegistration && (
              <button
                type="button"
                onClick={toggleRegistration}
                disabled={Boolean(working)}
                className={controlClass}
              >
                {working === "registration" && (
                  <CircleNotchIcon className="animate-spin" />
                )}
                {t(
                  tournament.registrationOpen
                    ? "lifecycle.closeRegistration"
                    : "lifecycle.openRegistration",
                )}
              </button>
            )}
          </div>
          <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-ink-faint">
                {t("lifecycle.registrationStart")}
              </dt>
              <dd className="mt-1 leading-relaxed text-ink-muted">
                {dateLabel(tournament.registrationStartDate)}
              </dd>
            </div>
            <div>
              <dt className="text-ink-faint">
                {t("lifecycle.registrationDeadline")}
              </dt>
              <dd className="mt-1 leading-relaxed text-ink-muted">
                {dateLabel(tournament.registrationDeadline)}
              </dd>
            </div>
          </dl>
          {registration?.reason && (
            <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-ink-faint">
              <LockKeyIcon size={14} className="mt-0.5 shrink-0" />
              {t(`manage.reason.${registration.reason}`)}
            </p>
          )}
        </div>

        <div className="flex min-w-0 flex-col border-t border-line p-4 sm:p-5 md:border-t-0 md:border-l">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <EyeIcon size={18} className="text-brand-hover" />
                {t("lifecycle.visibility")}
              </h3>
              <p className="mt-2 text-xs font-medium text-ink-muted">
                {t(`tournament.visibility.${tournament.visibility}`)}
              </p>
            </div>
            {!isDraft && (
              <button
                type="button"
                onClick={toggleVisibility}
                disabled={Boolean(working)}
                className={controlClass}
              >
                {working === "visibility" && (
                  <CircleNotchIcon className="animate-spin" />
                )}
                {t(
                  tournament.visibility === "PUBLIC"
                    ? "lifecycle.makePrivate"
                    : "lifecycle.makePublic",
                )}
              </button>
            )}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-ink-muted">
            {t(
              tournament.visibility === "PUBLIC"
                ? "lifecycle.publicHint"
                : "lifecycle.privateHint",
            )}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-ink-faint">
            {t("lifecycle.visibilityRule")}
          </p>
        </div>
      </div>

      {(notice || error || canCancel) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            {notice && (
              <p
                role="status"
                className="flex items-start gap-2 text-xs text-approved"
              >
                <CheckCircleIcon className="shrink-0" size={16} />
                {notice}
              </p>
            )}
            {error && (
              <p role="alert" className={`${alertErrorClass} text-xs`}>
                {error}
              </p>
            )}
            {!notice && !error && canCancel && (
              <p className="text-xs text-ink-faint">
                {t("lifecycle.cancelHint")}
              </p>
            )}
          </div>
          {canCancel && (
            <button
              type="button"
              onClick={cancel}
              disabled={Boolean(working)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-rejected transition hover:bg-rejected/10 disabled:opacity-50"
            >
              {working === "cancel" && (
                <CircleNotchIcon className="animate-spin" />
              )}
              {t("lifecycle.cancel")}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
