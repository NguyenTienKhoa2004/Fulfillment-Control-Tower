# Business Analysis & Requirements Document

## 1. Problem Statement

### 1.1. Business Problem: Unreliable Order Fulfilment in Sweden

#### Business Context

Company A là doanh nghiệp bán lẻ vật liệu xây dựng hoạt động tại Denmark, Norway và Sweden, phục vụ cả khách hàng **B2B** và **B2C**. Theo case study, doanh nghiệp đang gặp những thách thức trong hoạt động quản lý đơn hàng và giao hàng, có thể ảnh hưởng đến hiệu quả vận hành và độ tin cậy trong việc phục vụ khách hàng.

#### Problem Statement

Công ty A đang đối mặt với những thách thức trong việc thực hiện đơn hàng, điều này có thể ảnh hưởng đến độ tin cậy giao hàng và hiệu quả hoạt động tại Thụy Điển.

Chúng tôi đưa ra giả thuyết rằng việc thiếu khả năng theo dõi đơn hàng từ đầu đến cuối và việc phát hiện lỗi chậm trễ góp phần gây ra những thách thức này, làm giảm khả năng chủ động giải quyết các vấn đề trong quá trình thực hiện đơn hàng của nhân viên.

#### Business Opportunity

Nâng cao độ tin cậy trong việc thực hiện đơn hàng bằng cách cho phép xác định và giải quyết sớm các vấn đề liên quan đến giao hàng.

#### Vấn đề team tập trung giải quyết

Cải thiện khả năng phát hiện, theo dõi và phối hợp xử lý những đơn hàng có nguy cơ giao trễ, từ lúc đơn hàng được xác nhận đến khi giao thành công.

## Stakeholders & Pain Points

Stakeholder :Customers (**B2B** & **B2C**) Potential Pain Points : Khó nắm trạng thái đơn hàng, có thể nhận hàng trễ hoặc thiếu Business Consequences: Giảm sự hài lòng, gián đoạn dự án xây dựng, giảm khả năng mua lại

Stakeholder : Store Staff Potential Pain Points : Phải kiểm tra thông tin qua nhiều hệ thống hoặc liên hệ các bộ phận Business Consequences: Tốn thời gian, phản hồi khách hàng chậm

Stakeholder : Warehouse / ### Fulfilment Staff Potential Pain Points:Khó xác định đơn hàng cần ưu tiên và đơn hàng có vấn đề Business Consequences: Chậm xử lý, tăng công việc thủ công

Stakeholder : Logistics Team Potential Pain Points : Thiếu thông tin cập nhật về tình trạng chuẩn bị và giao hàng Business Consequences: Khó phối hợp, nguy cơ giao hàng không đúng kế hoạch

### Key Insight

Order fulfilment không chỉ ảnh hưởng đến khách hàng mà còn liên quan đến nhiều bộ phận nội bộ. Do đó, việc phát hiện và phối hợp xử lý các sự cố đơn hàng có thể tạo ra giá trị ở cả hai khía cạnh: Customer Value: Cải thiện độ tin cậy giao hàng. Operational Value: Giảm thời gian kiểm tra và phối hợp xử lý thủ công.

## 3. Root Cause Hypotheses

| ID | Root Cause Hypothesis | Validation Method |
| --- | --- | --- |
| H1 | Dữ liệu đơn hàng, kho và giao hàng không được đồng bộ kịp thời | System mapping, đo độ trễ cập nhật dữ liệu |
| H2 | Nhân viên phụ thuộc nhiều vào thao tác thủ công | Workflow observation, staff interviews |
| H3 | Cơ chế phát hiện sớm các đơn hàng có nguy cơ giao trễ còn hạn chế | Review exception detection workflow hiện tại |
| H4 | Các bộ phận thiếu một nguồn thông tin thống nhất về trạng thái đơn hàng | Stakeholder interviews, đối chiếu dữ liệu giữa hệ thống |

