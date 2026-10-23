import Image from "next/image";

import { cn } from "@/lib/utils";

export function UserAvatar({
  name,
  avatar,
  avatarUrl,
  size = "md",
  className,
}: {
  name: string;
  avatar?: string;
  avatarUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizeClass = {
    xs: "size-6 text-[10px]",
    sm: "size-7 text-[11px]",
    md: "size-9 text-xs",
    lg: "size-12 text-sm",
    xl: "size-20 text-2xl",
  }[size];

  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={`${name} 的头像`}
        width={80}
        height={80}
        className={cn(
          "shrink-0 rounded-full object-cover ring-2 ring-background",
          sizeClass,
          className,
        )}
        unoptimized
      />
    );
  }

  return (
    <span
      title={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white ring-2 ring-background",
        sizeClass,
        avatar ?? "from-slate-400 to-zinc-600",
        className,
      )}
    >
      {name.slice(0, 1)}
    </span>
  );
}
