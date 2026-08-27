"use client";

import Image from "next/image";
import { GameControllerIcon } from "@phosphor-icons/react";
import { useLocale } from "@/features/locale/store";

export default function TournamentCreateHero() {
  const { t } = useLocale();

  return (
    <section className="relative isolate overflow-hidden rounded-2xl border border-line bg-surface-card shadow-[var(--shadow-elevated)]">
      <div
        aria-hidden
        className="absolute inset-0 -z-20 bg-[linear-gradient(110deg,color-mix(in_oklab,var(--color-brand)_13%,var(--color-surface-card))_0%,var(--color-surface-card)_48%,var(--color-surface-sub)_100%)]"
      />
      <div
        aria-hidden
        className="absolute inset-y-0 right-[36%] -z-10 hidden w-px rotate-[14deg] bg-line lg:block"
      />

      <div className="grid min-h-72 lg:grid-cols-[minmax(0,0.9fr)_minmax(28rem,1.1fr)]">
        <div className="flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-12 lg:py-12">
          <div className="flex items-center gap-3 text-brand-hover">
            <span className="grid size-10 place-items-center rounded-xl border border-brand/30 bg-brand/12">
              <GameControllerIcon size={22} weight="duotone" />
            </span>
            <p className="text-xs font-bold uppercase tracking-[0.2em]">
              {t("tournament.createHero.eyebrow")}
            </p>
          </div>
          <h1 className="mt-6 max-w-xl text-balance text-3xl font-black leading-tight tracking-tight text-ink sm:text-4xl lg:text-5xl">
            {t("tournament.createHero.title")}
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-6 text-ink-muted sm:text-base">
            {t("tournament.createHero.description")}
          </p>
        </div>

        <div className="relative hidden min-h-72 overflow-hidden border-l border-line/70 lg:block">
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--color-brand)_14%,transparent),transparent_58%),repeating-linear-gradient(135deg,transparent_0_22px,color-mix(in_oklab,var(--color-line)_55%,transparent)_23px_24px)]"
          />
          <Image
            src="/images/home/benefits/adc-player.png"
            alt=""
            width={1250}
            height={1086}
            priority
            sizes="(min-width: 1024px) 360px, 0px"
            className="absolute -bottom-8 left-0 h-[108%] w-auto object-contain object-bottom opacity-90"
          />
          <Image
            src="/images/home/benefits/levi-player.png"
            alt=""
            width={1450}
            height={1086}
            priority
            sizes="(min-width: 1024px) 390px, 0px"
            className="absolute -bottom-10 right-0 h-[112%] w-auto object-contain object-bottom"
          />
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-surface-card to-transparent"
          />
        </div>
      </div>
    </section>
  );
}
