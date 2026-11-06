# PostgreSQL, pgAdmin và migration local

Docker Compose quản lý PostgreSQL 17 và pgAdmin 4. Supabase chỉ cung cấp Auth;
không cần dùng database Supabase cho dữ liệu đơn hàng.

## pgAdmin

Mở http://localhost:5050. Mặc định đăng nhập:

- Email: `admin@example.com`
- Password: `netcom_admin_local`

Hai giá trị cấu hình tại `.env` ở root repo. Chúng được áp dụng khi pgAdmin khởi tạo
database cấu hình lần đầu; muốn đổi mật khẩu về sau dùng menu tài khoản trong pgAdmin.

Mở **Servers → Development → Netcom Local**, nhập database password `netcom_local`.
Server definition đã được import từ `infrastructure/pgadmin/servers.json`.
Trong database `netcom`, mở **Schemas → public → Tables** để xem:
`profiles`, `orders`, `incidents`, `incident_events`, `alembic_version`.

## Thông tin PostgreSQL

| Trường | Chạy trên máy host | Từ container cùng Compose |
| --- | --- | --- |
| Host | `localhost` | `db` |
| Port | `5432` | `5432` |
| Database | `netcom` | `netcom` |
| Username | `netcom` | `netcom` |
| Password | `netcom_local` | `netcom_local` |

PostgreSQL và pgAdmin chỉ mở port trên `127.0.0.1`. Dữ liệu nằm trong named volumes
`postgres_data` và `pgadmin_data`. `docker compose down` giữ dữ liệu.

## Migration

```bash
make migrate
make migration-current
```

Migration runner dùng Alembic và transaction/advisory lock. Với database trống,
`0001_initial` tạo bốn bảng, tám enum, indexes và constraints. Với database cũ đã có
bảng từ seed, runner so schema với snapshot baseline rồi stamp `0001_initial`, sau đó
upgrade lên head. Nếu schema khác baseline thì dừng; không tự sửa/xóa dữ liệu.

Tạo migration mới sau khi sửa `backend/app/models.py`:

```bash
docker compose exec backend uv run --frozen --no-sync alembic revision --autogenerate -m "describe_change"
```

Migration được ghi vào source qua bind mount. Review file rồi chạy `make migrate`.
Không sửa revision đã áp dụng. PostgreSQL enum cần review/chỉnh migration thủ công.
