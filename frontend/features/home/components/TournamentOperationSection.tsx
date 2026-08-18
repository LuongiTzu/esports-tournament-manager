"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { useLocale, type TranslationKey } from "@/features/locale/store";
import SectionHeading from "@/features/home/components/SectionHeading";

const steps: Array<{
  number: string;
  title: TranslationKey;
  description: TranslationKey;
  entrance: { x: number; y: number };
  numberClass: string;
}> = [
  {
    number: "1",
    title: "home.operation.step1.title",
    description: "home.operation.step1.description",
    entrance: { x: -100, y: 0 },
    numberClass: "text-brand-hover",
  },
  {
    number: "2",
    title: "home.operation.step2.title",
    description: "home.operation.step2.description",
    entrance: { x: 0, y: 100 },
    numberClass: "bg-gradient-brand bg-clip-text text-transparent",
  },
  {
    number: "3",
    title: "home.operation.step3.title",
    description: "home.operation.step3.description",
    entrance: { x: 100, y: 0 },
    numberClass: "text-brand-secondary",
  },
];

const stepsContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const stepVariants: Variants = {
  hidden: ({ x, y }: { x: number; y: number }) => ({
    opacity: 0,
    x,
    y,
  }),
  visible: {
    opacity: 1,
    x: 0,
    y: 0,
    transition: {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

const reducedMotionStepVariants: Variants = {
  hidden: { opacity: 1, x: 0, y: 0 },
  visible: { opacity: 1, x: 0, y: 0 },
};

export default function TournamentOperationSection() {
  const { t } = useLocale();
  const shouldReduceMotion = useReducedMotion();
  const [activeStep, setActiveStep] = useState<number | null>(null);

  return (
    <section
      id="operation"
      className="relative isolate scroll-mt-24 overflow-x-clip py-14 sm:py-16"
    >
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_50%_38%,color-mix(in_oklab,var(--color-brand)_12%,transparent),transparent_33%),radial-gradient(circle_at_72%_55%,color-mix(in_oklab,var(--color-brand-secondary)_8%,transparent),transparent_28%)]" />
      <div className="pointer-events-none absolute -left-48 top-28 -z-10 size-[44rem] rounded-full border border-brand/10" />
      <div className="pointer-events-none absolute -left-28 top-48 -z-10 size-[30rem] rounded-full border border-brand-secondary/10" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow={t("home.operation.eyebrow")}
          title={t("home.operation.title")}
          description={t("home.operation.description")}
          align="center"
        />

        <div className="relative mx-auto mt-8 max-w-6xl md:min-h-[34rem]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 hidden grid-cols-3 md:grid"
          >
            {steps.map((step, index) => (
              <div
                key={step.number}
                className={`h-full bg-gradient-to-b from-brand/5 via-brand-secondary/12 to-brand/5 transition-opacity duration-500 ease-out will-change-opacity ${
                  activeStep === index
                    ? "opacity-100"
                    : "opacity-0"
                }`}
              />
            ))}
          </div>

          <div className="relative z-10 h-56 sm:h-60 lg:h-[19rem]">
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 40, scale: 0.96 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.8, ease: [0.16, 1, 0.3, 1] }}
              viewport={{ once: false, amount: 0.2 }}
              className="relative mx-auto h-full max-w-xl"
              style={{ willChange: "transform, opacity" }}
            >
              <div
                aria-hidden
                className="absolute left-1/2 top-1/2 -z-10 h-20 w-[92%] -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-brand/10 via-brand-secondary/35 to-brand/10 blur-[1px]"
              />
              <Image
                src="/images/home/operation/faker-player.png"
                alt={t("home.operation.playerAlt")}
                fill
                sizes="(min-width: 1024px) 576px, (min-width: 640px) 560px, 90vw"
                className="object-contain object-center"
              />
            </motion.div>

            <div
              aria-hidden
              className="absolute inset-0 z-20 grid grid-cols-3"
              onMouseLeave={() => setActiveStep(null)}
            >
              {steps.map((step, index) => (
                <div
                  key={step.number}
                  onMouseEnter={() => setActiveStep(index)}
                />
              ))}
            </div>
          </div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, amount: 0.2 }}
            variants={stepsContainerVariants}
            className="relative z-20 grid md:-mt-3 md:grid-cols-3"
          >
            {steps.map((step, index) => {
              const emphasized = activeStep === index;
              const subdued = activeStep !== null && !emphasized;

              return (
                <motion.div
                  key={step.number}
                  custom={step.entrance}
                  variants={shouldReduceMotion ? reducedMotionStepVariants : stepVariants}
                  className="h-full"
                  style={{ willChange: "transform, opacity" }}
                >
                  <article
                    tabIndex={0}
                    onMouseEnter={() => setActiveStep(index)}
                    onMouseLeave={() => setActiveStep(null)}
                    onFocus={() => setActiveStep(index)}
                    onBlur={() => setActiveStep(null)}
                    className={`group flex h-full min-h-56 flex-col items-center px-4 py-6 text-center outline-none transition-opacity duration-350 will-change-opacity focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-brand/60 md:min-h-60 lg:px-8 ${
                      subdued ? "opacity-65" : "opacity-100"
                    }`}
                  >
                    <span
                      className={`transform-gpu font-mono text-7xl font-black leading-none transition-transform duration-300 will-change-transform sm:text-[5rem] ${
                        step.numberClass
                      } ${
                        emphasized
                          ? "scale-105"
                          : "group-hover:scale-105"
                      }`}
                    >
                      {step.number}
                    </span>
                    <h3
                      className={`mt-2 text-lg font-bold transition-colors duration-300 sm:text-xl ${
                        emphasized ? "text-white" : "text-ink"
                      }`}
                    >
                      {t(step.title)}
                    </h3>
                    <p
                      className={`mt-3 max-w-xs text-sm leading-5 transition-colors duration-300 ${
                        emphasized ? "text-ink" : "text-ink-muted"
                      }`}
                    >
                      {t(step.description)}
                    </p>
                    <span
                      aria-hidden
                      className={`mt-auto h-0.5 w-20 origin-center transform-gpu bg-gradient-brand transition-[opacity,transform] duration-700 ease-out will-change-[opacity,transform] ${
                        emphasized
                          ? "scale-x-100 opacity-100"
                          : "scale-x-60 opacity-60"
                      }`}
                    />
                  </article>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
