"use client";

/* eslint-disable @next/next/no-img-element -- URLs include authenticated backend-owned uploads and legacy external hosts. */

import { useState, type ReactNode } from "react";
import { resolveImageUrl } from "@/lib/image-url";

interface ResolvedImageProps {
  src?: string | null;
  fallbackSrc?: string | null;
  fallback?: ReactNode;
  alt: string;
  className?: string;
}

export default function ResolvedImage({
  src,
  fallbackSrc,
  fallback = null,
  alt,
  className,
}: ResolvedImageProps) {
  const primary = resolveImageUrl(src);
  const backup = resolveImageUrl(fallbackSrc);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const displayUrl = primary && failedUrl !== primary ? primary : backup;

  if (!displayUrl || failedUrl === displayUrl) return <>{fallback}</>;

  return (
    <img
      src={displayUrl}
      alt={alt}
      className={className}
      onError={() => setFailedUrl(displayUrl)}
    />
  );
}
