"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ImageUploadPicker from "@/components/ImageUploadPicker";
import ResolvedImage from "@/components/ResolvedImage";
import { authApi } from "@/features/auth/api";
import { updateCurrentUser, useAuth } from "@/features/auth/store";
import { tournamentsApi } from "@/features/tournaments/api";
import TournamentCard from "@/features/tournaments/components/TournamentCard";
import type { Tournament } from "@/features/tournaments/types";
import { primaryButtonClass } from "@/components/ui";

const TABS = [
  { value: "organized", label: "Giải đã tổ chức" },
  { value: "joined", label: "Giải đã tham gia" },
] as const;

export default function MyProfilePage() {
  const router = useRouter();
  const { user, ready } = useAuth();
  const [tab, setTab] = useState<"organized" | "joined">("organized");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [avatarSuccess, setAvatarSuccess] = useState("");
  /** Gắn kết quả với tab đã sinh ra nó để suy trạng thái tải, tránh setState trong effect */
  const [result, setResult] = useState<{
    tab: "organized" | "joined";
    data: Tournament[];
  } | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.push("/login");
      return;
    }
    let cancelled = false;
    tournamentsApi
      .findMine(tab)
      .then((res) => {
        if (!cancelled) setResult({ tab, data: res });
      })
      .catch(() => {
        if (!cancelled) setResult({ tab, data: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [tab, router, ready, user]);

  const loading = result?.tab !== tab;
  const tournaments = result?.data ?? [];

  const uploadAvatar = async () => {
    if (!avatarFile || !user) return;
    setAvatarUploading(true);
    setAvatarError("");
    setAvatarSuccess("");
    try {
      const uploaded = await authApi.uploadAvatar(avatarFile);
      updateCurrentUser({ ...user, avatarUrl: uploaded.url });
      setAvatarFile(null);
      setAvatarSuccess("Ảnh đại diện đã được cập nhật.");
    } catch (uploadError) {
      setAvatarError(
        uploadError instanceof Error
          ? uploadError.message
          : "Không thể cập nhật ảnh đại diện.",
      );
    } finally {
      setAvatarUploading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <div className="rounded-2xl border border-line bg-surface-card p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full bg-brand text-xl font-bold text-on-brand">
            <ResolvedImage
              src={user?.avatarUrl}
              alt={user ? `Ảnh đại diện của ${user.displayName}` : "Ảnh đại diện"}
              className="size-full object-cover object-center"
              fallback={user?.displayName?.charAt(0).toUpperCase() || "?"}
            />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-ink">
              {user?.displayName}
            </h1>
            <p className="truncate text-sm text-ink-muted">{user?.email}</p>
          </div>
        </div>

        <div className="mt-5 border-t border-line pt-5">
          <ImageUploadPicker
            label="Đổi ảnh đại diện"
            file={avatarFile}
            onFileChange={(file) => {
              setAvatarFile(file);
              setAvatarError("");
              setAvatarSuccess("");
            }}
            existingUrl={user?.avatarUrl}
            variant="avatar"
            uploading={avatarUploading}
            uploadError={avatarError}
            successMessage={avatarSuccess}
          />
          {avatarFile && (
            <button
              type="button"
              disabled={avatarUploading}
              onClick={uploadAvatar}
              className={`${primaryButtonClass} mt-4`}
            >
              {avatarUploading ? "Đang tải lên…" : "Lưu ảnh đại diện"}
            </button>
          )}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = tab === t.value;
          return (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                active
                  ? "border-brand bg-brand/12 text-brand"
                  : "border-line text-ink-muted hover:border-line-strong hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                aria-hidden
                className="h-[168px] rounded-xl border border-line bg-surface-card"
              />
            ))}
          </div>
        ) : tournaments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line px-6 py-16 text-center">
            <p className="font-medium text-ink">
              {tab === "organized"
                ? "Bạn chưa tổ chức giải nào"
                : "Bạn chưa tham gia giải nào"}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
              {tab === "organized"
                ? "Tạo giải đấu để bắt đầu nhận đăng ký từ các đội."
                : "Tìm một giải đang mở đăng ký và nộp đội của bạn."}
            </p>
            <Link
              href={tab === "organized" ? "/tournaments/new" : "/"}
              className={`${primaryButtonClass} mt-5`}
            >
              {tab === "organized" ? "Tạo giải đấu" : "Xem giải đang mở"}
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
