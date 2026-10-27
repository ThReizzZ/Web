export const qqGroupUrl = "https://qm.qq.com/q/tDU8zyaxp0";

export const siteConfig = {
  name: "ThRei",
  title: "ThRei 社区",
  description: "ThRei 是一个以 CS:GO KZ 攀爬、连跳和长跳玩法为核心的社区。",
  url: resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL),
  nav: [
    { title: "官网", href: "/" },
    { title: "论坛", href: "/forum" },
    { title: "服务器", href: "/servers" },
    { title: "下载站", href: "https://cdn.threi.cn/csgo/", external: true },
    { title: "社区玩家", href: "/players" },
    { title: "加入我们", href: qqGroupUrl, external: true },
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
