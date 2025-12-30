"""
Script to create a client user for Municipalidad de Alta Gracia
"""

import sys
import os

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.base import get_db
from app.models.user import User, UserRole
from app.core.security import get_password_hash


def create_client():
    """Create client user for Municipalidad de Alta Gracia"""
    print("Creating client user for Municipalidad de Alta Gracia...")

    db = next(get_db())

    try:
        # Check if client already exists
        existing_client = db.query(User).filter(User.email == "muni.altagracia@gmail.com").first()

        if existing_client:
            print("Client user already exists. Updating role to client...")
            existing_client.role = UserRole.CLIENT
            existing_client.name = "Municipalidad de Alta Gracia"
            db.commit()
            print("✅ Client user updated successfully!")
            print(f"Email: {existing_client.email}")
            print(f"CUIL: {existing_client.cuil}")
            print(f"Name: {existing_client.name}")
            print(f"Role: {existing_client.role.value}")
            return existing_client

        # Create new client user
        client_user = User(
            cuil="30123456789",  # CUIL de ejemplo para entidad
            hashed_password=get_password_hash("muni123"),
            email="muni.altagracia@gmail.com",
            name="Municipalidad de Alta Gracia",
            role=UserRole.CLIENT,
            phone="0351-4123456",
            address="Av. Sarmiento 1",
            neighborhood="Centro",
            city="Alta Gracia",
            postal_code="5186"
        )

        db.add(client_user)
        db.commit()
        db.refresh(client_user)

        print("✅ Client user created successfully!")
        print(f"\nCredentials:")
        print(f"Email: muni.altagracia@gmail.com")
        print(f"Password: muni123")
        print(f"CUIL: 30123456789")
        print(f"Name: Municipalidad de Alta Gracia")
        print(f"Role: {client_user.role.value}")
        print(f"ID: {client_user.id}")

        return client_user

    except Exception as e:
        db.rollback()
        print(f"❌ Failed to create client user: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    create_client()
