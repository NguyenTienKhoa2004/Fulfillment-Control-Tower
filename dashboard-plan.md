# Business Requirements — Dashboard phân tích vận hành fulfilment

## 1. Mục tiêu kinh doanh

Tạo một trang **Dashboard phân tích** riêng để Operations Manager và Logistics Coordinator đánh giá kết quả giao hàng, nhận diện điểm nghẽn và quyết định ưu tiên cải thiện quy trình trong pilot Sweden.

Dashboard cần trả lời ba câu hỏi chính:

1. Đơn hàng có được giao đúng cam kết ban đầu không?
2. Vấn đề thường xuất hiện ở giai đoạn nào, cửa hàng nào và có xu hướng ra sao?
3. Khi phát hiện sự cố, đội vận hành tiếp nhận và xử lý nhanh đến mức nào?

Phạm vi này cụ thể hóa **BR-05** và **BR-06** trong `plan.md`. Trang Orders tiếp tục phục vụ theo dõi và xử lý từng đơn; Dashboard phân tích tổng hợp kết quả qua nhiều đơn và nhiều khoảng thời gian, cho phép mở danh sách hoặc hồ sơ liên quan để kiểm tra số liệu.

## 2. Người sử dụng và quyết định cần hỗ trợ

| Người sử dụng | Nhu cầu | Quyết định được hỗ trợ |
| --- | --- | --- |
| **Operations Manager** | Xem kết quả giao hàng, xu hướng sự cố và tốc độ xử lý trong phạm vi pilot. | Ưu tiên cải tiến quy trình, điều chỉnh nguồn lực và đánh giá pilot. |
| **Logistics Coordinator** | Xem điểm nghẽn theo giai đoạn, khối lượng tồn đọng và thời gian phối hợp xử lý. | Ưu tiên kiểm tra khu vực có nhiều sự cố hoặc phản ứng chậm. |
| **Store Staff** | Nếu được cấp quyền Dashboard, xem kết quả thuộc cửa hàng mình. | Nhận biết vấn đề lặp lại tại cửa hàng và phối hợp với logistics. |

**Giả định cần xác nhận:** Operations Manager là người sử dụng mục tiêu của Dashboard. Technical plan hiện chỉ có hai role; quyền truy cập cho quản lý cần được thống nhất trước khi triển khai. Nhu cầu này chưa mặc định yêu cầu xây thêm một hệ thống quản trị tài khoản.

## 3. Business requirements

| ID | Yêu cầu kinh doanh | Giá trị / quyết định được hỗ trợ |
| --- | --- | --- |
| **DBR-01** | Người dùng cần xem tỷ lệ giao đúng cam kết ban đầu và số đơn đã quá hạn chưa giao trong kỳ. | Đánh giá kết quả giao hàng thực tế, độc lập với số sự cố đã đóng. |
| **DBR-02** | Người dùng cần phân tích sự cố theo giai đoạn fulfilment, loại cảnh báo và cửa hàng. | Xác định nơi cần điều tra và cải thiện trước. |
| **DBR-03** | Người dùng cần đo thời gian từ phát hiện đến tiếp nhận và từ tiếp nhận đến đóng sự cố. | Phân biệt chậm nhận việc với chậm xử lý sau khi đã nhận. |
| **DBR-04** | Người dùng cần thấy sự cố chưa được nhận và sự cố còn mở lâu tại thời điểm xem. | Phát hiện công việc bị tồn đọng để phối hợp xử lý. |
| **DBR-05** | Người dùng cần xem xu hướng theo thời gian và so sánh các kỳ có định nghĩa tương đương. | Biết kết quả đang cải thiện hay xấu đi, hỗ trợ đánh giá pilot. |
| **DBR-06** | Người dùng cần lọc số liệu theo thời gian và cửa hàng trong phạm vi được phép xem, đồng thời mở các bản ghi tạo nên số liệu. | Kiểm tra được kết luận và chuyển từ phân tích sang xem chi tiết. |
| **DBR-07** | Người dùng cần biết độ đầy đủ, độ mới và thời điểm chốt dữ liệu của báo cáo. | Tránh đánh giá sai do thiếu dữ liệu, dữ liệu cũ hoặc chưa chạy đánh giá rủi ro. |
| **DBR-08** | Khi đã có dữ liệu có cấu trúc, quản lý cần phân tích nguyên nhân lặp lại, kết quả đóng và độ hữu ích của cảnh báo. | Hỗ trợ cải tiến quy trình và điều chỉnh quy tắc cảnh báo ở giai đoạn tiếp theo. |

