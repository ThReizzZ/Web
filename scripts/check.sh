#!/usr/bin/env bash
# Run every static check and test suite that does not require a database.
# Usage: ./scripts/check.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Rust format"
(cd "$ROOT_DIR/services/api" && cargo fmt --all -- --check)

echo "==> Rust clippy"
(cd "$ROOT_DIR/services/api" && cargo clippy --all-targets -- -D warnings)

echo "==> Rust tests"
(cd "$ROOT_DIR/services/api" && cargo test)

echo "==> TypeScript"
(cd "$ROOT_DIR/apps/web" && npm run typecheck)

echo "==> ESLint"
(cd "$ROOT_DIR/apps/web" && npm run lint)

echo "==> Prettier"
(cd "$ROOT_DIR/apps/web" && npm run format:check)

echo
echo "All checks passed."
