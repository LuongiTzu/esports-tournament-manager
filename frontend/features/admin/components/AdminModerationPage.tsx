"use client";

import AdminCommentsPanel from "@/features/admin/components/AdminCommentsPanel";
import BannedKeywordManagement from "@/features/admin/components/BannedKeywordManagement";

export default function AdminModerationPage() {
  return (
    <div>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Content moderation</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">Kiểm duyệt nội dung</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">
          Quản lý trạng thái hiển thị bình luận và danh sách từ khóa mà bộ lọc backend đang áp dụng.
        </p>
      </header>
      <div className="mt-5 space-y-5">
        <AdminCommentsPanel />
        <BannedKeywordManagement />
      </div>
    </div>
  );
}