## 4. Business Impact & Prioritisation

### 4.1. Potential Business Impact

| Business Dimension | Potential Impact |
| --- | --- |
| **Revenue & Customer Retention** | Giao hàng không đáng tin cậy có thể làm giảm repeat purchases và khiến khách hàng chuyển sang đối thủ |
| **Operational Cost** | Tăng thời gian kiểm tra đơn hàng, xử lý sự cố và hoạt động giao lại |
| **Customer Experience** | Thông tin thiếu minh bạch có thể làm tăng khiếu nại và yêu cầu cập nhật |
| **Operational Efficiency** | Nhân viên dành nhiều thời gian cho các thao tác kiểm tra và phối hợp thủ công |
| **Business Scalability** | Quy trình fulfilment thiếu nhất quán có thể gây khó khăn khi mở rộng cải tiến sang thị trường khác |

## 5. Business Requirements

| ID | Business Requirement | Tác động đến Company A |
| --- | --- | --- |
| BR-01 | Employees need to access reliable order fulfilment status information across relevant existing systems. | Giảm thời gian nhân viên tìm kiếm và đối chiếu thông tin đơn hàng giữa nhiều hệ thống. |
| BR-02 | Employees need to identify orders at risk of late delivery early enough to take corrective action. | Phát hiện nguy cơ giao trễ sớm, tạo cơ hội can thiệp trước khi ảnh hưởng đến khách hàng. |
| BR-03 | Relevant staff need to be informed when a fulfilment issue requires intervention. | Giảm thời gian phản ứng với sự cố, tránh việc nhân viên không biết có vấn đề xảy ra. |
| BR-04 | Employees need to coordinate, assign responsibility, and track the resolution of fulfilment exceptions. | Cải thiện phối hợp giữa các bộ phận, giảm tình trạng sự cố bị bỏ sót hoặc không ai chịu trách nhiệm. |
| BR-05 | Operations managers need to measure exception detection, response, and resolution performance. | Giúp quản lý đánh giá hiệu quả vận hành và xác định các điểm nghẽn cần cải thiện. |
| BR-06 | The business needs access to historical exception information to identify recurring operational issues. | Giúp doanh nghiệp xác định những nguyên nhân sự cố thường xuyên xảy ra để cải tiến quy trình. |
| BR-07 | The solution should support different local workflows and business rules if expanded to other markets. | Giảm công sức xây dựng lại giải pháp khi mở rộng sang Denmark và Norway. |

## 6. MVP Feature Scope & Role Participation

### 6.1. Mục tiêu và trách nhiệm của từng vai trò

MVP hỗ trợ một luồng phối hợp chung: phát hiện đơn hàng có nguy cơ giao trễ, xác minh vấn đề, phân công xử lý và theo dõi kết quả. Logistics Coordinator và Store Staff cùng sử dụng một hồ sơ sự cố để giảm việc hỏi lại và chuyển thông tin giữa các bộ phận.

| Vai trò | Trách nhiệm chính trong MVP |
| --- | --- |
| **Logistics Coordinator** | Tiếp nhận cảnh báo, xác minh với kho hoặc bên vận chuyển, điều phối hành động, cập nhật phương án và đóng sự cố khi đủ điều kiện. |
| **Store Staff** | Theo dõi các đơn của cửa hàng, bổ sung thông tin từ khách hàng, thực hiện yêu cầu liên hệ khách và ghi nhận kết quả trao đổi. |
| **Warehouse Staff / bên vận chuyển** | Thực hiện công việc chuẩn bị hoặc giao hàng qua quy trình hiện có. Logistics Coordinator theo dõi xác nhận từ các bên này trong hồ sơ sự cố. Phần này chưa thiết kế một giao diện làm việc riêng cho họ. |

