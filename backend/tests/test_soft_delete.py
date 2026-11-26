from datetime import timezone
from decimal import Decimal
import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

PRODUCT = {"name": "Soft delete fixture", "price": "12.50", "quantity": 3,
           "description": "Keep this description", "category": "Test",
           "image_url": "https://example.com/image.jpg"}


def create(client):
    response = client.post("/api/products", json=PRODUCT)
    assert response.status_code == 201
    return response.json()


def test_delete_retains_the_complete_row(client, db_session):
    original = create(client)
    product_id = original["id"]
    response = client.delete(f"/api/products/{product_id}")
    assert response.status_code == 204
    assert response.content == b""
    row = db_session.execute(
        text("SELECT p.*, c.name AS category FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.id = :id"), {"id": product_id}
    ).mappings().one()
    assert row["is_deleted"] is True
    assert row["name"] == original["name"]
    assert row["price"] == Decimal(original["price"])
    assert row["quantity"] == original["quantity"]
    assert row["description"] == original["description"]
    assert row["category"] == original["category"]
    assert row["image_url"] == original["image_url"]
    assert row["created_at"].astimezone(timezone.utc).isoformat().replace("+00:00", "Z") == original["created_at"]


def test_deleted_products_are_hidden_from_all_public_queries(client):
    original = create(client)
    path = f"/api/products/{original['id']}"
    before = client.get("/api/products/stats").json()
    before_total = client.get("/api/products").json()["total"]
    assert client.delete(path).status_code == 204
    assert client.get(path).status_code == 404
    result = client.get("/api/products", params={"search": PRODUCT["name"]}).json()
    assert result["items"] == [] and result["total"] == 0
    assert client.get("/api/products").json()["total"] == before_total - 1
    after = client.get("/api/products/stats").json()
    assert after["products"] == before["products"] - 1
    assert after["units"] == before["units"] - PRODUCT["quantity"]
    assert Decimal(before["value"]) - Decimal(after["value"]) == Decimal("37.50")
    assert after["low_stock"] == before["low_stock"] - 1


def test_deleted_products_cannot_be_modified_or_deleted_again(client, db_session):
    original = create(client)
    path = f"/api/products/{original['id']}"
    assert client.delete(path).status_code == 204
    assert client.put(path, json=PRODUCT).status_code == 404
    assert client.patch(path, json={"quantity": 99}).status_code == 404
    assert client.delete(path).status_code == 404
    row = db_session.execute(text("SELECT is_deleted, quantity FROM products WHERE id=:id"),
                             {"id": original["id"]}).one()
    assert row.is_deleted is True and row.quantity == PRODUCT["quantity"]


@pytest.mark.parametrize("method", ["post", "put", "patch"])
def test_clients_cannot_control_the_deletion_flag(client, method):
    original = create(client)
    path = "/api/products" if method == "post" else f"/api/products/{original['id']}"
    body = {"is_deleted": True} if method == "patch" else {**PRODUCT, "is_deleted": True}
    response = getattr(client, method)(path, json=body)
    assert response.status_code == 422
    assert client.get(f"/api/products/{original['id']}").status_code == 200


def test_database_flag_defaults_to_false_and_rejects_null(db_session):
    product_id = db_session.scalar(text(
        "INSERT INTO products (name, price, quantity) VALUES ('Direct fixture', 1, 0) RETURNING id"
    ))
    assert db_session.scalar(text("SELECT is_deleted FROM products WHERE id=:id"),
                             {"id": product_id}) is False
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            db_session.execute(text(
                "INSERT INTO products (name, price, quantity, is_deleted) "
                "VALUES ('Invalid null', 1, 0, NULL)"
            ))


def test_soft_delete_column_and_partial_indexes(db_session):
    column = db_session.execute(text(
        "SELECT data_type, is_nullable, column_default FROM information_schema.columns "
        "WHERE table_schema='public' AND table_name='products' AND column_name='is_deleted'"
    )).one()
    assert column.data_type == "boolean"
    assert column.is_nullable == "NO"
    assert column.column_default == "false"
    definitions = dict(db_session.execute(text(
        "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' "
        "AND tablename='products'"
    )).all())
    for name in ("ix_products_name_trgm", "ix_products_created_id"):
        assert "is_deleted IS FALSE" in definitions[name]



def test_stale_product_reference_cannot_update_a_deleted_row(client, db_session):
    from fastapi import HTTPException
    from app.models import Product
    from app.schemas import ProductPatch
    from app.services import save_product

    original = create(client)
    stale = db_session.get(Product, original["id"])
    db_session.execute(text("UPDATE products SET is_deleted=TRUE WHERE id=:id"),
                       {"id": original["id"]})
    with pytest.raises(HTTPException) as error:
        save_product(db_session, ProductPatch(quantity=99), stale)
    assert error.value.status_code == 404
    row = db_session.execute(text("SELECT is_deleted, quantity FROM products WHERE id=:id"),
                             {"id": original["id"]}).one()
    assert row.is_deleted is True
    assert row.quantity == original["quantity"]
