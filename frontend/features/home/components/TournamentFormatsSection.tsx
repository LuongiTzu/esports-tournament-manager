"use client";

import { BracketsCurlyIcon, CirclesThreePlusIcon, GitBranchIcon, GridFourIcon, ShuffleAngularIcon } from "@phosphor-icons/react";
import { useLocale, type TranslationKey } from "@/features/locale/store";
import { ROUND_FORMATS } from "@/features/tournaments/round-formats";
import ScrollReveal from "@/features/home/components/ScrollReveal";
import SectionHeading from "@/features/home/components/SectionHeading";

type Format = (typeof ROUND_FORMATS)[number]["value"];

const formatKeys: Record<Format, { label: TranslationKey; description: TranslationKey }> = {
  ROUND_ROBIN: { label: "home.formats.ROUND_ROBIN.label", description: "home.formats.ROUND_ROBIN.description" },
  GROUP_STAGE: { label: "home.formats.GROUP_STAGE.label", description: "home.formats.GROUP_STAGE.description" },
  SWISS: { label: "home.formats.SWISS.label", description: "home.formats.SWISS.description" },
  PLAYOFF: { label: "home.formats.PLAYOFF.label", description: "home.formats.PLAYOFF.description" },
  DOUBLE_ELIM: { label: "home.formats.DOUBLE_ELIM.label", description: "home.formats.DOUBLE_ELIM.description" },
};

function FormatIcon({ value }: { value: Format }) {
  const props = { size: 27, weight: "duotone" as const };
  if (value === "ROUND_ROBIN") return <CirclesThreePlusIcon {...props} />;
  if (value === "GROUP_STAGE") return <GridFourIcon {...props} />;
  if (value === "SWISS") return <ShuffleAngularIcon {...props} />;
  if (value === "PLAYOFF") return <BracketsCurlyIcon {...props} />;
  return <GitBranchIcon {...props} />;
}

export default function TournamentFormatsSection() {
  const { t } = useLocale();

  return (
    <section id="formats" className="scroll-mt-24 border-b border-line bg-surface-card/25 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <SectionHeading eyebrow={t("home.formats.eyebrow")} title={t("home.formats.title")} description={t("home.formats.description")} align="center" />
        </ScrollReveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {ROUND_FORMATS.map((format, index) => (
            <ScrollReveal key={format.value} delay={index * 65} className="h-full">
              <article className="group relative h-full overflow-hidden rounded-2xl border border-line bg-surface-card p-5 transition duration-300 hover:-translate-y-1 hover:border-brand/45 hover:shadow-glow-brand">
                <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-[image:var(--gradient-border)] opacity-0 transition group-hover:opacity-100" />
                <span className="grid size-12 place-items-center rounded-xl bg-gradient-to-br from-brand/15 to-brand-secondary/10 text-brand-hover transition group-hover:from-brand/25 group-hover:to-brand-secondary/15">
                  <FormatIcon value={format.value} />
                </span>
                <h3 className="mt-6 font-bold text-ink">{t(formatKeys[format.value].label)}</h3>
                <p className="mt-3 text-sm leading-6 text-ink-muted">{t(formatKeys[format.value].description)}</p>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
