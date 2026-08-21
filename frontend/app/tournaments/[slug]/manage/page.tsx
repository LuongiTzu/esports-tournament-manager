"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, CheckIcon, XIcon } from "@phosphor-icons/react";
import ResolvedImage from "@/components/ResolvedImage";
import { useAuth } from "@/features/auth/store";
import { accentVars } from "@/features/games/game-accent";
import { teamsApi } from "@/features/teams/api";
import StatusBadge from "@/features/teams/components/StatusBadge";
import type { TeamStatus, TeamWithMembers } from "@/features/teams/types";
import { tournamentsApi } from "@/features/tournaments/api";
import CompetitionManager from "@/features/tournaments/components/manage/CompetitionManager";
import type { TournamentDetail } from "@/features/tournaments/types";
import { alertErrorClass, secondaryButtonClass } from "@/components/ui";

const FILTERS: Array<{ value: "ALL" | TeamStatus; label: string }> = [
  { value: "ALL", label: "Tất cả" },
  { value: "PENDING", label: "Chờ duyệt" },
  { value: "APPROVED", label: "Đã duyệt" },
  { value: "REJECTED", label: "Từ chối" },
];

const TOURNAMENT_STATUS_LABELS: Record<TournamentDetail["status"], string> = {
  DRAFT: "Bản nháp",
  REGISTRATION: "Đang đăng ký",
  ONGOING: "Đang thi đấu",
  COMPLETED: "Đã hoàn tất",
  CANCELLED: "Đã hủy",
};

