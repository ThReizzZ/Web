import {
  GraduationCap,
  LifeBuoy,
  Map as MapIcon,
  Megaphone,
  MessagesSquare,
  type LucideIcon,
} from "lucide-react";

import type { CategoryIcon } from "@/features/forum/data/forum";
import { cn } from "@/lib/utils";

const icons: Record<CategoryIcon, LucideIcon> = {
  megaphone: Megaphone,
  messages: MessagesSquare,
  map: MapIcon,
  graduation: GraduationCap,
  "life-buoy": LifeBuoy,
};

export const categoryTone: Record<CategoryIcon, string> = {
  megaphone: "bg-amber-500/10 text-amber-600",
  messages: "bg-sky-500/10 text-sky-600",
  map: "bg-emerald-500/10 text-emerald-600",
  graduation: "bg-violet-500/10 text-violet-600",
  "life-buoy": "bg-rose-500/10 text-rose-600",
};

export function ForumCategoryIcon({ icon, className }: { icon: CategoryIcon; className?: string }) {
  const Icon = icons[icon];
  return <Icon className={cn("size-5", className)} aria-hidden="true" />;
}
