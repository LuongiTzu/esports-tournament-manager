"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CaretRightIcon, FlagIcon, XIcon } from "@phosphor-icons/react";
import {
  alertErrorClass,
  secondaryButtonClass,
} from "@/components/ui";
import { useLocale, type TranslationKey } from "@/features/locale/store";
import { reportsApi } from "@/features/reports/api";
import {
  TOURNAMENT_REPORT_REASONS,
  type TournamentReportReason,
} from "@/features/reports/types";
import { ApiError } from "@/lib/api/client";
import Link from "next/link";
import { useAuth } from "@/features/auth/store";
import EmailVerificationNotice from "@/features/auth/components/EmailVerificationNotice";
import { isEmailNotVerifiedError } from "@/features/auth/email-verification";

const DESCRIPTION_MIN_LENGTH = 5;
const DESCRIPTION_MAX_LENGTH = 2000;

const reasonTranslationKeys: Record<
  TournamentReportReason,
  TranslationKey
> = {
  MINOR_SAFETY: "report.reason.MINOR_SAFETY",
  HARASSMENT_OR_HATE: "report.reason.HARASSMENT_OR_HATE",
  VIOLENCE_OR_SELF_HARM: "report.reason.VIOLENCE_OR_SELF_HARM",
  GAMBLING: "report.reason.GAMBLING",
  RESTRICTED_GOODS: "report.reason.RESTRICTED_GOODS",
  ADULT_CONTENT: "report.reason.ADULT_CONTENT",
  SCAM: "report.reason.SCAM",
  INTELLECTUAL_PROPERTY: "report.reason.INTELLECTUAL_PROPERTY",
  SPAM_OR_MALICIOUS_LINKS: "report.reason.SPAM_OR_MALICIOUS_LINKS",
  INAPPROPRIATE_CONTENT: "report.reason.INAPPROPRIATE_CONTENT",
  OTHER: "report.reason.OTHER",
};

