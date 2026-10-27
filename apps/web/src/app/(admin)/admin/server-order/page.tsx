import type { Metadata } from "next";

import { ServerOrderManager } from "@/features/admin/components/server-order-manager";
import { getServerApiClient } from "@/lib/api/server";
import { fetchAdminServers } from "@/services/content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "服务器排序",
  robots: { index: false, follow: false },
};

export default async function AdminServerOrderPage() {
  const client = await getServerApiClient();
  const overview = await fetchAdminServers(client);
  return <ServerOrderManager initialServers={overview.servers} />;
}
