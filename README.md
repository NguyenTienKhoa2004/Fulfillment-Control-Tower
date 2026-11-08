# Netcom Logistics — MVP

Project theo [technical.md](technical.md): React + TypeScript + Vite, React Router,
TanStack Query 5, Supabase Auth, FastAPI, SQLAlchemy, psycopg và PostgreSQL.

## Chạy bằng một lệnh

Cài Git, Docker Desktop (Compose v2.24+), bật Docker Engine. Sau khi clone, tại thư mục repo:

```bash
bash scripts/setup.sh
```

Script tạo `.env` nếu chưa có, build image/cài dependency theo lockfile, bật PostgreSQL,
chạy Alembic migration, seed 12 đơn mẫu đã đánh giá rủi ro, rồi chạy frontend/backend có hot reload và pgAdmin.
Không ghi đè `.env` hoặc reset dữ liệu khi chạy lại. Lần đầu cần Internet.
Docker dùng dependency trong container; không cần Node/Python trên máy.

Kịch bản trình bày và lệnh làm mới dữ liệu trước buổi demo: [DEMO.md](DEMO.md).

- Frontend: http://localhost:5173
- Swagger: http://localhost:8000/docs
- Health: http://localhost:8000/health
- pgAdmin: http://localhost:5050 — `admin@example.com` / `netcom_admin_local` theo `.env` root.
  Kết nối **Development → Netcom Local**, nhập mật khẩu database `netcom_local`.

Chưa có Supabase thì giao diện mặc định mở trang hướng dẫn cấu hình đăng nhập.
Để code UI bằng dữ liệu mẫu, sửa `frontend/.env` thành `VITE_USE_MOCK_API=true`, rồi chạy:

```bash
docker compose up -d --force-recreate frontend
```

Mock chỉ hoạt động ở Vite development; có banner riêng, không dùng Supabase hay backend.
Production build luôn dùng API/auth thật.

## Cấu hình Supabase Auth thật

1. Tạo Supabase project, tắt public sign-up, tạo hai user email/password trong Dashboard.
2. Dùng signing key bất đối xứng ES256/RS256 để backend xác minh qua JWKS;
   sườn chưa hỗ trợ project dùng JWT secret HS256 cũ.
3. Điền `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` vào `frontend/.env`;
   đặt `VITE_USE_MOCK_API=false`.
4. Điền `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
   `DEMO_LOGISTICS_AUTH_ID`, `DEMO_STORE_AUTH_ID` vào `backend/.env`.
   Hai UUID là ID của hai user thật; store profile được gán SE01.
5. Áp dụng cấu hình và seed profile:

```bash
docker compose up -d --force-recreate backend frontend
docker compose run --rm seed
```

Không cần service-role/admin key. Không commit `.env`.
Database nghiệp vụ nằm trong PostgreSQL local; Supabase chỉ cung cấp Auth.

## Chạy dependency trực tiếp trên máy

Cần Node.js 22.12+ (khuyên dùng 24), npm và uv; script bootstrap pnpm trong `.tools/`.
uv tự tải Python 3.12 nếu chưa có. Tại thư mục repo:

```bash
bash scripts/setup-local.sh
docker compose up -d db
cd backend
uv run python -m app.seed
uv run uvicorn app.main:app --reload --port 8000
```

Terminal khác, tại thư mục repo:

```bash
./.tools/node_modules/.bin/pnpm --dir frontend dev
```

Nếu đã cài pnpm 10.34.9 toàn cục, có thể dùng `cd frontend && pnpm dev`.
Không chạy Docker frontend/backend và bản local trên cùng port.

## Kiểm tra và quản lý môi trường

```bash
make check                 # build frontend, Ruff và pytest trong container
docker compose logs -f
docker compose down        # dừng, giữ database volume
docker compose run --rm seed  # seed lại, giữ đơn và lịch sử hiện có
make migrate               # build migration runner rồi nâng database lên head
make migration-current     # xem revision hiện tại
# Chỉ khi muốn xóa và tạo lại tập đơn demo cùng incident/events của chúng:
docker compose run --rm seed uv run --frozen --no-sync python -m app.seed --reset-demo
```

Nếu chạy local:

```bash
./.tools/node_modules/.bin/pnpm --dir frontend build
cd backend
uv run ruff check .
uv run pytest
```

Khi thêm dependency: `pnpm add ...` trong frontend hoặc `uv add ...` trong backend;
commit cả manifest và lockfile, rồi chạy lại setup để rebuild container.
Schema được quản lý bằng Alembic trong `backend/migrations`; seed chỉ thêm/reset dữ liệu demo
sau khi nâng schema lên head. Setup tự chạy theo thứ tự database → migrate → seed → backend.
Database cũ tạo bằng `create_all` được so với snapshot baseline trước khi ghi nhận version;
khác schema sẽ dừng để xử lý, không tự xóa/tạo lại bảng.

Khi đổi models, tạo migration mới từ root repo:

```bash
docker compose exec backend uv run --frozen --no-sync alembic revision --autogenerate -m "describe_change"
```

Đọc lại file được sinh trong `backend/migrations/versions`, rồi chạy `make migrate`.
Thay đổi enum PostgreSQL cần viết/review migration riêng vì autogenerate không xử lý mọi thay đổi enum.
Chi tiết kết nối database và pgAdmin ở [infrastructure/README.md](infrastructure/README.md).

## Trạng thái triển khai

- Backend: đủ tám API nghiệp vụ; bốn rule, transaction/dedupe theo order/rule,
  nhận việc, ghi chú, giải quyết, version guards, store scope, JWT verifier,
  seed/reset và `--advance-demo`. API công khai `/health` kiểm tra process.
- Frontend: đủ ba trang; dashboard đếm sự cố, tìm kiếm/bộ lọc, đánh giá rủi ro,
  nhận việc/ghi chú/giải quyết theo quyền, lịch sử, activity/toast, polling 10 giây,
  Supabase session/login/logout và xử lý xung đột giữ bản nháp.
- Hợp đồng API: [contracts/api.md](contracts/api.md).
- Hướng dẫn tự kiểm tra backend: [backend/README.md](backend/README.md).
- Cấu hình và sử dụng frontend: [frontend/README.md](frontend/README.md).

Không commit `node_modules`, `.venv`, `.tools`, secret hay dữ liệu DB.
Commit source, Dockerfiles, `.env.example` và hai lockfile để người clone setup lại được.
