"""Queries theo store scope và workflow transaction cho mỗi request."""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import EventType, Incident, IncidentEvent, IncidentStatus, Order, Profile, Role
from app.rules import evaluate_order, summarize
from app.schemas import (
    ActivityItem,
    EvaluationResponse,
    IncidentDTO,
    IncidentEventDTO,
    OrderDetail,
    OrderSummary,
)


def scoped_orders(profile: Profile):
    query = select(Order)
    if profile.role == Role.STORE_STAFF:
        query = query.where(Order.store_code == profile.store_code)
    return query


def incident_dtos(db: Session, order_id: UUID) -> list[IncidentDTO]:
    rows = db.execute(
        select(Incident, Profile.display_name)
        .outerjoin(Profile, Incident.assignee_id == Profile.id)
        .where(Incident.order_id == order_id)
        .order_by(Incident.created_at, Incident.id)
    )
    return [
        IncidentDTO.model_validate(incident).model_copy(update={"assignee_name": name})
        for incident, name in rows
    ]


def list_orders(db: Session, profile: Profile) -> list[OrderSummary]:
    return [
        OrderSummary.model_validate(order).model_copy(
            update={"incidents": incident_dtos(db, order.id)}
        )
        for order in db.scalars(scoped_orders(profile).order_by(Order.order_number))
    ]


def get_order(db: Session, profile: Profile, order_id: UUID) -> OrderDetail:
    order = db.scalar(scoped_orders(profile).where(Order.id == order_id))
    if order is None:
        raise HTTPException(404, "Không tìm thấy đơn hàng.")
    rows = db.execute(
        select(IncidentEvent, Incident.risk_code)
        .join(Incident, IncidentEvent.incident_id == Incident.id)
        .where(Incident.order_id == order_id)
        .order_by(IncidentEvent.created_at, IncidentEvent.id)
    )
    timeline = [IncidentEventDTO(**event_fields(event), risk_code=code) for event, code in rows]
    return OrderDetail.model_validate(order).model_copy(
        update={"incidents": incident_dtos(db, order_id), "timeline": timeline}
    )


def event_fields(event: IncidentEvent) -> dict:
    return {
        field: getattr(event, field)
        for field in ("id", "incident_id", "type", "actor_id", "text", "created_at")
    }


def list_activity(db: Session, profile: Profile) -> list[ActivityItem]:
    query = (
        select(IncidentEvent, Incident.risk_code, Order.id, Order.order_number)
        .join(Incident, IncidentEvent.incident_id == Incident.id)
        .join(Order, Incident.order_id == Order.id)
    )
    if profile.role == Role.STORE_STAFF:
        query = query.where(Order.store_code == profile.store_code)
    rows = db.execute(
        query.order_by(IncidentEvent.created_at.desc(), IncidentEvent.id.desc()).limit(20)
    )
    return [
        ActivityItem(**event_fields(event), risk_code=code, order_id=oid, order_number=number)
        for event, code, oid, number in rows
    ]


def check_logistics(profile: Profile) -> None:
    if profile.role != Role.LOGISTICS_COORDINATOR:
        raise HTTPException(403, "Chỉ logistics được thực hiện thao tác này.")


def get_incident(db: Session, profile: Profile, incident_id: UUID) -> Incident:
    query = (
        select(Incident)
        .join(Order, Incident.order_id == Order.id)
        .where(Incident.id == incident_id)
    )
    if profile.role == Role.STORE_STAFF:
        query = query.where(Order.store_code == profile.store_code)
    incident = db.scalar(query)
    if incident is None:
        raise HTTPException(404, "Không tìm thấy sự cố.")
    return incident


def incident_dto(db: Session, incident: Incident) -> IncidentDTO:
    dto = IncidentDTO.model_validate(incident)
    if incident.assignee_id:
        dto.assignee_name = db.scalar(
            select(Profile.display_name).where(Profile.id == incident.assignee_id)
        )
    return dto


