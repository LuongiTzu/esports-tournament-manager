"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlusIcon, SignOutIcon, TrophyIcon } from "@phosphor-icons/react";
import { logout, useAuth } from "@/features/auth/store";

export default function Navbar() {
  const router = useRouter();
  const { user, ready } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  return (
    <header className="border-b border-line bg-surface-card">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-base font-bold text-ink"
        >
          <TrophyIcon size={22} weight="duotone" className="text-brand" />
          Esports Hub
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
          {ready && user ? (
            <>
              <Link
                href="/tournaments/new"
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-on-brand transition hover:bg-brand/90 active:translate-y-px"
              >
                <PlusIcon size={16} weight="bold" />
                Tạo giải
              </Link>
              <Link
                href="/users/me"
                className="rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition hover:text-ink"
              >
                {user.displayName}
              </Link>
              <button
                onClick={handleLogout}
                aria-label="Đăng xuất"
                className="rounded-lg p-2 text-ink-faint transition hover:text-rejected"
              >
                <SignOutIcon size={18} />
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition hover:text-ink"
              >
                Đăng nhập
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-on-brand transition hover:bg-brand/90 active:translate-y-px"
              >
                Đăng ký
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
