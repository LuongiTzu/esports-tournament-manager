"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircleIcon,
  CircleNotchIcon,
  NotePencilIcon,
  PlusIcon,
  TrashIcon,
  UsersThreeIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import ImageUploadPicker from "@/components/ImageUploadPicker";
import {
  alertErrorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import type { User } from "@/features/auth/types";
import { gamePositionLabel } from "@/features/games/position-labels";
import { useLocale, type TranslationKey } from "@/features/locale/store";
import { teamsApi } from "@/features/teams/api";
import type {
  Gender,
  MemberRole,
  TeamDetail,
  TeamMember,
  TeamMemberRegistration,
} from "@/features/teams/types";
import { tournamentsApi } from "@/features/tournaments/api";
import type { TournamentDetail } from "@/features/tournaments/types";
import { ApiError } from "@/lib/api/client";

type EditorMode = { kind: "add" } | { kind: "edit"; member: TeamMember };

interface MemberFormState {
  realName: string;
  ign: string;
  inGameId: string;
  birthDate: string;
  gender: "" | Gender;
  email: string;
  phoneNumber: string;
  position: string;
  memberRole: Exclude<MemberRole, "CAPTAIN"> | "CAPTAIN";
}

const GENDERS: Gender[] = ["MALE", "FEMALE", "OTHER"];
const MEMBER_ROLES: Array<Exclude<MemberRole, "CAPTAIN">> = [
  "PLAYER",
  "SUBSTITUTE",
  "COACH",
  "MANAGER",
];

function dateInput(value?: string | null) {
  return value?.slice(0, 10) ?? "";
}

function memberForm(member?: TeamMember): MemberFormState {
  return {
    realName: member?.realName ?? "",
    ign: member?.ign ?? "",
    inGameId: member?.inGameId ?? "",
    birthDate: dateInput(member?.birthDate),
    gender: member?.gender ?? "",
    email: member?.email ?? "",
    phoneNumber: member?.phoneNumber ?? "",
    position: member?.position ?? "",
    memberRole: member?.memberRole ?? "SUBSTITUTE",
  };
}

function optional(value: string) {
  return value.trim() || undefined;
}

function mutationMessage(reason: unknown, fallback: string) {
  if (reason instanceof ApiError && reason.errors?.length) {
    return reason.errors.map((error) => error.message).join(" • ");
  }
  return reason instanceof Error && reason.message ? reason.message : fallback;
}

function MemberEditor({
  mode,
  tournament,
  team,
  onSaved,
  onPartialFailure,
  onCancel,
}: {
  mode: EditorMode;
  tournament: TournamentDetail;
  team: TeamDetail;
  onSaved: (team?: TeamDetail) => Promise<void>;
  onPartialFailure: (message: string) => void;
  onCancel: () => void;
}) {
  const { locale, t } = useLocale();
  const member = mode.kind === "edit" ? mode.member : undefined;
  const [form, setForm] = useState(() => memberForm(member));
  const [avatar, setAvatar] = useState<File | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const activePlayer =
    form.memberRole === "CAPTAIN" || form.memberRole === "PLAYER";
  const showPosition =
    tournament.game.positionMode !== "NONE" &&
    (activePlayer || form.memberRole === "SUBSTITUTE");
  const needsProfile = tournament.requireMemberFullInfo === true;
  const needsBirthDate =
    needsProfile || tournament.minAge != null || tournament.maxAge != null;
  const needsGender =
    needsProfile || Boolean(tournament.allowedGenders?.length);
  const genderOptions = tournament.allowedGenders?.length
    ? tournament.allowedGenders
    : GENDERS;

  const setField = (field: keyof MemberFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (working) return;
    setWorking(true);
    setError("");
    try {
      const payload: TeamMemberRegistration = {
        realName: form.realName.trim(),
        ign: form.ign.trim(),
        inGameId: optional(form.inGameId),
        birthDate: form.birthDate || undefined,
        gender: form.gender || undefined,
        email: optional(form.email),
        phoneNumber: optional(form.phoneNumber),
        position: showPosition ? optional(form.position) : undefined,
        memberRole: form.memberRole,
      };
      let memberId = member?.id;
      let updated: TeamDetail;
      if (mode.kind === "add") {
        updated = await teamsApi.addMember(team.id, payload);
        const previousIds = new Set(team.members.map((item) => item.id));
        memberId = updated.members.find(
          (item) => !previousIds.has(item.id),
        )?.id;
      } else {
        updated = await teamsApi.updateMember(team.id, mode.member.id, payload);
      }
      await onSaved(updated);
      if (avatar) {
        try {
          if (!memberId) throw new Error(t("teamManage.avatarTargetError"));
          await teamsApi.uploadMemberAvatar(team.id, memberId, avatar);
          await onSaved();
        } catch (reason) {
          onPartialFailure(
            `${t("teamManage.avatarUploadPartial")} ${mutationMessage(reason, "")}`,
          );
        }
      }
      onCancel();
    } catch (reason) {
      setError(mutationMessage(reason, t("teamManage.memberSaveError")));
    } finally {
      setWorking(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="mt-5 rounded-xl border border-brand/25 bg-surface-sub/45 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-ink">
            {t(
              mode.kind === "add"
                ? "teamManage.addMember"
                : "teamManage.editMember",
            )}
          </h3>
          <p className="mt-1 text-xs text-ink-muted">
            {t("teamManage.rosterValidationHint")}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={working}
          className="text-sm text-ink-muted hover:text-ink"
        >
          {t("common.cancel")}
        </button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          {t("team.register.realName")}
          <input
            required
            maxLength={100}
            value={form.realName}
            onChange={(event) => setField("realName", event.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className={labelClass}>
          {t("team.register.ign")}
          <input
            required
            maxLength={30}
            value={form.ign}
            onChange={(event) => setField("ign", event.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className={labelClass}>
          {t("teamDetail.gameId")}
          <input
            maxLength={100}
            value={form.inGameId}
            onChange={(event) => setField("inGameId", event.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className={labelClass}>
          {t("teamManage.memberRole")}
          <select
            value={form.memberRole}
            disabled={member?.memberRole === "CAPTAIN"}
            onChange={(event) => setField("memberRole", event.target.value)}
            className={`${inputClass} mt-1`}
          >
            {member?.memberRole === "CAPTAIN" && (
              <option value="CAPTAIN">{t("registration.role.CAPTAIN")}</option>
            )}
            {MEMBER_ROLES.map((role) => (
              <option key={role} value={role}>
                {t(`registration.role.${role}` as TranslationKey)}
              </option>
            ))}
          </select>
        </label>
        {showPosition && (
          <label className={labelClass}>
            {t("registration.position")}
            <select
              required={
                tournament.game.positionMode === "FIXED" && activePlayer
              }
              value={form.position}
              onChange={(event) => setField("position", event.target.value)}
              className={`${inputClass} mt-1`}
            >
              <option value="">{t("registration.notSelected")}</option>
              {(tournament.game.positions ?? []).map((position) => (
                <option key={position} value={position}>
                  {gamePositionLabel(position, locale)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={labelClass}>
          {t("common.email")}
          <input
            type="email"
            value={form.email}
            onChange={(event) => setField("email", event.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className={labelClass}>
          {t("registration.phone")}
          <input
            maxLength={20}
            value={form.phoneNumber}
            onChange={(event) => setField("phoneNumber", event.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>
        {(needsBirthDate || form.birthDate) && (
          <label className={labelClass}>
            {t("registration.birthDate")}
            <input
              type="date"
              required={needsBirthDate}
              value={form.birthDate}
              onChange={(event) => setField("birthDate", event.target.value)}
              className={`${inputClass} mt-1`}
            />
          </label>
        )}
        {(needsGender || form.gender) && (
          <label className={labelClass}>
            {t("registration.gender")}
            <select
              required={needsGender}
              value={form.gender}
              onChange={(event) => setField("gender", event.target.value)}
              className={`${inputClass} mt-1`}
            >
              <option value="">{t("team.register.selectGender")}</option>
              {genderOptions.map((gender) => (
                <option key={gender} value={gender}>
                  {t(
                    `auth.register.gender.${gender.toLowerCase()}` as TranslationKey,
                  )}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="mt-4">
        <ImageUploadPicker
          label={t("teamManage.memberAvatar")}
          file={avatar}
          onFileChange={setAvatar}
          existingUrl={member?.avatarUrl}
          variant="avatar"
          disabled={working}
          uploading={working && Boolean(avatar)}
        />
      </div>
      {error && (
        <p role="alert" className={`${alertErrorClass} mt-4`}>
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={working}
        className={`${primaryButtonClass} mt-5`}
      >
        {working && <CircleNotchIcon className="animate-spin" aria-hidden />}
        {t(working ? "common.saving" : "teamManage.saveMember")}
      </button>
    </form>
  );
}

export default function TeamManagementPanel({
  team,
  user,
  onChanged,
}: {
  team: TeamDetail;
  user: User;
  onChanged: (team?: TeamDetail) => Promise<void>;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [configError, setConfigError] = useState("");
  const [configAttempt, setConfigAttempt] = useState(0);
  const [loadedAt] = useState(() => Date.now());
  const [profileOpen, setProfileOpen] = useState(false);
  const [editor, setEditor] = useState<EditorMode | null>(null);
  const [profile, setProfile] = useState({
    name: team.name,
    shortName: team.shortName ?? "",
    description: team.description ?? "",
    contactName: team.contactName,
    contactEmail: team.contactEmail ?? "",
    contactPhone: team.contactPhone ?? "",
  });
  const [logo, setLogo] = useState<File | null>(null);
  const [working, setWorking] = useState<"profile" | "remove" | string | null>(
    null,
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const isOrganizer = user.id === team.tournament.organizerId;
  const isCaptain = user.id === team.captainId && !isOrganizer;

  useEffect(() => {
    let cancelled = false;
    tournamentsApi.findBySlug(team.tournament.slug).then(
      (value) => {
        if (!cancelled) {
          setTournament(value);
          setConfigError("");
        }
      },
      (reason: unknown) => {
        if (!cancelled) {
          setConfigError(
            mutationMessage(reason, t("teamManage.configLoadError")),
          );
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [configAttempt, team.tournament.slug, t]);

  const registrationEditable = useMemo(() => {
    if (
      !tournament ||
      tournament.status !== "REGISTRATION" ||
      !tournament.registrationOpen
    )
      return false;
    const now = loadedAt;
    if (
      tournament.registrationStartDate &&
      now < new Date(tournament.registrationStartDate).getTime()
    )
      return false;
    if (
      tournament.registrationDeadline &&
      now > new Date(tournament.registrationDeadline).getTime()
    )
      return false;
    if (tournament.startDate && now >= new Date(tournament.startDate).getTime())
      return false;
    return true;
  }, [loadedAt, tournament]);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (working) return;
    setWorking("profile");
    setError("");
    setNotice("");
    try {
      await teamsApi.update(team.id, {
        name: profile.name.trim(),
        shortName: profile.shortName.trim(),
        description: profile.description.trim(),
        contactName: profile.contactName.trim(),
        contactEmail: profile.contactEmail.trim(),
        contactPhone: profile.contactPhone.trim(),
      });
      if (logo) await teamsApi.uploadLogo(team.id, logo);
      await onChanged();
      setLogo(null);
      setProfileOpen(false);
      setNotice(t("teamManage.profileSaved"));
    } catch (reason) {
      setError(mutationMessage(reason, t("teamManage.profileSaveError")));
    } finally {
      setWorking(null);
    }
  };

  const removeMember = async (member: TeamMember) => {
    if (
      working ||
      !window.confirm(
        t("teamManage.removeMemberConfirm").replace(
          "{name}",
          member.ign || member.realName,
        ),
      )
    )
      return;
    setWorking(member.id);
    setError("");
    try {
      const updated = await teamsApi.removeMember(team.id, member.id);
      await onChanged(updated);
      setNotice(t("teamManage.memberRemoved"));
    } catch (reason) {
      setError(mutationMessage(reason, t("teamManage.memberRemoveError")));
    } finally {
      setWorking(null);
    }
  };

  const removeTeam = async () => {
    if (
      working ||
      !window.confirm(
        t(
          isOrganizer
            ? "teamManage.deleteConfirm"
            : "teamManage.withdrawConfirm",
        ).replace("{name}", team.name),
      )
    )
      return;
    setWorking("remove");
    setError("");
    try {
      await teamsApi.remove(team.id);
      router.push(
        isOrganizer
          ? `/tournaments/${team.tournament.slug}/manage`
          : "/users/me/teams",
      );
    } catch (reason) {
      setError(mutationMessage(reason, t("teamManage.removeTeamError")));
      setWorking(null);
    }
  };

  return (
    <section
      aria-labelledby="team-management"
      className="mt-8 rounded-2xl border border-brand/30 bg-surface-card p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand">
            {t("teamManage.eyebrow")}
          </p>
          <h2 id="team-management" className="mt-1 text-xl font-bold text-ink">
            {t("teamManage.title")}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {t(
              isOrganizer
                ? "teamManage.organizerHint"
                : "teamManage.captainHint",
            )}
          </p>
        </div>
        <button
          type="button"
          className={secondaryButtonClass}
          disabled={!registrationEditable || Boolean(working)}
          onClick={() => setProfileOpen((value) => !value)}
          title={
            tournament && !registrationEditable
              ? t("teamManage.registrationLocked")
              : undefined
          }
        >
          <NotePencilIcon aria-hidden />
          {t("teamManage.editProfile")}
        </button>
      </div>

      {notice && (
        <p
          role="status"
          className="mt-4 flex items-center gap-2 text-sm text-approved"
        >
          <CheckCircleIcon weight="fill" />
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className={`${alertErrorClass} mt-4 flex gap-2`}>
          <WarningCircleIcon className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      {profileOpen && (
        <form onSubmit={saveProfile} className="mt-5 border-t border-line pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>
              {t("teamManage.name")}
              <input
                required
                maxLength={50}
                value={profile.name}
                onChange={(event) =>
                  setProfile((value) => ({
                    ...value,
                    name: event.target.value,
                  }))
                }
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className={labelClass}>
              {t("teamManage.shortName")}
              <input
                maxLength={10}
                value={profile.shortName}
                onChange={(event) =>
                  setProfile((value) => ({
                    ...value,
                    shortName: event.target.value,
                  }))
                }
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className={`${labelClass} sm:col-span-2`}>
              {t("teamManage.description")}
              <textarea
                maxLength={2000}
                rows={4}
                value={profile.description}
                onChange={(event) =>
                  setProfile((value) => ({
                    ...value,
                    description: event.target.value,
                  }))
                }
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className={labelClass}>
              {t("registration.fullName")}
              <input
                required
                maxLength={100}
                value={profile.contactName}
                onChange={(event) =>
                  setProfile((value) => ({
                    ...value,
                    contactName: event.target.value,
                  }))
                }
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className={labelClass}>
              {t("common.email")}
              <input
                required
                type="email"
                value={profile.contactEmail}
                onChange={(event) =>
                  setProfile((value) => ({
                    ...value,
                    contactEmail: event.target.value,
                  }))
                }
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className={labelClass}>
              {t("registration.phone")}
              <input
                required
                maxLength={20}
                value={profile.contactPhone}
                onChange={(event) =>
                  setProfile((value) => ({
                    ...value,
                    contactPhone: event.target.value,
                  }))
                }
                className={`${inputClass} mt-1`}
              />
            </label>
          </div>
          <div className="mt-4">
            <ImageUploadPicker
              label={t("teamManage.logo")}
              file={logo}
              onFileChange={setLogo}
              existingUrl={team.logoUrl}
              variant="square"
              disabled={Boolean(working)}
              uploading={working === "profile" && Boolean(logo)}
            />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={Boolean(working)}
              className={primaryButtonClass}
            >
              {working === "profile" && (
                <CircleNotchIcon className="animate-spin" />
              )}
              {t(
                working === "profile"
                  ? "common.saving"
                  : "teamManage.saveProfile",
              )}
            </button>
            <button
              type="button"
              disabled={Boolean(working)}
              onClick={() => setProfileOpen(false)}
              className={secondaryButtonClass}
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 border-t border-line pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-bold">
              <UsersThreeIcon />
              {t("teamManage.rosterTitle")}
            </h3>
            <p className="mt-1 text-xs text-ink-muted">
              {t("teamManage.rosterHint")}
            </p>
          </div>
          <button
            type="button"
            disabled={
              !registrationEditable || Boolean(working) || Boolean(editor)
            }
            onClick={() => setEditor({ kind: "add" })}
            className={secondaryButtonClass}
          >
            <PlusIcon />
            {t("teamManage.addMember")}
          </button>
        </div>
        {configError && (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-rejected">
            <span>{configError}</span>
            <button
              type="button"
              onClick={() => {
                setConfigError("");
                setConfigAttempt((value) => value + 1);
              }}
              className="font-semibold underline"
            >
              {t("common.retry")}
            </button>
          </div>
        )}
        {tournament && !registrationEditable && (
          <p className="mt-4 rounded-lg border border-pending/30 bg-pending/10 p-3 text-sm text-pending">
            {t("teamManage.registrationLocked")}
          </p>
        )}
        <ul className="mt-4 space-y-3">
          {team.members.map((member) => (
            <li
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-sub/45 p-4"
            >
              <div className="min-w-0">
                <p className="break-words font-semibold">
                  {member.ign || member.realName}
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  {member.realName} ·{" "}
                  {t(
                    `registration.role.${member.memberRole}` as TranslationKey,
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={
                    !registrationEditable || Boolean(working) || Boolean(editor)
                  }
                  onClick={() => setEditor({ kind: "edit", member })}
                  className="rounded-lg border border-line px-3 py-2 text-xs font-semibold hover:border-brand"
                >
                  {t("common.edit")}
                </button>
                <button
                  type="button"
                  aria-label={`${t("teamManage.removeMemberConfirm").replace("{name}", member.ign || member.realName)}`}
                  disabled={
                    !registrationEditable ||
                    member.memberRole === "CAPTAIN" ||
                    Boolean(working) ||
                    Boolean(editor)
                  }
                  onClick={() => void removeMember(member)}
                  className="rounded-lg border border-rejected/35 px-3 py-2 text-xs font-semibold text-rejected disabled:opacity-40"
                >
                  <TrashIcon aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
        {editor && tournament && (
          <MemberEditor
            key={editor.kind === "edit" ? editor.member.id : "add"}
            mode={editor}
            tournament={tournament}
            team={team}
            onSaved={onChanged}
            onPartialFailure={setError}
            onCancel={() => setEditor(null)}
          />
        )}
      </div>

      <div className="mt-7 border-t border-rejected/25 pt-5">
        <h3 className="font-bold text-rejected">
          {t("teamManage.dangerTitle")}
        </h3>
        <p className="mt-1 text-sm text-ink-muted">
          {t(isOrganizer ? "teamManage.deleteHint" : "teamManage.withdrawHint")}
        </p>
        <button
          type="button"
          disabled={
            Boolean(working) || (isCaptain && team.status !== "PENDING")
          }
          onClick={() => void removeTeam()}
          className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-rejected/40 px-4 py-2 text-sm font-semibold text-rejected hover:bg-rejected/10 disabled:opacity-40"
        >
          {working === "remove" ? (
            <CircleNotchIcon className="animate-spin" />
          ) : (
            <TrashIcon />
          )}
          {t(isOrganizer ? "teamManage.delete" : "teamManage.withdraw")}
        </button>
        {isCaptain && team.status !== "PENDING" && (
          <p className="mt-2 text-xs text-ink-faint">
            {t("teamManage.withdrawLocked")}
          </p>
        )}
      </div>
    </section>
  );
}
