"""Create local schema and fixtures; reruns preserve existing data."""

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
    OrderDataVerification,
    Profile,
    RiskCode,
    Role,
    WarehouseStatus,
)
from app.rules import evaluate_order, summarize

DEMO_NUMBERS = [f"SE-DEMO-{index:03d}" for index in range(1, 13)]
SHIPPER_DELAY_NUMBER = "SE-DEMO-011"
WAREHOUSE_PENDING_NUMBER = "SE-DEMO-012"


def seed_shipper_delay(db, now: datetime) -> Order:
    existing = db.scalar(select(Order).where(Order.order_number == SHIPPER_DELAY_NUMBER))
    if existing is not None:
        return existing
    order = Order(
        id=uuid5(NAMESPACE_URL, f"netcom/{SHIPPER_DELAY_NUMBER}"),
        order_number=SHIPPER_DELAY_NUMBER,
        store_code="SE01",
        customer_reference="Demo customer 11 — carrier delayed by traffic",
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
            text="Demo scenario: the carrier is delayed by traffic; delivery is expected 60 minutes after the promised deadline.",
            created_at=now,
        )
    )
    return order


def seed_warehouse_pending(db, now: datetime, *, settings: Settings | None = None) -> Order:
    existing = db.scalar(select(Order).where(Order.order_number == WAREHOUSE_PENDING_NUMBER))
    if existing is not None:
        return existing
    settings = settings or get_settings()
    handover = now + timedelta(minutes=settings.handover_warning_minutes + 60)
    order = Order(
        id=uuid5(NAMESPACE_URL, f"netcom/{WAREHOUSE_PENDING_NUMBER}"),
        order_number=WAREHOUSE_PENDING_NUMBER,
        store_code="SE01",
        customer_reference="Demo customer 12 — warehouse not ready, outside the warning window",
        planned_handover_at=handover,
        original_delivery_due_at=handover + timedelta(hours=3),
        estimated_delivery_at=handover + timedelta(hours=2),
        dispatched_at=None,
        delivered_at=None,
        warehouse_status=WarehouseStatus.NOT_READY,
        delivery_status=DeliveryStatus.NOT_DISPATCHED,
        data_verified_at=now,
        assessed_at=now,
    )
    assessments = evaluate_order(
        order,
        now,
        max_age_minutes=settings.risk_data_max_age_minutes,
        handover_warning_minutes=settings.handover_warning_minutes,
    )
    order.risk_assessments = [item.model_dump(mode="json") for item in assessments]
    order.risk_status, order.risk_reason = summarize(assessments)
    db.add(order)
    db.flush()
    return order


