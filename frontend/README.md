# Frontend Netcom

React + TypeScript + Vite, React Router, TanStack Query 5, Supabase Auth.
Giao diện tiếng Anh; mọi mốc ngày giờ hiển thị theo giờ Việt Nam (Asia/Ho_Chi_Minh, UTC+7).
Nút mặt trăng/mặt trời ở thanh trên cùng và trang đăng nhập chuyển theme sáng/tối.
Lần đầu dùng theo thiết lập hệ thống; lựa chọn sau đó được lưu trên trình duyệt.

## Chạy

Tại root repo: `bash scripts/setup.sh`, mở http://localhost:5173.
Sửa file trong `frontend/src` được cập nhật qua Vite hot reload.
Nếu dùng dependency local: `./.tools/node_modules/.bin/pnpm --dir frontend dev`.

## API và đăng nhập thật

Điền `frontend/.env`:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_USE_MOCK_API=false
```

Backend cần URL Supabase và profile tương ứng với UUID tài khoản như README gốc.
Khi đổi `.env`, chạy `docker compose up -d --no-deps --force-recreate frontend`;
nếu chạy local thì dừng và chạy lại Vite.

Đăng nhập bằng email/password đã được cấp. SDK quản lý session và refresh token.
API lấy access token hiện tại, gửi Bearer token. Khi API trả 401, yêu cầu đăng nhập lại.
Đăng xuất hoặc đổi tài khoản xóa query cache; dữ liệu và bản nháp tách theo phiên tài khoản.
Frontend ẩn nút theo role, backend vẫn là nơi kiểm tra quyền cuối cùng.

## Dữ liệu mẫu để phát triển UI

Đặt `VITE_USE_MOCK_API=true` và khởi động lại frontend. Có banner riêng, tài khoản
mẫu logistics và 10 đơn. Bấm Kiểm tra rủi ro để tạo assessments/incidents, sau đó có thể
nhận việc, ghi chú và ghi nhận giải quyết qua cùng interface API.

Mock chạy trong bộ nhớ của tab, không gửi request nghiệp vụ đến backend.
Reload khôi phục fixtures, các tab không chia sẻ dữ liệu. Muốn dùng hai tài khoản,
kiểm tra scope hoặc lưu dữ liệu sau reload, dùng API/Auth thật.
Mock chỉ bật ở Vite development; production build luôn dùng API/Auth thật.

## Các màn hình

- **Đơn hàng:** dải KPI đếm đơn Delayed, At risk, Needs verification và mốc handover/
  giao hàng đến hạn trong 2 giờ tới. KPI tính trên toàn scope, có thể giao nhau;
  bấm để lọc. Thanh Incidents hiển thị tổng và số sự cố theo trạng thái riêng.
  Compact là mặc định, lựa chọn mật độ lưu trên trình duyệt. Countdown cập nhật
  theo đồng hồ; ETA/actual hiển thị chênh lệch với hạn cam kết. Lý do mở đầy đủ qua
  Details hoặc hover. Logistics có thể Assign to me ngay trên dòng; frontend lấy
  version hiện tại trước khi gọi accept và tải lại nếu gặp xung đột 409.
  Có tìm kiếm mã đơn/khách hàng/cửa hàng, lọc cảnh báo và giai đoạn trên URL.
  Rule priority là chỉ số minh bạch theo rule, không phải xác suất: quá hạn 80 +
  5 mỗi giờ trễ (tối đa 100); cảnh báo sớm 50 + 5 mỗi giờ ETA vượt hạn (tối đa 70);
  chưa có cảnh báo nhưng đến hạn trong 1h/2h là 35/20, ngoài khoảng đó là 0.
  Đơn đã giao, thiếu dữ liệu, dữ liệu cũ hoặc vừa qua hạn từ lần đánh giá trước
  không được chấm điểm; cần xác minh/đánh giá lại.
- **Chi tiết:** trạng thái kho/giao hàng, hạn cam kết/ETA/mốc thực tế, dữ liệu xác minh,
  bốn kết quả rule, từng hồ sơ sự cố và lịch sử tổng hợp. Đơn đã giao hiển thị đúng
  hạn/trễ/chưa đủ dữ liệu riêng với cảnh báo hiện tại.
  Khối rủi ro thu gọn nằm ở cột trái; bấm từng dòng để mở lý do và thời điểm đánh giá.
- **Phối hợp:** logistics nhận incident NEW; chỉ assignee giải quyết incident IN_PROGRESS.
  Hai role đều thêm ghi chú trong scope. Form yêu cầu nội dung không rỗng, tối đa 5000 ký tự.
  Bản nháp không bị polling xóa. Lỗi 409 tải lại dữ liệu, giữ nội dung và không tự gửi lại.
- **Hoạt động:** dropdown 20 event mới nhất, badge là số incident NEW.
  Poll orders/detail/activity mỗi 10 giây khi app đang hoạt động; mutation thành công
  refetch ngay. Lần tải đầu không toast lịch sử; event mới được dedupe theo ID trong memory.

Logistics có thể cập nhật ETA và mốc giao thực tế qua form xác minh dữ liệu;
hạn giao cam kết được giữ nguyên. Cũng có thể chuyển giai đoạn demo qua lệnh
backend đã mô tả trong `backend/README.md`.

## Build

```bash
./.tools/node_modules/.bin/pnpm --dir frontend build
```

Chạy từ root repo; lệnh kiểm tra TypeScript rồi tạo bundle trong `frontend/dist`.
Production cần SPA fallback về `index.html` khi mở trực tiếp `/orders/:id`;
hosting/deploy production nằm ngoài phạm vi demo local.
