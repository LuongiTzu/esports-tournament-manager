"use client";

import { useState } from "react";
import Link from "next/link";
import AuthShell from "@/features/auth/components/AuthShell";
import AuthVisualPanel from "@/features/auth/components/AuthVisualPanel";
import styles from "@/features/auth/components/AuthSurface.module.css";
import { authApi } from "@/features/auth/api";
import { alertErrorClass } from "@/components/ui";
import { useCooldown } from "@/features/auth/hooks/useCooldown";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const cooldown = useCooldown();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading || cooldown.seconds > 0) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const result = await authApi.forgotPassword(email);
      setSuccess(result.message);
      cooldown.start(60);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể gửi yêu cầu đặt lại mật khẩu",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Khôi phục tài khoản"
      title="Quên mật khẩu?"
      subtitle="Nhập email đăng nhập. Nếu tài khoản tồn tại, ArenaVerse sẽ gửi liên kết đặt lại mật khẩu có hiệu lực 15 phút."
      visual={<AuthVisualPanel mode="login" />}
      footer={<Link href="/login">Quay lại đăng nhập</Link>}
    >
      <form onSubmit={submit} className="mt-7 space-y-4">
        <div>
          <label htmlFor="recovery-email" className={styles.label}>
            Email đăng nhập
          </label>
          <input
            id="recovery-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={`${styles.input} ${styles.loginInput}`}
            placeholder="ban@vidu.com"
          />
        </div>
        {error && (
          <p role="alert" className={alertErrorClass}>
            {error}
          </p>
        )}
        {success && (
          <p
            role="status"
            className="rounded-lg border border-approved/40 bg-approved/10 px-4 py-3 text-sm text-approved"
          >
            {success}
          </p>
        )}
        <button
          type="submit"
          disabled={loading || cooldown.seconds > 0}
          className={styles.submitButton}
        >
          {loading
            ? "Đang gửi…"
            : cooldown.seconds > 0
              ? `Gửi lại sau ${cooldown.seconds}s`
              : "Gửi liên kết"}
        </button>
      </form>
    </AuthShell>
  );
}