## 4. Phạm vi Dashboard giai đoạn đầu

### 4.1. Kết quả giao hàng — DBR-01, DBR-05

Hiển thị tỷ lệ giao đúng cam kết ban đầu, số đơn giao trễ và số đơn đã quá hạn nhưng chưa giao; có thể xem xu hướng theo ngày/tuần và so sánh theo cửa hàng.

**Định nghĩa chỉ số:**

- Tập đơn đánh giá gồm các đơn có hạn giao cam kết ban đầu nằm trong kỳ được chọn và hạn đó đã đến tại thời điểm chốt báo cáo.
- **Tỷ lệ giao đúng hạn** = số đơn đã giao với thời điểm giao thực tế không muộn hơn hạn cam kết ban đầu / tổng số đơn đủ dữ liệu trong tập đánh giá.
- Đơn đã quá hạn và được xác minh là chưa giao vẫn thuộc mẫu số, không được bỏ ra chỉ vì chưa có thời điểm giao thực tế.
- Phân biệt **đã giao trễ** với **quá hạn chưa giao**. Đơn chưa đến hạn chưa được tính vào kết quả đúng hạn của kỳ.
- Đơn thiếu hạn cam kết, đơn được ghi là đã giao nhưng thiếu mốc giao thực tế hợp lệ, hoặc đơn có trạng thái không đáng tin phải được báo riêng; không tự tính là đúng hạn hoặc trễ. Hiển thị số đơn được tính và số đơn bị loại vì thiếu dữ liệu. Đơn thiếu hạn cam kết được thống kê riêng trong phạm vi cửa hàng vì không thể xếp vào kỳ theo hạn giao.
- Luôn dùng hạn cam kết **ban đầu**. ETA hoặc lịch giao điều chỉnh không thay thế mốc này.

**Lý do:** Hoàn tất xử lý sự cố hoặc thống nhất giao trễ với khách không đồng nghĩa đơn đã giao đúng cam kết ban đầu.

### 4.2. Điểm nghẽn theo giai đoạn — DBR-02, DBR-05

Hiển thị số sự cố được phát hiện trong kỳ, phân theo bốn loại đã có trong technical plan:

| Loại sự cố | Câu hỏi cần hỗ trợ |
| --- | --- |
| Kho chưa sẵn sàng gần giờ bàn giao | Chuẩn bị hàng có thường xuyên sát hoặc lỡ lịch không? |
| Quá giờ bàn giao nhưng chưa xuất giao | Khâu bàn giao đang có dấu hiệu nghẽn ở đâu? |
| ETA vượt hạn giao khi đang vận chuyển | Đơn có thường được dự báo giao trễ sau khi xuất giao không? |
| Quá hạn giao nhưng chưa giao | Có bao nhiêu đơn đã phát sinh chậm trễ thực tế? |

- Cho phép xem theo cửa hàng và ngày/tuần.
- Hiển thị cả **số sự cố** và **số đơn có sự cố**. Một đơn có thể có nhiều sự cố; không cộng số sự cố rồi gọi đó là số đơn bị ảnh hưởng.
- Khi so sánh cửa hàng, hiển thị thêm quy mô tập đơn tương ứng. Số sự cố cao có thể do lượng đơn lớn hơn.
- Loại cảnh báo cho biết nơi xuất hiện dấu hiệu vấn đề, chưa chứng minh nguyên nhân gốc. Ví dụ: trễ bàn giao khi kho đã sẵn sàng là cơ sở kiểm tra phối hợp vận chuyển, chưa đủ để kết luận bên nào gây trễ.

### 4.3. Tốc độ phản ứng và xử lý — DBR-03, DBR-04

