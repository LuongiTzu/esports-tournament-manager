"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  GearSixIcon,
  SealCheckIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { useAuth } from "@/features/auth/store";
import { accentVars } from "@/features/games/game-accent";
import { teamsApi } from "@/features/teams/api";
import StatusBadge from "@/features/teams/components/StatusBadge";
import type { TeamWithMembers } from "@/features/teams/types";
import { tournamentsApi } from "@/features/tournaments/api";
import { getTournamentBannerUrl } from "@/features/tournaments/banner";
import { ROUND_FORMAT_LABELS } from "@/features/tournaments/round-formats";
import type { TournamentDetail } from "@/features/tournaments/types";
import { alertErrorClass, secondaryButtonClass } from "@/components/ui";

function formatDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString("vi-VN") : "Chưa xác định";
}

export default function TournamentDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { user } = useAuth();
  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [myTeam, setMyTeam] = useState<TeamWithMembers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    tournamentsApi
      .findBySlug(slug)
      .then((t) => {
        if (!cancelled) setTournament(t);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Không tải được giải đấu");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!tournament || !user) return;
    let cancelled = false;
    teamsApi
      .findMine()
      .then((teams) => {
        if (!cancelled)
          setMyTeam(teams.find((team) => team.tournament.slug === slug) ?? null);
      })
      .catch(() => {
        if (!cancelled) setMyTeam(null);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, tournament, user]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <div aria-hidden className="space-y-4">
          <div className="h-40 rounded-xl bg-surface-card" />
          <div className="h-32 rounded-xl bg-surface-card" />
        </div>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 text-center">
        <p className={alertErrorClass}>{error || "Không tìm thấy giải đấu"}</p>
        <Link href="/" className="mt-4 inline-block text-sm text-brand hover:underline">
          Về danh sách giải
        </Link>
      </div>
    );
  }

  const isOrganizer = user && tournament.organizer?.id === user.id;
  const ownTeam = user ? myTeam : null;
  const canRegister = user && tournament.registrationOpen && !ownTeam;

  return (
    <div
      style={accentVars(tournament.game?.name)}
      className="mx-auto w-full max-w-4xl flex-1 px-4 py-10"
    >
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition hover:text-ink"
      >
        <ArrowLeftIcon size={16} />
        Danh sách giải
      </Link>

      <header className="mt-4 overflow-hidden rounded-xl border border-line border-t-2 border-t-accent bg-surface-card">
        <div
          aria-hidden
          className="h-48 bg-cover bg-center sm:h-60"
          style={{
            backgroundImage: `url(${JSON.stringify(getTournamentBannerUrl(tournament.bannerUrl))})`,
          }}
        />

        <div className="flex flex-wrap items-start justify-between gap-4 p-6 pb-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              {tournament.game && (
                <span className="rounded-full bg-accent/12 px-2.5 py-1 text-xs font-medium text-accent">
                  {tournament.game.name}
                </span>
              )}
              {tournament.isVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-approved/12 px-2.5 py-1 text-xs font-medium text-approved">
                  <SealCheckIcon size={13} weight="fill" />
                  Đã xác minh
                </span>
              )}
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              {tournament.name}
            </h1>
            <p className="mt-1.5 text-sm text-ink-muted">
              Tổ chức bởi{" "}
              <span className="font-medium text-ink">
                {tournament.organizer?.displayName}
              </span>
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {isOrganizer && (
              <Link
                href={`/tournaments/${slug}/manage`}
                className={secondaryButtonClass}
              >
                <GearSixIcon size={16} />
                Quản lý đội
              </Link>
            )}
            {canRegister && (
              <Link
                href={`/tournaments/${slug}/register-team`}
                className="inline-flex items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent transition hover:opacity-90 active:translate-y-px"
              >
                Đăng ký đội
              </Link>
            )}
          </div>
        </div>

        {tournament.description && (
          <p className="mx-6 mt-5 max-w-2xl text-ink-muted">{tournament.description}</p>
        )}

        <dl className="mx-6 mt-6 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-line pb-6 pt-5 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-ink-faint">Đăng ký</dt>
            <dd className="mt-1 font-medium text-ink">
              {tournament.registrationOpen ? "Đang mở" : "Đã đóng"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-faint">Số đội</dt>
            <dd className="mt-1 font-medium text-ink">
              {tournament._count?.teams ?? 0}
              {tournament.maxTeams ? ` / ${tournament.maxTeams}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-faint">Bắt đầu</dt>
            <dd className="mt-1 font-medium text-ink">
              {formatDate(tournament.startDate)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-faint">Chế độ</dt>
            <dd className="mt-1 font-medium text-ink">
              {tournament.visibility === "PUBLIC" ? "Công khai" : "Riêng tư"}
            </dd>
          </div>
        </dl>
      </header>

      {ownTeam && (
        <section className="mt-6 rounded-xl border border-line bg-surface-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-ink">Đội của bạn</h2>
              <p className="mt-1 text-sm text-ink-muted">
                {ownTeam.name} • {ownTeam._count?.members ?? 0} thành viên
              </p>
            </div>
            <StatusBadge status={ownTeam.status} />
          </div>
          {ownTeam.status === "PENDING" && (
            <p className="mt-4 text-sm text-ink-muted">
              Ban tổ chức đang xem xét đăng ký của bạn.
            </p>
          )}
          {ownTeam.status === "REJECTED" && (
            <p className="mt-4 text-sm text-ink-muted">
              Đăng ký của bạn không được chấp nhận. Liên hệ ban tổ chức nếu cần
              biết thêm chi tiết.
            </p>
          )}
        </section>
      )}

      {tournament.rules && (
        <section className="mt-6 rounded-xl border border-line bg-surface-card p-6">
          <h2 className="font-semibold text-ink">Thể lệ</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">
            {tournament.rules}
          </p>
        </section>
      )}

      {tournament.rounds && tournament.rounds.length > 0 && (
        <section className="mt-6 rounded-xl border border-line bg-surface-card p-6">
          <h2 className="font-semibold text-ink">Các vòng đấu</h2>
          <ol className="mt-4 divide-y divide-line">
            {tournament.rounds.map((r, i) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-sub font-mono text-xs text-ink-muted">
                    {i + 1}
                  </span>
                  <span className="truncate font-medium text-ink">{r.name}</span>
                </span>
                <span className="shrink-0 text-sm text-ink-muted">
                  {ROUND_FORMAT_LABELS[r.format] || r.format}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="mt-6 rounded-xl border border-line bg-surface-card p-6">
        <h2 className="font-semibold text-ink">Đội đã được duyệt</h2>

        {tournament.teams.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-line px-4 py-10 text-center">
            <UsersThreeIcon
              size={28}
              className="mx-auto text-ink-faint"
              weight="duotone"
            />
            <p className="mt-3 text-sm text-ink-muted">
              Chưa có đội nào được duyệt.
            </p>
            {!user && (
              <p className="mt-1 text-sm text-ink-faint">
                <Link href="/login" className="text-brand hover:underline">
                  Đăng nhập
                </Link>{" "}
                để đăng ký đội tham gia.
              </p>
            )}
          </div>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {tournament.teams.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-sub px-4 py-3"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">
                    {t.name}
                  </span>
                  <span className="block text-xs text-ink-faint">
                    {t.captain?.displayName} • {t._count?.members ?? 0} thành viên
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
