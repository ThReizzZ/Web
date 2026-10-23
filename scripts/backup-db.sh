#!/usr/bin/env bash
# Create a compressed logical backup of the PostgreSQL database.
# Usage: ./scripts/backup-db.sh [output-directory]
#
# The script runs pg_dump inside the postgres container, so it does not need a
# host-side psql client or the database password in the shell history.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="${1:-$ROOT_DIR/backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$OUTPUT_DIR"

cd "$ROOT_DIR"

docker compose exec -T postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner' \
  > "$OUTPUT_DIR/threi-$STAMP.dump"

echo "Backup written to $OUTPUT_DIR/threi-$STAMP.dump"
echo "Verify it with: pg_restore --list <file>"
