/** Class dùng chung cho form — giữ input/nút đồng nhất giữa các trang */

export const inputClass =
  "min-h-[var(--control-height)] w-full rounded-[var(--radius-control)] border border-line bg-input px-4 py-3 text-sm text-ink placeholder:text-ink-faint outline-none transition-[border-color,box-shadow,background-color] duration-200 hover:border-line-strong focus:border-brand-hover focus:bg-surface-card focus:shadow-[var(--shadow-focus)] disabled:cursor-not-allowed disabled:opacity-55";

export const labelClass = "mb-1.5 block text-sm font-medium text-ink-muted";

export const hintClass = "mt-1.5 text-xs text-ink-faint";

export const errorTextClass = "mt-1.5 text-xs text-rejected";

export const primaryButtonClass =
  "inline-flex min-h-[var(--control-height)] items-center justify-center gap-2 rounded-[var(--radius-control)] bg-gradient-brand px-6 py-3 text-sm font-semibold text-on-brand shadow-[var(--shadow-button)] transition-[transform,filter] duration-200 hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-50";

export const authSubmitButtonClass = `${primaryButtonClass} w-full hover:translate-y-0! hover:bg-[image:var(--gradient-primary-hover)]! hover:brightness-100! hover:shadow-none!`;

export const secondaryButtonClass =
  "inline-flex min-h-[var(--control-height)] items-center justify-center gap-2 rounded-[var(--radius-control)] border border-line-strong bg-surface-sub px-5 py-3 text-sm font-semibold text-ink transition-[transform,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:border-brand/70 hover:bg-surface-hover active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-50";

export const ghostButtonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-[var(--radius-control)] px-3.5 py-2 text-sm font-medium text-ink-muted transition-colors duration-200 hover:bg-surface-hover hover:text-ink focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]";

export const cardClass =
  "rounded-[var(--radius-card)] border border-line bg-surface-card";

export const alertErrorClass =
  "rounded-[var(--radius-control)] border border-rejected/40 bg-rejected/10 px-4 py-3 text-sm text-rejected";
