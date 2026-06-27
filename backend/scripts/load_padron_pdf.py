"""Carga el padrón electoral desde los PDFs oficiales de la Cámara Nacional Electoral.

El padrón oficial trae **DNI** (no CUIL) en layout de 2 columnas. Este loader:
  1. Extrae (DNI, nombre) de cada PDF (cropeando cada página en 2 columnas).
  2. Inserta en `electoral_roll` por **DNI** (cuil queda NULL).
  3. Vincula usuarios existentes por DNI y crea sus membresías (con herencia por parent_id).

El match de elegibilidad es por **DNI**: el CUIL del ciudadano contiene su DNI
(CUIL = PP-DNI-V), así que de su CUIL sacamos el DNI y comparamos.

Uso:
    # Verificar la extracción sin tocar la DB:
    python -m scripts.load_padron_pdf "ruta/a/carpeta_pdfs" --dry-run

    # Cargar a la DB:
    DATABASE_URL="$DBURL" python -m scripts.load_padron_pdf "ruta/a/carpeta_pdfs" <client_id>
"""

import sys
import os
import re
import glob
import uuid
import subprocess

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.identity import normalize_dni

# Página tamaño carta-oficio CNE: 612 pt de ancho → mitad en 306.
COLUMNS = [(0, 306), (306, 320)]  # (x, width) izquierda / derecha

_NAME_RE = re.compile(r"N\s*ORDEN\s+(.+?)\s*$")
_DOC_RE = re.compile(r"DOC:\s*([\d.]+)")


def _column_text(pdf_path: str, x: int, w: int) -> str:
    out = subprocess.run(
        ["pdftotext", "-x", str(x), "-y", "0", "-W", str(w), "-H", "100000",
         "-layout", pdf_path, "-"],
        capture_output=True, text=True,
    )
    return out.stdout


def extract_records_from_pdf(pdf_path: str) -> list:
    """Devuelve [{dni, name}] de un PDF (ambas columnas)."""
    records = []
    for x, w in COLUMNS:
        text = _column_text(pdf_path, x, w)
        name = None
        for line in text.splitlines():
            m = _NAME_RE.search(line)
            if m:
                name = m.group(1).strip()
                continue
            d = _DOC_RE.search(line)
            if d and name:
                dni = normalize_dni(d.group(1))
                if dni:
                    records.append({"dni": dni, "name": name})
                name = None
    return records


def extract_padron(folder: str) -> list:
    """Extrae y deduplica (por DNI) todos los electores de la carpeta de PDFs."""
    pdfs = sorted(glob.glob(os.path.join(folder, "*.pdf")))
    if not pdfs:
        raise SystemExit(f"No hay PDFs en {folder}")

    seen = {}
    total = 0
    for pdf in pdfs:
        recs = extract_records_from_pdf(pdf)
        total += len(recs)
        for r in recs:
            seen.setdefault(r["dni"], r["name"])  # primer nombre gana
    print(f"PDFs: {len(pdfs)} | registros leídos: {total} | DNIs únicos: {len(seen)}")
    return [{"dni": dni, "name": name} for dni, name in seen.items()]


def load(folder: str, client_id: str):
    from sqlalchemy import text
    from app.db.base import get_db
    from app.models.electoral_roll import ElectoralRoll
    from app.services.membership_service import get_ancestor_client_ids

    records = extract_padron(folder)
    db = next(get_db())
    try:
        existing = {
            row[0] for row in db.query(ElectoralRoll.dni).filter(
                ElectoralRoll.client_id == client_id
            ).all() if row[0]
        }
        inserted = 0
        batch = []
        for r in records:
            if r["dni"] in existing:
                continue
            batch.append(ElectoralRoll(
                id=uuid.uuid4(), client_id=client_id, dni=r["dni"], name=r["name"],
            ))
            existing.add(r["dni"])
            inserted += 1
            if len(batch) >= 500:
                db.add_all(batch); db.flush(); batch = []
        if batch:
            db.add_all(batch); db.flush()

        # Vincular usuarios existentes (por DNI) y crear membresías con herencia
        memberships = 0
        for cid in get_ancestor_client_ids(db, client_id):
            res = db.execute(text("""
                INSERT INTO user_clients (id, user_id, client_id)
                SELECT gen_random_uuid(), u.id, :cid
                FROM users u
                WHERE u.dni IN (SELECT dni FROM electoral_roll WHERE client_id = :client_id AND dni IS NOT NULL)
                ON CONFLICT (user_id, client_id) DO NOTHING
            """), {"cid": str(cid), "client_id": client_id})
            memberships += res.rowcount or 0
        db.execute(text("""
            UPDATE users SET client_id = :client_id
            WHERE dni IN (SELECT dni FROM electoral_roll WHERE client_id = :client_id AND dni IS NOT NULL)
              AND (client_id IS NULL OR client_id != :client_id)
        """), {"client_id": client_id})

        db.commit()
        print(f"Insertados en electoral_roll: {inserted}")
        print(f"Membresías creadas (incluye herencia): {memberships}")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python -m scripts.load_padron_pdf <carpeta_pdfs> [client_id|--dry-run]")
        sys.exit(1)

    folder = sys.argv[1]
    arg = sys.argv[2] if len(sys.argv) > 2 else "--dry-run"

    if arg == "--dry-run":
        records = extract_padron(folder)
        print("\n--- muestra (primeros 8) ---")
        for r in records[:8]:
            print(f"  DNI {r['dni']:>9}  {r['name']}")
        bad = [r for r in records if not (6 <= len(r["dni"]) <= 8)]
        print(f"\nDNIs con longitud fuera de 6–8 dígitos: {len(bad)}")
        for r in bad[:5]:
            print(f"  ⚠️  DNI '{r['dni']}'  {r['name']}")
    else:
        load(folder, arg)
