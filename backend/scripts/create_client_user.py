"""
Script to create a client user for Municipalidad de Alta Gracia
"""

import sys
import os

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.base import get_db
from app.models.client import Client
from app.core.security import get_password_hash


def create_client():
    """Create client user for Municipalidad de Alta Gracia"""
    print("Creating client user for Municipalidad de Alta Gracia...")

    db = next(get_db())

    try:
        # Check if client already exists
        existing_client = db.query(Client).filter(Client.email == "muni.altagracia@gmail.com").first()

        if existing_client:
            print("Client user already exists!")
            print(f"Email: {existing_client.email}")
            print(f"CUIT: {existing_client.cuit}")
            print(f"Name: {existing_client.name}")
            return existing_client

        # Create new client user
        client_user = Client(
            email="muni.altagracia@gmail.com",
            hashed_password=get_password_hash("muni123"),
            name="Municipalidad de Alta Gracia",
            cuit="30123456789",  # CUIT de ejemplo para entidad
            phone="0351-4123456",
            contact_person="Juan Pérez",
            contact_position="Director de Participación Ciudadana",
            address="Av. Sarmiento 1",
            city="Alta Gracia",
            postal_code="5186",
            website="https://www.altagracia.gob.ar",
            description="Municipalidad de Alta Gracia, Córdoba"
        )

        db.add(client_user)
        db.commit()
        db.refresh(client_user)

        print("✅ Client user created successfully!")
        print(f"\nCredentials:")
        print(f"Email: muni.altagracia@gmail.com")
        print(f"Password: muni123")
        print(f"CUIT: 30123456789")
        print(f"Name: Municipalidad de Alta Gracia")
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
