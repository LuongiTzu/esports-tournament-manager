"use client";

import Image from "next/image";
import {
  BracketsCurlyIcon,
  DeviceMobileIcon,
  EyeIcon,
  GameControllerIcon,
  KeyboardIcon,
  SquaresFourIcon,
  UsersThreeIcon,
  type Icon,
} from "@phosphor-icons/react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { useLocale, type TranslationKey } from "@/features/locale/store";
import SectionHeading from "@/features/home/components/SectionHeading";

interface Benefit {
  title: TranslationKey;
  description: TranslationKey;
  Icon: Icon;
  positionClass: string;
  entrance: { x: number; y: number; delay: number };
}

const benefits: Benefit[] = [
  {
    title: "home.benefits.centralized.title",
    description: "home.benefits.centralized.description",
    Icon: SquaresFourIcon,
    positionClass: "lg:left-[21%] lg:top-[27%]",
    entrance: { x: -95, y: 0, delay: 0.08 },
  },
  {
    title: "home.benefits.registration.title",
    description: "home.benefits.registration.description",
    Icon: UsersThreeIcon,
    positionClass: "lg:bottom-[7%] lg:left-[29%]",
    entrance: { x: -65, y: 75, delay: 0.2 },
  },
  {
    title: "home.benefits.bracket.title",
    description: "home.benefits.bracket.description",
    Icon: BracketsCurlyIcon,
    positionClass: "lg:bottom-[7%] lg:right-[29%]",
    entrance: { x: 65, y: 75, delay: 0.32 },
  },
  {
    title: "home.benefits.public.title",
    description: "home.benefits.public.description",
    Icon: EyeIcon,
    positionClass: "lg:right-[21%] lg:top-[27%]",
    entrance: { x: 95, y: 0, delay: 0.44 },
  },
];

const itemVariants: Variants = {
  hidden: ({ x, y }: Benefit["entrance"]) => ({
    opacity: 0,
    x,
    y,
    scale: 0.94,
  }),
  visible: ({ delay }: Benefit["entrance"]) => ({
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    transition: {
      duration: 1.05,
      delay,
      ease: [0.16, 1, 0.3, 1],
    },
  }),
};

const reducedMotionVariants: Variants = {
  hidden: { opacity: 1, x: 0, y: 0, scale: 1 },
  visible: { opacity: 1, x: 0, y: 0, scale: 1 },
};

function BenefitItem({
  benefit,
  reducedMotion,
}: {
  benefit: Benefit;
  reducedMotion: boolean | null;
}) {
  const { t } = useLocale();
  const Icon = benefit.Icon;

  return (
    <motion.article
      custom={benefit.entrance}
      variants={reducedMotion ? reducedMotionVariants : itemVariants}
      className={`relative z-20 mx-auto flex w-full max-w-64 flex-col items-center rounded-xl border border-line/70 bg-surface-card/65 p-5 text-center backdrop-blur-sm lg:absolute lg:w-60 lg:border-transparent lg:bg-transparent lg:p-0 lg:backdrop-blur-none ${benefit.positionClass}`}
      style={{ willChange: "transform, opacity" }}
    >
      <span className="grid size-14 place-items-center rounded-xl bg-gradient-to-br from-brand/20 to-brand-secondary/15 text-brand-hover shadow-sm shadow-brand/10 lg:bg-transparent lg:shadow-none">
        <Icon size={38} weight="duotone" />
      </span>
      <h3 className="mt-4 text-lg font-bold text-ink">{t(benefit.title)}</h3>
      <p className="mt-2 text-sm leading-6 text-ink-muted">{t(benefit.description)}</p>
    </motion.article>
  );
}

