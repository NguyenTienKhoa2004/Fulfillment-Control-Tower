#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v node >/dev/null || { echo 'Cần Node.js 22.12+ (khuyên dùng 24).' >&2; exit 1; }
command -v npm >/dev/null || { echo 'Cần npm để bootstrap pnpm.' >&2; exit 1; }
command -v uv >/dev/null || { echo 'Cần cài uv trước.' >&2; exit 1; }
[ -f .env ] || cp .env.example .env
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 12)) process.exit(1)' || {
  echo 'Cần Node.js 22.12+.' >&2; exit 1;
}
for service in frontend backend; do
  [ -f "$service/.env" ] || cp "$service/.env.example" "$service/.env"
done
npm install --prefix .tools --no-audit --no-fund pnpm@10.34.9
./.tools/node_modules/.bin/pnpm --dir frontend install --frozen-lockfile
(cd backend && uv sync --frozen)
echo 'Đã cài dependency. Xem README.md để chạy frontend/backend local.'
