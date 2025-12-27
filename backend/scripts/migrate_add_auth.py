"""
Migration script to add authentication fields to users table.
Adds: cuil, hashed_password
Makes name NOT NULL
"""

import sys
import os
from sqlalchemy import text

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.base import get_db, engine


def migrate():
    """Add authentication fields to users table."""
    print("Starting migration: Adding authentication fields to users table...")

    with engine.connect() as conn:
        # Start transaction
        trans = conn.begin()

        try:
            # Add cuil column
            print("Adding cuil column...")
            conn.execute(text("""
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS cuil VARCHAR(11)
            """))

            # Add hashed_password column
            print("Adding hashed_password column...")
            conn.execute(text("""
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS hashed_password VARCHAR(255)
            """))

            # Make name NOT NULL (set default first for existing rows)
            print("Updating name column to NOT NULL...")
            conn.execute(text("""
                UPDATE users
                SET name = 'Usuario'
                WHERE name IS NULL
            """))

            conn.execute(text("""
                ALTER TABLE users
                ALTER COLUMN name SET NOT NULL
            """))

            # For existing users without CUIL, we'll need to handle them separately
            # In production, you'd want to either:
            # 1. Delete test users
            # 2. Add dummy CUILs for existing users
            # 3. Require manual data entry

            print("Checking for existing users without CUIL...")
            result = conn.execute(text("SELECT COUNT(*) FROM users WHERE cuil IS NULL"))
            count = result.scalar()

            if count > 0:
                print(f"Found {count} users without CUIL. Setting dummy CUIL...")
                # Use a fixed dummy CUIL for existing test users
                conn.execute(text("""
                    UPDATE users
                    SET cuil = '00000000001'
                    WHERE cuil IS NULL
                """))

                print(f"Setting default password for {count} existing users...")
                conn.execute(text("""
                    UPDATE users
                    SET hashed_password = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYzS6ZzxJu6'
                    WHERE hashed_password IS NULL
                """))
                # Default password: "password"

            # Add unique constraint and NOT NULL to cuil
            print("Adding constraints to cuil...")
            conn.execute(text("""
                ALTER TABLE users
                ALTER COLUMN cuil SET NOT NULL
            """))

            # Check if constraint already exists before adding
            constraint_check = conn.execute(text("""
                SELECT COUNT(*)
                FROM pg_constraint
                WHERE conname = 'users_cuil_key'
            """))

            if constraint_check.scalar() == 0:
                conn.execute(text("""
                    ALTER TABLE users
                    ADD CONSTRAINT users_cuil_key UNIQUE (cuil)
                """))

            # Add NOT NULL to hashed_password
            print("Adding constraints to hashed_password...")
            conn.execute(text("""
                ALTER TABLE users
                ALTER COLUMN hashed_password SET NOT NULL
            """))

            # Create index on cuil for faster lookups
            print("Creating index on cuil...")
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_users_cuil
                ON users(cuil)
            """))

            # Commit transaction
            trans.commit()
            print("✅ Migration completed successfully!")

        except Exception as e:
            trans.rollback()
            print(f"❌ Migration failed: {e}")
            raise


if __name__ == "__main__":
    migrate()
