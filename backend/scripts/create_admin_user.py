"""
Script to create an admin user
"""

import sys
import os

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.base import get_db
from app.models.user import User, UserRole
from app.core.security import get_password_hash


def create_admin():
    """Create admin user"""
    print("Creating admin user...")

    db = next(get_db())

    try:
        # Check if admin already exists
        existing_admin = db.query(User).filter(User.email == "mardom4164@gmail.com").first()

        if existing_admin:
            print("Admin user already exists. Updating role to admin...")
            existing_admin.role = UserRole.ADMIN
            db.commit()
            print("✅ Admin user updated successfully!")
            print(f"Email: {existing_admin.email}")
            print(f"CUIL: {existing_admin.cuil}")
            print(f"Role: {existing_admin.role.value}")
            return

        # Create new admin user
        admin_user = User(
            cuil="20416412347",  # CUIL de ejemplo
            hashed_password=get_password_hash("admin123"),
            email="mardom4164@gmail.com",
            name="Admin PAD",
            role=UserRole.ADMIN,
            phone=None,
            address=None,
            neighborhood=None,
            city=None,
            postal_code=None
        )

        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)

        print("✅ Admin user created successfully!")
        print(f"\nCredentials:")
        print(f"Email: mardom4164@gmail.com")
        print(f"Password: admin123")
        print(f"CUIL: 20416412347")
        print(f"Role: {admin_user.role.value}")

    except Exception as e:
        db.rollback()
        print(f"❌ Failed to create admin user: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    create_admin()
