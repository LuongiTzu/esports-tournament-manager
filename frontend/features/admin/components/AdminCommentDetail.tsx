import Link from "next/link";
import { EyeIcon, EyeSlashIcon, TrashIcon } from "@phosphor-icons/react";
import { secondaryButtonClass } from "@/components/ui";
import type { AdminComment } from "@/features/admin/types";
import { formatAdminDate } from "@/features/admin/format";
import { useLocale } from "@/features/locale/store";

export default function AdminCommentDetail({
  comment,
  workingAction,
  onToggleHidden,
  onDelete,
}: {
  comment: AdminComment;
  workingAction: "VISIBILITY" | "DELETE" | "";
  onToggleHidden: () => void;
  onDelete: () => void;
}) {
  const { locale, t } = useLocale();
  return (
    <article className="rounded-xl border border-line bg-surface-sub p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold text-ink">{comment.author.displayName}</p>
          <p className="mt-0.5 text-xs text-ink-faint">{formatAdminDate(comment.createdAt, locale, true)}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${comment.isHidden ? "bg-rejected/12 text-rejected" : "bg-approved/12 text-approved"}`}>
          {comment.isHidden ? t("admin.comments.hidden") : t("admin.comments.visible")}
        </span>
      </div>
      <p className="mt-4 whitespace-pre-wrap break-words rounded-lg border border-line bg-surface-card p-3 text-sm leading-6 text-ink-muted">
        {comment.content}
      </p>
      <div className="mt-4 text-xs text-ink-faint">
        <p>{t("admin.comments.tournament")}: <span className="font-semibold text-ink-muted">{comment.tournament.name}</span></p>
        <p className="mt-1">{t("admin.comments.updated")}: {formatAdminDate(comment.updatedAt, locale, true)}</p>
      </div>
      <Link href={`/tournaments/${comment.tournament.slug}`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-hover">
        <EyeIcon /> {t("admin.comments.viewContext")}
      </Link>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <button type="button" disabled={Boolean(workingAction)} onClick={onToggleHidden} className={secondaryButtonClass}>
          {comment.isHidden ? <EyeIcon /> : <EyeSlashIcon />}
          {workingAction === "VISIBILITY" ? t("admin.comments.updating") : comment.isHidden ? t("admin.comments.restore") : t("admin.comments.hide")}
        </button>
        <button type="button" disabled={Boolean(workingAction)} onClick={onDelete} className={`${secondaryButtonClass} border-rejected/40 text-rejected`}>
          <TrashIcon /> {workingAction === "DELETE" ? t("admin.comments.deleting") : t("admin.comments.deletePermanent")}
        </button>
      </div>
    </article>
  );
}
