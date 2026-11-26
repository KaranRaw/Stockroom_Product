from datetime import datetime
from decimal import Decimal
from sqlalchemy import (
    Boolean, CheckConstraint, DateTime, ForeignKey, Identity, Index,
    Integer, Numeric, String, Text, false, func, text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (
        CheckConstraint("name = btrim(name) AND name ~ '[^[:space:]]'",
                        name="ck_categories_name"),
    )

    id: Mapped[int] = mapped_column(Integer, Identity(), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


Index("uq_categories_name_lower", func.lower(Category.name), unique=True)


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        Index("ix_products_name_trgm", "name", postgresql_using="gin",
              postgresql_ops={"name": "gin_trgm_ops"},
              postgresql_where=text("is_deleted IS FALSE")),
        Index("ix_products_category_id", "category_id"),
        CheckConstraint("length(btrim(name)) > 0", name="ck_products_name"),
        CheckConstraint("price >= 0 AND price <> 'NaN'::numeric", name="ck_products_price"),
        CheckConstraint("quantity >= 0", name="ck_products_quantity"),
        CheckConstraint("image_url IS NULL OR image_url ~ '^https://[^[:space:]]+$'",
                        name="ck_products_image_url"),
        CheckConstraint("description IS NULL OR length(description) <= 5000",
                        name="ck_products_description"),
    )

    id: Mapped[int] = mapped_column(Integer, Identity(), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", name="fk_products_category_id_categories", ondelete="RESTRICT"),
        nullable=True,
    )
    # A joined many-to-one load avoids a separate category query for every list row.
    category_record: Mapped[Category | None] = relationship(lazy="joined")
    image_url: Mapped[str | None] = mapped_column(String(2048))
    is_deleted: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    @property
    def category(self) -> str | None:
        # Keep the public product API compatible with its category-name contract.
        return self.category_record.name if self.category_record is not None else None


Index("ix_products_created_id", Product.created_at.desc(), Product.id.desc(),
      postgresql_where=Product.is_deleted.is_(False))
