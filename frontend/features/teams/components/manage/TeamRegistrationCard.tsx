import ResolvedImage from "@/components/ResolvedImage";
import StatusBadge from "@/features/teams/components/StatusBadge";
import type { TeamWithMembers } from "@/features/teams/types";

const PLAYER_ROLES = new Set(["CAPTAIN", "PLAYER", "SUBSTITUTE"]);

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function TeamRegistrationCard({
  team,
  selected,
  onSelect,
}: {
  team: TeamWithMembers;
  selected: boolean;
  onSelect: () => void;
}) {
  const playerCount =
    team.members?.filter((member) => PLAYER_ROLES.has(member.memberRole))
      .length ??
    team._count?.members ??
    0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border p-4 text-left transition ${
        selected
          ? "border-brand bg-brand/10 shadow-[var(--shadow-focus)]"
          : "border-line bg-surface-card hover:border-line-strong"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand/10 font-bold text-brand">
          <ResolvedImage
            src={team.logoUrl}
            alt={`Logo ${team.name}`}
            className="size-full object-cover object-center"
            fallback={team.name.charAt(0).toUpperCase()}
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-start justify-between gap-2">
            <span className="min-w-0">
              <span className="block truncate font-semibold text-ink">
                {team.name}
              </span>
              <span className="mt-0.5 block truncate text-xs text-ink-muted">
                Đại diện: {team.contactName}
              </span>
            </span>
            <StatusBadge status={team.status} />
          </span>
          <span className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-faint">
            <span>{playerCount} vị trí cầu thủ</span>
            <span>Đăng ký {formatDate(team.registeredAt)}</span>
          </span>
          {team.reviewedAt && (
            <span className="mt-1 block text-xs text-ink-faint">
              Đã xét duyệt {formatDate(team.reviewedAt)}
            </span>
          )}
        </span>
      </div>
    </button>
  );
}
