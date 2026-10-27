"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

export function ServerMapImage({
  src,
  alt,
  className,
  loading = "lazy",
}: {
  src: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  return (
    <>
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.42),transparent_58%)]"
      />
      {src && failedSrc !== src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading={loading}
          decoding="async"
          onError={() => setFailedSrc(src)}
          className={cn("absolute inset-0 size-full object-cover", className)}
        />
      ) : null}
    </>
  );
}
