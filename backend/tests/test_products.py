import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

PRODUCT = {"name": "Desk lamp", "description": "Adjustable light",
           "price": "149.90", "quantity": 4, "category": "Lighting"}


def create(client, **changes):
    response = client.post("/api/products", json={**PRODUCT, **changes})
    assert response.status_code == 201, response.text
    return response


def test_complete_crud_flow(client):
    response = create(client)
    product = response.json()
    product_id = product["id"]
    assert response.headers["location"] == f"/api/products/{product_id}"
    assert product["price"] == "149.90"
    assert product["created_at"]
    assert client.get(f"/api/products/{product_id}").json() == product
    assert any(p["id"] == product_id for p in client.get("/api/products").json()["items"])
    updated = client.put(f"/api/products/{product_id}", json={**PRODUCT, "name": "New lamp", "quantity": 0})
    assert updated.status_code == 200
    assert updated.json()["name"] == "New lamp"
    assert updated.json()["created_at"] == product["created_at"]
    deleted = client.delete(f"/api/products/{product_id}")
    assert deleted.status_code == 204
    assert deleted.content == b""
    assert client.get(f"/api/products/{product_id}").status_code == 404
    assert client.delete(f"/api/products/{product_id}").status_code == 404


def test_search_is_case_insensitive_and_literal(client):
    create(client, name="Alpha%_Lamp")
    create(client, name="AlphaZZLamp")
    assert client.get("/api/products", params={"search": "alpha"}).json()["total"] == 2
    matches = client.get("/api/products", params={"search": "%_"}).json()
    assert matches["total"] == 1
    assert matches["items"][0]["name"] == "Alpha%_Lamp"
    assert client.get("/api/products", params={"search": "' OR 1=1 --"}).json()["total"] == 0


def test_pagination_has_stable_order_and_accurate_count(client):
    for i in range(3):
        create(client, name=f"Pagination fixture {i}")
    first = client.get("/api/products?search=Pagination&page_size=2").json()
    second = client.get("/api/products?search=Pagination&page_size=2&page=2").json()
    assert first["total"] == second["total"] == 3
    assert len(first["items"]) == 2 and len(second["items"]) == 1
    assert not ({p["id"] for p in first["items"]} & {p["id"] for p in second["items"]})
    assert client.get("/api/products?page=999999").json()["items"] == []


@pytest.mark.parametrize("changes", [
    {"name": " "}, {"price": "-1"}, {"price": "10.001"},
    {"quantity": -2}, {"quantity": 1.2}, {"id": 12},
])
def test_invalid_create_does_not_persist(client, changes):
    before = client.get("/api/products").json()["total"]
    response = client.post("/api/products", json={**PRODUCT, **changes})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert response.json()["error"]["details"]
    assert client.get("/api/products").json()["total"] == before


def test_invalid_update_does_not_change_product(client):
    product = create(client).json()
    response = client.put(f"/api/products/{product['id']}", json={**PRODUCT, "price": "-5"})
    assert response.status_code == 422
    assert client.get(f"/api/products/{product['id']}").json() == product


@pytest.mark.parametrize("query", ["page=0", "page_size=0", "page_size=101", "page=abc"])
def test_invalid_pagination(client, query):
    assert client.get(f"/api/products?{query}").status_code == 422


def test_missing_products_and_invalid_ids(client):
    assert client.get("/api/products/2147483647").json()["error"]["code"] == "NOT_FOUND"
    assert client.put("/api/products/2147483647", json=PRODUCT).status_code == 404
    assert client.get("/api/products/0").status_code == 422
    assert client.get("/api/products/abc").status_code == 422


def test_stats_use_decimal_arithmetic(client):
    before = client.get("/api/products/stats").json()
    create(client, price="0.10", quantity=3)
    from decimal import Decimal
    after = client.get("/api/products/stats").json()
    assert after["products"] == before["products"] + 1
    assert after["units"] == before["units"] + 3
    assert Decimal(after["value"]) - Decimal(before["value"]) == Decimal("0.30")
    assert after["low_stock"] == before["low_stock"] + 1


@pytest.mark.parametrize("column,value", [("price", "-1"), ("price", "'NaN'::numeric"), ("quantity", "-1"), ("name", "' '")])
def test_database_rejects_invalid_direct_inserts(db_session, column, value):
    values = {"name": "'Direct insert'", "price": "1.00", "quantity": "1"}
    values[column] = value
    # Only fixed test constants are interpolated here; application queries are parameterized.
    statement = f"INSERT INTO products (name, price, quantity) VALUES ({values['name']}, {values['price']}, {values['quantity']})"
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            db_session.execute(text(statement))
