import Link from "next/link";
import { Gamepad2 } from "lucide-react";

import { Brand } from "@/components/layout/brand";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site-config";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <PageContainer className="flex min-h-16 flex-wrap items-center justify-between gap-x-6 gap-y-3 py-3">
        <Brand />
        <nav aria-label="主导航" className="order-3 w-full sm:order-none sm:w-auto">
          <ul className="flex flex-wrap items-center gap-1 text-sm">
            {siteConfig.nav.map((item) => (
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
        <Button asChild size="sm" variant="outline">
          <Link href="/servers">
            <Gamepad2 aria-hidden="true" />
            加入服务器
          </Link>
        </Button>
      </PageContainer>
    </header>
  );
}
