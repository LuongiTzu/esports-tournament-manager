"use client";

import { useEffect, useMemo, useState } from "react";
import { ChatCircleTextIcon, MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import { adminApi } from "@/features/admin/api";
import type { AdminComment, AdminCommentsQuery } from "@/features/admin/types";
import { alertErrorClass, inputClass, secondaryButtonClass } from "@/components/ui";
import AdminCommentList from "@/features/admin/components/AdminCommentList";
import AdminCommentDetail from "@/features/admin/components/AdminCommentDetail";

function queryKey(query: AdminCommentsQuery) {
  return JSON.stringify(query);
}

export default function AdminCommentsPanel() {
  const [query, setQuery] = useState<AdminCommentsQuery>({});
  const [searchDraft, setSearchDraft] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState<{ key: string; comments: AdminComment[] } | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [workingAction, setWorkingAction] = useState<"VISIBILITY" | "DELETE" | "">("");
  const currentKey = queryKey(query);

  useEffect(() => {
    let cancelled = false;
    adminApi.listComments(query).then((comments) => {
      if (cancelled) return;
      setResult({ key: currentKey, comments });
      setSelectedId((current) => comments.some((item) => item.id === current) ? current : (comments[0]?.id ?? ""));
      setError("");
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Không tải được bình luận.");
    });
    return () => { cancelled = true; };
  }, [currentKey, query, reloadKey]);

  const loading = result?.key !== currentKey && !error;
  const comments = result?.key === currentKey ? result.comments : null;
  const selected = useMemo(() => comments?.find((item) => item.id === selectedId) ?? null, [comments, selectedId]);

  const refetch = async () => {
    const refreshed = await adminApi.listComments(query);
    setResult({ key: currentKey, comments: refreshed });
    setSelectedId((current) => refreshed.some((item) => item.id === current) ? current : (refreshed[0]?.id ?? ""));
  };

  const toggleHidden = async () => {
    if (!selected || workingAction) return;
    const nextHidden = !selected.isHidden;
    if (!window.confirm(nextHidden ? "Ẩn bình luận này nhưng vẫn giữ dữ liệu?" : "Khôi phục hiển thị bình luận này?")) return;
    setWorkingAction("VISIBILITY"); setError(""); setNotice("");
    try {
      await adminApi.setCommentHidden(selected.id, nextHidden);
      await refetch();
      setNotice(nextHidden ? "Đã ẩn bình luận." : "Đã khôi phục bình luận.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể cập nhật bình luận.");
    } finally { setWorkingAction(""); }
  };

  const deleteComment = async () => {
    if (!selected || workingAction) return;
    if (!window.confirm("Xóa vĩnh viễn bình luận này? Dữ liệu sẽ không thể khôi phục.")) return;
    setWorkingAction("DELETE"); setError(""); setNotice("");
    try {
      await adminApi.deleteComment(selected.id);
      await refetch();
      setNotice("Đã xóa vĩnh viễn bình luận.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xóa bình luận.");
    } finally { setWorkingAction(""); }
  };

  const reset = () => { setSearchDraft(""); setQuery({}); setError(""); setNotice(""); };

  return (
    <section className="rounded-2xl border border-line bg-surface-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand"><ChatCircleTextIcon size={22} weight="duotone" /></span>
        <div><h2 className="text-lg font-black text-ink">Kiểm duyệt bình luận</h2><p className="mt-1 text-xs leading-5 text-ink-faint">Ẩn/khôi phục giữ nguyên dữ liệu; xóa là thao tác vĩnh viễn.</p></div>
      </div>

      <form onSubmit={(event) => { event.preventDefault(); setQuery((current) => ({ ...current, search: searchDraft.trim() || undefined })); }} className="mt-4 grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_10rem_auto]">
        <label className="relative"><span className="sr-only">Tìm nội dung bình luận</span><MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" /><input type="search" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Tìm trong nội dung" className={`${inputClass} pl-10`} /></label>
        <label><span className="sr-only">Trạng thái hiển thị</span><select value={query.isHidden === undefined ? "ALL" : query.isHidden ? "HIDDEN" : "VISIBLE"} onChange={(event) => setQuery((current) => ({ ...current, isHidden: event.target.value === "ALL" ? undefined : event.target.value === "HIDDEN" }))} className={inputClass}><option value="ALL">Tất cả</option><option value="VISIBLE">Đang hiển thị</option><option value="HIDDEN">Đã ẩn</option></select></label>
        <div className="flex gap-2"><button type="submit" className="min-h-[var(--control-height)] flex-1 rounded-xl bg-brand px-4 text-sm font-semibold text-on-brand hover:bg-brand-hover">Tìm</button>{(query.search || query.isHidden !== undefined) && <button type="button" aria-label="Xóa bộ lọc" onClick={reset} className={`${secondaryButtonClass} px-3`}><XIcon /></button>}</div>
      </form>

      {notice && <p role="status" className="mt-3 rounded-xl bg-approved/10 px-3 py-2 text-sm text-approved">{notice}</p>}
      {error && <div className="mt-3"><p role="alert" className={alertErrorClass}>{error}</p>{!comments && <button type="button" onClick={() => { setError(""); setReloadKey((value) => value + 1); }} className={`${secondaryButtonClass} mt-2`}>Thử lại</button>}</div>}

      {loading ? <div className="mt-4 h-72 animate-pulse rounded-xl bg-surface-sub" /> : comments ? comments.length === 0 ? <div className="mt-4 rounded-xl border border-dashed border-line px-4 py-12 text-center text-sm text-ink-muted">Không có bình luận phù hợp.</div> : <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(18rem,1.1fr)]"><AdminCommentList comments={comments} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setError(""); setNotice(""); }} />{selected && <AdminCommentDetail comment={selected} workingAction={workingAction} onToggleHidden={toggleHidden} onDelete={deleteComment} />}</div> : null}
    </section>
  );
}
