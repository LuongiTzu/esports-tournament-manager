"use client";

import { use, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeftIcon,
  CalendarBlankIcon,
  EnvelopeSimpleIcon,
  GameControllerIcon,
  PhoneIcon,
  PlusIcon,
  ShieldCheckIcon,
  TrashIcon,
  UserCircleIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import ImageUploadPicker from "@/components/ImageUploadPicker";
import ResolvedImage from "@/components/ResolvedImage";
import {
  alertErrorClass,
  hintClass,
  inputClass,
  labelClass,
  secondaryButtonClass,
} from "@/components/ui";
import { useAuth } from "@/features/auth/store";
import EmailVerificationNotice from "@/features/auth/components/EmailVerificationNotice";
import { isEmailNotVerifiedError } from "@/features/auth/email-verification";
import { accentVars } from "@/features/games/game-accent";
import { gamePositionLabel } from "@/features/games/position-labels";
import { formatLocalizedDate } from "@/features/locale/format";
import { useLocale, type TranslationKey } from "@/features/locale/store";
import { teamsApi } from "@/features/teams/api";
import type {
  Gender,
  MemberRole,
  TeamRegistrationForm,
} from "@/features/teams/types";
import { getTournamentBannerUrl } from "@/features/tournaments/banner";
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

function FormSection({
  icon,
  title,
  description,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border border-line bg-surface-card/95 shadow-[0_14px_36px_rgb(0_0_0/0.1)]">
      <div className="flex flex-col gap-4 border-b border-line bg-surface-sub/45 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center border border-accent/25 bg-accent/10 text-accent">
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="font-bold text-ink">{title}</h2>
            {description && (
              <p className="mt-1 text-sm leading-5 text-ink-muted">
                {description}
              </p>
            )}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Requirement({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-l-2 border-accent/45 pl-3">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

export default function RegisterTeamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, ready } = useAuth();
  const { locale, t } = useLocale();
  const invitationToken = searchParams.get("invitation")?.trim() ?? "";
  const manualMode = searchParams.get("mode") === "manual";

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
      const returnTo = `/tournaments/${slug}/register-team${
        invitationToken
          ? `?invitation=${encodeURIComponent(invitationToken)}`
          : manualMode
            ? "?mode=manual"
            : ""
      }`;
      router.push(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }

    let cancelled = false;
    const formRequest = invitationToken
      ? teamsApi.getInvitationRegistrationForm(invitationToken)
      : manualMode
        ? teamsApi.getManualRegistrationForm(slug)
        : teamsApi.getRegistrationForm(slug);
    formRequest
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
      .catch((reason: unknown) => {
        if (cancelled) return;
        setLoadError(
          reason instanceof Error
            ? reason.message
            : t("team.register.loadError"),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, invitationToken, manualMode, ready, user, router, t]);

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
      const registration = {
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
      };
      const team = invitationToken
        ? await teamsApi.acceptTeamInvitation(invitationToken, registration)
        : manualMode
          ? await teamsApi.addManual(slug, registration)
          : await teamsApi.register(slug, registration);

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

      router.push(
        manualMode
          ? `/tournaments/${slug}/manage#registrations`
          : `/tournaments/${slug}`,
      );
    } catch (reason: unknown) {
      if (isEmailNotVerifiedError(reason)) {
        setError(t("emailVerification.required"));
        return;
      }
      setError(
        reason instanceof ApiError && reason.errors?.length
          ? reason.errors.map((item) => item.message).join("; ")
          : reason instanceof Error
            ? reason.message
            : t("team.register.submitError"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (ready && user?.emailVerifiedAt === null) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 items-center px-4 py-16">
        <EmailVerificationNotice email={user.email} className="w-full" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="tournament-detail-page w-full flex-1 px-4 py-12">
        <div className="mx-auto w-full max-w-7xl animate-pulse space-y-5">
          <div className="aspect-[16/5] min-h-56 bg-surface-card" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="h-96 bg-surface-card" />
            <div className="h-72 bg-surface-card" />
          </div>
        </div>
      </div>
    );
  }

  if (loadError || !config) {
    return (
      <div className="tournament-detail-page flex w-full flex-1 items-center px-4 py-16">
        <div className="mx-auto w-full max-w-2xl text-center">
          <p className={alertErrorClass}>
            {loadError || t("team.register.notFound")}
          </p>
          <Link
            href="/tournaments"
            className="mt-4 inline-block text-sm text-brand hover:underline"
          >
            {t("tournament.detail.backToList")}
          </Link>
        </div>
      </div>
    );
  }

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
  const bannerUrl = getTournamentBannerUrl(
    null,
    config.game.name,
    config.game.code,
  );
  const rosterProgress = Math.min(
    100,
    Math.round((members.length / rules.maxTeamSize) * 100),
  );

  const retryLogoUpload = async () => {
    if (!registeredTeam || !logoFile) return;
    setSubmitting(true);
    try {
      await teamsApi.uploadLogo(registeredTeam.id, logoFile);
      router.push(
        manualMode
          ? `/tournaments/${slug}/manage#registrations`
          : `/tournaments/${slug}`,
      );
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
      <div
        style={accentVars(config.game.name)}
        className="team-register-page tournament-detail-page flex w-full flex-1 items-center px-4 py-16"
      >
        <section className="mx-auto w-full max-w-2xl border border-approved/30 bg-surface-card p-6 shadow-[var(--shadow-elevated)] sm:p-8">
          <h1 className="text-xl font-bold text-ink">
            {t("team.register.createdPrefix")} {registeredTeam.name}{" "}
            {t("team.register.createdSuffix")}
          </h1>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            {t("team.register.partialUploadPrefix")}{" "}
            {registeredTeam.uploadError}{" "}
            {t("team.register.partialUploadSuffix")}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={retryLogoUpload}
              className="inline-flex min-h-[var(--control-height)] items-center justify-center bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent disabled:opacity-50"
            >
              {submitting
                ? t("team.register.retryingLogo")
                : t("team.register.retryLogo")}
            </button>
            <Link
              href={`/tournaments/${slug}`}
              className={secondaryButtonClass}
            >
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
      className="team-register-page tournament-detail-page w-full flex-1 pb-16"
    >
      <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <Link
          href={
            manualMode
              ? `/tournaments/${slug}/manage#registrations`
              : `/tournaments/${slug}`
          }
          className="inline-flex items-center gap-2 text-sm text-ink-muted transition hover:text-ink"
        >
          <ArrowLeftIcon size={16} />
          {rules.name}
        </Link>
      </div>

      <div className="mx-auto mt-5 w-full max-w-[100rem] px-0 sm:px-4">
        <header className="overflow-hidden border-y border-line bg-surface-card sm:border-x">
          <div className="relative aspect-[16/5] min-h-56 overflow-hidden bg-surface-sub sm:min-h-64">
            <ResolvedImage
              src={bannerUrl}
              alt=""
              className="absolute inset-0 size-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/45 to-slate-950/20" />
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-surface-card/95 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 px-5 pb-6 sm:px-8 sm:pb-8 lg:px-10">
              <div className="flex items-center gap-3 text-accent">
                <span className="grid size-10 place-items-center border border-white/15 bg-slate-950/50 backdrop-blur-md">
                  <GameControllerIcon size={22} weight="duotone" />
                </span>
                <span className="text-sm font-bold">
                  {rules.displayGameName}
                </span>
              </div>
              <h1 className="mt-4 max-w-4xl text-2xl font-black leading-tight tracking-tight text-white drop-shadow-lg sm:text-4xl">
                {rules.name}
              </h1>
            </div>
          </div>

          <div className="grid gap-6 border-t border-line px-5 py-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:px-10">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
                {t("team.register.teamInfo")}
              </p>
              <h2 className="mt-2 text-2xl font-black text-ink sm:text-3xl">
                {manualMode
                  ? t("team.register.manualTitle")
                  : invitationToken
                    ? t("team.register.invitedTitle")
                    : t("team.register.title")}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
                {t("team.register.subtitle")}
              </p>
            </div>

            <dl className="grid min-w-0 grid-cols-3 divide-x divide-line border border-line bg-surface-sub/55 sm:min-w-[27rem]">
              <div className="px-3 py-4 text-center sm:px-5">
                <dt className="text-[11px] text-ink-faint">
                  {t("team.register.activePlayers")}
                </dt>
                <dd className="mt-1 font-mono text-lg font-bold text-ink">
                  {rules.minTeamSize}v{rules.minTeamSize}
                </dd>
              </div>
              <div className="px-3 py-4 text-center sm:px-5">
                <dt className="text-[11px] text-ink-faint">
                  {t("team.register.rosterLimit")}
                </dt>
                <dd className="mt-1 font-mono text-lg font-bold text-ink">
                  {rules.maxTeamSize}
                </dd>
              </div>
              <div className="px-3 py-4 text-center sm:px-5">
                <dt className="text-[11px] text-ink-faint">
                  {t("team.register.availableSubstitutes")}
                </dt>
                <dd className="mt-1 font-mono text-lg font-bold text-ink">
                  {rules.maxSubstitutes}
                </dd>
              </div>
            </dl>
          </div>
        </header>
      </div>

      {!config.canRegister ? (
        <section className="mx-auto mt-8 w-[calc(100%_-_2rem)] max-w-3xl border border-line bg-surface-card px-6 py-12 text-center shadow-[0_14px_36px_rgb(0_0_0/0.1)]">
          <ShieldCheckIcon
            size={34}
            weight="duotone"
            className="mx-auto text-ink-faint"
          />
          <h2 className="mt-4 font-bold text-ink">
            {t("team.register.unavailable")}
          </h2>
          <p className="mt-2 text-sm text-ink-muted">{config.reason}</p>
          <Link
            href={`/tournaments/${slug}`}
            className={`${secondaryButtonClass} mt-5`}
          >
            {t("team.register.back")}
          </Link>
        </section>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mx-auto mt-8 grid w-full max-w-7xl items-start gap-7 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:px-8"
        >
          <main className="min-w-0 space-y-7">
            <FormSection
              icon={<UserCircleIcon size={21} weight="duotone" />}
              title={t("team.register.teamInfo")}
              description={t("team.register.subtitle")}
            >
              <div className="grid gap-7 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
                <div className="space-y-5">
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

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="contactName" className={labelClass}>
                        {t("team.register.representative")}{" "}
                        <span className="text-rejected">*</span>
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
                        {t("team.register.representativeEmail")}{" "}
                        <span className="text-rejected">*</span>
                      </label>
                      <input
                        id="contactEmail"
                        type="email"
                        required
                        value={contactEmail}
                        onChange={(event) =>
                          setContactEmail(event.target.value)
                        }
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

                <div className="border-t border-line pt-6 xl:border-l xl:border-t-0 xl:pl-7 xl:pt-0">
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
                  <p className={hintClass}>{t("team.register.logoUrlHint")}</p>
                  <div className="mt-5">
                    <ImageUploadPicker
                      label={t("team.register.deviceLogo")}
                      file={logoFile}
                      onFileChange={setLogoFile}
                      existingUrl={logoUrl}
                      variant="square"
                      disabled={submitting}
                      uploading={submitting && Boolean(logoFile)}
                    />
                  </div>
                </div>
              </div>
            </FormSection>

            <FormSection
              icon={<UsersThreeIcon size={21} weight="duotone" />}
              title={t("team.register.memberList")}
              description={`${t("team.register.rosterRequirement")}: ${rules.minTeamSize} - ${rules.maxTeamSize} ${t("team.register.rosterRangeSuffix")}`}
              action={
                members.length < rules.maxTeamSize ? (
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
                              setMembers((current) =>
                                current.filter(
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
                            updateMember(
                              index,
                              "phoneNumber",
                              event.target.value,
                            )
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
                              updateMember(
                                index,
                                "birthDate",
                                event.target.value,
                              )
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
                            <option value="">
                              {t("team.register.selectGender")}
                            </option>
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
                              updateMember(
                                index,
                                "position",
                                event.target.value,
                              )
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
            </FormSection>
          </main>

          <aside className="space-y-5 lg:sticky lg:top-24">
            <section className="border border-line bg-surface-card/95 shadow-[0_14px_36px_rgb(0_0_0/0.12)]">
              <div className="flex items-center gap-3 border-b border-line px-5 py-4">
                <span className="grid size-9 place-items-center border border-accent/25 bg-accent/10 text-accent">
                  <ShieldCheckIcon size={20} weight="duotone" />
                </span>
                <div>
                  <h2 className="font-bold text-ink">
                    {t("team.register.requirements")}
                  </h2>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {t("team.register.requirementsHint")}
                  </p>
                </div>
              </div>

              <div className="p-5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-ink-muted">
                    {t("team.register.memberList")}
                  </span>
                  <span className="font-mono font-bold text-accent">
                    {members.length}/{rules.maxTeamSize}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden bg-surface-sub">
                  <div
                    className="h-full bg-accent transition-[width] duration-300"
                    style={{ width: `${rosterProgress}%` }}
                  />
                </div>

                <dl className="mt-6 space-y-5 border-t border-line pt-5">
                  {rules.registrationDeadline && (
                    <Requirement
                      label={t("tournament.detail.registrationDeadline")}
                      value={formatLocalizedDate(
                        rules.registrationDeadline,
                        locale,
                        {
                          dateStyle: "medium",
                          timeStyle: "short",
                        },
                      )}
                    />
                  )}
                  <Requirement
                    label={t("team.register.activePlayers")}
                    value={`${rules.minTeamSize}v${rules.minTeamSize}`}
                  />
                  <Requirement
                    label={t("team.register.rosterLimit")}
                    value={`${rules.minTeamSize} - ${rules.maxTeamSize}`}
                  />
                  <Requirement
                    label={t("team.register.availableSubstitutes")}
                    value={rules.maxSubstitutes}
                  />
                  {rules.minAge !== null && (
                    <Requirement
                      label={t("tournament.create.minAge")}
                      value={rules.minAge}
                    />
                  )}
                  {rules.maxAge !== null && (
                    <Requirement
                      label={t("tournament.create.maxAge")}
                      value={rules.maxAge}
                    />
                  )}
                  {rules.allowedGenders?.length ? (
                    <Requirement
                      label={t("tournament.create.allowedGenders")}
                      value={rules.allowedGenders
                        .map((gender) =>
                          t(
                            `auth.register.gender.${gender.toLowerCase()}` as TranslationKey,
                          ),
                        )
                        .join(", ")}
                    />
                  ) : null}
                </dl>

                <div className="mt-6 border border-accent/25 bg-accent/10 p-4 text-xs leading-5 text-ink-muted">
                  {t("team.register.reviewNotice")}
                </div>

                <div className="mt-5 space-y-2 border-t border-line pt-5 text-xs text-ink-muted">
                  {rules.registrationDeadline && (
                    <p className="flex items-center gap-2">
                      <CalendarBlankIcon
                        size={15}
                        className="shrink-0 text-accent"
                      />
                      {formatLocalizedDate(rules.registrationDeadline, locale, {
                        dateStyle: "medium",
                      })}
                    </p>
                  )}
                  {contactEmail && (
                    <p className="flex min-w-0 items-center gap-2">
                      <EnvelopeSimpleIcon
                        size={15}
                        className="shrink-0 text-accent"
                      />
                      <span className="truncate">{contactEmail}</span>
                    </p>
                  )}
                  {contactPhone && (
                    <p className="flex items-center gap-2">
                      <PhoneIcon size={15} className="shrink-0 text-accent" />
                      {contactPhone}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {error && (
              <p role="alert" className={alertErrorClass}>
                {error}
              </p>
            )}

            <div className="grid gap-3 border border-line bg-surface-card/95 p-4 shadow-[var(--shadow-elevated)]">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-[var(--control-height)] items-center justify-center bg-accent px-6 py-3 text-sm font-bold text-on-accent transition-[transform,filter] hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting
                  ? t("team.register.submitting")
                  : manualMode
                    ? t("team.register.manualSubmit")
                    : t("team.register.submit")}
              </button>
              <Link
                href={
                  manualMode
                    ? `/tournaments/${slug}/manage#registrations`
                    : `/tournaments/${slug}`
                }
                className={secondaryButtonClass}
              >
                {t("common.cancel")}
              </Link>
            </div>
          </aside>
        </form>
      )}
    </div>
  );
}