**Giả định thiết kế:** Logistics Coordinator là người chịu trách nhiệm chính về điều phối sự cố trong pilot. Cần xác minh quyền hạn và trách nhiệm thực tế trước khi triển khai. Nếu quyền điều phối thuộc cửa hàng, cần điều chỉnh vai trò chủ trì tương ứng.

Mỗi sự cố có một người chịu trách nhiệm chính; người phối hợp có thể thuộc cửa hàng, kho hoặc vận chuyển. Một đơn có thể có nhiều nguyên nhân rủi ro, nhưng hệ thống không tạo thêm hồ sơ đang mở cho cùng một đơn và cùng một nguyên nhân chỉ vì nhận lại dữ liệu giống nhau.

### 6.2. Thiết kế 5 chức năng MVP

#### 6.2.1. Danh sách và chi tiết đơn hàng có nguy cơ

**Mục đích:** Giúp cả hai vai trò hiểu vấn đề và biết ai đang xử lý mà không phải tra cứu nhiều nơi. Liên kết với **BR-01**.

| Nội dung | Thiết kế tối thiểu |
| --- | --- |
| **Thông tin dùng chung** | Mã đơn, cửa hàng, thời điểm giao đã cam kết ban đầu, trạng thái chuẩn bị hàng và vận chuyển, lý do cảnh báo, mốc cần can thiệp, người phụ trách, trạng thái sự cố và thời điểm cập nhật dữ liệu. |
| **Logistics Coordinator** | Xem các đơn thuộc phạm vi điều phối trong pilot; lọc theo mốc cần can thiệp, loại rủi ro, trạng thái và người phụ trách. Mở chi tiết để tiếp nhận hoặc cập nhật xử lý. |
| **Store Staff** | Xem các đơn thuộc cửa hàng mình phụ trách; tìm theo mã đơn và lọc theo trạng thái sự cố. Mở chi tiết để nắm tiến độ, bổ sung thông tin hoặc phản hồi khách hàng. |
| **Chi tiết sự cố** | Hiển thị lịch sử trao đổi, hành động tiếp theo, người cần thực hiện và phương án xử lý. Phương án cần ghi rõ đang đề xuất hay đã được xác nhận, ai xác nhận và thời điểm xác nhận. |

Trạng thái đơn hàng lấy từ các hệ thống hiện có; trạng thái xử lý sự cố được quản lý trong MVP. Hai loại trạng thái được hiển thị riêng. Khi dữ liệu thiếu hoặc quá cũ, hiển thị **Cần xác minh**; không kết luận đơn an toàn chỉ vì chưa có dữ liệu cảnh báo.

#### 6.2.2. Phát hiện nguy cơ giao trễ

**Mục đích:** Nhận biết vấn đề khi vẫn còn thời gian can thiệp. Liên kết với **BR-02**.

- **Hệ thống:** Áp dụng một số quy tắc đơn giản dựa trên dữ liệu có thể truy cập. Ví dụ: đơn chưa sẵn sàng xuất kho khi chỉ còn một khoảng thời gian xác định trước hạn bàn giao vận chuyển. Ngưỡng cảnh báo phải được thống nhất với nhóm vận hành trong pilot.
- **Logistics Coordinator:** Kiểm tra cảnh báo, xác minh tình trạng thực tế và xác định hành động cần thực hiện. Nếu cảnh báo không chính xác, ghi nhận lý do để rà soát quy tắc hoặc chất lượng dữ liệu.
- **Store Staff:** Xem cùng lý do cảnh báo; bổ sung thông tin liên quan như khách đổi yêu cầu nhận hàng, địa chỉ cần xác nhận hoặc dấu hiệu rủi ro chưa được phản ánh trong dữ liệu.

Nhân viên không tự sửa quy tắc cảnh báo trong luồng xử lý hằng ngày. Cảnh báo tự động chỉ hoạt động với quy tắc đã có đủ dữ liệu và được xác nhận phù hợp với vận hành; trường hợp thiếu dữ liệu được chuyển cho nhóm logistics kiểm tra.

