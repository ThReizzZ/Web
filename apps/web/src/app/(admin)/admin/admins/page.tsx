import type { Metadata } from "next";

import { AdminAccountsManager } from "@/features/admin/components/admin-accounts-manager";
import { getServerApiClient } from "@/lib/api/server";
import { fetchAdminAccounts, fetchMe } from "@/services/content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "管理员管理",
  robots: { index: false, follow: false },
};

export default async function AdminAccountsPage() {
  const client = await getServerApiClient();
  const [admins, me] = await Promise.all([fetchAdminAccounts(client), fetchMe(client)]);
  if (!me.user) {
    return null;
  }
  return <AdminAccountsManager admins={admins} currentSteamId={me.user.steamId64} />;
}
