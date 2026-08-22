"use client";

import { useEffect, useMemo, useState } from "react";
import { TrophyIcon } from "@phosphor-icons/react";
import { adminApi } from "@/features/admin/api";
import type {
  AdminTournament,
  AdminTournamentModerationStatus,
  AdminTournamentsQuery,
} from "@/features/admin/types";
import { alertErrorClass, secondaryButtonClass } from "@/components/ui";
import TournamentAdminFilters from "@/features/admin/components/TournamentAdminFilters";
import AdminTournamentList from "@/features/admin/components/AdminTournamentList";
import AdminTournamentDetail from "@/features/admin/components/AdminTournamentDetail";
import TournamentModerationDialog from "@/features/admin/components/TournamentModerationDialog";
import { formatAdminNumber } from "@/features/admin/format";
import { useLocale } from "@/features/locale/store";

function queryKey(query: AdminTournamentsQuery) {
  return query.moderationStatus ?? "ALL";
}

export default function AdminTournamentsPage() {
  const { locale } = useLocale();
  const [query, setQuery] = useState<AdminTournamentsQuery>({});
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    tournaments: AdminTournament[];
  } | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [workingAction, setWorkingAction] = useState<"VERIFY" | "MODERATE" | "">("");
  const [hideDialogOpen, setHideDialogOpen] = useState(false);
  const currentKey = queryKey(query);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .listTournaments(query)
      .then((tournaments) => {
        if (cancelled) return;
        setResult({ key: currentKey, tournaments });
        setSelectedId((current) =>
          tournaments.some((item) => item.id === current)
            ? current
            : (tournaments[0]?.id ?? ""),
        );
        setError("");
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "Không tải được danh sách giải đấu.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [currentKey, query, reloadKey]);

  const loading = result?.key !== currentKey && !error;
  const tournaments = result?.key === currentKey ? result.tournaments : null;
  const selectedTournament = useMemo(
    () => tournaments?.find((item) => item.id === selectedId) ?? null,
    [selectedId, tournaments],
  );

  const refetch = async () => {
    const refreshed = await adminApi.listTournaments(query);
    setResult({ key: currentKey, tournaments: refreshed });
    setSelectedId((current) =>
      refreshed.some((item) => item.id === current)
        ? current
        : (refreshed[0]?.id ?? ""),
    );
  };

  const changeVerification = async (isVerified: boolean) => {
    if (!selectedTournament || workingAction) return;
    const confirmed = window.confirm(
      isVerified
        ? `Gắn nhãn xác minh cho “${selectedTournament.name}”?`
        : `Gỡ nhãn xác minh khỏi “${selectedTournament.name}”?`,
    );
    if (!confirmed) return;
    setWorkingAction("VERIFY");
    setError("");
    setNotice("");
    try {
      await adminApi.setTournamentVerification(selectedTournament.id, isVerified);
      await refetch();
      setNotice(isVerified ? "Đã xác minh giải đấu." : "Đã gỡ nhãn xác minh.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể cập nhật xác minh.");
    } finally {
      setWorkingAction("");
    }
  };

  const hideTournament = async (reason: string) => {
    if (!selectedTournament || workingAction) return;
    setWorkingAction("MODERATE");
    setError("");
    setNotice("");
    try {
      await adminApi.setTournamentModeration(
        selectedTournament.id,
        "HIDDEN_BY_ADMIN",
        reason,
      );
      await refetch();
      setHideDialogOpen(false);
      setNotice("Đã ẩn giải khỏi nền tảng và gửi cảnh báo tới Organizer.");
    } catch (reasonValue) {
      setError(
        reasonValue instanceof Error
          ? reasonValue.message
          : "Không thể ẩn giải đấu.",
      );
    } finally {
      setWorkingAction("");
    }
  };

  const unhideTournament = async () => {
    if (!selectedTournament || workingAction) return;
    if (!window.confirm(`Bỏ ẩn “${selectedTournament.name}” trên nền tảng?`)) return;
    setWorkingAction("MODERATE");
    setError("");
    setNotice("");
    try {
      await adminApi.setTournamentModeration(selectedTournament.id, "ACTIVE");
      await refetch();
      setNotice("Đã bỏ ẩn giải trên nền tảng.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể bỏ ẩn giải đấu.");
    } finally {
      setWorkingAction("");
    }
  };

  return (
    <div>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
          Platform tournament administration
        </p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">
          Quản trị giải đấu
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">
          Kiểm tra giải trên toàn nền tảng, quản lý nhãn xác minh và trạng thái ẩn kiểm duyệt. Các thao tác vận hành thi đấu vẫn thuộc khu vực Organizer.
        </p>
      </header>

      <div className="mt-5">
        <TournamentAdminFilters
          moderationStatus={query.moderationStatus}
          onChange={(moderationStatus?: AdminTournamentModerationStatus) => {
            setQuery({ moderationStatus });
            setNotice("");
            setError("");
          }}
        />
      </div>

      {notice && (
        <p role="status" className="mt-4 rounded-xl border border-approved/30 bg-approved/10 px-4 py-3 text-sm text-approved">
          {notice}
        </p>
      )}
      {error && (
        <div className="mt-4">
          <p role="alert" className={alertErrorClass}>{error}</p>
          {!tournaments && (
            <button
              type="button"
              onClick={() => {
                setError("");
                setReloadKey((value) => value + 1);
              }}
              className={`${secondaryButtonClass} mt-3`}
            >
              Thử lại
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="h-96 animate-pulse rounded-2xl border border-line bg-surface-card" />
          <div className="h-96 animate-pulse rounded-2xl border border-line bg-surface-card" />
        </div>
      ) : tournaments ? (
        tournaments.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-line px-6 py-16 text-center">
            <TrophyIcon size={36} className="mx-auto text-ink-faint" />
            <p className="mt-3 font-semibold text-ink">Không có giải đấu phù hợp</p>
            <p className="mt-1 text-sm text-ink-muted">
              Hãy thay đổi bộ lọc kiểm duyệt hiện tại.
            </p>
          </div>
        ) : (
          <>
            <p className="mt-4 text-sm text-ink-faint">
              Backend trả về {formatAdminNumber(tournaments.length, locale)} giải đấu, ưu tiên số báo cáo rồi ngày tạo.
            </p>
            <div className="mt-3 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
              <AdminTournamentList
                tournaments={tournaments}
                selectedId={selectedId}
                onSelect={(id) => {
                  setSelectedId(id);
                  setNotice("");
                  setError("");
                }}
              />
              {selectedTournament && (
                <AdminTournamentDetail
                  tournament={selectedTournament}
                  workingAction={workingAction}
                  onVerificationChange={changeVerification}
                  onHide={() => setHideDialogOpen(true)}
                  onUnhide={unhideTournament}
                />
              )}
            </div>
          </>
        )
      ) : null}

      {selectedTournament && (
        <TournamentModerationDialog
          tournamentName={selectedTournament.name}
          open={hideDialogOpen}
          working={workingAction === "MODERATE"}
          onClose={() => setHideDialogOpen(false)}
          onConfirm={hideTournament}
        />
      )}
    </div>
  );
}
