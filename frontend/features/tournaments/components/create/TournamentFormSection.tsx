import type { ReactNode } from "react";
import type { Icon } from "@phosphor-icons/react";

export default function TournamentFormSection({
  id,
  Icon,
  title,
  description,
  children,
}: {
  id: string;
  Icon: Icon;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 overflow-hidden rounded-xl border border-line bg-surface-card shadow-[0_1px_3px_rgb(15_23_42/0.05)]"
    >
      <div className="flex items-start gap-3 border-b border-line/80 px-5 py-5 sm:px-6">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-brand/25 bg-brand/12 text-brand-hover">
          <Icon size={22} weight="duotone" />
        </span>
        <div>
          <h2 className="font-bold text-ink">{title}</h2>
          <p className="mt-0.5 text-sm leading-6 text-ink-muted">
            {description}
          </p>
        </div>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}
