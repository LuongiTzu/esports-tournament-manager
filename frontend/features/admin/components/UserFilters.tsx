import { MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import { inputClass, secondaryButtonClass } from "@/components/ui";
import type { AdminUserRole, AdminUsersQuery } from "@/features/admin/types";

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
          <span className="sr-only">Tìm người dùng</span>
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            value={searchDraft}
            onChange={(event) => onSearchDraftChange(event.target.value)}
            placeholder="Tên hiển thị hoặc email"
            className={`${inputClass} pl-10`}
          />
        </label>

        <label>
          <span className="sr-only">Vai trò tài khoản</span>
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
            <option value="ALL">Mọi vai trò</option>
            <option value="ADMIN">ADMIN</option>
            <option value="SIGNED_UP_USER">Người dùng</option>
          </select>
        </label>

        <label>
          <span className="sr-only">Trạng thái tài khoản</span>
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
            <option value="ALL">Mọi trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="LOCKED">Đã khóa</option>
          </select>
        </label>

        <label>
          <span className="sr-only">Số dòng mỗi trang</span>
          <select
            value={query.limit}
            onChange={(event) => onLimitChange(Number(event.target.value))}
            className={inputClass}
          >
            <option value={10}>10 / trang</option>
            <option value={20}>20 / trang</option>
            <option value={50}>50 / trang</option>
          </select>
        </label>

        <div className="flex gap-2">
          <button type="submit" className="min-h-[var(--control-height)] flex-1 rounded-xl bg-brand px-4 text-sm font-semibold text-on-brand hover:bg-brand-hover">
            Tìm
          </button>
          {hasFilters && (
            <button
              type="button"
              onClick={onReset}
              aria-label="Xóa bộ lọc"
              title="Xóa bộ lọc"
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
