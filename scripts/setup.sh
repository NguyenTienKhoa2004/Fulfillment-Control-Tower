#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

command -v docker >/dev/null || { echo 'Cần cài Docker Desktop trước.' >&2; exit 1; }
docker compose version >/dev/null
docker info >/dev/null 2>&1 || { echo 'Cần bật Docker Engine trước.' >&2; exit 1; }
[ -f .env ] || cp .env.example .env
for service in frontend backend; do
  if [ ! -f "$service/.env" ]; then
    cp "$service/.env.example" "$service/.env"
    echo "Đã tạo $service/.env; điền Supabase khi dùng auth thật."
  fi
done
docker compose up --build --detach --wait
echo 'Frontend: http://localhost:5173'
echo 'Backend docs: http://localhost:8000/docs'
echo 'pgAdmin: http://localhost:5050 (tài khoản trong .env ở root repo)'
