"use client";

import Image from "next/image";
import type { TournamentFormatIcon } from "@/features/home/components/TournamentFormatIcons";

interface TournamentFormatCardProps {
  title: string;
  description: string;
  imageUrl: string;
  Icon: TournamentFormatIcon;
  active: boolean;
  onActivate: () => void;
}

export default function TournamentFormatCard({
  title,
  description,
  imageUrl,
  Icon,
  active,
  onActivate,
}: TournamentFormatCardProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onMouseEnter={onActivate}
      onFocus={onActivate}
      onClick={onActivate}
      className={`group relative w-full overflow-hidden rounded-sm border text-center outline-none transition-[transform,border-color] duration-300 ease-out will-change-transform focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transform-none motion-reduce:transition-none ${
        active
          ? "h-[30.5rem] -translate-y-2 border-brand/35"
          : "h-[23rem] border-transparent"
      }`}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(82,33,139,0.92)_0%,rgba(50,26,68,0.9)_55%,rgba(36,23,28,0.96)_100%)] transition-opacity duration-300 motion-reduce:transition-none ${
          active ? "opacity-100" : "opacity-0"
        }`}
      />

      <span aria-hidden className="absolute inset-x-0 top-0 h-52 overflow-hidden">
        <span
          className={`absolute inset-0 transform-gpu transition-transform duration-500 ease-out will-change-transform motion-reduce:transform-none motion-reduce:transition-none ${
            active ? "scale-[1.04]" : "scale-100"
          }`}
        >
          <Image
            src={imageUrl}
            alt=""
            fill
            sizes="(min-width: 1200px) 260px, (min-width: 640px) 272px, 86vw"
            className="object-cover object-center"
          />
        </span>
        <span
          className={`absolute inset-0 bg-[linear-gradient(to_bottom,transparent_32%,rgba(40,20,50,0.35)_64%,rgba(40,20,50,1)_100%)] transition-opacity duration-300 motion-reduce:transition-none ${
            active ? "opacity-100" : "opacity-35"
          }`}
        />
      </span>

      <span
        aria-hidden={!active}
        className={`absolute left-4 right-4 top-[13.5rem] text-[0.8125rem] font-medium leading-5 text-white/90 transition-[opacity,transform] duration-300 ease-out will-change-[opacity,transform] motion-reduce:transform-none motion-reduce:transition-none ${
          active ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        {description}
      </span>

      <span
        className={`absolute inset-x-4 top-[14.5rem] flex transform-gpu flex-col items-center transition-transform duration-500 ease-out will-change-transform motion-reduce:transition-none ${
          active ? "translate-y-[5.75rem]" : "translate-y-0"
        }`}
      >
        <span
          className={`transition-[color,filter] duration-300 motion-reduce:transition-none ${
            active
              ? "text-fuchsia-300 drop-shadow-[0_0_8px_rgba(192,38,211,0.25)]"
              : "text-white"
          }`}
        >
          <Icon className="size-[58px]" />
        </span>

        <span
          className={`mt-4 text-balance text-lg font-bold uppercase leading-6 tracking-wide transition-opacity duration-300 motion-reduce:transition-none sm:text-xl ${
            active ? "text-white opacity-100" : "text-ink opacity-85"
          }`}
        >
          {title}
        </span>
      </span>
    </button>
  );
}
