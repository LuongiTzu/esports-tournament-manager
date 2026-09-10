"use client";

import { useEffect, useId, useRef } from "react";
import styles from "./TextLoop.module.css";

interface TextLoopProps {
  text: string;
  direction?: "forward" | "reverse";
  speed?: number;
  paused?: boolean;
  color?: string;
  ribbonColor?: string;
  ribbonEndColor?: string;
}

// The supplied TextLoop's SVG wave, cropped to a shallow celebration ribbon.
const WAVE = "M -320 120 Q -160 80 0 120 T 320 120 T 640 120 T 960 120 T 1280 120 T 1600 120 T 1920 120";

export default function TextLoop({
  text,
  direction = "forward",
  speed = 90,
  paused = false,
  color = "#241706",
  ribbonColor = "#eac66d",
  ribbonEndColor = ribbonColor,
}: TextLoopProps) {
  const pathId = `text-loop-${useId().replace(/:/g, "")}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const measureRef = useRef<SVGTextElement>(null);
  const headRef = useRef<SVGTextPathElement>(null);
  const tailRef = useRef<SVGTextPathElement>(null);
  const pausedRef = useRef(paused);
  const unit = `${text.toUpperCase()}\u00a0✦\u00a0`;

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const root = rootRef.current;
    const path = pathRef.current;
    const measure = measureRef.current;
    const head = headRef.current;
    const tail = tailRef.current;
    if (!root || !path || !measure || !head || !tail) return;

    let cancelled = false;
    let frame = 0;
    let previousTime = 0;
    let offset = 0;
    let length = 0;
    let hovering = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const apply = () => {
      head.setAttribute("startOffset", String(offset));
      tail.setAttribute("startOffset", String(offset >= 0 ? offset - length : offset + length));
    };

    const measureText = () => {
      if (cancelled) return;
      length = path.getTotalLength();
      const unitWidth = measure.getComputedTextLength();
      if (!length || !unitWidth) return;
      const repeated = unit.repeat(Math.max(1, Math.round(length / unitWidth)));
      for (const element of [head, tail]) {
        element.textContent = repeated;
        element.setAttribute("textLength", String(length));
      }
      apply();
    };

    const tick = (time: number) => {
      const elapsed = previousTime ? Math.min(time - previousTime, 64) / 1000 : 0;
      previousTime = time;
      if (length && !pausedRef.current && !hovering && !document.hidden) {
        offset = (offset + elapsed * speed * (direction === "reverse" ? -1 : 1)) % length;
        apply();
      }
      frame = requestAnimationFrame(tick);
    };

    const updateMotion = () => {
      cancelAnimationFrame(frame);
      previousTime = 0;
      if (!reducedMotion.matches && speed > 0) frame = requestAnimationFrame(tick);
    };
    const pauseOnHover = () => { hovering = true; };
    const resumeOnLeave = () => { hovering = false; };

    measureText();
    void document.fonts.ready.then(measureText);
    updateMotion();
    reducedMotion.addEventListener("change", updateMotion);
    root.addEventListener("pointerenter", pauseOnHover);
    root.addEventListener("pointerleave", resumeOnLeave);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      reducedMotion.removeEventListener("change", updateMotion);
      root.removeEventListener("pointerenter", pauseOnHover);
      root.removeEventListener("pointerleave", resumeOnLeave);
    };
  }, [unit, direction, speed]);

  return (
    <div ref={rootRef} className={styles.root} aria-hidden="true">
      <svg className={styles.svg} viewBox="0 80 1600 80">
        <defs>
          <linearGradient id={`${pathId}-ribbon`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={ribbonColor} />
            <stop offset="100%" stopColor={ribbonEndColor} />
          </linearGradient>
        </defs>
        <path ref={pathRef} id={pathId} d={WAVE} fill="none" stroke={`url(#${pathId}-ribbon)`} strokeWidth={36} />
        <text ref={measureRef} className={styles.measure}>{unit}</text>
        <text fill={color} dominantBaseline="central">
          <textPath ref={headRef} href={`#${pathId}`} startOffset={0} lengthAdjust="spacing" />
        </text>
        <text fill={color} dominantBaseline="central">
          <textPath ref={tailRef} href={`#${pathId}`} startOffset={0} lengthAdjust="spacing" />
        </text>
      </svg>
    </div>
  );
}
