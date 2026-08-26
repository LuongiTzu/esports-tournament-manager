"use client";

import Image from "next/image";
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "./DepthCarousel.module.css";

export interface DepthCarouselItem {
  image: string;
  alt: string;
}

type TiltDirection = "left" | "right";

interface DepthCarouselProps {
  items: DepthCarouselItem[];
  cardWidth?: number;
  cardHeight?: number;
  radius?: number;
  tint?: string;
  depth?: number;
  spread?: number;
  tilt?: number;
  tiltDirection?: TiltDirection;
  perspective?: number;
  visibleCards?: number;
  falloff?: number;
  blur?: number;
  duration?: number;
  autoplay?: boolean;
  autoplayDelay?: number;
  loop?: boolean;
  showControls?: boolean;
  showIndicators?: boolean;
  className?: string;
  onChange?: (index: number, item: DepthCarouselItem) => void;
}

type CarouselStyle = CSSProperties & Record<`--dc-${string}`, string>;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

function getRelativeOffset(index: number, activeIndex: number, count: number, loop: boolean) {
  let offset = index - activeIndex;

  if (loop && count > 1) {
    offset = ((offset % count) + count) % count;
    if (offset > count / 2) offset -= count;
  }

  return offset;
}

export default function DepthCarousel({
  items,
  cardWidth = 300,
  cardHeight = 380,
  radius = 18,
  tint = "#05060a",
  depth = 220,
  spread = 90,
  tilt = 22,
  tiltDirection = "right",
  perspective = 1400,
  visibleCards = 4,
  falloff = 0.2,
  blur = 6,
  duration = 700,
  autoplay = false,
  autoplayDelay = 3200,
  loop = true,
  showControls = true,
  showIndicators = true,
  className = "",
  onChange,
}: DepthCarouselProps) {
  const slides = useMemo(() => items.filter((item) => item.image), [items]);
  const [activeIndex, setActiveIndex] = useState(0);
  const dragStartX = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const count = slides.length;

  const selectSlide = useCallback(
    (requestedIndex: number) => {
      if (!count) return;

      const nextIndex = loop
        ? ((requestedIndex % count) + count) % count
        : clamp(requestedIndex, 0, count - 1);

      setActiveIndex(nextIndex);
      onChange?.(nextIndex, slides[nextIndex]);
    },
    [count, loop, onChange, slides],
  );

  const navigate = useCallback(
    (step: number) => selectSlide(activeIndex + step),
    [activeIndex, selectSlide],
  );

  useEffect(() => {
    if (!autoplay || count < 2) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const timer = window.setInterval(() => {
      setActiveIndex((currentIndex) => {
        const nextIndex = loop
          ? (currentIndex + 1) % count
          : Math.min(currentIndex + 1, count - 1);
        onChange?.(nextIndex, slides[nextIndex]);
        return nextIndex;
      });
    }, Math.max(autoplayDelay, 800));

    return () => window.clearInterval(timer);
  }, [autoplay, autoplayDelay, count, loop, onChange, slides]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      navigate(-1);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      navigate(1);
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragStartX.current = event.clientX;
    suppressClick.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStartX.current === null) return;

    const distance = event.clientX - dragStartX.current;
    dragStartX.current = null;

    if (Math.abs(distance) < 36) return;

    suppressClick.current = true;
    navigate(distance > 0 ? -1 : 1);
    window.requestAnimationFrame(() => {
      suppressClick.current = false;
    });
  };

  if (!count) return null;

  const rootStyle = {
    "--dc-perspective": `${perspective}px`,
  } as CarouselStyle;

  return (
    <div
      className={`${styles.root} ${className}`.trim()}
      style={rootStyle}
      role="region"
      aria-roledescription="carousel"
      aria-label="Esports tournament gallery"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        dragStartX.current = null;
      }}
    >
      <div className={styles.stage}>
        {slides.map((slide, index) => {
          const offset = getRelativeOffset(index, activeIndex, count, loop);
          const distance = Math.max(0, offset);
          const visible = offset >= 0 && distance <= visibleCards;
          const direction = tiltDirection === "right" ? 1 : -1;
          const cardStyle = {
            "--dc-card-width": `${cardWidth}px`,
            "--dc-card-height": `${cardHeight}px`,
            "--dc-card-ratio": `${cardWidth} / ${cardHeight}`,
            "--dc-radius": `${radius}px`,
            "--dc-tint": tint,
            "--dc-duration": `${duration}ms`,
            "--dc-translate-x": `${direction * spread * distance}px`,
            "--dc-translate-z": `${-depth * distance}px`,
            "--dc-rotate-y": `${direction * tilt * clamp(distance, 0, 1)}deg`,
            "--dc-opacity": visible ? `${clamp(1 - distance * falloff, 0.08, 1)}` : "0",
            "--dc-brightness": `${clamp(1 - distance * falloff, 0.28, 1)}`,
            "--dc-blur": `${(distance / Math.max(visibleCards, 1)) * blur}px`,
            "--dc-tint-opacity": `${clamp(distance * falloff * 1.2, 0, 0.82)}`,
            zIndex: 1000 - Math.round(distance * 10),
            pointerEvents: visible ? "auto" : "none",
          } as CarouselStyle;

          return (
            <button
              key={slide.image}
              type="button"
              className={styles.card}
              style={cardStyle}
              aria-label={`${index + 1} / ${count}: ${slide.alt}`}
              aria-current={index === activeIndex ? "true" : undefined}
              tabIndex={index === activeIndex ? 0 : -1}
              onClick={() => {
                if (!suppressClick.current) selectSlide(index);
              }}
            >
              <Image
                className={styles.image}
                src={slide.image}
                alt={index === activeIndex ? slide.alt : ""}
                fill
                priority={index === 0}
                quality={95}
                sizes={`(max-width: 640px) 82vw, ${cardWidth}px`}
                draggable={false}
              />
              <span className={styles.tint} aria-hidden />
              <span className={styles.edge} aria-hidden />
            </button>
          );
        })}
      </div>

      {showControls && count > 1 ? (
        <>
          <button
            type="button"
            className={`${styles.arrow} ${styles.previous}`}
            aria-label="Previous image"
            onClick={(event) => {
              event.stopPropagation();
              navigate(-1);
            }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
              <path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            className={`${styles.arrow} ${styles.next}`}
            aria-label="Next image"
            onClick={(event) => {
              event.stopPropagation();
              navigate(1);
            }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
              <path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </>
      ) : null}

      {showIndicators && count > 1 ? (
        <div className={styles.dots} aria-label="Choose gallery image">
          {slides.map((slide, index) => (
            <button
              key={slide.image}
              type="button"
              className={`${styles.dot} ${index === activeIndex ? styles.activeDot : ""}`.trim()}
              aria-label={`Go to image ${index + 1}`}
              aria-pressed={index === activeIndex}
              onClick={(event) => {
                event.stopPropagation();
                selectSlide(index);
              }}
            />
          ))}
        </div>
      ) : null}

      <span className={styles.srOnly} aria-live="polite">
        {slides[activeIndex].alt}
      </span>
    </div>
  );
}
