"use client";

import { useEffect, useRef, useState } from "react";
import { Map as MapIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function ServerMapImage({
  src,
  fallbackSrc,
  alt,
  className,
  loading = "lazy",
  emptyLabel = "暂无地图图片",
  showEmptyState = true,
}: {
  src: string;
  fallbackSrc?: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
  emptyLabel?: string | null;
  showEmptyState?: boolean;
}) {
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const sources = [src, fallbackSrc ?? ""].filter(
    (value, index, values) => Boolean(value) && values.indexOf(value) === index,
  );
  const imageSrc = sources.find((source) => !failedSources.includes(source));

  // A 404 can arrive before React hydrates and attaches onError. Check the
  // already-settled image after mount so the fallback still gets a chance.
  useEffect(() => {
    const image = imageRef.current;
    if (!image || !imageSrc) {
      return;
    }
    if (image.complete && image.naturalWidth === 0) {
      setFailedSources((current) =>
        current.includes(imageSrc) ? current : [...current, imageSrc],
      );
    }
  }, [imageSrc]);

  return (
    <div role={alt ? "img" : undefined} aria-label={alt || undefined} className="absolute inset-0">
      {imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imageRef}
          src={imageSrc}
          alt=""
          loading={loading}
          decoding="async"
          onError={() =>
            setFailedSources((current) =>
              current.includes(imageSrc) ? current : [...current, imageSrc],
            )
          }
          className={cn("absolute inset-0 size-full object-cover", className)}
        />
      ) : showEmptyState ? (
        <div
          aria-hidden="true"
          className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-white/35"
        >
          <MapIcon className="size-5" aria-hidden="true" />
          {emptyLabel ? <span className="text-[11px]">{emptyLabel}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
