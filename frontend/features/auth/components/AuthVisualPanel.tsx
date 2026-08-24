"use client";

import { LightningIcon } from "@phosphor-icons/react/dist/ssr";
import RotatingImage from "@/components/RotatingImage";
import { useLocale } from "@/features/locale/store";

const tournamentPosters = [
  {
    src: "/images/tournaments/common/posters/league-of-legends.jpg",
    alt: "League of Legends",
  },
  {
    src: "/images/tournaments/common/posters/valorant.jpg",
    alt: "Valorant",
  },
  {
    src: "/images/tournaments/common/posters/dota-2.jpg",
    alt: "Dota 2",
  },
  {
    src: "/images/tournaments/common/posters/counter-strike-2.jpg",
    alt: "Counter-Strike 2",
  },
  {
    src: "/images/tournaments/common/posters/arena-of-valor.jpg",
    alt: "Arena of Valor",
  },
  {
    src: "/images/tournaments/common/posters/fc-online.jpg",
    alt: "FC Online",
  },
];

export default function AuthVisualPanel({
  mode,
}: {
  mode: "login" | "register";
}) {
  const { t } = useLocale();
  const copy = mode === "login"
    ? { title: t("auth.login.visualTitle"), description: t("auth.login.visualDescription") }
    : { title: t("auth.register.visualTitle"), description: t("auth.register.visualDescription") };

  return (
    <section className="relative isolate flex h-full min-h-[19rem] overflow-hidden bg-surface-sub md:min-h-[38rem]">
      <RotatingImage
        images={tournamentPosters}
        variant="fill"
        showOverlay={false}
        showIndicators={false}
        imageFit="contain"
        blurredBackdrop
        quality={95}
        sizes="(min-width: 768px) 52vw, 100vw"
        className="absolute inset-0 -z-30"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-20 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--color-visual-backdrop)_35%,transparent)_0%,color-mix(in_oklab,var(--color-visual-backdrop)_62%,transparent)_48%,var(--color-visual-backdrop)_100%),linear-gradient(110deg,color-mix(in_oklab,var(--color-brand)_32%,transparent),color-mix(in_oklab,var(--color-brand-secondary)_24%,transparent))]"
      />
      <div
        aria-hidden
        className="absolute -left-24 top-1/3 -z-10 size-72 rounded-full bg-brand/25 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute -right-24 bottom-0 -z-10 size-72 rounded-full bg-brand-secondary/25 blur-3xl"
      />

      <div className="flex w-full flex-col p-6 sm:p-8 md:p-10">
        <div className="mt-auto max-w-lg pt-14 md:pt-20">
          <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-visual-accent">
            <LightningIcon size={17} weight="fill" />
            {t("auth.brand.eyebrow")}
          </p>
          <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl">
            {copy.title}
          </h2>
          <p className="mt-4 max-w-md text-sm leading-6 text-white/75 sm:text-base">
            {copy.description}
          </p>
        </div>
      </div>
    </section>
  );
}
