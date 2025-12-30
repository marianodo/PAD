"""
Migration script to separate users, admins, and clients into different tables.
"""

import sys
import os
from sqlalchemy import text

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.base import engine


def migrate():
    """Separate users, admins, and clients into different tables"""
    print("Starting migration: Separating users, admins, and clients...")

    with engine.connect() as conn:
        trans = conn.begin()

        try:
            # 1. Crear tabla admins
            print("Creating admins table...")
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS admins (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    email VARCHAR(255) UNIQUE NOT NULL,
                    hashed_password VARCHAR(255) NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """))

            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email)
            """))

            # 2. Crear tabla clients
            print("Creating clients table...")
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS clients (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    email VARCHAR(255) UNIQUE NOT NULL,
                    hashed_password VARCHAR(255) NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    cuit VARCHAR(11) UNIQUE,
                    phone VARCHAR(50),
                    contact_person VARCHAR(255),
                    contact_position VARCHAR(255),
                    address TEXT,
                    city VARCHAR(255),
                    postal_code VARCHAR(20),
                    website VARCHAR(255),
                    description TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """))

            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email)
            """))

            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_clients_cuit ON clients(cuit)
            """))

            # 3. Migrar datos de admins
            print("Migrating admin users...")
            conn.execute(text("""
                INSERT INTO admins (id, email, hashed_password, name, created_at, updated_at)
                SELECT id, email, hashed_password, name, created_at, updated_at
                FROM users
                WHERE role = 'admin'
                ON CONFLICT (email) DO NOTHING
            """))

            # 4. Migrar datos de clients
            print("Migrating client users...")
            conn.execute(text("""
                INSERT INTO clients (id, email, hashed_password, name, cuit, phone, address, city, postal_code, created_at, updated_at)
                SELECT id, email, hashed_password, name, cuil, phone, address, city, postal_code, created_at, updated_at
                FROM users
                WHERE role = 'client'
                ON CONFLICT (email) DO NOTHING
            """))

            # 5. Eliminar constraint viejo de surveys.client_id a users
            print("Dropping old foreign key constraint...")
            conn.execute(text("""
                DO $$ BEGIN
                    ALTER TABLE surveys
                    DROP CONSTRAINT IF EXISTS fk_surveys_client_id;
                EXCEPTION
                    WHEN undefined_object THEN null;
                END $$;
            """))

            # 6. Agregar nuevo constraint de surveys.client_id a clients
            print("Adding new foreign key constraint to clients...")
            conn.execute(text("""
                DO $$ BEGIN
                    ALTER TABLE surveys
                    ADD CONSTRAINT fk_surveys_client_id
                    FOREIGN KEY (client_id) REFERENCES clients(id);
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            """))

            # 7. Eliminar usuarios admin y client de la tabla users (solo los que no tienen respuestas)
            print("Removing admin and client users from users table...")
            conn.execute(text("""
                DELETE FROM users
                WHERE role IN ('admin', 'client')
                AND id NOT IN (SELECT DISTINCT user_id FROM survey_responses WHERE user_id IS NOT NULL)
                AND id NOT IN (SELECT DISTINCT user_id FROM user_points WHERE user_id IS NOT NULL)
                AND id NOT IN (SELECT DISTINCT user_id FROM point_transactions WHERE user_id IS NOT NULL)
            """))

            # 8. Eliminar columna role de users
            print("Dropping role column from users table...")
            conn.execute(text("""
                ALTER TABLE users DROP COLUMN IF EXISTS role
            """))

            # 9. Eliminar enum type userrole
            print("Dropping userrole enum type...")
            conn.execute(text("""
                DROP TYPE IF EXISTS userrole
            """))

            trans.commit()
            print("✅ Migration completed successfully!")
            print("\n📊 Summary:")
            print("  - Created 'admins' table")
            print("  - Created 'clients' table")
            print("  - Migrated admin users to 'admins' table")
            print("  - Migrated client users to 'clients' table")
            print("  - Updated surveys foreign key to reference 'clients'")
            print("  - Removed role column from 'users' table")
            print("  - Users table now contains only regular citizen users")

        except Exception as e:
            trans.rollback()
            print(f"❌ Migration failed: {e}")
            raise


if __name__ == "__main__":
    migrate()
