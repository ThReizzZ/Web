import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ThRei 社区",
    short_name: "ThRei",
    description: "ThRei CS:GO KZ 攀爬与跳跃社区。",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfbfd",
    theme_color: "#fbfbfd",
    lang: "zh-CN",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
