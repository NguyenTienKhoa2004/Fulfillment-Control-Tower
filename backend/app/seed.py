"""Tạo schema/fixtures local, chạy lại giữ nguyên dữ liệu hiện có."""

import argparse
from datetime import UTC, datetime, timedelta
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import delete, select

from app.config import Settings, get_settings
from app.db import SessionLocal
from app.migrate import upgrade_database
from app.models import (
    AlertType,
    DeliveryStatus,
    EventType,
    Incident,
    IncidentEvent,
    IncidentStatus,
    Order,
    Profile,
    RiskCode,
    Role,
    WarehouseStatus,
)
from app.rules import evaluate_order, summarize

DEMO_NUMBERS = [f"SE-DEMO-{index:03d}" for index in range(1, 12)]
SHIPPER_DELAY_NUMBER = "SE-DEMO-011"


def seed_shipper_delay(db, now: datetime) -> Order:
    existing = db.scalar(select(Order).where(Order.order_number == SHIPPER_DELAY_NUMBER))
    if existing is not None:
        return existing
    order = Order(
        id=uuid5(NAMESPACE_URL, f"netcom/{SHIPPER_DELAY_NUMBER}"),
        order_number=SHIPPER_DELAY_NUMBER,
        store_code="SE01",
        customer_reference="Khách demo 11 — shipper gặp kẹt xe",
        planned_handover_at=now - timedelta(minutes=45),
        original_delivery_due_at=now + timedelta(hours=2),
        estimated_delivery_at=now + timedelta(hours=3),
        dispatched_at=now - timedelta(minutes=30),
        delivered_at=None,
        warehouse_status=WarehouseStatus.READY,
        delivery_status=DeliveryStatus.DISPATCHED,
        data_verified_at=now,
        assessed_at=now,
    )
    assessments = evaluate_order(order, now)
    order.risk_assessments = [item.model_dump(mode="json") for item in assessments]
    order.risk_status, order.risk_reason = summarize(assessments)
    db.add(order)
    db.flush()
    incident = Incident(
        id=uuid5(NAMESPACE_URL, f"netcom/{SHIPPER_DELAY_NUMBER}/DELIVERY_ETA_LATE"),
        order_id=order.id,
        risk_code=RiskCode.DELIVERY_ETA_LATE,
        alert_type=AlertType.RISK,
        status=IncidentStatus.NEW,
        created_at=now,
    )
    db.add(incident)
    db.flush()
    db.add(
        IncidentEvent(
            incident_id=incident.id,
            type=EventType.DETECTED,
            actor_id=None,
            text="Dữ liệu mô phỏng: shipper gặp kẹt xe, dự kiến giao muộn hơn hạn cam kết 60 phút.",
            created_at=now,
        )
    )
    return order


def seed_demo(db, now: datetime, *, reset: bool = False, settings: Settings | None = None) -> None:
    settings = settings or get_settings()
    logistics_id, store_id = settings.demo_profile_ids()
    if logistics_id and logistics_id == store_id:
        raise ValueError("Hai tài khoản demo phải có UUID khác nhau.")
    if reset:
        order_ids = select(Order.id).where(Order.order_number.in_(DEMO_NUMBERS))
        incident_ids = select(Incident.id).where(Incident.order_id.in_(order_ids))
        db.execute(delete(IncidentEvent).where(IncidentEvent.incident_id.in_(incident_ids)))
        db.execute(delete(Incident).where(Incident.order_id.in_(order_ids)))
        db.execute(delete(Order).where(Order.order_number.in_(DEMO_NUMBERS)))
    for profile_id, name, role, store in (
        (logistics_id, "Demo Logistics", Role.LOGISTICS_COORDINATOR, None),
        (store_id, "Demo Store SE01", Role.STORE_STAFF, "SE01"),
    ):
        if profile_id and db.get(Profile, profile_id) is None:
            db.add(Profile(id=profile_id, display_name=name, role=role, store_code=store))

    for index, number in enumerate(DEMO_NUMBERS):
        if number == SHIPPER_DELAY_NUMBER:
            seed_shipper_delay(db, now)
            continue
        if db.scalar(select(Order.id).where(Order.order_number == number)):
            continue
        dispatched = index in (2, 3, 5)
        delivered = index in (7, 8)
        due = now + timedelta(hours=-1 if index in (1, 3) else -2 if index == 8 else 4)
        db.add(
            Order(
                id=uuid5(NAMESPACE_URL, f"netcom/{number}"),
                order_number=number,
                store_code="SE02" if index == 6 else "SE01",
                customer_reference=f"Demo customer {index + 1}",
                planned_handover_at=now + timedelta(minutes=60 if index == 0 else -60)
                if index < 4
                else now + timedelta(hours=3),
                original_delivery_due_at=due,
                estimated_delivery_at=None
                if index == 5
                else due + timedelta(hours=1 if index == 2 else -1),
                dispatched_at=now - timedelta(hours=3) if dispatched or delivered else None,
                delivered_at=now - timedelta(hours=1) if delivered else None,
                warehouse_status=WarehouseStatus.NOT_READY if index == 0 else WarehouseStatus.READY,
                delivery_status=(
                    DeliveryStatus.DELIVERED
                    if delivered
                    else DeliveryStatus.DISPATCHED
                    if dispatched
                    else DeliveryStatus.UNKNOWN
                    if index == 9
                    else DeliveryStatus.NOT_DISPATCHED
                ),
                data_verified_at=now - timedelta(minutes=90 if index == 6 else 0),
            )
        )


