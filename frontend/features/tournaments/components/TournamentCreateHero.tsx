"use client";

import Image from "next/image";
import {
  DeviceMobileIcon,
  GameControllerIcon,
  KeyboardIcon,
} from "@phosphor-icons/react";
import { useLocale } from "@/features/locale/store";

export default function TournamentCreateHero() {
  const { t } = useLocale();
  return (
    <section className="relative isolate min-h-64 overflow-hidden rounded-3xl border border-line bg-surface-card/75 shadow-[var(--shadow-elevated)] sm:min-h-72">
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 -z-20 size-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand/20"
      />
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 -z-20 size-[20rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-brand-secondary/20"
      />
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 -z-20 size-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/15 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-30 bg-[radial-gradient(circle_at_8%_80%,color-mix(in_oklab,var(--color-brand)_18%,transparent),transparent_34%),radial-gradient(circle_at_92%_25%,color-mix(in_oklab,var(--color-brand-secondary)_16%,transparent),transparent_34%)]"
      />

      <div className="relative z-20 mx-auto flex min-h-64 max-w-lg flex-col items-center justify-center px-6 py-12 text-center sm:min-h-72 xl:max-w-2xl">
        <span className="grid size-14 place-items-center rounded-2xl border border-brand/30 bg-brand/15 text-brand-hover shadow-glow-brand backdrop-blur">
          <GameControllerIcon size={32} weight="duotone" />
        </span>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.28em] text-brand-hover">
          {t("tournament.createHero.eyebrow")}
        </p>
        <h1 className="mt-3 text-balance text-3xl font-black tracking-tight text-ink sm:text-4xl">
          {t("tournament.createHero.title")}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-ink-muted sm:text-base">
          {t("tournament.createHero.description")}
        </p>
      </div>

      <div className="pointer-events-none absolute bottom-0 left-0 z-10 hidden w-52 lg:block xl:left-4 xl:w-72">
        <div className="absolute -bottom-8 -left-12 -z-20 size-72 rounded-full bg-brand/25 blur-3xl" />
        <DeviceMobileIcon
          aria-hidden
          size={230}
          weight="duotone"
          className="absolute -bottom-5 -left-12 -z-10 rotate-[-16deg] text-brand/45 drop-shadow-[0_0_34px_color-mix(in_oklab,var(--color-brand)_72%,transparent)]"
        />
        <Image
          src="/images/home/benefits/adc-player.png"
          alt=""
          width={1250}
          height={1086}
          sizes="288px"
          className="relative z-10 h-auto w-full object-contain drop-shadow-[0_18px_26px_rgba(124,58,237,0.22)]"
        />
      </div>

      <div className="pointer-events-none absolute bottom-8 right-0 z-10 hidden w-56 lg:block xl:right-4 xl:w-80">
        <div className="absolute -bottom-10 -right-14 -z-20 size-72 rounded-full bg-brand-secondary/22 blur-3xl" />
        <KeyboardIcon
          aria-hidden
          size={245}
          weight="duotone"
          className="absolute -bottom-10 -right-16 -z-10 rotate-12 text-brand-secondary/45 drop-shadow-[0_0_34px_color-mix(in_oklab,var(--color-brand-secondary)_68%,transparent)]"
        />
        <Image
          src="/images/home/benefits/levi-player.png"
          alt=""
          width={1450}
          height={1086}
          sizes="320px"
          className="relative z-10 h-auto w-full object-contain drop-shadow-[0_18px_26px_rgba(239,35,60,0.2)]"
        />
      </div>
    </section>
  );
}
