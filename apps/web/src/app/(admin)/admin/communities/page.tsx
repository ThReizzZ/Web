import type { Metadata } from "next";

import { CommunityAdminManager } from "@/features/admin/components/community-admin-manager";
import { getServerApiClient } from "@/lib/api/server";
import { fetchAdminCommunities, fetchAdminServers } from "@/services/content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "社区组管理",
  robots: { index: false, follow: false },
};

export default async function AdminCommunitiesPage() {
  const client = await getServerApiClient();
  const [communities, overview] = await Promise.all([
    fetchAdminCommunities(client),
    fetchAdminServers(client),
  ]);
  return (
    <CommunityAdminManager initialCommunities={communities} initialServers={overview.servers} />
  );
}
