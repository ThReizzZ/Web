import type { Metadata } from "next";

import { ServerAdminManager } from "@/features/admin/components/server-admin-manager";
import { getServerApiClient } from "@/lib/api/server";
import { fetchAdminCommunities, fetchAdminServers } from "@/services/content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "服务器管理",
  robots: { index: false, follow: false },
};

export default async function AdminServersPage() {
  const client = await getServerApiClient();
  const [overview, communities] = await Promise.all([
    fetchAdminServers(client),
    fetchAdminCommunities(client),
  ]);
  return <ServerAdminManager initial={overview} communities={communities} />;
}
