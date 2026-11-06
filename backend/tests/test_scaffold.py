from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_orders_require_authentication():
    response = client.get("/api/v1/orders")
    assert response.status_code == 401
    assert response.json()["code"] == "HTTP_401"


def test_docs_expose_expected_routes():
    paths = client.get("/openapi.json").json()["paths"]
    assert "/api/v1/orders/{order_id}" in paths
    assert "/api/v1/incidents/{incident_id}/resolve" in paths
