import Link from "next/link";
import type { ReactNode } from "react";
import { TrophyIcon } from "@phosphor-icons/react/dist/ssr";

/** Khung 2 cột cho trang đăng nhập / đăng ký — tránh bố cục card căn giữa mặc định */
export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="mx-auto grid w-full max-w-5xl flex-1 gap-12 px-4 py-12 lg:grid-cols-[1fr_400px] lg:items-center lg:gap-16 lg:py-20">
      <div className="hidden lg:block">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand"
        >
          <TrophyIcon size={20} weight="duotone" />
          Esports Hub
        </Link>
        <h2 className="mt-6 text-4xl font-bold tracking-tight text-ink">
          Tổ chức giải đấu,
          <br />
          không cần bảng tính.
        </h2>
        <p className="mt-4 max-w-md text-ink-muted">
          Tạo giải nhiều vòng với thể thức riêng cho từng vòng, nhận đăng ký từ
          các đội và duyệt danh sách tham dự ở một nơi.
        </p>
      </div>

      <div className="rounded-xl border border-line bg-surface-card p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-ink">{title}</h1>
        <p className="mt-1.5 text-sm text-ink-muted">{subtitle}</p>
        {children}
        <p className="mt-6 text-center text-sm text-ink-muted">{footer}</p>
      </div>
    </div>
  );
}
