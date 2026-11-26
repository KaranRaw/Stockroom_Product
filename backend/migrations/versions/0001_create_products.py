"""Create products with constraints and indexes for search and pagination."""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # The migration role needs permission to install this trusted extension.
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    # Supabase may keep trusted extensions in its extensions schema.
    op.execute("SET LOCAL search_path TO public, extensions")
    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), sa.Identity(), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("price", sa.Numeric(12, 2), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(100)),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("length(btrim(name)) > 0", name="ck_products_name"),
        sa.CheckConstraint("price >= 0 AND price <> 'NaN'::numeric", name="ck_products_price"),
        sa.CheckConstraint("quantity >= 0", name="ck_products_quantity"),
        sa.CheckConstraint("description IS NULL OR length(description) <= 5000",
                           name="ck_products_description"),
    )
    op.execute("CREATE INDEX ix_products_name_trgm ON products USING gin (name gin_trgm_ops) WHERE is_deleted IS FALSE")
    op.execute("CREATE INDEX ix_products_created_id ON products (created_at DESC, id DESC) WHERE is_deleted IS FALSE")


def downgrade():
    op.drop_table("products")
    # Do not drop pg_trgm: another application may share the extension.
