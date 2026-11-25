from datetime import datetime
from decimal import Decimal
from sqlalchemy import CheckConstraint, DateTime, Identity, Index, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        Index("ix_products_name_trgm", "name", postgresql_using="gin",
              postgresql_ops={"name": "gin_trgm_ops"}),
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
    category: Mapped[str | None] = mapped_column(String(100))
    image_url: Mapped[str | None] = mapped_column(String(2048))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


Index("ix_products_created_id", Product.created_at.desc(), Product.id.desc())
