"""Four pure rules: no database access or internal clock reads."""

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
        raise ValueError("now must include a timezone.")

    def result(code, status="CLEAR", reason="No alerts.", alert=None):
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
        return all_results("UNKNOWN", "Delivery status is unknown.")
    dispatched, delivered = order.dispatched_at, order.delivered_at
    if stage == DeliveryStatus.DELIVERED:
        if aware(dispatched) and aware(delivered) and dispatched <= delivered <= now:
            return all_results("CLEAR", "The order has been delivered; no active alerts remain.")
        return all_results("UNKNOWN", "Dispatch or delivery timestamps are missing or inconsistent.")

    verified = order.data_verified_at
    if not aware(verified) or not timedelta(0) <= now - verified <= timedelta(
        minutes=max_age_minutes
    ):
        return all_results("UNKNOWN", "Status is unverified, future-dated, or out of date.")
    if stage == DeliveryStatus.NOT_DISPATCHED and (dispatched is not None or delivered is not None):
        return all_results("UNKNOWN", "The not-dispatched status conflicts with actual timestamps.")
    if stage == DeliveryStatus.DISPATCHED and (
        not aware(dispatched) or dispatched > now or delivered is not None
    ):
        return all_results("UNKNOWN", "The in-transit status conflicts with actual timestamps.")

    warehouse_code, handover_code, eta_code, overdue_code = RiskCode
    warehouse = result(warehouse_code, reason="The warehouse rule does not apply at this stage.")
    handover = result(handover_code, reason="The handover rule does not apply at this stage.")
    if stage == DeliveryStatus.NOT_DISPATCHED:
        planned = order.planned_handover_at
        if not aware(planned):
            warehouse = result(warehouse_code, "UNKNOWN", "A valid handover time is missing.")
            handover = result(handover_code, "UNKNOWN", "A valid handover time is missing.")
        else:
            if planned - timedelta(minutes=handover_warning_minutes) <= now <= planned:
                if order.warehouse_status == WarehouseStatus.NOT_READY:
                    warehouse = result(
                        warehouse_code,
                        "AT_RISK",
                        "The warehouse is not ready as handover time approaches.",
                        AlertType.RISK,
                    )
                elif order.warehouse_status == WarehouseStatus.READY:
                    warehouse = result(warehouse_code, reason="The warehouse is ready.")
                else:
                    warehouse = result(warehouse_code, "UNKNOWN", "Warehouse status needs verification.")
            else:
                warehouse = result(warehouse_code, reason="Outside the pre-handover warning window.")
            handover = (
                result(
                    handover_code, "AT_RISK", "The handover deadline has passed, but the order has not been handed over.", AlertType.DELAYED
                )
                if now > planned
                else result(handover_code, reason="The handover deadline has not passed.")
            )

    due = order.original_delivery_due_at
    eta = result(eta_code, reason="The ETA rule does not apply before dispatch.")
    if not aware(due):
        overdue = result(overdue_code, "UNKNOWN", "A valid promised delivery deadline is missing.")
        if stage == DeliveryStatus.DISPATCHED:
            eta = result(eta_code, "UNKNOWN", "A valid promised delivery deadline is missing.")
    elif now > due:
        overdue = result(
            overdue_code, "AT_RISK", "The delivery deadline has passed, but delivery is not complete.", AlertType.DELAYED
        )
        if stage == DeliveryStatus.DISPATCHED:
            eta = result(eta_code, reason="The delivery deadline has passed; the overdue delivery alert applies.")
    else:
        overdue = result(overdue_code, reason="The delivery deadline has not passed.")
        if stage == DeliveryStatus.DISPATCHED:
            estimated = order.estimated_delivery_at
            if not aware(estimated) or estimated < now:
                eta = result(
                    eta_code, "UNKNOWN", "The ETA is missing, invalid, or in the past."
                )
            elif estimated > due:
                eta = result(
                    eta_code, "AT_RISK", "Estimated delivery is later than the promised deadline.", AlertType.RISK
                )
            else:
                eta = result(eta_code, reason="The ETA is within the delivery deadline.")
    return [warehouse, handover, eta, overdue]


def summarize(assessments: list[RuleAssessment]) -> tuple[RiskStatus, str | None]:
    for status in (RiskStatus.AT_RISK, RiskStatus.UNKNOWN):
        reasons = [item.reason for item in assessments if item.status == status]
        if reasons:
            return status, " ".join(dict.fromkeys(reasons))
    return RiskStatus.CLEAR, None
