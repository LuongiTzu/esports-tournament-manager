"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import SideRays from "@/components/effects/SideRays";
import { useLocale } from "@/features/locale/store";
import styles from "./AuthSurface.module.css";

/** Khung 2 cột cho trang đăng nhập / đăng ký — tránh bố cục card căn giữa mặc định */
export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
  visual,
  eyebrow,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
  visual?: ReactNode;
  eyebrow?: string;
}) {
  const { t } = useLocale();
  const resolvedEyebrow = eyebrow ?? t("auth.login.eyebrow");
  if (visual) {
    return (
      <div className={`${styles.page} relative isolate flex w-full flex-1 items-center overflow-hidden px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-14`}>
        <SideRays
          speed={2.5}
          rayColor1="#EAB308"
          rayColor2="#96C8FF"
          intensity={2}
          spread={2}
          origin="top-right"
          tilt={0}
          saturation={1.5}
          blend={0.75}
          falloff={1.6}
          opacity={1}
        />

        <div
          aria-hidden
          className="absolute left-[8%] top-[12%] -z-10 size-80 rounded-full bg-brand/10 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute bottom-[8%] right-[6%] -z-10 size-80 rounded-full bg-brand-secondary/10 blur-3xl"
        />

        <div className={`${styles.frame} relative z-10 mx-auto grid w-full max-w-[69.375rem] overflow-hidden rounded-[1.25rem] border md:grid-cols-[1.05fr_0.95fr]`}>
          {visual}
          <section className={`${styles.formPanel} flex min-h-[34rem] flex-col justify-center p-6 sm:p-9 md:p-8 lg:p-10`}>
            <div className={styles.formContent}>
              <p className={`${styles.eyebrow} text-sm font-semibold uppercase tracking-[0.18em]`}>
                {resolvedEyebrow}
              </p>
              <h1 className={`${styles.title} mt-3 text-[1.625rem] font-bold leading-9`}>
                {title}
              </h1>
              <p className={`${styles.subtitle} mt-2 max-w-md text-sm leading-6`}>
                {subtitle}
              </p>
              {children}
              <p className={`${styles.footer} mt-6 text-center text-sm leading-6`}>
                {footer}
              </p>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl flex-1 gap-12 px-4 py-12 lg:grid-cols-[1fr_400px] lg:items-center lg:gap-16 lg:py-20">
      <div className="hidden lg:block">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand"
        >
          <Image
            src="/images/global/logo-web-cut-background.png"
            alt=""
            width={1280}
            height={1280}
            className="size-5 object-contain"
          />
          Esports Hub
        </Link>
        <h2 className="mt-6 text-4xl font-bold tracking-tight text-ink">
          {t("auth.brand.titleLine1")}
          <br />
          {t("auth.brand.titleLine2")}
        </h2>
        <p className="mt-4 max-w-md text-ink-muted">
          {t("auth.brand.description")}
        </p>
      </div>

      <div className="rounded-xl border border-line bg-surface-card p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-ink">{title}</h1>
        <p className="mt-1.5 text-sm text-ink-muted">{subtitle}</p>
        {children}
        <p className="mt-6 text-center text-sm text-ink-muted">{footer}</p>
      </div>
    </div>
  );
}
