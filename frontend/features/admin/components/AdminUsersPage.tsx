"use client";

import { useEffect, useMemo, useState } from "react";
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

const DEFAULT_QUERY: AdminUsersQuery = { page: 1, limit: 10 };

function queryKey(query: AdminUsersQuery) {
  return JSON.stringify(query);
}

export default function AdminUsersPage() {
  const { user: currentAdmin } = useAuth();
  const { locale } = useLocale();
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
          response.data.some((item) => item.id === current)
            ? current
            : (response.data[0]?.id ?? ""),
        );
        setError("");
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Không tải được danh sách người dùng.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [currentQueryKey, query, reloadKey]);

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
        ? `Khóa tài khoản “${selectedUser.displayName}”? Các token hiện tại sẽ bị vô hiệu hóa.`
        : `Mở khóa tài khoản “${selectedUser.displayName}”?`,
    );
    if (!confirmed) return;

    setWorkingUserId(selectedUser.id);
    setError("");
    setNotice("");
    try {
      await adminApi.setUserLock(selectedUser.id, nextLocked);
      const refreshed = await adminApi.listUsers(query);
      const lastPage = Math.max(refreshed.pagination.totalPages, 1);
      if (query.page > lastPage) {
        setQuery((current) => ({ ...current, page: lastPage }));
      } else {
        setResult({ key: currentQueryKey, response: refreshed });
        setSelectedUserId((current) =>
          refreshed.data.some((item) => item.id === current)
            ? current
            : (refreshed.data[0]?.id ?? ""),
        );
      }
      setNotice(
        nextLocked
          ? `Đã khóa tài khoản ${selectedUser.displayName}.`
          : `Đã mở khóa tài khoản ${selectedUser.displayName}.`,
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể cập nhật trạng thái tài khoản.",
      );
    } finally {
      setWorkingUserId("");
    }
  };

  return (
    <div>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
          Account administration
        </p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">
          Quản lý người dùng
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
          Tra cứu tài khoản, xem vai trò thực tế và quản lý trạng thái khóa theo
          quyền ADMIN hiện có.
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
              Thử lại
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
            <p className="mt-3 font-semibold text-ink">Không tìm thấy người dùng</p>
            <p className="mt-1 text-sm text-ink-muted">
              Hãy thay đổi từ khóa hoặc bộ lọc hiện tại.
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
              aria-label="Phân trang người dùng"
              className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-card px-4 py-3"
            >
              <p className="text-sm text-ink-muted">
                {formatAdminNumber(response.pagination.total, locale)} tài khoản ·
                Trang {response.pagination.page} / {Math.max(response.pagination.totalPages, 1)}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={query.page <= 1}
                  onClick={() => setQuery((current) => ({ ...current, page: current.page - 1 }))}
                  className={`${secondaryButtonClass} min-h-10 px-3 py-2`}
                >
                  <CaretLeftIcon /> Trước
                </button>
                <button
                  type="button"
                  disabled={query.page >= response.pagination.totalPages}
                  onClick={() => setQuery((current) => ({ ...current, page: current.page + 1 }))}
                  className={`${secondaryButtonClass} min-h-10 px-3 py-2`}
                >
                  Sau <CaretRightIcon />
                </button>
              </div>
            </nav>
          </>
        )
      ) : null}
    </div>
  );
}
