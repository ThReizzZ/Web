"use client";

import { useLiveServers } from "@/features/servers/data/live-servers";
import {
  getMaxPlayerTotal,
  getOnlinePlayerTotal,
  type KzServer,
} from "@/features/servers/data/servers";

export function ServerLiveSummary({ initialServers }: { initialServers: KzServer[] }) {
  const { data: servers } = useLiveServers(initialServers);
  const onlineTotal = getOnlinePlayerTotal(servers);
  const maxTotal = getMaxPlayerTotal(servers);

  return (
    <dl className="mt-9 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4">
      <Stat label="在线玩家" value={onlineTotal} />
      <Stat label="社区容量" value={maxTotal} />
      <Stat label="服务器 tickrate" value={servers[0]?.tickrate ?? 0} />
      <Stat label="KZ 服务器" value={servers.length} />
    </dl>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs text-white/55">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums" aria-live="polite">
        {value.toLocaleString("zh-CN")}
      </dd>
    </div>
  );
}
