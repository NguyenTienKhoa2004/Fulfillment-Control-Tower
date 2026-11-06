from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Role(StrEnum):
    LOGISTICS_COORDINATOR = "LOGISTICS_COORDINATOR"
    STORE_STAFF = "STORE_STAFF"


class WarehouseStatus(StrEnum):
    NOT_READY = "NOT_READY"
    READY = "READY"
    UNKNOWN = "UNKNOWN"


class DeliveryStatus(StrEnum):
    NOT_DISPATCHED = "NOT_DISPATCHED"
    DISPATCHED = "DISPATCHED"
    DELIVERED = "DELIVERED"
    UNKNOWN = "UNKNOWN"


class RiskStatus(StrEnum):
    NOT_CHECKED = "NOT_CHECKED"
    AT_RISK = "AT_RISK"
    CLEAR = "CLEAR"
    UNKNOWN = "UNKNOWN"


class RiskCode(StrEnum):
    WAREHOUSE_NOT_READY_BEFORE_HANDOVER = "WAREHOUSE_NOT_READY_BEFORE_HANDOVER"
    HANDOVER_OVERDUE = "HANDOVER_OVERDUE"
    DELIVERY_ETA_LATE = "DELIVERY_ETA_LATE"
    DELIVERY_OVERDUE = "DELIVERY_OVERDUE"


class AlertType(StrEnum):
    RISK = "RISK"
    DELAYED = "DELAYED"


class IncidentStatus(StrEnum):
    NEW = "NEW"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"


class EventType(StrEnum):
    DETECTED = "DETECTED"
    ACCEPTED = "ACCEPTED"
    NOTE_ADDED = "NOTE_ADDED"
    RESOLVED = "RESOLVED"


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    display_name: Mapped[str] = mapped_column(String(120))
    role: Mapped[Role] = mapped_column(Enum(Role))
    store_code: Mapped[str | None] = mapped_column(String(20))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    order_number: Mapped[str] = mapped_column(String(40), unique=True)
    store_code: Mapped[str] = mapped_column(String(20), index=True)
    customer_reference: Mapped[str] = mapped_column(String(120))
    planned_handover_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    original_delivery_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    estimated_delivery_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    dispatched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    warehouse_status: Mapped[WarehouseStatus] = mapped_column(
        Enum(WarehouseStatus), default=WarehouseStatus.UNKNOWN
    )
    delivery_status: Mapped[DeliveryStatus] = mapped_column(
        Enum(DeliveryStatus), default=DeliveryStatus.UNKNOWN
    )
    data_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    risk_status: Mapped[RiskStatus] = mapped_column(
        Enum(RiskStatus), default=RiskStatus.NOT_CHECKED
    )
    risk_reason: Mapped[str | None] = mapped_column(Text)
    risk_assessments: Mapped[list[dict]] = mapped_column(JSONB, default=list, server_default="[]")
    assessed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Incident(Base):
    __tablename__ = "incidents"
    __table_args__ = (UniqueConstraint("order_id", "risk_code"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    order_id: Mapped[UUID] = mapped_column(ForeignKey("orders.id"), index=True)
    risk_code: Mapped[RiskCode] = mapped_column(Enum(RiskCode))
    alert_type: Mapped[AlertType] = mapped_column(Enum(AlertType))
    status: Mapped[IncidentStatus] = mapped_column(Enum(IncidentStatus), default=IncidentStatus.NEW)
    assignee_id: Mapped[UUID | None] = mapped_column(ForeignKey("profiles.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolution_note: Mapped[str | None] = mapped_column(Text)
    version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")


class IncidentEvent(Base):
    __tablename__ = "incident_events"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    incident_id: Mapped[UUID] = mapped_column(ForeignKey("incidents.id"), index=True)
    type: Mapped[EventType] = mapped_column(Enum(EventType))
    actor_id: Mapped[UUID | None] = mapped_column(ForeignKey("profiles.id"))
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
