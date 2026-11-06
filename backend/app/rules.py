"""Bốn rule thuần: không đọc DB, không tự đọc đồng hồ."""

from datetime import datetime, timedelta

from app.models import AlertType, DeliveryStatus, Order, RiskCode, RiskStatus, WarehouseStatus
from app.schemas import RuleAssessment


def aware(value: datetime | None) -> bool:
    return isinstance(value, datetime) and value.utcoffset() is not None


def evaluate_order(
    order: Order,
    now: datetime,
    *,
    max_age_minutes: int = 60,
    handover_warning_minutes: int = 120,
) -> list[RuleAssessment]:
    if not aware(now):
        raise ValueError("now phải có timezone.")

    def result(code, status="CLEAR", reason="Không có cảnh báo.", alert=None):
        return RuleAssessment(
            risk_code=code, status=status, reason=reason, alert_type=alert, assessed_at=now
        )

    def all_results(status, reason):
        return [result(code, status, reason) for code in RiskCode]

    stage = order.delivery_status
    if stage not in (
        DeliveryStatus.NOT_DISPATCHED,
        DeliveryStatus.DISPATCHED,
        DeliveryStatus.DELIVERED,
    ):
        return all_results("UNKNOWN", "Chưa xác định trạng thái giao hàng.")
    dispatched, delivered = order.dispatched_at, order.delivered_at
    if stage == DeliveryStatus.DELIVERED:
        if aware(dispatched) and aware(delivered) and dispatched <= delivered <= now:
            return all_results("CLEAR", "Đơn đã giao xong; không còn cảnh báo hiệu lực.")
        return all_results("UNKNOWN", "Mốc xuất giao/giao thực tế thiếu hoặc mâu thuẫn.")

    verified = order.data_verified_at
    if not aware(verified) or not timedelta(0) <= now - verified <= timedelta(
        minutes=max_age_minutes
    ):
        return all_results("UNKNOWN", "Trạng thái chưa xác minh, ở tương lai hoặc đã cũ.")
    if stage == DeliveryStatus.NOT_DISPATCHED and (dispatched is not None or delivered is not None):
        return all_results("UNKNOWN", "Trạng thái chưa xuất giao mâu thuẫn mốc thực tế.")
    if stage == DeliveryStatus.DISPATCHED and (
        not aware(dispatched) or dispatched > now or delivered is not None
    ):
        return all_results("UNKNOWN", "Trạng thái đang vận chuyển mâu thuẫn mốc thực tế.")

    warehouse_code, handover_code, eta_code, overdue_code = RiskCode
    warehouse = result(warehouse_code, reason="Rule kho không áp dụng ở giai đoạn này.")
    handover = result(handover_code, reason="Rule bàn giao không áp dụng ở giai đoạn này.")
    if stage == DeliveryStatus.NOT_DISPATCHED:
        planned = order.planned_handover_at
        if not aware(planned):
            warehouse = result(warehouse_code, "UNKNOWN", "Thiếu giờ bàn giao hợp lệ.")
            handover = result(handover_code, "UNKNOWN", "Thiếu giờ bàn giao hợp lệ.")
        else:
            if planned - timedelta(minutes=handover_warning_minutes) <= now <= planned:
                if order.warehouse_status == WarehouseStatus.NOT_READY:
                    warehouse = result(
                        warehouse_code,
                        "AT_RISK",
                        "Kho chưa sẵn sàng gần giờ bàn giao.",
                        AlertType.RISK,
                    )
                elif order.warehouse_status == WarehouseStatus.READY:
                    warehouse = result(warehouse_code, reason="Kho đã sẵn sàng.")
                else:
                    warehouse = result(warehouse_code, "UNKNOWN", "Cần xác minh trạng thái kho.")
            else:
                warehouse = result(warehouse_code, reason="Ngoài khoảng cảnh báo trước bàn giao.")
            handover = (
                result(
                    handover_code, "AT_RISK", "Đã quá giờ nhưng chưa bàn giao.", AlertType.DELAYED
                )
                if now > planned
                else result(handover_code, reason="Chưa quá giờ bàn giao.")
            )

    due = order.original_delivery_due_at
    eta = result(eta_code, reason="Rule ETA không áp dụng khi chưa xuất giao.")
    if not aware(due):
        overdue = result(overdue_code, "UNKNOWN", "Thiếu hạn giao cam kết hợp lệ.")
        if stage == DeliveryStatus.DISPATCHED:
            eta = result(eta_code, "UNKNOWN", "Thiếu hạn giao cam kết hợp lệ.")
    elif now > due:
        overdue = result(
            overdue_code, "AT_RISK", "Đã quá hạn giao nhưng chưa giao xong.", AlertType.DELAYED
        )
        if stage == DeliveryStatus.DISPATCHED:
            eta = result(eta_code, reason="Đã quá hạn; dùng cảnh báo quá hạn giao.")
    else:
        overdue = result(overdue_code, reason="Chưa quá hạn giao.")
        if stage == DeliveryStatus.DISPATCHED:
            estimated = order.estimated_delivery_at
            if not aware(estimated) or estimated < now:
                eta = result(
                    eta_code, "UNKNOWN", "ETA thiếu, không hợp lệ hoặc đã nằm trong quá khứ."
                )
            elif estimated > due:
                eta = result(
                    eta_code, "AT_RISK", "Dự kiến giao trễ hơn hạn cam kết.", AlertType.RISK
                )
            else:
                eta = result(eta_code, reason="ETA không vượt hạn giao.")
    return [warehouse, handover, eta, overdue]


def summarize(assessments: list[RuleAssessment]) -> tuple[RiskStatus, str | None]:
    for status in (RiskStatus.AT_RISK, RiskStatus.UNKNOWN):
        reasons = [item.reason for item in assessments if item.status == status]
        if reasons:
            return status, " ".join(dict.fromkeys(reasons))
    return RiskStatus.CLEAR, None