#### 6.2.3. Thông báo sự cố

**Mục đích:** Đưa thông tin đến đúng người cần hành động hoặc cần cập nhật. MVP sử dụng thông báo trong ứng dụng, dẫn đến hồ sơ sự cố chung. Liên kết với **BR-03**.

| Sự kiện | Logistics Coordinator | Store Staff |
| --- | --- | --- |
| **Phát hiện rủi ro mới** | Nhóm logistics phụ trách nhận yêu cầu tiếp nhận. Nếu chưa có người nhận, sự cố vẫn xuất hiện trong danh sách chưa phân công. | Cửa hàng liên quan nhận thông tin để nắm tình trạng đơn. |
| **Giao hoặc chuyển người phụ trách** | Người được giao nhận thông báo cần xử lý. | Xem người phụ trách mới trong hồ sơ chung. |
| **Cần xác nhận từ khách hàng** | Người phụ trách theo dõi yêu cầu đang chờ phản hồi. | Cửa hàng nhận yêu cầu cụ thể: cần hỏi gì và vì sao cần xác nhận. |
| **Store Staff bổ sung kết quả trao đổi** | Người phụ trách nhận thông báo để tiếp tục xử lý. | Kết quả được lưu vào lịch sử chung. |
| **Phương án được xác nhận hoặc sự cố được đóng** | Người phụ trách và người phối hợp liên quan được cập nhật. | Cửa hàng nhận thông tin để phản hồi khách hàng khi cần. |

Không gửi lại cảnh báo chỉ vì dữ liệu không đổi. Các ghi chú thông thường được lưu trong lịch sử; chỉ thông báo khi phát sinh yêu cầu hành động hoặc thay đổi quan trọng.

#### 6.2.4. Phân công và theo dõi xử lý

**Mục đích:** Mỗi sự cố có người chịu trách nhiệm và hành động tiếp theo rõ ràng. Liên kết với **BR-04**.

| Thao tác | Logistics Coordinator | Store Staff |
| --- | --- | --- |
| **Tiếp nhận và phân công** | Nhận xử lý hoặc phân công cho coordinator phù hợp trong phạm vi phụ trách; ghi nhận người chịu trách nhiệm chính. | Xem người phụ trách; gửi yêu cầu hỗ trợ vào hồ sơ hiện có. |
| **Điều phối công việc** | Ghi hành động tiếp theo, phối hợp với kho hoặc vận chuyển, yêu cầu cửa hàng xác minh thông tin khách hàng khi cần. | Bổ sung thông tin, liên hệ khách và phản hồi kết quả yêu cầu được giao. |
| **Cập nhật phương án** | Ghi phương án đề xuất và xác nhận phương án vận hành sau khi được bên thực hiện xác nhận. | Ghi nhận khách đã được thông báo, đồng ý hoặc cần phương án khác. |
| **Đóng hoặc mở lại sự cố** | Đóng khi hoàn tất hành động cần thiết; mở lại nếu phát hiện vấn đề chưa được xử lý. | Yêu cầu người phụ trách kiểm tra lại nếu thông tin từ khách cho thấy vấn đề còn tồn tại. |

Trạng thái sự cố gồm:

| Trạng thái | Điều kiện |
| --- | --- |
| **Mới** | Vừa được phát hiện, chưa có người tiếp nhận xử lý. |
| **Đang xử lý** | Có người chịu trách nhiệm đã tiếp nhận; hiển thị hành động tiếp theo và đang chờ ai nếu có. |
| **Đã đóng** | Người phụ trách ghi nguyên nhân, hành động đã thực hiện, bằng chứng xác nhận và kết quả; không còn hành động cần thiết đang chờ xử lý trong sự cố. |

