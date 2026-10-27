import type { Metadata } from "next";

import { BansManager } from "@/features/admin/components/bans-manager";
import { getServerApiClient } from "@/lib/api/server";
import { fetchBans, fetchServerBans } from "@/services/content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "封禁管理",
  robots: { index: false, follow: false },
};

export default async function AdminBansPage() {
  const client = await getServerApiClient();
  const [bans, serverBans] = await Promise.all([fetchBans(client), fetchServerBans(client)]);
  return <BansManager bans={bans} serverBans={serverBans} />;
}
