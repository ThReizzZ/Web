export type ServerStatus = "online" | "maintenance";

export interface KzPlayer {
  name: string;
  avatar: string;
}

export interface KzServer {
  id: string;
  name: string;
  map: string;
  description: string;
  status: ServerStatus;
  ip: string;
  port: number;
  region: string;
  tickrate: number;
  maxPlayers: number;
  latencyMs: number;
  tags: string[];
  players: KzPlayer[];
  mapImage: string;
  featured?: boolean;
}

const playerNames = [
  "n0va",
  "KZ_Lin",
  "bhopzilla",
  "LongJumpLarry",
  "Aero",
  "Miyu",
  "Ritz",
  "flick",
  "Pulse",
  "Kryo",
  "w1nter",
  "Zephyr",
  "p0lar",
  "Aim9",
  "RushB",
  "NadeKing",
  "Spray",
  "Taco",
  "KZ_Toast",
  "ClimbCat",
  "Skyline",
  "Echo",
  "Vanta",
  "Nox",
  "Mist",
  "Riven",
  "Kaze",
  "Lynx",
  "Sable",
  "jumpcraft",
  "KZ_Mochi",
  "strafe",
  "c0re",
  "BhopGod",
  "luminous",
  "Vex",
  "Kira",
  "zero",
  "Mako",
  "Nyx",
];

const avatarPalettes = [
  "from-sky-400 to-blue-600",
  "from-emerald-400 to-teal-600",
  "from-amber-400 to-orange-600",
  "from-rose-400 to-pink-600",
  "from-violet-400 to-purple-600",
  "from-cyan-400 to-blue-500",
  "from-lime-400 to-green-600",
  "from-fuchsia-400 to-pink-600",
  "from-indigo-400 to-blue-700",
  "from-red-400 to-rose-600",
  "from-teal-400 to-emerald-600",
  "from-orange-400 to-amber-600",
  "from-blue-400 to-indigo-600",
  "from-green-400 to-lime-600",
  "from-purple-400 to-fuchsia-600",
  "from-pink-400 to-rose-600",
  "from-slate-400 to-zinc-600",
  "from-yellow-400 to-amber-600",
  "from-cyan-400 to-teal-600",
  "from-blue-400 to-sky-600",
];

const playerPool: KzPlayer[] = playerNames.map((name, index) => ({
  name,
  avatar: avatarPalettes[index % avatarPalettes.length]!,
}));

function roster(offset: number, count: number): KzPlayer[] {
  return Array.from(
    { length: count },
    (_, index) => playerPool[(offset + index) % playerPool.length]!,
  );
}

