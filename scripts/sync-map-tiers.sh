#!/usr/bin/env bash
# Mirror map tiers from the ThRei KZ API into a small JSON index served by the
# download site. The website reads the API first and uses this file as a
# fallback when the API is unavailable.
set -euo pipefail

TARGET_DIR="${MAP_TIERS_DIR:-/home/files/fastdl/csgo}"
TARGET_FILE="$TARGET_DIR/map-tiers-v1.json"
API_BASE="${KZ_API_URL:-https://api.threi.cn}"
TMP_FILE="$(mktemp "$TARGET_DIR/.map-tiers.XXXXXX")"
trap 'rm -f "$TMP_FILE"' EXIT

KZ_API_URL="$API_BASE" python3 - "$TMP_FILE" <<'PY'
import json
import os
import sys
import urllib.request

base = os.environ["KZ_API_URL"].rstrip("/")
items = []
offset = 0
while True:
    url = f"{base}/api/v1/maps?validated=true&limit=200&offset={offset}"
    with urllib.request.urlopen(url, timeout=30) as response:
        page = json.load(response)
    items.extend(page.get("items", []))
    offset += 200
    if offset >= int(page.get("total", 0)):
        break

tiers = {
    item["name"].strip().lower(): int(item["tier"])
    for item in items
    if item.get("name") and isinstance(item.get("tier"), int)
}
if len(tiers) < 500:
    raise SystemExit(f"refusing to write only {len(tiers)} map tiers")
with open(sys.argv[1], "w", encoding="utf-8") as output:
    json.dump(tiers, output, separators=(",", ":"), ensure_ascii=False)
PY

chmod 644 "$TMP_FILE"
mv "$TMP_FILE" "$TARGET_FILE"
trap - EXIT
echo "updated $TARGET_FILE ($(python3 -c 'import json,sys; print(len(json.load(open(sys.argv[1]))))' "$TARGET_FILE") maps)"
