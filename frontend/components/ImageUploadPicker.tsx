"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowClockwiseIcon,
  CameraIcon,
  ImageIcon,
  SpinnerGapIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import BannerImageCropper from "@/components/BannerImageCropper";
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
  dropzone?: boolean;
  appearance?: "default" | "avatar-overlay";
  crop?: {
    aspect: number;
    maxWidth: number;
    maxHeight: number;
  };
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
  dropzone = false,
  appearance = "default",
  crop,
}: ImageUploadPickerProps) {
  const { t } = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectionError, setSelectionError] = useState("");
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);
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

  const selectFile = (nextFile: File) => {
    const validationError = validateImageFile(nextFile);
    if (validationError) {
      setSelectionError(
        t(
          validationError === "INVALID_TYPE"
            ? "image.invalidType"
            : "image.tooLarge",
        ),
      );
      return false;
    }

    setSelectionError("");
    if (crop) {
      setPendingCropFile(nextFile);
    } else {
      onFileChange(nextFile);
    }
    return true;
  };

  const containerClass =
    variant === "banner"
      ? "aspect-[16/6] w-full rounded-xl"
      : variant === "avatar"
        ? "size-28 rounded-full"
        : "size-28 rounded-xl";

  return (
    <div>
      {pendingCropFile && crop && (
        <BannerImageCropper
          file={pendingCropFile}
          aspect={crop.aspect}
          maxWidth={crop.maxWidth}
          maxHeight={crop.maxHeight}
          onCancel={() => {
            setPendingCropFile(null);
            if (inputRef.current) inputRef.current.value = "";
          }}
          onConfirm={(croppedFile) => {
            const validationError = validateImageFile(croppedFile);
            if (validationError) {
              setSelectionError(t("image.tooLarge"));
              return;
            }
            setSelectionError("");
            setPendingCropFile(null);
            onFileChange(croppedFile);
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
      )}
      {appearance === "avatar-overlay" ? (
        <div className="inline-flex max-w-40 flex-col items-center">
          <input
            ref={inputRef}
            type="file"
            accept={IMAGE_ACCEPT}
            disabled={disabled || uploading}
            className="sr-only"
            onChange={(event) => {
              const nextFile = event.target.files?.[0];
              if (!nextFile) return;
              if (!selectFile(nextFile)) event.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
            aria-label={label}
            title={label}
            className="group relative size-28 rounded-full focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] disabled:cursor-wait"
          >
            <span className="grid size-full place-items-center overflow-hidden rounded-full border-2 border-line-strong bg-surface-sub text-ink-faint shadow-[var(--shadow-elevated)] transition group-hover:border-brand">
              {previewUrl ? (
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
            </span>
            <span className="absolute bottom-0 right-0 grid size-9 place-items-center rounded-full border-2 border-surface-card bg-surface-sub text-ink shadow-md transition group-hover:bg-brand group-hover:text-on-brand">
              {uploading ? (
                <SpinnerGapIcon className="animate-spin" size={18} />
              ) : (
                <CameraIcon size={18} weight="bold" />
              )}
            </span>
          </button>
          {(selectionError || uploadError) && (
            <p role="alert" className="mt-2 text-center text-xs text-rejected">
              {selectionError || uploadError}
            </p>
          )}
          {successMessage && (
            <p role="status" className="mt-2 text-center text-xs text-approved">
              {successMessage}
            </p>
          )}
        </div>
      ) : (
        <>
      <span className="block text-sm font-medium text-ink">{label}</span>
      <div
        className={`mt-2 flex flex-col gap-3 ${
          variant === "banner" ? "" : "sm:flex-row sm:items-center"
        }`}
      >
        <div
          role={dropzone ? "button" : undefined}
          tabIndex={dropzone && !disabled && !uploading ? 0 : undefined}
          aria-label={dropzone ? label : undefined}
          onClick={
            dropzone && !disabled && !uploading
              ? () => inputRef.current?.click()
              : undefined
          }
          onKeyDown={(event) => {
            if (!dropzone || disabled || uploading) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            if (!dropzone || disabled || uploading) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(event) => {
            if (!dropzone || disabled || uploading) return;
            event.preventDefault();
            const nextFile = event.dataTransfer.files?.[0];
            if (nextFile) selectFile(nextFile);
          }}
          className={`${containerClass} grid shrink-0 place-items-center overflow-hidden border border-dashed border-line bg-surface-sub text-ink-faint ${
            dropzone && !disabled
              ? "cursor-pointer border-2 transition-colors hover:border-brand hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
              : ""
          }`}
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
              if (!selectFile(nextFile)) {
                event.target.value = "";
              }
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
        </>
      )}
    </div>
  );
}
