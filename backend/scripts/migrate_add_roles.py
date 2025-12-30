"""
Migration script to add role field to users table.
Adds: role enum (admin, client, user)
"""

import sys
import os
from sqlalchemy import text

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.base import get_db, engine


def migrate():
    """Add role field to users table."""
    print("Starting migration: Adding role field to users table...")

    with engine.connect() as conn:
        # Start transaction
        trans = conn.begin()

        try:
            # Drop and recreate enum type
            print("Checking and creating UserRole enum type...")
            conn.execute(text("""
                DO $$
                BEGIN
                    -- Check if type exists
                    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userrole') THEN
                        -- Drop existing type (only if not used)
                        DROP TYPE IF EXISTS userrole CASCADE;
                    END IF;

                    -- Create new type
                    CREATE TYPE userrole AS ENUM ('admin', 'client', 'user');
                END $$;
            """))

            # Add role column (without NOT NULL first)
            print("Adding role column...")
            conn.execute(text("""
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS role userrole
            """))

            # Update existing users to have 'user' role
            print("Updating existing users with 'user' role...")
            conn.execute(text("""
                UPDATE users
                SET role = CAST('user' AS userrole)
                WHERE role IS NULL
            """))

            # Now add NOT NULL constraint
            print("Adding NOT NULL constraint to role...")
            conn.execute(text("""
                ALTER TABLE users
                ALTER COLUMN role SET NOT NULL
            """))

            # Set default value for new rows
            print("Setting default value for role...")
            conn.execute(text("""
                ALTER TABLE users
                ALTER COLUMN role SET DEFAULT CAST('user' AS userrole)
            """))

            # Create index on role for faster queries
            print("Creating index on role...")
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_users_role
                ON users(role)
            """))

            # Commit transaction
            trans.commit()
            print("✅ Migration completed successfully!")
            print("\nYou can now create admin and client users.")
            print("Example: UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';")

        except Exception as e:
            trans.rollback()
            print(f"❌ Migration failed: {e}")
            raise


if __name__ == "__main__":
    migrate()
