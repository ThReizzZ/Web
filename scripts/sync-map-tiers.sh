#!/usr/bin/env bash
# Mirror KZ:GO map tiers into a small JSON index served by the download site.
# Output format: {"<lowercase map name>": <tier 1-7>, ...}
set -euo pipefail

TARGET_DIR="${MAP_TIERS_DIR:-/home/files/fastdl/csgo}"
TARGET_FILE="$TARGET_DIR/map-tiers-v1.json"
SOURCE_URL="${MAP_TIERS_URL:-https://kzgo.eu/api/maps}"
TMP_FILE="$(mktemp "$TARGET_DIR/.map-tiers.XXXXXX")"
trap 'rm -f "$TMP_FILE"' EXIT

curl -fsSL --retry 3 --retry-all-errors --max-time 60 "$SOURCE_URL" \
  | python3 -c '
import json, sys

data = json.load(sys.stdin)
tiers = {
    str(item["name"]).strip().lower(): int(item["tier"])
    for item in data
    if item.get("name") and isinstance(item.get("tier"), int) and 1 <= item["tier"] <= 7
}
if len(tiers) < 500:
    raise SystemExit(f"refusing to write only {len(tiers)} map tiers")
json.dump(tiers, sys.stdout, separators=(",", ":"), ensure_ascii=False)
' > "$TMP_FILE"

chmod 644 "$TMP_FILE"
mv "$TMP_FILE" "$TARGET_FILE"
trap - EXIT
echo "updated $TARGET_FILE ($(python3 -c 'import json,sys; print(len(json.load(open(sys.argv[1]))))' "$TARGET_FILE") maps)"
