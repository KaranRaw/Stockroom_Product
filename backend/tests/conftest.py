import os
import pytest

TEST_URL = os.getenv("TEST_DATABASE_URL")
if TEST_URL:
    from sqlalchemy.engine import make_url
    if "test" not in (make_url(TEST_URL).database or "").lower():
        raise RuntimeError("TEST_DATABASE_URL must name a dedicated database containing 'test'.")
    os.environ["DATABASE_URL"] = TEST_URL


@pytest.fixture(scope="session")
def db_engine():
    if not TEST_URL:
        pytest.skip("Set TEST_DATABASE_URL to run PostgreSQL integration tests.")
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import create_engine
    command.upgrade(Config("alembic.ini"), "head")
    engine = create_engine(TEST_URL)
    yield engine
    engine.dispose()


@pytest.fixture
def db_session(db_engine):
    from sqlalchemy.orm import Session
    # Savepoints allow application commits without leaking test data.
    with db_engine.connect() as connection:
        transaction = connection.begin()
        with Session(bind=connection, join_transaction_mode="create_savepoint") as session:
            yield session
        transaction.rollback()


@pytest.fixture
def client(db_session):
    from fastapi.testclient import TestClient
    from app.main import app
    from app.database import get_session
    app.dependency_overrides[get_session] = lambda: db_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
