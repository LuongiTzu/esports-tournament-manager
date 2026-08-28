"use client";

import { useEffect, useRef, useState } from "react";
import {
  EyeIcon,
  EyeSlashIcon,
  FloppyDiskIcon,
  LockKeyIcon,
  ShieldCheckIcon,
  UserCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import ImageUploadPicker from "@/components/ImageUploadPicker";
import {
  alertErrorClass,
  inputClass,
  labelClass,
} from "@/components/ui";
import { authApi } from "@/features/auth/api";
import {
  clearSession,
  updateCurrentUser,
  useAuth,
} from "@/features/auth/store";
import type { Gender, User } from "@/features/auth/types";
import GamePosterGridBackground from "@/features/home/components/hero/GamePosterGridBackground";
import { useLocale } from "@/features/locale/store";

interface ProfileFormState {
  displayName: string;
  phoneNumber: string;
  birthDate: string;
  gender: "" | Gender;
  currentAddress: string;
  bio: string;
}

const EMPTY_FORM: ProfileFormState = {
  displayName: "",
  phoneNumber: "",
  birthDate: "",
  gender: "",
  currentAddress: "",
  bio: "",
};

interface PasswordFormState {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const EMPTY_PASSWORD_FORM: PasswordFormState = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const STRONG_PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;

function PasswordField({
  id,
  label,
  value,
  visible,
  autoComplete,
  onChange,
  onToggleVisibility,
  showLabel,
  hideLabel,
}: {
  id: string;
  label: string;
  value: string;
  visible: boolean;
  autoComplete: "current-password" | "new-password";
  onChange: (value: string) => void;
  onToggleVisibility: () => void;
  showLabel: string;
  hideLabel: string;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <LockKeyIcon
          aria-hidden
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint"
        />
        <input
          id={id}
          type={visible ? "text" : "password"}
          required
          minLength={6}
          maxLength={50}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClass} px-11`}
        />
        <button
          type="button"
          onClick={onToggleVisibility}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          className="absolute right-1.5 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-ink-faint transition hover:bg-surface-hover hover:text-brand focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
        >
          {visible ? <EyeSlashIcon size={18} /> : <EyeIcon size={18} />}
        </button>
      </div>
    </div>
  );
}

function formFromUser(user: User): ProfileFormState {
  return {
    displayName: user.displayName,
    phoneNumber: user.phoneNumber ?? "",
    birthDate: user.birthDate?.slice(0, 10) ?? "",
    gender: user.gender ?? "",
    currentAddress: user.currentAddress ?? "",
    bio: user.bio ?? "",
  };
}

export default function ProfilePage() {
  const router = useRouter();
  const { t } = useLocale();
  const { user, ready } = useAuth();
  const userId = user?.id;
  const [form, setForm] = useState<ProfileFormState>(EMPTY_FORM);
  const [profile, setProfile] = useState<User | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [avatarSuccess, setAvatarSuccess] = useState("");
  const [passwordForm, setPasswordForm] =
    useState<PasswordFormState>(EMPTY_PASSWORD_FORM);
  const [visiblePasswords, setVisiblePasswords] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!passwordModalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !changingPassword) {
        setPasswordModalOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [changingPassword, passwordModalOpen]);

  useEffect(() => {
    if (!ready) return;
    if (!userId) {
      router.replace("/login");
      return;
    }

    let cancelled = false;
    authApi
      .getMe()
      .then((currentUser) => {
        if (cancelled) return;
        setProfile(currentUser);
        setForm(formFromUser(currentUser));
        updateCurrentUser(currentUser);
      })
      .catch((error) => {
        if (!cancelled) {
          setFormError(
            error instanceof Error
              ? error.message
              : t("profile.detailsLoadError"),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingProfile(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ready, router, t, userId]);

  const handleFieldChange = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setFormError("");
    setFormSuccess("");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const displayName = form.displayName.trim();
    if (displayName.length < 2) {
      setFormError(t("profile.displayNameInvalid"));
      return;
    }

    setSaving(true);
    setFormError("");
    setFormSuccess("");
    try {
      const updatedUser = await authApi.updateProfile({
        displayName,
        phoneNumber: form.phoneNumber.trim() || undefined,
        birthDate: form.birthDate || undefined,
        gender: form.gender || undefined,
        currentAddress: form.currentAddress.trim(),
        bio: form.bio.trim(),
      });
      setProfile(updatedUser);
      setForm(formFromUser(updatedUser));
      updateCurrentUser(updatedUser);
      setFormSuccess(t("profile.detailsUpdated"));
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : t("profile.detailsUpdateError"),
      );
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file: File | null) => {
    if (!file || !profile) return;
    setAvatarFile(file);
    setAvatarUploading(true);
    setAvatarError("");
    setAvatarSuccess("");
    try {
      const uploaded = await authApi.uploadAvatar(file);
      const updatedUser = { ...profile, avatarUrl: uploaded.url };
      setProfile(updatedUser);
      updateCurrentUser(updatedUser);
      setAvatarFile(null);
      setAvatarSuccess(t("profile.avatarUpdated"));
    } catch (error) {
      setAvatarError(
        error instanceof Error
          ? error.message
          : t("profile.avatarUpdateError"),
      );
    } finally {
      setAvatarUploading(false);
    }
  };

  const updatePasswordField = (
    field: keyof PasswordFormState,
    value: string,
  ) => {
    setPasswordForm((current) => ({ ...current, [field]: value }));
    setPasswordError("");
    setPasswordSuccess("");
  };

  const openPasswordModal = () => {
    setPasswordForm(EMPTY_PASSWORD_FORM);
    setVisiblePasswords({ current: false, next: false, confirm: false });
    setPasswordError("");
    setPasswordSuccess("");
    setPasswordModalOpen(true);
  };

  const closePasswordModal = () => {
    if (changingPassword) return;
    setPasswordModalOpen(false);
    setPasswordForm(EMPTY_PASSWORD_FORM);
    setPasswordError("");
    setPasswordSuccess("");
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const { currentPassword, newPassword, confirmPassword } = passwordForm;

    if (currentPassword.length < 6) {
      setPasswordError(t("profile.passwordCurrentInvalid"));
      return;
    }
    if (
      newPassword.length < 6 ||
      newPassword.length > 50 ||
      !STRONG_PASSWORD_PATTERN.test(newPassword)
    ) {
      setPasswordError(t("profile.passwordNewInvalid"));
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError(t("profile.passwordMustDiffer"));
      return;
    }
    if (confirmPassword !== newPassword) {
      setPasswordError(t("profile.passwordConfirmMismatch"));
      return;
    }

    setChangingPassword(true);
    setPasswordError("");
    setPasswordSuccess("");
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      setPasswordForm(EMPTY_PASSWORD_FORM);
      setPasswordSuccess(t("profile.passwordChanged"));
      redirectTimerRef.current = setTimeout(() => {
        clearSession();
        router.replace("/login?passwordChanged=1");
      }, 1200);
    } catch (error) {
      setPasswordError(
        error instanceof Error
          ? error.message
          : t("profile.passwordChangeError"),
      );
    } finally {
      setChangingPassword(false);
    }
  };

  if (!ready || (user && loadingProfile)) {
    return (
      <div className="relative isolate flex-1 overflow-hidden">
        <GamePosterGridBackground dense />
        <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="h-[34rem] animate-pulse rounded-2xl border border-line bg-surface-card/90 backdrop-blur" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="relative isolate flex-1 overflow-hidden">
      <GamePosterGridBackground dense />
      <div className="relative z-10 mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <header className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">
            {t("profile.eyebrow")}
          </p>
          <h1 className="mt-2 flex items-center gap-3 text-2xl font-bold text-ink sm:text-3xl">
            <UserCircleIcon className="text-brand" weight="duotone" />
            {t("profile.title")}
          </h1>
        </header>

        <div className="overflow-hidden rounded-2xl border border-line bg-surface-card/92 shadow-[var(--shadow-elevated)] backdrop-blur-md">
          <section className="p-6 sm:p-8 lg:p-10">
            <div className="flex flex-col gap-5 border-b border-line pb-7 sm:flex-row sm:items-center">
            <ImageUploadPicker
              label={t("profile.changeAvatar")}
              file={avatarFile}
              onFileChange={(file) => {
                setAvatarError("");
                setAvatarSuccess("");
                void uploadAvatar(file);
              }}
              existingUrl={profile?.avatarUrl}
              variant="avatar"
              appearance="avatar-overlay"
              uploading={avatarUploading}
              uploadError={avatarError}
              successMessage={avatarSuccess}
            />
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-ink">
                  {profile?.displayName ?? user.displayName}
                </h2>
                <p className="mt-1 break-all text-sm text-ink-muted">
                  {profile?.email ?? user.email}
                </p>
                <p className="mt-2 max-w-xl text-sm leading-6 text-ink-faint">
                  {t("profile.avatarDescription")}
                </p>
              </div>
              <button
                type="button"
                onClick={openPasswordModal}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-line-strong bg-surface/65 px-4 py-2.5 text-sm font-bold text-ink transition hover:border-brand/60 hover:bg-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] sm:ml-auto"
              >
                <LockKeyIcon size={18} weight="bold" />
                {t("profile.changePassword")}
              </button>
            </div>

            <div className="mt-7">
              <h2 className="text-lg font-semibold text-ink">
                {t("profile.personalDetails")}
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                {t("profile.personalDetailsDescription")}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <div>
              <label htmlFor="displayName" className={labelClass}>
                {t("auth.register.displayName")} <span className="text-brand-secondary">*</span>
              </label>
              <input
                id="displayName"
                name="displayName"
                required
                minLength={2}
                maxLength={50}
                autoComplete="nickname"
                value={form.displayName}
                onChange={handleFieldChange}
                className={inputClass}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="phoneNumber" className={labelClass}>
                  {t("auth.register.phone")}
                </label>
                <input
                  id="phoneNumber"
                  name="phoneNumber"
                  type="tel"
                  inputMode="tel"
                  minLength={9}
                  maxLength={15}
                  autoComplete="tel"
                  value={form.phoneNumber}
                  onChange={handleFieldChange}
                  className={inputClass}
                  placeholder="09xxxxxxxx"
                />
              </div>
              <div>
                <label htmlFor="birthDate" className={labelClass}>
                  {t("auth.register.birthDate")}
                </label>
                <input
                  id="birthDate"
                  name="birthDate"
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  autoComplete="bday"
                  value={form.birthDate}
                  onChange={handleFieldChange}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-[0.72fr_1.28fr]">
              <div>
                <label htmlFor="gender" className={labelClass}>
                  {t("auth.register.gender")}
                </label>
                <select
                  id="gender"
                  name="gender"
                  value={form.gender}
                  onChange={handleFieldChange}
                  className={inputClass}
                >
                  <option value="">{t("auth.register.gender.none")}</option>
                  <option value="MALE">{t("auth.register.gender.male")}</option>
                  <option value="FEMALE">{t("auth.register.gender.female")}</option>
                  <option value="OTHER">{t("auth.register.gender.other")}</option>
                </select>
              </div>
              <div>
                <label htmlFor="currentAddress" className={labelClass}>
                  {t("auth.register.address")}
                </label>
                <input
                  id="currentAddress"
                  name="currentAddress"
                  maxLength={200}
                  autoComplete="street-address"
                  value={form.currentAddress}
                  onChange={handleFieldChange}
                  className={inputClass}
                  placeholder={t("auth.register.addressPlaceholder")}
                />
              </div>
            </div>

            <div>
              <label htmlFor="bio" className={labelClass}>
                {t("profile.bio")}
              </label>
              <textarea
                id="bio"
                name="bio"
                rows={5}
                maxLength={500}
                value={form.bio}
                onChange={handleFieldChange}
                className={`${inputClass} resize-y`}
                placeholder={t("profile.bioPlaceholder")}
              />
              <p className="mt-1.5 text-right text-xs text-ink-faint">
                {form.bio.length}/500
              </p>
            </div>

            {formError && (
              <p role="alert" className={alertErrorClass}>
                {formError}
              </p>
            )}
            {formSuccess && (
              <p
                role="status"
                className="rounded-[var(--radius-control)] border border-approved/40 bg-approved/10 px-4 py-3 text-sm text-approved"
              >
                {formSuccess}
              </p>
            )}

            <div className="flex justify-end border-t border-line pt-5">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-12 items-center justify-center gap-2.5 rounded-md bg-brand-secondary px-6 py-3 text-[0.8125rem] font-black uppercase tracking-wide text-on-brand shadow-[0_12px_30px_-14px_var(--color-brand-secondary)] transition hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55"
              >
                <FloppyDiskIcon size={19} weight="fill" />
                {saving ? t("profile.saving") : t("profile.saveDetails")}
              </button>
            </div>
            </form>
          </section>

        </div>
      </div>

      {passwordModalOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePasswordModal();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-password-title"
            className="max-h-[calc(100svh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-line-strong bg-surface-card shadow-[var(--shadow-elevated)]"
          >
            <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-5 sm:px-6">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                  <ShieldCheckIcon size={22} weight="duotone" />
                </span>
                <div>
                  <h2 id="change-password-title" className="text-lg font-bold text-ink">
                    {t("profile.passwordTitle")}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-ink-muted">
                    {t("profile.passwordDescription")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={changingPassword}
                onClick={closePasswordModal}
                aria-label={t("profile.closePasswordModal")}
                className="grid size-10 shrink-0 place-items-center rounded-lg text-ink-faint transition hover:bg-surface-hover hover:text-ink focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] disabled:opacity-50"
              >
                <XIcon size={20} weight="bold" />
              </button>
            </header>

            <form onSubmit={handlePasswordSubmit} className="space-y-5 p-5 sm:p-6">
              <PasswordField
                id="currentPassword"
                label={t("profile.currentPassword")}
                value={passwordForm.currentPassword}
                visible={visiblePasswords.current}
                autoComplete="current-password"
                onChange={(value) => updatePasswordField("currentPassword", value)}
                onToggleVisibility={() =>
                  setVisiblePasswords((current) => ({
                    ...current,
                    current: !current.current,
                  }))
                }
                showLabel={t("auth.login.showPassword")}
                hideLabel={t("auth.login.hidePassword")}
              />

              <PasswordField
                id="newPassword"
                label={t("profile.newPassword")}
                value={passwordForm.newPassword}
                visible={visiblePasswords.next}
                autoComplete="new-password"
                onChange={(value) => updatePasswordField("newPassword", value)}
                onToggleVisibility={() =>
                  setVisiblePasswords((current) => ({
                    ...current,
                    next: !current.next,
                  }))
                }
                showLabel={t("auth.login.showPassword")}
                hideLabel={t("auth.login.hidePassword")}
              />

              <PasswordField
                id="confirmNewPassword"
                label={t("profile.confirmNewPassword")}
                value={passwordForm.confirmPassword}
                visible={visiblePasswords.confirm}
                autoComplete="new-password"
                onChange={(value) =>
                  updatePasswordField("confirmPassword", value)
                }
                onToggleVisibility={() =>
                  setVisiblePasswords((current) => ({
                    ...current,
                    confirm: !current.confirm,
                  }))
                }
                showLabel={t("auth.login.showPassword")}
                hideLabel={t("auth.login.hidePassword")}
              />

              <p className="text-xs leading-5 text-ink-faint">
                {t("profile.passwordRequirements")}
              </p>

              {passwordError && (
                <p role="alert" className={alertErrorClass}>
                  {passwordError}
                </p>
              )}
              {passwordSuccess && (
                <p
                  role="status"
                  className="rounded-[var(--radius-control)] border border-approved/40 bg-approved/10 px-4 py-3 text-sm text-approved"
                >
                  {passwordSuccess}
                </p>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={changingPassword || Boolean(passwordSuccess)}
                  onClick={closePasswordModal}
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-line-strong px-5 py-2.5 text-sm font-bold text-ink-muted transition hover:bg-surface-hover hover:text-ink disabled:opacity-50"
                >
                  {t("profile.passwordCancel")}
                </button>
                <button
                  type="submit"
                  disabled={changingPassword || Boolean(passwordSuccess)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-brand-secondary px-5 py-2.5 text-xs font-black uppercase tracking-wide text-on-brand transition hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <LockKeyIcon size={18} weight="bold" />
                  {changingPassword
                    ? t("profile.passwordChanging")
                    : t("profile.changePassword")}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
