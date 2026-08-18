import type { ComponentType, ReactNode, SVGProps } from "react";

export type TournamentFormatIcon = ComponentType<SVGProps<SVGSVGElement>>;

function FormatIcon({
  children,
  ...props
}: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function SingleEliminationIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <FormatIcon {...props}>
      <circle cx="8" cy="10" r="3" />
      <circle cx="8" cy="24" r="3" />
      <circle cx="8" cy="40" r="3" />
      <circle cx="8" cy="54" r="3" />
      <path d="M11 10h8v7h8" />
      <path d="M11 24h8v-7" />
      <path d="M11 40h8v7h8" />
      <path d="M11 54h8v-7" />
      <path d="M27 17h8v15h10" />
      <path d="M27 47h8V32" />
      <path d="M45 32h8" />
      <circle cx="57" cy="32" r="3" />
    </FormatIcon>
  );
}

export function RoundRobinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <FormatIcon {...props}>
      <circle cx="32" cy="9" r="4" />
      <circle cx="55" cy="32" r="4" />
      <circle cx="32" cy="55" r="4" />
      <circle cx="9" cy="32" r="4" />
      <path d="M39 11a23 23 0 0 1 14 14" />
      <path d="m49 23 5 3 1-6" />
      <path d="M53 39a23 23 0 0 1-14 14" />
      <path d="m41 49-3 5 6 1" />
      <path d="M25 53A23 23 0 0 1 11 39" />
      <path d="m15 41-5-3-1 6" />
      <path d="M11 25a23 23 0 0 1 14-14" />
      <path d="m23 15 3-5-6-1" />
    </FormatIcon>
  );
}

export function GroupStageIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <FormatIcon {...props}>
      <rect x="7" y="7" width="21" height="21" rx="2" />
      <rect x="36" y="7" width="21" height="21" rx="2" />
      <rect x="7" y="36" width="21" height="21" rx="2" />
      <rect x="36" y="36" width="21" height="21" rx="2" />
      <path d="M17.5 12v11M12 17.5h11" />
      <path d="M41 17.5h11M46.5 12v11" />
      <path d="M17.5 41v11M12 46.5h11" />
      <path d="M41 46.5h11M46.5 41v11" />
    </FormatIcon>
  );
}

export function DoubleEliminationIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <FormatIcon {...props}>
      <circle cx="8" cy="12" r="3" />
      <circle cx="8" cy="28" r="3" />
      <circle cx="8" cy="44" r="3" />
      <circle cx="8" cy="56" r="3" />
      <path d="M11 12h9v8h9" />
      <path d="M11 28h9v-8" />
      <path d="M29 20h9v8h8" />
      <path d="M11 44h12v6h8" />
      <path d="M11 56h12v-6" />
      <path d="M31 50h7V36h8" />
      <path d="M20 28v8h11" />
      <path d="M46 28v8" />
      <path d="M46 32h7" />
      <circle cx="57" cy="32" r="3" />
    </FormatIcon>
  );
}

export function SwissStageIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <FormatIcon {...props}>
      <circle cx="9" cy="16" r="4" />
      <circle cx="55" cy="16" r="4" />
      <circle cx="9" cy="48" r="4" />
      <circle cx="55" cy="48" r="4" />
      <path d="M13 16h7c12 0 12 32 24 32h7" />
      <path d="M13 48h7c12 0 12-32 24-32h7" />
      <path d="m47 12 4 4-4 4" />
      <path d="m47 44 4 4-4 4" />
      <circle cx="32" cy="24" r="2" />
      <circle cx="32" cy="40" r="2" />
    </FormatIcon>
  );
}
