"""
Script para actualizar los barrios de usuarios con barrios reales de Alta Gracia
obtenidos de OpenStreetMap via OSMnx.

Los usuarios de prueba tienen barrios inventados. Este script los reemplaza
con barrios verificados de OSM, distribuyéndolos aleatoriamente.

Uso:
    cd backend/
    python scripts/fix_user_neighborhoods.py

    # Solo mostrar cambios sin escribir en DB:
    python scripts/fix_user_neighborhoods.py --dry-run
"""

import sys
import os
import argparse
import random

import osmnx as ox

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.db.base import engine

LOCALITY = "Alta Gracia, Córdoba, Argentina"


def fetch_osm_neighborhoods() -> list[str]:
    """Obtiene los nombres de barrios reales de OSM usando features_from_place."""
    print(f"🗺️  Obteniendo barrios de OSM para '{LOCALITY}'...")
    tags = {"place": ["neighbourhood", "suburb", "quarter"]}
    gdf = ox.features_from_place(LOCALITY, tags=tags)
    names = sorted([row.get("name") for _, row in gdf.iterrows() if row.get("name")])
    print(f"   → {len(names)} barrios encontrados\n")
    return names


def main(dry_run: bool = False):
    mode = "[DRY-RUN] " if dry_run else ""
    print(f"👥 {mode}Actualizando barrios de usuarios\n")

    osm_barrios = fetch_osm_neighborhoods()
    if not osm_barrios:
        print("❌ No se encontraron barrios en OSM. Abortando.")
        return

    print("📋 Barrios OSM disponibles:")
    for b in osm_barrios:
        print(f"   - {b}")
    print()

    with engine.connect() as conn:
        users = conn.execute(
            text("SELECT id, neighborhood FROM users WHERE neighborhood IS NOT NULL ORDER BY id")
        ).fetchall()

    print(f"👤 Usuarios con barrio asignado: {len(users)}\n")

    # Asignar barrios aleatoriamente
    random.seed(42)  # Seed fijo para reproducibilidad

    changes = 0
    with engine.connect() as conn:
        for user_id, old_neighborhood in users:
            new_neighborhood = random.choice(osm_barrios)

            if old_neighborhood != new_neighborhood:
                if not dry_run:
                    conn.execute(
                        text("UPDATE users SET neighborhood = :new WHERE id = :id"),
                        {"new": new_neighborhood, "id": str(user_id)},
                    )
                changes += 1

        if not dry_run:
            conn.commit()

    # Mostrar nueva distribución
    print(f"\n{'=' * 70}")
    print(f"📊 RESUMEN {mode}")
    print(f"{'=' * 70}")
    print(f"   Usuarios actualizados: {changes}/{len(users)}")

    if not dry_run:
        with engine.connect() as conn:
            dist = conn.execute(
                text("""
                    SELECT neighborhood, COUNT(*) as cnt
                    FROM users
                    WHERE neighborhood IS NOT NULL
                    GROUP BY neighborhood
                    ORDER BY cnt DESC
                """)
            ).fetchall()

        print(f"\n📍 Nueva distribución ({len(dist)} barrios):")
        for name, cnt in dist:
            print(f"   {cnt:4d}  {name}")
        print(f"\n💾 Cambios guardados en la base de datos.")
    else:
        print(f"\n⚠️  Modo dry-run: ningún cambio fue escrito en la DB.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Actualiza barrios de usuarios con barrios reales de OSM")
    parser.add_argument("--dry-run", action="store_true", help="Muestra los cambios sin escribir en la DB")
    args = parser.parse_args()
    main(dry_run=args.dry_run)
