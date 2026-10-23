import type { Metadata } from "next";

import { WhitelistManager } from "@/features/admin/components/whitelist-manager";
import { getServerApiClient } from "@/lib/api/server";
import { fetchWhitelistOverview } from "@/services/content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "白名单审核",
  robots: { index: false, follow: false },
};

export default async function AdminWhitelistPage() {
  const client = await getServerApiClient();
  const overview = await fetchWhitelistOverview(client);
  return <WhitelistManager initial={overview} />;
}
