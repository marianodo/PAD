"""
Script to add is_active column to surveys table
"""

import sys
import os

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.base import engine
from sqlalchemy import text


def add_is_active_column():
    """Add is_active column to surveys table"""
    print("Adding is_active column to surveys table...")

    with engine.connect() as conn:
        try:
            # Check if column already exists
            result = conn.execute(text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name='surveys'
                AND column_name='is_active'
            """))

            if result.fetchone():
                print("Column is_active already exists in surveys table")
                return

            # Add is_active column
            conn.execute(text("""
                ALTER TABLE surveys
                ADD COLUMN is_active BOOLEAN DEFAULT TRUE NOT NULL
            """))

            # Set all existing surveys to active
            conn.execute(text("""
                UPDATE surveys SET is_active = TRUE WHERE is_active IS NULL
            """))

            conn.commit()
            print("✅ Successfully added is_active column to surveys table")

        except Exception as e:
            conn.rollback()
            print(f"❌ Error adding is_active column: {e}")
            raise


if __name__ == "__main__":
    add_is_active_column()
