"use client";

import Link from "next/link";
import { ArrowRightIcon, LightningIcon } from "@phosphor-icons/react";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { useLocale } from "@/features/locale/store";
import RotatingImage from "@/components/RotatingImage";

const heroBackgroundImages = [
  { src: "/images/home/hero/hero-background.png", alt: "" },
  {
    src: "/images/tournaments/common/backgrounds/tournament-collage.png",
    alt: "",
  },
];

const heroImages = [
  { src: "/images/home/formats/single-elimination.jpg", label: "Single elimination" },
  { src: "/images/home/formats/round-robin.jpg", label: "Round robin" },
  { src: "/images/home/formats/group-stage.jpg", label: "Group stage" },
  { src: "/images/home/formats/double-elimination.png", label: "Double elimination" },
  { src: "/images/home/formats/swiss-stage.png", label: "Swiss stage" },
];

export default function HeroSection() {
  const { t } = useLocale();

  return (
    <section className="relative isolate overflow-hidden">
      <RotatingImage
        images={heroBackgroundImages}
        interval={10000}
        variant="fill"
        showOverlay={false}
        showIndicators={false}
        sizes="100vw"
        quality={90}
        className="pointer-events-none absolute inset-0 -z-20 opacity-40"
      />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,color-mix(in_oklab,var(--color-surface)_82%,transparent)_0%,color-mix(in_oklab,var(--color-surface)_56%,transparent)_48%,color-mix(in_oklab,var(--color-surface)_38%,transparent)_100%),linear-gradient(to_bottom,color-mix(in_oklab,var(--color-surface)_18%,transparent),var(--color-surface))]" />
      <div className="mx-auto grid min-h-[calc(100svh-4.5rem)] max-w-7xl items-center gap-14 px-4 py-16 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:px-8 lg:py-20">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand-hover shadow-sm shadow-brand/10">
            <LightningIcon size={15} weight="fill" />
            {t("home.hero.badge")}
          </div>
          <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-[1.08] tracking-[-0.04em] text-ink sm:text-5xl lg:text-6xl">
            {t("home.hero.title")} {" "}
            <span className="bg-gradient-brand bg-clip-text text-transparent">{t("home.hero.highlight")}</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-ink-muted sm:text-lg">{t("home.hero.description")}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/tournaments/new" className={primaryButtonClass}>
              {t("home.hero.create")}
              <ArrowRightIcon size={17} weight="bold" />
            </Link>
            <Link href="/tournaments" className={secondaryButtonClass}>{t("home.hero.discover")}</Link>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-lg">
          <div aria-hidden className="absolute -inset-8 rounded-full border border-brand/15 shadow-glow-brand" />
          <div aria-hidden className="absolute inset-8 rounded-full border border-dashed border-brand-secondary/25" />
          <div className="relative">
            <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-[image:var(--gradient-border)]" />
            <RotatingImage
              images={heroImages.map((image) => ({
                src: image.src,
                alt: `${t("home.hero.illustration")} — ${image.label}`,
              }))}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
