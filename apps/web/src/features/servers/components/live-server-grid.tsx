"use client";

import { HomeServerCard } from "@/features/servers/components/home-server-card";
import { useLiveServers } from "@/features/servers/data/live-servers";
import type { KzServer } from "@/features/servers/data/servers";

export function LiveServerGrid({ initialServers }: { initialServers: KzServer[] }) {
  const { data: servers } = useLiveServers(initialServers);
  const featuredServers = servers.filter((server) => server.featured).slice(0, 3);
  const displayedServers = featuredServers.length > 0 ? featuredServers : servers.slice(0, 3);

  if (displayedServers.length === 0) {
    return (
      <p className="rounded-xl border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
        当前没有开放的服务器。
      </p>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {displayedServers.map((server) => (
        <HomeServerCard key={server.id} server={server} />
      ))}
    </div>
  );
}
