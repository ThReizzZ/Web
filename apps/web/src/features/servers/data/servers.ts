export type ServerStatus = "online" | "maintenance";

export interface OnlinePlayer {
  name: string;
  role: string;
  avatar: string;
  playtime: string;
}

export interface GameServer {
  id: string;
  name: string;
  mode: string;
  description: string;
  status: ServerStatus;
  ip: string;
  port: number;
  version: string;
  region: string;
  map: string;
  mapImage: string;
  playerCount: number;
  maxPlayers: number;
  latencyMs: number;
  tags: string[];
  players: OnlinePlayer[];
  featured?: boolean;
}

export const gameServers: GameServer[] = [
  {
    id: "elysium-valley",
    name: "Elysium Valley",
    mode: "长期生存",
    description:
      "以社区共建为核心的主世界。保留每一段建造与探索的痕迹，季节活动、公共工程和居民区都在这里持续生长。",
    status: "online",
    ip: "play.threi.example",
    port: 25565,
    version: "1.21.4",
    region: "华东",
    map: "Elysium Valley",
    mapImage: "/images/servers/elysium-valley.svg",
    playerCount: 48,
    maxPlayers: 100,
    latencyMs: 18,
    tags: ["长期档", "社区共建", "正版验证"],
    players: [
      {
        name: "星野",
        role: "服主",
        avatar: "from-amber-400 to-orange-500",
        playtime: "在线 3 小时",
      },
      {
        name: "木木",
        role: "建筑师",
        avatar: "from-emerald-400 to-teal-600",
        playtime: "在线 1 小时",
      },
      {
        name: "Kite",
        role: "红石工程师",
        avatar: "from-sky-400 to-blue-600",
        playtime: "在线 2 小时",
      },
      {
        name: "阿岚",
        role: "探险家",
        avatar: "from-violet-400 to-purple-600",
        playtime: "在线 42 分钟",
      },
      { name: "Echo", role: "成员", avatar: "from-rose-400 to-pink-600", playtime: "在线 1 小时" },
      { name: "小满", role: "成员", avatar: "from-cyan-400 to-teal-600", playtime: "在线 18 分钟" },
    ],
    featured: true,
  },
  {
    id: "aether-workshop",
    name: "Aether Workshop",
    mode: "自由创造",
    description:
      "没有生存压力的实验场。大型建筑、机械装置和地图场景在这里被搭建、拆解，再以更好的方式重建。",
    status: "online",
    ip: "build.threi.example",
    port: 25566,
    version: "1.21.4",
    region: "华北",
    map: "Aether Workshop",
    mapImage: "/images/servers/aether-workshop.svg",
    playerCount: 21,
    maxPlayers: 60,
    latencyMs: 26,
    tags: ["创造模式", "建筑", "作品展示"],
    players: [
      {
        name: "澄海",
        role: "创造服主",
        avatar: "from-indigo-400 to-violet-600",
        playtime: "在线 4 小时",
      },
      {
        name: "Yuki",
        role: "场景设计",
        avatar: "from-fuchsia-400 to-pink-600",
        playtime: "在线 2 小时",
      },
      {
        name: "Sol",
        role: "建筑师",
        avatar: "from-yellow-400 to-amber-600",
        playtime: "在线 55 分钟",
      },
      { name: "白露", role: "成员", avatar: "from-teal-400 to-cyan-600", playtime: "在线 1 小时" },
      {
        name: "Rin",
        role: "成员",
        avatar: "from-blue-400 to-indigo-600",
        playtime: "在线 32 分钟",
      },
      {
        name: "Mori",
        role: "成员",
        avatar: "from-lime-400 to-emerald-600",
        playtime: "在线 12 分钟",
      },
    ],
  },
  {
    id: "ember-arena",
    name: "Ember Arena",
    mode: "竞技与活动",
    description:
      "为周末赛事和限时玩法准备的竞技世界。轮换地图、观战席位和赛后回放，让每一场对局都有迹可循。",
    status: "online",
    ip: "pvp.threi.example",
    port: 25567,
    version: "1.21.4",
    region: "华南",
    map: "Ember Arena",
    mapImage: "/images/servers/ember-arena.svg",
    playerCount: 76,
    maxPlayers: 120,
    latencyMs: 32,
    tags: ["赛季活动", "竞技", "观战"],
    players: [
      {
        name: "赤羽",
        role: "赛事主持",
        avatar: "from-red-400 to-orange-600",
        playtime: "在线 2 小时",
      },
      {
        name: "Rift",
        role: "竞技队长",
        avatar: "from-orange-400 to-amber-600",
        playtime: "在线 1 小时",
      },
      {
        name: "北辰",
        role: "成员",
        avatar: "from-slate-400 to-zinc-600",
        playtime: "在线 46 分钟",
      },
      {
        name: "Nox",
        role: "成员",
        avatar: "from-purple-400 to-fuchsia-600",
        playtime: "在线 38 分钟",
      },
      { name: "焰尾", role: "成员", avatar: "from-rose-400 to-red-600", playtime: "在线 21 分钟" },
      { name: "Iris", role: "观战", avatar: "from-pink-400 to-rose-600", playtime: "在线 15 分钟" },
    ],
  },
];

export function getServerAddress(server: GameServer): string {
  return `${server.ip}:${server.port}`;
}

export function getFeaturedServer(): GameServer {
  return gameServers.find((server) => server.featured) ?? gameServers[0]!;
}

export function getOnlinePlayerTotal(): number {
  return gameServers.reduce((total, server) => total + server.playerCount, 0);
}

export function getMaxPlayerTotal(): number {
  return gameServers.reduce((total, server) => total + server.maxPlayers, 0);
}

export function getServerById(id: string): GameServer | undefined {
  return gameServers.find((server) => server.id === id);
}
