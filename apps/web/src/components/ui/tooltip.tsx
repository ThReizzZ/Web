"use client";

import { cn } from "@/lib/utils";

export function Tooltip({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("group/tooltip relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 rounded-md bg-slate-950 px-2 py-1 text-[11px] whitespace-nowrap text-white shadow-lg group-hover/tooltip:block"
      >
        {label}
      </span>
    </span>
  );
}
