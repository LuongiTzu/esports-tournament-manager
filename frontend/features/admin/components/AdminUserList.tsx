import { LockKeyIcon } from "@phosphor-icons/react";
import ResolvedImage from "@/components/ResolvedImage";
import type { AdminUser } from "@/features/admin/types";
import { formatAdminDate } from "@/features/admin/format";
import { useLocale, type TranslationKey } from "@/features/locale/store";

export default function AdminUserList({
  users,
  selectedUserId,
  onSelect,
}: {
  users: AdminUser[];
  selectedUserId: string;
  onSelect: (userId: string) => void;
}) {
  const { locale, t } = useLocale();
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface-card">
      <div className="hidden grid-cols-[minmax(14rem,1.5fr)_minmax(12rem,1fr)_8rem_8rem] gap-3 border-b border-line bg-surface-sub/60 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-faint md:grid">
        <span>{t("admin.users.account")}</span>
        <span>{t("common.email")}</span>
        <span>{t("admin.users.role")}</span>
        <span>{t("admin.users.status")}</span>
      </div>
      <div className="divide-y divide-line">
        {users.map((user) => {
          const selected = selectedUserId === user.id;
          return (
            <button
              key={user.id}
              type="button"
              onClick={() => onSelect(user.id)}
              aria-pressed={selected}
              className={`grid w-full gap-3 px-4 py-4 text-left transition md:grid-cols-[minmax(14rem,1.5fr)_minmax(12rem,1fr)_8rem_8rem] md:items-center ${
                selected ? "bg-brand/10" : "hover:bg-surface-hover"
              }`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-brand/15 font-bold text-brand">
                  <ResolvedImage
                    src={user.avatarUrl}
                    alt=""
                    className="size-full object-cover object-center"
                    fallback={user.displayName.charAt(0).toUpperCase()}
                  />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-ink">{user.displayName}</span>
                  <span className="mt-0.5 block text-xs text-ink-faint">{t("admin.users.created")} {formatAdminDate(user.createdAt, locale)}</span>
                </span>
              </span>
              <span className="min-w-0 truncate text-sm text-ink-muted">{user.email}</span>
              <span className="w-fit rounded-full border border-line bg-surface-sub px-2.5 py-1 text-xs font-semibold text-ink-muted">
                {t(`admin.role.${user.role}` as TranslationKey)}
              </span>
              <span
                className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  user.isLocked
                    ? "bg-rejected/12 text-rejected"
                    : "bg-approved/12 text-approved"
                }`}
              >
                {user.isLocked && <LockKeyIcon weight="fill" />}
                {user.isLocked ? t("admin.users.locked") : t("admin.users.active")}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
