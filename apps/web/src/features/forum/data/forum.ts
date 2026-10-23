export type CategoryIcon = "megaphone" | "messages" | "map" | "graduation" | "life-buoy";

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
  muxi: { name: "木木", role: "KZ 地图作者", avatar: "from-emerald-400 to-teal-600" },
  kite: { name: "Kite", role: "计时器维护", avatar: "from-sky-400 to-blue-600" },
  aran: { name: "阿岚", role: "KZ 玩家", avatar: "from-violet-400 to-purple-600" },
  echo: { name: "Echo", role: "成员", avatar: "from-rose-400 to-pink-600" },
  xiaoman: { name: "小满", role: "新手引导", avatar: "from-cyan-400 to-teal-600" },
  chenghai: { name: "澄海", role: "服务器管理员", avatar: "from-indigo-400 to-violet-600" },
  yuki: { name: "Yuki", role: "地图作者", avatar: "from-fuchsia-400 to-pink-600" },
  chiya: { name: "赤羽", role: "赛事主持", avatar: "from-red-400 to-orange-600" },
  bailu: { name: "白露", role: "成员", avatar: "from-teal-400 to-cyan-600" },
  beichen: { name: "北辰", role: "成员", avatar: "from-slate-400 to-zinc-600" },
} as const;

export const forumCategories: ForumCategory[] = [
  {
    slug: "announcements",
    name: "公告与活动",
    description: "服务器维护、赛季更新、计时赛和社区活动。",
    icon: "megaphone",
    topicCount: 12,
    postCount: 86,
    lastActivity: "12 分钟前",
  },
  {
    slug: "general",
    name: "综合讨论",
    description: "KZ 闲聊、地图推荐、计时器问题和社区日常。",
    icon: "messages",
    topicCount: 328,
    postCount: 2140,
    lastActivity: "5 分钟前",
  },
  {
    slug: "maps",
    name: "地图与记录",
    description: "KZ 地图推荐、个人最佳、路线拆解和排行榜讨论。",
    icon: "map",
    topicCount: 186,
    postCount: 1320,
    lastActivity: "28 分钟前",
  },
  {
    slug: "guides",
    name: "技巧与教学",
    description: "预加速、连跳、长跳、空中转向和新手练习方法。",
    icon: "graduation",
    topicCount: 94,
    postCount: 640,
    lastActivity: "1 小时前",
  },
  {
    slug: "support",
    name: "帮助与反馈",
    description: "连接、延迟、Steam 绑定、计时器和服务器问题。",
    icon: "life-buoy",
    topicCount: 76,
    postCount: 412,
    lastActivity: "2 小时前",
  },
];

