"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface QuestionSummary {
  question_id: string;
  question_text: string;
  question_type: string;
  total_answers: number;
  results: Record<string, any>;
  results_by_neighborhood: Record<string, Record<string, any>>;
}

interface GeographicHeatMapProps {
  neighborhoodData: Record<string, number>;
  questions: QuestionSummary[];
}

type ViewMode = "participation" | "pie-charts" | "winner-color";

// Coordenadas REALES de barrios de Alta Gracia obtenidas de OpenStreetMap
const NEIGHBORHOOD_COORDS: Record<string, { lat: number; lng: number }> = {
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
  "Barrio Obrero": { lat: -31.6580, lng: -64.4300 },
  "Residencial Alta Gracia": { lat: -31.6500, lng: -64.4100 },
  "Reserva Tajamar": { lat: -31.6520, lng: -64.4050 },
  "Lomas del Golf": { lat: -31.6450, lng: -64.4420 },
  "Colinas del Sur": { lat: -31.6750, lng: -64.4150 },
};

const OPTION_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444",
  "#EC4899", "#06B6D4", "#84CC16",
];

function createPieSvg(segments: { label: string; value: number; color: string }[], size: number = 60): string {
  const center = size / 2;
  const radius = size / 2 - 2;
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return "";

  let cumulativeAngle = -90;
  const paths: string[] = [];

  segments.forEach((segment) => {
    const angle = (segment.value / total) * 360;
    if (angle >= 359.99) {
      paths.push(`<circle cx="${center}" cy="${center}" r="${radius}" fill="${segment.color}" />`);
      return;
    }
    if (angle < 1) return;

    const startRad = (cumulativeAngle * Math.PI) / 180;
    const endRad = ((cumulativeAngle + angle) * Math.PI) / 180;
    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);
    const largeArc = angle > 180 ? 1 : 0;

    paths.push(
      `<path d="M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${segment.color}" />`
    );
    cumulativeAngle += angle;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${center}" cy="${center}" r="${radius + 1}" fill="white" />
    ${paths.join("")}
  </svg>`;
}

export default function GeographicHeatMap({ neighborhoodData, questions }: GeographicHeatMapProps) {
  const [mounted, setMounted] = useState(false);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("participation");
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("");

  // Preguntas que tienen datos por barrio (excluir open_text)
  const mappableQuestions = questions.filter(
    (q) => q.results_by_neighborhood && Object.keys(q.results_by_neighborhood).length > 0
      && q.question_type !== "open_text"
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-select first question when available
  useEffect(() => {
    if (!selectedQuestionId && mappableQuestions.length > 0) {
      setSelectedQuestionId(mappableQuestions[0].question_id);
    }
  }, [mappableQuestions, selectedQuestionId]);

  const entries = Object.entries(neighborhoodData).filter(([key]) => key !== "Sin especificar");

  // Initialize map once
  useEffect(() => {
    if (!mounted || mapRef.current) return;

    import("leaflet").then((L) => {
      if (entries.length === 0) return;

      const mapInstance = L.map("leaflet-map").setView([-31.6553, -64.4330], 14);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapInstance);

      mapRef.current = mapInstance;
      // Trigger marker render
      updateMarkers(L, mapInstance);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  const updateMarkers = useCallback((L: any, mapInstance: any) => {
    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (entries.length === 0) return;

    const maxValue = Math.max(...entries.map(([, v]) => v));
    const minValue = Math.min(...entries.map(([, v]) => v));

    const selectedQuestion = mappableQuestions.find((q) => q.question_id === selectedQuestionId);

    // Build option labels/colors for the selected question
    let optionColorMap: Record<string, string> = {};
    let optionLabels: Record<string, string> = {};
    if (selectedQuestion) {
      const resultEntries = Object.entries(selectedQuestion.results);
      resultEntries.forEach(([key, val], idx) => {
        optionColorMap[key] = OPTION_COLORS[idx % OPTION_COLORS.length];
        optionLabels[key] = (val as any).label || key;
      });
    }

    entries.forEach(([name, participationCount]) => {
      const coords = NEIGHBORHOOD_COORDS[name];
      if (!coords) return;

      if (viewMode === "participation") {
        // Original participation mode
        const normalized = maxValue > minValue
          ? (participationCount - minValue) / (maxValue - minValue)
          : 0.5;

        let color: string, radius: number;
        if (normalized >= 0.75) { color = "#EF4444"; radius = 250; }
        else if (normalized >= 0.5) { color = "#F97316"; radius = 220; }
        else if (normalized >= 0.25) { color = "#EAB308"; radius = 180; }
        else if (normalized >= 0.1) { color = "#22C55E"; radius = 140; }
        else { color = "#3B82F6"; radius = 100; }

        const marker = L.circle([coords.lat, coords.lng], {
          color, fillColor: color, fillOpacity: 0.6, radius, weight: 3,
        }).bindTooltip(
          `<div style="text-align:center;padding:6px;">
            <strong style="font-size:14px;">${name}</strong><br/>
            <span style="font-size:13px;color:#4B5563;">${participationCount} respuestas</span>
          </div>`,
          { direction: "top", offset: [0, -10], opacity: 0.95 }
        ).addTo(mapInstance);
        markersRef.current.push(marker);

      } else if (selectedQuestion) {
        const neighborhoodResults = selectedQuestion.results_by_neighborhood?.[name];
        if (!neighborhoodResults) {
          // No data for this neighborhood - show grey dot
          const marker = L.circleMarker([coords.lat, coords.lng], {
            color: "#9CA3AF", fillColor: "#9CA3AF", fillOpacity: 0.4, radius: 8, weight: 2,
          }).bindTooltip(
            `<div style="text-align:center;padding:6px;">
              <strong style="font-size:14px;">${name}</strong><br/>
              <span style="font-size:12px;color:#9CA3AF;">Sin datos para esta pregunta</span>
            </div>`,
            { direction: "top", offset: [0, -10], opacity: 0.95 }
          ).addTo(mapInstance);
          markersRef.current.push(marker);
          return;
        }

        const resultEntries = Object.entries(neighborhoodResults).sort((a, b) => {
          const aVal = (a[1] as any).percentage || (a[1] as any).votes || (a[1] as any).average || 0;
          const bVal = (b[1] as any).percentage || (b[1] as any).votes || (b[1] as any).average || 0;
          return bVal - aVal;
        });

        // Build tooltip content
        const tooltipLines = resultEntries.map(([key, val]) => {
          const v = val as any;
          const label = v.label || optionLabels[key] || key;
          const pct = v.percentage != null ? `${v.percentage.toFixed(1)}%` : "";
          const votes = v.votes != null ? ` (${v.votes} votos)` : "";
          const avg = v.average != null ? `${v.average.toFixed(1)}/5` : "";
          return `<span style="color:${optionColorMap[key] || "#666"};font-weight:600;">&#9679;</span> ${label}: ${pct || avg}${votes}`;
        }).join("<br/>");

        const tooltipHtml = `<div style="padding:8px;min-width:180px;">
          <strong style="font-size:14px;">${name}</strong><br/>
          <span style="font-size:11px;color:#6B7280;">${participationCount} respuestas</span>
          <hr style="margin:6px 0;border-color:#E5E7EB;"/>
          <div style="font-size:12px;line-height:1.6;">${tooltipLines}</div>
        </div>`;

        if (viewMode === "winner-color") {
          // Color by winner
          const winner = resultEntries[0];
          const winnerKey = winner?.[0] || "";
          const winnerColor = optionColorMap[winnerKey] || "#9CA3AF";

          const marker = L.circle([coords.lat, coords.lng], {
            color: winnerColor, fillColor: winnerColor, fillOpacity: 0.65,
            radius: 200, weight: 3,
          }).bindTooltip(tooltipHtml, {
            direction: "top", offset: [0, -10], opacity: 0.95,
          }).addTo(mapInstance);
          markersRef.current.push(marker);

        } else if (viewMode === "pie-charts") {
          // Mini pie chart
          const segments = resultEntries.map(([key, val]) => ({
            label: (val as any).label || key,
            value: (val as any).percentage || (val as any).votes || (val as any).average || 0,
            color: optionColorMap[key] || "#9CA3AF",
          }));

          const svgHtml = createPieSvg(segments, 50);
          const icon = L.divIcon({
            html: svgHtml,
            className: "pie-chart-icon",
            iconSize: [50, 50],
            iconAnchor: [25, 25],
          });

          const marker = L.marker([coords.lat, coords.lng], { icon })
            .bindTooltip(tooltipHtml, {
              direction: "top", offset: [0, -25], opacity: 0.95,
            }).addTo(mapInstance);
          markersRef.current.push(marker);
        }
      }
    });
  }, [entries, viewMode, selectedQuestionId, mappableQuestions]);

  // Re-render markers when mode/question changes
  useEffect(() => {
    if (!mapRef.current || !mounted) return;
    import("leaflet").then((L) => {
      updateMarkers(L, mapRef.current);
    });
  }, [viewMode, selectedQuestionId, mounted, updateMarkers]);

  if (!mounted) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="mb-6">
          <h3 className="text-xl font-bold text-gray-900">Desglose por Zona Geográfica</h3>
          <p className="text-sm text-gray-500">Participación y votación por ubicación</p>
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
          <p className="text-sm text-gray-500">Participación y votación por ubicación</p>
        </div>
        <div className="text-center text-gray-500 py-12">
          No hay datos geográficos disponibles
        </div>
      </div>
    );
  }

  const sortedEntries = [...entries].sort((a, b) => b[1] - a[1]);
  const topZone = sortedEntries[0];

  const selectedQuestion = mappableQuestions.find((q) => q.question_id === selectedQuestionId);

  // Build legend for winner-color and pie-charts modes
  let optionLegend: { label: string; color: string }[] = [];
  if (selectedQuestion && viewMode !== "participation") {
    const resultEntries = Object.entries(selectedQuestion.results);
    optionLegend = resultEntries.map(([key, val], idx) => ({
      label: (val as any).label || key,
      color: OPTION_COLORS[idx % OPTION_COLORS.length],
    }));
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <div className="mb-4">
        <h3 className="text-xl font-bold text-gray-900">Desglose por Zona Geográfica</h3>
        <p className="text-sm text-gray-500">Participación y votación por ubicación</p>
      </div>

      {/* View Mode Toggle */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setViewMode("participation")}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
            viewMode === "participation" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Participación
        </button>
        <button
          onClick={() => setViewMode("pie-charts")}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
            viewMode === "pie-charts" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Pie Charts
        </button>
        <button
          onClick={() => setViewMode("winner-color")}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
            viewMode === "winner-color" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Color Ganador
        </button>
      </div>

      {/* Question Selector (only for pie-charts and winner-color modes) */}
      {viewMode !== "participation" && mappableQuestions.length > 0 && (
        <div className="mb-4">
          <select
            value={selectedQuestionId}
            onChange={(e) => setSelectedQuestionId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {mappableQuestions.map((q) => (
              <option key={q.question_id} value={q.question_id}>
                {q.question_text}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Map */}
      <div id="leaflet-map" className="h-[500px] rounded-lg overflow-hidden border border-gray-200 mb-4"></div>

      {/* Legend */}
      {viewMode === "participation" ? (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-600 mb-2">Intensidad de participación:</p>
          <div className="flex flex-wrap gap-3">
            {[
              { color: "bg-red-500", label: "Muy Alta" },
              { color: "bg-orange-500", label: "Alta" },
              { color: "bg-yellow-500", label: "Media" },
              { color: "bg-green-500", label: "Baja-Media" },
              { color: "bg-blue-500", label: "Baja" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`w-4 h-4 rounded-full ${color}`}></div>
                <span className="text-xs text-gray-600">{label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : optionLegend.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-600 mb-2">
            {viewMode === "winner-color" ? "Color por opción ganadora:" : "Opciones:"}
          </p>
          <div className="flex flex-wrap gap-3">
            {optionLegend.map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }}></div>
                <span className="text-xs text-gray-600">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insight */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-sm text-gray-600">
          {viewMode === "participation" ? (
            <>
              La zona <span className="font-semibold text-gray-900">{topZone[0]}</span> lidera con{" "}
              <span className="font-semibold text-gray-900">{topZone[1].toLocaleString()}</span> respuestas.
              Los círculos representan cada barrio, donde el tamaño y color indican el nivel de participación.
            </>
          ) : viewMode === "pie-charts" ? (
            <>
              Cada barrio muestra un mini gráfico circular con la distribución de respuestas.
              Pase el cursor sobre cada barrio para ver el detalle completo.
            </>
          ) : (
            <>
              Cada barrio toma el color de la opción más votada.
              Pase el cursor sobre cada barrio para ver todas las opciones y porcentajes.
            </>
          )}
        </p>
      </div>

      {/* CSS for pie chart icons */}
      <style jsx global>{`
        .pie-chart-icon {
          background: transparent !important;
          border: none !important;
        }
      `}</style>
    </div>
  );
}
