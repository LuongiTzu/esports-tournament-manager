"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AuthShell from "@/features/auth/components/AuthShell";
import AuthVisualPanel from "@/features/auth/components/AuthVisualPanel";
import styles from "@/features/auth/components/AuthSurface.module.css";
import { authApi } from "@/features/auth/api";
import { alertErrorClass } from "@/components/ui";
import { PENDING_VERIFICATION_EMAIL_KEY } from "@/features/auth/email-verification";
import { useSensitiveToken } from "@/features/auth/hooks/useSensitiveToken";
import { useCooldown } from "@/features/auth/hooks/useCooldown";

export default function VerifyEmailPage() {
  const { ready, token, registered } = useSensitiveToken();
  const attempted = useRef(false);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [resending, setResending] = useState(false);
  const cooldown = useCooldown();

  useEffect(() => {
    if (!ready || !token || attempted.current) return;
    attempted.current = true;
    setStatus("loading");
    authApi
      .verifyEmail(token)
      .then((result) => {
        sessionStorage.removeItem(PENDING_VERIFICATION_EMAIL_KEY);
        setMessage(result.message);
        setStatus("success");
      })
      .catch((reason) => {
        setMessage(
          reason instanceof Error
            ? reason.message
            : "Liên kết xác minh không hợp lệ hoặc đã hết hạn",
        );
        setStatus("error");
      });
  }, [ready, token]);

  const resend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (resending || cooldown.seconds > 0) return;
    setResending(true);
    setMessage("");
    try {
      const result = await authApi.resendVerification(pendingEmail);
      setMessage(result.message);
      cooldown.start(300);
    } catch (reason) {
      setMessage(
        reason instanceof Error ? reason.message : "Không thể gửi lại email",
      );
    } finally {
      setResending(false);
    }
  };

  const missingToken = ready && !token;
  const pendingEmail = ready
    ? (sessionStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY) ?? "")
    : "";
  return (
    <AuthShell
      eyebrow="Bảo mật tài khoản"
      title="Xác minh email"
      subtitle="Xác minh email để có thể đăng nhập bằng email và mật khẩu. Liên kết chỉ dùng một lần và có hiệu lực 24 giờ."
      visual={<AuthVisualPanel mode="register" />}
      footer={<Link href="/login">Đi tới đăng nhập</Link>}
    >
      <div className="mt-7 space-y-4">
        {(!ready || status === "loading") && (
          <p role="status" className="text-sm text-ink-muted">
            Đang kiểm tra liên kết xác minh…
          </p>
        )}
        {registered && missingToken && (
          <p
            role="status"
            className="rounded-lg border border-approved/40 bg-approved/10 px-4 py-3 text-sm text-approved"
          >
            Tài khoản đã được tạo. Hãy kiểm tra hộp thư để xác minh email.
          </p>
        )}
        {status === "success" && (
          <p
            role="status"
            className="rounded-lg border border-approved/40 bg-approved/10 px-4 py-3 text-sm text-approved"
          >
            {message}
          </p>
        )}
        {status === "error" && (
          <p role="alert" className={alertErrorClass}>
            {message}
          </p>
        )}
        {missingToken && !registered && status !== "success" && (
          <p role="alert" className={alertErrorClass}>
            Liên kết xác minh thiếu token.
          </p>
        )}

        {(missingToken || status === "error") &&
          status !== "success" &&
          pendingEmail && (
          <form
            onSubmit={resend}
            className="space-y-4 border-t border-line pt-5"
          >
            <button
              type="submit"
              disabled={resending || cooldown.seconds > 0}
              className={styles.submitButton}
            >
              {resending
                ? "Đang gửi…"
                : cooldown.seconds > 0
                  ? `Gửi lại sau ${cooldown.seconds}s`
                  : "Gửi lại xác minh"}
            </button>
          </form>
          )}
      </div>
    </AuthShell>
  );
}
