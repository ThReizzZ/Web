import Link from "next/link";

import { cn } from "@/lib/utils";

export function Brand({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("group inline-flex items-center gap-2.5 rounded-md", className)}
      aria-label="threi 社区首页"
    >
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-sm">
        t
      </span>
      <span className="text-lg font-semibold tracking-tight">threi</span>
    </Link>
  );
}
