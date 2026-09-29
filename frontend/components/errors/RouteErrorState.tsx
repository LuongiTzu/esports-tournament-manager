"use client";

import Link from "next/link";
import { ArrowClockwiseIcon, HouseIcon, WarningIcon } from "@phosphor-icons/react";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui";

export default function RouteErrorState({
  title = "Không thể tải nội dung này",
  description = "Đã xảy ra lỗi ngoài dự kiến. Bạn có thể thử lại hoặc quay về trang chủ.",
  reset,
}: {
  title?: string;
  description?: string;
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <section className="w-full max-w-xl rounded-2xl border border-rejected/30 bg-surface-card p-6 text-center shadow-[var(--shadow-elevated)] sm:p-8">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-rejected/10 text-rejected">
          <WarningIcon size={30} weight="duotone" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-xl font-bold text-ink sm:text-2xl">
          {title}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-muted">
          {description}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className={primaryButtonClass}>
            <ArrowClockwiseIcon aria-hidden="true" />
            Thử lại
          </button>
          <Link href="/" className={secondaryButtonClass}>
            <HouseIcon aria-hidden="true" />
            Về trang chủ
          </Link>
        </div>
      </section>
    </div>
  );
}
