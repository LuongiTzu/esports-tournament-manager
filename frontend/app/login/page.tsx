"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  EnvelopeSimpleIcon,
  EyeIcon,
  EyeSlashIcon,
  LockKeyIcon,
  SignInIcon,
} from "@phosphor-icons/react";
import AuthShell from "@/features/auth/components/AuthShell";
import AuthVisualPanel from "@/features/auth/components/AuthVisualPanel";
import { login } from "@/features/auth/store";
import {
  alertErrorClass,
  authSubmitButtonClass,
  inputClass,
  labelClass,
} from "@/components/ui";
import { useLocale } from "@/features/locale/store";

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
  const passwordChanged = useSyncExternalStore(
    subscribeToLocation,
    getPasswordChangedSnapshot,
    getServerPasswordChangedSnapshot,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.login.fallbackError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={t("auth.login.title")}
      subtitle={t("auth.login.subtitle")}
      eyebrow={t("auth.login.eyebrow")}
      visual={<AuthVisualPanel mode="login" />}
      footer={
        <>
          {t("auth.login.noAccount")} {" "}
          <Link href="/register" className="font-medium text-brand hover:underline">
            {t("auth.login.registerNow")}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {passwordChanged && (
          <p
            role="status"
            className="rounded-[var(--radius-control)] border border-approved/40 bg-approved/10 px-4 py-3 text-sm text-approved"
          >
            {t("auth.login.passwordChanged")}
          </p>
        )}
        <div>
          <label htmlFor="email" className={labelClass}>
            {t("common.email")}
          </label>
          <div className="relative">
            <EnvelopeSimpleIcon
              aria-hidden
              size={19}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint"
            />
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${inputClass} pl-11`}
              placeholder="ban@vidu.com"
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className={labelClass}>
            {t("auth.login.password")}
          </label>
          <div className="relative">
            <LockKeyIcon
              aria-hidden
              size={19}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint"
            />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} px-11`}
              placeholder={t("auth.login.passwordPlaceholder")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? t("auth.login.hidePassword") : t("auth.login.showPassword")}
              aria-pressed={showPassword}
              className="absolute right-1.5 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-ink-faint transition hover:bg-surface-hover hover:text-brand-hover focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
            >
              {showPassword ? <EyeSlashIcon size={19} /> : <EyeIcon size={19} />}
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className={alertErrorClass}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className={authSubmitButtonClass}
        >
          {loading ? t("auth.login.submitting") : t("auth.login.submit")}
          {!loading && <SignInIcon size={18} weight="bold" />}
        </button>
      </form>
    </AuthShell>
  );
}
