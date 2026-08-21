"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "@phosphor-icons/react";
import { useAuth } from "@/features/auth/store";
import { accentVars } from "@/features/games/game-accent";
import RegistrationManagement from "@/features/teams/components/manage/RegistrationManagement";
import { tournamentsApi } from "@/features/tournaments/api";
import CompetitionManager from "@/features/tournaments/components/manage/CompetitionManager";
import TournamentLifecycleControls from "@/features/tournaments/components/manage/TournamentLifecycleControls";
import type { TournamentDetail } from "@/features/tournaments/types";
import { alertErrorClass } from "@/components/ui";

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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.push("/login");
      return;
    }
    tournamentsApi
      .findBySlug(slug)
      .then((t) => {
        setTournament(t);
        if (t.organizer?.id !== user.id) {
          setLoadError("Bạn không phải ban tổ chức của giải đấu này");
        }
      })
      .catch((err) =>
        setLoadError(
          err instanceof Error ? err.message : "Không tải được dữ liệu",
        ),
      )
      .finally(() => setLoading(false));
  }, [slug, router, ready, user]);

  const refreshTournament = async () => {
    setTournament(await tournamentsApi.findBySlug(slug));
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
        <TournamentLifecycleControls
          tournament={tournament}
          onRefresh={refreshTournament}
        />
      </div>

      <div className="mt-6">
        <CompetitionManager
          tournament={tournament}
          onTournamentRefresh={refreshTournament}
        />
      </div>

      <div className="mt-12 border-t border-line pt-10">
        <RegistrationManagement
          tournament={tournament}
          onTournamentRefresh={refreshTournament}
        />
      </div>
    </div>
  );
}
