# API contract — backend MVP v0.2

Prefix `/api/v1`, Bearer access token từ Supabase. UUID là string, timestamp ISO 8601
có timezone (lưu UTC); UI hiển thị Europe/Stockholm. Không có API login/logout.

## API đã có

| Method | Path | Response |
| --- | --- | --- |
| GET | `/me` | `Profile` |
| GET | `/orders` | `{items: OrderSummary[]}` |
| GET | `/orders/{id}` | `OrderDetail` |
| GET | `/activity` | `{items: ActivityItem[]}` tối đa 20, mới nhất trước |

Đọc DTO chính xác ở `backend/app/schemas.py`, TypeScript ở `frontend/src/api/types.ts`.
Swagger `/docs` và `/openapi.json` cung cấp schema thực thi.
Mọi API nghiệp vụ kiểm tra profile active. Store staff chỉ đọc đơn/event của store mình;
resource ngoài store trả 404.

Ví dụ `Profile`:

```json
{
  "id": "00000000-0000-4000-8000-000000000001",
  "display_name": "Demo Logistics",
  "role": "LOGISTICS_COORDINATOR",
  "store_code": null
}
```

Ví dụ một phần `OrderSummary` (các trường thời gian còn lại được định nghĩa trong DTO):

```json
{
  "id": "00000000-0000-4000-8000-000000000010",
  "order_number": "SE-DEMO-001",
  "store_code": "SE01",
  "delivery_status": "NOT_DISPATCHED",
  "risk_status": "NOT_CHECKED",
  "risk_reason": null,
  "risk_assessments": [],
  "assessed_at": null,
  "incidents": []
}
```

`OrderDetail` có thêm `timeline: IncidentEvent[]`, `incidents` chứa DTO đầy đủ.
Một đơn có nhiều incidents. `risk_assessments` chỉ là kết quả hiện tại,
không thay thế lịch sử sự cố.

## API cập nhật

Các endpoint sau đã triển khai. Mỗi thao tác lưu dữ liệu và event trong cùng transaction.

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/demo/evaluate-risks` | Không | `{evaluated_count, created_incident_count}` |
| POST | `/incidents/{id}/accept` | `{expected_version: number}` | `Incident` |
| POST | `/incidents/{id}/notes` | `{text: string}` | `IncidentEvent` |
| POST | `/incidents/{id}/resolve` | `{expected_version: number, resolution_note: string}` | `Incident` |

`evaluate-risks`, `accept`, `resolve` chỉ dành cho logistics. `notes` cho cả hai role
trong store scope. `resolve` yêu cầu người gọi là assignee hiện tại.

### Kiểm tra rủi ro

`POST /demo/evaluate-risks` đánh giá các đơn thuộc tập `SE-DEMO-001` đến `SE-DEMO-011`.
Mọi rule trong một lần chạy dùng cùng `now`; dữ liệu đơn được khóa khi đánh giá.
Lưu đủ bốn kết quả kể cả CLEAR/UNKNOWN, tổng hợp ưu tiên AT_RISK > UNKNOWN > CLEAR.
Ngưỡng độ mới và cảnh báo bàn giao lấy từ cấu hình backend (mặc định 60/120 phút).

```json
{"evaluated_count": 11, "created_incident_count": 5}
```

Số incident có thể thay đổi theo dữ liệu/thời điểm. `AT_RISK` tạo incident `NEW`
và event `DETECTED` chỉ khi chưa có cặp `(order_id, risk_code)`, kể cả incident cũ
đã RESOLVED. Gọi lại không đổi status, owner, version hoặc notes của incident cũ.
Không tự resolve khi rule CLEAR hoặc đơn DELIVERED. `alert_type=RISK` là nguy cơ;
`DELAYED` là đã trễ. Thiếu dữ liệu chỉ ảnh hưởng rule cần dữ liệu đó.

Trạng thái UNKNOWN, trạng thái chưa hoàn tất bị stale hoặc mốc thực tế mâu thuẫn
trả UNKNOWN. Đơn DELIVERED có `dispatched_at <= delivered_at <= now` trả CLEAR
cho bốn rule, không phụ thuộc ETA/kho/data_verified_at. Dùng hạn cam kết và
`delivered_at` để hiển thị đã giao đúng hạn/trễ riêng.

### Nhận xử lý / giải quyết

Nhận một incident NEW ở version 0:

```json
{"expected_version": 0}
```

Trả Incident đầy đủ, status IN_PROGRESS, assignee là người gọi, `version=1`.
Giải quyết bằng version vừa nhận:

```json
{"expected_version": 1, "resolution_note": "Đã liên hệ vận chuyển và xác nhận phương án xử lý."}
```

Trả status RESOLVED, `version=2`. Sai trạng thái hoặc version trả 409; người khác
resolve incident đang xử lý trả 403. Hai request nhận việc cạnh tranh chỉ một request
thành công, request còn lại nhận 409. Không tự retry mutation.

### Thêm ghi chú

```json
{"text": "Cửa hàng đã xác nhận thông tin khách hàng."}
```

Ghi chú thêm vào timeline, không đổi version hoặc status. Cho phép ghi chú cả sau khi
giải quyết. Ghi chú và resolution_note được trim, giới hạn 1–5000 ký tự.
`expected_version` phải là số nguyên >= 0; không nhận bool, chuỗi hoặc số thập phân.

## Lỗi

```json
{"code": "HTTP_401", "message": "Cần đăng nhập."}
```

401 token thiếu/sai; 403 profile/role không hợp lệ; 404 không có/ngoài scope;
409 xung đột trạng thái/version; 422 validation có `field_errors`;
503 thiếu cấu hình Auth, Auth server không truy cập được hoặc lỗi database.

Ví dụ validation (không trả lại password/token/nội dung input trong lỗi):

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Dữ liệu không hợp lệ.",
  "field_errors": [{"loc": ["body", "text"], "msg": "String should have at least 1 character", "type": "string_too_short"}]
}
```
