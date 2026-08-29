"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthShell from "@/features/auth/components/AuthShell";
import AuthVisualPanel from "@/features/auth/components/AuthVisualPanel";
import styles from "@/features/auth/components/AuthSurface.module.css";
import { authApi } from "@/features/auth/api";
import { alertErrorClass } from "@/components/ui";
import { useSensitiveToken } from "@/features/auth/hooks/useSensitiveToken";

export default function ResetPasswordPage() {
  const { ready, token } = useSensitiveToken();
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading || !token) return;
    if (newPassword !== confirmation) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }
    if (
      newPassword.length < 6 ||
      !/[A-Za-z]/.test(newPassword) ||
      !/\d/.test(newPassword)
    ) {
      setError(
        "Mật khẩu phải có 6–50 ký tự, gồm ít nhất một chữ cái và một số",
      );
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await authApi.resetPassword({ token, newPassword });
      setSuccess(result.message);
      window.setTimeout(() => router.replace("/login?passwordChanged=1"), 1200);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Khôi phục tài khoản"
      title="Đặt lại mật khẩu"
      subtitle="Tạo mật khẩu mới cho tài khoản ArenaVerse. Sau khi hoàn tất, mọi phiên đăng nhập cũ sẽ hết hiệu lực."
      visual={<AuthVisualPanel mode="login" />}
      footer={<Link href="/forgot-password">Yêu cầu liên kết mới</Link>}
    >
      <div className="mt-7">
        {ready && !token ? (
          <p role="alert" className={alertErrorClass}>
            Liên kết đặt lại mật khẩu thiếu token hoặc đã được mở trước đó.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="new-password" className={styles.label}>
                Mật khẩu mới
              </label>
              <input
                id="new-password"
                type="password"
                required
                minLength={6}
                maxLength={50}
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className={`${styles.input} ${styles.loginInput}`}
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className={styles.label}>
                Xác nhận mật khẩu
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                minLength={6}
                maxLength={50}
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className={`${styles.input} ${styles.loginInput}`}
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
              disabled={!ready || loading || Boolean(success)}
              className={styles.submitButton}
            >
              {loading ? "Đang cập nhật…" : "Đặt lại mật khẩu"}
            </button>
          </form>
        )}
      </div>
    </AuthShell>
  );
}
