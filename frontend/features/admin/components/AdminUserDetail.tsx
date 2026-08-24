import type { ReactNode } from "react";
import { LockKeyIcon, ShieldCheckIcon, UserCircleIcon } from "@phosphor-icons/react";
import ResolvedImage from "@/components/ResolvedImage";
import type { AdminUser } from "@/features/admin/types";
import { secondaryButtonClass } from "@/components/ui";
import { formatAdminDate } from "@/features/admin/format";
import { useLocale, type TranslationKey } from "@/features/locale/store";

export default function AdminUserDetail({
  user,
  currentAdminId,
  working,
  onToggleLock,
}: {
  user: AdminUser;
  currentAdminId: string;
  working: boolean;
  onToggleLock: () => void;
}) {
  const { locale, t } = useLocale();
  const isSelf = user.id === currentAdminId;

  return (
    <article className="rounded-2xl border border-line bg-surface-card p-5 shadow-sm lg:sticky lg:top-24">
      <div className="flex items-start gap-4">
        <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-brand/15 text-xl font-bold text-brand">
          <ResolvedImage
            src={user.avatarUrl}
            alt={`${t("admin.users.avatarAlt")} ${user.displayName}`}
            className="size-full object-cover object-center"
            fallback={user.displayName.charAt(0).toUpperCase()}
          />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="break-words text-lg font-bold text-ink">{user.displayName}</h2>
          <p className="mt-1 break-all text-sm text-ink-muted">{user.email}</p>
          <span
            className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
              user.isLocked
                ? "bg-rejected/12 text-rejected"
                : "bg-approved/12 text-approved"
            }`}
          >
            {user.isLocked ? <LockKeyIcon weight="fill" /> : <UserCircleIcon weight="fill" />}
            {user.isLocked ? t("admin.users.accountLocked") : t("admin.users.accountActive")}
          </span>
        </div>
      </div>

      <dl className="mt-5 divide-y divide-line rounded-xl border border-line px-4 text-sm">
        <DetailRow
          label={t("admin.users.role")}
          value={
            <span className="inline-flex items-center gap-1.5 font-semibold">
              {user.role === "ADMIN" && <ShieldCheckIcon className="text-brand" weight="fill" />}
              {t(`admin.role.${user.role}` as TranslationKey)}
            </span>
          }
        />
        <DetailRow label={t("admin.users.createdAt")} value={formatAdminDate(user.createdAt, locale, true)} />
        <DetailRow label={t("admin.users.updatedAt")} value={formatAdminDate(user.updatedAt, locale, true)} />
      </dl>

      <section className="mt-5 border-t border-line pt-5">
        <h3 className="text-sm font-bold text-ink">{t("admin.users.security")}</h3>
        <p className="mt-1 text-xs leading-5 text-ink-faint">
          {t("admin.users.lockHint")}
        </p>
        {isSelf ? (
          <p className="mt-4 rounded-xl border border-line bg-surface-sub px-3 py-2.5 text-xs leading-5 text-ink-muted">
            {t("admin.users.selfLockHint")}
          </p>
        ) : (
          <button
            type="button"
            onClick={onToggleLock}
            disabled={working}
            className={`${secondaryButtonClass} mt-4 w-full ${
              user.isLocked
                ? "border-approved/40 text-approved"
                : "border-rejected/40 text-rejected"
            }`}
          >
            <LockKeyIcon />
            {working
              ? t("admin.users.updating")
              : user.isLocked
                ? t("admin.users.unlock")
                : t("admin.users.lock")}
          </button>
        )}
      </section>
    </article>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="text-right text-ink-muted">{value}</dd>
    </div>
  );
}
