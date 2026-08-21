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

const FILTERS: Array<{ value: "ALL" | TeamStatus; label: string }> = [
  { value: "ALL", label: "Tất cả" },
  { value: "PENDING", label: "Chờ duyệt" },
  { value: "APPROVED", label: "Đã duyệt" },
  { value: "REJECTED", label: "Từ chối" },
];

export default function RegistrationManagement({
  tournament,
  onTournamentRefresh,
}: {
  tournament: TournamentDetail;
  onTournamentRefresh: () => Promise<void>;
}) {
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
              : "Không tải được danh sách đăng ký.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tournament.slug]);

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
              : "Không tải được chi tiết đăng ký.",
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
  }, [selectedTeamId]);

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
      setDetailError("Lý do từ chối phải có ít nhất 5 ký tự.");
      return;
    }
    const confirmed = window.confirm(
      status === "APPROVED"
        ? `Duyệt đội “${detail.name}” tham gia giải?`
        : `Từ chối đăng ký của đội “${detail.name}”?`,
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
          ? `Đã duyệt đội ${detail.name}.`
          : `Đã từ chối đội ${detail.name}.`,
      );
    } catch (reason) {
      setDetailError(
        reason instanceof Error
          ? reason.message
          : "Không thể cập nhật đăng ký đội.",
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
            Registration review
          </p>
          <h2
            id="registration-management-heading"
            className="mt-1 text-xl font-bold text-ink sm:text-2xl"
          >
            Quản lý đăng ký đội
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            Đã duyệt: {counts.APPROVED}
            {tournament.maxTeams ? ` / ${tournament.maxTeams} đội` : " đội"}
          </p>
        </div>
        <span className="rounded-full border border-line bg-surface-card px-3 py-1.5 text-xs text-ink-muted">
          {counts.PENDING} đăng ký chờ xử lý
        </span>
      </div>

      <div className="mt-5 flex max-w-full gap-2 overflow-x-auto pb-2">
        {FILTERS.map((item) => {
          const active = filter === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => changeFilter(item.value)}
              className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition ${
                active
                  ? "border-brand bg-brand/12 text-brand"
                  : "border-line bg-surface-card text-ink-muted hover:border-line-strong"
              }`}
            >
              {item.label}{" "}
              <span className="ml-1 font-mono text-xs">
                {counts[item.value]}
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
          <p className="mt-3 font-medium text-ink">Chưa có đội đăng ký</p>
          <p className="mt-1 text-sm text-ink-muted">
            Các đăng ký mới sẽ xuất hiện tại đây.
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
                Không có đội ở trạng thái này.
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
                Chọn một đội để xem chi tiết đăng ký.
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
