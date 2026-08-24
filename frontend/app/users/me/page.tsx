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
import { useLocale } from "@/features/locale/store";

export default function MyProfilePage() {
  const router = useRouter();
  const { t } = useLocale();
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
      setAvatarSuccess(t("profile.avatarUpdated"));
    } catch (uploadError) {
      setAvatarError(
        uploadError instanceof Error
          ? uploadError.message
          : t("profile.avatarUpdateError"),
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
              alt={user ? `${t("profile.avatarAlt")} ${user.displayName}` : t("profile.avatarAlt")}
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
            label={t("profile.changeAvatar")}
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
              {avatarUploading ? t("profile.uploading") : t("profile.saveAvatar")}
            </button>
          )}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        {(["organized", "joined"] as const).map((tabValue) => {
          const active = tab === tabValue;
          return (
            <button
              key={tabValue}
              onClick={() => setTab(tabValue)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                active
                  ? "border-brand bg-brand/12 text-brand"
                  : "border-line text-ink-muted hover:border-line-strong hover:text-ink"
              }`}
            >
              {t(tabValue === "organized" ? "profile.organized" : "profile.joined")}
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
                ? t("profile.emptyOrganized")
                : t("profile.emptyJoined")}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
              {tab === "organized"
                ? t("profile.emptyOrganizedHelp")
                : t("profile.emptyJoinedHelp")}
            </p>
            <Link
              href={tab === "organized" ? "/tournaments/new" : "/"}
              className={`${primaryButtonClass} mt-5`}
            >
              {tab === "organized" ? t("profile.createTournament") : t("profile.viewOpen")}
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
