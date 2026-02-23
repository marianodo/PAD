"""
Script para sincronizar la tabla `neighborhoods` con los barrios reales de OSM.

Borra los barrios viejos que no existen en OSM y agrega los que faltan,
con sus coordenadas y osm_id.

Uso:
    cd backend/
    python scripts/sync_neighborhoods_table.py

    # Solo mostrar cambios sin escribir en DB:
    python scripts/sync_neighborhoods_table.py --dry-run
"""

import sys
import os
import argparse

import osmnx as ox

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.db.base import engine

LOCALITY = "Alta Gracia, Córdoba, Argentina"
CITY = "Alta Gracia"
PROVINCE = "Córdoba"


def fetch_osm_neighborhoods() -> list[dict]:
    """Obtiene barrios reales de OSM con nombre y coordenadas."""
    print(f"🗺️  Obteniendo barrios de OSM para '{LOCALITY}'...")
    tags = {"place": ["neighbourhood", "suburb", "quarter"]}
    gdf = ox.features_from_place(LOCALITY, tags=tags)

    barrios = []
    for idx, row in gdf.iterrows():
        name = row.get("name")
        if not name:
            continue
        geom = row.geometry
        if geom.geom_type in ("Polygon", "MultiPolygon"):
            c = geom.centroid
        else:
            c = geom
        osm_type, osm_id = idx  # ('node', 123456)
        barrios.append({
            "name": name,
            "lat": c.y,
            "lng": c.x,
            "osm_id": str(osm_id),
        })

    barrios.sort(key=lambda x: x["name"])
    print(f"   → {len(barrios)} barrios encontrados\n")
    return barrios


def main(dry_run: bool = False):
    mode = "[DRY-RUN] " if dry_run else ""
    print(f"🔄 {mode}Sincronizando tabla neighborhoods con OSM\n")

    osm_barrios = fetch_osm_neighborhoods()
    if not osm_barrios:
        print("❌ No se encontraron barrios. Abortando.")
        return

    osm_names = {b["name"] for b in osm_barrios}
    osm_by_name = {b["name"]: b for b in osm_barrios}

    # Leer barrios actuales de la DB
    with engine.connect() as conn:
        db_rows = conn.execute(
            text("SELECT id, name, locality, province, lat, lng, osm_id FROM neighborhoods ORDER BY name")
        ).fetchall()

    db_names = {row[1] for row in db_rows}
    db_by_name = {row[1]: row for row in db_rows}

    to_delete = db_names - osm_names
    to_add = osm_names - db_names
    to_update = db_names & osm_names

    print(f"📋 Estado actual de la DB: {len(db_names)} barrios")
    print(f"📋 Barrios en OSM:         {len(osm_names)}")
    print(f"\n   🗑️  A eliminar: {len(to_delete)}")
    print(f"   ➕ A agregar:  {len(to_add)}")
    print(f"   🔄 A actualizar coords: {len(to_update)}")

    if to_delete:
        print(f"\n🗑️  Barrios a eliminar (no existen en OSM):")
        for name in sorted(to_delete):
            print(f"   - {name}")

    if to_add:
        print(f"\n➕ Barrios a agregar (nuevos de OSM):")
        for name in sorted(to_add):
            b = osm_by_name[name]
            print(f"   - {name}  ({b['lat']:.6f}, {b['lng']:.6f})")

    with engine.connect() as conn:
        # Eliminar barrios que no existen en OSM
        for name in sorted(to_delete):
            print(f"\n   🗑️  Eliminando: {name}")
            if not dry_run:
                conn.execute(
                    text("DELETE FROM neighborhoods WHERE name = :name AND locality = :loc"),
                    {"name": name, "loc": CITY},
                )

        # Agregar barrios nuevos de OSM
        for name in sorted(to_add):
            b = osm_by_name[name]
            print(f"\n   ➕ Agregando: {name}  ({b['lat']:.6f}, {b['lng']:.6f})")
            if not dry_run:
                conn.execute(
                    text("""
                        INSERT INTO neighborhoods (id, name, locality, province, lat, lng, osm_id, created_at)
                        VALUES (gen_random_uuid(), :name, :locality, :province, :lat, :lng, :osm_id, NOW())
                    """),
                    {
                        "name": name,
                        "locality": CITY,
                        "province": PROVINCE,
                        "lat": b["lat"],
                        "lng": b["lng"],
                        "osm_id": b["osm_id"],
                    },
                )

        # Actualizar coords y osm_id de los que ya existen
        updated = 0
        for name in sorted(to_update):
            b = osm_by_name[name]
            db_row = db_by_name[name]
            old_lat, old_lng, old_osm_id = db_row[4], db_row[5], db_row[6]

            delta_lat = abs(b["lat"] - (old_lat or 0))
            delta_lng = abs(b["lng"] - (old_lng or 0))
            needs_update = delta_lat > 0.0001 or delta_lng > 0.0001 or old_osm_id != b["osm_id"]

            if needs_update:
                updated += 1
                if not dry_run:
                    conn.execute(
                        text("""
                            UPDATE neighborhoods
                            SET lat = :lat, lng = :lng, osm_id = :osm_id
                            WHERE id = :id
                        """),
                        {"lat": b["lat"], "lng": b["lng"], "osm_id": b["osm_id"], "id": str(db_row[0])},
                    )

        if not dry_run:
            conn.commit()

    print(f"\n{'=' * 70}")
    print(f"📊 RESUMEN {mode}")
    print(f"{'=' * 70}")
    print(f"   🗑️  Eliminados:          {len(to_delete)}")
    print(f"   ➕ Agregados:            {len(to_add)}")
    print(f"   🔄 Coords actualizadas:  {updated}")
    print(f"   =  Sin cambios:          {len(to_update) - updated}")

    if dry_run:
        print(f"\n⚠️  Modo dry-run: ningún cambio fue escrito en la DB.")
    else:
        # Mostrar estado final
        with engine.connect() as conn:
            total = conn.execute(text("SELECT COUNT(*) FROM neighborhoods WHERE locality = :loc"), {"loc": CITY}).scalar()
        print(f"\n💾 Cambios guardados. Total barrios en tabla: {total}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sincroniza tabla neighborhoods con barrios reales de OSM")
    parser.add_argument("--dry-run", action="store_true", help="Muestra los cambios sin escribir en la DB")
    args = parser.parse_args()
    main(dry_run=args.dry_run)
