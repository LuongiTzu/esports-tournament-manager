"use client";

import { useState } from "react";
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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Đăng nhập"
      subtitle="Đăng nhập để tạo giải và quản lý đội đăng ký."
      visual={<AuthVisualPanel mode="login" />}
      footer={
        <>
          Chưa có tài khoản?{" "}
          <Link href="/register" className="font-medium text-brand hover:underline">
            Đăng ký ngay
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className={labelClass}>
            Email
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
            Mật khẩu
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
              placeholder="Nhập mật khẩu"
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              aria-pressed={showPassword}
              className="absolute right-1.5 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-ink-faint transition hover:bg-white/5 hover:text-brand-hover focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
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
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          {!loading && <SignInIcon size={18} weight="bold" />}
        </button>
      </form>
    </AuthShell>
  );
}
