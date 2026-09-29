import Link from "next/link";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr";
import { primaryButtonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <section className="w-full max-w-xl text-center">
        <p className="font-mono text-sm font-bold text-brand">404</p>
        <h1 className="mt-3 text-3xl font-black text-ink">
          Không tìm thấy trang
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink-muted">
          Đường dẫn không tồn tại hoặc nội dung đã được di chuyển.
        </p>
        <Link href="/" className={`${primaryButtonClass} mt-6`}>
          <ArrowLeftIcon aria-hidden="true" />
          Về trang chủ
        </Link>
      </section>
    </div>
  );
}