def seed_demo(db, now: datetime, *, reset: bool = False, settings: Settings | None = None) -> None:
    settings = settings or get_settings()
    logistics_id, store_id = settings.demo_profile_ids()
    if logistics_id and logistics_id == store_id:
        raise ValueError("The two demo accounts must have different UUIDs.")
    if reset:
        order_ids = select(Order.id).where(Order.order_number.in_(DEMO_NUMBERS))
        incident_ids = select(Incident.id).where(Incident.order_id.in_(order_ids))
        db.execute(delete(OrderDataVerification).where(OrderDataVerification.order_id.in_(order_ids)))
        db.execute(delete(IncidentEvent).where(IncidentEvent.incident_id.in_(incident_ids)))
        db.execute(delete(Incident).where(Incident.order_id.in_(order_ids)))
        db.execute(delete(Order).where(Order.order_number.in_(DEMO_NUMBERS)))
    for profile_id, name, role, store in (
        (logistics_id, "Demo Logistics", Role.LOGISTICS_COORDINATOR, None),
        (store_id, "Demo Store SE01", Role.STORE_STAFF, "SE01"),
    ):
        if profile_id and db.get(Profile, profile_id) is None:
            db.add(Profile(id=profile_id, display_name=name, role=role, store_code=store))

    # All timestamps are relative to this run. Keep stale data out of the initial
    # presentation while retaining genuine late deliveries and missing-data cases.
    scenarios = [
        dict(customer="Northstar Retail — warehouse readiness risk", handover=1, due=5, eta=4,
             warehouse=WarehouseStatus.NOT_READY),
        dict(customer="Atlas Home — handover and delivery overdue", handover=-2, due=-1, eta=2),
        dict(customer="Summit Electronics — ETA exceeds delivery promise", handover=-2, due=3, eta=4,
             dispatched=-2),
        dict(customer="Harbor Living — delivery overdue", handover=-5, due=-1, eta=2,
             dispatched=-4),
        dict(customer="Evergreen Market — ready for scheduled handover", handover=2, due=6, eta=5),
        dict(customer="Cedar Office — carrier ETA needs confirmation", handover=-2, due=5, eta=None,
             dispatched=-2),
        dict(customer="Lakeside Retail — SE02 store visibility", handover=-2, due=5, eta=3,
             dispatched=-2, store="SE02"),
        dict(customer="Aurora Home — delivered on time, incident resolved", handover=-4, due=-0.5, eta=-1,
             dispatched=-4, delivered=-1),
        dict(customer="Maple Design — delivered late, incident resolved", handover=-4, due=-2, eta=-1,
             dispatched=-4, delivered=-1),
        dict(customer="Birch Supply — delivery status needs confirmation", handover=2, due=6, eta=5,
             delivery=DeliveryStatus.UNKNOWN),
    ]
    created = []
    for index, number in enumerate(DEMO_NUMBERS):
        if db.scalar(select(Order.id).where(Order.order_number == number)):
            continue
        if number == SHIPPER_DELAY_NUMBER:
            created.append(seed_shipper_delay(db, now))
            continue
        if number == WAREHOUSE_PENDING_NUMBER:
            created.append(seed_warehouse_pending(db, now, settings=settings))
            continue
        scenario = scenarios[index]
        def at(key):
            hours = scenario.get(key)
            return now + timedelta(hours=hours) if hours is not None else None
        dispatched, delivered = at("dispatched"), at("delivered")
        order = Order(
            id=uuid5(NAMESPACE_URL, f"netcom/{number}"),
            order_number=number,
            store_code=scenario.get("store", "SE01"),
            customer_reference=scenario["customer"],
            planned_handover_at=at("handover"),
            original_delivery_due_at=at("due"),
            estimated_delivery_at=at("eta"),
            dispatched_at=dispatched,
            delivered_at=delivered,
            warehouse_status=scenario.get("warehouse", WarehouseStatus.READY),
            delivery_status=scenario.get("delivery", DeliveryStatus.DELIVERED if delivered
                                         else DeliveryStatus.DISPATCHED if dispatched
                                         else DeliveryStatus.NOT_DISPATCHED),
            data_verified_at=now,
        )
        db.add(order)
        created.append(order)
    db.flush()
    from app.services import assess_order

    for order in created:
        assess_order(db, order, now, settings)
    db.flush()

    # Use a real local coordinator profile so the presentation can continue the
    # workflow from the UI. Never create a separate fake authentication account.
    coordinator = db.get(Profile, logistics_id) if logistics_id else None
    if coordinator is None or not coordinator.active or coordinator.role != Role.LOGISTICS_COORDINATOR:
        coordinator = db.scalar(select(Profile).where(
            Profile.active.is_(True), Profile.role == Role.LOGISTICS_COORDINATOR
        ).order_by(Profile.id))
    if coordinator is not None:
        for order in created:
            if order.order_number in ("SE-DEMO-003", "SE-DEMO-004"):
                incident = db.scalar(select(Incident).where(Incident.order_id == order.id))
                if incident is not None:
                    incident.created_at = now - timedelta(minutes=20)
                    detected = db.scalar(select(IncidentEvent).where(
                        IncidentEvent.incident_id == incident.id,
                        IncidentEvent.type == EventType.DETECTED,
                    ))
                    if detected is not None:
                        detected.created_at = incident.created_at
                    seed_workflow(db, incident, coordinator, now, resolved=False)
            elif order.order_number in ("SE-DEMO-008", "SE-DEMO-009"):
                late = order.order_number == "SE-DEMO-009"
                incident = Incident(
                    id=uuid5(NAMESPACE_URL, f"netcom/{order.order_number}/history"),
                    order_id=order.id,
                    risk_code=RiskCode.DELIVERY_OVERDUE if late else RiskCode.WAREHOUSE_NOT_READY_BEFORE_HANDOVER,
                    alert_type=AlertType.DELAYED if late else AlertType.RISK,
                    status=IncidentStatus.NEW,
                    created_at=now - timedelta(minutes=110 if late else 300),
                )
                db.add(incident)
                db.flush()
                db.add(IncidentEvent(
                    incident_id=incident.id, type=EventType.DETECTED, actor_id=None,
                    text="Delivery deadline missed; carrier follow-up required." if late
                         else "Warehouse preparation was at risk before the planned handover.",
                    created_at=incident.created_at,
                ))
                seed_workflow(db, incident, coordinator, now, resolved=True, late=late)


