"""English display text for known system-generated records saved before the language change."""

import re

_SYSTEM_MESSAGES = {
    "Không có cảnh báo.": "No alerts.",
    "Chưa xác định trạng thái giao hàng.": "Delivery status is unknown.",
    "Mốc xuất giao/giao thực tế thiếu hoặc mâu thuẫn.": "Dispatch or delivery timestamps are missing or inconsistent.",
    "Trạng thái chưa xác minh, ở tương lai hoặc đã cũ.": "Status is unverified, future-dated, or out of date.",
    "Trạng thái chưa xuất giao mâu thuẫn mốc thực tế.": "The not-dispatched status conflicts with actual timestamps.",
    "Trạng thái đang vận chuyển mâu thuẫn mốc thực tế.": "The in-transit status conflicts with actual timestamps.",
    "Rule kho không áp dụng ở giai đoạn này.": "The warehouse rule does not apply at this stage.",
    "Rule bàn giao không áp dụng ở giai đoạn này.": "The handover rule does not apply at this stage.",
    "Rule ETA không áp dụng khi chưa xuất giao.": "The ETA rule does not apply before dispatch.",
    "Thiếu hạn giao cam kết hợp lệ.": "A valid promised delivery deadline is missing.",
    "Đơn đã giao xong; không còn cảnh báo hiệu lực.": "The order has been delivered; no active alerts remain.",
    "Thiếu giờ bàn giao hợp lệ.": "A valid handover time is missing.",
    "Đã quá hạn giao nhưng chưa giao xong.": "The delivery deadline has passed, but delivery is not complete.",
    "Đã quá giờ nhưng chưa bàn giao.": "The handover deadline has passed, but the order has not been handed over.",
    "Chưa quá hạn giao.": "The delivery deadline has not passed.",
    "Kho chưa sẵn sàng gần giờ bàn giao.": "The warehouse is not ready as handover time approaches.",
    "Ngoài khoảng cảnh báo trước bàn giao.": "Outside the pre-handover warning window.",
    "Chưa quá giờ bàn giao.": "The handover deadline has not passed.",
    "Đã quá hạn; dùng cảnh báo quá hạn giao.": "The delivery deadline has passed; the overdue delivery alert applies.",
    "ETA thiếu, không hợp lệ hoặc đã nằm trong quá khứ.": "The ETA is missing, invalid, or in the past.",
    "Cần xác minh trạng thái kho.": "Warehouse status needs verification.",
    "Dự kiến giao trễ hơn hạn cam kết.": "Estimated delivery is later than the promised deadline.",
    "Kho đã sẵn sàng.": "The warehouse is ready.",
    "ETA không vượt hạn giao.": "The ETA is within the delivery deadline.",
    "Dữ liệu mô phỏng: shipper gặp kẹt xe, dự kiến giao muộn hơn hạn cam kết 60 phút.": "Demo scenario: the carrier is delayed by traffic; delivery is expected 60 minutes after the promised deadline."
}

DEMO_CUSTOMER_REFERENCES = {
    "Khách demo 11 — shipper gặp kẹt xe": "Demo customer 11 — carrier delayed by traffic",
    "Khách demo 12 — kho chưa sẵn sàng, chưa đến ngưỡng cảnh báo": "Demo customer 12 — warehouse not ready, outside the warning window"
}

_SYSTEM_PATTERN = re.compile(
    "|".join(re.escape(text) for text in sorted(_SYSTEM_MESSAGES, key=len, reverse=True))
)


def english_system_message(value: str) -> str:
    return _SYSTEM_PATTERN.sub(lambda match: _SYSTEM_MESSAGES[match.group(0)], value)


def english_ownership_message(value: str) -> str:
    suffix = " nhận xử lý sự cố."
    if value.endswith(suffix):
        return value[:-len(suffix)] + " took ownership of the incident."
    return value
