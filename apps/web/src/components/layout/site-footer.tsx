import Link from "next/link";

import { PageContainer } from "@/components/layout/page-container";
import { siteConfig } from "@/lib/site-config";

const footerLinks = [
  {
    title: "社区",
    links: [
      { label: "服务器", href: "/servers" },
      { label: "论坛", href: "/forum" },
      { label: "社区玩家", href: "/players" },
      { label: "用户中心", href: "/account" },
    ],
  },
  {
    title: "系统",
    links: [{ label: "服务器状态", href: "/servers" }],
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
          <p className="text-xs text-muted-foreground">服务器、论坛与用户数据来自 ThRei API。</p>
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
        <p>CS:GO KZ · 攀爬与跳跃社区</p>
      </PageContainer>
    </footer>
  );
}