export const gameServers: KzServer[] = [
  {
    id: "kz-beginner",
    name: "KZ | Beginner",
    map: "kz_beginner",
    description: "为第一次接触 KZ 的玩家准备的基础跳跃路线，包含预加速、连跳和简单长跳教学点。",
    status: "online",
    ip: "kz01.threi.example",
    port: 27015,
    region: "华东",
    tickrate: 128,
    maxPlayers: 32,
    latencyMs: 12,
    tags: ["新手", "教学", "计时"],
    players: roster(0, 9),
    mapImage: "/images/servers/kz-beginner.svg",
    featured: true,
  },
  {
    id: "kz-bhop-city",
    name: "KZ | Bhop Marathon",
    map: "kz_bhop_city",
    description: "连续连跳与城市高架路线，适合练习节奏控制和高速转向。",
    status: "online",
    ip: "kz02.threi.example",
    port: 27016,
    region: "华东",
    tickrate: 128,
    maxPlayers: 32,
    latencyMs: 18,
    tags: ["Bhop", "连跳", "排行"],
    players: roster(9, 18),
    mapImage: "/images/servers/kz-bhop-city.svg",
    featured: true,
  },
  {
    id: "kz-longjump-lab",
    name: "KZ | Longjump Lab",
    map: "kz_longjump_lab",
    description: "从 220 到 280 单位的多段长跳训练场，带实时距离与落点反馈。",
    status: "online",
    ip: "kz03.threi.example",
    port: 27017,
    region: "华北",
    tickrate: 128,
    maxPlayers: 32,
    latencyMs: 24,
    tags: ["长跳", "训练", "排行"],
    players: roster(4, 12),
    mapImage: "/images/servers/kz-longjump-lab.svg",
    featured: true,
  },
  {
    id: "kz-hardcore",
    name: "KZ | Hardcore",
    map: "kz_hardcore",
    description: "高难度连续跳跃与精准落点，面向熟悉 KZ 机制的进阶玩家。",
    status: "online",
    ip: "kz04.threi.example",
    port: 27018,
    region: "华北",
    tickrate: 128,
    maxPlayers: 32,
    latencyMs: 28,
    tags: ["Hardcore", "进阶", "计时"],
    players: roster(12, 28),
    mapImage: "/images/servers/kz-hardcore.svg",
  },
  {
    id: "kz-climb-alpha",
    name: "KZ | Climb Alpha",
    map: "kz_climb_alpha",
    description: "垂直攀爬与多层平台路线，适合喜欢稳定节奏和路线规划的玩家。",
    status: "online",
    ip: "kz05.threi.example",
    port: 27019,
    region: "华南",
    tickrate: 128,
    maxPlayers: 32,
    latencyMs: 31,
    tags: ["攀爬", "路线", "计时"],
    players: roster(21, 14),
    mapImage: "/images/servers/kz-climb-alpha.svg",
  },
  {
    id: "kz-skyline",
    name: "KZ | Skyline",
    map: "kz_skyline",
    description: "城市天际线主题的公开计时图，路线清晰，适合刷个人最佳。",
    status: "online",
    ip: "kz06.threi.example",
    port: 27020,
    region: "华南",
    tickrate: 128,
    maxPlayers: 32,
    latencyMs: 35,
    tags: ["计时", "公开图", "排行"],
    players: roster(7, 21),
    mapImage: "/images/servers/kz-skyline.svg",
  },
  {
    id: "kz-neon",
    name: "KZ | Neon Rush",
    map: "kz_neon",
    description: "霓虹夜景与高速短跳组合，节奏偏快，适合热身和快速刷图。",
    status: "online",
    ip: "kz07.threi.example",
    port: 27021,
    region: "华东",
    tickrate: 128,
    maxPlayers: 32,
    latencyMs: 15,
    tags: ["高速", "短跳", "热身"],
    players: roster(17, 16),
    mapImage: "/images/servers/kz-neon.svg",
  },
  {
    id: "kz-frost",
    name: "KZ | Frostbite",
    map: "kz_frost",
    description: "冰面材质与低摩擦落点，需要更细腻的空中转向和落地控制。",
    status: "online",
    ip: "kz08.threi.example",
    port: 27022,
    region: "华北",
    tickrate: 128,
    maxPlayers: 32,
    latencyMs: 22,
    tags: ["冰面", "控制", "进阶"],
    players: roster(33, 7),
    mapImage: "/images/servers/kz-frost.svg",
  },
  {
    id: "kz-dune",
    name: "KZ | Dune",
    map: "kz_dune",
    description: "沙漠遗迹中的中长距离跳跃路线，包含少量隐藏捷径。",
    status: "online",
    ip: "kz09.threi.example",
    port: 27023,
    region: "西南",
    tickrate: 128,
    maxPlayers: 32,
    latencyMs: 42,
    tags: ["中距离", "探索", "捷径"],
    players: roster(25, 11),
    mapImage: "/images/servers/kz-dune.svg",
  },
  {
    id: "kz-void",
    name: "KZ | Void",
    map: "kz_void",
    description: "虚空平台与精准落点挑战，失败会直接回到检查点，适合专注练习。",
    status: "online",
    ip: "kz10.threi.example",
    port: 27024,
    region: "西南",
    tickrate: 128,
    maxPlayers: 32,
    latencyMs: 46,
    tags: ["虚空", "精准", "Hardcore"],
    players: roster(14, 24),
    mapImage: "/images/servers/kz-void.svg",
  },
  {
    id: "kz-marble",
    name: "KZ | Marble",
    map: "kz_marble",
    description: "明亮的大理石庭院与短路线循环，适合放松和熟悉基础连跳。",
    status: "online",
    ip: "kz11.threi.example",
    port: 27025,
    region: "华东",
    tickrate: 128,
    maxPlayers: 32,
    latencyMs: 14,
    tags: ["休闲", "基础", "短图"],
    players: roster(36, 5),
    mapImage: "/images/servers/kz-marble.svg",
  },
  {
    id: "kz-aztec",
    name: "KZ | Aztec",
    map: "kz_aztec",
    description: "丛林遗迹主题的经典路线，包含连续长跳和狭窄平台段。",
    status: "online",
    ip: "kz12.threi.example",
    port: 27026,
    region: "华南",
    tickrate: 128,
    maxPlayers: 32,
    latencyMs: 33,
    tags: ["经典", "长跳", "遗迹"],
    players: roster(2, 19),
    mapImage: "/images/servers/kz-aztec.svg",
  },
];

export function getServerAddress(server: KzServer): string {
  return `${server.ip}:${server.port}`;
}

export function getFeaturedServer(): KzServer {
  return gameServers.find((server) => server.featured) ?? gameServers[0]!;
}

export function getFeaturedServers(): KzServer[] {
  const featured = gameServers.filter((server) => server.featured);
  return featured.length > 0 ? featured.slice(0, 3) : gameServers.slice(0, 3);
}

export function getOnlinePlayerTotal(): number {
  return gameServers.reduce((total, server) => total + server.players.length, 0);
}

export function getMaxPlayerTotal(): number {
  return gameServers.reduce((total, server) => total + server.maxPlayers, 0);
}

export function getServerById(id: string): KzServer | undefined {
  return gameServers.find((server) => server.id === id);
}

export function searchServers(query: string): KzServer[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return gameServers;
  }

  return gameServers.filter((server) =>
    [
      server.name,
      server.map,
      server.region,
      server.description,
      ...server.tags,
      ...server.players.map((player) => player.name),
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalized),
  );
}
