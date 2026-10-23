export interface ProfileStat {
  label: string;
  value: string;
  detail: string;
}

export interface ActivityItem {
  id: string;
  type: "reply" | "topic" | "server" | "badge";
  title: string;
  detail: string;
  time: string;
  href?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  detail: string;
  time: string;
  unread: boolean;
}

export interface ProfileBadge {
  id: string;
  name: string;
  description: string;
  tone: string;
}

export const currentUser = {
  name: "星野",
  handle: "@hoshino",
  role: "社区管理员",
  avatar: "from-amber-400 to-orange-500",
  joinedAt: "2025年3月加入 ThRei",
  location: "杭州",
  bio: "喜欢 KZ 长跳、连跳和计时刷图。正在完善 kz_beginner 的新手路线，也在筹划下一场社区计时赛。",
  completion: 86,
};

export const profileStats: ProfileStat[] = [
  { label: "主题", value: "28", detail: "本月新增 4" },
  { label: "回复", value: "342", detail: "获赞 1,284" },
  { label: "游戏时长", value: "486h", detail: "最近 30 天 52h" },
  { label: "社区贡献", value: "Top 3%", detail: "连续活跃 18 周" },
];

export const recentActivity: ActivityItem[] = [
  {
    id: "activity-1",
    type: "reply",
    title: "回复了「第三赛季『极速阶梯』今晚 20:00 开启」",
    detail: "补充了新赛季计时榜和地图轮换的说明。",
    time: "12 分钟前",
    href: "/forum/topic/season-three-rush",
  },
  {
    id: "activity-2",
    type: "server",
    title: "在 kz_beginner 练习了 2 小时 36 分钟",
    detail: "刷新了个人最佳 00:42.31，并整理了最后一段的落地节奏。",
    time: "今天 09:24",
  },
  {
    id: "activity-3",
    type: "topic",
    title: "发布了「十月 KZ 计时赛：地图『kz_skyline』报名开启」",
    detail: "已有 12 名玩家报名，成绩提交截止到 11 月 2 日。",
    time: "昨天 12:00",
    href: "/forum/topic/kz-timer-event",
  },
  {
    id: "activity-4",
    type: "badge",
    title: "获得了「社区守望者」徽章",
    detail: "在过去 90 天内持续参与 KZ 新人引导与地图测试。",
    time: "10 月 20 日",
  },
];

export const notifications: NotificationItem[] = [
  {
    id: "notification-1",
    title: "木木回复了你的主题",
    detail: "「kz_beginner 的新手路线已经测试过了，前两个检查点会更友好。」",
    time: "18 分钟前",
    unread: true,
  },
  {
    id: "notification-2",
    title: "新赛季将在今晚开放",
    detail: "请启动 CS:GO 并在控制台输入 connect 地址；新赛季计时榜已重置。",
    time: "1 小时前",
    unread: true,
  },
  {
    id: "notification-3",
    title: "你的 KZ 记录被加入精选",
    detail: "「kz_beginner 00:42.31」已收录到地图与记录的本周精选。",
    time: "昨天 20:10",
    unread: false,
  },
];

export const profileBadges: ProfileBadge[] = [
  {
    id: "badge-1",
    name: "社区守望者",
    description: "持续参与社区维护",
    tone: "bg-amber-500/10 text-amber-700",
  },
  {
    id: "badge-2",
    name: "长跳达人",
    description: "长跳达到 250 单位",
    tone: "bg-emerald-500/10 text-emerald-700",
  },
  {
    id: "badge-3",
    name: "首赛季成员",
    description: "参与第一赛季计时榜",
    tone: "bg-sky-500/10 text-sky-700",
  },
  {
    id: "badge-4",
    name: "连跳先锋",
    description: "连跳路线进入前 100",
    tone: "bg-violet-500/10 text-violet-700",
  },
];

export const favoriteServerIds = ["kz-beginner", "kz-bhop-city"];

export const securityOverview = [
  { label: "最近登录", value: "今天 08:42 · 杭州", status: "正常" },
  { label: "双重验证", value: "已启用", status: "安全" },
  { label: "活跃会话", value: "2 台设备", status: "正常" },
  { label: "Steam 账号", value: "已绑定 · hoshino_kz", status: "已同步" },
];
