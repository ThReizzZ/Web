import { SiteShell } from "@/components/layout/site-shell";

export default function ServersLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
