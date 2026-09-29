import type { ReactNode } from "react";

export default function RegistrationFormSection({
  icon,
  title,
  description,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border border-line bg-surface-card/95 shadow-[0_14px_36px_rgb(0_0_0/0.1)]">
      <div className="flex flex-col gap-4 border-b border-line bg-surface-sub/45 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center border border-accent/25 bg-accent/10 text-accent">
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="font-bold text-ink">{title}</h2>
            {description && (
              <p className="mt-1 text-sm leading-5 text-ink-muted">
                {description}
              </p>
            )}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
