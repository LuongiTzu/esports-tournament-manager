"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ListIcon, PlusIcon, XIcon } from "@phosphor-icons/react";
import { logout, useAuth } from "@/features/auth/store";
import { useLocale } from "@/features/locale/store";
import type { Locale } from "@/features/locale/types";
import ResolvedImage from "@/components/ResolvedImage";
import ThemeSwitcher from "@/features/theme/ThemeSwitcher";
import NotificationCenter from "@/features/notifications/components/NotificationCenter";
import AnimatedBrandName from "@/components/brand/AnimatedBrandName";
import AccountMenu from "@/components/navigation/AccountMenu";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/tournaments") {
    const segments = pathname.split("/").filter(Boolean);
    return (
      pathname === "/tournaments" ||
      (segments.length === 2 &&
        segments[0] === "tournaments" &&
        segments[1] !== "new")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useLocale();

  return (
    <div
      role="group"
      aria-label={t("language.label")}
      className="inline-flex shrink-0 items-center rounded-full bg-surface-sub/75 p-0.5"
    >
      {(["vi", "en"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLocale(option as Locale)}
          aria-pressed={locale === option}
          title={t(`language.${option}`)}
          className={`rounded-full px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
            locale === option
              ? "bg-brand/20 text-ink"
              : "text-ink/55 hover:text-ink"
          } ${compact ? "sm:px-2.5" : "px-2.5"}`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, ready } = useAuth();
  const { t } = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const updateScrolled = () => setScrolled(window.scrollY > 8);
    updateScrolled();
    window.addEventListener("scroll", updateScrolled, { passive: true });
    return () => window.removeEventListener("scroll", updateScrolled);
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  const handleLogout = async () => {
    closeMenu();
    await logout();
    router.push("/");
  };

  const mainLinks = [
    { href: "/", label: t("nav.home") },
    { href: "/tournaments", label: t("nav.tournaments") },
    ...(user ? [{ href: "/users/me", label: t("nav.myTournaments") }] : []),
  ];
  const mobileLinks = [
    ...mainLinks,
    ...(user?.role === "ADMIN"
      ? [{ href: "/admin", label: t("nav.admin") }]
      : []),
  ];

  return (
    <header
      className={`sticky top-0 z-50 border-b backdrop-blur-xl transition duration-300 ${
        scrolled
          ? "border-line bg-surface/95 shadow-md shadow-black/10"
          : "border-line/70 bg-[image:var(--gradient-navbar)]"
      }`}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-0.5 bg-gradient-brand"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px bg-[image:var(--gradient-border)] opacity-70"
      />
      <div className="mx-auto grid h-14 max-w-[90rem] grid-cols-[auto_1fr] items-center gap-4 px-4 sm:px-6 xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:px-8">
        <Link
          href="/"
          onClick={closeMenu}
          aria-label={t("nav.home")}
          className="group inline-flex min-w-0 shrink-0 items-center gap-2.5 font-bold text-ink"
        >
          <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg shadow-md shadow-brand/20">
            <Image
              src="/images/global/logo-web-cut-background.png"
              alt=""
              width={1280}
              height={1280}
              priority
              className="size-full object-contain"
            />
          </span>
          <AnimatedBrandName />
        </Link>

        <nav
          aria-label={t("nav.main")}
          className="hidden h-full items-center justify-center gap-1 xl:flex"
        >
          {mainLinks.map((link) => {
            const active =
              !link.href.includes("#") && isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-full items-center px-4 text-sm font-semibold transition after:absolute after:inset-x-4 after:bottom-[3px] after:h-0.5 after:origin-center after:rounded-full after:bg-gradient-brand after:transition-transform ${
                  active
                    ? "text-ink after:scale-x-100"
                    : "text-ink/65 after:scale-x-0 hover:text-ink hover:after:scale-x-100"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <NotificationCenter />
          <div className="hidden items-center gap-2 xl:flex">
            <LanguageSwitcher />
            <Link
              href="/tournaments/new"
              className="inline-flex h-10 items-center gap-1.5 px-2 text-sm font-semibold text-ink/70 transition hover:text-ink"
            >
              <PlusIcon size={16} weight="bold" />
              {t("nav.createTournament")}
            </Link>
            {!ready ? (
              <div
                aria-label={t("nav.loadingAccount")}
                className="h-11 w-40 animate-pulse rounded-xl bg-surface-sub"
              />
            ) : user ? (
              <AccountMenu user={user} />
            ) : (
              <>
                <ThemeSwitcher iconOnly />
                <Link
                  href="/login"
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-muted transition hover:bg-surface-hover hover:text-ink"
                >
                  {t("nav.login")}
                </Link>
                <Link
                  href="/register"
                  className="rounded-xl bg-brand/10 px-3.5 py-2 text-sm font-semibold text-ink transition hover:bg-brand/15"
                >
                  {t("nav.register")}
                </Link>
              </>
            )}
          </div>

          <div className="flex items-center xl:hidden">
            <button
              type="button"
              aria-label={menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMenuOpen((open) => !open)}
              className="grid size-10 place-items-center rounded-xl bg-surface-sub/75 text-ink transition hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {menuOpen ? <XIcon size={21} /> : <ListIcon size={21} />}
            </button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <nav
          id="mobile-navigation"
          aria-label={t("nav.mobile")}
          className="border-t border-line bg-surface/98 px-4 py-4 shadow-[var(--shadow-elevated)] xl:hidden"
        >
          <div className="mx-auto flex max-w-[90rem] flex-col gap-1">
            {mobileLinks.map((link) => {
              const active =
                !link.href.includes("#") && isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMenu}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-lg border-l-2 px-3 py-2.5 text-sm font-medium transition ${active ? "border-brand bg-brand/10 text-ink" : "border-transparent text-ink-muted hover:bg-surface-sub hover:text-ink"}`}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="my-2 grid gap-2 border-y border-line py-3 sm:grid-cols-2">
              <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface-card px-3 py-2">
                <span className="text-xs font-medium text-ink-muted">
                  {t("language.label")}
                </span>
                <LanguageSwitcher compact />
              </div>
              <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface-card px-3 py-2">
                <span className="text-xs font-medium text-ink-muted">
                  {t("theme.label")}
                </span>
                <ThemeSwitcher />
              </div>
            </div>
            {ready && user ? (
              <>
                <Link
                  href="/profile"
                  onClick={closeMenu}
                  className="my-1 inline-flex items-center gap-3 truncate rounded-xl border border-line bg-surface-card px-3 py-3 text-sm text-ink-muted"
                >
                  <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-brand text-xs font-bold text-on-brand">
                    <ResolvedImage
                      src={user.avatarUrl}
                      alt=""
                      className="size-full object-cover object-center"
                      fallback={user.displayName.charAt(0).toUpperCase()}
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">
                      {user.displayName}
                    </span>
                    <span className="block truncate text-xs text-ink-faint">
                      {user.email}
                    </span>
                  </span>
                </Link>
                <Link
                  href="/tournaments/new"
                  onClick={closeMenu}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-ink-muted transition hover:bg-surface-hover hover:text-ink"
                >
                  <PlusIcon size={16} weight="bold" />
                  {t("nav.createTournament")}
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-rejected"
                >
                  {t("nav.logout")}
                </button>
              </>
            ) : ready ? (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/login"
                  onClick={closeMenu}
                  className="rounded-lg border border-line px-3 py-2.5 text-center text-sm font-medium text-ink"
                >
                  {t("nav.login")}
                </Link>
                <Link
                  href="/register"
                  onClick={closeMenu}
                  className="rounded-lg border border-brand/40 bg-brand/10 px-3 py-2.5 text-center text-sm font-semibold text-ink"
                >
                  {t("nav.register")}
                </Link>
                <Link
                  href="/tournaments/new"
                  onClick={closeMenu}
                  className="col-span-2 inline-flex items-center justify-center gap-2 rounded-lg bg-surface-sub px-3 py-2.5 text-sm font-semibold text-ink transition hover:bg-surface-hover"
                >
                  <PlusIcon size={16} weight="bold" />
                  {t("nav.createTournament")}
                </Link>
              </div>
            ) : (
              <div className="h-10 animate-pulse rounded-lg bg-surface-sub" />
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
