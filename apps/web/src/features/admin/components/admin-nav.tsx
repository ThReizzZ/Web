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

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const adminNav = [
  { label: "概览", href: "/admin", icon: LayoutDashboard, available: true },
  { label: "用户与角色", icon: Users, available: false },
  { label: "论坛内容", icon: MessageSquareText, available: false },
  { label: "内容审核", icon: ShieldCheck, available: false },
  { label: "审计日志", icon: FileClock, available: false },
  { label: "系统设置", icon: Settings2, available: false },
  { label: "服务状态", icon: Activity, available: false },
] as const;

export function AdminNav({ className }: { className?: string }) {
  return (
    <nav aria-label="管理面板导航" className={cn("space-y-1", className)}>
      {adminNav.map((item) =>
        item.available ? (
          <Link
            key={item.label}
            href={item.href}
            aria-current="page"
            className="flex shrink-0 items-center gap-2.5 rounded-md bg-background px-3 py-2 text-sm font-medium shadow-sm ring-1 ring-border"
          >
            <item.icon className="size-4 text-primary" aria-hidden="true" />
            {item.label}
          </Link>
        ) : (
          <span
            key={item.label}
            aria-disabled="true"
            className="flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground"
          >
            <item.icon className="size-4" aria-hidden="true" />
            {item.label}
            <Badge variant="muted" className="ml-auto">
              待实现
            </Badge>
          </span>
        ),
      )}
    </nav>
  );
}
