"""Optional sample catalog. Never runs automatically on application startup."""
import json
from pathlib import Path
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session
from app.categories import get_or_create_category
from app.database import SessionLocal
from app.models import Product
from app.schemas import ProductWrite

# Bundled data keeps seeding deterministic and independent of image/API availability.
DEMO_PRODUCTS = json.loads(Path(__file__).with_name("seed_products.json").read_text(encoding="utf-8"))


def seed_products(session: Session) -> int:
    """Stage a complete catalog in the caller's transaction, or leave existing data untouched."""
    # Serialize concurrent seed commands before checking whether the catalog is empty.
    session.execute(text("SELECT pg_advisory_xact_lock(826260130)"))
    # Include soft-deleted rows: rerunning seed must never resurrect deleted products.
    if session.scalar(select(func.count()).select_from(Product)):
        return 0

    # Validate the whole dataset with the API rules before inserting categories/products.
    products = [ProductWrite.model_validate(item) for item in DEMO_PRODUCTS]
    category_ids = {
        name: get_or_create_category(session, name)[0].id
        for name in sorted({product.category for product in products if product.category})
    }
    for product in products:
        values = product.model_dump()
        category = values.pop("category")
        session.add(Product(**values, category_id=category_ids.get(category)))
    session.flush()
    return len(products)


def main():
    # One transaction covers category creation and all product inserts; failures roll back.
    with SessionLocal.begin() as session:
        inserted = seed_products(session)
    print(f"Added {inserted} demo products." if inserted else "Skipped: products already exist.")


if __name__ == "__main__":
    main()