Kết quả đóng cần phân biệt **Đã khắc phục rủi ro**, **Đã thống nhất phương án giao trễ** và **Cảnh báo không chính xác**. Nếu phương án cần khách chấp thuận, Store Staff phải ghi nhận kết quả xác nhận trước khi đóng. Trường hợp chưa thể khắc phục hoặc chưa thống nhất phương án tiếp tục ở trạng thái **Đang xử lý**.

Việc đóng sự cố không đồng nghĩa đơn đã giao thành công. Thời điểm giao cam kết ban đầu được giữ làm mốc đánh giá; nếu lịch giao thay đổi, ghi nhận riêng lịch mới. Các thay đổi đối với đơn, kho hoặc vận chuyển vẫn được thực hiện trong hệ thống hiện có.

#### 6.2.5. Lịch sử và đo lường cơ bản

**Mục đích:** Giúp nhân viên tiếp nối xử lý và giúp quản lý đánh giá hiệu quả pilot. Liên kết với **BR-05** và **BR-06**.

- **Lịch sử dùng chung:** Lưu thời điểm phát hiện, tiếp nhận, chuyển người phụ trách, thay đổi trạng thái, ghi chú, phương án được xác nhận, kết quả liên hệ khách và kết quả đóng. Mỗi cập nhật có người thực hiện và thời điểm.
- **Logistics Coordinator:** Xem lịch sử để tiếp nối công việc, kiểm tra sự cố còn mở và theo dõi thời gian xử lý trong phạm vi phụ trách.
- **Store Staff:** Xem lịch sử đơn của cửa hàng, biết khách đã được trao đổi những gì và cập nhật tiếp khi cần; ghi nhận nội dung phản hồi khách hàng qua kênh hiện có.
- **Operations Manager:** Xem tổng hợp cơ bản theo thời gian và phạm vi pilot; chưa cần báo cáo nâng cao hoặc một luồng làm việc riêng trong MVP.

| Chỉ số | Cách hiểu trong MVP |
| --- | --- |
| **Số sự cố còn mở** | Số hồ sơ ở trạng thái Mới hoặc Đang xử lý, có thể xem theo cửa hàng hoặc người phụ trách. |
| **Thời gian tiếp nhận** | Khoảng thời gian từ khi phát hiện đến khi người phụ trách xác nhận tiếp nhận. Việc hệ thống gửi thông báo không được tính là đã tiếp nhận. |
| **Thời gian xử lý** | Khoảng thời gian từ khi tiếp nhận đến khi đóng; xem kèm kết quả đóng để phân biệt khắc phục thành công, thống nhất giao trễ và cảnh báo sai. |
| **Tỷ lệ giao đúng cam kết ban đầu** | Đối chiếu thời điểm giao thực tế với thời điểm đã cam kết ban đầu trên tập đơn có đủ dữ liệu. Các đơn thiếu dữ liệu được báo riêng. |

Các chỉ số được so sánh với dữ liệu trước pilot hoặc nhóm đơn tương đồng khi có thể. Số cảnh báo đã đóng là chỉ số hoạt động; kết quả giao hàng và thời gian phối hợp mới giúp đánh giá lợi ích thực tế.

### 6.3. User Journey chung: Xử lý đơn hàng có nguy cơ lỡ lịch bàn giao

**Tình huống minh họa:** Đơn hàng gần đến hạn bàn giao vận chuyển nhưng chưa được xác nhận sẵn sàng xuất kho. Logistics Coordinator là người chủ trì, Store Staff phối hợp khi cần thông tin hoặc xác nhận từ khách hàng.

