export type CategoryIcon = "megaphone" | "messages" | "trees" | "hammer" | "life-buoy";

export interface ForumUser {
  name: string;
  role: string;
  avatar: string;
}

export interface ForumCategory {
  slug: string;
  name: string;
  description: string;
  icon: CategoryIcon;
  topicCount: number;
  postCount: number;
  lastActivity: string;
}

export interface ForumReply {
  id: string;
  author: ForumUser;
  createdAt: string;
  content: string;
  likes: number;
}

export interface ForumTopic {
  id: string;
  title: string;
  excerpt: string;
  categorySlug: string;
  author: ForumUser;
  tags: string[];
  createdAt: string;
  lastActivity: string;
  views: number;
  pinned?: boolean;
  hot?: boolean;
  content: string[];
  replies: ForumReply[];
}

const users = {
  hoshino: { name: "星野", role: "社区管理员", avatar: "from-amber-400 to-orange-500" },
  muxi: { name: "木木", role: "建筑师", avatar: "from-emerald-400 to-teal-600" },
  kite: { name: "Kite", role: "红石工程师", avatar: "from-sky-400 to-blue-600" },
  aran: { name: "阿岚", role: "探险家", avatar: "from-violet-400 to-purple-600" },
  echo: { name: "Echo", role: "成员", avatar: "from-rose-400 to-pink-600" },
  xiaoman: { name: "小满", role: "成员", avatar: "from-cyan-400 to-teal-600" },
  chenghai: { name: "澄海", role: "创造服主", avatar: "from-indigo-400 to-violet-600" },
  yuki: { name: "Yuki", role: "场景设计", avatar: "from-fuchsia-400 to-pink-600" },
  chiya: { name: "赤羽", role: "赛事主持", avatar: "from-red-400 to-orange-600" },
  bailu: { name: "白露", role: "成员", avatar: "from-teal-400 to-cyan-600" },
  beichen: { name: "北辰", role: "成员", avatar: "from-slate-400 to-zinc-600" },
} as const;

export const forumCategories: ForumCategory[] = [
  {
    slug: "announcements",
    name: "公告与活动",
    description: "服务器维护、赛季更新、社区活动和重要通知。",
    icon: "megaphone",
    topicCount: 12,
    postCount: 86,
    lastActivity: "12 分钟前",
  },
  {
    slug: "general",
    name: "综合讨论",
    description: "闲聊、玩法交流、整合包推荐，以及和社区有关的一切。",
    icon: "messages",
    topicCount: 328,
    postCount: 2140,
    lastActivity: "5 分钟前",
  },
  {
    slug: "survival",
    name: "生存世界",
    description: "Elysium Valley 的建造记录、聚落故事和生存心得。",
    icon: "trees",
    topicCount: 186,
    postCount: 1320,
    lastActivity: "28 分钟前",
  },
  {
    slug: "creative",
    name: "创造工坊",
    description: "建筑作品、红石机械、地图场景和创作过程分享。",
    icon: "hammer",
    topicCount: 94,
    postCount: 640,
    lastActivity: "1 小时前",
  },
  {
    slug: "support",
    name: "帮助与反馈",
    description: "遇到连接、账号或玩法问题时，从这里开始排查。",
    icon: "life-buoy",
    topicCount: 76,
    postCount: 412,
    lastActivity: "2 小时前",
  },
];

