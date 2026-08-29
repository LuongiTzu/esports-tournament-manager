"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarBlankIcon,
  EnvelopeSimpleIcon,
  EyeIcon,
  EyeSlashIcon,
  GenderIntersexIcon,
  LockKeyIcon,
  MapPinIcon,
  PhoneIcon,
  UserCircleIcon,
} from "@phosphor-icons/react";
import { authApi } from "@/features/auth/api";
import AuthShell from "@/features/auth/components/AuthShell";
import AuthVisualPanel from "@/features/auth/components/AuthVisualPanel";
import GoogleSignInButton from "@/features/auth/components/GoogleSignInButton";
import styles from "@/features/auth/components/AuthSurface.module.css";
import { loginWithGoogle } from "@/features/auth/store";
import type { Gender } from "@/features/auth/types";
import { alertErrorClass } from "@/components/ui";
import { useLocale } from "@/features/locale/store";

interface RegisterForm {
  displayName: string;
  email: string;
  phoneNumber: string;
  birthDate: string;
  gender: "" | Gender;
  currentAddress: string;
  password: string;
  confirmPassword: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [form, setForm] = useState<RegisterForm>({
    displayName: "",
    email: "",
    phoneNumber: "",
    birthDate: "",
    gender: "",
    currentAddress: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError(t("auth.register.passwordMismatch"));
      return;
    }

    setLoading(true);
    try {
      await authApi.register({
        displayName: form.displayName.trim(),
        email: form.email,
        password: form.password,
        birthDate: form.birthDate || undefined,
        currentAddress: form.currentAddress.trim() || undefined,
        phoneNumber: form.phoneNumber.trim() || undefined,
        gender: form.gender || undefined,
      });
      router.push("/login");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("auth.register.fallbackError"),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = useCallback(
    async (credential: string) => {
      setError("");
      setGoogleLoading(true);
      try {
        await loginWithGoogle(credential);
        router.push("/");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("auth.google.fallbackError"),
        );
      } finally {
        setGoogleLoading(false);
      }
    },
    [router, t],
  );

  const handleGoogleError = useCallback(() => {
    setError(t("auth.google.fallbackError"));
  }, [t]);

  return (
    <AuthShell
      title={t("auth.register.title")}
      subtitle={t("auth.register.subtitle")}
      eyebrow={t("auth.register.eyebrow")}
      visual={<AuthVisualPanel mode="register" />}
      footer={
        <>
          {t("auth.register.hasAccount")}{" "}
          <Link
            href="/login"
            className="font-medium text-brand hover:underline"
          >
            {t("auth.login.submit")}
          </Link>
        </>
      }
    >
      <GoogleSignInButton
        mode="signup"
        disabled={loading || googleLoading}
        onCredential={handleGoogleCredential}
        onError={handleGoogleError}
      />
      <div className={styles.authDivider}>
        <span>{t("auth.google.orEmail")}</span>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label htmlFor="displayName" className={styles.label}>
            {t("auth.register.displayName")}{" "}
            <span className="text-brand-secondary">*</span>
          </label>
          <div className="relative">
            <UserCircleIcon
              aria-hidden
              size={19}
              className={styles.fieldIcon}
            />
            <input
              id="displayName"
              type="text"
              name="displayName"
              required
              minLength={2}
              maxLength={50}
              autoComplete="nickname"
              value={form.displayName}
              onChange={handleChange}
              className={`${styles.input} ${styles.registerInput}`}
              placeholder={t("auth.register.displayNamePlaceholder")}
            />
          </div>
          <p className={styles.hint}>{t("auth.register.displayNameHint")}</p>
        </div>

        <div>
          <label htmlFor="email" className={styles.label}>
            {t("common.email")} <span className="text-brand-secondary">*</span>
          </label>
          <div className="relative">
            <EnvelopeSimpleIcon
              aria-hidden
              size={19}
              className={styles.fieldIcon}
            />
            <input
              id="email"
              type="email"
              name="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              className={`${styles.input} ${styles.registerInput}`}
              placeholder="ban@vidu.com"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="phoneNumber" className={styles.label}>
              {t("auth.register.phone")}
            </label>
            <div className="relative">
              <PhoneIcon aria-hidden size={19} className={styles.fieldIcon} />
              <input
                id="phoneNumber"
                type="tel"
                name="phoneNumber"
                inputMode="tel"
                minLength={9}
                maxLength={15}
                autoComplete="tel"
                value={form.phoneNumber}
                onChange={handleChange}
                className={`${styles.input} ${styles.registerInput}`}
                placeholder="09xxxxxxxx"
              />
            </div>
          </div>

          <div>
            <label htmlFor="birthDate" className={styles.label}>
              {t("auth.register.birthDate")}
            </label>
            <div className="relative">
              <CalendarBlankIcon
                aria-hidden
                size={19}
                className={styles.fieldIcon}
              />
              <input
                id="birthDate"
                type="date"
                name="birthDate"
                autoComplete="bday"
                value={form.birthDate}
                onChange={handleChange}
                className={`${styles.input} ${styles.registerInput}`}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[0.72fr_1.28fr]">
          <div>
            <label htmlFor="gender" className={styles.label}>
              {t("auth.register.gender")}
            </label>
            <div className="relative">
              <GenderIntersexIcon
                aria-hidden
                size={19}
                className={styles.fieldIcon}
              />
              <select
                id="gender"
                name="gender"
                value={form.gender}
                onChange={handleChange}
                className={`${styles.input} ${styles.registerInput}`}
              >
                <option value="">{t("auth.register.gender.none")}</option>
                <option value="MALE">{t("auth.register.gender.male")}</option>
                <option value="FEMALE">
                  {t("auth.register.gender.female")}
                </option>
                <option value="OTHER">{t("auth.register.gender.other")}</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="currentAddress" className={styles.label}>
              {t("auth.register.address")}
            </label>
            <div className="relative">
              <MapPinIcon aria-hidden size={19} className={styles.fieldIcon} />
              <input
                id="currentAddress"
                type="text"
                name="currentAddress"
                maxLength={200}
                autoComplete="street-address"
                value={form.currentAddress}
                onChange={handleChange}
                className={`${styles.input} ${styles.registerInput}`}
                placeholder={t("auth.register.addressPlaceholder")}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="password" className={styles.label}>
              {t("auth.register.password")}{" "}
              <span className="text-brand-secondary">*</span>
            </label>
            <div className="relative">
              <LockKeyIcon aria-hidden size={19} className={styles.fieldIcon} />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                name="password"
                required
                minLength={6}
                maxLength={50}
                autoComplete="new-password"
                value={form.password}
                onChange={handleChange}
                className={`${styles.input} ${styles.registerInput} ${styles.registerPasswordInput}`}
                placeholder={t("auth.register.passwordPlaceholder")}
              />
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className={styles.label}>
              {t("auth.register.confirmPassword")}{" "}
              <span className="text-brand-secondary">*</span>
            </label>
            <div className="relative">
              <LockKeyIcon aria-hidden size={19} className={styles.fieldIcon} />
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                name="confirmPassword"
                required
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={handleChange}
                className={`${styles.input} ${styles.registerInput} ${styles.registerPasswordInput}`}
                placeholder={t("auth.register.confirmPasswordPlaceholder")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={
                  showPassword
                    ? t("auth.login.hidePassword")
                    : t("auth.login.showPassword")
                }
                aria-pressed={showPassword}
                className={styles.passwordToggle}
              >
                {showPassword ? (
                  <EyeSlashIcon size={19} />
                ) : (
                  <EyeIcon size={19} />
                )}
              </button>
            </div>
          </div>
        </div>

        <p className={styles.hint}>{t("auth.register.optionalHint")}</p>

        {error && (
          <p role="alert" className={alertErrorClass}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || googleLoading}
          className={styles.submitButton}
        >
          {loading ? t("auth.register.submitting") : t("auth.register.submit")}
        </button>
      </form>
    </AuthShell>
  );
}
