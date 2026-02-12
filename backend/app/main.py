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

# Crear tablas
Base.metadata.create_all(bind=engine)

# Migraciones manuales: agregar columnas nuevas a tablas existentes
with engine.connect() as conn:
    inspector = inspect(engine)
    columns = [col["name"] for col in inspector.get_columns("users")]
    if "gender" not in columns:
        conn.execute(text("ALTER TABLE users ADD COLUMN gender VARCHAR(20)"))
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