def seed_workflow(db, incident: Incident, coordinator: Profile, now: datetime,
                  *, resolved: bool, late: bool = False) -> None:
    accepted = incident.created_at + timedelta(minutes=5)
    incident.status = IncidentStatus.RESOLVED if resolved else IncidentStatus.IN_PROGRESS
    incident.assignee_id = coordinator.id
    incident.accepted_at = accepted
    incident.version = 2 if resolved else 1
    db.add(IncidentEvent(
        incident_id=incident.id, type=EventType.ACCEPTED, actor_id=coordinator.id,
        text=f"{coordinator.display_name} took ownership of the incident.", created_at=accepted,
    ))
    db.add(IncidentEvent(
        incident_id=incident.id, type=EventType.NOTE_ADDED, actor_id=coordinator.id,
        text="Carrier contacted. Customer informed of the updated delivery estimate." if late
             else "Warehouse and carrier contacted. Recovery plan confirmed with the store.",
        created_at=accepted + timedelta(minutes=5),
    ))
    if resolved:
        incident.resolved_at = now - timedelta(minutes=55 if late else 250)
        incident.resolution_note = (
            "Delivery completed 60 minutes after the original promise. Customer informed; incident closed."
            if late else "Warehouse preparation completed before handover. Order delivered on time."
        )
        db.add(IncidentEvent(
            incident_id=incident.id, type=EventType.RESOLVED, actor_id=coordinator.id,
            text=incident.resolution_note, created_at=incident.resolved_at,
        ))


def advance_demo(db, number: str, stage: str, now: datetime) -> Order:
    if number not in DEMO_NUMBERS:
        raise ValueError("Only seeded demo orders can advance to another stage.")
    if stage not in ("dispatched", "delivered"):
        raise ValueError("Stage must be dispatched or delivered.")
    order = db.scalar(select(Order).where(Order.order_number == number).with_for_update())
    if order is None or order.id != uuid5(NAMESPACE_URL, f"netcom/{number}"):
        raise ValueError("Seeded demo order not found.")
    target = DeliveryStatus.DISPATCHED if stage == "dispatched" else DeliveryStatus.DELIVERED
    # Repeating a stage is a no-op; preserve timestamps, ETA, and data_verified_at.
    if order.delivery_status == target:
        return order
    if target == DeliveryStatus.DISPATCHED:
        if order.delivery_status != DeliveryStatus.NOT_DISPATCHED:
            raise ValueError("Cannot move backwards or advance from an unknown status.")
        if order.dispatched_at is not None or order.delivered_at is not None:
            raise ValueError("Actual timestamps are inconsistent. Verify them before advancing.")
        order.dispatched_at = now
        order.warehouse_status = WarehouseStatus.READY
        order.estimated_delivery_at = max(
            now + timedelta(hours=1),
            (order.original_delivery_due_at or now) + timedelta(hours=1),
        )
    else:
        if order.delivery_status != DeliveryStatus.DISPATCHED:
            raise ValueError("Advance to dispatched before delivered.")
        if (
            order.dispatched_at is None
            or order.dispatched_at > now
            or order.delivered_at is not None
        ):
            raise ValueError("Invalid dispatch or delivery timestamps.")
        order.delivered_at = now
    order.delivery_status = target
    order.data_verified_at = now
    return order


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reset-demo", action="store_true")
    parser.add_argument("--add-shipper-delay", action="store_true")
    parser.add_argument("--add-warehouse-pending", action="store_true")
    parser.add_argument("--advance-demo", metavar="ORDER_NUMBER")
    parser.add_argument("--stage", choices=["dispatched", "delivered"])
    args = parser.parse_args()
    if (
        bool(args.advance_demo) != bool(args.stage)
        or sum(
            (args.reset_demo, bool(args.advance_demo),
             args.add_shipper_delay, args.add_warehouse_pending)
        ) > 1
    ):
        parser.error(
            "Choose one mode: --reset-demo, --add-shipper-delay, "
            "--add-warehouse-pending or --advance-demo with --stage."
        )
    upgrade_database()
    now = datetime.now(UTC)
    try:
        with SessionLocal.begin() as db:
            if args.advance_demo:
                advance_demo(db, args.advance_demo, args.stage, now)
            elif args.add_shipper_delay:
                seed_shipper_delay(db, now)
            elif args.add_warehouse_pending:
                seed_warehouse_pending(db, now)
            else:
                seed_demo(db, now, reset=args.reset_demo)
    except ValueError as exc:
        parser.error(str(exc))
    if args.advance_demo:
        print(f"{args.advance_demo}: {args.stage}; preserving the promised deadline and incident history.")
    elif args.add_shipper_delay:
        print(f"Kept/created {SHIPPER_DELAY_NUMBER}: in transit, at risk of late delivery due to a carrier delay.")
    elif args.add_warehouse_pending:
        print(
            f"Kept/created {WAREHOUSE_PENDING_NUMBER}: "
            "warehouse not ready, outside the warning window."
        )
    else:
        print(f"Schema ready; {len(DEMO_NUMBERS)} demo orders kept or created.")
        if not all(get_settings().demo_profile_ids()):
            print("Demo profiles are incomplete: set DEMO_*_AUTH_ID and run seed again.")


if __name__ == "__main__":
    main()
