import type { Metadata } from "next";

import { AccessLogsManager } from "@/features/admin/components/access-logs-manager";
import { getServerApiClient } from "@/lib/api/server";
import { fetchAdminServers } from "@/services/content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "进服监控",
  robots: { index: false, follow: false },
};

export default async function AdminAccessLogsPage() {
  const client = await getServerApiClient();
  const overview = await fetchAdminServers(client);
  return (
    <AccessLogsManager
      servers={overview.servers.map((server) => ({ id: server.id, name: server.name }))}
    />
  );
}
