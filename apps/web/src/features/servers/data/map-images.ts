export function kzMapImageUrl(mapName: string): string | null {
  const normalized = mapName.trim();
  if (!/^[A-Za-z0-9_.-]+$/.test(normalized)) {
    return null;
  }
  return `/map-images/${encodeURIComponent(normalized)}`;
}

export function kzMapCdnImageUrl(mapName: string): string | null {
  const normalized = mapName.trim();
  if (!/^[A-Za-z0-9_.-]+$/.test(normalized)) {
    return null;
  }
  return `https://cdn.threi.cn/csgo/map-images-v1/${encodeURIComponent(normalized)}.jpg`;
}
