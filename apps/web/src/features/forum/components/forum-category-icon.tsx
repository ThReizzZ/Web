import { Hammer, LifeBuoy, Megaphone, MessagesSquare, Trees, type LucideIcon } from "lucide-react";

import type { CategoryIcon } from "@/features/forum/data/forum";
import { cn } from "@/lib/utils";

const icons: Record<CategoryIcon, LucideIcon> = {
  megaphone: Megaphone,
  messages: MessagesSquare,
  trees: Trees,
  hammer: Hammer,
  "life-buoy": LifeBuoy,
};

export const categoryTone: Record<CategoryIcon, string> = {
  megaphone: "bg-amber-500/10 text-amber-600",
  messages: "bg-sky-500/10 text-sky-600",
  trees: "bg-emerald-500/10 text-emerald-600",
  hammer: "bg-violet-500/10 text-violet-600",
  "life-buoy": "bg-rose-500/10 text-rose-600",
};

export function ForumCategoryIcon({ icon, className }: { icon: CategoryIcon; className?: string }) {
  const Icon = icons[icon];
  return <Icon className={cn("size-5", className)} aria-hidden="true" />;
}
