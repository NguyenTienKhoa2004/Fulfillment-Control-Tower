from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import services
from app.auth import CurrentProfile, require_logistics
from app.db import get_db
from app.models import Profile
from app.schemas import (
    ActivityResponse,
    EvaluationResponse,
    IncidentDTO,
    IncidentEventDTO,
    NoteRequest,
    OrderDetail,
    OrdersResponse,
    ProfileDTO,
    ResolveRequest,
    VerifyOrderDataRequest,
    VersionRequest,
)

router = APIRouter(prefix="/api/v1")
Database = Annotated[Session, Depends(get_db)]
Logistics = Annotated[Profile, Depends(require_logistics)]


@router.get("/me", response_model=ProfileDTO)
def me(profile: CurrentProfile):
    return profile


@router.get("/orders", response_model=OrdersResponse)
def orders(db: Database, profile: CurrentProfile):
    return OrdersResponse(items=services.list_orders(db, profile))


@router.get("/orders/{order_id}", response_model=OrderDetail)
def order_detail(order_id: UUID, db: Database, profile: CurrentProfile):
    return services.get_order(db, profile, order_id)


@router.get("/activity", response_model=ActivityResponse)
def activity(db: Database, profile: CurrentProfile):
    return ActivityResponse(items=services.list_activity(db, profile))


@router.post("/demo/evaluate-risks", response_model=EvaluationResponse)
def evaluate_risks(db: Database, profile: Logistics):
    return services.evaluate_risks(db, profile)


@router.post("/orders/{order_id}/verify-data", response_model=OrderDetail)
def verify_order_data(
    order_id: UUID, body: VerifyOrderDataRequest, db: Database, profile: Logistics
):
    return services.verify_order_data(db, profile, order_id, body)


@router.post("/incidents/{incident_id}/accept", response_model=IncidentDTO)
def accept(incident_id: UUID, body: VersionRequest, db: Database, profile: Logistics):
    return services.accept_incident(db, profile, incident_id, body.expected_version)


@router.post("/incidents/{incident_id}/notes", response_model=IncidentEventDTO)
def add_note(incident_id: UUID, body: NoteRequest, db: Database, profile: CurrentProfile):
    return services.add_note(db, profile, incident_id, body.text)


@router.post("/incidents/{incident_id}/resolve", response_model=IncidentDTO)
def resolve(incident_id: UUID, body: ResolveRequest, db: Database, profile: Logistics):
    return services.resolve_incident(
        db, profile, incident_id, body.expected_version, body.resolution_note
    )
