import Link from "next/link";
import {
  Activity,
  FileClock,
  LayoutDashboard,
  MessageSquareText,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

const adminNav = [
  { label: "概览", href: "/admin#overview", icon: LayoutDashboard },
  { label: "用户与角色", href: "/admin#users", icon: Users },
  { label: "论坛内容", href: "/admin#content", icon: MessageSquareText },
  { label: "内容审核", href: "/admin#moderation", icon: ShieldCheck },
  { label: "审计日志", href: "/admin#audit", icon: FileClock },
  { label: "系统设置", href: "/admin#settings", icon: Settings2 },
  { label: "服务状态", href: "/admin#status", icon: Activity },
] as const;

export function AdminNav({ className }: { className?: string }) {
  return (
    <nav aria-label="管理面板导航" className={cn("space-y-1", className)}>
      {adminNav.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className="flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          <item.icon className="size-4" aria-hidden="true" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
