"""Add an optional product image URL without altering existing product data."""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("products", sa.Column("image_url", sa.String(2048), nullable=True))
    op.create_check_constraint(
        "ck_products_image_url", "products",
        "image_url IS NULL OR image_url ~ '^https://[^[:space:]]+$'",
    )


def downgrade():
    op.drop_constraint("ck_products_image_url", "products", type_="check")
    op.drop_column("products", "image_url")
