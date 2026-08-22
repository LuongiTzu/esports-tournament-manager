import { EyeSlashIcon, SealCheckIcon } from "@phosphor-icons/react";
import ResolvedImage from "@/components/ResolvedImage";
import type { AdminTournament } from "@/features/admin/types";
import { formatAdminDate } from "@/features/admin/format";
import { useLocale } from "@/features/locale/store";

const STATUS_LABELS: Record<AdminTournament["status"], string> = {
  DRAFT: "Bản nháp",
  REGISTRATION: "Đăng ký",
  ONGOING: "Đang thi đấu",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
};

export default function AdminTournamentList({
  tournaments,
  selectedId,
  onSelect,
}: {
  tournaments: AdminTournament[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const { locale } = useLocale();
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface-card">
      <div className="hidden grid-cols-[minmax(15rem,1.5fr)_minmax(9rem,0.8fr)_8rem_9rem] gap-3 border-b border-line bg-surface-sub/60 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-faint md:grid">
        <span>Giải đấu</span>
        <span>Organizer</span>
        <span>Vòng đời</span>
        <span>Kiểm duyệt</span>
      </div>
      <div className="divide-y divide-line">
        {tournaments.map((tournament) => {
          const selected = tournament.id === selectedId;
          return (
            <button
              key={tournament.id}
              type="button"
              onClick={() => onSelect(tournament.id)}
              aria-pressed={selected}
              className={`grid w-full gap-3 px-4 py-4 text-left transition md:grid-cols-[minmax(15rem,1.5fr)_minmax(9rem,0.8fr)_8rem_9rem] md:items-center ${
                selected ? "bg-brand/10" : "hover:bg-surface-hover"
              }`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-surface-sub">
                  <ResolvedImage
                    src={tournament.bannerUrl}
                    alt=""
                    className="size-full object-cover object-center"
                    fallback={
                      <span className="grid size-full place-items-center font-black text-brand">
                        {tournament.name.charAt(0).toUpperCase()}
                      </span>
                    }
                  />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-semibold text-ink">{tournament.name}</span>
                    {tournament.isVerified && (
                      <SealCheckIcon className="shrink-0 text-brand" weight="fill" />
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-faint">
                    {tournament.game.name} · Tạo {formatAdminDate(tournament.createdAt, locale)}
                  </span>
                </span>
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink-muted">
                  {tournament.organizer.displayName}
                </span>
                <span className="block truncate text-xs text-ink-faint">
                  {tournament.organizer.email}
                </span>
              </span>
              <span className="w-fit rounded-full border border-line bg-surface-sub px-2.5 py-1 text-xs font-semibold text-ink-muted">
                {STATUS_LABELS[tournament.status]}
              </span>
              <span
                className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  tournament.moderationStatus === "HIDDEN_BY_ADMIN"
                    ? "bg-rejected/12 text-rejected"
                    : "bg-approved/12 text-approved"
                }`}
              >
                {tournament.moderationStatus === "HIDDEN_BY_ADMIN" && (
                  <EyeSlashIcon weight="fill" />
                )}
                {tournament.moderationStatus === "HIDDEN_BY_ADMIN"
                  ? "Admin đã ẩn"
                  : "Đang hiển thị"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
