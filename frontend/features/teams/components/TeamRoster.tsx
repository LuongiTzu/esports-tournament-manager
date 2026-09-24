"use client";

import type { ReactNode } from "react";
import {
  CaretDownIcon,
  CrownIcon,
  CrosshairIcon,
  IdentificationCardIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import ResolvedImage from "@/components/ResolvedImage";
import { gamePositionLabel } from "@/features/games/position-labels";
import { formatLocalizedDate } from "@/features/locale/format";
import { useLocale, type TranslationKey } from "@/features/locale/store";
import type { MemberRole, TeamMember } from "@/features/teams/types";
import styles from "./TeamProfile.module.css";

const groups: { label: TranslationKey; roles: MemberRole[] }[] = [
  { label: "teamDetail.startingRoster", roles: ["CAPTAIN", "PLAYER"] },
  { label: "teamDetail.substitutes", roles: ["SUBSTITUTE"] },
  { label: "teamDetail.staff", roles: ["COACH", "MANAGER"] },
];

function MemberCard({
  member,
  sensitive,
  actions,
}: {
  member: TeamMember;
  sensitive: boolean;
  actions?: ReactNode;
}) {
  const { locale, t } = useLocale();
  const isCaptain = member.memberRole === "CAPTAIN";
  const personalDetails: Array<[TranslationKey, string | null | undefined]> =
    sensitive
      ? [
          ["teamDetail.gameId", member.inGameId],
          [
            "registration.birthDate",
            member.birthDate
              ? formatLocalizedDate(member.birthDate, locale)
              : null,
          ],
          [
            "registration.gender",
            member.gender
              ? t(
                  `auth.register.gender.${member.gender.toLowerCase()}` as TranslationKey,
                )
              : null,
          ],
          ["common.email", member.email],
          ["registration.phone", member.phoneNumber],
        ]
      : [];

  return (
    <li
      className={`${styles.member} ${isCaptain ? styles.captain : ""} flex flex-col`}
    >
      <div className="flex items-start gap-3 p-4">
        <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-line-strong bg-surface-card text-xl font-black text-accent">
          <ResolvedImage
            src={member.avatarUrl}
            alt={member.ign || member.realName}
            className="size-full object-cover"
            fallback={(member.ign || member.realName).charAt(0).toUpperCase()}
          />
        </span>
        <div className="min-w-0 flex-1">
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${isCaptain ? "text-accent" : "text-ink-faint"}`}
          >
            {isCaptain && <CrownIcon size={12} weight="fill" aria-hidden />}
            {t(`registration.role.${member.memberRole}` as TranslationKey)}
          </span>
          <h3 className="mt-1 break-words text-base font-bold text-ink">
            {member.ign || member.realName}
          </h3>
          {member.ign && (
            <p className="mt-0.5 break-words text-xs text-ink-muted">
              {member.realName}
            </p>
          )}
        </div>
      </div>
      {member.position && (
        <p className="flex items-center gap-2 px-4 pb-4 text-xs text-ink-muted">
          <CrosshairIcon
            size={15}
            aria-hidden
            className="shrink-0 text-accent"
          />
          {gamePositionLabel(member.position, locale)}
        </p>
      )}
      <div className="mt-auto">
        {personalDetails.some(([, value]) => Boolean(value)) && (
          <details className="border-t border-line px-4">
            <summary className={styles.detailSummary}>
              <IdentificationCardIcon size={16} aria-hidden />
              {t("teamDetail.memberDetails")}
              <CaretDownIcon size={14} aria-hidden />
            </summary>
            <dl className="space-y-3 pb-4 text-xs">
              {personalDetails
                .filter(([, value]) => Boolean(value))
                .map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-ink-faint">{t(label)}</dt>
                    <dd className="mt-1 break-words text-ink">{value}</dd>
                  </div>
                ))}
            </dl>
          </details>
        )}
        {actions && (
          <div className="flex items-center justify-end gap-2 border-t border-line px-3 py-2">
            {actions}
          </div>
        )}
      </div>
    </li>
  );
}

export default function TeamRoster({
  members,
  sensitive,
  renderActions,
}: {
  members: TeamMember[];
  sensitive: boolean;
  renderActions?: (member: TeamMember) => ReactNode;
}) {
  const { t } = useLocale();
  if (!members.length)
    return (
      <div className="border border-dashed border-line px-5 py-10 text-center text-sm text-ink-muted">
        <UsersThreeIcon
          size={28}
          className="mx-auto mb-3 text-accent"
          aria-hidden
        />
        {t("teamDetail.noMembers")}
      </div>
    );

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const roster = members.filter((member) =>
          group.roles.includes(member.memberRole),
        );
        if (!roster.length) return null;
        return (
          <div key={group.label}>
            <div className="mb-3 flex items-center gap-3">
              <h3 className="text-xs font-semibold text-ink-muted">
                {t(group.label)}
              </h3>
              <span className="font-mono text-xs text-accent">
                {roster.length.toString().padStart(2, "0")}
              </span>
              <span className="h-px flex-1 bg-line" aria-hidden />
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {roster.map((member) => (
                <MemberCard
                  key={member.id}
                  member={member}
                  sensitive={sensitive}
                  actions={renderActions?.(member)}
                />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
