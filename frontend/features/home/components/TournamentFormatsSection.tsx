"use client";

import { useState } from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { useLocale, type TranslationKey } from "@/features/locale/store";
import type { ROUND_FORMATS } from "@/features/tournaments/round-formats";
import ScrollReveal from "@/features/home/components/ScrollReveal";
import SectionHeading from "@/features/home/components/SectionHeading";
import TournamentFormatCard from "@/features/home/components/TournamentFormatCard";
import {
  DoubleEliminationIcon,
  GroupStageIcon,
  RoundRobinIcon,
  SingleEliminationIcon,
  SwissStageIcon,
  type TournamentFormatIcon,
} from "@/features/home/components/TournamentFormatIcons";

type Format = (typeof ROUND_FORMATS)[number]["value"];

interface FormatShowcaseItem {
  value: Format;
  label: TranslationKey;
  description: TranslationKey;
  imageUrl: string;
  Icon: TournamentFormatIcon;
}

const tournamentFormats: FormatShowcaseItem[] = [
  {
    value: "PLAYOFF",
    label: "home.formats.PLAYOFF.label",
    description: "home.formats.PLAYOFF.description",
    imageUrl: "/images/home/formats/single-elimination.jpg",
    Icon: SingleEliminationIcon,
  },
  {
    value: "ROUND_ROBIN",
    label: "home.formats.ROUND_ROBIN.label",
    description: "home.formats.ROUND_ROBIN.description",
    imageUrl: "/images/home/formats/round-robin.jpg",
    Icon: RoundRobinIcon,
  },
  {
    value: "GROUP_STAGE",
    label: "home.formats.GROUP_STAGE.label",
    description: "home.formats.GROUP_STAGE.description",
    imageUrl: "/images/home/formats/group-stage.jpg",
    Icon: GroupStageIcon,
  },
  {
    value: "DOUBLE_ELIM",
    label: "home.formats.DOUBLE_ELIM.label",
    description: "home.formats.DOUBLE_ELIM.description",
    imageUrl: "/images/home/formats/double-elimination.png",
    Icon: DoubleEliminationIcon,
  },
  {
    value: "SWISS",
    label: "home.formats.SWISS.label",
    description: "home.formats.SWISS.description",
    imageUrl: "/images/home/formats/swiss-stage.png",
    Icon: SwissStageIcon,
  },
];

const selectorVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const cardRevealVariants: Variants = {
  hidden: { opacity: 0, y: 50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.65,
      ease: [0.22, 0.61, 0.36, 1],
    },
  },
};

const reducedMotionCardVariants: Variants = {
  hidden: { opacity: 1, y: 0 },
  visible: { opacity: 1, y: 0 },
};

export default function TournamentFormatsSection() {
  const { t } = useLocale();
  const shouldReduceMotion = useReducedMotion();
  const [activeFormat, setActiveFormat] = useState<Format | null>(null);

  return (
    <section id="formats" className="relative scroll-mt-24 py-20 sm:py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/3 -z-10 h-96 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--color-brand)_7%,transparent),transparent_68%)]"
      />

      <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <SectionHeading
            eyebrow={t("home.formats.eyebrow")}
            title={t("home.formats.title")}
            description={t("home.formats.description")}
            align="center"
          />
        </ScrollReveal>

        <div
          className="mt-10 snap-x snap-mandatory scroll-px-[7vw] overflow-x-auto pb-5 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-[1200px]:overflow-visible"
          onMouseLeave={() => setActiveFormat(null)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setActiveFormat(null);
            }
          }}
        >
          <motion.div
            role="list"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={selectorVariants}
            className="flex min-w-max items-start gap-4 px-[7vw] sm:gap-5 sm:px-1 min-[1200px]:min-w-0 min-[1200px]:gap-6"
          >
            {tournamentFormats.map((format) => (
              <motion.div
                role="listitem"
                key={format.value}
                variants={shouldReduceMotion ? reducedMotionCardVariants : cardRevealVariants}
                className="w-[86vw] max-w-[21rem] shrink-0 snap-center sm:w-[17rem] min-[1200px]:min-w-0 min-[1200px]:max-w-none min-[1200px]:flex-1"
                style={{ willChange: "transform, opacity" }}
              >
                <TournamentFormatCard
                  title={t(format.label)}
                  description={t(format.description)}
                  imageUrl={format.imageUrl}
                  Icon={format.Icon}
                  active={activeFormat === format.value}
                  onActivate={() => setActiveFormat(format.value)}
                />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
