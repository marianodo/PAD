"""
Script to create an admin user
"""

import sys
import os

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.base import get_db
from app.models.admin import Admin
from app.core.security import get_password_hash


def create_admin():
    """Create admin user"""
    print("Creating admin user...")

    db = next(get_db())

    try:
        # Check if admin already exists
        existing_admin = db.query(Admin).filter(Admin.email == "admin@gmail.com").first()

        if existing_admin:
            print("Admin user already exists!")
            print(f"Email: {existing_admin.email}")
            print(f"Name: {existing_admin.name}")
            return existing_admin

        # Create new admin user
        admin_user = Admin(
            email="admin@gmail.com",
            hashed_password=get_password_hash("admin123"),
            name="Administrador",
        )

        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)

        print("✅ Admin user created successfully!")
        print(f"\nCredentials:")
        print(f"Email: admin@gmail.com")
        print(f"Password: admin123")
        print(f"Name: {admin_user.name}")
        print(f"ID: {admin_user.id}")

        return admin_user

    except Exception as e:
        db.rollback()
        print(f"❌ Failed to create admin user: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    create_admin()
