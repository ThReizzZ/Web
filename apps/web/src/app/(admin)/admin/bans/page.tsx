import type { Metadata } from "next";

import { BansManager } from "@/features/admin/components/bans-manager";
import { getServerApiClient } from "@/lib/api/server";
import { fetchAdminServers, fetchServerBans, fetchServerIpBans } from "@/services/content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "封禁管理",
  robots: { index: false, follow: false },
};

export default async function AdminBansPage() {
  const client = await getServerApiClient();
  const [serverBans, ipBans, overview] = await Promise.all([
    fetchServerBans(client),
    fetchServerIpBans(client),
    fetchAdminServers(client),
  ]);
  return (
    <BansManager
      serverBans={serverBans}
      ipBans={ipBans}
      servers={overview.servers.map((server) => ({ id: server.id, name: server.name }))}
    />
  );
}
