"""
Script para cargar el padrón electoral desde un archivo Excel.

Uso:
    python -m scripts.load_padron <path_al_xlsx> <client_id>

Ejemplo:
    python -m scripts.load_padron ../docs/padron\ alta\ gracia.xlsx 7a8549a6-6072-429d-99ce-58a52b3b4ee4
"""

import sys
import os
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import openpyxl
from sqlalchemy import text
from app.db.base import get_db
from app.models.electoral_roll import ElectoralRoll
from app.models.user import User
from app.services.membership_service import get_ancestor_client_ids
from app.core.identity import dni_from_cuil


def load_padron(xlsx_path: str, client_id: str):
    db = next(get_db())

    try:
        print(f"\nCargando padrón desde: {xlsx_path}")
        print(f"Client ID: {client_id}\n")

        wb = openpyxl.load_workbook(xlsx_path, read_only=True)
        ws = wb.active

        inserted = 0
        skipped_no_cuil = 0
        skipped_duplicate = 0
        users_linked = 0
        total = 0

        # Cargar CUILs existentes en electoral_roll para este client
        existing_cuils = set(
            row[0] for row in db.query(ElectoralRoll.cuil).filter(
                ElectoralRoll.client_id == client_id
            ).all()
        )

        batch = []
        batch_size = 500

        for i, row in enumerate(ws.iter_rows(values_only=True)):
            if i == 0:  # Skip header
                continue
            total += 1

            # Columnas: TIPDOC, MATRIC, APELLIDO, NOMBRE, SEXO, DNI, SEXO, C_CUIL, C_APELLIDO, C_NOMBRE, C_FALLECIDO, C_NIVEL
            c_cuil = row[7]  # C_CUIL
            c_apellido = row[8]  # C_APELLIDO
            c_nombre = row[9]  # C_NOMBRE

            if c_cuil is None:
                skipped_no_cuil += 1
                continue

            cuil_str = str(int(c_cuil))

            # Pad to 11 digits if needed
            if len(cuil_str) < 11:
                cuil_str = cuil_str.zfill(11)

            if cuil_str in existing_cuils:
                skipped_duplicate += 1
                continue

            name = f"{c_apellido}, {c_nombre}" if c_apellido and c_nombre else (c_apellido or c_nombre or None)

            entry = ElectoralRoll(
                id=uuid.uuid4(),
                client_id=client_id,
                cuil=cuil_str,
                dni=dni_from_cuil(cuil_str),
                name=name,
            )
            batch.append(entry)
            existing_cuils.add(cuil_str)
            inserted += 1

            if len(batch) >= batch_size:
                db.add_all(batch)
                db.flush()
                batch = []
                print(f"  Procesados: {total}...", end="\r")

        # Insert remaining batch
        if batch:
            db.add_all(batch)
            db.flush()

        wb.close()

        # Vincular usuarios existentes a este client (municipio principal informativo)
        print(f"\n\nVinculando usuarios existentes al municipio...")
        result = db.execute(
            text("""
                UPDATE users
                SET client_id = :client_id
                WHERE cuil IN (
                    SELECT cuil FROM electoral_roll WHERE client_id = :client_id
                )
                AND (client_id IS NULL OR client_id != :client_id)
            """),
            {"client_id": client_id}
        )
        users_linked = result.rowcount

        # Crear membresías (user_clients) con herencia por parent_id:
        # el padrón municipal habilita también la membresía provincial, etc.
        memberships_created = 0
        for cid in get_ancestor_client_ids(db, client_id):
            res = db.execute(
                text("""
                    INSERT INTO user_clients (id, user_id, client_id)
                    SELECT gen_random_uuid(), u.id, :cid
                    FROM users u
                    WHERE u.cuil IN (
                        SELECT cuil FROM electoral_roll WHERE client_id = :client_id
                    )
                    ON CONFLICT (user_id, client_id) DO NOTHING
                """),
                {"cid": str(cid), "client_id": client_id}
            )
            memberships_created += res.rowcount or 0

        db.commit()

        print(f"\n{'=' * 50}")
        print(f"PADRÓN CARGADO EXITOSAMENTE")
        print(f"{'=' * 50}")
        print(f"Total registros en archivo: {total}")
        print(f"Insertados en electoral_roll: {inserted}")
        print(f"Sin CUIL (omitidos): {skipped_no_cuil}")
        print(f"Duplicados (omitidos): {skipped_duplicate}")
        print(f"Usuarios vinculados al municipio: {users_linked}")
        print(f"Membresías creadas (incluye herencia): {memberships_created}")

    except Exception as e:
        db.rollback()
        print(f"\nError: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Uso: python -m scripts.load_padron <path_xlsx> <client_id>")
        sys.exit(1)

    load_padron(sys.argv[1], sys.argv[2])
