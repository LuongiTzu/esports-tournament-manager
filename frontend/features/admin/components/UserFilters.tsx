"use client";

import { MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import { inputClass, secondaryButtonClass } from "@/components/ui";
import type { AdminUserRole, AdminUsersQuery } from "@/features/admin/types";
import { useLocale } from "@/features/locale/store";

export default function UserFilters({
  query,
  searchDraft,
  onSearchDraftChange,
  onSubmitSearch,
  onRoleChange,
  onLockChange,
  onLimitChange,
  onReset,
}: {
  query: AdminUsersQuery;
  searchDraft: string;
  onSearchDraftChange: (value: string) => void;
  onSubmitSearch: () => void;
  onRoleChange: (role: AdminUserRole | undefined) => void;
  onLockChange: (isLocked: boolean | undefined) => void;
  onLimitChange: (limit: number) => void;
  onReset: () => void;
}) {
  const { t } = useLocale();
  const hasFilters = Boolean(
    query.search || query.role || query.isLocked !== undefined || query.limit !== 10,
  );

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmitSearch();
      }}
      className="rounded-2xl border border-line bg-surface-card p-4 shadow-sm"
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(15rem,1.4fr)_minmax(10rem,0.7fr)_minmax(10rem,0.7fr)_7rem_auto]">
        <label className="relative block">
          <span className="sr-only">{t("admin.users.searchAria")}</span>
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            value={searchDraft}
            onChange={(event) => onSearchDraftChange(event.target.value)}
            placeholder={t("admin.users.searchPlaceholder")}
            className={`${inputClass} pl-10`}
          />
        </label>

        <label>
          <span className="sr-only">{t("admin.users.roleAria")}</span>
          <select
            value={query.role ?? "ALL"}
            onChange={(event) =>
              onRoleChange(
                event.target.value === "ALL"
                  ? undefined
                  : (event.target.value as AdminUserRole),
              )
            }
            className={inputClass}
          >
            <option value="ALL">{t("admin.users.allRoles")}</option>
            <option value="ADMIN">{t("admin.role.ADMIN")}</option>
            <option value="SIGNED_UP_USER">{t("admin.role.SIGNED_UP_USER")}</option>
          </select>
        </label>

        <label>
          <span className="sr-only">{t("admin.users.statusAria")}</span>
          <select
            value={
              query.isLocked === undefined
                ? "ALL"
                : query.isLocked
                  ? "LOCKED"
                  : "ACTIVE"
            }
            onChange={(event) =>
              onLockChange(
                event.target.value === "ALL"
                  ? undefined
                  : event.target.value === "LOCKED",
              )
            }
            className={inputClass}
          >
            <option value="ALL">{t("admin.users.allStatuses")}</option>
            <option value="ACTIVE">{t("admin.users.activeFilter")}</option>
            <option value="LOCKED">{t("admin.users.locked")}</option>
          </select>
        </label>

        <label>
          <span className="sr-only">{t("admin.users.rowsPerPage")}</span>
          <select
            value={query.limit}
            onChange={(event) => onLimitChange(Number(event.target.value))}
            className={inputClass}
          >
            <option value={10}>10 / {t("admin.users.perPage")}</option>
            <option value={20}>20 / {t("admin.users.perPage")}</option>
            <option value={50}>50 / {t("admin.users.perPage")}</option>
          </select>
        </label>

        <div className="flex gap-2">
          <button type="submit" className="min-h-[var(--control-height)] flex-1 rounded-xl bg-brand px-4 text-sm font-semibold text-on-brand hover:bg-brand-hover">
            {t("common.search")}
          </button>
          {hasFilters && (
            <button
              type="button"
              onClick={onReset}
              aria-label={t("admin.users.clearFilters")}
              title={t("admin.users.clearFilters")}
              className={`${secondaryButtonClass} min-h-[var(--control-height)] px-3`}
            >
              <XIcon />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
