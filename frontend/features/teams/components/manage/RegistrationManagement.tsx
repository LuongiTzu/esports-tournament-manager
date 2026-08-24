"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircleIcon,
  CircleNotchIcon,
  UsersThreeIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { alertErrorClass } from "@/components/ui";
import { teamsApi } from "@/features/teams/api";
import type {
  TeamDetail,
  TeamStatus,
  TeamWithMembers,
} from "@/features/teams/types";
import type { TournamentDetail } from "@/features/tournaments/types";
import TeamRegistrationCard from "./TeamRegistrationCard";
import TeamRegistrationDetail from "./TeamRegistrationDetail";
import { useLocale, type TranslationKey } from "@/features/locale/store";

const FILTERS: Array<"ALL" | TeamStatus> = ["ALL", "PENDING", "APPROVED", "REJECTED"];

export default function RegistrationManagement({
  tournament,
  onTournamentRefresh,
}: {
  tournament: TournamentDetail;
  onTournamentRefresh: () => Promise<void>;
}) {
  const { t } = useLocale();
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [filter, setFilter] = useState<"ALL" | TeamStatus>("ALL");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [detail, setDetail] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [working, setWorking] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [notice, setNotice] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const loadTeams = useCallback(async () => {
    const result = await teamsApi.findByTournament(tournament.slug, "ALL");
    setTeams(result);
    setSelectedTeamId((current) =>
      result.some((team) => team.id === current)
        ? current
        : (result.find((team) => team.status === "PENDING")?.id ??
          result[0]?.id ??
          ""),
    );
    return result;
  }, [tournament.slug]);

  useEffect(() => {
    let cancelled = false;
    teamsApi
      .findByTournament(tournament.slug, "ALL")
      .then((result) => {
        if (cancelled) return;
        setTeams(result);
        setSelectedTeamId(
          result.find((team) => team.status === "PENDING")?.id ??
            result[0]?.id ??
            "",
        );
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : t("registration.listLoadError"),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tournament.slug, t]);

  useEffect(() => {
    if (!selectedTeamId) {
      return;
    }
    let cancelled = false;
    const loadDetail = async () => {
      setDetailLoading(true);
      setDetailError("");
      setRejectionReason("");
      try {
        const result = await teamsApi.findOne(selectedTeamId);
        if (!cancelled) setDetail(result);
      } catch (reason) {
        if (!cancelled) {
          setDetail(null);
          setDetailError(
            reason instanceof Error
              ? reason.message
              : t("registration.detailLoadError"),
          );
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    };
    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedTeamId, t]);

  const counts = useMemo(
    () => ({
      ALL: teams.length,
      PENDING: teams.filter((team) => team.status === "PENDING").length,
      APPROVED: teams.filter((team) => team.status === "APPROVED").length,
      REJECTED: teams.filter((team) => team.status === "REJECTED").length,
    }),
    [teams],
  );
  const visibleTeams =
    filter === "ALL" ? teams : teams.filter((team) => team.status === filter);

  const changeFilter = (nextFilter: "ALL" | TeamStatus) => {
    setFilter(nextFilter);
    const firstVisible =
      nextFilter === "ALL"
        ? teams[0]
        : teams.find((team) => team.status === nextFilter);
    setSelectedTeamId(firstVisible?.id ?? "");
    if (!firstVisible) {
      setDetail(null);
      setDetailError("");
    }
  };

  const mutateStatus = async (status: "APPROVED" | "REJECTED") => {
    if (!detail || detail.status !== "PENDING" || working) return;
    const trimmedReason = rejectionReason.trim();
    if (status === "REJECTED" && trimmedReason.length < 5) {
      setDetailError(t("registration.rejectReasonMin"));
      return;
    }
    const confirmed = window.confirm(
      status === "APPROVED"
        ? `${t("registration.approveConfirm")} “${detail.name}”`
        : `${t("registration.rejectConfirm")} “${detail.name}”`,
    );
    if (!confirmed) return;

    setWorking(status === "APPROVED" ? "approve" : "reject");
    setDetailError("");
    setNotice("");
    try {
      await teamsApi.updateStatus(
        detail.id,
        status === "APPROVED"
          ? { status: "APPROVED" }
          : { status: "REJECTED", rejectReason: trimmedReason },
      );
      const [updatedDetail] = await Promise.all([
        teamsApi.findOne(detail.id),
        loadTeams(),
        onTournamentRefresh(),
      ]);
      setDetail(updatedDetail);
      setFilter(status);
      setRejectionReason("");
      setNotice(
        status === "APPROVED"
          ? `${t("registration.approvedPrefix")} ${detail.name}.`
          : `${t("registration.rejectedPrefix")} ${detail.name}.`,
      );
    } catch (reason) {
      setDetailError(
        reason instanceof Error
          ? reason.message
          : t("registration.updateError"),
      );
    } finally {
      setWorking(null);
    }
  };

  return (
    <section aria-labelledby="registration-management-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
            {t("registration.eyebrow")}
          </p>
          <h2
            id="registration-management-heading"
            className="mt-1 text-xl font-bold text-ink sm:text-2xl"
          >
            {t("registration.title")}
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            {t("registration.approved")}: {counts.APPROVED}
            {tournament.maxTeams ? ` / ${tournament.maxTeams}` : ""} {t("registration.teamsUnit")}
          </p>
        </div>
        <span className="rounded-full border border-line bg-surface-card px-3 py-1.5 text-xs text-ink-muted">
          {counts.PENDING} {t("registration.pendingCount")}
        </span>
      </div>

      <div className="mt-5 flex max-w-full gap-2 overflow-x-auto pb-2">
        {FILTERS.map((item) => {
          const active = filter === item;
          return (
            <button
              key={item}
              type="button"
              onClick={() => changeFilter(item)}
              className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition ${
                active
                  ? "border-brand bg-brand/12 text-brand"
                  : "border-line bg-surface-card text-ink-muted hover:border-line-strong"
              }`}
            >
              {item === "ALL" ? t("registration.filter.all") : t(`team.status.${item}` as TranslationKey)}{" "}
              <span className="ml-1 font-mono text-xs">
                {counts[item]}
              </span>
            </button>
          );
        })}
      </div>

      {notice && (
        <p
          role="status"
          className="mt-4 flex items-center gap-2 text-sm text-approved"
        >
          <CheckCircleIcon weight="fill" /> {notice}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className={`${alertErrorClass} mt-4 flex items-start gap-2`}
        >
          <WarningCircleIcon className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      {loading ? (
        <div className="mt-5 grid min-h-52 place-items-center rounded-xl border border-line">
          <CircleNotchIcon className="animate-spin text-brand" size={28} />
        </div>
      ) : teams.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-line px-6 py-14 text-center">
          <UsersThreeIcon size={30} className="mx-auto text-ink-faint" />
          <p className="mt-3 font-medium text-ink">{t("registration.empty")}</p>
          <p className="mt-1 text-sm text-ink-muted">
            {t("registration.emptyHint")}
          </p>
        </div>
      ) : (
        <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-[minmax(18rem,0.75fr)_minmax(0,1.35fr)] lg:items-start">
          <div className="space-y-3 lg:max-h-[52rem] lg:overflow-y-auto lg:pr-1">
            {visibleTeams.length ? (
              visibleTeams.map((team) => (
                <TeamRegistrationCard
                  key={team.id}
                  team={team}
                  selected={team.id === selectedTeamId}
                  onSelect={() => setSelectedTeamId(team.id)}
                />
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-line px-5 py-12 text-center text-sm text-ink-muted">
                {t("registration.filterEmpty")}
              </div>
            )}
          </div>

          <div className="min-w-0">
            {detailLoading ? (
              <div className="grid min-h-72 place-items-center rounded-2xl border border-line bg-surface-card">
                <CircleNotchIcon
                  className="animate-spin text-brand"
                  size={26}
                />
              </div>
            ) : detailError && !detail ? (
              <p role="alert" className={alertErrorClass}>
                {detailError}
              </p>
            ) : detail ? (
              <>
                {detailError && (
                  <p role="alert" className={`${alertErrorClass} mb-3`}>
                    {detailError}
                  </p>
                )}
                <TeamRegistrationDetail
                  team={detail}
                  positionMode={tournament.game.positionMode}
                  minTeamSize={tournament.minTeamSize}
                  maxTeamSize={tournament.maxTeamSize}
                  rejectionReason={rejectionReason}
                  onRejectionReasonChange={setRejectionReason}
                  onApprove={() => mutateStatus("APPROVED")}
                  onReject={() => mutateStatus("REJECTED")}
                  working={working}
                />
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-line px-5 py-14 text-center text-sm text-ink-muted">
                {t("registration.selectTeam")}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
