"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CaretLeftIcon, CaretRightIcon, UsersThreeIcon } from "@phosphor-icons/react";
import { adminApi } from "@/features/admin/api";
import type {
  AdminUserRole,
  AdminUsersQuery,
  AdminUsersResponse,
} from "@/features/admin/types";
import { useAuth } from "@/features/auth/store";
import { alertErrorClass, secondaryButtonClass } from "@/components/ui";
import UserFilters from "@/features/admin/components/UserFilters";
import AdminUserList from "@/features/admin/components/AdminUserList";
import AdminUserDetail from "@/features/admin/components/AdminUserDetail";
import { formatAdminNumber } from "@/features/admin/format";
import { useLocale } from "@/features/locale/store";
import { selectAvailableItemId } from "@/features/admin/selection";

const DEFAULT_QUERY: AdminUsersQuery = { page: 1, limit: 10 };

function queryKey(query: AdminUsersQuery) {
  return JSON.stringify(query);
}

export default function AdminUsersPage() {
  const { user: currentAdmin } = useAuth();
  const { locale, t } = useLocale();
  const [query, setQuery] = useState<AdminUsersQuery>(DEFAULT_QUERY);
  const [searchDraft, setSearchDraft] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    response: AdminUsersResponse;
  } | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [workingUserId, setWorkingUserId] = useState("");

  const currentQueryKey = queryKey(query);
  const currentQueryKeyRef = useRef(currentQueryKey);
  useEffect(() => {
    currentQueryKeyRef.current = currentQueryKey;
  }, [currentQueryKey]);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .listUsers(query)
      .then((response) => {
        if (cancelled) return;
        const lastPage = Math.max(response.pagination.totalPages, 1);
        if (query.page > lastPage) {
          setQuery((current) => ({ ...current, page: lastPage }));
          return;
        }
        setResult({ key: currentQueryKey, response });
        setSelectedUserId((current) =>
          selectAvailableItemId(response.data, current),
        );
        setError("");
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : t("admin.users.loadError"),
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [currentQueryKey, query, reloadKey, t]);

  const loading = result?.key !== currentQueryKey && !error;
  const response = result?.key === currentQueryKey ? result.response : null;
  const selectedUser = useMemo(
    () => response?.data.find((item) => item.id === selectedUserId) ?? null,
    [response, selectedUserId],
  );

  const updateQuery = (patch: Partial<AdminUsersQuery>) => {
    setNotice("");
    setError("");
    setQuery((current) => ({ ...current, ...patch, page: 1 }));
  };

  const resetFilters = () => {
    setSearchDraft("");
    setNotice("");
    setError("");
    setQuery(DEFAULT_QUERY);
  };

  const toggleLock = async () => {
    if (!selectedUser || !currentAdmin || workingUserId) return;
    if (selectedUser.id === currentAdmin.id) return;

    const nextLocked = !selectedUser.isLocked;
    const confirmed = window.confirm(
      nextLocked
        ? `${t("admin.users.lockConfirmPrefix")} “${selectedUser.displayName}”? ${t("admin.users.lockConfirmSuffix")}`
        : `${t("admin.users.unlockConfirmPrefix")} “${selectedUser.displayName}”?`,
    );
    if (!confirmed) return;

    setWorkingUserId(selectedUser.id);
    setError("");
    setNotice("");
    try {
      await adminApi.setUserLock(selectedUser.id, nextLocked);
      const refreshed = await adminApi.listUsers(query);
      if (currentQueryKeyRef.current !== currentQueryKey) return;
      const lastPage = Math.max(refreshed.pagination.totalPages, 1);
      if (query.page > lastPage) {
        setQuery((current) => ({ ...current, page: lastPage }));
      } else {
        setResult({ key: currentQueryKey, response: refreshed });
        setSelectedUserId((current) =>
          selectAvailableItemId(refreshed.data, current),
        );
      }
      setNotice(
        nextLocked
          ? `${t("admin.users.lockedPrefix")} ${selectedUser.displayName}.`
          : `${t("admin.users.unlockedPrefix")} ${selectedUser.displayName}.`,
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : t("admin.users.updateError"),
      );
    } finally {
      setWorkingUserId("");
    }
  };

  return (
    <div>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
          {t("admin.users.eyebrow")}
        </p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">
          {t("admin.users.title")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
          {t("admin.users.description")}
        </p>
      </header>

      <div className="mt-5">
        <UserFilters
          query={query}
          searchDraft={searchDraft}
          onSearchDraftChange={setSearchDraft}
          onSubmitSearch={() =>
            updateQuery({ search: searchDraft.trim() || undefined })
          }
          onRoleChange={(role: AdminUserRole | undefined) =>
            updateQuery({ role })
          }
          onLockChange={(isLocked) => updateQuery({ isLocked })}
          onLimitChange={(limit) => updateQuery({ limit })}
          onReset={resetFilters}
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
          {!response && (
            <button
              type="button"
              onClick={() => {
                setError("");
                setReloadKey((key) => key + 1);
              }}
              className={`${secondaryButtonClass} mt-3`}
            >
              {t("common.retry")}
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="h-96 animate-pulse rounded-2xl border border-line bg-surface-card" />
          <div className="h-80 animate-pulse rounded-2xl border border-line bg-surface-card" />
        </div>
      ) : response ? (
        response.data.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-line px-6 py-16 text-center">
            <UsersThreeIcon size={34} className="mx-auto text-ink-faint" />
            <p className="mt-3 font-semibold text-ink">{t("admin.users.empty")}</p>
            <p className="mt-1 text-sm text-ink-muted">
              {t("admin.users.emptyHint")}
            </p>
          </div>
        ) : (
          <>
            <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
              <AdminUserList
                users={response.data}
                selectedUserId={selectedUserId}
                onSelect={setSelectedUserId}
              />
              {selectedUser && currentAdmin && (
                <AdminUserDetail
                  user={selectedUser}
                  currentAdminId={currentAdmin.id}
                  working={workingUserId === selectedUser.id}
                  onToggleLock={toggleLock}
                />
              )}
            </div>

            <nav
              aria-label={t("admin.users.pagination")}
              className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-card px-4 py-3"
            >
              <p className="text-sm text-ink-muted">
                {formatAdminNumber(response.pagination.total, locale)} {t("admin.users.accountsUnit")} ·{" "}
                {t("common.page")} {response.pagination.page} / {Math.max(response.pagination.totalPages, 1)}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={query.page <= 1}
                  onClick={() => setQuery((current) => ({ ...current, page: current.page - 1 }))}
                  className={`${secondaryButtonClass} min-h-10 px-3 py-2`}
                >
                  <CaretLeftIcon /> {t("common.previous")}
                </button>
                <button
                  type="button"
                  disabled={query.page >= response.pagination.totalPages}
                  onClick={() => setQuery((current) => ({ ...current, page: current.page + 1 }))}
                  className={`${secondaryButtonClass} min-h-10 px-3 py-2`}
                >
                  {t("common.next")} <CaretRightIcon />
                </button>
              </div>
            </nav>
          </>
        )
      ) : null}
    </div>
  );
}
