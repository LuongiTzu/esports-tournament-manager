"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useLocale, type TranslationKey } from "@/features/locale/store";
import SectionHeading from "@/features/home/components/SectionHeading";

const steps: Array<{
  number: string;
  title: TranslationKey;
  description: TranslationKey;
  entranceClass: string;
  numberClass: string;
}> = [
  {
    number: "1",
    title: "home.operation.step1.title",
    description: "home.operation.step1.description",
    entranceClass: "md:-translate-x-20 md:translate-y-0 md:scale-95",
    numberClass: "text-brand-hover",
  },
  {
    number: "2",
    title: "home.operation.step2.title",
    description: "home.operation.step2.description",
    entranceClass: "md:translate-y-10 md:scale-90",
    numberClass: "bg-gradient-brand bg-clip-text text-transparent",
  },
  {
    number: "3",
    title: "home.operation.step3.title",
    description: "home.operation.step3.description",
    entranceClass: "md:translate-x-20 md:translate-y-0 md:scale-95",
    numberClass: "text-brand-secondary",
  },
];

export default function TournamentOperationSection() {
  const { t } = useLocale();
  const sectionRef = useRef<HTMLElement>(null);
  const [hasEnteredViewport, setHasEnteredViewport] = useState(false);
  const [activeStep, setActiveStep] = useState<number | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches || !window.IntersectionObserver) {
      const timeout = window.setTimeout(() => setHasEnteredViewport(true), 0);
      return () => window.clearTimeout(timeout);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setHasEnteredViewport(true);
        observer.unobserve(entry.target);
      },
      { threshold: 0.3 },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="operation"
      className="relative isolate scroll-mt-24 overflow-hidden border-b border-line py-20 sm:py-24"
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

        <div className="relative mx-auto mt-10 max-w-6xl md:min-h-[44rem]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 hidden grid-cols-3 md:grid"
          >
            {steps.map((step, index) => (
              <div
                key={step.number}
                className={`h-full transition-[opacity,filter] duration-350 ${
                  activeStep === index
                    ? "bg-gradient-to-b from-brand/5 via-brand-secondary/12 to-brand/5 opacity-100 shadow-[0_0_55px_color-mix(in_oklab,var(--color-brand-secondary)_12%,transparent)]"
                    : "opacity-0"
                }`}
              />
            ))}
          </div>

          <div className="relative z-10 mx-auto h-72 max-w-xl sm:h-80 lg:h-[25rem]">
            <div
              aria-hidden
              className={`absolute left-1/2 top-1/2 -z-10 h-20 w-[92%] -translate-x-1/2 -translate-y-1/2 origin-center bg-gradient-to-r from-brand/10 via-brand-secondary/35 to-brand/10 blur-[1px] transition-transform duration-1000 ease-out motion-reduce:transition-none ${
                hasEnteredViewport ? "scale-x-100" : "scale-x-0"
              }`}
            />
            <Image
              src="/images/home/operation/faker-player.png"
              alt={t("home.operation.playerAlt")}
              fill
              sizes="(min-width: 1024px) 560px, (min-width: 640px) 520px, 90vw"
              className={`object-contain object-center drop-shadow-[0_24px_34px_rgba(0,0,0,0.5)] transition-[opacity,transform] duration-800 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] motion-reduce:translate-y-0 motion-reduce:scale-100 motion-reduce:opacity-100 motion-reduce:transition-none ${
                hasEnteredViewport
                  ? "translate-y-0 scale-100 opacity-100"
                  : "translate-y-8 scale-95 opacity-0"
              }`}
            />
          </div>

          <div className="relative z-20 grid md:-mt-4 md:grid-cols-3">
            {steps.map((step, index) => {
              const emphasized = activeStep === index;
              const subdued = activeStep !== null && !emphasized;

              return (
                <div
                  key={step.number}
                  style={{ transitionDelay: hasEnteredViewport ? `${index * 120}ms` : "0ms" }}
                  className={`h-full transition-[opacity,transform] duration-700 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] motion-reduce:translate-x-0 motion-reduce:translate-y-0 motion-reduce:scale-100 motion-reduce:opacity-100 motion-reduce:transition-none ${
                    hasEnteredViewport
                      ? "translate-x-0 translate-y-0 scale-100 opacity-100"
                      : `translate-y-10 scale-95 opacity-0 ${step.entranceClass}`
                  }`}
                >
                  <article
                    tabIndex={0}
                    onMouseEnter={() => setActiveStep(index)}
                    onMouseLeave={() => setActiveStep(null)}
                    onFocus={() => setActiveStep(index)}
                    onBlur={() => setActiveStep(null)}
                    className={`group flex min-h-72 h-full flex-col items-center px-5 py-8 text-center outline-none transition-opacity duration-350 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-brand/60 md:min-h-80 lg:px-10 ${
                      subdued ? "opacity-65" : "opacity-100"
                    }`}
                  >
                    <span
                      className={`font-mono text-7xl font-black leading-none transition-[filter,transform] duration-300 sm:text-8xl ${
                        step.numberClass
                      } ${
                        emphasized
                          ? "scale-105 drop-shadow-[0_0_16px_color-mix(in_oklab,var(--color-brand-secondary)_65%,transparent)]"
                          : "group-hover:scale-105"
                      }`}
                    >
                      {step.number}
                    </span>
                    <h3
                      className={`mt-3 text-xl font-bold transition-colors duration-300 sm:text-2xl ${
                        emphasized ? "text-white" : "text-ink"
                      }`}
                    >
                      {t(step.title)}
                    </h3>
                    <p
                      className={`mt-5 max-w-xs text-sm leading-6 transition-colors duration-300 ${
                        emphasized ? "text-ink" : "text-ink-muted"
                      }`}
                    >
                      {t(step.description)}
                    </p>
                    <span
                      aria-hidden
                      className={`mt-auto h-0.5 bg-gradient-brand transition-all duration-300 ${
                        emphasized ? "w-24 opacity-100" : "w-0 opacity-0"
                      }`}
                    />
                  </article>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
