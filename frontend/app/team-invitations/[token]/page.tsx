"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarBlankIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  EnvelopeSimpleIcon,
  ShieldCheckIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { alertErrorClass, secondaryButtonClass } from "@/components/ui";
import { useAuth } from "@/features/auth/store";
import { formatLocalizedDate } from "@/features/locale/format";
import { useLocale } from "@/features/locale/store";
import { teamsApi } from "@/features/teams/api";
import type { TeamInvitationPreview } from "@/features/teams/types";

export default function TeamInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const { user, ready } = useAuth();
  const { locale, t } = useLocale();
  const [preview, setPreview] = useState<TeamInvitationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    teamsApi
      .previewInvitation(token)
      .then((result) => {
        if (!cancelled) setPreview(result);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : t("invitation.previewError"),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  const returnTo = `/team-invitations/${token}`;
  const recipientMatches =
    Boolean(user && preview) &&
    user!.email.trim().toLowerCase() === preview!.email.trim().toLowerCase();

  const acceptAccountLink = async () => {
    if (!recipientMatches || working) return;
    setWorking(true);
    setError("");
    try {
      const result = await teamsApi.acceptAccountLinkInvitation(token);
      router.push(`/tournaments/${result.tournamentSlug}`);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : t("invitation.acceptError"),
      );
      setWorking(false);
    }
  };

  if (loading || !ready) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <CircleNotchIcon className="animate-spin text-brand" size={30} />
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center px-4">
        <p role="alert" className={`${alertErrorClass} w-full`}>
          {error || t("invitation.previewError")}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 px-4 py-10 sm:px-6">
      <section className="mx-auto max-w-3xl rounded-2xl border border-line bg-surface-card p-6 shadow-[var(--shadow-elevated)] sm:p-8">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
            <EnvelopeSimpleIcon size={26} weight="duotone" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
              {t("invitation.eyebrow")}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-ink">
              {preview.tournament.name}
            </h1>
            <p className="mt-2 text-sm leading-6 text-ink-muted">
              {preview.tournament.description || t("invitation.description")}
            </p>
          </div>
        </div>

        <dl className="mt-6 grid gap-4 rounded-xl border border-line bg-surface-sub/45 p-4 sm:grid-cols-2">
          <div className="flex gap-2">
            <UsersThreeIcon className="mt-0.5 text-brand" />
            <div>
              <dt className="text-xs text-ink-faint">{t("invitation.game")}</dt>
              <dd className="mt-0.5 text-sm font-semibold text-ink">
                {preview.tournament.game.name}
              </dd>
            </div>
          </div>
          <div className="flex gap-2">
            <ShieldCheckIcon className="mt-0.5 text-brand" />
            <div>
              <dt className="text-xs text-ink-faint">
                {t("invitation.organizer")}
              </dt>
              <dd className="mt-0.5 text-sm font-semibold text-ink">
                {preview.tournament.organizer.displayName}
              </dd>
            </div>
          </div>
          <div className="flex gap-2">
            <CalendarBlankIcon className="mt-0.5 text-brand" />
            <div>
              <dt className="text-xs text-ink-faint">
                {t("invitation.expires")}
              </dt>
              <dd className="mt-0.5 text-sm font-semibold text-ink">
                {formatLocalizedDate(preview.expiresAt, locale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </dd>
            </div>
          </div>
          <div>
            <dt className="text-xs text-ink-faint">
              {t("invitation.recipient")}
            </dt>
            <dd className="mt-0.5 break-all text-sm font-semibold text-ink">
              {preview.email}
            </dd>
          </div>
        </dl>

        {error && (
          <p role="alert" className={`${alertErrorClass} mt-5`}>
            {error}
          </p>
        )}

        {!user ? (
          <div className="mt-6">
            <p className="text-sm text-ink-muted">
              {t("invitation.signInHint")}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
                className="inline-flex min-h-[var(--control-height)] items-center rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand"
              >
                {t("invitation.signIn")}
              </Link>
              <Link
                href={`/register?returnTo=${encodeURIComponent(returnTo)}&email=${encodeURIComponent(preview.email)}`}
                className={secondaryButtonClass}
              >
                {t("invitation.createAccount")}
              </Link>
            </div>
          </div>
        ) : !recipientMatches ? (
          <p role="alert" className={`${alertErrorClass} mt-6`}>
            {t("invitation.wrongAccount")}
          </p>
        ) : preview.purpose === "TEAM_REGISTRATION" ? (
          <div className="mt-6">
            <Link
              href={`/tournaments/${preview.tournament.slug}/register-team?invitation=${encodeURIComponent(token)}`}
              className="inline-flex min-h-[var(--control-height)] items-center rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand"
            >
              {t("invitation.registerTeam")}
            </Link>
          </div>
        ) : (
          <div className="mt-6">
            <p className="mb-4 flex items-center gap-2 text-sm text-ink-muted">
              <CheckCircleIcon className="text-approved" />
              {preview.team
                ? `${t("invitation.linkTeamPrefix")} ${preview.team.name}.`
                : t("invitation.linkAccountHint")}
            </p>
            <button
              type="button"
              onClick={acceptAccountLink}
              disabled={working}
              className="inline-flex min-h-[var(--control-height)] items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand disabled:opacity-50"
            >
              {working && <CircleNotchIcon className="animate-spin" />}
              {t("invitation.accept")}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
