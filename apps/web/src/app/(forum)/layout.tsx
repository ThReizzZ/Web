import { PageContainer } from "@/components/layout/page-container";
import { SiteShell } from "@/components/layout/site-shell";
import { ForumSidebar } from "@/features/forum/components/forum-sidebar";
import type { ForumCategory } from "@/features/forum/types";
import { getServerApiClient } from "@/lib/api/server";
import { fetchForumCategories } from "@/services/content";

export const dynamic = "force-dynamic";

export default async function ForumLayout({ children }: { children: React.ReactNode }) {
  let categories: ForumCategory[] = [];
  try {
    const client = await getServerApiClient();
    categories = await fetchForumCategories(client);
  } catch {
    // The forum still renders its main content when category metadata is unavailable.
  }

  return (
    <SiteShell>
      <PageContainer className="py-8">
        <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)]">
          <ForumSidebar categories={categories} />
          <div className="min-w-0">{children}</div>
        </div>
      </PageContainer>
    </SiteShell>
  );
}
