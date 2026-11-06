from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models import (
    AlertType,
    DeliveryStatus,
    EventType,
    IncidentStatus,
    RiskCode,
    RiskStatus,
    Role,
    WarehouseStatus,
)


class DTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ProfileDTO(DTO):
    id: UUID
    display_name: str
    role: Role
    store_code: str | None


class RuleAssessment(DTO):
    risk_code: RiskCode
    status: Literal["AT_RISK", "CLEAR", "UNKNOWN"]
    alert_type: AlertType | None
    reason: str
    assessed_at: datetime


class IncidentSummary(DTO):
    id: UUID
    risk_code: RiskCode
    alert_type: AlertType
    status: IncidentStatus
    assignee_id: UUID | None
    assignee_name: str | None = None


class IncidentDTO(IncidentSummary):
    order_id: UUID
    created_at: datetime
    accepted_at: datetime | None
    resolved_at: datetime | None
    resolution_note: str | None
    version: int


class IncidentEventDTO(DTO):
    id: UUID
    incident_id: UUID
    risk_code: RiskCode
    type: EventType
    actor_id: UUID | None
    text: str
    created_at: datetime


class ActivityItem(IncidentEventDTO):
    order_id: UUID
    order_number: str


class OrderSummary(DTO):
    id: UUID
    order_number: str
    store_code: str
    customer_reference: str
    planned_handover_at: datetime | None
    original_delivery_due_at: datetime | None
    estimated_delivery_at: datetime | None
    dispatched_at: datetime | None
    delivered_at: datetime | None
    warehouse_status: WarehouseStatus
    delivery_status: DeliveryStatus
    data_verified_at: datetime | None
    risk_status: RiskStatus
    risk_reason: str | None
    risk_assessments: list[RuleAssessment]
    assessed_at: datetime | None
    incidents: list[IncidentSummary] = Field(default_factory=list)


class OrderDetail(OrderSummary):
    incidents: list[IncidentDTO] = Field(default_factory=list)
    timeline: list[IncidentEventDTO] = Field(default_factory=list)


class OrdersResponse(DTO):
    items: list[OrderSummary]


class ActivityResponse(DTO):
    items: list[ActivityItem]


class EvaluationResponse(DTO):
    evaluated_count: int
    created_incident_count: int


class VersionRequest(BaseModel):
    expected_version: int = Field(ge=0, strict=True)


class NoteRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    text: str = Field(min_length=1, max_length=5000)


class ResolveRequest(VersionRequest):
    model_config = ConfigDict(str_strip_whitespace=True)
    resolution_note: str = Field(min_length=1, max_length=5000)


class ApiError(BaseModel):
    code: str
    message: str
    field_errors: list[dict] | None = None