export default function TournamentReportAction({
  slug,
  tournamentName,
}: {
  slug: string;
  tournamentName: string;
}) {
  const { t } = useLocale();
  const { user, ready } = useAuth();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<TournamentReportReason | "">("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const trimmedDescription = description.trim();
  const descriptionIsInvalid =
    (trimmedDescription.length > 0 &&
      trimmedDescription.length < DESCRIPTION_MIN_LENGTH) ||
    trimmedDescription.length > DESCRIPTION_MAX_LENGTH;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!submitted) return;
    const timeout = window.setTimeout(() => setSubmitted(false), 5000);
    return () => window.clearTimeout(timeout);
  }, [submitted]);

  const resetForm = () => {
    setReason("");
    setDescription("");
    setError("");
  };

  const closeDialog = () => {
    if (submitting) return;
    resetForm();
    setOpen(false);
  };

  const getErrorMessage = (requestError: unknown) => {
    if (isEmailNotVerifiedError(requestError)) {
      return t("emailVerification.required");
    }
    if (!(requestError instanceof ApiError)) return t("report.error.generic");
    if (requestError.status === 409) return t("report.error.duplicate");
    if (requestError.status === 429) return t("report.error.rateLimit");
    if (requestError.status === 404) return t("report.error.notFound");
    if (requestError.status === 400) return t("report.error.validation");
    return t("report.error.generic");
  };

  const submitReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    if (!reason) {
      setError(t("report.error.reasonRequired"));
      return;
    }
    if (
      trimmedDescription.length > 0 &&
      trimmedDescription.length < DESCRIPTION_MIN_LENGTH
    ) {
      setError(t("report.error.descriptionTooShort"));
      return;
    }
    if (trimmedDescription.length > DESCRIPTION_MAX_LENGTH) {
      setError(t("report.error.descriptionTooLong"));
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await reportsApi.createTournamentReport(slug, {
        reason,
        ...(trimmedDescription ? { description: trimmedDescription } : {}),
      });
      resetForm();
      setOpen(false);
      setSubmitted(true);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  if (ready && !user) {
    return (
      <Link
        href="/login"
        className="inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-md bg-brand-secondary px-6 py-3 text-[0.8125rem] font-black uppercase tracking-wide text-on-brand transition hover:brightness-110"
      >
        <FlagIcon size={19} weight="fill" aria-hidden />
        {t("emailVerification.signIn")}
      </Link>
    );
  }

  if (user?.emailVerifiedAt === null) {
    return <EmailVerificationNotice email={user.email} />;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSubmitted(false);
          setOpen(true);
        }}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-md bg-brand-secondary px-6 py-3 text-[0.8125rem] font-black uppercase tracking-wide text-on-brand transition hover:brightness-110 active:translate-y-px"
        aria-haspopup="dialog"
      >
        <FlagIcon size={19} weight="fill" aria-hidden />
        {t("report.action")}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="tournament-report-title"
        aria-describedby="tournament-report-description"
        onCancel={(event) => {
          event.preventDefault();
          closeDialog();
        }}
        onClose={() => {
          if (open && !submitting) closeDialog();
        }}
        className="m-auto max-h-[min(90vh,48rem)] w-[min(94vw,38rem)] overflow-y-auto rounded-xl border border-line bg-surface-elevated p-0 text-left text-ink shadow-[var(--shadow-elevated)] backdrop:bg-overlay"
      >
        <form onSubmit={submitReport} noValidate>
          <div className="relative flex min-h-16 items-center justify-center border-b border-line px-16 py-4">
            <h2
              id="tournament-report-title"
              className="text-xl font-black tracking-tight"
            >
              {t("report.title")}
            </h2>
            <button
              type="button"
              aria-label={t("common.close")}
              disabled={submitting}
              onClick={closeDialog}
              className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-surface-sub text-ink-muted transition hover:bg-surface-hover hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              <XIcon size={22} weight="bold" aria-hidden />
            </button>
          </div>

          <div className="px-5 pb-6 pt-5 sm:px-6">
            <div>
              <h3 className="text-left text-base font-bold text-ink">
                {t("report.reasonLabel")}
              </h3>
              <p
                id="tournament-report-description"
                className="mt-1 text-left text-sm leading-6 text-ink-muted"
              >
                <span className="font-semibold text-ink">{tournamentName}</span>
                {" — "}
                {t("report.dialogDescription")}
              </p>
            </div>

            <div
              role="radiogroup"
              aria-label={t("report.reasonLabel")}
              className="mt-5 overflow-hidden rounded-lg border border-line bg-surface-card"
            >
              {TOURNAMENT_REPORT_REASONS.map((option, index) => {
                const selected = reason === option;
                return (
                  <label
                    key={option}
                    className={`flex min-h-14 cursor-pointer items-center gap-3 px-4 py-3 text-sm font-semibold transition-colors focus-within:relative focus-within:z-10 focus-within:shadow-[inset_0_0_0_2px_var(--color-brand-secondary)] ${
                      index > 0 ? "border-t border-line" : ""
                    } ${
                      selected
                        ? "bg-brand-secondary/12 text-ink"
                        : "bg-surface-card text-ink-muted hover:bg-surface-hover hover:text-ink"
                    }`}
                  >
                    <input
                      type="radio"
                      name="tournament-report-reason"
                      value={option}
                      checked={selected}
                      disabled={submitting}
                      onChange={() => {
                        setReason(option);
                        setError("");
                      }}
                      className="sr-only"
                    />
                    <span className="min-w-0 flex-1 text-left">
                      {t(reasonTranslationKeys[option])}
                    </span>
                    <CaretRightIcon
                      size={20}
                      weight="bold"
                      aria-hidden
                      className={selected ? "text-brand-secondary" : "text-ink-faint"}
                    />
                  </label>
                );
              })}
            </div>

            <label htmlFor="tournament-report-description-field" className="mt-5 block text-left text-sm font-semibold text-ink">
              {t("report.descriptionLabel")} ({t("common.optional")})
            </label>
            <textarea
              id="tournament-report-description-field"
              rows={4}
              minLength={DESCRIPTION_MIN_LENGTH}
              value={description}
              disabled={submitting}
              aria-describedby="tournament-report-description-hint"
              aria-invalid={descriptionIsInvalid}
              onChange={(event) => {
                setDescription(event.target.value);
                setError("");
              }}
              placeholder={t("report.descriptionPlaceholder")}
              className="mt-2 w-full resize-y rounded-lg border border-line bg-input px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-brand-secondary focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-brand-secondary)_18%,transparent)] disabled:cursor-not-allowed disabled:opacity-55"
            />
            <span
              id="tournament-report-description-hint"
              className="mt-1 flex justify-between gap-3 text-xs text-ink-faint"
            >
              <span>{t("report.descriptionHint")}</span>
              <span>{description.length}/{DESCRIPTION_MAX_LENGTH}</span>
            </span>

            {error && (
              <p role="alert" className={`${alertErrorClass} mt-4`}>
                {error}
              </p>
            )}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={submitting}
                onClick={closeDialog}
                className={secondaryButtonClass}
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-[var(--control-height)] items-center justify-center gap-2 rounded-lg bg-brand-secondary px-6 py-3 text-sm font-black uppercase tracking-wide text-on-brand shadow-[0_12px_30px_-14px_var(--color-brand-secondary)] transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-50"
              >
                <FlagIcon aria-hidden />
                {submitting ? t("report.submitting") : t("report.submit")}
              </button>
            </div>
          </div>
        </form>
      </dialog>

      {submitted && (
        <div
          role="status"
          className="fixed bottom-5 left-4 right-4 z-50 rounded-xl border border-approved/30 bg-surface-elevated px-4 py-3 text-sm shadow-[var(--shadow-elevated)] sm:left-auto sm:right-5 sm:max-w-sm"
        >
          <p className="font-bold text-approved">{t("report.successTitle")}</p>
          <p className="mt-1 text-ink-muted">{t("report.successDescription")}</p>
        </div>
      )}
    </>
  );
}
