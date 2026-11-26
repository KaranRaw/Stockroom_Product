from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session
from app.models import Category


def list_categories(session: Session):
    return session.scalars(select(Category).order_by(func.lower(Category.name), Category.id)).all()


def get_or_create_category(session: Session, name: str) -> tuple[Category, bool]:
    normalized = " ".join(name.split())
    # The unique expression index arbitrates concurrent/case-equivalent requests.
    category_id = session.scalar(
        insert(Category).values(name=normalized)
        .on_conflict_do_nothing(index_elements=[func.lower(Category.name)])
        .returning(Category.id)
    )
    created = category_id is not None
    if created:
        category = session.get(Category, category_id)
    else:
        category = session.scalar(
            select(Category).where(func.lower(Category.name) == func.lower(normalized))
        )
    if category is None:
        raise RuntimeError("Unable to resolve category after upsert")
    return category, created
