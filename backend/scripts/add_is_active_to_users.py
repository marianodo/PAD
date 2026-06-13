"""
Script to add is_active column to users table.
All existing users default to is_active = TRUE.
Run: python -m scripts.add_is_active_to_users
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.base import engine
from sqlalchemy import text


def add_is_active_column():
    print("Adding is_active column to users table...")

    with engine.connect() as conn:
        try:
            result = conn.execute(text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name='users'
                AND column_name='is_active'
            """))

            if result.fetchone():
                print("Column is_active already exists in users table")
                return

            conn.execute(text("""
                ALTER TABLE users
                ADD COLUMN is_active BOOLEAN DEFAULT TRUE NOT NULL
            """))

            conn.execute(text("""
                UPDATE users SET is_active = TRUE WHERE is_active IS NULL
            """))

            conn.commit()
            print("Successfully added is_active column to users table")

        except Exception as e:
            conn.rollback()
            print(f"Error adding is_active column: {e}")
            raise


if __name__ == "__main__":
    add_is_active_column()