export default function ManagePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const { user, ready } = useAuth();

  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [filter, setFilter] = useState<"ALL" | TeamStatus>("ALL");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  /** Lỗi của từng thao tác duyệt/từ chối — không ghi đè cả trang, giữ nguyên danh sách */
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [busyTeamId, setBusyTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.push("/login");
      return;
    }
    tournamentsApi
      .findBySlug(slug)
      .then(async (t) => {
        setTournament(t);
        if (t.organizer?.id !== user.id) {
          setLoadError("Bạn không phải ban tổ chức của giải đấu này");
          return;
        }
        setTeams(await teamsApi.findByTournament(slug, "ALL"));
      })
      .catch((err) =>
        setLoadError(
          err instanceof Error ? err.message : "Không tải được dữ liệu",
        ),
      )
      .finally(() => setLoading(false));
  }, [slug, router, ready, user]);

  const handleStatus = async (
    team: TeamWithMembers,
    status: "APPROVED" | "REJECTED",
  ) => {
    if (!tournament || busyTeamId) return;
    let statusUpdate:
      { status: "APPROVED" } | { status: "REJECTED"; rejectReason: string };
    if (status === "REJECTED") {
      const input = window.prompt(`Nhập lý do từ chối đội "${team.name}":`);
      if (input === null) return;
      const rejectReason = input.trim();
      if (rejectReason.length < 5) {
        setActionErrors((prev) => ({
          ...prev,
          [team.id]: "Lý do từ chối phải có ít nhất 5 ký tự",
        }));
        return;
      }
      statusUpdate = { status, rejectReason };
    } else {
      statusUpdate = { status };
    }

    setBusyTeamId(team.id);
    setActionErrors((prev) => {
      const next = { ...prev };
      delete next[team.id];
      return next;
    });

    try {
      const updated = await teamsApi.updateStatus(team.id, statusUpdate);
      setTeams((prev) =>
        prev.map((t) =>
          t.id === team.id ? { ...t, status: updated.status } : t,
        ),
      );
    } catch (err) {
      setActionErrors((prev) => ({
        ...prev,
        [team.id]: err instanceof Error ? err.message : "Cập nhật thất bại",
      }));
    } finally {
      setBusyTeamId(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <div aria-hidden className="space-y-3">
          <div className="h-9 w-1/2 rounded bg-surface-card" />
          <div className="h-24 rounded-xl bg-surface-card" />
          <div className="h-24 rounded-xl bg-surface-card" />
        </div>
      </div>
    );
  }

  if (loadError || !tournament) {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 text-center">
        <p className={alertErrorClass}>
          {loadError || "Không tìm thấy giải đấu"}
        </p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm text-brand hover:underline"
        >
          Về danh sách giải
        </Link>
      </div>
    );
  }

  const counts = {
    ALL: teams.length,
    PENDING: teams.filter((t) => t.status === "PENDING").length,
    APPROVED: teams.filter((t) => t.status === "APPROVED").length,
    REJECTED: teams.filter((t) => t.status === "REJECTED").length,
  };
  const visible =
    filter === "ALL" ? teams : teams.filter((t) => t.status === filter);

  return (
    <div
      style={accentVars(tournament.game?.name)}
      className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10"
    >
      <Link
        href={`/tournaments/${slug}`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition hover:text-ink"
      >
        <ArrowLeftIcon size={16} />
        {tournament.name}
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
            Organizer workspace
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Quản lý {tournament.name}
          </h1>
        </div>
        <span className="rounded-full border border-line bg-surface-card px-3 py-1.5 text-xs font-medium text-ink-muted">
          {TOURNAMENT_STATUS_LABELS[tournament.status]}
        </span>
      </div>

      <div className="mt-8">
        <CompetitionManager
          tournament={tournament}
          onTournamentRefresh={async () => {
            setTournament(await tournamentsApi.findBySlug(slug));
          }}
        />
      </div>

      <h2 className="mt-12 border-t border-line pt-10 text-xl font-bold tracking-tight text-ink sm:text-2xl">
        Duyệt đội đăng ký
      </h2>
      <p className="mt-2 text-sm text-ink-muted">
        {counts.PENDING > 0
          ? `${counts.PENDING} đội đang chờ bạn xử lý.`
          : "Không còn đội nào chờ duyệt."}
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                active
                  ? "border-brand bg-brand/12 text-brand"
                  : "border-line text-ink-muted hover:border-line-strong hover:text-ink"
              }`}
            >
              {f.label}
              <span className="ml-1.5 font-mono text-xs opacity-70">
                {counts[f.value]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 space-y-3">
        {visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line px-6 py-14 text-center">
            <p className="font-medium text-ink">Không có đội nào</p>
            <p className="mt-2 text-sm text-ink-muted">
              {filter === "ALL"
                ? "Chưa có đội nào đăng ký giải đấu này."
                : "Không có đội nào ở trạng thái này."}
            </p>
          </div>
        ) : (
          visible.map((team) => {
            const busy = busyTeamId === team.id;
            return (
              <article
                key={team.id}
                className="rounded-xl border border-line bg-surface-card p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-brand/10 font-bold text-brand">
                      <ResolvedImage
                        src={team.logoUrl}
                        alt={`Logo ${team.name}`}
                        className="size-full object-cover object-center"
                        fallback={team.name.charAt(0).toUpperCase()}
                      />
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold text-ink">
                        {team.name}
                      </h2>
                      <p className="mt-1 text-sm text-ink-muted">
                        Đội trưởng: {team.captain?.displayName} •{" "}
                        {team._count?.members ?? 0} thành viên
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={team.status} />
                </div>

                {team.members && team.members.length > 0 && (
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {team.members.map((m) => (
                      <li
                        key={m.id}
                        className="rounded-md bg-surface-sub px-2.5 py-1 text-xs text-ink-muted"
                      >
                        {m.realName}
                        <span className="ml-1.5 text-ink-faint">{m.ign}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {actionErrors[team.id] && (
                  <p role="alert" className="mt-4 text-xs text-rejected">
                    {actionErrors[team.id]}
                  </p>
                )}

                {team.status === "PENDING" && (
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => handleStatus(team, "APPROVED")}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-approved px-4 py-2 text-sm font-semibold text-surface transition hover:opacity-90 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CheckIcon size={15} weight="bold" />
                      {busy ? "Đang xử lý..." : "Duyệt"}
                    </button>
                    <button
                      onClick={() => handleStatus(team, "REJECTED")}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rejected/40 bg-rejected/10 px-4 py-2 text-sm font-semibold text-rejected transition hover:bg-rejected/20 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <XIcon size={15} weight="bold" />
                      Từ chối
                    </button>
                  </div>
                )}

                {team.status === "REJECTED" && (
                  <div className="mt-4">
                    <button
                      onClick={() => handleStatus(team, "APPROVED")}
                      disabled={busy}
                      className={`${secondaryButtonClass} px-3 py-1.5 text-xs`}
                    >
                      {busy ? "Đang xử lý..." : "Duyệt lại"}
                    </button>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