| Bước | Hệ thống | Logistics Coordinator | Store Staff |
| --- | --- | --- | --- |
| **1. Phát hiện** | Tạo hồ sơ sự cố, hiển thị lý do và mốc cần can thiệp; thông báo cho logistics và cửa hàng liên quan. | Nhìn thấy đơn trong danh sách cần tiếp nhận. | Biết đơn của cửa hàng đang có nguy cơ trễ. |
| **2. Tiếp nhận và xác minh** | Lưu người phụ trách và thời điểm tiếp nhận. | Kiểm tra dữ liệu, xác minh với kho và xác định nguyên nhân. | Bổ sung thông tin khách hàng nếu có. |
| **3. Điều phối xử lý** | Hiển thị trạng thái Đang xử lý, hành động tiếp theo và người cần phối hợp. | Phối hợp kho ưu tiên chuẩn bị hàng; kiểm tra khả năng bàn giao theo lịch hiện có. | Theo dõi tiến độ; hỗ trợ xác minh thông tin theo yêu cầu. |
| **4. Thống nhất phương án** | Hiển thị rõ phương án đang đề xuất hay đã xác nhận. | Xác nhận khả năng thực hiện với kho và vận chuyển. Nếu cần đổi lịch, yêu cầu cửa hàng liên hệ khách. | Nếu cần, liên hệ khách qua kênh hiện có và ghi nhận đồng ý hoặc đề nghị khác. |
| **5. Cập nhật khách hàng** | Lưu thông tin vận hành và kết quả trao đổi trong cùng hồ sơ. | Tiếp tục phối hợp nếu khách cần phương án khác. | Phản hồi theo thông tin đã xác nhận và ghi nhận đã cập nhật khách. |
| **6. Đóng và theo dõi kết quả** | Lưu kết quả đóng, cập nhật đo lường; tiếp tục hiển thị trạng thái giao hàng từ hệ thống nguồn. | Đóng khi đủ điều kiện; tiếp tục xử lý nếu chưa có phương án hoàn tất. | Xem kết quả, tiếp tục hỗ trợ khách khi có cập nhật mới; yêu cầu kiểm tra lại nếu vấn đề tái xuất hiện. |

Nếu không cần thông tin hay xác nhận từ khách, Store Staff chỉ theo dõi và cập nhật khách khi phù hợp; không phải phê duyệt mọi bước xử lý. Nếu chưa có ai tiếp nhận hoặc thiếu xác nhận cần thiết, sự cố vẫn hiển thị là còn mở.

## 7. Proposed Scope & Business Constraints

### 7.1. In Scope

- **Initial Market:** Sweden.
- **Focus:** Identify and resolve potential delivery delays early.
- **Target Users:** Store employees, warehouse staff, logistics coordinators.
- **Existing Systems:** Reuse existing order, inventory and delivery systems where feasible.

### 7.2. Out of Scope

- Replacing existing ERP, OMS or WMS.
- Building a new warehouse or logistics management system.
- Redesigning the entire supply chain.
- Deploying simultaneously across all three countries.

### 7.3. Key Constraints

- **Time to Market:** MVP must focus on a limited set of high-value capabilities.
- **Data Availability:** Exception detection depends on accessible and reliable order data.
- **System Integration:** The solution should minimise changes to existing systems.
- **Local Differences:** Future rollout must consider market-specific processes and requirements.

## 8. Key Assumptions

| ID | Giả định chính (Key Assumption) |
| --- | --- |
| A1 | Tình trạng giao hàng trễ là một vấn đề kinh doanh đủ nghiêm trọng tại Thụy Điển. |
| A2 | Việc thiếu khả năng theo dõi và nắm bắt trạng thái đơn hàng góp phần đáng kể gây ra tình trạng giao hàng chậm trễ. |
| A3 | Các hệ thống hiện tại có thể cung cấp dữ liệu cần thiết về đơn hàng và quá trình hoàn tất đơn hàng. |
| A4 | Việc phát hiện sớm các sự cố đơn hàng cho phép nhân viên thực hiện những biện pháp khắc phục hiệu quả. |
| A5 | Việc triển khai thử nghiệm (pilot) với phạm vi tập trung có thể chứng minh những cải thiện trong hiệu quả vận hành thông qua các chỉ số đo lường cụ thể. |
| A6 | Một số chức năng của giải pháp có thể được tái sử dụng tại Đan Mạch và Na Uy. |
