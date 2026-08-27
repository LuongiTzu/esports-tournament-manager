"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowCounterClockwiseIcon,
  ArrowClockwiseIcon,
  CropIcon,
  MinusIcon,
  PlusIcon,
  XIcon,
} from "@phosphor-icons/react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { useLocale } from "@/features/locale/store";

interface BannerImageCropperProps {
  file: File;
  aspect: number;
  maxWidth: number;
  maxHeight: number;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("IMAGE_LOAD_FAILED"));
    image.src = source;
  });
}

function rotatedSize(width: number, height: number, rotation: number) {
  const radians = (rotation * Math.PI) / 180;
  return {
    width: Math.abs(Math.cos(radians) * width) + Math.abs(Math.sin(radians) * height),
    height: Math.abs(Math.sin(radians) * width) + Math.abs(Math.cos(radians) * height),
  };
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("IMAGE_EXPORT_FAILED"))),
      "image/webp",
      0.9,
    );
  });
}

async function cropImage(
  source: string,
  originalName: string,
  crop: Area,
  rotation: number,
  maxWidth: number,
  maxHeight: number,
) {
  const image = await loadImage(source);
  const bounds = rotatedSize(image.naturalWidth, image.naturalHeight, rotation);
  const rotationCanvas = document.createElement("canvas");
  rotationCanvas.width = Math.ceil(bounds.width);
  rotationCanvas.height = Math.ceil(bounds.height);

  const rotationContext = rotationCanvas.getContext("2d");
  if (!rotationContext) throw new Error("CANVAS_UNAVAILABLE");

  rotationContext.imageSmoothingEnabled = true;
  rotationContext.imageSmoothingQuality = "high";
  rotationContext.translate(rotationCanvas.width / 2, rotationCanvas.height / 2);
  rotationContext.rotate((rotation * Math.PI) / 180);
  rotationContext.translate(-image.naturalWidth / 2, -image.naturalHeight / 2);
  rotationContext.drawImage(image, 0, 0);

  const scale = Math.min(1, maxWidth / crop.width, maxHeight / crop.height);
  const outputWidth = Math.max(1, Math.round(crop.width * scale));
  const outputHeight = Math.max(1, Math.round(crop.height * scale));
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = outputWidth;
  outputCanvas.height = outputHeight;

  const outputContext = outputCanvas.getContext("2d");
  if (!outputContext) throw new Error("CANVAS_UNAVAILABLE");

  outputContext.imageSmoothingEnabled = true;
  outputContext.imageSmoothingQuality = "high";
  outputContext.drawImage(
    rotationCanvas,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  const blob = await canvasToBlob(outputCanvas);
  const baseName = originalName.replace(/\.[^.]+$/, "") || "banner";
  return new File([blob], `${baseName}-cropped.webp`, {
    type: "image/webp",
    lastModified: Date.now(),
  });
}

export default function BannerImageCropper({
  file,
  aspect,
  maxWidth,
  maxHeight,
  onCancel,
  onConfirm,
}: BannerImageCropperProps) {
  const { t } = useLocale();
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const sourceUrl = useMemo(() => URL.createObjectURL(file), [file]);
  const revokeTimerRef = useRef<{ url: string; timer: number } | null>(null);

  useEffect(() => {
    if (revokeTimerRef.current?.url === sourceUrl) {
      window.clearTimeout(revokeTimerRef.current.timer);
      revokeTimerRef.current = null;
    }

    return () => {
      revokeTimerRef.current = {
        url: sourceUrl,
        timer: window.setTimeout(() => URL.revokeObjectURL(sourceUrl), 0),
      };
    };
  }, [sourceUrl]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !processing) onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCancel, processing]);

  const confirmCrop = async () => {
    if (!croppedArea) return;
    setProcessing(true);
    setError("");
    try {
      onConfirm(
        await cropImage(
          sourceUrl,
          file.name,
          croppedArea,
          rotation,
          maxWidth,
          maxHeight,
        ),
      );
    } catch {
      setError(t("image.cropError"));
      setProcessing(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !processing) onCancel();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="banner-crop-title"
        className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-sm border border-line bg-surface-card shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-4 py-4 sm:px-6">
          <div>
            <h2 id="banner-crop-title" className="font-bold text-ink">
              {t("image.cropTitle")}
            </h2>
            <p className="mt-1 text-xs leading-5 text-ink-faint">
              {t("image.cropHint")}
            </p>
          </div>
          <button
            type="button"
            autoFocus
            disabled={processing}
            onClick={onCancel}
            aria-label={t("common.close")}
            className="grid size-9 shrink-0 place-items-center rounded-sm border border-line text-ink-muted transition-colors hover:bg-surface-hover disabled:opacity-50"
          >
            <XIcon size={18} />
          </button>
        </header>

        <div className="relative min-h-64 flex-1 bg-slate-950 sm:min-h-[28rem]">
          {sourceUrl && (
            <Cropper
              image={sourceUrl}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              minZoom={1}
              maxZoom={4}
              showGrid
              objectFit="cover"
              disableAutomaticStylesInjection
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setCroppedArea(pixels)}
            />
          )}
        </div>

        <div className="border-t border-line bg-surface-sub/65 px-4 py-4 sm:px-6">
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            <label className="flex items-center gap-3 text-xs font-medium text-ink-muted">
              <MinusIcon size={15} />
              <span className="sr-only">{t("image.zoom")}</span>
              <input
                type="range"
                min={1}
                max={4}
                step={0.01}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="h-1.5 flex-1 cursor-pointer accent-[var(--color-brand)]"
              />
              <PlusIcon size={15} />
            </label>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                disabled={processing}
                onClick={() => setRotation((value) => value - 90)}
                aria-label={t("image.rotateLeft")}
                className="grid size-10 place-items-center rounded-sm border border-line bg-surface-card text-brand transition-colors hover:bg-brand/10 disabled:opacity-50"
              >
                <ArrowCounterClockwiseIcon size={19} weight="bold" />
              </button>
              <button
                type="button"
                disabled={processing}
                onClick={() => setRotation((value) => value + 90)}
                aria-label={t("image.rotateRight")}
                className="grid size-10 place-items-center rounded-sm border border-line bg-surface-card text-brand transition-colors hover:bg-brand/10 disabled:opacity-50"
              >
                <ArrowClockwiseIcon size={19} weight="bold" />
              </button>
            </div>

            {error && (
              <p role="alert" className="text-center text-xs text-rejected">
                {error}
              </p>
            )}
          </div>
        </div>

        <footer className="flex justify-end gap-3 border-t border-line px-4 py-4 sm:px-6">
          <button
            type="button"
            disabled={processing}
            onClick={onCancel}
            className="min-h-10 rounded-sm border border-line-strong bg-surface-card px-5 text-sm font-semibold text-ink disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            disabled={processing || !croppedArea}
            onClick={confirmCrop}
            className="inline-flex min-h-10 items-center gap-2 rounded-sm bg-brand px-5 text-sm font-semibold text-on-brand disabled:opacity-50"
          >
            <CropIcon size={17} weight="bold" />
            {processing ? t("image.cropProcessing") : t("image.cropConfirm")}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
