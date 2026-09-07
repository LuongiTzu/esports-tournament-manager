"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChartBarIcon,
  CaretRightIcon,
  FlagIcon,
  GavelIcon,
  TrophyIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { useAuth } from "@/features/auth/store";
import GamePosterGridBackground from "@/features/home/components/hero/GamePosterGridBackground";
import { useLocale, type TranslationKey } from "@/features/locale/store";

const navigationGroups = [
  {
    labelKey: "admin.shell.sectionOverview",
    items: [
      { labelKey: "admin.nav.overview", href: "/admin", icon: ChartBarIcon },
    ],
  },
  {
    labelKey: "admin.shell.sectionManagement",
    items: [
      {
        labelKey: "admin.nav.users",
        href: "/admin/users",
        icon: UsersThreeIcon,
      },
      {
        labelKey: "admin.nav.tournaments",
        href: "/admin/tournaments",
        icon: TrophyIcon,
      },
    ],
  },
  {
    labelKey: "admin.shell.sectionSafety",
    items: [
      {
        labelKey: "admin.nav.reports",
        href: "/admin/reports",
        icon: FlagIcon,
      },
      {
        labelKey: "admin.nav.moderation",
        href: "/admin/moderation",
        icon: GavelIcon,
      },
    ],
  },
] as const;

function AccessLoading({ label }: { label: string }) {
  return (
    <div className="admin-console grid min-h-[calc(100vh-3.5rem)] w-full place-items-center px-4">
      <div aria-label={label} className="w-full max-w-sm space-y-3">
        <div className="h-4 w-32 animate-pulse rounded bg-surface-sub" />
        <div className="h-20 animate-pulse rounded-2xl bg-surface-card" />
      </div>
    </div>
  );
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, ready } = useAuth();
  const { t } = useLocale();

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/login");
    else if (user.role !== "ADMIN") router.replace("/");
  }, [ready, router, user]);

  if (!ready || !user || user.role !== "ADMIN") {
    return <AccessLoading label={t("admin.shell.verifying")} />;
  }

  return (
    <div className="admin-console relative isolate min-h-[calc(100vh-3.5rem)] w-full flex-1 overflow-x-clip">
      <GamePosterGridBackground dense fixed />

      <div className="relative grid w-full items-start gap-3 px-3 py-3 sm:px-5 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-0 lg:px-0 lg:py-0 xl:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="min-w-0 self-start lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)]">
          <div className="admin-sidebar flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface-card/75 shadow-[var(--shadow-elevated)] backdrop-blur-xl lg:rounded-none lg:border-y-0 lg:border-l-0">
            <nav
              aria-label={t("admin.shell.navigation")}
              className="admin-navigation flex gap-2 overflow-x-auto p-3 lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-0 lg:overflow-x-hidden lg:overflow-y-auto lg:px-3 lg:py-4"
            >
              {navigationGroups.map((group) => (
                <div
                  key={group.labelKey}
                  className="contents lg:mb-6 lg:block lg:last:mb-0"
                >
                  <p className="mb-2 hidden px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-faint lg:block">
                    {t(group.labelKey as TranslationKey)}
                  </p>
                  <div className="contents lg:block lg:space-y-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const label = t(item.labelKey as TranslationKey);
                      const active =
                        item.href === "/admin"
                          ? pathname === item.href
                          : pathname === item.href ||
                            pathname.startsWith(`${item.href}/`);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={`group relative inline-flex min-h-11 shrink-0 items-center gap-3 overflow-hidden rounded-lg border px-3 py-2.5 text-sm font-semibold transition-all duration-200 lg:flex lg:w-full ${
                            active
                              ? "border-brand-secondary/20 bg-brand-secondary/10 text-ink"
                              : "border-transparent text-ink-muted hover:border-line/80 hover:bg-surface-hover hover:text-ink"
                          }`}
                        >
                          {active && (
                            <span className="absolute inset-y-0 left-0 w-0.5 bg-brand-secondary shadow-md shadow-brand-secondary/30" />
                          )}
                          <Icon
                            size={17}
                            weight={active ? "fill" : "regular"}
                            className={
                              active
                                ? "text-brand-secondary"
                                : "text-ink-faint transition group-hover:text-brand-secondary"
                            }
                          />
                          <span className="flex-1 text-left">{label}</span>
                          <CaretRightIcon
                            size={12}
                            className={`hidden lg:block ${
                              active
                                ? "text-brand-secondary"
                                : "text-ink-faint/70"
                            }`}
                          />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </aside>

        <section className="admin-content min-w-0 pb-5 lg:px-6 lg:py-6">
          {children}
        </section>
      </div>
    </div>
  );
}
