"use client";

import { useLiveServers } from "@/features/servers/data/live-servers";
import {
  getMaxPlayerTotal,
  getOnlinePlayerTotal,
  type KzServer,
} from "@/features/servers/data/servers";

export function HomeLiveServerStat({ initialServers }: { initialServers: KzServer[] }) {
  const { data: servers } = useLiveServers(initialServers);
  const onlineTotal = getOnlinePlayerTotal(servers);
  const maxTotal = getMaxPlayerTotal(servers);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur">
      <dt className="flex items-center gap-1.5 text-[11px] text-white/55">
        <span className="size-1.5 rounded-full bg-emerald-300" aria-hidden="true" />
        在线玩家
      </dt>
      <dd className="mt-1 text-2xl font-semibold text-white tabular-nums" aria-live="polite">
        {onlineTotal.toLocaleString("zh-CN")}
        <span className="text-xs font-normal text-white/45">
          {" "}
          / {maxTotal.toLocaleString("zh-CN")}
        </span>
      </dd>
    </div>
  );
}