export const forumTopics: ForumTopic[] = [
  {
    id: "season-three-rush",
    title: "第三赛季「极速阶梯」今晚 20:00 开启",
    excerpt: "新赛季计时榜、12 张轮换地图和一条全新的新手路线。开服前请更新 CS:GO 并阅读赛季规则。",
    categorySlug: "announcements",
    author: users.hoshino,
    tags: ["公告", "赛季", "KZ"],
    createdAt: "2026年10月23日 09:00",
    lastActivity: "12 分钟前",
    views: 1280,
    pinned: true,
    hot: true,
    content: [
      "第三赛季「极速阶梯」将在今晚 20:00 正式开启。本次更新会保留社区账号、Steam 绑定和服务器收藏，赛季计时榜将重新开始，历史最佳记录仍会保留在个人资料中。",
      "新赛季开放 12 个 KZ 服务器，覆盖新手教学、连跳、长跳和硬核攀爬。kz_beginner 增加了一条更平缓的新手路线，kz_skyline 和 kz_hardcore 也更新了计时点与检查点。",
      "进入方式没有变化：在服务器页面复制 IP:PORT，打开 CS:GO 开发者控制台输入 connect 地址，或者在服务器卡片中点击“加入游戏”。如果还没有绑定 Steam，请先在用户中心完成绑定。",
      "请遵守社区规则：不恶意阻挡、不利用地图漏洞刷记录、不在公共服务器使用影响公平性的脚本。遇到问题可以在帮助与反馈区发帖。",
    ],
    replies: [
      {
        id: "r-season-1",
        author: users.muxi,
        createdAt: "今天 09:18",
        content: "kz_beginner 的新手路线已经测试过了，前两个检查点会比旧版更友好，欢迎新玩家来试。",
        likes: 24,
      },
      {
        id: "r-season-2",
        author: users.aran,
        createdAt: "今天 09:26",
        content: "计时榜是按服务器分开还是所有服务器共用一个总榜？",
        likes: 12,
      },
      {
        id: "r-season-3",
        author: users.kite,
        createdAt: "今天 09:31",
        content: "两套都有。服务器内榜按地图和服务器记录，个人资料里会展示合并后的赛季最佳。",
        likes: 18,
      },
      {
        id: "r-season-4",
        author: users.xiaoman,
        createdAt: "今天 10:02",
        content: "新手路线太需要了，之前一直不敢进 kz_beginner 以外的图。",
        likes: 9,
      },
      {
        id: "r-season-5",
        author: users.hoshino,
        createdAt: "今天 10:24",
        content: "今晚开服后会在公告区补充计时赛报名和地图轮换表。",
        likes: 14,
      },
    ],
  },
  {
    id: "welcome-to-threi",
    title: "欢迎来到 ThRei KZ 社区：新手指南与服务器规则",
    excerpt: "第一次接触 KZ？从绑定 Steam、连接服务器到预加速和长跳，看这一篇就够了。",
    categorySlug: "announcements",
    author: users.hoshino,
    tags: ["公告", "新手指南", "Steam"],
    createdAt: "2026年10月20日 18:30",
    lastActivity: "1 小时前",
    views: 986,
    pinned: true,
    content: [
      "ThRei 是一个以 CS:GO KZ 攀爬与跳跃玩法为核心的社区。我们欢迎第一次接触 KZ 的玩家，也希望每位成员在进入服务器前了解最基本的规则。",
      "第一步：在用户中心绑定 Steam。第二步：在服务器页面选择想去的 KZ 服务器并复制地址。第三步：启动 CS:GO，在开发者控制台输入 connect IP:PORT。",
      "新手建议从 kz_beginner 或 kz_marble 开始，先熟悉预加速、落地缓冲和检查点。不要在公共服务器使用自动连跳或影响公平性的脚本；遇到问题可以在帮助与反馈区发帖。",
    ],
    replies: [
      {
        id: "r-welcome-1",
        author: users.echo,
        createdAt: "昨天 20:14",
        content: "刚绑定 Steam，今晚准备去 kz_beginner 试试。控制台需要自己在设置里开启吗？",
        likes: 8,
      },
      {
        id: "r-welcome-2",
        author: users.xiaoman,
        createdAt: "昨天 21:02",
        content: "需要在游戏设置里启用开发者控制台，默认按键是 ~。",
        likes: 15,
      },
      {
        id: "r-welcome-3",
        author: users.hoshino,
        createdAt: "今天 08:42",
        content: "补充一下：如果找不到服务器，可以在论坛发一条自我介绍，通常会有人带你。",
        likes: 11,
      },
      {
        id: "r-welcome-4",
        author: users.beichen,
        createdAt: "今天 10:16",
        content: "建议新手先把 sens 和跳键固定下来，不要频繁改设置。",
        likes: 10,
      },
    ],
  },
  {
    id: "kz-beginner-record",
    title: "记录｜kz_beginner 新个人最佳 00:42.31",
    excerpt: "练了两周终于把 beginner 打进 43 秒，分享几个容易失误的落点和检查点节奏。",
    categorySlug: "maps",
    author: users.muxi,
    tags: ["记录", "kz_beginner", "新手"],
    createdAt: "2026年10月22日 21:14",
    lastActivity: "28 分钟前",
    views: 742,
    hot: true,
    content: [
      "kz_beginner 看起来简单，但后半段连续短跳很容易在落地时丢掉速度。这次跑出 00:42.31，主要是把第二个检查点之后的两次起跳节奏固定下来了。",
      "我的建议是先把前三个检查点分别练熟，再尝试整图。不要在状态不好时反复整图重开，先把容易失误的落点拆出来练十几次。",
      "另外，落地后不要立刻按方向键，先用一次短跳把速度接起来。对新手来说，稳定的节奏比追求极限起跳更重要。",
    ],
    replies: [
      {
        id: "r-record-1",
        author: users.xiaoman,
        createdAt: "昨天 22:03",
        content: "恭喜！我卡在 48 秒左右，最后一段总是撞墙。",
        likes: 6,
      },
      {
        id: "r-record-2",
        author: users.muxi,
        createdAt: "今天 08:20",
        content: "最后一段可以提前把视角转过去，落点比看起来宽一些。",
        likes: 9,
      },
      {
        id: "r-record-3",
        author: users.aran,
        createdAt: "今天 09:05",
        content: "这个路线比旧版顺很多，计时点也很清楚。",
        likes: 7,
      },
      {
        id: "r-record-4",
        author: users.kite,
        createdAt: "今天 10:31",
        content: "计时器已经把这张图的新路线同步到排行榜，记录应该已经显示了。",
        likes: 4,
      },
    ],
  },
  {
    id: "longjump-guide",
    title: "教程｜长跳（Long Jump）预加速与空中转向基础",
    excerpt: "从 220 到 250 单位：预加速、起跳时机和空中转向的练习方法。",
    categorySlug: "guides",
    author: users.kite,
    tags: ["长跳", "教程", "基础"],
    createdAt: "2026年10月21日 16:40",
    lastActivity: "1 小时前",
    views: 534,
    content: [
      "长跳的核心不是起跳瞬间按得多快，而是预加速阶段能不能把速度稳定带到边缘。建议先用 kz_longjump_lab 的 220 单位台练习，每次只关注一个变量。",
      "第一阶段：固定预加速节奏，确保最后两步没有减速。第二阶段：在边缘前约 8-12 单位起跳，练习稳定的起跳点。第三阶段：空中只用小幅鼠标转向，避免一次转太多导致落地丢速。",
      "如果你的落点总是偏短，先不要急着提高鼠标灵敏度。检查起跳点、预加速方向和落地时的视角，通常比改设置更有效。",
    ],
    replies: [
      {
        id: "r-longjump-1",
        author: users.aran,
        createdAt: "昨天 18:12",
        content: "原来起跳点要提前这么多，我一直是踩到边缘才按。",
        likes: 10,
      },
      {
        id: "r-longjump-2",
        author: users.yuki,
        createdAt: "昨天 19:40",
        content: "可以在练习图里放一个固定参照物，对稳定起跳点很有帮助。",
        likes: 8,
      },
      {
        id: "r-longjump-3",
        author: users.kite,
        createdAt: "今天 08:55",
        content: "补充：不要一开始就练 250，先把 220 连续成功十次。",
        likes: 12,
      },
      {
        id: "r-longjump-4",
        author: users.bailu,
        createdAt: "今天 10:30",
        content: "按照这个方法练了半小时，已经稳定过 235 了。",
        likes: 5,
      },
    ],
  },
  {
    id: "weekend-lag-report",
    title: "周末高峰期的服务器延迟反馈与排查记录",
    excerpt: "上周六晚高峰出现周期性卡顿，记录了发生时间、表现和初步排查结果。",
    categorySlug: "support",
    author: users.aran,
    tags: ["问题反馈", "网络", "延迟"],
    createdAt: "2026年10月20日 22:08",
    lastActivity: "2 小时前",
    views: 312,
    content: [
      "上周六 21:00 到 22:30 之间，部分 KZ 服务器出现周期性的跳跃延迟，计时器偶尔会延迟显示检查点，但聊天和服务器连接基本正常。",
      "我记录了发生时间和所在服务器，主要集中在在线人数超过 25 人的 kz_hardcore 和 kz_void。看起来与高负载时的 tick 抖动有关。",
      "已经把所有记录整理给管理组。发这个帖子是想确认其他玩家是否也遇到类似情况，以及发生在哪些服务器和地图。",
    ],
    replies: [
      {
        id: "r-lag-1",
        author: users.beichen,
        createdAt: "昨天 09:12",
        content: "我在 kz_hardcore 也遇到了，主要是长跳落地时感觉延迟了一下。",
        likes: 4,
      },
      {
        id: "r-lag-2",
        author: users.chenghai,
        createdAt: "昨天 10:05",
        content: "感谢记录。我们已经调整了节点资源上限和计时器轮询频率，这周末会继续观察。",
        likes: 13,
      },
      {
        id: "r-lag-3",
        author: users.kite,
        createdAt: "昨天 11:20",
        content: "如果计时器延迟只出现在高负载时，可能是日志写入队列堆积，我先加一个监控。",
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
    id: "kz-map-recommend",
    title: "大家最近在练什么图？来交换一下 KZ 地图清单",
    excerpt: "想找一些适合练连跳和长跳的图，最好有清晰检查点和中文计时提示。",
    categorySlug: "general",
    author: users.echo,
    tags: ["讨论", "地图", "训练"],
    createdAt: "2026年10月19日 20:26",
    lastActivity: "3 小时前",
    views: 468,
    content: [
      "最近想系统地练一下连跳和长跳，但服务器里的图太多了，不知道从哪张开始。",
      "目前能稳定过 kz_beginner 和 kz_marble，正在尝试 kz_bhop_city，但连续转向经常断节奏。大家有没有适合这个阶段的地图推荐？",
      "如果有中文计时提示或者清晰的检查点标记就更好了。也欢迎分享你们最近在刷的个人最佳。",
    ],
    replies: [
      {
        id: "r-map-1",
        author: users.yuki,
        createdAt: "昨天 12:40",
        content: "可以试试 kz_dune，路线比较线性，检查点也清楚，适合练中距离落地。",
        likes: 6,
      },
      {
        id: "r-map-2",
        author: users.aran,
        createdAt: "昨天 15:12",
        content: "kz_neon 的短跳组合很适合练节奏，地图也不长，失败了重开成本低。",
        likes: 5,
      },
      {
        id: "r-map-3",
        author: users.echo,
        createdAt: "昨天 16:02",
        content: "收到，今晚先去 kz_dune 试试。",
        likes: 3,
      },
      {
        id: "r-map-4",
        author: users.muxi,
        createdAt: "今天 09:15",
        content: "如果想要更系统的训练顺序，可以参考新手指南里的地图推荐。",
        likes: 8,
      },
      {
        id: "r-map-5",
        author: users.bailu,
        createdAt: "今天 11:22",
        content: "kz_frost 也可以，但冰面手感比较特殊，建议先把普通地面练稳。",
        likes: 4,
      },
    ],
  },
  {
    id: "kz-timer-event",
    title: "十月 KZ 计时赛：地图「kz_skyline」报名开启",
    excerpt: "单人计时赛，地图 kz_skyline，报名截止 10 月 26 日，前三名有社区徽章。",
    categorySlug: "announcements",
    author: users.hoshino,
    tags: ["活动", "计时赛", "kz_skyline"],
    createdAt: "2026年10月18日 12:00",
    lastActivity: "5 小时前",
    views: 620,
    content: [
      "十月 KZ 计时赛使用 kz_skyline，参赛者可以在任意一个已开启计时器的 ThRei 服务器完成成绩。每个人可以提交多次，取赛季内的最佳记录。",
      "报名截止到 10 月 26 日，比赛截止到 11 月 2 日。前三名将获得社区徽章和服务器展示位，完赛玩家也会获得参与徽章。",
      "比赛期间请保持公平：允许使用个人 config 和合法绑定，不允许自动连跳、脚本或任何修改游戏逻辑的第三方工具。",
    ],
    replies: [
      {
        id: "r-timer-1",
        author: users.yuki,
        createdAt: "昨天 14:20",
        content: "kz_skyline 的 128 tick 版本已经同步到所有 KZ 服务器了吗？",
        likes: 7,
      },
      {
        id: "r-timer-2",
        author: users.kite,
        createdAt: "昨天 15:05",
        content: "已经同步，计时器也更新了这张图的检查点。",
        likes: 6,
      },
      {
        id: "r-timer-3",
        author: users.muxi,
        createdAt: "今天 10:12",
        content: "准备报名，最近正好在刷 skyline。",
        likes: 11,
      },
    ],
  },
  {
    id: "new-player-bind",
    title: "从零开始：如何连接服务器、绑定 Steam 与使用计时器",
    excerpt: "整理了新玩家最常问的连接、Steam 绑定、控制台和计时器问题。",
    categorySlug: "support",
    author: users.xiaoman,
    tags: ["新手指南", "Steam", "计时器"],
    createdAt: "2026年10月17日 19:10",
    lastActivity: "8 小时前",
    views: 890,
    content: [
      "最近新朋友比较多，我把大家常问的问题整理成一份短指南，希望能减少重复提问。",
      "连接服务器前，请确认已经安装 CS:GO 并开启开发者控制台。进入服务器页面后复制 IP:PORT，在控制台输入 connect IP:PORT。",
      "社区账号和 Steam 是两套独立体系，但目前可以在用户中心进行绑定。绑定后，论坛称号、计时记录和游戏内身份会显示为同一个名字。",
      "如果计时器没有显示成绩，先确认服务器是否开启了 KZ 插件，再检查是否在起点之后才开始计时。仍然无法解决时，请附上服务器名、地图和大致时间。",
    ],
    replies: [
      {
        id: "r-bind-1",
        author: users.echo,
        createdAt: "昨天 08:40",
        content: "很有用，建议把控制台开启方式也放到服务器页面。",
        likes: 5,
      },
      {
        id: "r-bind-2",
        author: users.hoshino,
        createdAt: "昨天 09:10",
        content: "已经反馈给页面维护，会在加入游戏弹窗里展示控制台命令。",
        likes: 6,
      },
      {
        id: "r-bind-3",
        author: users.beichen,
        createdAt: "今天 07:25",
        content: "绑定后多久同步计时记录？我昨晚绑定的，论坛还是旧名字。",
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
