"""
Script para obtener coordenadas reales de barrios de Alta Gracia usando Nominatim (OpenStreetMap)
"""
import requests
import time
import json

# Lista de barrios de Alta Gracia
BARRIOS = [
    "Centro",
    "Barrio Obrero",
    "San Martín",
    "Villa Parque",
    "La Perla",
    "Parque del Virrey",
    "Barrio Córdoba",
    "Barrio Norte",
    "Pellegrini",
    "Residencial Alta Gracia",
    "Reserva Tajamar",
    "Lomas del Golf",
    "El Golf",
    "Sabattini",
    "Paravachasca",
    "Colinas del Sur",
    "Los Nogales",
    "Villa del Prado",
    "General Bustos",
    "Poluyan",
    "Altos de Alta Gracia",
    "Camara",
    "Los Molles",
    "Santa María",
    "Don Bosco",
    "Cafferata",
    "Barrio Sur",
    "Villa Oviedo",
    "Crucero Sur",
    "Liniers II de Horizonte",
    "Lalahenes",
    "Serralta",
    "Liniers",
    "Alta Gracia Country Golf",
    "Prohas II",
    "Touring Club",
    "Villa Juana",
    "Asociación la Esperanza",
    "Bª Parque San Juan",
    "Prohas I Jardín Estancia",
    "Valerio",
    "Portales del Tala",
    "Plano Viejo",
    "Santa Teresa de Jesús",
    "Buena Esperanza",
    "El Cañito",
    "La Verde",
    "Sur",
    "Villa Camiares",
    "1° de Mayo",
    "Tiro Federal",
    "Alta Gracia Norte",
    "Liniers III de Horizonte",
    "La Hornilla",
    "25 de Mayo",
    "Piedra del Sapo",
    "Parque Casino",
    "Crucero de Horizonte",
    "Ala Industrial",
    "Córdoba",
    "B° El Mirador",
    "El Crucero",
    "Terrazas del Cielo",
    "Tres Gracias",
    "B° Lomas de la Estancia",
    "Prohas III",
    "Portales del Sol",
    "Norte",
    "La Rinconada",
    "El Potrerillo",
]


def get_coordinates(neighborhood_name):
    """
    Busca coordenadas de un barrio usando Nominatim API
    """
    base_url = "https://nominatim.openstreetmap.org/search"

    # Intentar diferentes variaciones de búsqueda
    search_queries = [
        f"{neighborhood_name}, Alta Gracia, Córdoba, Argentina",
        f"Barrio {neighborhood_name}, Alta Gracia, Córdoba, Argentina",
        f"{neighborhood_name}, Alta Gracia, Argentina",
    ]

    for query in search_queries:
        params = {
            "q": query,
            "format": "json",
            "limit": 1,
            "addressdetails": 1
        }

        headers = {
            "User-Agent": "PAD-AltagraciaApp/1.0"
        }

        try:
            response = requests.get(base_url, params=params, headers=headers)
            response.raise_for_status()
            data = response.json()

            if data and len(data) > 0:
                result = data[0]
                lat = float(result["lat"])
                lon = float(result["lon"])
                display_name = result.get("display_name", "")

                print(f"✓ {neighborhood_name}: {lat}, {lon}")
                print(f"  → {display_name}")

                return {
                    "lat": lat,
                    "lng": lon,
                    "display_name": display_name,
                    "query_used": query
                }

            # Esperar 1 segundo entre requests (política de uso de Nominatim)
            time.sleep(1)

        except Exception as e:
            print(f"✗ Error buscando {neighborhood_name} con query '{query}': {e}")
            time.sleep(1)
            continue

    print(f"⚠️  No se encontraron coordenadas para: {neighborhood_name}")
    return None


def main():
    print("🗺️  Buscando coordenadas de barrios de Alta Gracia...\n")

    coordinates = {}
    not_found = []

    for i, barrio in enumerate(BARRIOS, 1):
        print(f"\n[{i}/{len(BARRIOS)}] Buscando: {barrio}")
        coords = get_coordinates(barrio)

        if coords:
            coordinates[barrio] = {
                "lat": coords["lat"],
                "lng": coords["lng"]
            }
        else:
            not_found.append(barrio)

    print("\n" + "="*80)
    print("📊 RESUMEN")
    print("="*80)
    print(f"✓ Encontrados: {len(coordinates)}/{len(BARRIOS)}")
    print(f"✗ No encontrados: {len(not_found)}")

    if not_found:
        print("\nBarrios sin coordenadas:")
        for barrio in not_found:
            print(f"  - {barrio}")

    # Guardar resultado en JSON
    output_file = "neighborhood_coordinates.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(coordinates, f, indent=2, ensure_ascii=False)

    print(f"\n💾 Coordenadas guardadas en: {output_file}")

    # Generar código TypeScript para copiar/pegar
    print("\n" + "="*80)
    print("📋 CÓDIGO TYPESCRIPT PARA GeographicHeatMap.tsx:")
    print("="*80)
    print("\nconst NEIGHBORHOOD_COORDS: Record<string, { lat: number; lng: number }> = {")
    for barrio, coords in coordinates.items():
        print(f'  "{barrio}": {{ lat: {coords["lat"]}, lng: {coords["lng"]} }},')
    print("};")


if __name__ == "__main__":
    main()
