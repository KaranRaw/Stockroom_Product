from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.models import Product
from app.schemas import ProductPatch, ProductWrite


def require_product(session: Session, product_id: int) -> Product:
    product = session.get(Product, product_id)
    if product is None:
        raise HTTPException(404, "Product not found")
    return product


def list_products(session: Session, search: str, page: int, page_size: int):
    filters = []
    if search.strip():
        # Escape LIKE metacharacters so user input is always a literal substring.
        escaped = search.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        filters.append(Product.name.ilike(f"%{escaped}%", escape="\\"))
    total = session.scalar(select(func.count()).select_from(Product).where(*filters))
    items = session.scalars(
        select(Product).where(*filters).order_by(Product.created_at.desc(), Product.id.desc())
        .offset((page - 1) * page_size).limit(page_size)
    ).all()
    return {"items": items, "total": total, "page": page, "page_size": page_size}


def save_product(session: Session, data: ProductWrite | ProductPatch, product: Product | None = None):
    if product is None:
        product = Product()
        session.add(product)
    for field, value in data.model_dump(exclude_unset=isinstance(data, ProductPatch)).items():
        setattr(product, field, value)
    session.commit()
    session.refresh(product)
    return product


def inventory_stats(session: Session):
    row = session.execute(select(
        func.count(Product.id),
        func.coalesce(func.sum(Product.quantity), 0),
        func.coalesce(func.sum(Product.price * Product.quantity), 0),
        func.count(Product.id).filter(Product.quantity <= 5),
    )).one()
    return dict(zip(["products", "units", "value", "low_stock"], row))
