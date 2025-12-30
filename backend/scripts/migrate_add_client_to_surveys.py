"""
Migration script to add client_id field to surveys table and link existing surveys.
"""

import sys
import os
from sqlalchemy import text

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.base import get_db, engine


def migrate():
    """Add client_id field to surveys table and link existing surveys"""
    print("Starting migration: Adding client_id to surveys table...")

    with engine.connect() as conn:
        # Start transaction
        trans = conn.begin()

        try:
            # Add client_id column
            print("Adding client_id column...")
            conn.execute(text("""
                ALTER TABLE surveys
                ADD COLUMN IF NOT EXISTS client_id UUID
            """))

            # Add foreign key constraint
            print("Adding foreign key constraint...")
            conn.execute(text("""
                DO $$ BEGIN
                    ALTER TABLE surveys
                    ADD CONSTRAINT fk_surveys_client_id
                    FOREIGN KEY (client_id) REFERENCES users(id);
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            """))

            # Get the client ID for Municipalidad de Alta Gracia
            print("Finding client ID for Municipalidad de Alta Gracia...")
            result = conn.execute(text("""
                SELECT id FROM users
                WHERE email = 'muni.altagracia@gmail.com'
                AND role = 'client'
                LIMIT 1
            """))

            client_row = result.fetchone()

            if client_row:
                client_id = str(client_row[0])
                print(f"Found client ID: {client_id}")

                # Link all existing surveys to this client
                print("Linking existing surveys to Municipalidad de Alta Gracia...")
                conn.execute(text("""
                    UPDATE surveys
                    SET client_id = :client_id
                    WHERE client_id IS NULL
                """), {"client_id": client_id})

                print("✅ All existing surveys linked to client!")
            else:
                print("⚠️  Client 'Municipalidad de Alta Gracia' not found. Surveys will remain without client.")
                print("   Run create_client_user.py first if you need to create the client.")

            # Create index on client_id for faster queries
            print("Creating index on client_id...")
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_surveys_client_id
                ON surveys(client_id)
            """))

            # Commit transaction
            trans.commit()
            print("✅ Migration completed successfully!")
            print("\nSurveys are now linked to clients.")
            print("Clients can only see their own surveys.")

        except Exception as e:
            trans.rollback()
            print(f"❌ Migration failed: {e}")
            raise


if __name__ == "__main__":
    migrate()
