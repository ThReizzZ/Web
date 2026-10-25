import { Badge } from "@/components/ui/badge";

import type { ServerStatus } from "../data/servers";

export function ServerStatusBadge({ status }: { status: ServerStatus }) {
  if (status === "maintenance") {
    return (
      <Badge variant="warning">
        <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />
        维护中
      </Badge>
    );
  }

  if (status === "hibernating") {
    return (
      <Badge variant="warning">
        <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />
        休眠/待上报
      </Badge>
    );
  }

  if (status === "offline") {
    return (
      <Badge variant="muted">
        <span className="size-1.5 rounded-full bg-muted-foreground" aria-hidden="true" />
        离线
      </Badge>
    );
  }

  return (
    <Badge variant="success">
      <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
      在线
    </Badge>
  );
}
