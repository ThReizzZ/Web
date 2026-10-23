export const siteConfig = {
  name: "threi",
  title: "threi 社区",
  description: "一个面向长期运营的社区系统：官网、论坛、用户中心与管理面板共享统一身份和 API。",
  url: resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL),
  nav: [
    { title: "官网", href: "/" },
    { title: "论坛", href: "/forum" },
    { title: "用户中心", href: "/account" },
    { title: "管理面板", href: "/admin" },
  ],
} as const;

function resolveSiteUrl(value: string | undefined): string {
  if (!value) {
    return "http://localhost:3000";
  }

  try {
    return new URL(value).origin;
  } catch {
    return "http://localhost:3000";
  }
}
