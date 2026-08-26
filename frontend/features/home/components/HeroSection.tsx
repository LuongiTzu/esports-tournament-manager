"use client";

import Link from "next/link";
import { ArrowRightIcon, LightningIcon, PlayIcon } from "@phosphor-icons/react";
import { useLocale } from "@/features/locale/store";
import RotatingText from "@/components/RotatingText";
import DepthCarousel from "@/features/home/components/hero/DepthCarousel";
import GamePosterGridBackground from "@/features/home/components/hero/GamePosterGridBackground";

const heroImages = [
  { image: "/images/home/hero/esports-arena.jpg", label: "Esports arena" },
  { image: "/images/home/hero/professional-esports-team.jpg", label: "Professional esports team" },
  { image: "/images/home/hero/vietnam-championship-stage.jpg", label: "Championship stage" },
  { image: "/images/home/hero/esports-world-cup-arena.jpg", label: "International esports event" },
  { image: "/images/home/hero/vietnam-sea-games-arena.jpg", label: "Vietnam esports arena" },
  { image: "/images/home/hero/world-championship-trophy.jpg", label: "Tournament trophy" },
  { image: "/images/home/hero/grand-final-trophy-stage.jpg", label: "Grand final stage" },
  { image: "/images/home/hero/tournament-crowd.jpg", label: "Tournament audience" },
];

export default function HeroSection() {
  const { t } = useLocale();
  const rotatingHighlights = [
    t("home.hero.highlight"),
    t("home.hero.highlightFair"),
    t("home.hero.highlightLive"),
    t("home.hero.highlightGlory"),
  ];

  return (
    <section className="relative isolate overflow-hidden">
      <GamePosterGridBackground />
      <div className="mx-auto grid min-h-[calc(100svh-3.5rem)] max-w-7xl items-center gap-14 px-4 py-16 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:px-8 lg:py-20">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-brand-hover">
            <LightningIcon size={15} weight="fill" />
            {t("home.hero.badge")}
          </div>
          <h1 className="mt-5 max-w-3xl text-[clamp(2.4rem,4vw,3.75rem)] font-black uppercase leading-[1.01] tracking-[-0.05em] text-ink">
            {t("home.hero.title")}
            <span className="mt-2 block text-[0.86em] text-brand-secondary sm:text-[0.9em]">
              <RotatingText texts={rotatingHighlights} preventWrap />
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-sm font-medium leading-6 text-ink/72 sm:text-base sm:leading-7">
            {t("home.hero.description")}
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/tournaments/new"
              className="inline-flex min-h-12 items-center justify-center gap-2.5 rounded-md bg-brand-secondary px-6 py-3 text-[0.8125rem] font-black uppercase tracking-wide text-on-brand transition hover:brightness-110 active:translate-y-px"
            >
              <PlayIcon size={19} weight="fill" />
              {t("home.hero.create")}
            </Link>
            <Link
              href="/tournaments"
              className="inline-flex min-h-12 items-center justify-center gap-2.5 rounded-md border border-line-strong bg-surface/45 px-6 py-3 text-[0.8125rem] font-black uppercase tracking-wide text-ink transition hover:border-brand/60 hover:bg-surface-hover active:translate-y-px"
            >
              {t("home.hero.discover")}
              <ArrowRightIcon size={18} weight="bold" />
            </Link>
          </div>
        </div>

        <div className="relative mx-auto h-[420px] w-full max-w-xl sm:h-[480px] lg:h-[500px]">
          <div aria-hidden className="absolute inset-[12%_4%] rounded-full bg-brand/12 blur-3xl" />
          <DepthCarousel
            items={heroImages.map((image) => ({
              image: image.image,
              alt: `${t("home.hero.illustration")} — ${image.label}`,
            }))}
            depth={190}
            spread={62}
            tilt={15}
            tiltDirection="right"
            perspective={1400}
            visibleCards={4}
            falloff={0.18}
            blur={5}
            autoplay
            loop
            cardWidth={520}
            cardHeight={320}
            radius={18}
            tint="#05060a"
            duration={760}
            autoplayDelay={4200}
            showControls={false}
            showIndicators
          />
        </div>
      </div>
    </section>
  );
}
