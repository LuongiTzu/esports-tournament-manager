import { FunnelIcon, XIcon } from "@phosphor-icons/react";
import { inputClass, secondaryButtonClass } from "@/components/ui";
import type { AdminTournamentModerationStatus } from "@/features/admin/types";

export default function TournamentAdminFilters({
  moderationStatus,
  onChange,
}: {
  moderationStatus?: AdminTournamentModerationStatus;
  onChange: (value?: AdminTournamentModerationStatus) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface-card p-4 shadow-sm">
      <FunnelIcon className="text-brand" size={20} weight="duotone" />
      <label className="min-w-56 flex-1 sm:max-w-xs">
        <span className="sr-only">Trạng thái kiểm duyệt</span>
        <select
          value={moderationStatus ?? "ALL"}
          onChange={(event) =>
            onChange(
              event.target.value === "ALL"
                ? undefined
                : (event.target.value as AdminTournamentModerationStatus),
            )
          }
          className={inputClass}
        >
          <option value="ALL">Mọi trạng thái kiểm duyệt</option>
          <option value="ACTIVE">Đang hiển thị trên nền tảng</option>
          <option value="HIDDEN_BY_ADMIN">Đã bị Admin ẩn</option>
        </select>
      </label>
      {moderationStatus && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className={`${secondaryButtonClass} px-4`}
        >
          <XIcon /> Xóa bộ lọc
        </button>
      )}
      <p className="basis-full text-xs text-ink-faint">
        Backend hiện chỉ hỗ trợ lọc theo trạng thái kiểm duyệt; chưa có tìm kiếm hoặc phân trang cho danh sách này.
      </p>
    </div>
  );
}
