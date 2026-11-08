from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator, model_validator

from app.legacy_text import (
    DEMO_CUSTOMER_REFERENCES,
    english_ownership_message,
    english_system_message,
)
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

    @field_validator("reason")
    @classmethod
    def english_reason(cls, value: str) -> str:
        return english_system_message(value)


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

    @model_validator(mode="after")
    def english_event_text(self):
        if self.type == EventType.DETECTED:
            self.text = english_system_message(self.text)
        elif self.type == EventType.ACCEPTED:
            self.text = english_ownership_message(self.text)
        return self


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

    @field_validator("risk_reason")
    @classmethod
    def english_risk_reason(cls, value: str | None) -> str | None:
        return english_system_message(value) if value is not None else None

    @field_validator("customer_reference")
    @classmethod
    def english_demo_reference(cls, value: str) -> str:
        return DEMO_CUSTOMER_REFERENCES.get(value, value)


class OrderDataVerificationDTO(DTO):
    id: UUID
    actor_name: str
    verified_at: datetime
    note: str
    previous_data: dict
    verified_data: dict


class OrderDetail(OrderSummary):
    incidents: list[IncidentDTO] = Field(default_factory=list)
    timeline: list[IncidentEventDTO] = Field(default_factory=list)
    data_verifications: list[OrderDataVerificationDTO] = Field(default_factory=list)


class VerifyOrderDataRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    expected_data_verified_at: AwareDatetime | None
    warehouse_status: WarehouseStatus
    delivery_status: Literal["NOT_DISPATCHED", "DISPATCHED", "DELIVERED"]
    estimated_delivery_at: AwareDatetime | None
    dispatched_at: AwareDatetime | None
    delivered_at: AwareDatetime | None
    verification_note: str = Field(min_length=1, max_length=2000)

    @model_validator(mode="after")
    def consistent_milestones(self):
        if self.delivery_status == "NOT_DISPATCHED":
            if self.dispatched_at is not None or self.delivered_at is not None:
                raise ValueError("An order that has not been dispatched cannot have dispatch or delivery timestamps.")
        elif self.dispatched_at is None:
            raise ValueError("Enter the actual carrier handover time.")
        if self.delivery_status == "DISPATCHED" and self.delivered_at is not None:
            raise ValueError("An order in transit cannot have an actual delivery timestamp.")
        if self.delivery_status == "DELIVERED":
            if self.delivered_at is None:
                raise ValueError("Enter the actual delivery time.")
            if self.delivered_at < self.dispatched_at:
                raise ValueError("The delivery time must be at or after dispatch.")
        return self


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
