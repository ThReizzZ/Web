const MAP_NAME_PATTERN = /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/;
const UPSTREAM_TIMEOUT_MS = 8_000;
const CACHE_SECONDS = 86_400;

function upstreamUrls(mapName: string): string[] {
  const encoded = encodeURIComponent(mapName);
  return [
    `https://raw.githubusercontent.com/KZGlobalTeam/map-images/public/mediums/${encoded}.jpg`,
    `https://cdn.jsdelivr.net/gh/KZGlobalTeam/map-images@public/mediums/${encoded}.jpg`,
  ];
}

export async function GET(_request: Request, { params }: { params: Promise<{ map: string }> }) {
  const { map } = await params;
  const mapName = decodeURIComponent(map).trim();
  if (!MAP_NAME_PATTERN.test(mapName) || mapName.includes("..")) {
    return new Response("Invalid map name", { status: 400 });
  }

  for (const url of upstreamUrls(mapName)) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "ThRei/0.1 (+https://threi.cn)" },
        next: { revalidate: CACHE_SECONDS },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok || !contentType.startsWith("image/")) {
        continue;
      }
      return new Response(await response.arrayBuffer(), {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": `public, max-age=${CACHE_SECONDS}, stale-while-revalidate=604800`,
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      // Try the next upstream, then fall back to the gradient in the UI.
    }
  }

  return new Response("Map image not found", { status: 404 });
}
