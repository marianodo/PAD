"""
Test fixtures for PAD backend tests.
Uses an in-memory SQLite database to avoid needing a real PostgreSQL instance.
"""

import uuid
import secrets

import bcrypt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, JSON
from sqlalchemy.orm import sessionmaker
from sqlalchemy.dialects.postgresql import JSONB, INET
from sqlalchemy.ext.compiler import compiles

# Register PostgreSQL types -> SQLite equivalents
@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"

@compiles(INET, "sqlite")
def compile_inet_sqlite(type_, compiler, **kw):
    return "VARCHAR(45)"

import os
os.environ["TESTING"] = "1"
# SECRET_KEY válido para que el fail-fast de config.py no impida arrancar en tests
os.environ.setdefault("SECRET_KEY", secrets.token_urlsafe(48))

from app.db.base import Base, get_db
from app.main import app
from app.models.user import User
from app.models.client import Client
from app.models.user_client import UserClient
from app.models.points import UserPoints, PointTransaction
from app.models.provider import Provider, ProviderClient
from app.models.electoral_roll import ElectoralRoll
from app.models.integration_audit import IntegrationAuditLog
from app.core.security import get_password_hash


# SQLite file-based engine for testing
SQLALCHEMY_TEST_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_TEST_URL,
    connect_args={"check_same_thread": False},
)


# Enable FK constraints in SQLite
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_database():
    """Create all tables before each test, drop after."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    """Provide a test database session."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    """Provide a FastAPI test client with overridden DB dependency."""
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# --- Data fixtures ---

@pytest.fixture
def sample_client(db) -> Client:
    """Create a sample municipality client."""
    c = Client(
        id=uuid.uuid4(),
        email="muni.test@example.com",
        hashed_password=get_password_hash("test123"),
        name="Municipalidad de Test",
        cuit="30999888777",
        city="Test City",
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@pytest.fixture
def another_client(db) -> Client:
    """Create a second municipality client."""
    c = Client(
        id=uuid.uuid4(),
        email="muni.other@example.com",
        hashed_password=get_password_hash("test123"),
        name="Municipalidad Otra",
        cuit="30111222333",
        city="Other City",
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@pytest.fixture
def sample_user(db, sample_client) -> User:
    """Create a sample citizen user linked to sample_client."""
    u = User(
        id=uuid.uuid4(),
        cuil="20345678901",
        email="citizen@example.com",
        hashed_password=get_password_hash("pass123"),
        name="Juan Test",
        client_id=sample_client.id,
    )
    db.add(u)
    db.flush()
    db.add(UserClient(id=uuid.uuid4(), user_id=u.id, client_id=sample_client.id))
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture
def user_without_client(db) -> User:
    """Create a citizen user NOT linked to any client."""
    u = User(
        id=uuid.uuid4(),
        cuil="20111222333",
        email="unlinked@example.com",
        hashed_password=get_password_hash("pass123"),
        name="Sin Municipio",
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture
def user_other_client(db, another_client) -> User:
    """Create a citizen user linked to another_client."""
    u = User(
        id=uuid.uuid4(),
        cuil="20999888777",
        email="other.citizen@example.com",
        hashed_password=get_password_hash("pass123"),
        name="Pedro Otro",
        client_id=another_client.id,
    )
    db.add(u)
    db.flush()
    db.add(UserClient(id=uuid.uuid4(), user_id=u.id, client_id=another_client.id))
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture
def sample_user_points(db, sample_user) -> UserPoints:
    """Create points for the sample user."""
    up = UserPoints(
        id=uuid.uuid4(),
        user_id=sample_user.id,
        total_points=150,
        available_points=100,
        redeemed_points=50,
    )
    db.add(up)
    db.commit()
    db.refresh(up)
    return up


@pytest.fixture
def sample_api_key():
    """Generate a raw API key for testing."""
    return secrets.token_urlsafe(48)


@pytest.fixture
def sample_provider(db, sample_client, sample_api_key) -> Provider:
    """Create a provider linked to sample_client with a known API key."""
    api_key_hash = bcrypt.hashpw(
        sample_api_key.encode("utf-8"),
        bcrypt.gensalt()
    ).decode("utf-8")

    provider = Provider(
        id=uuid.uuid4(),
        name="Proveedor Test",
        api_key_hash=api_key_hash,
        api_key_prefix=sample_api_key[:8],
        is_active=True,
    )
    db.add(provider)
    db.flush()

    pc = ProviderClient(
        id=uuid.uuid4(),
        provider_id=provider.id,
        client_id=sample_client.id,
        is_active=True,
    )
    db.add(pc)
    db.commit()
    db.refresh(provider)
    return provider


@pytest.fixture
def inactive_provider(db, sample_client) -> tuple:
    """Create an inactive provider and return (provider, raw_api_key)."""
    raw_key = secrets.token_urlsafe(48)
    api_key_hash = bcrypt.hashpw(
        raw_key.encode("utf-8"),
        bcrypt.gensalt()
    ).decode("utf-8")

    provider = Provider(
        id=uuid.uuid4(),
        name="Proveedor Inactivo",
        api_key_hash=api_key_hash,
        api_key_prefix=raw_key[:8],
        is_active=False,
    )
    db.add(provider)
    db.flush()

    pc = ProviderClient(
        id=uuid.uuid4(),
        provider_id=provider.id,
        client_id=sample_client.id,
        is_active=True,
    )
    db.add(pc)
    db.commit()
    return provider, raw_key


def api_key_header(api_key: str) -> dict:
    """Helper to create the X-API-Key header."""
    return {"X-API-Key": api_key}
