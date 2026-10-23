import Link from "next/link";

import { PageContainer } from "@/components/layout/page-container";
import { siteConfig } from "@/lib/site-config";

const footerLinks = [
  {
    title: "社区",
    links: [
      { label: "论坛首页", href: "/forum" },
      { label: "用户中心", href: "/account" },
    ],
  },
  {
    title: "系统",
    links: [
      { label: "管理面板", href: "/admin" },
      { label: "管理概览", href: "/admin" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <PageContainer className="grid gap-10 py-12 md:grid-cols-[2fr_1fr_1fr]">
        <div className="space-y-3">
          <p className="text-lg font-semibold tracking-tight">{siteConfig.name}</p>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            {siteConfig.description}
          </p>
          <p className="text-xs text-muted-foreground">
            当前为架构初始化版本：官网、论坛、用户中心与管理面板共享同一套 API 和身份体系。
          </p>
        </div>
        {footerLinks.map((group) => (
          <div key={group.title} className="space-y-3">
            <p className="text-sm font-medium">{group.title}</p>
            <ul className="space-y-2 text-sm">
              {group.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </PageContainer>
      <PageContainer className="flex flex-col gap-2 border-t py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
        </p>
        <p>Next.js · Axum · PostgreSQL · Redis</p>
      </PageContainer>
    </footer>
  );
}