def evaluate_risks(
    db: Session, profile: Profile, now: datetime | None = None
) -> EvaluationResponse:
    from app.seed import DEMO_NUMBERS

    check_logistics(profile)
    settings = get_settings()
    # Cùng thứ tự khóa cho mọi request; assessment/event khớp với dữ liệu đã đọc.
    orders = list(
        db.scalars(
            select(Order)
            .where(Order.order_number.in_(DEMO_NUMBERS))
            .order_by(Order.id)
            .with_for_update()
        )
    )
    now = now or datetime.now(UTC)
    created = 0
    for order in orders:
        assessments = evaluate_order(
            order,
            now,
            max_age_minutes=settings.risk_data_max_age_minutes,
            handover_warning_minutes=settings.handover_warning_minutes,
        )
        order.risk_assessments = [item.model_dump(mode="json") for item in assessments]
        order.risk_status, order.risk_reason = summarize(assessments)
        order.assessed_at = now
        for item in assessments:
            if item.status != "AT_RISK":
                continue
            incident_id = db.scalar(
                insert(Incident)
                .values(
                    order_id=order.id,
                    risk_code=item.risk_code,
                    alert_type=item.alert_type,
                    status=IncidentStatus.NEW,
                    created_at=now,
                    version=0,
                )
                .on_conflict_do_nothing(index_elements=["order_id", "risk_code"])
                .returning(Incident.id)
            )
            if incident_id is not None:
                created += 1
                db.add(
                    IncidentEvent(
                        incident_id=incident_id,
                        type=EventType.DETECTED,
                        actor_id=None,
                        text=item.reason,
                        created_at=now,
                    )
                )
    db.commit()
    return EvaluationResponse(evaluated_count=len(orders), created_incident_count=created)


def accept_incident(db: Session, profile: Profile, incident_id: UUID, version: int) -> IncidentDTO:
    check_logistics(profile)
    incident = get_incident(db, profile, incident_id)
    now = datetime.now(UTC)
    changed = db.scalar(
        update(Incident)
        .where(
            Incident.id == incident_id,
            Incident.status == IncidentStatus.NEW,
            Incident.version == version,
        )
        .values(
            status=IncidentStatus.IN_PROGRESS,
            assignee_id=profile.id,
            accepted_at=now,
            version=Incident.version + 1,
        )
        .returning(Incident.id)
        .execution_options(synchronize_session=False)
    )
    if changed is None:
        raise HTTPException(409, "Sự cố đã đổi trạng thái hoặc phiên bản; hãy tải lại.")
    db.add(
        IncidentEvent(
            incident_id=incident_id,
            type=EventType.ACCEPTED,
            actor_id=profile.id,
            text=f"{profile.display_name} nhận xử lý sự cố.",
            created_at=now,
        )
    )
    db.flush()
    db.refresh(incident)
    dto = incident_dto(db, incident)
    db.commit()
    return dto


def add_note(db: Session, profile: Profile, incident_id: UUID, text: str) -> IncidentEventDTO:
    incident = get_incident(db, profile, incident_id)
    text = text.strip()
    if not text or len(text) > 5000:
        raise HTTPException(422, "Ghi chú phải có từ 1 đến 5000 ký tự.")
    event = IncidentEvent(
        incident_id=incident_id,
        type=EventType.NOTE_ADDED,
        actor_id=profile.id,
        text=text,
        created_at=datetime.now(UTC),
    )
    db.add(event)
    db.flush()
    dto = IncidentEventDTO(**event_fields(event), risk_code=incident.risk_code)
    db.commit()
    return dto


def resolve_incident(
    db: Session, profile: Profile, incident_id: UUID, version: int, note: str
) -> IncidentDTO:
    check_logistics(profile)
    incident = get_incident(db, profile, incident_id)
    if incident.status != IncidentStatus.IN_PROGRESS:
        raise HTTPException(409, "Sự cố không còn ở trạng thái đang xử lý; hãy tải lại.")
    if incident.assignee_id != profile.id:
        raise HTTPException(403, "Chỉ người đang phụ trách được giải quyết sự cố.")
    note = note.strip()
    if not note or len(note) > 5000:
        raise HTTPException(422, "Nội dung giải quyết phải có từ 1 đến 5000 ký tự.")
    now = datetime.now(UTC)
    changed = db.scalar(
        update(Incident)
        .where(
            Incident.id == incident_id,
            Incident.status == IncidentStatus.IN_PROGRESS,
            Incident.assignee_id == profile.id,
            Incident.version == version,
        )
        .values(
            status=IncidentStatus.RESOLVED,
            resolution_note=note,
            resolved_at=now,
            version=Incident.version + 1,
        )
        .returning(Incident.id)
        .execution_options(synchronize_session=False)
    )
    if changed is None:
        raise HTTPException(409, "Sự cố đã đổi trạng thái hoặc phiên bản; hãy tải lại.")
    db.add(
        IncidentEvent(
            incident_id=incident_id,
            type=EventType.RESOLVED,
            actor_id=profile.id,
            text=note,
            created_at=now,
        )
    )
    db.flush()
    db.refresh(incident)
    dto = incident_dto(db, incident)
    db.commit()
    return dto
