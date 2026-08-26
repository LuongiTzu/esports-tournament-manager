"use client";

import { useEffect, useState } from "react";
import { FloppyDiskIcon, UserCircleIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import ImageUploadPicker from "@/components/ImageUploadPicker";
import {
  alertErrorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/components/ui";
import { authApi } from "@/features/auth/api";
import { updateCurrentUser, useAuth } from "@/features/auth/store";
import type { Gender, User } from "@/features/auth/types";
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

  const uploadAvatar = async () => {
    if (!avatarFile || !profile) return;
    setAvatarUploading(true);
    setAvatarError("");
    setAvatarSuccess("");
    try {
      const uploaded = await authApi.uploadAvatar(avatarFile);
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

  if (!ready || (user && loadingProfile)) {
    return (
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="h-[34rem] animate-pulse rounded-2xl border border-line bg-surface-card" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">
          {t("profile.eyebrow")}
        </p>
        <h1 className="mt-2 flex items-center gap-3 text-2xl font-bold text-ink sm:text-3xl">
          <UserCircleIcon className="text-brand" weight="duotone" />
          {t("profile.title")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
          {t("profile.description")}
        </p>
      </div>

      <div className="grid overflow-hidden rounded-2xl border border-line bg-surface-card shadow-[var(--shadow-elevated)] lg:grid-cols-[20rem_1fr]">
        <aside className="border-b border-line bg-surface-sub/45 p-6 lg:border-b-0 lg:border-r sm:p-8">
          <h2 className="text-lg font-semibold text-ink">
            {t("profile.avatarSection")}
          </h2>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            {t("profile.avatarDescription")}
          </p>
          <div className="mt-6">
            <ImageUploadPicker
              label={t("profile.changeAvatar")}
              file={avatarFile}
              onFileChange={(file) => {
                setAvatarFile(file);
                setAvatarError("");
                setAvatarSuccess("");
              }}
              existingUrl={profile?.avatarUrl}
              variant="avatar"
              uploading={avatarUploading}
              uploadError={avatarError}
              successMessage={avatarSuccess}
            />
            {avatarFile && (
              <button
                type="button"
                disabled={avatarUploading}
                onClick={uploadAvatar}
                className={`${primaryButtonClass} mt-4 w-full`}
              >
                {avatarUploading
                  ? t("profile.uploading")
                  : t("profile.saveAvatar")}
              </button>
            )}
          </div>
          <div className="mt-8 border-t border-line pt-5">
            <p className="break-all text-sm font-medium text-ink">
              {profile?.email ?? user.email}
            </p>
            <p className="mt-1 text-xs text-ink-faint">
              {t("profile.emailReadOnly")}
            </p>
          </div>
        </aside>

        <section className="p-6 sm:p-8 lg:p-10">
          <h2 className="text-lg font-semibold text-ink">
            {t("profile.personalDetails")}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {t("profile.personalDetailsDescription")}
          </p>

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
              <button type="submit" disabled={saving} className={primaryButtonClass}>
                <FloppyDiskIcon size={18} weight="bold" />
                {saving ? t("profile.saving") : t("profile.saveDetails")}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
