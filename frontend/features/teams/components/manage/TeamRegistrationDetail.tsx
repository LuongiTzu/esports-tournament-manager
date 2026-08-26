"use client";

import ResolvedImage from "@/components/ResolvedImage";
import StatusBadge from "@/features/teams/components/StatusBadge";
import type { GamePositionMode } from "@/features/games/types";
import { gamePositionLabel } from "@/features/games/position-labels";
import type {
  MemberRole,
  TeamDetail,
  TeamMember,
} from "@/features/teams/types";
import { formatLocalizedDate } from "@/features/locale/format";
import { useLocale, type TranslationKey } from "@/features/locale/store";

const PLAYER_ROLES = new Set<MemberRole>(["CAPTAIN", "PLAYER", "SUBSTITUTE"]);

function MemberCard({
  member,
  positionMode,
}: {
  member: TeamMember;
  positionMode: GamePositionMode;
}) {
  const { locale, t } = useLocale();
  const showPosition =
    PLAYER_ROLES.has(member.memberRole) && positionMode !== "NONE";

  return (
    <li className="rounded-xl border border-line bg-surface-sub/45 p-3">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-brand/10 text-sm font-bold text-brand">
          <ResolvedImage
            src={member.avatarUrl}
            alt={`${t("registration.memberAvatarAlt")} ${member.realName}`}
            className="size-full object-cover object-center"
            fallback={member.realName.charAt(0).toUpperCase()}
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium text-ink">{member.realName}</p>
              <p className="text-xs text-brand">{member.ign}</p>
            </div>
            <span className="rounded-full bg-surface-card px-2 py-1 text-[10px] font-semibold uppercase text-ink-muted">
              {t(`registration.role.${member.memberRole}` as TranslationKey)}
            </span>
          </div>
          <dl className="mt-3 grid gap-x-4 gap-y-2 text-xs text-ink-muted sm:grid-cols-2">
            {showPosition && (
              <div>
                <dt className="text-ink-faint">{t("registration.position")}</dt>
                <dd className="mt-0.5">
                  {member.position
                    ? gamePositionLabel(member.position, locale)
                    : positionMode === "OPTIONAL" ||
                        member.memberRole === "SUBSTITUTE"
                      ? t("registration.notSelected")
                      : t("registration.noData")}
                </dd>
              </div>
            )}
            {member.birthDate && (
              <div>
                <dt className="text-ink-faint">{t("registration.birthDate")}</dt>
                <dd className="mt-0.5">{formatLocalizedDate(member.birthDate, locale)}</dd>
              </div>
            )}
            {member.gender && (
              <div>
                <dt className="text-ink-faint">{t("registration.gender")}</dt>
                <dd className="mt-0.5">{t(`auth.register.gender.${member.gender.toLowerCase()}` as TranslationKey)}</dd>
              </div>
            )}
            {member.email && (
              <div className="min-w-0">
                <dt className="text-ink-faint">{t("common.email")}</dt>
                <dd className="mt-0.5 truncate">{member.email}</dd>
              </div>
            )}
            {member.phoneNumber && (
              <div>
                <dt className="text-ink-faint">{t("registration.phone")}</dt>
                <dd className="mt-0.5">{member.phoneNumber}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </li>
  );
}

export default function TeamRegistrationDetail({
  team,
  positionMode,
  minTeamSize,
  maxTeamSize,
  rejectionReason,
  onRejectionReasonChange,
  onApprove,
  onReject,
  working,
}: {
  team: TeamDetail;
  positionMode: GamePositionMode;
  minTeamSize: number;
  maxTeamSize: number;
  rejectionReason: string;
  onRejectionReasonChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
  working: "approve" | "reject" | null;
}) {
  const { t } = useLocale();
  const players = team.members.filter((member) =>
    PLAYER_ROLES.has(member.memberRole),
  );
  const activePlayers = players.filter(
    (member) =>
      member.memberRole === "CAPTAIN" || member.memberRole === "PLAYER",
  );
  const substitutes = players.filter(
    (member) => member.memberRole === "SUBSTITUTE",
  );
  const staff = team.members.filter(
    (member) => !PLAYER_ROLES.has(member.memberRole),
  );
  const maxSubstitutes = maxTeamSize - minTeamSize;

  return (
    <article className="rounded-2xl border border-line bg-surface-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-4">
        <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-brand/10 text-xl font-bold text-brand">
          <ResolvedImage
            src={team.logoUrl}
            alt={`${t("tournament.detail.teamLogoAlt")} ${team.name}`}
            className="size-full object-cover object-center"
            fallback={team.name.charAt(0).toUpperCase()}
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold text-ink">{team.name}</h3>
              {team.shortName && (
                <p className="mt-0.5 text-xs uppercase text-ink-faint">
                  {team.shortName}
                </p>
              )}
            </div>
            <StatusBadge status={team.status} />
          </div>
          {team.description && (
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              {team.description}
            </p>
          )}
        </div>
      </div>

      <section className="mt-5 rounded-xl border border-line bg-surface-sub/45 p-4">
        <h4 className="text-sm font-semibold text-ink">{t("registration.representative")}</h4>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-ink-faint">{t("registration.fullName")}</dt>
            <dd className="mt-0.5 break-words text-ink-muted">
              {team.contactName}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-faint">{t("common.email")}</dt>
            <dd className="mt-0.5 break-all text-ink-muted">
              {team.contactEmail}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-faint">{t("registration.phone")}</dt>
            <dd className="mt-0.5 text-ink-muted">
              {team.contactPhone ?? "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-ink">{t("registration.playerRoster")}</h4>
            <p className="mt-1 text-xs text-ink-muted">
              {activePlayers.length} {t("registration.starters")} ·{" "}
              {substitutes.length} {t("registration.substitutes")}
            </p>
          </div>
          <p className="text-xs text-ink-faint">
            {minTeamSize}–{maxTeamSize} {t("registration.slots")} · {minTeamSize} {t("registration.starters")} ·{" "}
            {t("registration.upTo")} {maxSubstitutes} {t("registration.substitutes")}
          </p>
        </div>
        <ul className="mt-3 grid gap-3 xl:grid-cols-2">
          {players.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              positionMode={positionMode}
            />
          ))}
        </ul>
      </section>

      {staff.length > 0 && (
        <section className="mt-5 border-t border-line pt-5">
          <h4 className="text-sm font-semibold text-ink">
            {t("registration.staff")}
          </h4>
          <p className="mt-1 text-xs text-ink-faint">
            {t("registration.staffHint")}
          </p>
          <ul className="mt-3 grid gap-3 xl:grid-cols-2">
            {staff.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                positionMode={positionMode}
              />
            ))}
          </ul>
        </section>
      )}

      {team.status === "REJECTED" && team.rejectReason && (
        <div className="mt-5 rounded-xl border border-rejected/30 bg-rejected/10 p-4">
          <p className="text-xs font-semibold uppercase text-rejected">
            {t("registration.rejectionReason")}
          </p>
          <p className="mt-2 text-sm text-ink-muted">{team.rejectReason}</p>
        </div>
      )}

      {team.status === "PENDING" && (
        <section className="mt-5 border-t border-line pt-5">
          <label
            className="block text-sm font-medium text-ink"
            htmlFor={`reject-${team.id}`}
          >
            {t("registration.rejectionReason")}
          </label>
          <textarea
            id={`reject-${team.id}`}
            value={rejectionReason}
            onChange={(event) => onRejectionReasonChange(event.target.value)}
            maxLength={500}
            rows={3}
            placeholder={t("registration.rejectionPlaceholder")}
            className="mt-2 w-full rounded-xl border border-line bg-surface-sub px-3 py-2 text-sm text-ink outline-none focus:border-brand"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onApprove}
              disabled={working !== null}
              className="rounded-lg bg-approved px-4 py-2 text-sm font-semibold text-surface disabled:opacity-50"
            >
              {working === "approve" ? t("registration.approving") : t("registration.approveTeam")}
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={working !== null}
              className="rounded-lg border border-rejected/40 bg-rejected/10 px-4 py-2 text-sm font-semibold text-rejected disabled:opacity-50"
            >
              {working === "reject" ? t("registration.rejecting") : t("registration.rejectTeam")}
            </button>
          </div>
        </section>
      )}
    </article>
  );
}
