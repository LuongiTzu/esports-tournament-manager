"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import ImageUploadPicker from "@/components/ImageUploadPicker";
import { useAuth } from "@/features/auth/store";
import { accentVars } from "@/features/games/game-accent";
import { gamePositionLabel } from "@/features/games/position-labels";
import { teamsApi } from "@/features/teams/api";
import type { Gender, TeamRegistrationForm } from "@/features/teams/types";
import type { MemberRole } from "@/features/teams/types";
import {
  alertErrorClass,
  hintClass,
  inputClass,
  labelClass,
  secondaryButtonClass,
} from "@/components/ui";
import { useLocale, type TranslationKey } from "@/features/locale/store";
import { ApiError } from "@/lib/api/client";

interface MemberForm {
  realName: string;
  ign: string;
  email: string;
  phoneNumber: string;
  birthDate: string;
  gender: "" | Gender;
  position: string;
  memberRole: Extract<MemberRole, "CAPTAIN" | "PLAYER" | "SUBSTITUTE">;
}

const GENDER_OPTIONS: Gender[] = ["MALE", "FEMALE", "OTHER"];

function emptyMember(
  memberRole: MemberForm["memberRole"] = "SUBSTITUTE",
): MemberForm {
  return {
    realName: "",
    ign: "",
    email: "",
    phoneNumber: "",
    birthDate: "",
    gender: "",
    position: "",
    memberRole,
  };
}

