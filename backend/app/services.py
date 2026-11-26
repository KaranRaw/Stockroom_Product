from fastapi import HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session
from app.models import Product
from app.categories import get_or_create_category
from app.schemas import ProductPatch, ProductWrite


def require_product(session: Session, product_id: int) -> Product:
    product = session.scalar(select(Product).where(
        Product.id == product_id, Product.is_deleted.is_(False)
    ))
    if product is None:
        raise HTTPException(404, "Product not found")
    return product


def list_products(session: Session, search: str, page: int, page_size: int):
    filters = [Product.is_deleted.is_(False)]
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
    values = data.model_dump(exclude_unset=isinstance(data, ProductPatch))
    if "category" in values:
        name = values.pop("category")
        values["category_id"] = get_or_create_category(session, name)[0].id if name else None
    if product is None:
        product = Product(**values)
        session.add(product)
    else:
        # Recheck active status in the write itself, including stale/concurrent edits.
        updated_id = session.scalar(
            update(Product)
            .where(Product.id == product.id, Product.is_deleted.is_(False))
            .values(**values)
            .returning(Product.id)
        )
        if updated_id is None:
            raise HTTPException(404, "Product not found")
    session.commit()
    session.refresh(product)
    return product


def inventory_stats(session: Session):
    row = session.execute(select(
        func.count(Product.id),
        func.coalesce(func.sum(Product.quantity), 0),
        func.coalesce(func.sum(Product.price * Product.quantity), 0),
        func.count(Product.id).filter(Product.quantity <= 5),
    ).where(Product.is_deleted.is_(False))).one()
    return dict(zip(["products", "units", "value", "low_stock"], row))


def soft_delete_product(session: Session, product_id: int) -> None:
    # One conditional UPDATE makes concurrent/repeated deletes deterministic.
    deleted_id = session.scalar(
        update(Product)
        .where(Product.id == product_id, Product.is_deleted.is_(False))
        .values(is_deleted=True)
        .returning(Product.id)
    )
    if deleted_id is None:
        raise HTTPException(404, "Product not found")
    session.commit()
