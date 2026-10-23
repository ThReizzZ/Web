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
  bio: "喜欢海边、慢节奏生存和公共工程。正在维护 Elysium Valley 的潮汐湾聚落，也在筹划下一场社区建筑活动。",
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
    title: "回复了「第三赛季『群岛纪元』今晚 20:00 开启」",
    detail: "补充了资源岛刷新和航线维护的说明。",
    time: "12 分钟前",
    href: "/forum/topic/season-three-islands",
  },
  {
    id: "activity-2",
    type: "server",
    title: "在 Elysium Valley 游玩了 2 小时 36 分钟",
    detail: "完成了潮汐湾码头扩建，并放置了新的公共照明。",
    time: "今天 09:24",
  },
  {
    id: "activity-3",
    type: "topic",
    title: "发布了「十月建筑大赛：主题『风与遗迹』报名开启」",
    detail: "已有 3 支队伍报名，作品提交截止到 11 月 2 日。",
    time: "昨天 12:00",
    href: "/forum/topic/autumn-build-event",
  },
  {
    id: "activity-4",
    type: "badge",
    title: "获得了「社区守望者」徽章",
    detail: "在过去 90 天内持续参与社区维护与新人引导。",
    time: "10 月 20 日",
  },
];

export const notifications: NotificationItem[] = [
  {
    id: "notification-1",
    title: "木木回复了你的主题",
    detail: "「潮汐湾会在新赛季继续开工，这次想把港口和公共仓库放在一起。」",
    time: "18 分钟前",
    unread: true,
  },
  {
    id: "notification-2",
    title: "新赛季将在今晚开放",
    detail: "客户端请更新至 1.21.4；新主世界和大厅赛季仓库已准备就绪。",
    time: "1 小时前",
    unread: true,
  },
  {
    id: "notification-3",
    title: "你的建筑作品被加入精选",
    detail: "「潮汐湾灯塔」已收录到创造工坊的本周精选。",
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
    name: "优秀建筑师",
    description: "作品入选月度精选",
    tone: "bg-emerald-500/10 text-emerald-700",
  },
  {
    id: "badge-3",
    name: "开荒成员",
    description: "参与第一赛季开荒",
    tone: "bg-sky-500/10 text-sky-700",
  },
  {
    id: "badge-4",
    name: "航线先驱",
    description: "参与公共航线建设",
    tone: "bg-violet-500/10 text-violet-700",
  },
];

export const favoriteServerIds = ["elysium-valley", "aether-workshop"];

export const securityOverview = [
  { label: "最近登录", value: "今天 08:42 · 杭州", status: "正常" },
  { label: "双重验证", value: "已启用", status: "安全" },
  { label: "活跃会话", value: "2 台设备", status: "正常" },
  { label: "游戏账号", value: "已绑定 · Hoshino#2841", status: "已同步" },
];
