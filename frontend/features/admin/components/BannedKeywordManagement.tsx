"use client";

import { useEffect, useState } from "react";
import { FloppyDiskIcon, PlusIcon, ProhibitIcon, TrashIcon, XIcon } from "@phosphor-icons/react";
import { adminApi } from "@/features/admin/api";
import type { AdminBannedKeyword, BannedKeywordCategory } from "@/features/admin/types";
import { alertErrorClass, inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { formatAdminDate } from "@/features/admin/format";
import { useLocale } from "@/features/locale/store";

const CATEGORY_LABELS: Record<BannedKeywordCategory, string> = {
  GAMBLING: "Cá cược",
  PROFANITY: "Ngôn từ không phù hợp",
  MALICIOUS_LINK: "Liên kết độc hại",
};

export default function BannedKeywordManagement() {
  const { locale } = useLocale();
  const [keywords, setKeywords] = useState<AdminBannedKeyword[] | null>(null);
  const [keywordDraft, setKeywordDraft] = useState("");
  const [categoryDraft, setCategoryDraft] = useState<BannedKeywordCategory>("PROFANITY");
  const [editingId, setEditingId] = useState("");
  const [editKeyword, setEditKeyword] = useState("");
  const [editCategory, setEditCategory] = useState<BannedKeywordCategory>("PROFANITY");
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    adminApi.listBannedKeywords().then((rows) => {
      if (!cancelled) { setKeywords(rows); setError(""); }
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Không tải được từ khóa cấm.");
    });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const refetch = async () => setKeywords(await adminApi.listBannedKeywords());

  const createKeyword = async () => {
    const keyword = keywordDraft.trim();
    if (!keyword || keyword.length > 100 || workingId) return;
    setWorkingId("CREATE"); setError(""); setNotice("");
    try {
      await adminApi.createBannedKeyword({ keyword, category: categoryDraft });
      await refetch();
      setKeywordDraft("");
      setNotice("Đã thêm từ khóa và làm mới bộ lọc nội dung backend.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể thêm từ khóa.");
    } finally { setWorkingId(""); }
  };

  const startEdit = (item: AdminBannedKeyword) => {
    setEditingId(item.id); setEditKeyword(item.keyword); setEditCategory(item.category); setError(""); setNotice("");
  };

  const saveEdit = async () => {
    const keyword = editKeyword.trim();
    if (!editingId || !keyword || keyword.length > 100 || workingId) return;
    setWorkingId(editingId); setError(""); setNotice("");
    try {
      await adminApi.updateBannedKeyword(editingId, { keyword, category: editCategory });
      await refetch();
      setEditingId("");
      setNotice("Đã cập nhật từ khóa và làm mới bộ lọc nội dung backend.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể cập nhật từ khóa.");
    } finally { setWorkingId(""); }
  };

  const deleteKeyword = async (item: AdminBannedKeyword) => {
    if (workingId || !window.confirm(`Xóa vĩnh viễn từ khóa “${item.keyword}”?`)) return;
    setWorkingId(item.id); setError(""); setNotice("");
    try {
      await adminApi.deleteBannedKeyword(item.id);
      await refetch();
      if (editingId === item.id) setEditingId("");
      setNotice("Đã xóa từ khóa và làm mới bộ lọc nội dung backend.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xóa từ khóa.");
    } finally { setWorkingId(""); }
  };

  return (
    <section className="rounded-2xl border border-line bg-surface-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-rejected/12 text-rejected"><ProhibitIcon size={22} weight="duotone" /></span>
        <div><h2 className="text-lg font-black text-ink">Từ khóa cấm</h2><p className="mt-1 text-xs leading-5 text-ink-faint">Danh sách này được backend áp dụng cho nội dung giải đấu, đội và bình luận.</p></div>
      </div>

      <form onSubmit={(event) => { event.preventDefault(); void createKeyword(); }} className="mt-4 grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_11rem_auto]">
        <label><span className="sr-only">Từ khóa mới</span><input value={keywordDraft} onChange={(event) => setKeywordDraft(event.target.value)} minLength={1} maxLength={100} required placeholder="Nhập từ khóa" className={inputClass} /></label>
        <label><span className="sr-only">Phân loại từ khóa</span><select value={categoryDraft} onChange={(event) => setCategoryDraft(event.target.value as BannedKeywordCategory)} className={inputClass}>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <button type="submit" disabled={Boolean(workingId) || !keywordDraft.trim()} className={primaryButtonClass}><PlusIcon /> {workingId === "CREATE" ? "Đang thêm..." : "Thêm từ khóa"}</button>
      </form>
      <p className="mt-2 text-xs text-ink-faint">1–100 ký tự. Backend trim giá trị và kiểm tra trùng lặp khi cập nhật.</p>

      {notice && <p role="status" className="mt-3 rounded-xl bg-approved/10 px-3 py-2 text-sm text-approved">{notice}</p>}
      {error && <div className="mt-3"><p role="alert" className={alertErrorClass}>{error}</p>{!keywords && <button type="button" onClick={() => { setError(""); setReloadKey((value) => value + 1); }} className={`${secondaryButtonClass} mt-2`}>Thử lại</button>}</div>}

      {keywords === null ? <div className="mt-4 h-48 animate-pulse rounded-xl bg-surface-sub" /> : keywords.length === 0 ? <div className="mt-4 rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-ink-muted">Chưa có từ khóa cấm.</div> : (
        <div className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line">
          {keywords.map((item) => editingId === item.id ? (
            <form key={item.id} onSubmit={(event) => { event.preventDefault(); void saveEdit(); }} className="grid gap-2 bg-surface-sub p-3 sm:grid-cols-[minmax(10rem,1fr)_11rem_auto]">
              <input value={editKeyword} onChange={(event) => setEditKeyword(event.target.value)} minLength={1} maxLength={100} required className={inputClass} />
              <select value={editCategory} onChange={(event) => setEditCategory(event.target.value as BannedKeywordCategory)} className={inputClass}>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              <div className="flex gap-2"><button type="submit" disabled={Boolean(workingId) || !editKeyword.trim()} className={`${secondaryButtonClass} flex-1 px-3`}><FloppyDiskIcon /> Lưu</button><button type="button" disabled={Boolean(workingId)} aria-label="Hủy sửa" onClick={() => setEditingId("")} className={`${secondaryButtonClass} px-3`}><XIcon /></button></div>
            </form>
          ) : (
            <div key={item.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0"><p className="break-all font-semibold text-ink">{item.keyword}</p><p className="mt-1 text-xs text-ink-faint">{CATEGORY_LABELS[item.category]} · {formatAdminDate(item.createdAt, locale)}</p></div>
              <div className="flex shrink-0 gap-2"><button type="button" disabled={Boolean(workingId)} onClick={() => startEdit(item)} className={`${secondaryButtonClass} min-h-10 px-3 py-2`}>Sửa</button><button type="button" disabled={Boolean(workingId)} onClick={() => void deleteKeyword(item)} className={`${secondaryButtonClass} min-h-10 border-rejected/40 px-3 py-2 text-rejected`}><TrashIcon /> {workingId === item.id ? "Đang xóa..." : "Xóa"}</button></div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
