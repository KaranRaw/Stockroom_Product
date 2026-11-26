from decimal import Decimal
import pytest
from pydantic import ValidationError
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from app.schemas import CategoryWrite

PRODUCT = {"name": "Phone", "price": "10.00", "quantity": 2, "category": "Smartphone"}


def test_category_is_reusable_across_products_and_independent_requests(client, db_session):
    created = client.post("/api/categories", json={"name": "  Smartphone  "})
    assert created.status_code == 201
    category = created.json()
    assert category["name"] == "Smartphone"
    first = client.post("/api/products", json=PRODUCT)
    second = client.post("/api/products", json={**PRODUCT, "name": "Charger", "category": "Electronics"})
    assert first.status_code == second.status_code == 201
    changed = client.patch(f"/api/products/{second.json()['id']}", json={"category": "smartphone"})
    assert changed.status_code == 200 and changed.json()["category"] == "Smartphone"
    listed = client.get("/api/categories").json()
    assert next(item for item in listed if item["id"] == category["id"])["name"] == "Smartphone"
    ids = db_session.execute(text("SELECT category_id FROM products WHERE id IN (:first, :second)"),
                             {"first": first.json()["id"], "second": second.json()["id"]}).scalars().all()
    assert ids == [category["id"], category["id"]]
    assert db_session.scalar(text("SELECT COUNT(*) FROM categories WHERE lower(name)='smartphone'")) == 1


def test_product_save_also_registers_a_custom_category(client):
    product = client.post("/api/products", json={**PRODUCT, "category": "  Mobile   accessories  "})
    assert product.status_code == 201
    assert product.json()["category"] == "Mobile accessories"
    assert any(item["name"] == "Mobile accessories" for item in client.get("/api/categories").json())


def test_duplicate_categories_reuse_identity_and_original_display_name(client):
    original = client.post("/api/categories", json={"name": "Audio   equipment"}).json()
    duplicate = client.post("/api/categories", json={"name": " audio equipment "})
    assert duplicate.status_code == 200
    assert duplicate.json() == original


def test_unused_category_and_category_of_deleted_product_remain_available(client):
    unused = client.post("/api/categories", json={"name": "Future products"}).json()
    product = client.post("/api/products", json=PRODUCT).json()
    assert client.delete(f"/api/products/{product['id']}").status_code == 204
    names = {item["name"] for item in client.get("/api/categories").json()}
    assert unused["name"] in names and "Smartphone" in names


def test_category_can_be_cleared_without_deleting_the_registry_record(client):
    product = client.post("/api/products", json=PRODUCT).json()
    path = f"/api/products/{product['id']}"
    assert client.patch(path, json={"category": None}).json()["category"] is None
    assert "Smartphone" in {item["name"] for item in client.get("/api/categories").json()}


def test_invalid_product_does_not_create_a_category(client, db_session):
    response = client.post("/api/products", json={**PRODUCT, "price": "-1", "category": "Must not persist"})
    assert response.status_code == 422
    assert db_session.scalar(text("SELECT COUNT(*) FROM categories WHERE name='Must not persist'")) == 0


def test_other_patch_fields_do_not_clear_the_category(client):
    product = client.post("/api/products", json=PRODUCT).json()
    response = client.patch(f"/api/products/{product['id']}", json={"quantity": 9})
    assert response.json()["category"] == "Smartphone"
    assert Decimal(response.json()["price"]) == Decimal(PRODUCT["price"])


@pytest.mark.parametrize("body", [{}, {"name": ""}, {"name": "   "}, {"name": None},
                                  {"name": "x" * 101}, {"name": "Phone", "id": 8}])
def test_invalid_category_request_does_not_write(client, db_session, body):
    before = db_session.scalar(text("SELECT COUNT(*) FROM categories"))
    response = client.post("/api/categories", json=body)
    assert response.status_code == 422
    assert db_session.scalar(text("SELECT COUNT(*) FROM categories")) == before


@pytest.mark.parametrize("value", ["", "  ", "x" * 101, None])
def test_category_dto_rejects_invalid_names(value):
    with pytest.raises(ValidationError):
        CategoryWrite(name=value)


def test_category_database_constraints_and_optional_fk(db_session):
    category_id = db_session.scalar(text("INSERT INTO categories (name) VALUES ('Unique label') RETURNING id"))
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            db_session.execute(text("INSERT INTO categories (name) VALUES ('unique LABEL')"))
    for statement in (
        "INSERT INTO categories (name) VALUES (NULL)",
        "INSERT INTO categories (name) VALUES ('   ')",
        "INSERT INTO products (name, price, quantity, category_id) VALUES ('Bad FK', 1, 1, -1)",
    ):
        with pytest.raises(IntegrityError):
            with db_session.begin_nested():
                db_session.execute(text(statement))
    db_session.execute(text(
        "INSERT INTO products (name, price, quantity, category_id) VALUES ('Linked', 1, 1, :id)"
    ), {"id": category_id})
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            db_session.execute(text("DELETE FROM categories WHERE id=:id"), {"id": category_id})


def test_category_list_is_sorted_and_available_without_products(client):
    client.post("/api/categories", json={"name": "Zebra"})
    client.post("/api/categories", json={"name": "aardvark"})
    names = [item["name"] for item in client.get("/api/categories").json()]
    assert names == sorted(names, key=str.lower)
    assert {"Electronics", "Workspace", "Home & living", "Accessories", "Stationery"} <= set(names)
