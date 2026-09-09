import ResolvedImage from "@/components/ResolvedImage";
import { getTournamentBannerUrl } from "@/features/tournaments/banner";
import styles from "./BracketBackdrop.module.css";

const variants = [
  "stripes",
  "brush",
  "panels",
  "contours",
  "aurora",
  "ribbons",
  "silk",
] as const;

function variantForRound(roundId: string) {
  // Stable across server rendering, theme changes and realtime match updates.
  let hash = 2166136261;
  for (let index = 0; index < roundId.length; index++) {
    hash = Math.imul(hash ^ roundId.charCodeAt(index), 16777619);
  }
  return variants[(hash >>> 0) % variants.length];
}

export default function BracketBackdrop({
  roundId,
  bannerUrl,
}: {
  roundId: string;
  bannerUrl?: string | null;
}) {
  const variant = variantForRound(roundId);

  return (
    <div className={styles.backdrop} data-variant={variant} aria-hidden="true">
      <ResolvedImage
        src={bannerUrl}
        fallbackSrc={getTournamentBannerUrl()}
        alt=""
        className={styles.poster}
      />
      <div className={styles.wash} />
      <svg
        className={styles.art}
        viewBox="0 0 1200 800"
        preserveAspectRatio="none"
        focusable="false"
      >
        {variant === "brush" && (
          <>
            <g className={styles.primary}>
              <path d="M-30 12 140 0 88 20 204 11 104 35 148 39 24 54 72 37-30 53Z" />
              <path d="m-15 168 62-47-19 37 40-14-59 53 14-30-38 30Z" />
              <path d="m1020 790 72-20-27-2 152-36-19 31-81 14 40 5-119 18Z" />
              <path d="m1170 74 39-36-5 32-51 75 13-36-32 20Z" />
              <path d="m-10 724 141 26-57 4 112 34-118-16 22 14-104-37Z" />
            </g>
            <g className={styles.secondary}>
              <path d="m1100 0 37 43-2-26 44 63-12-49 23 20-18-51Z" />
              <path d="m1205 510-98 33 51-2-87 43 133-38Z" />
              <path d="m20 800 39-73-3 35 40-22-28 34 25-2-41 28Z" />
            </g>
            <g className={styles.fineLines}>
              <path d="m12 74 130-27m915 697 124-40M18 693l98 29m1030-570 44-62" />
            </g>
          </>
        )}
        {variant === "panels" && (
          <>
            <g className={styles.primary}>
              <path opacity="0.28" d="M0 0h560L0 186Z" />
              <path opacity="0.5" d="M0 24 450 0 78 114 0 93Z" />
              <path opacity="0.26" d="m1200 405-370 395h370Z" />
              <path opacity="0.45" d="m1200 632-318 168h318Z" />
            </g>
            <g className={styles.secondary}>
              <path opacity="0.35" d="M817 0h383v214L1010 92Z" />
              <path opacity="0.3" d="M0 538 249 800H0Z" />
            </g>
            <g className={styles.fineLines}>
              <path d="M0 153 492 0M938 800l262-293M0 585l199 215" />
            </g>
          </>
        )}
        {variant === "contours" && (
          <>
            <path className={styles.primary} opacity="0.12" d="M1200 318C1015 336 1088 618 900 681S615 737 549 800h651Z" />
            <g className={styles.contours}>
              <path d="M1230 283C986 317 1101 594 891 657S616 724 528 818" />
              <path d="M1230 299C1002 331 1112 607 902 671S630 738 549 818" />
              <path d="M1230 315C1018 345 1123 620 913 685S644 752 570 818" />
              <path opacity="0.4" d="M1230 331C1034 359 1134 633 924 699S658 766 591 818" />
              <path d="M-20 253C161 202 90 112 247 67S407 25 466-20" />
              <path opacity="0.45" d="M-20 269C173 216 104 126 259 81S421 39 485-20" />
            </g>
          </>
        )}
        {variant === "aurora" && (
          <g className={styles.sweeps}>
            <path d="M-120 238C259-42 626 166 1250-74" />
            <path d="M-120 254C259-26 626 182 1250-58" />
            <path d="M-80 824C391 538 761 858 1250 506" />
            <path d="M-80 834C391 548 761 868 1250 516" />
          </g>
        )}
        {variant === "ribbons" && (
          <>
            <g className={styles.primary}>
              <path opacity="0.42" d="M0 0h470l-38 85 540 104-27 91L0 77Z" />
              <path opacity="0.28" d="m0 260 734 145-32 83 498 95v104L0 371Z" />
              <path opacity="0.4" d="m0 579 498 94-22 82 210 45H0Z" />
            </g>
            <g className={styles.secondary}>
              <path opacity="0.42" d="m805 0-44 210 439 81V0Z" />
              <path opacity="0.3" d="m943 373-32 130 289 53V401Z" />
              <path opacity="0.35" d="m681 622-34 178h553v-78Z" />
            </g>
          </>
        )}
        {variant === "silk" && (
          <>
            <path className={styles.primary} opacity="0.22" d="M-80 780C228 741 399 699 530 532S848 359 1250 363V476C858 415 730 439 581 590S316 816-80 838Z" />
            <path className={styles.secondary} opacity="0.18" d="M231-30C429 124 438 350 626 451S1006 433 1250 476V526C944 460 787 588 571 465S408 185 188-30Z" />
            <g className={styles.silkLines}>
              <path d="M-80 786C228 747 399 705 530 538S848 365 1250 369" />
              <path d="M231-30C429 124 438 350 626 451S1006 433 1250 476" />
            </g>
            <path className={styles.silkHighlight} d="M-80 793C228 754 399 712 530 545S848 372 1250 376" />
          </>
        )}
      </svg>
    </div>
  );
}
