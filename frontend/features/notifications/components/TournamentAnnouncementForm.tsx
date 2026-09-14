"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  alertErrorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { useLocale } from "@/features/locale/store";
import { teamsApi } from "@/features/teams/api";
import type { TeamWithMembers } from "@/features/teams/types";
import { notificationsApi } from "@/features/notifications/api";
import type { TournamentNotificationRequest } from "@/features/notifications/types";
import { ApiError } from "@/lib/api/client";

export default function TournamentAnnouncementForm({ slug }: { slug: string }) {
  const { t } = useLocale();
  const [scope, setScope] =
    useState<TournamentNotificationRequest["scope"]>("WHOLE_TOURNAMENT");
  const [teamId, setTeamId] = useState("");
  const [teams, setTeams] = useState<TeamWithMembers[] | null>(null);
  const [teamError, setTeamError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [content, setContent] = useState("");
  const [working, setWorking] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState("");
  const [recipientCount, setRecipientCount] = useState<number | null>(null);

  useEffect(() => {
    if (scope !== "TEAM") return;
    let cancelled = false;
    teamsApi.findByTournament(slug, "ALL").then(
      (value) => {
        if (!cancelled) {
          setTeams(value);
          setTeamError(false);
        }
      },
      () => {
        if (!cancelled) setTeamError(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [scope, slug, attempt]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;
    setError("");
    setRecipientCount(null);
    if (!content.trim()) {
      setError(t("announcement.required"));
      return;
    }
    if (
      scope === "TEAM" &&
      (!teams?.some((team) => team.id === teamId) || teamError)
    ) {
      setError(t("announcement.selectTeam"));
      return;
    }
    const data: TournamentNotificationRequest =
      scope === "TEAM"
        ? { type: "SYSTEM", content: content.trim(), scope, teamId }
        : { type: "SYSTEM", content: content.trim(), scope };
    inFlight.current = true;
    setWorking(true);
    try {
      const result = await notificationsApi.sendToTournament(slug, data);
      setRecipientCount(result.recipientCount);
      if (result.recipientCount > 0) setContent("");
    } catch (reason) {
      setError(
        reason instanceof ApiError && reason.status < 500
          ? reason.message
          : t("announcement.uncertain"),
      );
    } finally {
      inFlight.current = false;
      setWorking(false);
    }
  };

  return (
    <section
      aria-labelledby="announcement-heading"
      className="rounded-2xl border border-line bg-surface-card p-5 sm:p-6"
    >
      <h2 id="announcement-heading" className="text-lg font-bold">
        {t("announcement.title")}
      </h2>
      <p className="mt-2 text-sm text-ink-muted">{t("announcement.hint")}</p>
      <form onSubmit={submit} className="mt-5">
        <fieldset disabled={working} className="space-y-4">
          <div>
            <label htmlFor="announcement-scope" className={labelClass}>
              {t("announcement.scope")}
            </label>
            <select
              id="announcement-scope"
              className={`${inputClass} mt-1`}
              value={scope}
              onChange={(event) => {
                setScope(
                  event.target.value as TournamentNotificationRequest["scope"],
                );
                setError("");
                setRecipientCount(null);
                setTeams(null);
                setTeamError(false);
              }}
            >
              <option value="WHOLE_TOURNAMENT">
                {t("announcement.whole")}
              </option>
              <option value="TEAM">{t("announcement.team")}</option>
            </select>
          </div>
          {scope === "TEAM" && (
            <div>
              <label htmlFor="announcement-team" className={labelClass}>
                {t("announcement.team")}
              </label>
              {teamError ? (
                <div role="alert" className="mt-2 text-sm text-rejected">
                  {t("announcement.teamError")}
                  <button
                    type="button"
                    className={`${secondaryButtonClass} ml-2`}
                    onClick={() => {
                      setTeamError(false);
                      setTeams(null);
                      setAttempt((value) => value + 1);
                    }}
                  >
                    {t("common.retry")}
                  </button>
                </div>
              ) : teams === null ? (
                <p role="status" className="mt-2 text-sm text-ink-muted">
                  {t("common.loading")}
                </p>
              ) : teams.length === 0 ? (
                <p className="mt-2 text-sm text-ink-muted">
                  {t("announcement.noTeams")}
                </p>
              ) : (
                <select
                  id="announcement-team"
                  required
                  value={teamId}
                  onChange={(event) => {
                    setTeamId(event.target.value);
                    setRecipientCount(null);
                  }}
                  className={`${inputClass} mt-1`}
                >
                  <option value="">{t("announcement.selectTeam")}</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
          <div>
            <label htmlFor="announcement-content" className={labelClass}>
              {t("announcement.content")}
            </label>
            <textarea
              id="announcement-content"
              required
              rows={5}
              value={content}
              onChange={(event) => {
                setContent(event.target.value);
                setError("");
                setRecipientCount(null);
              }}
              className={`${inputClass} mt-1`}
            />
          </div>
        </fieldset>
        {error && (
          <p role="alert" className={`${alertErrorClass} mt-4`}>
            {error}
          </p>
        )}
        {recipientCount !== null && (
          <p role="status" className="mt-4 text-sm text-ink">
            {recipientCount === 0
              ? t("announcement.noRecipients")
              : t("announcement.sent").replace(
                  "{count}",
                  String(recipientCount),
                )}
          </p>
        )}
        <button
          type="submit"
          className={`${primaryButtonClass} mt-5`}
          disabled={
            working ||
            !content.trim() ||
            (scope === "TEAM" &&
              (teamError || !teams?.some((team) => team.id === teamId)))
          }
        >
          {t(working ? "announcement.sending" : "announcement.send")}
        </button>
      </form>
    </section>
  );
}
