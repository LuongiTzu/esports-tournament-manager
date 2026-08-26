"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale } from "@/features/locale/store";

export default function Footer() {
  const { t } = useLocale();
  const footerLinks = [
    { href: "/", label: t("nav.home") },
    { href: "/tournaments", label: t("footer.discover") },
    { href: "/#formats", label: t("footer.formats") },
  ];
  const legalLinks = [
    { href: "/terms", label: t("footer.terms") },
    { href: "/privacy", label: t("footer.privacy") },
    { href: "/personal-data-policy", label: t("footer.personalData") },
  ];

  return (
    <footer className="relative border-t border-line bg-surface-card/75">
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-[image:var(--gradient-border)]" />
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div className="max-w-md">
          <Link href="/" className="inline-flex items-center gap-2.5 font-bold text-ink">
            <span className="relative grid size-9 place-items-center overflow-hidden rounded-lg shadow-md shadow-brand/20">
              <Image
                src="/images/global/logo-web-cut-background.png"
                alt=""
                width={1280}
                height={1280}
                className="size-full object-contain"
              />
            </span>
            Esports Tournament Manager
          </Link>
          <p className="mt-4 text-sm leading-6 text-ink-muted">{t("footer.description")}</p>
        </div>

        <nav aria-label={t("footer.product")}>
          <h2 className="text-sm font-semibold text-ink">{t("footer.product")}</h2>
          <ul className="mt-4 space-y-3 text-sm text-ink-muted">
            {footerLinks.map((link) => (
              <li key={link.href}>
                <Link className="transition hover:text-brand" href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="text-sm font-semibold text-ink">{t("footer.getStarted")}</h2>
          <div className="mt-4 flex flex-col items-start gap-3 text-sm text-ink-muted">
            <Link className="transition hover:text-brand" href="/tournaments/new">{t("nav.createTournament")}</Link>
            <Link className="transition hover:text-brand" href="/register">{t("footer.createAccount")}</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 text-xs text-ink-faint sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p>
            © {new Date().getFullYear()} Esports Tournament Manager. {t("footer.copyright")}
          </p>
          <nav
            aria-label={t("footer.legal")}
            className="flex flex-wrap items-center gap-x-4 gap-y-2"
          >
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition hover:text-brand"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
