"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowClockwiseIcon, ImageIcon, TrashIcon } from "@phosphor-icons/react";
import ResolvedImage from "@/components/ResolvedImage";
import { secondaryButtonClass } from "@/components/ui";
import { useLocale } from "@/features/locale/store";

export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(IMAGE_ACCEPT.split(","));

export function validateImageFile(file: File): "INVALID_TYPE" | "TOO_LARGE" | null {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    return "INVALID_TYPE";
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return "TOO_LARGE";
  }
  return null;
}

interface ImageUploadPickerProps {
  label: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  existingUrl?: string | null;
  variant?: "banner" | "square" | "avatar";
  disabled?: boolean;
  uploading?: boolean;
  uploadError?: string;
  successMessage?: string;
}

export default function ImageUploadPicker({
  label,
  file,
  onFileChange,
  existingUrl,
  variant = "square",
  disabled = false,
  uploading = false,
  uploadError,
  successMessage,
}: ImageUploadPickerProps) {
  const { t } = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectionError, setSelectionError] = useState("");
  const previewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const clearSelection = () => {
    onFileChange(null);
    setSelectionError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const containerClass =
    variant === "banner"
      ? "aspect-[16/6] w-full rounded-xl"
      : variant === "avatar"
        ? "size-28 rounded-full"
        : "size-28 rounded-xl";

  return (
    <div>
      <span className="block text-sm font-medium text-ink">{label}</span>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div
          className={`${containerClass} grid shrink-0 place-items-center overflow-hidden border border-dashed border-line bg-surface-sub text-ink-faint`}
        >
          {previewUrl ? (
            // Object URLs are browser-local previews and must not pass through the persisted URL resolver.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={t("image.selectedPreview")}
              className="size-full object-cover object-center"
            />
          ) : (
            <ResolvedImage
              src={existingUrl}
              alt={t("image.current")}
              className="size-full object-cover object-center"
              fallback={<ImageIcon size={30} weight="duotone" />}
            />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={IMAGE_ACCEPT}
            disabled={disabled || uploading}
            className="sr-only"
            onChange={(event) => {
              const nextFile = event.target.files?.[0];
              if (!nextFile) return;
              const validationError = validateImageFile(nextFile);
              if (validationError) {
                setSelectionError(
                  t(validationError === "INVALID_TYPE" ? "image.invalidType" : "image.tooLarge"),
                );
                event.target.value = "";
                return;
              }
              setSelectionError("");
              onFileChange(nextFile);
            }}
          />
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
            className={secondaryButtonClass}
          >
            <ArrowClockwiseIcon size={16} />
            {file ? t("image.chooseAnother") : t("image.chooseDevice")}
          </button>
          {file && (
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={clearSelection}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-rejected transition hover:bg-rejected/10 disabled:opacity-50"
            >
              <TrashIcon size={16} />
              {t("image.removeSelected")}
            </button>
          )}
          <p className="w-full text-xs text-ink-faint">
            {t("image.requirements")}
          </p>
          {(selectionError || uploadError) && (
            <p role="alert" className="w-full text-xs text-rejected">
              {selectionError || uploadError}
            </p>
          )}
          {uploading && (
            <p className="w-full text-xs text-brand">{t("image.uploading")}</p>
          )}
          {successMessage && (
            <p role="status" className="w-full text-xs text-approved">
              {successMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
