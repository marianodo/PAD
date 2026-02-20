"""
Script para crear un proveedor de pagos con API key segura.

Uso:
    python -m scripts.create_provider

La API key se muestra UNA SOLA VEZ en la consola.
Guardarla de forma segura - no se puede recuperar después.
"""

import sys
import os
import secrets

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import bcrypt
from app.db.base import get_db
from app.models.client import Client
from app.models.provider import Provider, ProviderClient


def generate_api_key() -> str:
    """Genera una API key segura de 64 caracteres URL-safe."""
    return secrets.token_urlsafe(48)


def hash_api_key(api_key: str) -> str:
    """Hashea la API key con bcrypt."""
    return bcrypt.hashpw(
        api_key.encode("utf-8"),
        bcrypt.gensalt()
    ).decode("utf-8")


def create_provider():
    """Crea un proveedor de pagos interactivamente."""
    db = next(get_db())

    try:
        # Listar clients disponibles
        clients = db.query(Client).all()
        if not clients:
            print("No hay clients (municipios) registrados. Cree uno primero.")
            return

        print("\n=== Crear Proveedor de Pagos ===\n")

        # Nombre del provider
        name = input("Nombre del proveedor: ").strip()
        if not name:
            print("El nombre es obligatorio.")
            return

        # Verificar si ya existe
        existing = db.query(Provider).filter(Provider.name == name).first()
        if existing:
            print(f"\nYa existe un proveedor con nombre '{name}' (ID: {existing.id})")
            print(f"Activo: {existing.is_active}")
            print(f"Prefijo API key: {existing.api_key_prefix}...")
            return

        # Mostrar clients disponibles
        print("\nClients (municipios) disponibles:")
        for i, client in enumerate(clients, 1):
            print(f"  {i}. {client.name} (ID: {client.id})")

        # Seleccionar clients
        selection = input("\nIngrese los números de los clients a vincular (separados por coma): ").strip()
        if not selection:
            print("Debe seleccionar al menos un client.")
            return

        selected_indices = []
        for s in selection.split(","):
            try:
                idx = int(s.strip()) - 1
                if 0 <= idx < len(clients):
                    selected_indices.append(idx)
                else:
                    print(f"Índice {s.strip()} fuera de rango.")
                    return
            except ValueError:
                print(f"'{s.strip()}' no es un número válido.")
                return

        selected_clients = [clients[i] for i in selected_indices]

        # Generar API key
        api_key = generate_api_key()
        api_key_hash = hash_api_key(api_key)
        api_key_prefix = api_key[:8]

        # Crear provider
        provider = Provider(
            name=name,
            api_key_hash=api_key_hash,
            api_key_prefix=api_key_prefix,
            is_active=True,
        )
        db.add(provider)
        db.flush()

        # Crear relaciones con clients
        for client in selected_clients:
            pc = ProviderClient(
                provider_id=provider.id,
                client_id=client.id,
                is_active=True,
            )
            db.add(pc)

        db.commit()
        db.refresh(provider)

        # Mostrar resultados
        print("\n" + "=" * 60)
        print("PROVEEDOR CREADO EXITOSAMENTE")
        print("=" * 60)
        print(f"\nNombre: {name}")
        print(f"ID: {provider.id}")
        print(f"Clients vinculados:")
        for client in selected_clients:
            print(f"  - {client.name} ({client.id})")
        separator = "!" * 60
        print(f"\n{separator}")
        print("API KEY (GUARDAR DE FORMA SEGURA - NO SE PUEDE RECUPERAR):")
        print(f"\n  {api_key}\n")
        print(separator)
        print(f"\nPrefijo (para identificación en logs): {api_key_prefix}...")
        print(f"\nUso en requests:")
        print(f'  curl -H "X-API-Key: {api_key}" \\')
        print(f"    https://your-api.com/api/v1/integration/points/20345678901")

    except Exception as e:
        db.rollback()
        print(f"\nError al crear proveedor: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    create_provider()
