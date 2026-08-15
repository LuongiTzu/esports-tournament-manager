"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi } from "@/features/auth/api";
import AuthShell from "@/features/auth/components/AuthShell";
import {
  alertErrorClass,
  hintClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    setLoading(true);
    try {
      await authApi.register({
        displayName: form.displayName,
        email: form.email,
        password: form.password,
      });
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Tạo tài khoản"
      subtitle="Một tài khoản dùng được cho cả vai trò ban tổ chức và người tham gia."
      footer={
        <>
          Đã có tài khoản?{" "}
          <Link href="/login" className="font-medium text-brand hover:underline">
            Đăng nhập
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="displayName" className={labelClass}>
            Tên hiển thị
          </label>
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
            className={inputClass}
            placeholder="Tên bạn muốn hiển thị"
          />
          <p className={hintClass}>Từ 2 đến 50 ký tự.</p>
        </div>

        <div>
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input
            id="email"
            type="email"
            name="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            className={inputClass}
            placeholder="ban@vidu.com"
          />
        </div>

        <div>
          <label htmlFor="password" className={labelClass}>
            Mật khẩu
          </label>
          <input
            id="password"
            type="password"
            name="password"
            required
            minLength={6}
            maxLength={50}
            autoComplete="new-password"
            value={form.password}
            onChange={handleChange}
            className={inputClass}
            placeholder="Ít nhất 6 ký tự"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className={labelClass}>
            Xác nhận mật khẩu
          </label>
          <input
            id="confirmPassword"
            type="password"
            name="confirmPassword"
            required
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={handleChange}
            className={inputClass}
            placeholder="Nhập lại mật khẩu"
          />
        </div>

        {error && (
          <p role="alert" className={alertErrorClass}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`${primaryButtonClass} w-full`}
        >
          {loading ? "Đang tạo tài khoản..." : "Đăng ký"}
        </button>
      </form>
    </AuthShell>
  );
}