| Chỉ số | Định nghĩa kinh doanh |
| --- | --- |
| **Thời gian tiếp nhận** | Từ lúc phát hiện sự cố đến lúc người phụ trách xác nhận nhận việc. Gửi thông báo hoặc tự gán tên không được tính là đã tiếp nhận. |
| **Thời gian xử lý** | Từ lúc tiếp nhận đến lúc đóng sự cố. Cần đọc cùng kết quả đóng khi dữ liệu đó đã có. |
| **Sự cố chưa tiếp nhận** | Sự cố đang ở trạng thái Mới tại thời điểm chốt báo cáo. |
| **Sự cố còn mở** | Sự cố đang ở trạng thái Mới hoặc Đang xử lý tại thời điểm chốt báo cáo. |
| **Tuổi sự cố còn mở** | Khoảng thời gian từ khi phát hiện đến thời điểm chốt báo cáo. |

- Giai đoạn đầu dùng **trung vị** cho thời gian tiếp nhận và xử lý, kèm số sự cố có đủ mốc để tính. Nếu chưa có mẫu phù hợp, hiển thị “Chưa đủ dữ liệu”.
- Các chỉ số thời gian dùng tập sự cố được phát hiện trong kỳ; tính đến thời điểm chốt báo cáo. Hiển thị cả số sự cố trong tập này còn chờ nhận/chưa đóng để tránh kết luận tốt chỉ từ những sự cố đã hoàn tất.
- Khối tồn đọng hiện tại tính mọi sự cố còn mở trong phạm vi cửa hàng, kể cả phát hiện trước kỳ được chọn; phải ghi rõ đây là số liệu tại thời điểm chốt, khác với tập sự cố phát hiện trong kỳ.
- Có danh sách sự cố mở lâu nhất, kèm đơn hàng, cửa hàng, trạng thái và người phụ trách để mở chi tiết.
- Chưa đặt mục tiêu SLA hoặc ngưỡng “xử lý chậm” khi chưa thống nhất với vận hành. Không tự tạo xếp hạng hiệu suất cá nhân từ các số liệu này.

### 4.4. Bộ lọc, kiểm tra số liệu và chất lượng dữ liệu — DBR-06, DBR-07

- Bộ lọc chung: khoảng thời gian và cửa hàng; phân tích sự cố có thêm loại sự cố và trạng thái khi phù hợp.
- Mỗi phần ghi rõ cơ sở thời gian: kết quả giao hàng theo **hạn giao ban đầu**, sự cố mới theo **thời điểm phát hiện**, tồn đọng theo **thời điểm chốt**.
- Từ một chỉ số hoặc biểu đồ, người dùng mở được danh sách đơn/sự cố tương ứng; số bản ghi và phạm vi quyền phải khớp số liệu tổng hợp.
- Hiển thị thời điểm chốt báo cáo, thời điểm đánh giá rủi ro gần nhất và số đơn có dữ liệu thiếu/cũ, chưa kiểm tra hoặc cần xác minh. Các nhóm này có thể chồng lấp nên không cộng thành tổng nếu chưa loại trùng.
- Làm mới Dashboard không được hiểu là hệ thống đã chạy lại quy tắc phát hiện rủi ro. Demo hiện chỉ đánh giá khi coordinator bấm “Kiểm tra rủi ro”.
- Không có dữ liệu phải hiển thị rõ; không dùng số 0 để thay cho dữ liệu chưa có hoặc không đủ tin cậy.
- Các cửa hàng được so sánh trên cùng định nghĩa chỉ số và mốc chốt. Ngày/tuần báo cáo theo giờ địa phương Sweden.

## 5. Phân tích mở rộng sau giai đoạn đầu — DBR-08

| Phân tích | Dữ liệu kinh doanh cần bổ sung | Mục đích |
| --- | --- | --- |
| **Nguyên nhân lặp lại** | Nhóm nguyên nhân được người xử lý xác nhận khi đóng, kèm ghi chú/bằng chứng. | Xác định vấn đề quy trình cần giải quyết tận gốc. |
| **Kết quả xử lý** | Phân biệt Đã khắc phục rủi ro / Đã thống nhất phương án giao trễ / Cảnh báo không chính xác. | Tránh coi mọi sự cố đã đóng là một lần khắc phục thành công. |
| **Độ hữu ích của cảnh báo** | Xác nhận cảnh báo sai, lý do và kết quả xử lý. | Rà soát cảnh báo gây nhiễu; việc rule về CLEAR không tự chứng minh cảnh báo trước đó sai. |
| **Khoảng thời gian còn lại để can thiệp** | Thời điểm phát hiện và mốc bàn giao/hạn giao liên quan tại lúc phát hiện. | Đánh giá cảnh báo có xuất hiện đủ sớm để hành động không. |

