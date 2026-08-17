"use client";

import { BracketsCurlyIcon, EyeIcon, SquaresFourIcon, TrophyIcon, UsersThreeIcon } from "@phosphor-icons/react";
import { useLocale, type TranslationKey } from "@/features/locale/store";
import ScrollReveal from "@/features/home/components/ScrollReveal";
import SectionHeading from "@/features/home/components/SectionHeading";

const benefits: Array<{ title: TranslationKey; description: TranslationKey; icon: typeof TrophyIcon }> = [
  { title: "home.benefits.centralized.title", description: "home.benefits.centralized.description", icon: SquaresFourIcon },
  { title: "home.benefits.registration.title", description: "home.benefits.registration.description", icon: UsersThreeIcon },
  { title: "home.benefits.bracket.title", description: "home.benefits.bracket.description", icon: BracketsCurlyIcon },
  { title: "home.benefits.public.title", description: "home.benefits.public.description", icon: EyeIcon },
];

function BenefitCard({ benefit, delay }: { benefit: (typeof benefits)[number]; delay: number }) {
  const { t } = useLocale();
  const Icon = benefit.icon;
  return (
    <ScrollReveal delay={delay} className="h-full">
      <article className="group h-full rounded-2xl border border-line bg-surface-card/90 p-5 text-center backdrop-blur transition hover:border-brand/40 hover:shadow-lg hover:shadow-brand/10">
        <Icon size={27} weight="duotone" className="mx-auto text-brand-hover transition group-hover:text-brand-secondary" />
        <h3 className="mt-4 font-semibold text-ink">{t(benefit.title)}</h3>
        <p className="mt-2 text-sm leading-6 text-ink-muted">{t(benefit.description)}</p>
      </article>
    </ScrollReveal>
  );
}

export default function PlatformBenefitsSection() {
  const { t } = useLocale();

  return (
    <section className="relative overflow-hidden py-20 sm:py-24">
      <div aria-hidden className="absolute left-1/2 top-1/2 -z-10 size-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand/15 shadow-glow-brand" />
      <div aria-hidden className="absolute left-1/2 top-1/2 -z-10 size-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-brand-secondary/20" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <SectionHeading eyebrow={t("home.benefits.eyebrow")} title={t("home.benefits.title")} description={t("home.benefits.description")} align="center" />
        </ScrollReveal>

        <div className="mt-12 grid items-stretch gap-4 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1.15fr_1fr_1fr]">
          {benefits.slice(0, 2).map((benefit, index) => <BenefitCard key={benefit.title} benefit={benefit} delay={index * 70} />)}
          <ScrollReveal delay={130} className="order-first h-full md:col-span-2 lg:order-none lg:col-span-1">
            <div className="flex h-full min-h-52 flex-col items-center justify-center rounded-3xl border border-brand/40 bg-gradient-to-br from-brand/15 to-brand-secondary/10 p-7 text-center shadow-glow-brand">
              <span className="grid size-16 place-items-center rounded-2xl bg-gradient-brand text-on-brand">
                <TrophyIcon size={33} weight="duotone" />
              </span>
              <p className="mt-5 text-lg font-bold text-ink">{t("home.benefits.journey")}</p>
            </div>
          </ScrollReveal>
          {benefits.slice(2).map((benefit, index) => <BenefitCard key={benefit.title} benefit={benefit} delay={(index + 2) * 70} />)}
        </div>
      </div>
    </section>
  );
}
