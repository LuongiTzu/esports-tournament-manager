"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TrophyIcon } from "@phosphor-icons/react";
import { adminApi } from "@/features/admin/api";
import type {
  AdminTournament,
  AdminTournamentsQuery,
} from "@/features/admin/types";
import { alertErrorClass, secondaryButtonClass } from "@/components/ui";
import TournamentAdminFilters from "@/features/admin/components/TournamentAdminFilters";
import AdminTournamentList from "@/features/admin/components/AdminTournamentList";
import AdminTournamentDetail from "@/features/admin/components/AdminTournamentDetail";
import type { AdminTournamentWorkingAction } from "@/features/admin/components/AdminTournamentDetail";
import TournamentModerationDialog from "@/features/admin/components/TournamentModerationDialog";
import TournamentAdminOverrideDialog from "@/features/admin/components/TournamentAdminOverrideDialog";
import { formatAdminNumber } from "@/features/admin/format";
import { useLocale } from "@/features/locale/store";
import { selectAvailableItemId } from "@/features/admin/selection";
import { useAuth } from "@/features/auth/store";

function queryKey(query: AdminTournamentsQuery) {
  return JSON.stringify(query);
}

export default function AdminTournamentsPage() {
  const { locale, t } = useLocale();
  const { user } = useAuth();
  const [query, setQuery] = useState<AdminTournamentsQuery>({});
  const [searchInput, setSearchInput] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    tournaments: AdminTournament[];
  } | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [workingAction, setWorkingAction] =
    useState<AdminTournamentWorkingAction>("");
  const [hideDialogOpen, setHideDialogOpen] = useState(false);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const currentKey = queryKey(query);
  const currentKeyRef = useRef(currentKey);
  useEffect(() => {
    currentKeyRef.current = currentKey;
  }, [currentKey]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const search = searchInput.trim() || undefined;
      setQuery((current) =>
        current.search === search ? current : { ...current, search },
      );
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .listTournaments(query)
      .then((tournaments) => {
        if (cancelled) return;
        setResult({ key: currentKey, tournaments });
        setSelectedId((current) => selectAvailableItemId(tournaments, current));
        setError("");
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(
          reason instanceof Error
            ? reason.message
            : t("admin.tournaments.loadError"),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [currentKey, query, reloadKey, t]);

  const loading = result?.key !== currentKey && !error;
  const tournaments = result?.key === currentKey ? result.tournaments : null;
  const selectedTournament = useMemo(
    () => tournaments?.find((item) => item.id === selectedId) ?? null,
    [selectedId, tournaments],
  );

  const refetch = async () => {
    const requestedKey = currentKey;
    const refreshed = await adminApi.listTournaments(query);
    if (currentKeyRef.current !== requestedKey) return;
    setResult({ key: currentKey, tournaments: refreshed });
    setSelectedId((current) => selectAvailableItemId(refreshed, current));
  };

  const changeVerification = async (isVerified: boolean) => {
    if (!selectedTournament || workingAction) return;
    const confirmed = window.confirm(
      isVerified
        ? `${t("admin.tournaments.verifyConfirm")} “${selectedTournament.name}”?`
        : `${t("admin.tournaments.unverifyConfirm")} “${selectedTournament.name}”?`,
    );
    if (!confirmed) return;
    setWorkingAction("VERIFY");
    setError("");
    setNotice("");
    try {
      await adminApi.setTournamentVerification(
        selectedTournament.id,
        isVerified,
      );
      await refetch();
      setNotice(
        isVerified
          ? t("admin.tournaments.verifiedNotice")
          : t("admin.tournaments.unverifiedNotice"),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : t("admin.tournaments.verificationError"),
      );
    } finally {
      setWorkingAction("");
    }
  };

  const changeOfficial = async (isOfficial: boolean) => {
    if (!selectedTournament || workingAction) return;
    const confirmed = window.confirm(
      isOfficial
        ? `${t("admin.tournaments.officialConfirm")} “${selectedTournament.name}”?`
        : `${t("admin.tournaments.removeOfficialConfirm")} “${selectedTournament.name}”?`,
    );
    if (!confirmed) return;
    setWorkingAction("OFFICIAL");
    setError("");
    setNotice("");
    try {
      await adminApi.setTournamentOfficial(selectedTournament.id, isOfficial);
      await refetch();
      setNotice(
        isOfficial
          ? t("admin.tournaments.officialNotice")
          : t("admin.tournaments.removeOfficialNotice"),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : t("admin.tournaments.officialError"),
      );
    } finally {
      setWorkingAction("");
    }
  };

  const startOverride = async (reason: string) => {
    if (!selectedTournament || workingAction) return;
    setWorkingAction("OVERRIDE");
    setError("");
    setNotice("");
    try {
      await adminApi.startTournamentOverride(selectedTournament.id, reason);
      await refetch();
      setOverrideDialogOpen(false);
      setNotice(t("admin.tournaments.overrideStartedNotice"));
    } catch (reasonValue) {
      setError(
        reasonValue instanceof Error
          ? reasonValue.message
          : t("admin.tournaments.overrideError"),
      );
    } finally {
      setWorkingAction("");
    }
  };

  const endOverride = async () => {
    if (!selectedTournament || workingAction) return;
    if (!window.confirm(t("admin.tournaments.endOverrideConfirm"))) return;
    setWorkingAction("OVERRIDE");
    setError("");
    setNotice("");
    try {
      await adminApi.endTournamentOverride(selectedTournament.id);
      await refetch();
      setNotice(t("admin.tournaments.overrideEndedNotice"));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : t("admin.tournaments.overrideError"),
      );
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
      setNotice(t("admin.tournaments.hiddenNotice"));
    } catch (reasonValue) {
      setError(
        reasonValue instanceof Error
          ? reasonValue.message
          : t("admin.tournaments.hideError"),
      );
    } finally {
      setWorkingAction("");
    }
  };

  const unhideTournament = async () => {
    if (!selectedTournament || workingAction) return;
    if (
      !window.confirm(
        `${t("admin.tournaments.unhideConfirm")} “${selectedTournament.name}”?`,
      )
    )
      return;
    setWorkingAction("MODERATE");
    setError("");
    setNotice("");
    try {
      await adminApi.setTournamentModeration(selectedTournament.id, "ACTIVE");
      await refetch();
      setNotice(t("admin.tournaments.unhiddenNotice"));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : t("admin.tournaments.unhideError"),
      );
    } finally {
      setWorkingAction("");
    }
  };

  return (
    <div>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
          {t("admin.tournaments.title")}
        </p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">
          {t("admin.tournaments.title")}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">
          {t("admin.tournaments.description")}
        </p>
      </header>

      <div className="mt-5">
        <TournamentAdminFilters
          query={query}
          searchInput={searchInput}
          onSearchInputChange={(value) => {
            setSearchInput(value);
            setNotice("");
            setError("");
          }}
          onChange={(nextQuery) => {
            setQuery(nextQuery);
            setNotice("");
            setError("");
          }}
          onClear={() => {
            setSearchInput("");
            setQuery({});
            setNotice("");
            setError("");
          }}
        />
      </div>

      {notice && (
        <p
          role="status"
          className="mt-4 rounded-xl border border-approved/30 bg-approved/10 px-4 py-3 text-sm text-approved"
        >
          {notice}
        </p>
      )}
      {error && (
        <div className="mt-4">
          <p role="alert" className={alertErrorClass}>
            {error}
          </p>
          {!tournaments && (
            <button
              type="button"
              onClick={() => {
                setError("");
                setReloadKey((value) => value + 1);
              }}
              className={`${secondaryButtonClass} mt-3`}
            >
              {t("common.retry")}
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
            <p className="mt-3 font-semibold text-ink">
              {t("admin.tournaments.empty")}
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              {t("admin.tournaments.emptyHint")}
            </p>
          </div>
        ) : (
          <>
            <p className="mt-4 text-sm text-ink-faint">
              {t("admin.tournaments.backendReturned")}{" "}
              {formatAdminNumber(tournaments.length, locale)}{" "}
              {t("admin.tournaments.orderHint")}
            </p>
            <div className="mt-3 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
              <AdminTournamentList
                tournaments={tournaments}
                selectedId={selectedId}
                onSelect={(id) => {
                  setSelectedId(id);
                  setOverrideDialogOpen(false);
                  setNotice("");
                  setError("");
                }}
              />
              {selectedTournament && (
                <AdminTournamentDetail
                  tournament={selectedTournament}
                  workingAction={workingAction}
                  onVerificationChange={changeVerification}
                  onOfficialChange={changeOfficial}
                  onHide={() => setHideDialogOpen(true)}
                  onUnhide={unhideTournament}
                  currentAdminId={user?.id ?? ""}
                  onStartOverride={() => setOverrideDialogOpen(true)}
                  onEndOverride={endOverride}
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
      {selectedTournament && (
        <TournamentAdminOverrideDialog
          tournamentName={selectedTournament.name}
          open={overrideDialogOpen}
          working={workingAction === "OVERRIDE"}
          onClose={() => setOverrideDialogOpen(false)}
          onConfirm={startOverride}
        />
      )}
    </div>
  );
}
