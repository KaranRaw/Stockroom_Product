import pytest
from sqlalchemy import text
from pydantic import ValidationError
from app.schemas import ProductPatch, ProductWrite

BASE = {"name": "Studio headphones", "price": "3499.00", "quantity": 12,
        "description": "Wireless over-ear", "category": "Electronics",
        "image_url": "https://example-bucket.s3.amazonaws.com/headphones.jpg"}


def test_patch_updates_only_supplied_fields(client):
    original = client.post("/api/products", json=BASE).json()
    response = client.patch(f"/api/products/{original['id']}", json={"quantity": 3})
    assert response.status_code == 200
    assert response.json() == {**original, "quantity": 3}
    cleared = client.patch(f"/api/products/{original['id']}",
                           json={"description": None, "image_url": None, "category": None})
    assert cleared.status_code == 200
    assert cleared.json()["description"] is None
    assert cleared.json()["image_url"] is None
    assert cleared.json()["category"] is None
    assert cleared.json()["name"] == original["name"]


def test_put_still_requires_a_full_representation(client):
    original = client.post("/api/products", json=BASE).json()
    path = f"/api/products/{original['id']}"
    assert client.put(path, json={"quantity": 3}).status_code == 422
    response = client.put(path, json={"name": "Replacement", "price": "9.99", "quantity": 0})
    assert response.status_code == 200
    assert response.json()["image_url"] is None
    assert response.json()["description"] is None


@pytest.mark.parametrize("body", [
    {}, {"name": None}, {"price": None}, {"quantity": None}, {"quantity": -1},
    {"quantity": 1.5}, {"price": "1.001"}, {"price": True}, {"name": " "},
    {"id": 9}, {"image_url": "javascript:alert(1)"}, {"image_url": "http://example.com/a.jpg"},
])
def test_invalid_patch_is_atomic_and_preserves_existing_data(client, body):
    original = client.post("/api/products", json=BASE).json()
    path = f"/api/products/{original['id']}"
    response = client.patch(path, json=body)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert client.get(path).json() == original


def test_missing_patch_target(client):
    assert client.patch("/api/products/2147483647", json={"quantity": 1}).status_code == 404


def test_image_url_round_trip_and_clear(client):
    response = client.post("/api/products", json=BASE)
    assert response.status_code == 201
    assert response.json()["image_url"] == BASE["image_url"]
    path = f"/api/products/{response.json()['id']}"
    url = "https://cdn.example.com/lamp.webp?version=2&signature=example"
    assert client.patch(path, json={"image_url": url}).json()["image_url"] == url
    assert client.patch(path, json={"image_url": ""}).json()["image_url"] is None


@pytest.mark.parametrize("url", [
    "http://example.com/photo.jpg", "javascript:alert(1)", "data:image/png;base64,abc",
    "https://", "not-a-url", "https://user:password@example.com/a.jpg",
    "https://example.com/my image.jpg", "https://example.com:99999/a.jpg",
    "https://example.com/" + "a" * 2048,
])
def test_image_url_validation(url):
    with pytest.raises(ValidationError):
        ProductWrite(**{**BASE, "image_url": url})


def test_patch_dto_preserves_unset_vs_null():
    assert ProductPatch(quantity=0).model_dump(exclude_unset=True) == {"quantity": 0}
    assert ProductPatch(image_url=None).model_dump(exclude_unset=True) == {"image_url": None}


def test_migration_and_search_indexes_exist(db_session):
    assert db_session.scalar(text("SELECT version_num FROM alembic_version")) == "0002"
    indexes = db_session.execute(text(
        "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'products'"
    )).all()
    definitions = dict(indexes)
    assert "USING gin" in definitions["ix_products_name_trgm"]
    assert "gin_trgm_ops" in definitions["ix_products_name_trgm"]
    assert "created_at DESC, id DESC" in definitions["ix_products_created_id"]
    assert db_session.scalar(text(
        "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' "
        "AND table_name='products' AND column_name='image_url'"
    )) == 1
