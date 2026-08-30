"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CircleNotchIcon,
  EnvelopeSimpleIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import {
  alertErrorClass,
  inputClass,
  labelClass,
  secondaryButtonClass,
} from "@/components/ui";
import { formatLocalizedDate } from "@/features/locale/format";
import { useLocale, type TranslationKey } from "@/features/locale/store";
import { teamsApi } from "@/features/teams/api";
import type { TeamInvitation } from "@/features/teams/types";

export default function TeamInvitationManagement({
  tournamentSlug,
  refreshVersion,
}: {
  tournamentSlug: string;
  refreshVersion: number;
}) {
  const { locale, t } = useLocale();
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadInvitations = async () => {
    const result = await teamsApi.listInvitations(tournamentSlug);
    setInvitations(result);
  };

  useEffect(() => {
    let cancelled = false;
    teamsApi
      .listInvitations(tournamentSlug)
      .then((result) => {
        if (!cancelled) setInvitations(result);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : t("invitation.managementLoadError"),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tournamentSlug, refreshVersion, t]);

  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (working || !email.trim()) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await teamsApi.inviteTeam(tournamentSlug, email.trim());
      await loadInvitations();
      setEmail("");
      setNotice(t("invitation.sent"));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : t("invitation.sendError"),
      );
    } finally {
      setWorking(false);
    }
  };

  const revoke = async (invitation: TeamInvitation) => {
    if (working || invitation.status !== "PENDING") return;
    if (!window.confirm(t("invitation.revokeConfirm"))) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await teamsApi.revokeInvitation(invitation.id);
      await loadInvitations();
      setNotice(t("invitation.revoked"));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : t("invitation.revokeError"),
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <section className="mb-8 rounded-2xl border border-line bg-surface-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <EnvelopeSimpleIcon className="text-brand" size={22} />
            <h3 className="font-bold text-ink">
              {t("invitation.managementTitle")}
            </h3>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {t("invitation.managementHint")}
          </p>
        </div>
        <Link
          href={`/tournaments/${tournamentSlug}/register-team?mode=manual`}
          className={secondaryButtonClass}
        >
          <PlusIcon /> {t("invitation.addManualTeam")}
        </Link>
      </div>

      <form
        onSubmit={invite}
        className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <div className="min-w-0 flex-1">
          <label htmlFor="team-invitation-email" className={labelClass}>
            {t("invitation.captainEmail")}
          </label>
          <input
            id="team-invitation-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="captain@example.com"
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={working}
          className="inline-flex min-h-[var(--control-height)] items-center justify-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand disabled:opacity-50"
        >
          {working && <CircleNotchIcon className="animate-spin" />}
          {t("invitation.send")}
        </button>
      </form>

      {notice && <p className="mt-3 text-sm text-approved">{notice}</p>}
      {error && <p className={`${alertErrorClass} mt-3`}>{error}</p>}

      {loading ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-ink-muted">
          <CircleNotchIcon className="animate-spin" /> {t("common.loading")}
        </div>
      ) : invitations.length > 0 ? (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="pb-2 pr-4">{t("common.email")}</th>
                <th className="pb-2 pr-4">{t("invitation.purpose")}</th>
                <th className="pb-2 pr-4">{t("invitation.status")}</th>
                <th className="pb-2 pr-4">{t("invitation.expires")}</th>
                <th className="pb-2 text-right">{t("invitation.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {invitations.map((invitation) => (
                <tr key={invitation.id}>
                  <td className="py-3 pr-4">
                    <p className="font-medium text-ink">{invitation.email}</p>
                    {(invitation.team || invitation.member) && (
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {invitation.team?.name ?? invitation.member?.realName}
                      </p>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-ink-muted">
                    {t(
                      `invitation.purpose.${invitation.purpose}` as TranslationKey,
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <span className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-ink-muted">
                      {t(
                        `invitation.status.${invitation.status}` as TranslationKey,
                      )}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-ink-muted">
                    {formatLocalizedDate(invitation.expiresAt, locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="py-3 text-right">
                    {invitation.status === "PENDING" && (
                      <button
                        type="button"
                        onClick={() => revoke(invitation)}
                        disabled={working}
                        aria-label={t("invitation.revoke")}
                        className="inline-flex rounded-lg p-2 text-rejected hover:bg-rejected/10 disabled:opacity-50"
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-5 text-sm text-ink-faint">{t("invitation.empty")}</p>
      )}
    </section>
  );
}
