"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Ban,
  ClipboardCheck,
  LayoutDashboard,
  MessageSquareText,
  Server,
  UserCog,
} from "lucide-react";

import { cn } from "@/lib/utils";

const adminNav = [
  { label: "概览", href: "/admin", icon: LayoutDashboard },
  { label: "管理员", href: "/admin/admins", icon: UserCog },
  { label: "论坛管理", href: "/admin/forum", icon: MessageSquareText },
  { label: "服务器管理", href: "/admin/servers", icon: Server },
  { label: "封禁管理", href: "/admin/bans", icon: Ban },
  { label: "白名单审核", href: "/admin/whitelist", icon: ClipboardCheck },
] as const;

export function AdminNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label="管理面板导航" className={cn("space-y-1", className)}>
      {adminNav.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname === item.href;
        return (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-background hover:text-foreground",
            )}
          >
            <item.icon className="size-4" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