function toDateInput(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function initialMembers(config: TeamRegistrationForm): MemberForm[] {
  const captain = config.prefill.captainMember;
  const firstMember: MemberForm = {
    ...emptyMember("CAPTAIN"),
    realName: captain.realName,
    email: captain.email,
    phoneNumber: captain.phoneNumber ?? "",
    birthDate: toDateInput(captain.birthDate),
    gender: captain.gender ?? "",
  };

  return Array.from({ length: config.tournament.minTeamSize }, (_, index) =>
    index === 0 ? firstMember : emptyMember("PLAYER"),
  );
}

export default function RegisterTeamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const { user, ready } = useAuth();
  const { locale, t } = useLocale();

  const [config, setConfig] = useState<TeamRegistrationForm | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [members, setMembers] = useState<MemberForm[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [registeredTeam, setRegisteredTeam] = useState<{
    id: string;
    name: string;
    uploadError: string;
  } | null>(null);
  const initializedSlug = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.push("/login");
      return;
    }

    let cancelled = false;
    teamsApi
      .getRegistrationForm(slug)
      .then((data) => {
        if (cancelled) return;
        setConfig(data);
        if (initializedSlug.current !== slug) {
          setContactName(data.prefill.contactName);
          setContactEmail(data.prefill.contactEmail);
          setContactPhone(data.prefill.contactPhone ?? "");
          setMembers(initialMembers(data));
          initializedSlug.current = slug;
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(
          err instanceof Error ? err.message : t("team.register.loadError"),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, ready, user, router, t]);

  const updateMember = (
    index: number,
    field: keyof MemberForm,
    value: string,
  ) => {
    setMembers((current) =>
      current.map((member, memberIndex) =>
        memberIndex === index ? { ...member, [field]: value } : member,
      ),
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!config?.canRegister) return;
    setError("");

    if (!contactName.trim()) {
      setError(t("team.register.contactNameRequired"));
      return;
    }
    if (!contactEmail.trim()) {
      setError(t("team.register.contactEmailRequired"));
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(contactEmail.trim())) {
      setError(t("team.register.contactEmailInvalid"));
      return;
    }
    if (!contactPhone.trim()) {
      setError(t("team.register.contactPhoneRequired"));
      return;
    }
    const activeMembers = members.filter(
      (member) =>
        member.memberRole === "CAPTAIN" || member.memberRole === "PLAYER",
    );
    const captains = members.filter(
      (member) => member.memberRole === "CAPTAIN",
    );
    if (activeMembers.length !== config.tournament.minTeamSize) {
      setError(
        `${t("team.register.activeCountRequired")} ${config.tournament.minTeamSize}.`,
      );
      return;
    }
    if (members.length > config.tournament.maxTeamSize) {
      setError(t("team.register.rosterTooLarge"));
      return;
    }
    if (captains.length !== 1) {
      setError(t("team.register.captainCountRequired"));
      return;
    }
    if (
      config.game.positionMode === "FIXED" &&
      activeMembers.some((member) => !member.position)
    ) {
      setError(t("team.register.positionRequired"));
      return;
    }
    if (config.game.positionMode === "FIXED") {
      const activePositions = activeMembers.map((member) => member.position);
      if (new Set(activePositions).size !== activePositions.length) {
        setError(t("team.register.activePositionsUnique"));
        return;
      }
    }

    setSubmitting(true);
    try {
      const team = await teamsApi.register(slug, {
        name: name.trim(),
        logoUrl: logoUrl.trim() || undefined,
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
        members: members.map((member, index) => ({
          realName: member.realName.trim(),
          ign: member.ign.trim(),
          email: member.email.trim() || undefined,
          phoneNumber: member.phoneNumber.trim() || undefined,
          birthDate: member.birthDate || undefined,
          gender: member.gender || undefined,
          position:
            config.game.positionMode === "NONE"
              ? undefined
              : member.position || undefined,
          memberRole: member.memberRole,
          orderIndex: index,
        })),
      });
      if (logoFile) {
        try {
          await teamsApi.uploadLogo(team.id, logoFile);
        } catch (uploadError) {
          setRegisteredTeam({
            id: team.id,
            name: team.name,
            uploadError:
              uploadError instanceof Error
                ? uploadError.message
                : t("team.register.logoUploadError"),
          });
          return;
        }
      }
      router.push(`/tournaments/${slug}`);
    } catch (err) {
      setError(
        err instanceof ApiError && err.errors?.length
          ? err.errors.map((item) => item.message).join(" · ")
          : err instanceof Error
            ? err.message
            : t("team.register.submitError"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-16">
        <div aria-hidden className="space-y-4">
          <div className="h-8 w-1/2 rounded bg-surface-card" />
          <div className="h-48 rounded-xl bg-surface-card" />
        </div>
      </div>
    );
  }

  if (loadError || !config) {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 text-center">
        <p className={alertErrorClass}>
          {loadError || t("team.register.notFound")}
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-brand hover:underline">
          {t("tournament.detail.backToList")}
        </Link>
      </div>
    );
  }

  const rules = config.tournament;
  const requiresBirthDate =
    rules.requireMemberFullInfo || rules.minAge !== null || rules.maxAge !== null;
  const requiresGender =
    rules.requireMemberFullInfo || Boolean(rules.allowedGenders?.length);
  const showsPosition =
    config.game.positionMode !== "NONE" && config.game.positions.length > 0;
  const genderOptions = rules.allowedGenders?.length
    ? GENDER_OPTIONS.filter((option) => rules.allowedGenders?.includes(option))
    : GENDER_OPTIONS;

  const retryLogoUpload = async () => {
    if (!registeredTeam || !logoFile) return;
    setSubmitting(true);
    try {
      await teamsApi.uploadLogo(registeredTeam.id, logoFile);
      router.push(`/tournaments/${slug}`);
    } catch (uploadError) {
      setRegisteredTeam((current) =>
        current
          ? {
              ...current,
              uploadError:
                uploadError instanceof Error
                  ? uploadError.message
                : t("team.register.logoUploadError"),
            }
          : current,
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (registeredTeam) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 items-center px-4 py-16">
        <section className="w-full rounded-2xl border border-approved/30 bg-surface-card p-6 shadow-[var(--shadow-elevated)] sm:p-8">
          <h1 className="text-xl font-bold text-ink">
            {t("team.register.createdPrefix")} {registeredTeam.name} {t("team.register.createdSuffix")}
          </h1>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            {t("team.register.partialUploadPrefix")} {registeredTeam.uploadError}{" "}
            {t("team.register.partialUploadSuffix")}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={retryLogoUpload}
              className="inline-flex rounded-lg bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-on-brand disabled:opacity-50"
            >
              {submitting ? t("team.register.retryingLogo") : t("team.register.retryLogo")}
            </button>
            <Link href={`/tournaments/${slug}`} className={secondaryButtonClass}>
              {t("team.register.goToTournament")}
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div
      style={accentVars(config.game.name)}
      className="mx-auto w-full max-w-2xl flex-1 px-4 py-10"
    >
      <Link
        href={`/tournaments/${slug}`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition hover:text-ink"
      >
        <ArrowLeftIcon size={16} />
        {rules.name}
      </Link>

      <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
        {t("team.register.title")}
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        {t("team.register.subtitle")}
      </p>
      <p className="mt-2 text-sm font-medium text-brand">
        {rules.displayGameName} · {rules.minTeamSize}v{rules.minTeamSize}
      </p>

      {!config.canRegister ? (
        <div className="mt-8 rounded-xl border border-line bg-surface-card px-6 py-12 text-center">
          <p className="font-medium text-ink">{t("team.register.unavailable")}</p>
          <p className="mt-2 text-sm text-ink-muted">{config.reason}</p>
          <Link
            href={`/tournaments/${slug}`}
            className={`${secondaryButtonClass} mt-5`}
          >
            {t("team.register.back")}
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <section className="rounded-xl border border-line bg-surface-card p-6">
            <h2 className="font-semibold text-ink">{t("team.register.teamInfo")}</h2>

            <div className="mt-5 space-y-5">
              <div>
                <label htmlFor="teamName" className={labelClass}>
                  {t("team.register.teamName")}
                </label>
                <input
                  id="teamName"
                  type="text"
                  required
                  maxLength={50}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className={inputClass}
                  placeholder={t("team.register.teamNamePlaceholder")}
                />
              </div>

              <div>
                <label htmlFor="logoUrl" className={labelClass}>
                  {t("team.register.logoUrl")}
                </label>
                <input
                  id="logoUrl"
                  type="url"
                  maxLength={500}
                  value={logoUrl}
                  onChange={(event) => setLogoUrl(event.target.value)}
                  className={inputClass}
                  placeholder="https://..."
                />
                <p className={hintClass}>
                  {t("team.register.logoUrlHint")}
                </p>
              </div>

              <ImageUploadPicker
                label={t("team.register.deviceLogo")}
                file={logoFile}
                onFileChange={setLogoFile}
                existingUrl={logoUrl}
                variant="square"
                disabled={submitting}
                uploading={submitting && Boolean(logoFile)}
              />

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="contactName" className={labelClass}>
                    {t("team.register.representative")} <span className="text-rejected">*</span>
                  </label>
                  <input
                    id="contactName"
                    type="text"
                    required
                    maxLength={100}
                    value={contactName}
                    onChange={(event) => setContactName(event.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="contactEmail" className={labelClass}>
                    {t("team.register.representativeEmail")} <span className="text-rejected">*</span>
                  </label>
                  <input
                    id="contactEmail"
                    type="email"
                    required
                    value={contactEmail}
                    onChange={(event) => setContactEmail(event.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="contactPhone" className={labelClass}>
                  {t("team.register.representativePhone")}{" "}
                  <span className="text-rejected">*</span>
                </label>
                <input
                  id="contactPhone"
                  type="tel"
                  required
                  maxLength={20}
                  value={contactPhone}
                  onChange={(event) => setContactPhone(event.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-line bg-surface-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-ink">{t("team.register.memberList")}</h2>
                <p className="mt-1 text-sm text-ink-muted">
                  {t("team.register.rosterRequirement")}: {rules.minTeamSize}–{rules.maxTeamSize}{" "}
                  {t("team.register.rosterRangeSuffix")}
                </p>
                <p className="mt-1 text-sm text-ink-muted">
                  {rules.minTeamSize} {t("team.register.starters")} • {t("team.register.maxSubstitutes")}{" "}
                  {rules.maxSubstitutes} {t("team.register.substitutes")}
                </p>
              </div>
              {members.length < rules.maxTeamSize && (
                <button
                  type="button"
                  onClick={() =>
                    setMembers((current) => [
                      ...current,
                      emptyMember("SUBSTITUTE"),
                    ])
                  }
                  className={`${secondaryButtonClass} shrink-0 px-3 py-2 text-xs`}
                >
                  <PlusIcon size={14} weight="bold" />
                  {t("team.register.addMember")}
                </button>
              )}
              {members.length === rules.maxTeamSize && (
                <span className="shrink-0 text-xs font-medium text-ink-faint">
                  {t("team.register.full")} {rules.maxTeamSize} {t("team.register.rosterRangeSuffix")}
                </span>
              )}
            </div>

            <div className="mt-5 space-y-4">
              {members.map((member, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-line bg-surface-sub p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-ink">
                      {index === 0 ? t("team.register.captain") : `${t("team.register.member")} ${index + 1}`}
                    </p>
                    <span className="rounded-full border border-line bg-surface px-2.5 py-1 text-[10px] font-semibold uppercase text-ink-muted">
                      {t(
                        `registration.role.${member.memberRole}` as TranslationKey,
                      )}
                    </span>
                    {index > 0 && members.length > rules.minTeamSize && (
                      <button
                        type="button"
                        onClick={() =>
                          setMembers((current) =>
                            current.filter((_, memberIndex) => memberIndex !== index),
                          )
                        }
                        aria-label={`${t("team.register.removeMember")} ${index + 1}`}
                        className="rounded-lg p-2 text-ink-faint transition hover:bg-rejected/10 hover:text-rejected"
                      >
                        <TrashIcon size={16} />
                      </button>
                    )}
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      required
                      maxLength={100}
                      value={member.realName}
                      onChange={(event) =>
                        updateMember(index, "realName", event.target.value)
                      }
                      aria-label={`${t("team.register.realNameAria")} ${index + 1}`}
                      className={`${inputClass} bg-surface`}
                      placeholder={t("team.register.realName")}
                    />
                    <input
                      type="text"
                      required
                      maxLength={30}
                      value={member.ign}
                      onChange={(event) =>
                        updateMember(index, "ign", event.target.value)
                      }
                      aria-label={`${t("team.register.ignAria")} ${index + 1}`}
                      className={`${inputClass} bg-surface`}
                      placeholder={t("team.register.ign")}
                    />
                    <input
                      type="email"
                      value={member.email}
                      onChange={(event) =>
                        updateMember(index, "email", event.target.value)
                      }
                      aria-label={`${t("team.register.memberEmailAria")} ${index + 1}`}
                      className={`${inputClass} bg-surface`}
                      placeholder={t("team.register.contactEmail")}
                    />
                    <input
                      type="tel"
                      maxLength={20}
                      value={member.phoneNumber}
                      onChange={(event) =>
                        updateMember(index, "phoneNumber", event.target.value)
                      }
                      aria-label={`${t("team.register.memberPhoneAria")} ${index + 1}`}
                      className={`${inputClass} bg-surface`}
                      placeholder={t("team.register.contactPhone")}
                    />

                    {requiresBirthDate && (
                      <input
                        type="date"
                        required
                        value={member.birthDate}
                        onChange={(event) =>
                          updateMember(index, "birthDate", event.target.value)
                        }
                        aria-label={`${t("team.register.birthDateAria")} ${index + 1}`}
                        className={`${inputClass} bg-surface`}
                      />
                    )}

                    {requiresGender && (
                      <select
                        required
                        value={member.gender}
                        onChange={(event) =>
                          updateMember(index, "gender", event.target.value)
                        }
                        aria-label={`${t("team.register.genderAria")} ${index + 1}`}
                        className={`${inputClass} bg-surface`}
                      >
                        <option value="">{t("team.register.selectGender")}</option>
                        {genderOptions.map((option) => (
                          <option key={option} value={option}>
                            {t(`auth.register.gender.${option.toLowerCase()}` as TranslationKey)}
                          </option>
                        ))}
                      </select>
                    )}

                    {showsPosition && (
                      <select
                        required={
                          config.game.positionMode === "FIXED" &&
                          member.memberRole !== "SUBSTITUTE"
                        }
                        value={member.position}
                        onChange={(event) =>
                          updateMember(index, "position", event.target.value)
                        }
                        aria-label={`${t("team.register.positionAria")} ${index + 1}`}
                        className={`${inputClass} bg-surface`}
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
                    )}
                  </div>

                  <p className={`${hintClass} mt-3`}>
                    {t("team.register.optionalContacts")}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {error && (
            <p role="alert" className={alertErrorClass}>
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <Link href={`/tournaments/${slug}`} className={secondaryButtonClass}>
              {t("common.cancel")}
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent transition hover:opacity-90 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? t("team.register.submitting") : t("team.register.submit")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
