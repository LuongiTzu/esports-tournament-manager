"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRightIcon, LightningIcon } from "@phosphor-icons/react";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { useLocale } from "@/features/locale/store";

export default function HeroSection() {
  const { t } = useLocale();

  return (
    <section className="relative isolate overflow-hidden border-b border-line">
      <Image
        src="/images/home/hero/hero-background.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover object-center"
      />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,color-mix(in_oklab,var(--color-surface)_82%,transparent)_0%,color-mix(in_oklab,var(--color-surface)_56%,transparent)_48%,color-mix(in_oklab,var(--color-surface)_38%,transparent)_100%),linear-gradient(to_bottom,color-mix(in_oklab,var(--color-surface)_18%,transparent),var(--color-surface))]" />
      <div className="mx-auto grid min-h-[calc(100svh-4rem)] max-w-7xl items-center gap-14 px-4 py-20 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:px-8 lg:py-24">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand-hover shadow-sm shadow-brand/10">
            <LightningIcon size={15} weight="fill" />
            {t("home.hero.badge")}
          </div>
          <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-[1.08] tracking-[-0.04em] text-ink sm:text-6xl lg:text-7xl">
            {t("home.hero.title")} {" "}
            <span className="bg-gradient-brand bg-clip-text text-transparent">{t("home.hero.highlight")}</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-ink-muted sm:text-lg">{t("home.hero.description")}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/tournaments/new" className={`${primaryButtonClass} px-6 py-3`}>
              {t("home.hero.create")}
              <ArrowRightIcon size={17} weight="bold" />
            </Link>
            <Link href="/tournaments" className={`${secondaryButtonClass} px-6 py-3`}>{t("home.hero.discover")}</Link>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-lg">
          <div aria-hidden className="absolute -inset-8 rounded-full border border-brand/15 shadow-glow-brand" />
          <div aria-hidden className="absolute inset-8 rounded-full border border-dashed border-brand-secondary/25" />
          <div className="relative overflow-hidden rounded-3xl border border-brand/25 bg-surface-card/85 shadow-2xl shadow-black/25 backdrop-blur">
            <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-[image:var(--gradient-border)]" />
            <Image
              src="/images/home/hero/tournament-crowd.jpg"
              alt={t("home.hero.illustration")}
              width={628}
              height={419}
              priority
              sizes="(min-width: 1024px) 42vw, (min-width: 640px) 75vw, 100vw"
              className="h-auto w-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
