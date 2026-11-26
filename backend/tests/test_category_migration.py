import importlib.util
from pathlib import Path
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import text


def test_category_migration_backfills_existing_and_deleted_products(db_session, monkeypatch):
    # Exercise both directions on the fixture connection; its outer rollback
    # restores the current schema, so no separate database or destructive reset is needed.
    path = Path(__file__).resolve().parents[1] / "migrations" / "versions" / "0003_shared_categories.py"
    spec = importlib.util.spec_from_file_location("category_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    monkeypatch.setattr(migration, "op", Operations(MigrationContext.configure(db_session.connection())))
    migration.downgrade()
    ids = db_session.execute(text(
        "INSERT INTO products (name, price, quantity, category, is_deleted) VALUES "
        "('Legacy phone', 1.25, 2, ' Smartphone ', FALSE),"
        "('Deleted phone', 2.50, 3, 'smartphone', TRUE),"
        "('No category', 0, 0, '   ', FALSE) RETURNING id"
    )).scalars().all()
    migration.upgrade()
    rows = db_session.execute(text(
        "SELECT p.id, p.is_deleted, p.price, p.category_id, c.name "
        "FROM products p LEFT JOIN categories c ON c.id=p.category_id "
        "WHERE p.id IN (:one,:two,:three) ORDER BY p.id"
    ), dict(zip(["one", "two", "three"], ids))).mappings().all()
    assert len(rows) == 3
    assert rows[0]["category_id"] == rows[1]["category_id"]
    assert rows[0]["name"] == rows[1]["name"] == "Smartphone"
    assert rows[1]["is_deleted"] is True
    assert str(rows[1]["price"]) == "2.50"
    assert rows[2]["category_id"] is None
    migration.downgrade()
    names = db_session.execute(text(
        "SELECT category FROM products WHERE id IN (:one,:two) ORDER BY id"
    ), {"one": ids[0], "two": ids[1]}).scalars().all()
    assert names == ["Smartphone", "Smartphone"]
    migration.upgrade()
