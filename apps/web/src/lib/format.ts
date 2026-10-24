const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Shanghai",
});

const shortDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Shanghai",
});

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "暂无活动";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "暂无活动" : dateFormatter.format(date);
}

export function formatShortDate(value: string | null | undefined): string {
  if (!value) {
    return "暂无活动";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "暂无活动" : shortDateFormatter.format(date);
}

export function formatRelativeTime(value: string | null | undefined): string {
  if (!value) {
    return "暂无活动";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "暂无活动";
  }

  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });
  const ranges: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
    ["second", 1],
  ];

  for (const [unit, secondsInUnit] of ranges) {
    if (Math.abs(seconds) >= secondsInUnit || unit === "second") {
      return formatter.format(Math.round(seconds / secondsInUnit), unit);
    }
  }

  return formatShortDate(value);
}
