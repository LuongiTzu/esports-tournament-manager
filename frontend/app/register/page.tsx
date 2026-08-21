"use client";

import { useState } from "react";
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
  UserPlusIcon,
} from "@phosphor-icons/react";
import { authApi } from "@/features/auth/api";
import AuthShell from "@/features/auth/components/AuthShell";
import AuthVisualPanel from "@/features/auth/components/AuthVisualPanel";
import type { Gender } from "@/features/auth/types";
import {
  alertErrorClass,
  authSubmitButtonClass,
  hintClass,
  inputClass,
  labelClass,
} from "@/components/ui";

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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
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
      setError(err instanceof Error ? err.message : "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Tạo tài khoản"
      subtitle="Một tài khoản dùng được cho cả vai trò ban tổ chức và người tham gia."
      eyebrow="Gia nhập đấu trường"
      visual={<AuthVisualPanel mode="register" />}
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
            Tên hiển thị <span className="text-brand-secondary">*</span>
          </label>
          <div className="relative">
            <UserCircleIcon
              aria-hidden
              size={19}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint"
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
              className={`${inputClass} pl-11`}
              placeholder="Tên bạn muốn hiển thị"
            />
          </div>
          <p className={hintClass}>Từ 2 đến 50 ký tự.</p>
        </div>

        <div>
          <label htmlFor="email" className={labelClass}>
            Email <span className="text-brand-secondary">*</span>
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
              name="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              className={`${inputClass} pl-11`}
              placeholder="ban@vidu.com"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="phoneNumber" className={labelClass}>
              Số điện thoại
            </label>
            <div className="relative">
              <PhoneIcon
                aria-hidden
                size={19}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint"
              />
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
                className={`${inputClass} pl-11`}
                placeholder="09xxxxxxxx"
              />
            </div>
          </div>

          <div>
            <label htmlFor="birthDate" className={labelClass}>
              Ngày sinh
            </label>
            <div className="relative">
              <CalendarBlankIcon
                aria-hidden
                size={19}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint"
              />
              <input
                id="birthDate"
                type="date"
                name="birthDate"
                autoComplete="bday"
                value={form.birthDate}
                onChange={handleChange}
                className={`${inputClass} pl-11`}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[0.72fr_1.28fr]">
          <div>
            <label htmlFor="gender" className={labelClass}>
              Giới tính
            </label>
            <div className="relative">
              <GenderIntersexIcon
                aria-hidden
                size={19}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint"
              />
              <select
                id="gender"
                name="gender"
                value={form.gender}
                onChange={handleChange}
                className={`${inputClass} pl-11`}
              >
                <option value="">Không chọn</option>
                <option value="MALE">Nam</option>
                <option value="FEMALE">Nữ</option>
                <option value="OTHER">Khác</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="currentAddress" className={labelClass}>
              Nơi ở hiện tại
            </label>
            <div className="relative">
              <MapPinIcon
                aria-hidden
                size={19}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint"
              />
              <input
                id="currentAddress"
                type="text"
                name="currentAddress"
                maxLength={200}
                autoComplete="street-address"
                value={form.currentAddress}
                onChange={handleChange}
                className={`${inputClass} pl-11`}
                placeholder="Tỉnh/thành phố"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="password" className={labelClass}>
              Mật khẩu <span className="text-brand-secondary">*</span>
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
                name="password"
                required
                minLength={6}
                maxLength={50}
                autoComplete="new-password"
                value={form.password}
                onChange={handleChange}
                className={`${inputClass} px-11`}
                placeholder="Ít nhất 6 ký tự"
              />
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className={labelClass}>
              Xác nhận <span className="text-brand-secondary">*</span>
            </label>
            <div className="relative">
              <LockKeyIcon
                aria-hidden
                size={19}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint"
              />
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                name="confirmPassword"
                required
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={handleChange}
                className={`${inputClass} px-11`}
                placeholder="Nhập lại mật khẩu"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                aria-pressed={showPassword}
                className="absolute right-1.5 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-ink-faint transition hover:bg-surface-hover hover:text-brand-hover focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
              >
                {showPassword ? <EyeSlashIcon size={19} /> : <EyeIcon size={19} />}
              </button>
            </div>
          </div>
        </div>

        <p className={hintClass}>
          Các trường không có dấu * là tùy chọn và có thể cập nhật sau.
        </p>

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
          {loading ? "Đang tạo tài khoản..." : "Đăng ký"}
          {!loading && <UserPlusIcon size={18} weight="bold" />}
        </button>
      </form>
    </AuthShell>
  );
}
