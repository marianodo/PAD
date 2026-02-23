"""
Script para corregir coordenadas de barrios en la tabla `neighborhoods`.

Estrategia en dos pasos:
  1. OSMnx (Nominatim): busca el polígono del barrio y calcula su centroide.
  2. Overpass API (fallback): si OSMnx no encontró nada, busca directamente en
     OpenStreetMap por relaciones/ways con boundary=administrative o
     place=neighbourhood/suburb dentro del área de la localidad.

Filtros aplicados a ambas fuentes:
  - Bounding box: descarta resultados fuera de Alta Gracia.
  - LineString: descarta resultados que son calles.

Uso:
    cd backend/
    python scripts/fix_neighborhood_coords_osmnx.py

    # Solo mostrar cambios sin escribir en DB (dry-run):
    python scripts/fix_neighborhood_coords_osmnx.py --dry-run
"""

import sys
import os
import argparse
import time

import requests
import osmnx as ox
from shapely.geometry import shape

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.db.base import engine

# Bounding box de Alta Gracia: si el resultado cae fuera de este rango
# se considera un falso positivo (barrio de otra ciudad) y se descarta.
# Valores con ~15 km de margen alrededor del centro de Alta Gracia.
BBOX = {
    "lat_min": -31.78,
    "lat_max": -31.58,
    "lng_min": -64.50,
    "lng_max": -64.35,
}


def within_bbox(lat: float, lng: float) -> bool:
    return (
        BBOX["lat_min"] <= lat <= BBOX["lat_max"]
        and BBOX["lng_min"] <= lng <= BBOX["lng_max"]
    )


def get_osmnx_coords(name: str, locality: str, province: str) -> dict | None:
    """
    Busca el barrio en OSMnx usando distintas variaciones de query.
    Retorna dict con lat, lng, osm_id y geometry_type, o None si no se encontró.
    """
    queries = [
        f"{name}, {locality}, {province}, Argentina",
        f"Barrio {name}, {locality}, {province}, Argentina",
        f"{name}, {locality}, Argentina",
    ]

    for query in queries:
        try:
            # which_result=1 acepta cualquier tipo de geometría (Polygon, Point, etc.)
            gdf = ox.geocode_to_gdf(query, which_result=1)
            if gdf is None or gdf.empty:
                continue

            geom = gdf.geometry.iloc[0]

            if geom.geom_type in ("Polygon", "MultiPolygon"):
                centroid = geom.centroid
            elif geom.geom_type == "Point":
                centroid = geom
            else:
                centroid = geom.centroid

            osm_id = str(gdf["osm_id"].iloc[0]) if "osm_id" in gdf.columns else None
            lat = centroid.y
            lng = centroid.x

            if not within_bbox(lat, lng):
                # El resultado es de otra ciudad/localidad — descartar
                print(f"   ⛔ Fuera del bbox ({lat:.4f}, {lng:.4f}) con query '{query}' — descartado")
                continue

            if geom.geom_type == "LineString":
                # Una calle/camino no es un barrio — descartar
                print(f"   ⛔ Resultado es una calle (LineString) con query '{query}' — descartado")
                continue

            return {
                "lat": lat,
                "lng": lng,
                "osm_id": osm_id,
                "geometry_type": geom.geom_type,
                "query_used": query,
            }

        except Exception:
            continue

    return None


OVERPASS_URL = "https://overpass-api.de/api/interpreter"


def _build_geom_from_element(el: dict):
    """Construye un shapely geometry desde un elemento Overpass (way o relation)."""
    el_type = el.get("type")
    geom = None

    if el_type == "relation" and el.get("members"):
        coords = []
        for member in el["members"]:
            if member.get("role") == "outer" and "geometry" in member:
                coords += [(pt["lon"], pt["lat"]) for pt in member["geometry"]]
        if len(coords) >= 3:
            try:
                geom = shape({"type": "Polygon", "coordinates": [coords]})
            except Exception:
                pass

    elif el_type == "way" and el.get("geometry"):
        coords = [(pt["lon"], pt["lat"]) for pt in el["geometry"]]
        if len(coords) >= 3:
            try:
                geom = shape({"type": "Polygon", "coordinates": [coords]})
            except Exception:
                pass

    return geom


