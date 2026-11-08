"""Integration tests: NETCOM_TEST_DATABASE=1, database đã chạy migration.

Mỗi test chạy trong transaction riêng và rollback toàn bộ fixtures sau khi xong.
"""

import os
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import get_current_profile
from app.db import engine, get_db
from app.main import app
from app.models import (
    EventType,
    Incident,
    IncidentEvent,
    IncidentStatus,
    Order,
    OrderDataVerification,
    Profile,
    RiskCode,
    Role,
)

pytestmark = pytest.mark.skipif(
    os.getenv("NETCOM_TEST_DATABASE") != "1",
    reason="Cần PostgreSQL đã migrate để chạy integration tests.",
)


@pytest.fixture
def case():
    connection = engine.connect()
    transaction = connection.begin()
    db = Session(bind=connection, join_transaction_mode="create_savepoint")
    now = datetime.now(UTC)
    logistics = Profile(id=uuid4(), display_name="Test Logistics", role=Role.LOGISTICS_COORDINATOR)
    staff = Profile(id=uuid4(), display_name="Test Staff", role=Role.STORE_STAFF, store_code="TEST")
    db.add_all([logistics, staff])
    db.flush()
    order = Order(
        id=uuid4(),
        order_number=f"TEST-{uuid4().hex[:20]}",
        store_code="TEST",
        customer_reference="Test xác minh",
        warehouse_status="NOT_READY",
        delivery_status="NOT_DISPATCHED",
        planned_handover_at=now + timedelta(hours=1),
        original_delivery_due_at=now + timedelta(hours=4),
        estimated_delivery_at=now + timedelta(hours=3),
        data_verified_at=now - timedelta(hours=2),
    )
    db.add(order)
    db.flush()
    incident = Incident(
        id=uuid4(),
        order_id=order.id,
        risk_code=RiskCode.WAREHOUSE_NOT_READY_BEFORE_HANDOVER,
        alert_type="RISK",
        status=IncidentStatus.IN_PROGRESS,
        assignee_id=logistics.id,
        created_at=now - timedelta(hours=1),
        accepted_at=now - timedelta(minutes=50),
        version=3,
    )
    db.add(incident)
    db.flush()
    note = IncidentEvent(
        id=uuid4(),
        incident_id=incident.id,
        type=EventType.NOTE_ADDED,
        actor_id=logistics.id,
        text="Ghi chú cần giữ nguyên",
        created_at=now,
    )
    db.add(note)
    db.flush()
    actor = {"profile": logistics}
    previous_overrides = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_profile] = lambda: actor["profile"]
    payload = {
        "expected_data_verified_at": order.data_verified_at.isoformat(),
        "warehouse_status": "READY",
        "delivery_status": "NOT_DISPATCHED",
        "estimated_delivery_at": order.estimated_delivery_at.isoformat(),
        "dispatched_at": None,
        "delivered_at": None,
        "verification_note": " Đã đối chiếu với kho. ",
    }
    try:
        with TestClient(app) as client:
            yield db, client, order, incident, note, actor, staff, payload
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous_overrides)
        db.close()
        transaction.rollback()
        connection.close()


def verify(client, order, payload):
    return client.post(f"/api/v1/orders/{order.id}/verify-data", json=payload)


def test_refresh_reassesses_preserves_commitment_and_incident_history(case):
    db, client, order, incident, note, _, _, payload = case
    due = order.original_delivery_due_at
    response = verify(client, order, payload)
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["risk_status"] == "CLEAR"
    assert result["data_verified_at"] == result["assessed_at"]
    assert len(result["risk_assessments"]) == 4
    assert datetime.fromisoformat(result["original_delivery_due_at"]) == due
    assert result["incidents"][0]["status"] == "IN_PROGRESS"
    assert result["incidents"][0]["version"] == 3
    assert result["timeline"][0]["id"] == str(note.id)
    audit = result["data_verifications"][0]
    assert audit["note"] == "Đã đối chiếu với kho."
    assert audit["actor_name"] == "Test Logistics"
    assert audit["previous_data"]["warehouse_status"] == "NOT_READY"
    assert audit["verified_data"]["warehouse_status"] == "READY"
    assert db.get(Incident, incident.id).assignee_id == incident.assignee_id


