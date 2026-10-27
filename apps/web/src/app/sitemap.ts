import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteConfig.url, changeFrequency: "weekly", priority: 1 },
    { url: `${siteConfig.url}/servers`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${siteConfig.url}/forum`, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteConfig.url}/players`, changeFrequency: "daily", priority: 0.7 },
  ];
}
