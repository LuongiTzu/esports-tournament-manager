"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { alertErrorClass, secondaryButtonClass } from "@/components/ui";
import { clearSession, useAuth } from "@/features/auth/store";
import { useLocale } from "@/features/locale/store";
import { teamsApi } from "@/features/teams/api";
import type { TeamDetail } from "@/features/teams/types";
import { ApiError } from "@/lib/api/client";
import TeamDetailLoading from "./TeamDetailLoading";
import TeamProfile from "./TeamProfile";

function TeamDetailContent({ teamId }: { teamId: string }) {
  const { t } = useLocale();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<
    { team: TeamDetail; error?: never } | { team?: never; error: Error } | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    teamsApi.findOne(teamId).then(
      (team) => {
        if (!cancelled) setResult({ team });
      },
      (error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) clearSession();
        setResult({ error: error instanceof Error ? error : new Error() });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [teamId, attempt]);

  if (!result) return <TeamDetailLoading />;
  if (result.team) return <TeamProfile team={result.team} />;

  const status =
    result.error instanceof ApiError ? result.error.status : undefined;
  const message =
    status === 404
      ? t("teamDetail.notFound")
      : status === 403
        ? t("teamDetail.forbidden")
        : status === 401
          ? t("teamDetail.unauthorized")
          : t("teamDetail.loadError");

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16">
      <h1 className="mb-5 text-2xl font-bold text-ink">
        {t("teamDetail.title")}
      </h1>
      <p role="alert" className={alertErrorClass}>
        {message}
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => {
            setResult(null);
            setAttempt((value) => value + 1);
          }}
        >
          {t("common.retry")}
        </button>
        <Link className={secondaryButtonClass} href="/tournaments">
          {t("teamDetail.browse")}
        </Link>
        {(status === 401 || status === 403 || status === 404) && (
          <Link
            className={secondaryButtonClass}
            href={`/login?returnTo=${encodeURIComponent(`/teams/${teamId}`)}`}
          >
            {t("auth.login.submit")}
          </Link>
        )}
      </div>
    </div>
  );
}

export default function TeamDetailPage({ teamId }: { teamId: string }) {
  const { user, ready } = useAuth();
  if (!ready) return <TeamDetailLoading />;
  // Discard the previous viewer's data immediately, including while the next request is pending.
  return (
    <TeamDetailContent
      key={`${teamId}:${user?.id ?? "guest"}:${user?.role ?? ""}`}
      teamId={teamId}
    />
  );
}
