# Backend MVP

FastAPI + Pydantic, SQLAlchemy/psycopg, PostgreSQL local, xác thực Supabase JWT.
Tất cả API theo [contracts/api.md](../contracts/api.md); mở http://localhost:8000/docs.

## Cấu hình

`backend/.env`: `DATABASE_URL`, `SUPABASE_URL`, `FRONTEND_ORIGIN`,
`DEMO_LOGISTICS_AUTH_ID`, `DEMO_STORE_AUTH_ID`. Hai UUID là user Supabase thật;
seed tạo profile tương ứng, staff thuộc SE01. Không dùng service-role key.
`SUPABASE_PUBLISHABLE_KEY` được giữ trong mẫu cấu hình chung; JWKS verifier chỉ cần URL.
Supabase project cần signing key ES256/RS256; không hỗ trợ legacy HS256.

Các biến tùy chọn: `RISK_DATA_MAX_AGE_MINUTES=60`, `HANDOVER_WARNING_MINUTES=120`.
Thay `.env` thì recreate backend: `docker compose up -d --force-recreate backend`.
Đọc user/role/store từ profile DB, không nhận quyền từ request hoặc user_metadata.

## Chạy

Từ root repo:

```bash
bash scripts/setup.sh
docker compose run --rm seed
```

Hoặc local: bật `docker compose up -d db`, trong thư mục backend chạy
`uv sync --frozen`, `uv run python -m app.seed`,
`uv run uvicorn app.main:app --reload --port 8000`.
API khởi động không tự reset dữ liệu.

## Migration

Schema dùng Alembic. Từ root chạy `make migrate`; xem version bằng `make migration-current`.
Chạy local trong backend: `uv run python -m app.migrate`.
Lệnh seed tự gọi migration trước khi thêm dữ liệu. Database cũ được đối chiếu với snapshot
`0001_initial` rồi ghi nhận version, giữ nguyên dữ liệu; schema lệch sẽ dừng.

Để tạo migration mới sau khi sửa models: `uv run alembic revision --autogenerate -m "describe_change"`.
Đọc lại migration, đặc biệt thay đổi enum/drop column, rồi chạy `uv run python -m app.migrate`.

## Tự kiểm tra journey

Chuẩn bị hai tài khoản như README gốc. Đăng nhập bằng Supabase để lấy **access token**,
trong Swagger bấm Authorize và nhập token; không dùng publishable key làm Bearer token.
Frontend mock không cung cấp token thật.

Để làm mới tập demo và timestamps, lệnh sau xóa các đơn demo cùng incident/events của chúng:

```bash
docker compose run --rm seed uv run --frozen --no-sync python -m app.seed --reset-demo
```

1. Logistics gọi `/me`, `/orders`, rồi `POST /demo/evaluate-risks`.
   Lần đầu tạo các sự cố; lần tiếp theo không tạo trùng. Mỗi đơn có đủ bốn assessments.
2. Lấy incident ID và version từ chi tiết đơn SE-DEMO-001, gọi accept với
   `{"expected_version": 0}`. Kiểm tra assignee, accepted_at, version và ACCEPTED event.
3. Staff gọi notes bằng `{"text": "Cửa hàng đã liên hệ khách."}`. Staff chỉ thấy SE01;
   đọc đơn SE02 hoặc ghi chú sự cố của SE02 trả 404. Staff accept/resolve/evaluate trả 403.
4. Logistics đang phụ trách resolve với version mới và resolution_note. Version cũ
   trả 409; logistics khác không được resolve incident của người khác. Ghi nhận giải quyết
   không đổi trạng thái giao hàng, ETA hoặc hạn giao.
5. Kiểm tra timeline, activity và danh sách đơn sau reload. Thêm ghi chú không đổi version.

Để cùng một đơn đi qua các giai đoạn, gọi từ root repo:

```bash
docker compose run --rm seed uv run --frozen --no-sync python -m app.seed --advance-demo SE-DEMO-001 --stage dispatched
```

Kiểm tra lại rủi ro: tạo sự cố ETA trễ, giữ nguyên incident kho và lịch sử xử lý.
Tiếp tục:

```bash
docker compose run --rm seed uv run --frozen --no-sync python -m app.seed --advance-demo SE-DEMO-001 --stage delivered
```

Kiểm tra lại: bốn rule CLEAR nếu mốc thực tế hợp lệ; incident hiện có không tự resolve.
Lặp cùng stage không đổi timestamps/ETA; bỏ qua dispatched hoặc chuyển lùi bị từ chối.
Lệnh chỉ nhận đơn demo đã seed, giữ nguyên hạn giao cam kết.

## Tập demo sau reset

| Đơn | Kịch bản |
| --- | --- |
| 001 | Kho chưa sẵn sàng, trong khoảng cảnh báo 120 phút |
| 002 | Đồng thời quá giờ bàn giao và quá hạn giao |
| 003 | Đang vận chuyển, ETA vượt hạn |
| 004 | Đang vận chuyển, đã quá hạn giao |
| 005 | Chưa xuất giao, chưa có cảnh báo |
| 006 | Đang vận chuyển nhưng thiếu ETA |
| 007 | Cửa hàng SE02, dữ liệu cũ hơn 60 phút |
| 008 | Đã giao đúng hạn |
| 009 | Đã giao trễ, không tạo cảnh báo hiệu lực |
| 010 | Trạng thái giao chưa xác định |
| 011 | Shipper kẹt xe, đang vận chuyển, dự kiến giao trễ hạn 60 phút |

Thêm riêng đơn 011, giữ nguyên dữ liệu các đơn khác:

```bash
docker compose exec backend uv run --frozen --no-sync python -m app.seed --add-shipper-delay
```

Đơn này có sẵn đánh giá và incident NEW để xem ngay. Chạy lại không tạo trùng hay đổi
lịch sử/thời gian của đơn đã tồn tại.

Cảnh báo phụ thuộc thời gian chạy; reset trước buổi demo để dữ liệu còn mới.
Hai rule bàn giao cần planned_handover_at khi chưa xuất giao; hai rule giao hàng
cần hạn giao. ETA thiếu không chặn rule quá hạn giao.
