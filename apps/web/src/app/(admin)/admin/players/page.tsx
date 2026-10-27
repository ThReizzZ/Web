import type { Metadata } from "next";

import { AdminPlayersManager } from "@/features/admin/components/admin-players-manager";
import { getServerApiClient } from "@/lib/api/server";
import { fetchAdminPlayers } from "@/services/content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "登录玩家",
  robots: { index: false, follow: false },
};

export default async function AdminPlayersPage() {
  const client = await getServerApiClient();
  const players = await fetchAdminPlayers(client);
  return <AdminPlayersManager players={players} />;
}
