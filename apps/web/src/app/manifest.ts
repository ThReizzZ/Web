import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "threi 社区",
    short_name: "threi",
    description: "面向长期运营的社区系统。",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfbfd",
    theme_color: "#fbfbfd",
    lang: "zh-CN",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
