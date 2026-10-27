"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

export function ServerMapImage({
  src,
  fallbackSrc,
  alt,
  className,
  loading = "lazy",
}: {
  src: string;
  fallbackSrc?: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  const [failedSources, setFailedSources] = useState<string[]>([]);

  const sources = [src, fallbackSrc ?? ""].filter(
    (value, index, values) => Boolean(value) && values.indexOf(value) === index,
  );
  const imageSrc = sources.find((source) => !failedSources.includes(source));

  return (
    <>
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.42),transparent_58%)]"
      />
      {imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSrc}
          alt={alt}
          loading={loading}
          decoding="async"
          onError={() => setFailedSources((current) => [...current, imageSrc])}
          className={cn("absolute inset-0 size-full object-cover", className)}
        />
      ) : null}
    </>
  );
}
