"use client";

import { useState } from "react";
import { EnvelopeSimpleIcon, PaperPlaneTiltIcon } from "@phosphor-icons/react";
import { alertErrorClass } from "@/components/ui";
import { authApi } from "@/features/auth/api";
import { useCooldown } from "@/features/auth/hooks/useCooldown";
import { useLocale } from "@/features/locale/store";

export default function EmailVerificationNotice({
  email,
  className = "",
}: {
  email: string;
  className?: string;
}) {
  const { t } = useLocale();
  const { seconds, start } = useCooldown();
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const resend = async () => {
    if (sending || seconds > 0) return;
    setSending(true);
    setError("");
    setMessage("");
    try {
      const result = await authApi.resendVerification(email);
      setMessage(result.message || t("emailVerification.resendSuccess"));
      start(60);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : t("emailVerification.resendError"),
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <section
      role="status"
      className={`rounded-xl border border-brand/25 bg-surface-card p-5 shadow-[var(--shadow-elevated)] ${className}`}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
          <EnvelopeSimpleIcon size={23} weight="duotone" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-ink">{t("emailVerification.title")}</h2>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            {t("emailVerification.required")}
          </p>
          <p className="mt-1 truncate text-xs text-ink-faint">{email}</p>
          <button
            type="button"
            onClick={resend}
            disabled={sending || seconds > 0}
            className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-bold text-on-brand transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PaperPlaneTiltIcon size={17} weight="bold" aria-hidden />
            {sending
              ? t("emailVerification.sending")
              : seconds > 0
                ? `${t("emailVerification.resendIn")} ${seconds}s`
                : t("emailVerification.resend")}
          </button>
        </div>
      </div>
      {message && (
        <p role="status" className="mt-4 text-sm font-semibold text-approved">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className={`${alertErrorClass} mt-4`}>
          {error}
        </p>
      )}
    </section>
  );
}
