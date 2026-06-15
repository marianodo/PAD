from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text, inspect
from app.core.config import settings
from app.api.api import api_router
from app.db.base import engine, Base
from dotenv import load_dotenv
import os

# Cargar .env file
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(env_path)

# Crear tablas y ejecutar migraciones solo si no estamos en modo testing
_TESTING = os.environ.get("TESTING", "").lower() in ("1", "true", "yes")

if not _TESTING:
    Base.metadata.create_all(bind=engine)

    # Migraciones manuales: agregar columnas nuevas a tablas existentes
    with engine.connect() as conn:
        inspector = inspect(engine)

        # Migración: agregar gender a users
        user_columns = [col["name"] for col in inspector.get_columns("users")]
        if "gender" not in user_columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN gender VARCHAR(20)"))
            conn.commit()

        # Migración: agregar image_url a question_options
        qo_columns = [col["name"] for col in inspector.get_columns("question_options")]
        if "image_url" not in qo_columns:
            conn.execute(text("ALTER TABLE question_options ADD COLUMN image_url TEXT"))
            conn.commit()

        # Migración: agregar client_id a users
        if "client_id" not in user_columns:
            conn.execute(text(
                "ALTER TABLE users ADD COLUMN client_id UUID REFERENCES clients(id)"
            ))
            conn.commit()

        # Migración: agregar reference_id a point_transactions
        if inspector.has_table("point_transactions"):
            pt_columns = [col["name"] for col in inspector.get_columns("point_transactions")]
            if "reference_id" not in pt_columns:
                conn.execute(text(
                    "ALTER TABLE point_transactions ADD COLUMN reference_id VARCHAR(255) UNIQUE"
                ))
                conn.commit()

        # Migración: jerarquía de clientes (parent_id)
        client_columns = [col["name"] for col in inspector.get_columns("clients")]
        if "parent_id" not in client_columns:
            conn.execute(text(
                "ALTER TABLE clients ADD COLUMN parent_id UUID REFERENCES clients(id) ON DELETE SET NULL"
            ))
            conn.commit()

        # Migración: encuestas públicas (is_public)
        survey_columns = [col["name"] for col in inspector.get_columns("surveys")]
        if "is_public" not in survey_columns:
            conn.execute(text(
                "ALTER TABLE surveys ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT FALSE"
            ))
            conn.commit()

        # Backfill: membresías user_clients a partir de users.client_id (una sola vez)
        if inspector.has_table("user_clients"):
            count = conn.execute(text("SELECT COUNT(*) FROM user_clients")).scalar()
            if count == 0:
                conn.execute(text("""
                    INSERT INTO user_clients (id, user_id, client_id)
                    SELECT gen_random_uuid(), id, client_id
                    FROM users
                    WHERE client_id IS NOT NULL
                    ON CONFLICT (user_id, client_id) DO NOTHING
                """))
                conn.commit()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url=f"{settings.API_V1_PREFIX}/docs",
    redoc_url=f"{settings.API_V1_PREFIX}/redoc",
    # Disable redirect_slashes to avoid automatic redirects
    redirect_slashes=False
)

# CORS - Must be added before routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Incluir routers
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/")
def root():
    return {
        "message": "PAD API - Participación Activa Digital",
        "docs": f"{settings.API_V1_PREFIX}/docs",
        "version": "1.0.1"
    }


@app.get("/health")
def health_check():
    return {"status": "ok"}