def advance_demo(db, number: str, stage: str, now: datetime) -> Order:
    if number not in DEMO_NUMBERS:
        raise ValueError("Chỉ chuyển giai đoạn đơn demo đã seed.")
    if stage not in ("dispatched", "delivered"):
        raise ValueError("Stage phải là dispatched hoặc delivered.")
    order = db.scalar(select(Order).where(Order.order_number == number).with_for_update())
    if order is None or order.id != uuid5(NAMESPACE_URL, f"netcom/{number}"):
        raise ValueError("Không tìm thấy đơn demo đã seed.")
    target = DeliveryStatus.DISPATCHED if stage == "dispatched" else DeliveryStatus.DELIVERED
    # Lặp stage là no-op, không đổi timestamps, ETA hoặc data_verified_at.
    if order.delivery_status == target:
        return order
    if target == DeliveryStatus.DISPATCHED:
        if order.delivery_status != DeliveryStatus.NOT_DISPATCHED:
            raise ValueError("Không được chuyển lùi hoặc chuyển từ trạng thái chưa xác định.")
        if order.dispatched_at is not None or order.delivered_at is not None:
            raise ValueError("Dữ liệu thực tế mâu thuẫn; cần xác minh trước khi chuyển.")
        order.dispatched_at = now
        order.warehouse_status = WarehouseStatus.READY
        order.estimated_delivery_at = max(
            now + timedelta(hours=1),
            (order.original_delivery_due_at or now) + timedelta(hours=1),
        )
    else:
        if order.delivery_status != DeliveryStatus.DISPATCHED:
            raise ValueError("Phải chuyển sang dispatched trước khi delivered.")
        if (
            order.dispatched_at is None
            or order.dispatched_at > now
            or order.delivered_at is not None
        ):
            raise ValueError("Mốc xuất giao/giao thực tế không hợp lệ.")
        order.delivered_at = now
    order.delivery_status = target
    order.data_verified_at = now
    return order


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reset-demo", action="store_true")
    parser.add_argument("--add-shipper-delay", action="store_true")
    parser.add_argument("--advance-demo", metavar="ORDER_NUMBER")
    parser.add_argument("--stage", choices=["dispatched", "delivered"])
    args = parser.parse_args()
    if (
        bool(args.advance_demo) != bool(args.stage)
        or sum((args.reset_demo, bool(args.advance_demo), args.add_shipper_delay)) > 1
    ):
        parser.error(
            "Chọn một chế độ: --reset-demo, --add-shipper-delay hoặc --advance-demo kèm --stage."
        )
    upgrade_database()
    now = datetime.now(UTC)
    try:
        with SessionLocal.begin() as db:
            if args.advance_demo:
                advance_demo(db, args.advance_demo, args.stage, now)
            elif args.add_shipper_delay:
                seed_shipper_delay(db, now)
            else:
                seed_demo(db, now, reset=args.reset_demo)
    except ValueError as exc:
        parser.error(str(exc))
    if args.advance_demo:
        print(f"{args.advance_demo}: {args.stage}; giữ nguyên hạn cam kết và lịch sử sự cố.")
    elif args.add_shipper_delay:
        print(f"Đã giữ/tạo {SHIPPER_DELAY_NUMBER}: đang vận chuyển, nguy cơ giao trễ do shipper.")
    else:
        print(f"Schema sẵn sàng; {len(DEMO_NUMBERS)} đơn demo được giữ/tạo mới.")
        if not all(get_settings().demo_profile_ids()):
            print("Chưa seed đủ profile: điền DEMO_*_AUTH_ID rồi chạy seed lại.")


if __name__ == "__main__":
    main()
