import Link from "next/link";
import { LogIn } from "lucide-react";

import { Brand } from "@/components/layout/brand";
import { PageContainer } from "@/components/layout/page-container";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { getServerApiClient } from "@/lib/api/server";
import { siteConfig } from "@/lib/site-config";
import { fetchMe, type AuthUser } from "@/services/content";

async function loadUser(): Promise<AuthUser | null> {
  try {
    const client = await getServerApiClient();
    const response = await fetchMe(client);
    return response.user;
  } catch {
    return null;
  }
}

export async function SiteHeader() {
  const user = await loadUser();
  const navItems =
    user?.role === "admin"
      ? [...siteConfig.nav, { title: "管理面板", href: "/admin" }]
      : siteConfig.nav;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <PageContainer className="flex min-h-16 flex-wrap items-center justify-between gap-x-6 gap-y-3 py-3">
        <Brand />
        <nav aria-label="主导航" className="order-3 w-full sm:order-none sm:w-auto">
          <ul className="flex flex-wrap items-center gap-1 text-sm">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex h-8 items-center rounded-md px-3 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {user ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/account">
              <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="xs" />
              <span className="max-w-32 truncate">{user.name}</span>
            </Link>
          </Button>
        ) : (
          <Button asChild size="sm">
            <a href="/api/v1/auth/steam/login">
              <LogIn aria-hidden="true" />
              使用Steam登录
            </a>
          </Button>
        )}
      </PageContainer>
    </header>
  );
}
