import { SiteShell } from "@/components/layout/site-shell";

export default function ForumLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
