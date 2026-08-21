"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ListIcon,
  PlusIcon,
  SignOutIcon,
  XIcon,
} from "@phosphor-icons/react";
import { logout, useAuth } from "@/features/auth/store";
import { useLocale } from "@/features/locale/store";
import type { Locale } from "@/features/locale/types";
import ResolvedImage from "@/components/ResolvedImage";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/tournaments") {
    const segments = pathname.split("/").filter(Boolean);
    return (
      pathname === "/tournaments" ||
      (segments.length === 2 && segments[0] === "tournaments" && segments[1] !== "new")
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
      className="inline-flex shrink-0 items-center rounded-lg border border-line bg-surface/55 p-0.5"
    >
      {(["vi", "en"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLocale(option as Locale)}
          aria-pressed={locale === option}
          title={t(`language.${option}`)}
          className={`rounded-md px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
            locale === option
              ? "bg-brand/20 text-ink shadow-sm"
              : "text-ink-faint hover:text-ink"
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

  return (
    <header
      className={`sticky top-0 z-50 border-b backdrop-blur-xl transition duration-300 ${
        scrolled
          ? "border-brand/30 bg-surface/95 shadow-lg shadow-brand/10"
          : "border-line/70 bg-[image:var(--gradient-navbar)]"
      }`}
    >
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-[image:var(--gradient-border)] opacity-70" />
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          onClick={closeMenu}
          aria-label={t("nav.home")}
          className="group inline-flex min-w-0 shrink-0 items-center gap-2.5 font-bold text-ink"
        >
          <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg shadow-md shadow-brand/20 transition group-hover:shadow-glow-brand">
            <Image
              src="/images/global/arenaverse-logo.png"
              alt=""
              width={1254}
              height={1254}
              priority
              className="size-full object-cover"
            />
          </span>
          <span aria-hidden className="text-sm tracking-wide sm:text-base">
            ArenaVERSE
          </span>
        </Link>

        <nav aria-label={t("nav.main")} className="ml-5 hidden h-full items-center gap-1 lg:flex">
          {mainLinks.map((link) => {
            const active = !link.href.includes("#") && isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-full items-center px-3 text-sm font-medium transition after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-center after:bg-gradient-brand after:transition-transform ${
                  active
                    ? "text-ink after:scale-x-100"
                    : "text-ink-muted after:scale-x-0 hover:text-ink hover:after:scale-x-100"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto hidden items-center gap-1.5 lg:flex">
          <LanguageSwitcher />
          {!ready ? (
            <div aria-label={t("nav.loadingAccount")} className="ml-1 h-9 w-32 animate-pulse rounded-lg bg-surface-sub" />
          ) : user ? (
            <>
              <Link href="/users/me" className="ml-1 inline-flex max-w-40 items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-ink-muted transition hover:bg-white/5 hover:text-ink">
                <span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-full bg-brand text-xs font-bold text-on-brand">
                  <ResolvedImage
                    src={user.avatarUrl}
                    alt=""
                    className="size-full object-cover object-center"
                    fallback={user.displayName.charAt(0).toUpperCase()}
                  />
                </span>
                <span className="truncate">{user.displayName}</span>
              </Link>
              <Link href="/tournaments/new" className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-brand px-3.5 py-2 text-sm font-semibold text-on-brand shadow-md shadow-brand/20 transition hover:brightness-110 hover:shadow-glow-brand">
                <PlusIcon size={16} weight="bold" />
                {t("nav.createTournament")}
              </Link>
              <button type="button" onClick={handleLogout} aria-label={t("nav.logout")} className="rounded-lg p-2.5 text-ink-faint transition hover:bg-rejected/10 hover:text-rejected">
                <SignOutIcon size={18} />
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="ml-1 rounded-lg px-2.5 py-2 text-sm font-medium text-ink-muted transition hover:bg-white/5 hover:text-ink">
                {t("nav.login")}
              </Link>
              <Link href="/register" className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink transition hover:border-brand/50 hover:bg-brand/5">
                {t("nav.register")}
              </Link>
              <Link href="/tournaments/new" className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-brand px-3.5 py-2 text-sm font-semibold text-on-brand shadow-md shadow-brand/20 transition hover:brightness-110 hover:shadow-glow-brand">
                <PlusIcon size={16} weight="bold" />
                {t("nav.createTournament")}
              </Link>
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2 lg:hidden">
          <LanguageSwitcher compact />
          <button
            type="button"
            aria-label={menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen((open) => !open)}
            className="rounded-lg border border-line bg-surface/50 p-2 text-ink transition hover:border-brand/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {menuOpen ? <XIcon size={21} /> : <ListIcon size={21} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav id="mobile-navigation" aria-label={t("nav.mobile")} className="border-t border-line bg-surface/98 px-4 py-4 shadow-2xl shadow-black/30 lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1">
            {mainLinks.map((link) => {
              const active = !link.href.includes("#") && isActive(pathname, link.href);
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
            <div className="my-2 border-t border-line" />
            {ready && user ? (
              <>
                <Link href="/users/me" onClick={closeMenu} className="inline-flex items-center gap-2 truncate px-3 py-2 text-sm text-ink-muted">
                  <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-brand text-xs font-bold text-on-brand">
                    <ResolvedImage
                      src={user.avatarUrl}
                      alt=""
                      className="size-full object-cover object-center"
                      fallback={user.displayName.charAt(0).toUpperCase()}
                    />
                  </span>
                  <span className="truncate">{user.displayName}</span>
                </Link>
                <Link href="/tournaments/new" onClick={closeMenu} className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-brand px-3 py-2.5 text-sm font-semibold text-on-brand">
                  <PlusIcon size={16} weight="bold" />
                  {t("nav.createTournament")}
                </Link>
                <button type="button" onClick={handleLogout} className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-rejected">{t("nav.logout")}</button>
              </>
            ) : ready ? (
              <div className="grid grid-cols-2 gap-2">
                <Link href="/login" onClick={closeMenu} className="rounded-lg border border-line px-3 py-2.5 text-center text-sm font-medium text-ink">{t("nav.login")}</Link>
                <Link href="/register" onClick={closeMenu} className="rounded-lg border border-brand/40 bg-brand/10 px-3 py-2.5 text-center text-sm font-semibold text-ink">{t("nav.register")}</Link>
                <Link href="/tournaments/new" onClick={closeMenu} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-brand px-3 py-2.5 text-sm font-semibold text-on-brand">
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
