"use client";

import { useEffect, useState } from "react";

interface GeographicHeatMapProps {
  neighborhoodData: Record<string, number>;
}

// Coordenadas REALES de barrios de Alta Gracia obtenidas de OpenStreetMap
const NEIGHBORHOOD_COORDS: Record<string, { lat: number; lng: number }> = {
  // Coordenadas verificadas de OpenStreetMap
  "Centro": { lat: -31.6535023, lng: -64.4240528 },
  "San Martín": { lat: -31.6637055, lng: -64.4227145 },
  "Villa Parque": { lat: -31.604438, lng: -64.4056309 },
  "La Perla": { lat: -31.678409, lng: -64.4376872 },
  "Parque del Virrey": { lat: -31.6470185, lng: -64.4169166 },
  "Barrio Córdoba": { lat: -31.6213318, lng: -64.4282419 },
  "Barrio Norte": { lat: -31.7182402, lng: -64.4078367 },
  "Pellegrini": { lat: -31.6516924, lng: -64.4413141 },
  "El Golf": { lat: -31.6437905, lng: -64.4462955 },
  "Sabattini": { lat: -31.6464183, lng: -64.4368431 },
  "Paravachasca": { lat: -31.6403451, lng: -64.429973 },
  "Los Nogales": { lat: -31.7170684, lng: -64.4058691 },
  "Villa del Prado": { lat: -31.6192496, lng: -64.3878973 },
  "General Bustos": { lat: -31.6673588, lng: -64.4368409 },
  "Poluyan": { lat: -31.6588046, lng: -64.437253 },
  "Altos de Alta Gracia": { lat: -31.7159482, lng: -64.3881824 },
  "Camara": { lat: -31.6547968, lng: -64.4210163 },
  "Los Molles": { lat: -31.6393099, lng: -64.4324517 },
  "Santa María": { lat: -31.649147, lng: -64.4243328 },
  "Don Bosco": { lat: -31.6679657, lng: -64.4259672 },
  "Cafferata": { lat: -31.6593111, lng: -64.4172452 },
  "Barrio Sur": { lat: -31.7210214, lng: -64.4054766 },
  "Villa Oviedo": { lat: -31.6704985, lng: -64.4314348 },

  // Coordenadas aproximadas (no encontradas en OpenStreetMap)
  "Barrio Obrero": { lat: -31.6580, lng: -64.4300 },
  "Residencial Alta Gracia": { lat: -31.6500, lng: -64.4100 },
  "Reserva Tajamar": { lat: -31.6520, lng: -64.4050 },
  "Lomas del Golf": { lat: -31.6450, lng: -64.4420 },
  "Colinas del Sur": { lat: -31.6750, lng: -64.4150 },
};

export default function GeographicHeatMap({ neighborhoodData }: GeographicHeatMapProps) {
  const [mounted, setMounted] = useState(false);
  const [map, setMap] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || map) return;

    // Cargar Leaflet solo en el cliente
    import("leaflet").then((L) => {
      const entries = Object.entries(neighborhoodData).filter(([key]) => key !== "Sin especificar");
      if (entries.length === 0) return;

      const maxValue = Math.max(...entries.map(([, value]) => value));
      const minValue = Math.min(...entries.map(([, value]) => value));

      // Crear el mapa con más zoom para ver mejor
      const mapInstance = L.map("leaflet-map").setView([-31.6553, -64.4330], 14);

      // Agregar capa de tiles
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapInstance);

      // Función para determinar color y radio según intensidad (círculos más grandes)
      const getMarkerStyle = (value: number) => {
        const normalized = (value - minValue) / (maxValue - minValue);

        if (normalized >= 0.75) {
          return { color: "#EF4444", radius: 250, label: "Muy Alta" };
        }
        if (normalized >= 0.5) {
          return { color: "#F97316", radius: 220, label: "Alta" };
        }
        if (normalized >= 0.25) {
          return { color: "#EAB308", radius: 180, label: "Media" };
        }
        if (normalized >= 0.1) {
          return { color: "#22C55E", radius: 140, label: "Baja-Media" };
        }
        return { color: "#3B82F6", radius: 100, label: "Baja" };
      };

      // Agregar marcadores circulares más grandes
      console.log(`Renderizando ${entries.length} barrios en el mapa:`, entries.map(([n]) => n));

      entries.forEach(([name, value]) => {
        const coords = NEIGHBORHOOD_COORDS[name];
        if (!coords) {
          console.warn(`⚠️ No hay coordenadas para el barrio: ${name}`);
          return;
        }

        const style = getMarkerStyle(value);
        console.log(`✓ Renderizando ${name}: ${value} respuestas, radio: ${style.radius}m, color: ${style.color}`);

        // Círculo coloreado
        L.circle([coords.lat, coords.lng], {
          color: style.color,
          fillColor: style.color,
          fillOpacity: 0.6,
          radius: style.radius,
          weight: 3,
        })
          .bindTooltip(
            `<div style="text-align: center; padding: 6px;">
              <strong style="font-size: 14px;">${name}</strong><br/>
              <span style="font-size: 13px; color: #4B5563;">${value} respuestas</span>
            </div>`,
            {
              direction: "top",
              offset: [0, -10],
              opacity: 0.95,
            }
          )
          .addTo(mapInstance);
      });

      setMap(mapInstance);
    });

    // Cleanup
    return () => {
      if (map) {
        map.remove();
      }
    };
  }, [mounted, neighborhoodData, map]);

  const entries = Object.entries(neighborhoodData).filter(([key]) => key !== "Sin especificar");

  if (!mounted) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="mb-6">
          <h3 className="text-xl font-bold text-gray-900">Desglose por Zona Geográfica</h3>
          <p className="text-sm text-gray-500">Participación por ubicación de residencia</p>
        </div>
        <div className="h-96 bg-gray-100 rounded-lg flex items-center justify-center">
          <p className="text-gray-500">Cargando mapa...</p>
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="mb-4">
          <h3 className="text-xl font-bold text-gray-900">Desglose por Zona Geográfica</h3>
          <p className="text-sm text-gray-500">Participación por ubicación de residencia</p>
        </div>
        <div className="text-center text-gray-500 py-12">
          No hay datos geográficos disponibles
        </div>
      </div>
    );
  }

  const sortedEntries = entries.sort((a, b) => b[1] - a[1]);
  const topZone = sortedEntries[0];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900">Desglose por Zona Geográfica</h3>
        <p className="text-sm text-gray-500">Participación por ubicación de residencia</p>
      </div>

      {/* Mapa */}
      <div id="leaflet-map" className="h-[500px] rounded-lg overflow-hidden border border-gray-200 mb-4"></div>

      {/* Legend */}
      <div className="mb-4">
        <p className="text-xs font-medium text-gray-600 mb-2">Intensidad de participación:</p>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-red-500"></div>
            <span className="text-xs text-gray-600">Muy Alta</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-orange-500"></div>
            <span className="text-xs text-gray-600">Alta</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
            <span className="text-xs text-gray-600">Media</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-green-500"></div>
            <span className="text-xs text-gray-600">Baja-Media</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-blue-500"></div>
            <span className="text-xs text-gray-600">Baja</span>
          </div>
        </div>
      </div>

      {/* Insight */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-sm text-gray-600">
          La zona <span className="font-semibold text-gray-900">{topZone[0]}</span> lidera con{" "}
          <span className="font-semibold text-gray-900">{topZone[1].toLocaleString()}</span> respuestas.
          Los círculos representan cada barrio, donde el tamaño y color indican el nivel de participación.
        </p>
      </div>
    </div>
  );
}
