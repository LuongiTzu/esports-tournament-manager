"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CaretDownIcon,
  PlusIcon,
  ShieldCheckIcon,
  SignOutIcon,
  TrophyIcon,
  UserCircleIcon,
} from "@phosphor-icons/react";
import ResolvedImage from "@/components/ResolvedImage";
import { logout } from "@/features/auth/store";
import type { User } from "@/features/auth/types";
import { useLocale } from "@/features/locale/store";
import { THEME_OPTIONS } from "@/features/theme/options";
import { useTheme } from "@/features/theme/store";

export default function AccountMenu({ user }: { user: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLocale();
  const { mode: themeMode, setMode: setThemeMode } = useTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const accountSectionActive =
    pathname.startsWith("/profile") ||
    pathname.startsWith("/users/me") ||
    pathname.startsWith("/admin");

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("pointerdown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const handleLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setOpen(false);
    await logout();
    router.push("/");
  };

  const menuLinks = [
    {
      href: "/profile",
      label: t("profile.title"),
      icon: UserCircleIcon,
    },
    {
      href: "/users/me",
      label: t("nav.myTournaments"),
      icon: TrophyIcon,
    },
    {
      href: "/tournaments/new",
      label: t("nav.createTournament"),
      icon: PlusIcon,
    },
    ...(user.role === "ADMIN"
      ? [
          {
            href: "/admin",
            label: t("nav.admin"),
            icon: ShieldCheckIcon,
          },
        ]
      : []),
  ];

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={t("profile.title")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`flex h-11 max-w-48 items-center gap-2 rounded-xl px-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
          open || accountSectionActive
            ? "bg-brand/10 text-ink"
            : "text-ink/75 hover:bg-surface-hover hover:text-ink"
        }`}
      >
        <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-brand text-xs font-bold text-on-brand">
          <ResolvedImage
            src={user.avatarUrl}
            alt=""
            className="size-full object-cover object-center"
            fallback={user.displayName.charAt(0).toUpperCase()}
          />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          {user.displayName}
        </span>
        <CaretDownIcon
          size={14}
          weight="bold"
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t("profile.title")}
          className="absolute right-0 top-full z-[60] mt-2 w-64 overflow-hidden rounded-xl border border-line bg-surface-elevated p-1.5 shadow-[var(--shadow-elevated)]"
        >
          <div className="border-b border-line px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-ink">
              {user.displayName}
            </p>
            <p className="mt-0.5 truncate text-xs text-ink-faint">
              {user.email}
            </p>
          </div>

          <div className="py-1.5">
            {menuLinks.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                    active
                      ? "bg-brand/10 font-semibold text-brand"
                      : "text-ink-muted hover:bg-surface-hover hover:text-ink"
                  }`}
                >
                  <Icon size={18} weight={active ? "fill" : "regular"} />
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="border-t border-line px-2 py-2.5">
            <p className="px-1 text-xs font-medium text-ink-faint">
              {t("theme.label")}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg bg-surface-sub p-1">
              {THEME_OPTIONS.map((option) => {
                const Icon = option.icon;
                const active = themeMode === option.mode;
                return (
                  <button
                    key={option.mode}
                    type="button"
                    role="menuitemradio"
                    aria-label={t(option.label)}
                    aria-checked={active}
                    title={t(option.label)}
                    onClick={() => setThemeMode(option.mode)}
                    className={`grid h-8 place-items-center rounded-md transition ${
                      active
                        ? "bg-surface-card text-brand"
                        : "text-ink-faint hover:bg-surface-hover hover:text-ink"
                    }`}
                  >
                    <Icon size={16} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-line pt-1.5">
            <button
              type="button"
              role="menuitem"
              disabled={signingOut}
              onClick={() => void handleLogout()}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-rejected transition hover:bg-rejected/10 disabled:opacity-50"
            >
              <SignOutIcon size={18} />
              {t("nav.logout")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
