"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react";
import AuthShell from "@/features/auth/components/AuthShell";
import AuthVisualPanel from "@/features/auth/components/AuthVisualPanel";
import GoogleSignInButton from "@/features/auth/components/GoogleSignInButton";
import styles from "@/features/auth/components/AuthSurface.module.css";
import { login, loginWithGoogle } from "@/features/auth/store";
import { alertErrorClass } from "@/components/ui";
import { useLocale } from "@/features/locale/store";
import { authApi } from "@/features/auth/api";
import { ApiError } from "@/lib/api/client";
import { useCooldown } from "@/features/auth/hooks/useCooldown";

const subscribeToLocation = () => () => {};
const getPasswordChangedSnapshot = () =>
  new URLSearchParams(window.location.search).get("passwordChanged") === "1";
const getServerPasswordChangedSnapshot = () => false;

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const resendCooldown = useCooldown();
  const passwordChanged = useSyncExternalStore(
    subscribeToLocation,
    getPasswordChangedSnapshot,
    getServerPasswordChangedSnapshot,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setVerificationRequired(false);
    setResendMessage("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      setVerificationRequired(
        err instanceof ApiError && err.code === "EMAIL_NOT_VERIFIED",
      );
      setError(
        err instanceof Error ? err.message : t("auth.login.fallbackError"),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendLoading || resendCooldown.seconds > 0 || !email) return;
    setResendLoading(true);
    setResendMessage("");
    try {
      const response = await authApi.resendVerification(email);
      setResendMessage(response.message);
      resendCooldown.start(300);
    } catch (err) {
      setResendMessage(
        err instanceof Error ? err.message : "Không thể gửi lại email xác minh",
      );
    } finally {
      setResendLoading(false);
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
      title={t("auth.login.title")}
      subtitle={t("auth.login.subtitle")}
      eyebrow={t("auth.login.eyebrow")}
      visual={<AuthVisualPanel mode="login" />}
      footer={
        <>
          {t("auth.login.noAccount")}{" "}
          <Link
            href="/register"
            className="font-medium text-brand hover:underline"
          >
            {t("auth.login.registerNow")}
          </Link>
        </>
      }
    >
      <GoogleSignInButton
        mode="signin"
        disabled={loading || googleLoading}
        onCredential={handleGoogleCredential}
        onError={handleGoogleError}
      />
      <div className={styles.authDivider}>
        <span>{t("auth.google.orEmail")}</span>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
        {passwordChanged && (
          <p
            role="status"
            className="rounded-[var(--radius-control)] border border-approved/40 bg-approved/10 px-4 py-3 text-sm text-approved"
          >
            {t("auth.login.passwordChanged")}
          </p>
        )}
        <div>
          <label htmlFor="email" className="sr-only">
            {t("common.email")}
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${styles.input} ${styles.loginInput}`}
            placeholder={t("common.email")}
          />
        </div>

        <div>
          <label htmlFor="password" className="sr-only">
            {t("auth.login.password")}
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${styles.input} ${styles.loginInput} ${styles.passwordInput}`}
              placeholder={t("auth.login.passwordPlaceholder")}
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

        <p className={styles.forgotPasswordText}>
          <Link href="/forgot-password">{t("auth.login.forgotPassword")}</Link>
        </p>

        {error && (
          <p role="alert" className={alertErrorClass}>
            {error}
          </p>
        )}
        {verificationRequired && (
          <div className="space-y-2 text-center">
            <button
              type="button"
              disabled={resendLoading || resendCooldown.seconds > 0}
              onClick={handleResendVerification}
              className="text-sm font-bold text-[#861536] underline underline-offset-4 transition hover:text-[#a10f3b] disabled:opacity-50 dark:text-rose-400"
            >
              {resendLoading
                ? "Đang gửi…"
                : resendCooldown.seconds > 0
                  ? `Gửi lại sau ${resendCooldown.seconds}s`
                  : "Gửi lại email xác minh"}
            </button>
            {resendMessage && (
              <p role="status" className="text-xs leading-5 text-ink-muted">
                {resendMessage}
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || googleLoading}
          className={styles.submitButton}
        >
          {loading ? t("auth.login.submitting") : t("auth.login.submit")}
        </button>
      </form>
    </AuthShell>
  );
}