export const forumTopics: ForumTopic[] = [
  {
    id: "season-three-islands",
    title: "第三赛季「群岛纪元」今晚 20:00 开启",
    excerpt: "新的主世界、新的岛屿群系和一条全新的公共航线。开服前请更新客户端并阅读本次赛季规则。",
    categorySlug: "announcements",
    author: users.hoshino,
    tags: ["公告", "赛季", "开服"],
    createdAt: "2026年10月23日 09:00",
    lastActivity: "12 分钟前",
    views: 1280,
    pinned: true,
    hot: true,
    content: [
      "第三赛季「群岛纪元」将在今晚 20:00 正式开放。本次更新会保留上一赛季的社区大厅、称号与贡献记录，主世界将整体切换到新的群岛地图。",
      "新赛季的核心变化是「公共航线」：出生岛、资源岛和玩家聚落之间会由可修复的航线连接。修复航线需要社区共同投入材料，完成后所有居民都可以使用更稳定的跨岛交通。",
      "开服前请将客户端更新至 1.21.4，并确认已经绑定社区账号。旧主世界的物品不会自动继承，但纪念物品可以在大厅的赛季仓库中领取。",
      "如果你计划在新赛季建立聚落，建议先在论坛发布招募帖，说明聚落位置、风格和预计在线时间。管理组会优先为有明确规划的聚落提供传送点。",
    ],
    replies: [
      {
        id: "r-season-1",
        author: users.muxi,
        createdAt: "今天 09:18",
        content: "潮汐湾会在新赛季继续开工，这次想把港口和公共仓库放在一起，欢迎建筑师来一起做。",
        likes: 24,
      },
      {
        id: "r-season-2",
        author: users.aran,
        createdAt: "今天 09:26",
        content: "公共航线听起来很有意思，资源岛的刷新规则会在开服后公布吗？",
        likes: 12,
      },
      {
        id: "r-season-3",
        author: users.hoshino,
        createdAt: "今天 09:31",
        content: "会的，开服后会在公告区补充资源岛刷新和航线维护的详细说明。",
        likes: 18,
      },
      {
        id: "r-season-4",
        author: users.kite,
        createdAt: "今天 10:02",
        content: "已经准备好红石信号站了，这次争取把跨岛交通做成全自动的。",
        likes: 31,
      },
      {
        id: "r-season-5",
        author: users.xiaoman,
        createdAt: "今天 10:24",
        content: "请问新赛季还招新吗？想带两个朋友一起玩。",
        likes: 9,
      },
    ],
  },
  {
    id: "welcome-to-threi",
    title: "欢迎来到 ThRei 社区：新手指南与服务器规则",
    excerpt: "第一次来到 ThRei？从绑定账号、选择服务器到加入社区聚落，看这一篇就够了。",
    categorySlug: "announcements",
    author: users.hoshino,
    tags: ["公告", "新手指南"],
    createdAt: "2026年10月20日 18:30",
    lastActivity: "1 小时前",
    views: 986,
    pinned: true,
    content: [
      "ThRei 是一个以长期生存、共同建造和友好交流为核心的社区。我们欢迎新玩家，也希望每位成员在进入服务器前了解最基本的社区规则。",
      "第一步：在用户中心绑定游戏账号。第二步：在服务器页面选择想去的世界并复制地址。第三步：进入服务器后阅读出生岛的告示牌，选择你的第一块落脚点。",
      "我们禁止破坏他人建筑、偷取公共物资、恶意 PVP 和任何形式的骚扰。遇到问题请在帮助与反馈区发帖，或直接在游戏内联系在线管理员。",
    ],
    replies: [
      {
        id: "r-welcome-1",
        author: users.echo,
        createdAt: "昨天 20:14",
        content: "刚绑定好账号，今晚准备去 Elysium Valley 看看。",
        likes: 8,
      },
      {
        id: "r-welcome-2",
        author: users.bailu,
        createdAt: "昨天 21:02",
        content: "出生岛的地图很实用，建议新玩家先沿着河边走一圈。",
        likes: 15,
      },
      {
        id: "r-welcome-3",
        author: users.hoshino,
        createdAt: "今天 08:42",
        content: "补充一下：如果找不到聚落，可以在论坛发一条自我介绍，通常会有人带你。",
        likes: 11,
      },
      {
        id: "r-welcome-4",
        author: users.chenghai,
        createdAt: "今天 10:16",
        content: "创造服也欢迎新朋友，想练习建筑的话可以先来 Aether Workshop。",
        likes: 10,
      },
    ],
  },
  {
    id: "survival-base-tour",
    title: "分享｜海边小镇「潮汐湾」建设进度",
    excerpt: "从一间木屋到现在的十二人聚落，记录潮汐湾这三个月的变化，也欢迎新邻居加入。",
    categorySlug: "survival",
    author: users.muxi,
    tags: ["建筑", "生存", "聚落"],
    createdAt: "2026年10月22日 21:14",
    lastActivity: "28 分钟前",
    views: 742,
    hot: true,
    content: [
      "潮汐湾最初只是海边的一间木屋。三个月后，我们有了公共仓库、码头、灯塔和一条连接矿区的石桥。",
      "现在聚落常住成员有十二人，大家在线时间不太一样，但公共仓库和农田一直有人维护。新赛季开始后，我们计划把码头扩建到公共航线附近。",
      "如果你喜欢海边、慢节奏建造和一起做公共工程，潮汐湾还有三块临海空地。可以在帖子里留言，或者直接在游戏里到坐标 1840, 72, -620 附近看看。",
      "最后放几张最近的截图。建筑细节还有很多没完成，欢迎提出建议。",
    ],
    replies: [
      {
        id: "r-base-1",
        author: users.yuki,
        createdAt: "昨天 22:03",
        content: "码头的木材配色很好看，灯塔晚上的灯光效果也很有氛围。",
        likes: 19,
      },
      {
        id: "r-base-2",
        author: users.kite,
        createdAt: "今天 00:18",
        content: "如果需要自动农场，我可以帮你们做一套隐藏在地下的。",
        likes: 14,
      },
      {
        id: "r-base-3",
        author: users.xiaoman,
        createdAt: "今天 08:20",
        content: "想加入！我比较喜欢 interiors，临海空地还有吗？",
        likes: 6,
      },
      {
        id: "r-base-4",
        author: users.muxi,
        createdAt: "今天 09:05",
        content: "还有两块，今晚我在线，可以带你去看位置。",
        likes: 9,
      },
      {
        id: "r-base-5",
        author: users.aran,
        createdAt: "今天 11:46",
        content: "从矿区回来经过潮汐湾，石桥的视角非常好。",
        likes: 7,
      },
    ],
  },
  {
    id: "redstone-farm-v2",
    title: "一套可扩展的全自动农场方案（1.21.4）",
    excerpt: "模块化设计、可堆叠单元和低延迟收集系统，适合生存服公共农场使用。",
    categorySlug: "creative",
    author: users.kite,
    tags: ["红石", "教程", "农场"],
    createdAt: "2026年10月21日 16:40",
    lastActivity: "1 小时前",
    views: 534,
    content: [
      "这套农场的目标不是追求单次产量，而是让聚落可以按需增加单元，同时保持收集系统不被实体卡顿影响。",
      "核心结构分为种植单元、收割单元和收集单元。每个种植单元可以独立关闭，维护时不需要拆掉整条线路。",
      "目前版本在 1.21.4 生存服测试了三天，满载时的 TPS 影响在可接受范围内。我还在整理材料清单和建造步骤，完成后会更新到创造服展示区。",
    ],
    replies: [
      {
        id: "r-redstone-1",
        author: users.echo,
        createdAt: "昨天 18:12",
        content: "期待材料清单，公共农场正好需要这个。",
        likes: 10,
      },
      {
        id: "r-redstone-2",
        author: users.chenghai,
        createdAt: "昨天 19:40",
        content: "可以先在 Aether Workshop 做个展示版吗？我想看看收集单元的走线。",
        likes: 8,
      },
      {
        id: "r-redstone-3",
        author: users.kite,
        createdAt: "今天 08:55",
        content: "可以，今晚会搭一个缩小版，坐标到时候发在帖子里。",
        likes: 12,
      },
      {
        id: "r-redstone-4",
        author: users.bailu,
        createdAt: "今天 10:30",
        content: "如果公开材料清单，我可以在生存服帮忙收集一批。",
        likes: 5,
      },
    ],
  },
  {
    id: "weekend-lag-report",
    title: "周末高峰期的延迟问题反馈与排查记录",
    excerpt: "上周六晚高峰出现周期性卡顿，记录了发生时间、表现和初步排查结果。",
    categorySlug: "support",
    author: users.aran,
    tags: ["问题反馈", "网络"],
    createdAt: "2026年10月20日 22:08",
    lastActivity: "2 小时前",
    views: 312,
    content: [
      "上周六 21:00 到 22:30 之间，主世界出现周期性的方块更新延迟，聊天和移动基本正常，但打开箱子和传送会有明显卡顿。",
      "我记录了几个时间点，并对比了服务器页面显示的延迟。问题似乎与在线人数超过 90 人后的区块加载有关。",
      "已经把所有记录整理给管理组。发这个帖子是想确认其他玩家是否也遇到类似情况，以及发生在哪些区域。",
    ],
    replies: [
      {
        id: "r-lag-1",
        author: users.beichen,
        createdAt: "昨天 09:12",
        content: "我在公共矿洞附近也遇到了，主要集中在 21:20 左右。",
        likes: 4,
      },
      {
        id: "r-lag-2",
        author: users.hoshino,
        createdAt: "昨天 10:05",
        content: "感谢记录。我们已经调整了区块预加载和部分实体上限，这周末会继续观察。",
        likes: 13,
      },
      {
        id: "r-lag-3",
        author: users.kite,
        createdAt: "昨天 11:20",
        content: "公共农场的实体数量可能也有影响，我会把收集单元关掉一组做对比。",
        likes: 7,
      },
      {
        id: "r-lag-4",
        author: users.aran,
        createdAt: "今天 09:38",
        content: "更新：昨晚同一时段没有再出现明显卡顿，继续观察。",
        likes: 9,
      },
    ],
  },
  {
    id: "modpack-recommend",
    title: "大家最近在玩什么整合包？来交换一下清单",
    excerpt: "想找一些适合两三个人慢慢玩的整合包，最好是任务线清晰、建筑和探索都有内容的。",
    categorySlug: "general",
    author: users.echo,
    tags: ["讨论", "整合包"],
    createdAt: "2026年10月19日 20:26",
    lastActivity: "3 小时前",
    views: 468,
    content: [
      "最近想和朋友开一个小型整合包存档，人数不多，希望节奏不要太肝，任务线能带着我们慢慢探索。",
      "我们比较喜欢有建筑、有探索、有少量自动化的包。纯科技向也可以，但不太想一上来就面对几百个配方。",
      "如果你们最近玩到不错的包，欢迎留下名字和一句推荐理由。最好说明大概需要多少内存，以及单人/多人体验差别。",
    ],
    replies: [
      {
        id: "r-modpack-1",
        author: users.chenghai,
        createdAt: "昨天 12:40",
        content:
          "最近在玩一个偏建筑和轻任务的包，内存 6G 左右就够，适合三个人慢慢玩。晚点把名字发上来。",
        likes: 6,
      },
      {
        id: "r-modpack-2",
        author: users.aran,
        createdAt: "昨天 15:12",
        content: "如果想要探索感强一点，可以试试带大型地牢和遗迹的包，不过多人时要注意实体优化。",
        likes: 5,
      },
      {
        id: "r-modpack-3",
        author: users.echo,
        createdAt: "昨天 16:02",
        content: "收到，看来可以分成建筑向和探索向两个候选。",
        likes: 3,
      },
      {
        id: "r-modpack-4",
        author: users.yuki,
        createdAt: "今天 09:15",
        content: "建筑向的话我有一套自用清单，主要是装饰和地形模组。",
        likes: 8,
      },
      {
        id: "r-modpack-5",
        author: users.bailu,
        createdAt: "今天 11:22",
        content: "期待清单，最好也能在创造服里试用一下。",
        likes: 4,
      },
    ],
  },
  {
    id: "autumn-build-event",
    title: "十月建筑大赛：主题「风与遗迹」报名开启",
    excerpt: "单人或三人组队，在创造服划定区域内完成一座与风、遗迹有关的建筑作品。",
    categorySlug: "announcements",
    author: users.hoshino,
    tags: ["活动", "建筑"],
    createdAt: "2026年10月18日 12:00",
    lastActivity: "5 小时前",
    views: 620,
    content: [
      "十月建筑大赛的主题是「风与遗迹」。参赛者需要在创造服的指定区域内，用建筑表达风与时间留下的痕迹。",
      "可以单人参加，也可以三人组队。作品不限制风格，但需要使用比赛提供的区域和统一材质包，方便评审与展示。",
      "报名截止到 10 月 26 日，作品提交截止到 11 月 2 日。评审会从主题表达、结构、细节和整体氛围四个方面评分。",
    ],
    replies: [
      {
        id: "r-event-1",
        author: users.yuki,
        createdAt: "昨天 14:20",
        content: "想问一下区域大小是固定的吗？想做一个跨度比较大的装置。",
        likes: 7,
      },
      {
        id: "r-event-2",
        author: users.hoshino,
        createdAt: "昨天 15:05",
        content: "基础区域是固定的，如果作品需要更大跨度，可以在报名时申请扩展。",
        likes: 6,
      },
      {
        id: "r-event-3",
        author: users.muxi,
        createdAt: "今天 10:12",
        content: "潮汐湾准备组队参加，主题已经想好了。",
        likes: 11,
      },
    ],
  },
  {
    id: "new-player-bind",
    title: "从零开始：如何加入服务器并绑定社区账号",
    excerpt: "整理了新玩家最常问的连接步骤、客户端版本和账号绑定问题。",
    categorySlug: "support",
    author: users.xiaoman,
    tags: ["新手指南", "账号"],
    createdAt: "2026年10月17日 19:10",
    lastActivity: "8 小时前",
    views: 890,
    content: [
      "最近新朋友比较多，我把大家常问的问题整理成一份短指南，希望能减少重复提问。",
      "连接服务器前，请确认客户端是 Java 版 1.21.4。进入服务器页面后复制 IP:PORT，在多人游戏里添加服务器即可。",
      "社区账号和游戏账号是两套独立体系，但目前可以在用户中心进行绑定。绑定后，论坛称号和游戏内身份会显示为同一个名字。",
      "如果连接时提示版本不匹配，先检查是否误用了基岩版或旧版客户端。如果仍然无法连接，请附上错误截图和大致时间。",
    ],
    replies: [
      {
        id: "r-bind-1",
        author: users.echo,
        createdAt: "昨天 08:40",
        content: "很有用，建议把客户端版本号再放到服务器页面显眼一点。",
        likes: 5,
      },
      {
        id: "r-bind-2",
        author: users.hoshino,
        createdAt: "昨天 09:10",
        content: "已经反馈给页面维护，会在服务器卡片里展示版本信息。",
        likes: 6,
      },
      {
        id: "r-bind-3",
        author: users.beichen,
        createdAt: "今天 07:25",
        content: "绑定后多久同步称号？我昨晚绑定的，现在论坛还是旧名字。",
        likes: 2,
      },
      {
        id: "r-bind-4",
        author: users.xiaoman,
        createdAt: "今天 08:02",
        content: "一般重新登录后就会同步，如果超过一小时还没变化可以在这里回复。",
        likes: 4,
      },
    ],
  },
];

