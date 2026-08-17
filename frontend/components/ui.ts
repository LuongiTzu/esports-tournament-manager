/** Class dùng chung cho form — giữ input/nút đồng nhất giữa các trang */

export const inputClass =
  "w-full rounded-lg border border-line bg-surface-sub px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30";

export const labelClass = "mb-1.5 block text-sm font-medium text-ink-muted";

export const hintClass = "mt-1.5 text-xs text-ink-faint";

export const errorTextClass = "mt-1.5 text-xs text-rejected";

export const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-on-brand shadow-lg shadow-brand/10 transition hover:brightness-110 hover:shadow-glow-brand active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface-sub px-4 py-2.5 text-sm font-medium text-ink transition hover:border-line-strong active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50";

export const cardClass = "rounded-xl border border-line bg-surface-card";

export const alertErrorClass =
  "rounded-lg border border-rejected/40 bg-rejected/10 px-4 py-3 text-sm text-rejected";
