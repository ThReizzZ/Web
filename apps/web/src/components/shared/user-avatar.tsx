import { cn } from "@/lib/utils";

export function UserAvatar({
  name,
  avatar,
  size = "md",
  className,
}: {
  name: string;
  avatar: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizeClass = {
    sm: "size-7 text-[11px]",
    md: "size-9 text-xs",
    lg: "size-12 text-sm",
    xl: "size-20 text-2xl",
  }[size];

  return (
    <span
      title={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white ring-2 ring-background",
        sizeClass,
        avatar,
        className,
      )}
    >
      {name.slice(0, 1)}
    </span>
  );
}