def test_new_risk_creates_one_incident_and_delivered_does_not_resolve_it(case):
    db, client, order, _, _, _, _, payload = case
    payload.update(
        delivery_status="DISPATCHED",
        dispatched_at=(datetime.now(UTC) - timedelta(minutes=10)).isoformat(),
        estimated_delivery_at=(order.original_delivery_due_at + timedelta(hours=1)).isoformat(),
    )
    first = verify(client, order, payload)
    assert first.status_code == 200, first.text
    assert first.json()["risk_status"] == "AT_RISK"
    payload["expected_data_verified_at"] = first.json()["data_verified_at"]
    second = verify(client, order, payload)
    assert second.status_code == 200
    assert len(second.json()["incidents"]) == 2
    new_id = next(
        item["id"]
        for item in second.json()["incidents"]
        if item["risk_code"] == "DELIVERY_ETA_LATE"
    )
    assert (
        db.scalar(
            select(func.count())
            .select_from(IncidentEvent)
            .where(
                IncidentEvent.incident_id == new_id,
                IncidentEvent.type == EventType.DETECTED,
            )
        )
        == 1
    )
    payload.update(
        expected_data_verified_at=second.json()["data_verified_at"],
        delivery_status="DELIVERED",
        delivered_at=datetime.now(UTC).isoformat(),
    )
    delivered = verify(client, order, payload)
    assert delivered.status_code == 200, delivered.text
    assert delivered.json()["risk_status"] == "CLEAR"
    assert {item["status"] for item in delivered.json()["incidents"]} == {"NEW", "IN_PROGRESS"}
    payload.update(
        expected_data_verified_at=delivered.json()["data_verified_at"],
        delivery_status="NOT_DISPATCHED",
        dispatched_at=None,
        delivered_at=None,
    )
    assert verify(client, order, payload).status_code == 422


def test_stale_form_conflicts_without_overwriting_data(case):
    db, client, order, _, _, _, _, payload = case
    assert verify(client, order, payload).status_code == 200
    payload["warehouse_status"] = "NOT_READY"
    assert verify(client, order, payload).status_code == 409
    db.refresh(order)
    assert order.warehouse_status == "READY"
    assert (
        db.scalar(
            select(func.count())
            .select_from(OrderDataVerification)
            .where(
                OrderDataVerification.order_id == order.id,
            )
        )
        == 1
    )


def test_store_cannot_verify_and_cannot_read_other_store_audit(case):
    _, client, order, _, _, actor, staff, payload = case
    assert verify(client, order, payload).status_code == 200
    actor["profile"] = staff
    assert verify(client, order, payload).status_code == 403
    own = client.get(f"/api/v1/orders/{order.id}")
    assert own.status_code == 200
    assert len(own.json()["data_verifications"]) == 1
    staff.store_code = "OTHER"
    assert client.get(f"/api/v1/orders/{order.id}").status_code == 404


@pytest.mark.parametrize(
    "invalid",
    [
        {"delivery_status": "DISPATCHED", "dispatched_at": None},
        {
            "delivery_status": "DELIVERED",
            "dispatched_at": "2026-01-02T00:00:00Z",
            "delivered_at": "2026-01-01T00:00:00Z",
        },
        {"delivery_status": "DISPATCHED", "dispatched_at": "2999-01-01T00:00:00Z"},
        {"dispatched_at": "2026-01-01T00:00:00Z"},
        {"estimated_delivery_at": "2000-01-01T00:00:00Z"},
        {"estimated_delivery_at": "2026-01-01T00:00:00"},
        {"verification_note": "   "},
        {"original_delivery_due_at": "2999-01-01T00:00:00Z"},
    ],
)
def test_invalid_confirmation_does_not_change_source_or_create_audit(case, invalid):
    db, client, order, _, _, _, _, payload = case
    original = order.data_verified_at
    payload.update(invalid)
    response = verify(client, order, payload)
    assert response.status_code == 422, response.text
    db.refresh(order)
    assert order.data_verified_at == original
    assert (
        db.scalar(
            select(func.count())
            .select_from(OrderDataVerification)
            .where(
                OrderDataVerification.order_id == order.id,
            )
        )
        == 0
    )


def test_vietnam_input_uses_actual_instant_and_missing_order_returns_404(case):
    _, client, order, _, _, _, _, payload = case
    payload.update(
        delivery_status="DISPATCHED",
        dispatched_at="2026-01-01T10:00:00+07:00",
    )
    response = verify(client, order, payload)
    assert response.status_code == 200, response.text
    actual = datetime.fromisoformat(response.json()["dispatched_at"])
    assert actual == datetime(2026, 1, 1, 3, tzinfo=UTC)
    assert client.post(f"/api/v1/orders/{uuid4()}/verify-data", json=payload).status_code == 404