Không suy ra các nhóm này chỉ từ ghi chú tự do hoặc từ loại rule. Các trường hợp chưa được xác nhận phải hiển thị riêng.

## 6. Đánh giá hiệu quả pilot

- So sánh tỷ lệ giao đúng hạn, thời gian tiếp nhận, thời gian xử lý và tồn đọng với giai đoạn trước pilot hoặc nhóm đơn tương đồng khi có dữ liệu phù hợp.
- Hiển thị quy mô mẫu, độ đầy đủ dữ liệu và khác biệt phạm vi giữa các kỳ. Chưa có baseline thì chỉ báo cáo hiện trạng/xu hướng, không khẳng định mức cải thiện so với trước pilot.
- Mục tiêu định lượng cần được thống nhất với vận hành sau khi có baseline; tài liệu này chưa tự đặt tỷ lệ cải thiện hoặc SLA.
- Xu hướng tốt lên là bằng chứng hỗ trợ đánh giá, chưa đủ để kết luận Dashboard hoặc cảnh báo là nguyên nhân duy nhất tạo ra thay đổi.
- Tập 5–10 đơn tổng hợp chỉ dùng trình diễn cách đọc số liệu và luồng xem chi tiết; không dùng để kết luận hiệu quả kinh doanh thực tế.

## 7. Ngoài phạm vi giai đoạn đầu

- Dự báo bằng AI, tối ưu tuyến giao hàng hoặc phân bổ nguồn lực tự động.
- Phân tích doanh thu, lợi nhuận, mức hài lòng khách hàng khi chưa có nguồn dữ liệu tương ứng.
- Báo cáo tùy biến, công cụ BI tổng quát và mở rộng sang Denmark/Norway.
- Thao tác nhận việc, ghi chú hoặc đóng sự cố trực tiếp trên Dashboard; các thao tác này tiếp tục ở hồ sơ sự cố.
- Giám sát hạ tầng như CPU, API latency hoặc database health; đó là nhu cầu vận hành kỹ thuật riêng.

## 8. Điều kiện nghiệm thu nghiệp vụ

- [ ] Người dùng xem được ba nhóm phân tích chính: kết quả giao hàng, điểm nghẽn và tốc độ tiếp nhận/xử lý.
- [ ] Mỗi chỉ số có định nghĩa, kỳ tính, thời điểm chốt và quy mô mẫu rõ ràng.
- [ ] Số liệu giao đúng hạn dùng cam kết ban đầu; đơn quá hạn chưa giao không bị bỏ khỏi mẫu số khi đủ dữ liệu xác minh.
- [ ] Một đơn có nhiều sự cố không làm tăng sai số đơn bị ảnh hưởng.
- [ ] Tồn đọng hiện tại được phân biệt rõ với số sự cố phát hiện trong kỳ.
- [ ] Bộ lọc và danh sách chi tiết khớp số liệu tổng hợp, tuân thủ phạm vi cửa hàng được phép xem.
- [ ] Dữ liệu thiếu/cũ, chưa kiểm tra và mẫu chưa đủ được trình bày rõ; không hiển thị như kết quả tốt.
- [ ] Người xem không nhầm sự cố đã đóng với đơn đã giao thành công hoặc giao đúng hạn.
- [ ] So sánh các kỳ chỉ sử dụng định nghĩa tương đương; thiếu baseline được ghi rõ.

## 9. Quan hệ với kế hoạch triển khai hiện tại

Đây là phạm vi nghiệp vụ bổ sung cho **một trang Dashboard riêng**. Technical plan hiện mới có ba số đếm và lịch sử từng hồ sơ, chưa đáp ứng đầy đủ các yêu cầu phân tích trên.

Ưu tiên triển khai DBR-01 đến DBR-07 sau khi luồng xử lý sự cố cốt lõi chạy ổn; DBR-08 là giai đoạn tiếp theo khi đã thu thập đủ dữ liệu có cấu trúc. Nếu đưa Dashboard vào cùng demo hai dev/ba ngày, cần cập nhật lại phạm vi và lịch thực hiện thay vì mặc định coi đây là phần việc đã có trong technical plan.
