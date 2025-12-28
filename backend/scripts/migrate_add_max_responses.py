"""
Script de migración para agregar el campo max_responses_per_user a la tabla surveys
"""
from sqlalchemy import create_engine, text
from app.core.config import settings

def migrate():
    """Agrega la columna max_responses_per_user a la tabla surveys"""
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        # Verificar si la columna ya existe
        result = conn.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name='surveys' AND column_name='max_responses_per_user'
        """))

        if result.fetchone():
            print("✓ La columna max_responses_per_user ya existe")
            return

        # Agregar la columna
        conn.execute(text("""
            ALTER TABLE surveys
            ADD COLUMN max_responses_per_user INTEGER DEFAULT 0
        """))
        conn.commit()

        print("✓ Columna max_responses_per_user agregada exitosamente")
        print("  - Valor por defecto: 0 (respuestas ilimitadas)")
        print("  - Para limitar respuestas, actualiza el valor a un número > 0")

if __name__ == "__main__":
    migrate()
