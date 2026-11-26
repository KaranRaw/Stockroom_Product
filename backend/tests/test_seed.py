from contextlib import contextmanager
from decimal import Decimal
from urllib.parse import urlsplit
import pytest
from pydantic import ValidationError
from sqlalchemy import func, select
from app import seed
from app.categories import get_or_create_category
from app.models import Category, Product
from app.schemas import ProductWrite


def test_seed_dataset_contains_thirty_valid_illustrated_products():
    rows = seed.DEMO_PRODUCTS
    assert len(rows) == 30
    assert len({row["name"] for row in rows}) == 30
    for row in rows:
        product = ProductWrite.model_validate(row)
        assert product.image_url and urlsplit(product.image_url).scheme == "https"
        assert urlsplit(product.image_url).netloc
        assert product.category and product.price >= 0 and product.quantity >= 0
    quantities = [row["quantity"] for row in rows]
    assert 0 in quantities and any(0 < value <= 5 for value in quantities)
    assert any(value > 5 for value in quantities)


def test_seed_inserts_thirty_products_with_images_and_shared_categories(db_session):
    before_categories = db_session.scalar(select(func.count()).select_from(Category))
    assert seed.seed_products(db_session) == 30
    products = db_session.scalars(select(Product).order_by(Product.id)).all()
    assert len(products) == 30
    for product, row in zip(products, seed.DEMO_PRODUCTS):
        assert product.name == row["name"]
        assert product.description == row["description"]
        assert product.price == Decimal(row["price"])
        assert product.quantity == row["quantity"]
        assert product.category == row["category"]
        assert product.category_id is not None
        assert product.image_url == row["image_url"]
        assert product.created_at is not None and product.is_deleted is False
    assert db_session.scalar(select(func.count()).select_from(Category)) == before_categories
    assert seed.seed_products(db_session) == 0
    assert db_session.scalar(select(func.count()).select_from(Product)) == 30


@pytest.mark.parametrize("deleted", [False, True])
def test_seed_skips_nonempty_catalog_including_deleted_rows(db_session, deleted):
    existing = Product(name="Existing custom product", price=Decimal("23.45"), quantity=7,
                       is_deleted=deleted)
    db_session.add(existing)
    db_session.flush()
    original_id = existing.id
    assert seed.seed_products(db_session) == 0
    db_session.refresh(existing)
    assert db_session.scalar(select(func.count()).select_from(Product)) == 1
    assert existing.id == original_id and existing.name == "Existing custom product"
    assert existing.price == Decimal("23.45") and existing.quantity == 7
    assert existing.image_url is None and existing.is_deleted is deleted


def test_seed_invalid_payload_never_inserts_a_partial_catalog(db_session, monkeypatch):
    rows = [dict(row) for row in seed.DEMO_PRODUCTS]
    rows[-1]["quantity"] = -1
    monkeypatch.setattr(seed, "DEMO_PRODUCTS", rows)
    with pytest.raises(ValidationError):
        seed.seed_products(db_session)
    assert db_session.scalar(select(func.count()).select_from(Product)) == 0


def test_seed_command_commits_once_and_second_run_skips(db_session, monkeypatch, capsys):
    class FixtureSessions:
        @staticmethod
        @contextmanager
        def begin():
            with db_session.begin_nested():
                yield db_session

    monkeypatch.setattr(seed, "SessionLocal", FixtureSessions)
    seed.main()
    assert "Added 30 demo products." in capsys.readouterr().out
    assert db_session.scalar(select(func.count()).select_from(Product)) == 30
    seed.main()
    assert "Skipped: products already exist." in capsys.readouterr().out
    assert db_session.scalar(select(func.count()).select_from(Product)) == 30


def test_seed_command_rolls_back_category_creation_after_failure(db_session, monkeypatch):
    class FixtureSessions:
        @staticmethod
        @contextmanager
        def begin():
            with db_session.begin_nested():
                yield db_session

    rows = [dict(seed.DEMO_PRODUCTS[0], category="Seed category A"),
            dict(seed.DEMO_PRODUCTS[1], category="Seed category B")]
    monkeypatch.setattr(seed, "DEMO_PRODUCTS", rows)
    monkeypatch.setattr(seed, "SessionLocal", FixtureSessions)

    def fail_second_category(session, name):
        if name == "Seed category B":
            raise RuntimeError("Simulated seed failure")
        return get_or_create_category(session, name)

    monkeypatch.setattr(seed, "get_or_create_category", fail_second_category)
    with pytest.raises(RuntimeError, match="Simulated seed failure"):
        seed.main()
    assert db_session.scalar(select(func.count()).select_from(Product)) == 0
    assert db_session.scalar(select(Category).where(Category.name == "Seed category A")) is None


def test_seeded_catalog_supports_api_edit_and_soft_delete(client, db_session):
    assert seed.seed_products(db_session) == 30
    listing = client.get("/api/products", params={"page_size": 100})
    assert listing.status_code == 200 and listing.json()["total"] == 30
    assert len(listing.json()["items"]) == 30
    assert all(item["image_url"].startswith("https://") for item in listing.json()["items"])
    product = next(item for item in listing.json()["items"] if item["name"] == seed.DEMO_PRODUCTS[0]["name"])
    path = f"/api/products/{product['id']}"
    assert client.get(path).json()["image_url"] == seed.DEMO_PRODUCTS[0]["image_url"]
    assert client.patch(path, json={"quantity": 1}).json()["quantity"] == 1
    assert client.delete(path).status_code == 204
    assert client.get(path).status_code == 404
    assert client.get("/api/products/stats").json()["products"] == 29
    # Reseeding never adds duplicates or revives the deleted product.
    assert seed.seed_products(db_session) == 0
    assert client.get("/api/products").json()["total"] == 29
    assert db_session.scalar(select(func.count()).select_from(Product)) == 30
