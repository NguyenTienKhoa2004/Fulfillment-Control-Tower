.PHONY: setup setup-local dev down logs check seed migrate migration-current pgadmin

setup:
	bash scripts/setup.sh

setup-local:
	bash scripts/setup-local.sh

dev:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f

check:
	docker compose exec frontend pnpm build
	docker compose exec backend uv run --frozen --no-sync ruff check .
	docker compose exec backend uv run --frozen --no-sync pytest

seed:
	docker compose run --rm seed

migrate:
	docker compose run --rm --build migrate

migration-current:
	docker compose run --rm migrate uv run --frozen --no-sync alembic current

pgadmin:
	docker compose up -d pgadmin
