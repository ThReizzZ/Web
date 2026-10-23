export interface AdminStat {
  label: string;
  value: string;
  change: string;
  trend: "up" | "down" | "flat";
}

export interface WeeklyActivityPoint {
  day: string;
  players: number;
  posts: number;
}

export interface RecentUser {
  name: string;
  handle: string;
  role: string;
  joinedAt: string;
  status: "正常" | "观察中" | "已禁言";
  avatar: string;
}

export interface ModerationItem {
  id: string;
  target: string;
  reason: string;
  reporter: string;
  time: string;
  severity: "低" | "中" | "高";
}

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  time: string;
}

export const adminStats: AdminStat[] = [
  { label: "注册成员", value: "2,846", change: "+12.4%", trend: "up" },
  { label: "今日活跃", value: "412", change: "+8.1%", trend: "up" },
  { label: "主题总数", value: "1,284", change: "+96", trend: "up" },
  { label: "待审核内容", value: "7", change: "-3", trend: "down" },
];

export const weeklyActivity: WeeklyActivityPoint[] = [
  { day: "周一", players: 212, posts: 46 },
  { day: "周二", players: 248, posts: 52 },
  { day: "周三", players: 231, posts: 41 },
  { day: "周四", players: 296, posts: 63 },
  { day: "周五", players: 342, posts: 78 },
  { day: "周六", players: 398, posts: 94 },
  { day: "周日", players: 412, posts: 86 },
];

export const recentUsers: RecentUser[] = [
  {
    name: "白露",
    handle: "@bailu",
    role: "成员",
    joinedAt: "12 分钟前",
    status: "正常",
    avatar: "from-teal-400 to-cyan-600",
  },
  {
    name: "Rift",
    handle: "@rift",
    role: "计时赛队长",
    joinedAt: "48 分钟前",
    status: "正常",
    avatar: "from-orange-400 to-amber-600",
  },
  {
    name: "Mori",
    handle: "@mori",
    role: "成员",
    joinedAt: "1 小时前",
    status: "正常",
    avatar: "from-lime-400 to-emerald-600",
  },
  {
    name: "Nox",
    handle: "@nox",
    role: "成员",
    joinedAt: "2 小时前",
    status: "观察中",
    avatar: "from-purple-400 to-fuchsia-600",
  },
  {
    name: "Yuki",
    handle: "@yuki",
    role: "地图作者",
    joinedAt: "3 小时前",
    status: "正常",
    avatar: "from-fuchsia-400 to-pink-600",
  },
];

export const moderationQueue: ModerationItem[] = [
  {
    id: "mod-1",
    target: "主题：出售 KZ 计时器修改脚本",
    reason: "疑似作弊/外挂，与本社区规则不符",
    reporter: "匿名举报",
    time: "8 分钟前",
    severity: "中",
  },
  {
    id: "mod-2",
    target: "回复：在「新手指南」下的人身攻击",
    reason: "骚扰与不当言论",
    reporter: "Echo",
    time: "26 分钟前",
    severity: "高",
  },
  {
    id: "mod-3",
    target: "用户：Nox 的头像",
    reason: "图片内容待确认",
    reporter: "自动检测",
    time: "1 小时前",
    severity: "低",
  },
  {
    id: "mod-4",
    target: "主题：KZ 客户端 config 下载链接",
    reason: "外部链接安全性待确认",
    reporter: "白露",
    time: "2 小时前",
    severity: "中",
  },
];

export const auditLog: AuditEntry[] = [
  { id: "audit-1", actor: "星野", action: "通过审核", target: "主题 #1042", time: "11:42" },
  { id: "audit-2", actor: "星野", action: "更新公告", target: "第三赛季开服说明", time: "09:18" },
  {
    id: "audit-3",
    actor: "澄海",
    action: "移动主题",
    target: "#1038 → 地图与记录",
    time: "昨天 22:06",
  },
  { id: "audit-4", actor: "系统", action: "自动隐藏", target: "回复 #8831", time: "昨天 21:54" },
  { id: "audit-5", actor: "星野", action: "恢复用户", target: "Mori", time: "昨天 19:30" },
];

export const roleDistribution = [
  { label: "成员", count: 2684, percent: 94 },
  { label: "创作者", count: 112, percent: 4 },
  { label: "版主", count: 38, percent: 1.3 },
  { label: "管理员", count: 12, percent: 0.7 },
];

export const systemSettings = [
  { label: "注册状态", value: "开放", detail: "需要邮箱验证" },
  { label: "维护模式", value: "关闭", detail: "全部服务器可访问" },
  { label: "内容审核", value: "自动 + 人工", detail: "高风险内容进入队列" },
  { label: "服务器节点", value: "12 个在线", detail: "最后检查于 1 分钟前" },
];
