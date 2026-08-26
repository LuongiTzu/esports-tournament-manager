"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon } from "@phosphor-icons/react";
import { useLocale } from "@/features/locale/store";
import { THEME_OPTIONS } from "@/features/theme/options";
import { useTheme } from "@/features/theme/store";

export default function ThemeSwitcher({ iconOnly = false }: { iconOnly?: boolean }) {
  const { mode, setMode } = useTheme();
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected =
    THEME_OPTIONS.find((option) => option.mode === mode) ?? THEME_OPTIONS[1];
  const SelectedIcon = selected.icon;

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={t("theme.label")}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`${t("theme.label")}: ${t(selected.label)}`}
        onClick={() => setOpen((current) => !current)}
        className={`${iconOnly ? "grid size-10 place-items-center rounded-xl" : "inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface/55 px-2.5"} text-xs font-semibold text-ink-muted transition hover:bg-surface-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand`}
      >
        <SelectedIcon size={16} />
        {!iconOnly && <span className="hidden xl:inline">{t(selected.label)}</span>}
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t("theme.label")}
          className="absolute right-0 top-full z-50 mt-2 min-w-40 rounded-xl border border-line bg-surface-elevated p-1.5 shadow-[var(--shadow-elevated)]"
        >
          {THEME_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = option.mode === mode;
            return (
              <button
                key={option.mode}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setMode(option.mode);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                  active
                    ? "bg-brand/12 font-semibold text-brand"
                    : "text-ink-muted hover:bg-surface-hover hover:text-ink"
                }`}
              >
                <Icon size={17} />
                <span className="flex-1">{t(option.label)}</span>
                {active && <CheckIcon size={15} weight="bold" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