def fetch_overpass_index(locality: str) -> dict:
    """
    Hace UNA sola consulta a Overpass y devuelve un dict {name_lower: result}
    con todos los barrios encontrados en la localidad.
    Así evitamos el rate-limiting por hacer muchas requests individuales.
    """
    query = f"""
    [out:json][timeout:60];
    area["name"="{locality}"]["boundary"="administrative"]->.city;
    (
      relation["boundary"="administrative"](area.city);
      relation["place"~"neighbourhood|suburb|quarter"](area.city);
      way["place"~"neighbourhood|suburb|quarter"](area.city);
    );
    out geom;
    """
    print(f"🌐 Consultando Overpass para '{locality}'...")
    elements = []
    for attempt in range(1, 4):
        try:
            response = requests.get(
                OVERPASS_URL,
                params={"data": query},
                headers={"User-Agent": "PAD-AltagraciaApp/1.0"},
                timeout=90,
            )
            response.raise_for_status()
            elements = response.json().get("elements", [])
            break
        except Exception as e:
            wait = attempt * 5
            print(f"   ✗ Intento {attempt}/3 fallido ({e.__class__.__name__}). Reintentando en {wait}s...")
            time.sleep(wait)
    else:
        print(f"   ✗ Overpass no disponible tras 3 intentos.")
        return {}

    index = {}
    for el in elements:
        name = el.get("tags", {}).get("name", "").strip()
        if not name:
            continue

        geom = _build_geom_from_element(el)
        if geom is None:
            continue

        centroid = geom.centroid
        lat, lng = centroid.y, centroid.x

        if not within_bbox(lat, lng):
            continue

        index[name.lower()] = {
            "lat": lat,
            "lng": lng,
            "osm_id": str(el.get("id")),
            "geometry_type": geom.geom_type,
            "query_used": f"overpass/{el['type']}",
            "original_name": name,
        }

    print(f"   → {len(index)} barrios indexados desde Overpass\n")
    return index


def get_overpass_coords(name: str, overpass_index: dict) -> dict | None:
    """
    Busca el barrio en el índice pre-cargado de Overpass.
    Retorna dict con lat, lng, osm_id y geometry_type, o None si no se encontró.
    """
    result = overpass_index.get(name.lower())
    if result:
        print(f"   ✓ [Overpass/{result['geometry_type']}] '{result['original_name']}': {result['lat']:.6f}, {result['lng']:.6f}")
    return result


def main(dry_run: bool = False):
    mode = "[DRY-RUN] " if dry_run else ""
    print(f"🗺️  {mode}Corrigiendo coordenadas de barrios con OSMnx\n")

    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT id, name, locality, province, lat, lng, osm_id FROM neighborhoods ORDER BY name")
        ).fetchall()

    print(f"📋 Barrios encontrados en DB: {len(rows)}\n")

    # Pre-cargar índice de Overpass agrupado por localidad (una sola request por localidad)
    localities = {(row[2] or "") for row in rows}
    overpass_index: dict = {}
    for loc in localities:
        if loc:
            overpass_index.update(fetch_overpass_index(loc))

    print("=" * 70)

    stats = {"updated": 0, "unchanged": 0, "not_found": 0}
    not_found_list = []

    with engine.connect() as conn:
        for row in rows:
            id_, name, locality, province, old_lat, old_lng, old_osm_id = row
            locality = locality or ""
            province = province or ""

            print(f"\n🔍 {name} ({locality}, {province})")

            result = get_osmnx_coords(name, locality, province)

            if result is None:
                print(f"   → Probando Overpass...")
                result = get_overpass_coords(name, overpass_index)

            if result is None:
                print(f"   ⚠️  No encontrado en OSMnx ni Overpass — coordenadas sin cambios")
                stats["not_found"] += 1
                not_found_list.append(f"{name} ({locality}, {province})")
                continue

            new_lat = result["lat"]
            new_lng = result["lng"]
            new_osm_id = result["osm_id"]
            geom_type = result["geometry_type"]

            delta_lat = abs(new_lat - (old_lat or 0))
            delta_lng = abs(new_lng - (old_lng or 0))
            coords_changed = delta_lat > 0.0001 or delta_lng > 0.0001
            osm_changed = new_osm_id and new_osm_id != old_osm_id

            if coords_changed or osm_changed:
                print(f"   📍 [{geom_type}] {old_lat:.6f}, {old_lng:.6f}  →  {new_lat:.6f}, {new_lng:.6f}")
                if osm_changed:
                    print(f"   🔑 osm_id: {old_osm_id} → {new_osm_id}")

                if not dry_run:
                    conn.execute(
                        text("""
                            UPDATE neighborhoods
                            SET lat = :lat, lng = :lng, osm_id = :osm_id
                            WHERE id = :id
                        """),
                        {"lat": new_lat, "lng": new_lng, "osm_id": new_osm_id, "id": str(id_)},
                    )
                    conn.commit()

                stats["updated"] += 1
            else:
                print(f"   ✓  Sin cambios significativos ({geom_type})")
                stats["unchanged"] += 1

    print("\n" + "=" * 70)
    print(f"📊 RESUMEN {mode}")
    print("=" * 70)
    print(f"   ✅ Actualizados:      {stats['updated']}")
    print(f"   =  Sin cambios:       {stats['unchanged']}")
    print(f"   ⚠️  No encontrados:   {stats['not_found']}")

    if not_found_list:
        print("\n📋 Barrios sin coordenadas OSMnx:")
        for item in not_found_list:
            print(f"   - {item}")

    if dry_run:
        print("\n⚠️  Modo dry-run: ningún cambio fue escrito en la DB.")
    else:
        print("\n💾 Cambios guardados en la base de datos.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Corrige coordenadas de barrios usando OSMnx")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Muestra los cambios sin escribir en la DB",
    )
    args = parser.parse_args()
    main(dry_run=args.dry_run)
