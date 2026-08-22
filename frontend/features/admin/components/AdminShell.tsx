"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChartBarIcon,
  FlagIcon,
  GavelIcon,
  ShieldCheckIcon,
  TrophyIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import ResolvedImage from "@/components/ResolvedImage";
import { useAuth } from "@/features/auth/store";
import { useLocale, type TranslationKey } from "@/features/locale/store";

const navigation = [
  { labelKey: "admin.nav.overview", href: "/admin", icon: ChartBarIcon },
  { labelKey: "admin.nav.users", href: "/admin/users", icon: UsersThreeIcon },
  { labelKey: "admin.nav.tournaments", href: "/admin/tournaments", icon: TrophyIcon },
  { labelKey: "admin.nav.reports", href: "/admin/reports", icon: FlagIcon },
  { labelKey: "admin.nav.moderation", href: "/admin/moderation", icon: GavelIcon },
] as const;

function AccessLoading({ label }: { label: string }) {
  return (
    <div className="mx-auto grid min-h-[60vh] w-full max-w-7xl place-items-center px-4">
      <div aria-label={label} className="w-full max-w-sm space-y-3">
        <div className="h-4 w-32 animate-pulse rounded bg-surface-sub" />
        <div className="h-16 animate-pulse rounded-xl bg-surface-card" />
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
    <div className="mx-auto grid w-full max-w-[90rem] flex-1 gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-7 lg:px-8 lg:py-8">
      <aside className="min-w-0 lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)]">
        <div className="rounded-2xl border border-line bg-surface-card p-3 shadow-[var(--shadow-elevated)] lg:flex lg:h-full lg:flex-col">
          <div className="flex items-center gap-3 border-b border-line px-2 pb-4 pt-1">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-brand text-on-brand shadow-md shadow-brand/20">
              <ShieldCheckIcon size={22} weight="duotone" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
                Administration
              </p>
              <p className="truncate text-sm font-bold text-ink">{t("admin.shell.console")}</p>
            </div>
          </div>

          <nav aria-label={t("admin.shell.navigation")} className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            {navigation.map((item) => {
              const Icon = item.icon;
              const label = t(item.labelKey as TranslationKey);
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    active
                      ? "bg-brand/12 text-brand"
                      : "text-ink-muted hover:bg-surface-hover hover:text-ink"
                  }`}
                >
                  <Icon size={18} weight={active ? "fill" : "regular"} />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 hidden border-t border-line px-2 pt-4 lg:mt-auto lg:block">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-brand text-xs font-bold text-on-brand">
                <ResolvedImage
                  src={user.avatarUrl}
                  alt=""
                  className="size-full object-cover object-center"
                  fallback={user.displayName.charAt(0).toUpperCase()}
                />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{user.displayName}</p>
                <p className="truncate text-xs text-ink-faint">{t("admin.shell.identity")}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <section className="min-w-0">{children}</section>
    </div>
  );
}
