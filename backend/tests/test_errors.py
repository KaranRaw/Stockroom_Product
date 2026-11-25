from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError
from app.database import get_session
from app.main import app


def test_database_failure_is_generic_and_503():
    def fail_session():
        raise OperationalError("SELECT secret", {}, Exception("private connection credentials"))
        yield  # pragma: no cover -- keep this a generator dependency
    app.dependency_overrides[get_session] = fail_session
    try:
        with TestClient(app) as client:
            response = client.get("/api/products")
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "DATABASE_UNAVAILABLE"
        assert "private" not in response.text
        assert "SELECT" not in response.text
    finally:
        app.dependency_overrides.clear()


def test_unexpected_error_is_generic_and_500():
    app.dependency_overrides[get_session] = lambda: object()
    try:
        with patch("app.routes.services.list_products", side_effect=RuntimeError("private diagnostic")):
            with TestClient(app, raise_server_exceptions=False) as client:
                response = client.get("/api/products")
        assert response.status_code == 500
        assert response.json()["error"]["code"] == "INTERNAL_ERROR"
        assert "private diagnostic" not in response.text
    finally:
        app.dependency_overrides.clear()


def test_openapi_documents_error_contract():
    schema = app.openapi()
    response = schema["paths"]["/api/products"]["get"]["responses"]["422"]
    assert response["content"]["application/json"]["schema"]["$ref"].endswith("ErrorResponse")