export default function PlatformBenefitsSection() {
  const { t } = useLocale();
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="relative overflow-x-clip py-20 sm:py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-[radial-gradient(circle_at_0%_65%,color-mix(in_oklab,var(--color-brand)_18%,transparent),transparent_68%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(circle_at_100%_65%,color-mix(in_oklab,var(--color-brand-secondary)_16%,transparent),transparent_68%)]"
      />

      <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, amount: 0.2 }}
          className="relative grid gap-5 sm:grid-cols-2 lg:block lg:h-[48rem]"
        >
          <motion.div
            custom={{ x: 0, y: -70, delay: 0 }}
            variants={shouldReduceMotion ? reducedMotionVariants : itemVariants}
            className="relative z-30 col-span-full lg:absolute lg:inset-x-0 lg:top-8"
            style={{ willChange: "transform, opacity" }}
          >
            <SectionHeading
              eyebrow={t("home.benefits.eyebrow")}
              title={t("home.benefits.title")}
              description={t("home.benefits.description")}
              align="center"
            />
          </motion.div>

          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 hidden size-[44rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand/15 lg:block"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 hidden size-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-brand-secondary/20 lg:block"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 hidden size-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/10 blur-3xl lg:block"
          />

          <motion.div
            custom={{ x: -210, y: 70, delay: 0.08 }}
            variants={shouldReduceMotion ? reducedMotionVariants : itemVariants}
            className="pointer-events-none absolute bottom-0 left-0 z-10 hidden w-[20rem] isolate lg:block xl:left-2 xl:w-[24rem]"
            style={{ willChange: "transform, opacity" }}
          >
            <div className="absolute -bottom-2 -left-12 -z-20 size-80 rounded-full bg-brand/24 blur-3xl" />
            <DeviceMobileIcon
              aria-hidden
              size={310}
              weight="duotone"
              className="absolute -bottom-5 -left-12 -z-10 rotate-[-16deg] text-brand/45 drop-shadow-[0_0_38px_color-mix(in_oklab,var(--color-brand)_75%,transparent)]"
            />
            <Image
              src="/images/home/benefits/adc-player.png"
              alt="ADC"
              width={1250}
              height={1086}
              sizes="(min-width: 1280px) 416px, 352px"
              className="relative z-10 h-auto w-full object-contain drop-shadow-[0_18px_30px_rgba(124,58,237,0.2)]"
            />
          </motion.div>

          <motion.div
            custom={{ x: 210, y: 20, delay: 0.18 }}
            variants={shouldReduceMotion ? reducedMotionVariants : itemVariants}
            className="pointer-events-none absolute bottom-16 right-0 z-10 hidden w-[21rem] isolate lg:block xl:right-2 xl:w-[25rem]"
            style={{ willChange: "transform, opacity" }}
          >
            <div className="absolute -bottom-4 -right-12 -z-20 size-80 rounded-full bg-brand-secondary/22 blur-3xl" />
            <KeyboardIcon
              aria-hidden
              size={330}
              weight="duotone"
              className="absolute -bottom-12 -right-16 -z-10 rotate-12 text-brand-secondary/45 drop-shadow-[0_0_38px_color-mix(in_oklab,var(--color-brand-secondary)_72%,transparent)]"
            />
            <Image
              src="/images/home/benefits/levi-player.png"
              alt="Levi"
              width={1450}
              height={1086}
              sizes="(min-width: 1280px) 448px, 384px"
              className="relative z-10 h-auto w-full object-contain drop-shadow-[0_18px_30px_rgba(239,35,60,0.18)]"
            />
          </motion.div>

          <div className="relative z-20 col-span-full mx-auto lg:absolute lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2">
            <motion.div
              custom={{ x: 0, y: 80, delay: 0.16 }}
              variants={shouldReduceMotion ? reducedMotionVariants : itemVariants}
              className="grid size-28 place-items-center text-brand-hover drop-shadow-[0_0_18px_color-mix(in_oklab,var(--color-brand)_50%,transparent)]"
              style={{ willChange: "transform, opacity" }}
            >
              <GameControllerIcon size={82} weight="duotone" />
            </motion.div>
          </div>

          {benefits.map((benefit) => (
            <BenefitItem
              key={benefit.title}
              benefit={benefit}
              reducedMotion={shouldReduceMotion}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
