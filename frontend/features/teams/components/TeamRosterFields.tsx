"use client";

import { PlusIcon, TrashIcon, UsersThreeIcon } from "@phosphor-icons/react";
import {
  hintClass,
  inputClass,
  labelClass,
  secondaryButtonClass,
} from "@/components/ui";
import { gamePositionLabel } from "@/features/games/position-labels";
import { useLocale, type TranslationKey } from "@/features/locale/store";
import {
  emptyMember,
  GENDER_OPTIONS,
  type MemberForm,
} from "@/features/teams/registration-form";
import type { TeamRegistrationForm } from "@/features/teams/types";
import RegistrationFormSection from "./RegistrationFormSection";

export default function TeamRosterFields({
  config,
  members,
  onChange,
}: {
  config: TeamRegistrationForm;
  members: MemberForm[];
  onChange: (members: MemberForm[]) => void;
}) {
  const { locale, t } = useLocale();
  const rules = config.tournament;
  const requiresBirthDate =
    rules.requireMemberFullInfo ||
    rules.minAge !== null ||
    rules.maxAge !== null;
  const requiresGender =
    rules.requireMemberFullInfo || Boolean(rules.allowedGenders?.length);
  const showsPosition =
    config.game.positionMode !== "NONE" && config.game.positions.length > 0;
  const genderOptions = rules.allowedGenders?.length
    ? GENDER_OPTIONS.filter((option) => rules.allowedGenders?.includes(option))
    : GENDER_OPTIONS;

  const updateMember = (
    index: number,
    field: keyof MemberForm,
    value: string,
  ) => {
    onChange(
      members.map((member, memberIndex) =>
        memberIndex === index ? { ...member, [field]: value } : member,
      ),
    );
  };

  return (
    <RegistrationFormSection
      icon={<UsersThreeIcon size={21} weight="duotone" />}
      title={t("team.register.memberList")}
      description={`${t("team.register.rosterRequirement")}: ${rules.minTeamSize} - ${rules.maxTeamSize} ${t("team.register.rosterRangeSuffix")}`}
      action={
        members.length < rules.maxTeamSize ? (
          <button
            type="button"
            onClick={() => onChange([...members, emptyMember("SUBSTITUTE")])}
            className={`${secondaryButtonClass} shrink-0 px-3 py-2 text-xs`}
          >
            <PlusIcon size={14} weight="bold" />
            {t("team.register.addMember")}
          </button>
        ) : (
          <span className="shrink-0 border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink-muted">
            {t("team.register.full")} {rules.maxTeamSize}{" "}
            {t("team.register.rosterRangeSuffix")}
          </span>
        )
      }
    >
      <div className="space-y-4 p-5 sm:p-6">
        {members.map((member, index) => (
          <article
            key={index}
            className="border border-line bg-surface-sub/55"
          >
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center bg-accent text-xs font-black text-on-accent">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-ink">
                    {index === 0
                      ? t("team.register.captain")
                      : `${t("team.register.member")} ${index + 1}`}
                  </h3>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {t("team.register.memberDetails")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="border border-line bg-surface px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                  {t(
                    `registration.role.${member.memberRole}` as TranslationKey,
                  )}
                </span>
                {index > 0 && members.length > rules.minTeamSize && (
                  <button
                    type="button"
                    onClick={() =>
                      onChange(
                        members.filter(
                          (_, memberIndex) => memberIndex !== index,
                        ),
                      )
                    }
                    aria-label={`${t("team.register.removeMember")} ${index + 1}`}
                    className="p-2 text-ink-faint transition-colors hover:bg-rejected/10 hover:text-rejected focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
                  >
                    <TrashIcon size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
              <label className={labelClass}>
                {t("team.register.realName")}
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={member.realName}
                  onChange={(event) =>
                    updateMember(index, "realName", event.target.value)
                  }
                  className={`${inputClass} mt-1 bg-surface`}
                />
              </label>
              <label className={labelClass}>
                {t("team.register.ign")}
                <input
                  type="text"
                  required
                  maxLength={30}
                  value={member.ign}
                  onChange={(event) =>
                    updateMember(index, "ign", event.target.value)
                  }
                  className={`${inputClass} mt-1 bg-surface`}
                />
              </label>
              <label className={labelClass}>
                {t("team.register.contactEmail")}
                <input
                  type="email"
                  value={member.email}
                  onChange={(event) =>
                    updateMember(index, "email", event.target.value)
                  }
                  className={`${inputClass} mt-1 bg-surface`}
                />
              </label>
              <label className={labelClass}>
                {t("team.register.contactPhone")}
                <input
                  type="tel"
                  maxLength={20}
                  value={member.phoneNumber}
                  onChange={(event) =>
                    updateMember(index, "phoneNumber", event.target.value)
                  }
                  className={`${inputClass} mt-1 bg-surface`}
                />
              </label>

              {requiresBirthDate && (
                <label className={labelClass}>
                  {t("team.register.birthDateAria")}
                  <input
                    type="date"
                    required
                    value={member.birthDate}
                    onChange={(event) =>
                      updateMember(index, "birthDate", event.target.value)
                    }
                    className={`${inputClass} mt-1 bg-surface`}
                  />
                </label>
              )}

              {requiresGender && (
                <label className={labelClass}>
                  {t("team.register.genderAria")}
                  <select
                    required
                    value={member.gender}
                    onChange={(event) =>
                      updateMember(index, "gender", event.target.value)
                    }
                    className={`${inputClass} mt-1 bg-surface`}
                  >
                    <option value="">{t("team.register.selectGender")}</option>
                    {genderOptions.map((option) => (
                      <option key={option} value={option}>
                        {t(
                          `auth.register.gender.${option.toLowerCase()}` as TranslationKey,
                        )}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {showsPosition && (
                <label className={labelClass}>
                  {t("team.register.positionAria")}
                  <select
                    required={
                      config.game.positionMode === "FIXED" &&
                      member.memberRole !== "SUBSTITUTE"
                    }
                    value={member.position}
                    onChange={(event) =>
                      updateMember(index, "position", event.target.value)
                    }
                    className={`${inputClass} mt-1 bg-surface`}
                  >
                    <option value="">
                      {config.game.positionMode === "FIXED" &&
                      member.memberRole !== "SUBSTITUTE"
                        ? t("team.register.selectPosition")
                        : t("team.register.noPosition")}
                    </option>
                    {config.game.positions.map((position) => {
                      const usedByOtherActive = members.some(
                        (other, otherIndex) =>
                          otherIndex !== index &&
                          other.memberRole !== "SUBSTITUTE" &&
                          other.position === position,
                      );
                      return (
                        <option
                          key={position}
                          value={position}
                          disabled={
                            config.game.positionMode === "FIXED" &&
                            member.memberRole !== "SUBSTITUTE" &&
                            usedByOtherActive
                          }
                        >
                          {gamePositionLabel(position, locale)}
                        </option>
                      );
                    })}
                  </select>
                </label>
              )}

              <p className={`${hintClass} sm:col-span-2`}>
                {t("team.register.optionalContacts")}
              </p>
            </div>
          </article>
        ))}
      </div>
    </RegistrationFormSection>
  );
}
