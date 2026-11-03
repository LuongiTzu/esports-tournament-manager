"use client";

import { useId, useState } from "react";
import { YoutubeLogoIcon } from "@phosphor-icons/react";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { useLocale } from "@/features/locale/store";
import { ApiError } from "@/lib/api/client";
import { matchesApi } from "../api";
import { parseYouTubeUrl } from "../youtube";
import YouTubePlayer from "./YouTubePlayer";

export default function MatchYouTubeEditor({
  matchId,
  youtubeUrl,
  disabledReason,
  busy,
  onBusyChange,
  onSaved,
}: {
  matchId: string;
  youtubeUrl: string | null;
  disabledReason: string | null;
  busy: boolean;
  onBusyChange: (saving: boolean) => void;
  onSaved: (url: string | null) => Promise<void>;
}) {
  const { t } = useLocale();
  const id = useId();
  const [value, setValue] = useState(youtubeUrl ?? "");
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const parsed = parseYouTubeUrl(value);
  const disabled = busy || saving || Boolean(disabledReason);
  const changed =
    value.trim() !== (youtubeUrl ?? "") && parsed?.url !== youtubeUrl;

  async function save(remove = false) {
    if (disabled) return;
    if (remove && !window.confirm(t("youtube.removeConfirm"))) return;
    if (!remove && !parsed) {
      setError(t("youtube.invalid"));
      return;
    }
    setSaving(true);
    onBusyChange(true);
    setError("");
    setSuccess("");
    try {
      const result = await matchesApi.updateYouTube(
        matchId,
        remove ? null : parsed!.url,
      );
      setValue(result.youtubeUrl ?? "");
      setPreview(null);
      setSuccess(t(remove ? "youtube.removed" : "youtube.saved"));
      // A refresh failure must not be presented as a failed write.
      try {
        await onSaved(result.youtubeUrl);
      } catch {
        setError(t("youtube.refreshError"));
      }
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.status === 401
            ? t("youtube.unauthorized")
            : reason.status === 403
              ? t("youtube.forbidden")
              : reason.code === "INVALID_YOUTUBE_URL"
                ? t("youtube.invalid")
                : reason.code === "MATCH_YOUTUBE_READ_ONLY"
                  ? t("youtube.readOnly")
                  : reason.message
          : t("youtube.saveError"),
      );
    } finally {
      setSaving(false);
      onBusyChange(false);
    }
  }

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="rounded-xl border border-line p-4 sm:p-5"
    >
      <h3
        id={`${id}-title`}
        className="flex items-center gap-2 text-sm font-bold text-ink"
      >
        <YoutubeLogoIcon size={20} aria-hidden="true" />
        {t("youtube.title")}
      </h3>
      <p id={`${id}-hint`} className="mt-2 text-sm text-ink-muted">
        {t("youtube.hint")}
      </p>
      {disabledReason && (
        <p className="mt-2 text-sm text-pending">{disabledReason}</p>
      )}
      <label htmlFor={id} className={`${labelClass} mt-4`}>
        {t("youtube.label")}
      </label>
      <input
        id={id}
        type="url"
        inputMode="url"
        maxLength={2048}
        value={value}
        disabled={disabled}
        placeholder="https://www.youtube.com/live/..."
        className={inputClass}
        aria-invalid={Boolean(error)}
        aria-describedby={`${id}-hint ${id}-error`}
        onChange={(event) => {
          setValue(event.target.value);
          setError("");
          setSuccess("");
          setPreview(null);
        }}
      />
      <p
        id={`${id}-error`}
        role={error ? "alert" : undefined}
        className="mt-2 text-sm text-rejected"
      >
        {error}
      </p>
      {success && (
        <p role="status" className="mt-2 text-sm text-approved">
          {success}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || !value.trim()}
          className={secondaryButtonClass}
          onClick={() => {
            if (parsed) {
              setPreview(parsed.url);
              setError("");
            } else setError(t("youtube.invalid"));
          }}
        >
          {t("youtube.preview")}
        </button>
        <button
          type="button"
          disabled={disabled || !changed}
          className={primaryButtonClass}
          onClick={() => void save()}
        >
          {saving ? t("common.saving") : t("youtube.save")}
        </button>
        {youtubeUrl && (
          <button
            type="button"
            disabled={disabled}
            className={secondaryButtonClass}
            onClick={() => void save(true)}
          >
            {t("youtube.remove")}
          </button>
        )}
      </div>
      {youtubeUrl && !preview && (
        <a
          href={youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm text-brand hover:underline"
        >
          {t("youtube.open")}
        </a>
      )}
      {preview && (
        <div className="mt-4">
          <YouTubePlayer url={preview} />
        </div>
      )}
    </section>
  );
}
