"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export interface RotatingImageItem {
  src: string;
  alt: string;
}

interface RotatingImageProps {
  images: RotatingImageItem[];
  interval?: number;
  sizes?: string;
  variant?: "card" | "fill";
  showOverlay?: boolean;
  showIndicators?: boolean;
  imageFit?: "cover" | "contain";
  blurredBackdrop?: boolean;
  quality?: number;
  className?: string;
}

export default function RotatingImage({
  images,
  interval = 5000,
  sizes = "(min-width: 1024px) 42vw, (min-width: 640px) 75vw, 100vw",
  variant = "card",
  showOverlay = true,
  showIndicators = true,
  imageFit = "cover",
  blurredBackdrop = false,
  quality = 80,
  className = "",
}: RotatingImageProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setReduceMotion(mediaQuery.matches);

    updateMotionPreference();
    mediaQuery.addEventListener("change", updateMotionPreference);
    return () => mediaQuery.removeEventListener("change", updateMotionPreference);
  }, []);

  useEffect(() => {
    if (images.length < 2 || paused || reduceMotion) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % images.length);
    }, interval);

    return () => window.clearInterval(timer);
  }, [images.length, interval, paused, reduceMotion]);

  if (images.length === 0) return null;

  const containerClass =
    variant === "fill"
      ? "h-full w-full overflow-hidden bg-surface-card"
      : "group relative aspect-[16/10] overflow-hidden rounded-[var(--radius-card)] border border-brand/30 bg-surface-card shadow-[var(--shadow-elevated)] focus-within:shadow-glow-brand";

  return (
    <div
      className={`${containerClass} ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {images.map((image, index) => (
        <div
          key={image.src}
          className={`absolute inset-0 transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none ${
            index === activeIndex
              ? "scale-100 opacity-100"
              : "pointer-events-none scale-[1.025] opacity-0"
          }`}
        >
          {blurredBackdrop && imageFit === "contain" && (
            <Image
              src={image.src}
              alt=""
              fill
              aria-hidden
              sizes={sizes}
              quality={quality}
              className="scale-110 object-cover opacity-55 blur-xl"
            />
          )}
          <Image
            src={image.src}
            alt={index === activeIndex ? image.alt : ""}
            fill
            priority={index === 0}
            sizes={sizes}
            quality={quality}
            className={imageFit === "contain" ? "object-contain" : "object-cover"}
          />
        </div>
      ))}

      {showOverlay && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface/70 via-transparent to-transparent"
        />
      )}
      {showIndicators && images.length > 1 && (
        <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2">
          {images.map((image, index) => (
            <button
              key={image.src}
              type="button"
              aria-label={`${image.alt} (${index + 1}/${images.length})`}
              aria-current={activeIndex === index ? "true" : undefined}
              onClick={() => setActiveIndex(index)}
              className={`h-1.5 rounded-full transition-[width,background-color] duration-300 focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] ${
                activeIndex === index
                  ? "w-8 bg-gradient-brand"
                  : "w-3 bg-white/45 hover:bg-white/75"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
