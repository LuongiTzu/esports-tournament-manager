"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AuthShell from "@/features/auth/components/AuthShell";
import AuthVisualPanel from "@/features/auth/components/AuthVisualPanel";
import { authApi } from "@/features/auth/api";
import { alertErrorClass } from "@/components/ui";
import { clearSession } from "@/features/auth/store";
import { useSensitiveToken } from "@/features/auth/hooks/useSensitiveToken";

export default function ConfirmEmailChangePage() {
  const { ready, token } = useSensitiveToken();
  const attempted = useRef(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready || !token || attempted.current) return;
    attempted.current = true;
    setLoading(true);
    authApi
      .confirmEmailChange(token)
      .then((result) => {
        clearSession();
        setSuccess(result.message);
      })
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Liên kết đổi email không hợp lệ hoặc đã hết hạn",
        ),
      )
      .finally(() => setLoading(false));
  }, [ready, token]);

  return (
    <AuthShell
      eyebrow="Bảo mật tài khoản"
      title="Xác nhận email mới"
      subtitle="ArenaVerse chỉ cập nhật email đăng nhập sau khi liên kết dùng một lần này được xác nhận."
      visual={<AuthVisualPanel mode="register" />}
      footer={<Link href="/login">Quay lại đăng nhập</Link>}
    >
      <div className="mt-7 space-y-4">
        {(!ready || loading) && (
          <p role="status" className="text-sm text-ink-muted">
            Đang xác nhận email mới…
          </p>
        )}
        {ready && !token && (
          <p role="alert" className={alertErrorClass}>
            Liên kết đổi email thiếu token.
          </p>
        )}
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
      </div>
    </AuthShell>
  );
}
