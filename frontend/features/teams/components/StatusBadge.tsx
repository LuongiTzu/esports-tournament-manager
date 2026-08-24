import type { TeamStatus } from "@/features/teams/types";
import { useLocale, type TranslationKey } from "@/features/locale/store";

/**
 * Nhãn trạng thái đội — hệ màu duy nhất dùng chung mọi trang.
 * Cố ý khác accent theo game về cả hình dạng (rounded-md + viền, không phải pill đặc)
 * lẫn độ bão hòa, để giải Valorant tông đỏ không bị lẫn với nhãn "Từ chối".
 */
const STATUS: Record<TeamStatus, { labelKey: TranslationKey; className: string }> = {
  PENDING: {
    labelKey: "team.status.PENDING",
    className: "border-pending/40 bg-pending/10 text-pending",
  },
  APPROVED: {
    labelKey: "team.status.APPROVED",
    className: "border-approved/40 bg-approved/10 text-approved",
  },
  REJECTED: {
    labelKey: "team.status.REJECTED",
    className: "border-rejected/40 bg-rejected/10 text-rejected",
  },
};

export default function StatusBadge({
  status,
  className = "",
}: {
  status: TeamStatus;
  className?: string;
}) {
  const { t } = useLocale();
  const s = STATUS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${s.className} ${className}`}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {t(s.labelKey)}
    </span>
  );
}
