"""Persist reusable categories and preserve existing product category names."""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

DEFAULT_NAMES = ["Electronics", "Workspace", "Home & living", "Accessories", "Stationery"]


def upgrade():
    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), sa.Identity(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("name = btrim(name) AND name ~ '[^[:space:]]'",
                           name="ck_categories_name"),
    )
    op.execute("CREATE UNIQUE INDEX uq_categories_name_lower ON categories (lower(name))")
    table = sa.table("categories", sa.column("name", sa.String(100)))
    op.bulk_insert(table, [{"name": name} for name in DEFAULT_NAMES])
    # Backfill every product, including soft-deleted records, before removing text.
    op.execute("""
        INSERT INTO categories (name)
        SELECT DISTINCT ON (lower(cleaned)) cleaned
        FROM (
            SELECT id, btrim(regexp_replace(category, '[[:space:]]+', ' ', 'g')) AS cleaned
            FROM products WHERE category IS NOT NULL
        ) AS existing
        WHERE cleaned <> ''
        ORDER BY lower(cleaned), id
        ON CONFLICT DO NOTHING
    """)
    op.add_column("products", sa.Column("category_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_products_category_id_categories", "products", "categories",
                          ["category_id"], ["id"], ondelete="RESTRICT")
    op.execute("""
        UPDATE products AS p SET category_id = c.id
        FROM categories AS c
        WHERE lower(c.name) =
            lower(btrim(regexp_replace(p.category, '[[:space:]]+', ' ', 'g')))
    """)
    op.create_index("ix_products_category_id", "products", ["category_id"])
    op.drop_column("products", "category")


def downgrade():
    op.add_column("products", sa.Column("category", sa.String(100), nullable=True))
    op.execute("""
        UPDATE products AS p SET category = c.name
        FROM categories AS c WHERE p.category_id = c.id
    """)
    op.drop_index("ix_products_category_id", table_name="products")
    op.drop_constraint("fk_products_category_id_categories", "products", type_="foreignkey")
    op.drop_column("products", "category_id")
    op.drop_index("uq_categories_name_lower", table_name="categories")
    op.drop_table("categories")
