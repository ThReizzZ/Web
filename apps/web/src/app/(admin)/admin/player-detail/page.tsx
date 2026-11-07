import type { Metadata } from "next";

import { PlayerDetailManager } from "@/features/admin/components/player-detail-manager";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "玩家详情",
  robots: { index: false, follow: false },
};

interface AdminPlayerDetailPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminPlayerDetailPage({ searchParams }: AdminPlayerDetailPageProps) {
  const params = await searchParams;
  const raw = params.steamid;
  const initialSteamId = Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
  return <PlayerDetailManager initialSteamId={initialSteamId} />;
}