export function getCategory(slug: string): ForumCategory | undefined {
  return forumCategories.find((category) => category.slug === slug);
}

export function getTopic(id: string): ForumTopic | undefined {
  return forumTopics.find((topic) => topic.id === id);
}

export function getCategoryTopics(slug: string): ForumTopic[] {
  return forumTopics
    .filter((topic) => topic.categorySlug === slug)
    .sort((a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false));
}

export function getLatestTopics(limit = 5): ForumTopic[] {
  return forumTopics.slice(0, limit);
}

export function getAnnouncements(limit = 3): ForumTopic[] {
  return forumTopics.filter((topic) => topic.categorySlug === "announcements").slice(0, limit);
}

export function getRelatedTopics(topic: ForumTopic, limit = 3): ForumTopic[] {
  return forumTopics
    .filter((item) => item.id !== topic.id && item.categorySlug === topic.categorySlug)
    .slice(0, limit);
}

export function searchForumTopics(query: string): ForumTopic[] {
  const normalized = query.trim().toLocaleLowerCase();

  if (!normalized) {
    return forumTopics;
  }

  return forumTopics.filter((topic) => {
    const category = getCategory(topic.categorySlug);
    const searchable = [
      topic.title,
      topic.excerpt,
      topic.author.name,
      ...topic.tags,
      category?.name ?? "",
    ]
      .join(" ")
      .toLocaleLowerCase();

    return searchable.includes(normalized);
  });
}
