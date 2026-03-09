"use client";

import { useEffect, useState, useRef } from "react";

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

const NEIGHBORHOOD_COORDS: Record<string, { lat: number; lng: number }> = {
  // Coordenadas verificadas via Nominatim
  "Centro": { lat: -31.6535023, lng: -64.4240528 },
  "San Martín": { lat: -31.6637055, lng: -64.4227145 },
  "Villa Parque": { lat: -31.604438, lng: -64.4056309 },
  "La Perla": { lat: -31.678409, lng: -64.4376872 },
  "Parque del Virrey": { lat: -31.6470185, lng: -64.4169166 },
  "Barrio Córdoba": { lat: -31.6376201, lng: -64.4199281 },
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
  "Reserva Tajamar": { lat: -31.6196917, lng: -64.432268 },
  "Crucero Sur": { lat: -31.6900631, lng: -64.4377761 },
  "Liniers II de Horizonte": { lat: -31.6430818, lng: -64.4260529 },
  "Lalahenes": { lat: -31.6555093, lng: -64.4061555 },
  "Serralta": { lat: -31.6462022, lng: -64.4031992 },
  "Liniers": { lat: -31.6622926, lng: -64.4456266 },
  "Alta Gracia Country Golf": { lat: -31.6375829, lng: -64.447375 },
  "Prohas II": { lat: -31.6311183, lng: -64.4119995 },
  "Touring Club": { lat: -31.6369412, lng: -64.4372824 },
  // Coordenadas aproximadas
  "Barrio Obrero": { lat: -31.6610, lng: -64.4320 },
  "Residencial Alta Gracia": { lat: -31.6500, lng: -64.4100 },
  "Lomas del Golf": { lat: -31.6450, lng: -64.4420 },
  "Colinas del Sur": { lat: -31.6750, lng: -64.4180 },
  "Villa Juana": { lat: -31.6220, lng: -64.4310 },
  "Asociación la Esperanza": { lat: -31.6640, lng: -64.4150 },
  "Bª Parque San Juan": { lat: -31.6480, lng: -64.4290 },
  "Prohas I Jardín Estancia": { lat: -31.6320, lng: -64.4130 },
  "Prohas III": { lat: -31.6300, lng: -64.4110 },
  "Valerio": { lat: -31.6560, lng: -64.4380 },
  "Portales del Tala": { lat: -31.6720, lng: -64.4200 },
  "Plano Viejo": { lat: -31.6570, lng: -64.4250 },
  "Santa Teresa de Jesús": { lat: -31.6490, lng: -64.4350 },
  "Buena Esperanza": { lat: -31.6650, lng: -64.4100 },
  "El Cañito": { lat: -31.6600, lng: -64.4050 },
  "La Verde": { lat: -31.6680, lng: -64.4060 },
  "Sur": { lat: -31.6750, lng: -64.4250 },
  "Norte": { lat: -31.6400, lng: -64.4250 },
  "Villa Camiares": { lat: -31.6730, lng: -64.4290 },
  "1° de Mayo": { lat: -31.6620, lng: -64.4350 },
  "Tiro Federal": { lat: -31.6440, lng: -64.4480 },
  "Alta Gracia Norte": { lat: -31.6380, lng: -64.4220 },
  "Liniers III de Horizonte": { lat: -31.6410, lng: -64.4270 },
  "La Hornilla": { lat: -31.6760, lng: -64.4320 },
  "25 de Mayo": { lat: -31.6630, lng: -64.4400 },
  "Piedra del Sapo": { lat: -31.6350, lng: -64.4150 },
  "Parque Casino": { lat: -31.6520, lng: -64.4350 },
  "Crucero de Horizonte": { lat: -31.6860, lng: -64.4360 },
  "Ala Industrial": { lat: -31.6480, lng: -64.4050 },
  "Córdoba": { lat: -31.6550, lng: -64.4200 },
  "B° El Mirador": { lat: -31.6580, lng: -64.4120 },
  "El Crucero": { lat: -31.6880, lng: -64.4340 },
  "Terrazas del Cielo": { lat: -31.6420, lng: -64.4440 },
  "Tres Gracias": { lat: -31.6390, lng: -64.4210 },
  "B° Lomas de la Estancia": { lat: -31.6700, lng: -64.4340 },
  "Portales del Sol": { lat: -31.6710, lng: -64.4190 },
  "La Rinconada": { lat: -31.6340, lng: -64.4300 },
  "El Potrerillo": { lat: -31.6280, lng: -64.4200 },
};

const OPTION_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444",
  "#EC4899", "#06B6D4", "#84CC16",
];

function ratingColor(avg: number): string {
  if (avg >= 4.0) return "#10B981";
  if (avg >= 3.0) return "#84CC16";
  if (avg >= 2.0) return "#F59E0B";
  return "#EF4444";
}

function createPieSvg(segments: { label: string; value: number; color: string }[], size = 50): string {
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
    paths.push(`<path d="M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${segment.color}" />`);
    cumulativeAngle += angle;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${center}" cy="${center}" r="${radius + 1}" fill="white" />
    ${paths.join("")}
  </svg>`;
}

export default function GeographicHeatMap({ neighborhoodData, questions }: GeographicHeatMapProps) {
  const [mounted, setMounted] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("participation");
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("");

  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<any[]>([]);
  const LRef = useRef<any>(null);

  const entries = Object.entries(neighborhoodData).filter(([key]) => key !== "Sin especificar");

  const mappableQuestions = questions.filter(
    (q) => q.results_by_neighborhood && Object.keys(q.results_by_neighborhood).length > 0
      && q.question_type !== "open_text"
  );

  // Derive the effective question id (use first if none selected)
  const effectiveQuestionId = selectedQuestionId || (mappableQuestions[0]?.question_id ?? "");
  const selectedQuestion = mappableQuestions.find((q) => q.question_id === effectiveQuestionId) ?? null;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize map once
  useEffect(() => {
    if (!mounted || mapRef.current || !mapContainerRef.current || entries.length === 0) return;

    import("leaflet").then((L) => {
      if (mapRef.current || !mapContainerRef.current) return;
      LRef.current = L;
      const mapInstance = L.map(mapContainerRef.current).setView([-31.6553, -64.4330], 14);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapInstance);
      mapRef.current = mapInstance;
      setMapReady(true);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        LRef.current = null;
        setMapReady(false);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // Update markers whenever map, viewMode, or question changes
  useEffect(() => {
    const L = LRef.current;
    const mapInstance = mapRef.current;
    if (!mapReady || !L || !mapInstance) return;

    // Clear markers
    markersRef.current.forEach((m) => { try { m.remove(); } catch (_) { /* */ } });
    markersRef.current = [];

    if (entries.length === 0) return;

    const maxValue = Math.max(...entries.map(([, v]) => v));
    const minValue = Math.min(...entries.map(([, v]) => v));

    const isRating = selectedQuestion?.question_type?.toLowerCase() === "rating";

    // Build color/label maps for non-rating questions
    const optionColorMap: Record<string, string> = {};
    const optionLabels: Record<string, string> = {};
    if (selectedQuestion && !isRating) {
      Object.entries(selectedQuestion.results).forEach(([key, val], idx) => {
        optionColorMap[key] = OPTION_COLORS[idx % OPTION_COLORS.length];
        optionLabels[key] = (val as any).label || key;
      });
    }

    const missing = entries.filter(([name]) => !NEIGHBORHOOD_COORDS[name]).map(([name]) => name);
    if (missing.length > 0) console.warn("Barrios sin coordenadas:", missing);

    entries.forEach(([name, participationCount]) => {
      const coords = NEIGHBORHOOD_COORDS[name];
      if (!coords) return;

      if (viewMode === "participation") {
        const normalized = maxValue > minValue ? (participationCount - minValue) / (maxValue - minValue) : 0.5;
        let color: string, radius: number;
        if (normalized >= 0.75) { color = "#EF4444"; radius = 250; }
        else if (normalized >= 0.5) { color = "#F97316"; radius = 220; }
        else if (normalized >= 0.25) { color = "#EAB308"; radius = 180; }
        else if (normalized >= 0.1) { color = "#22C55E"; radius = 140; }
        else { color = "#3B82F6"; radius = 100; }

        const m = L.circle([coords.lat, coords.lng], { color, fillColor: color, fillOpacity: 0.6, radius, weight: 3 })
          .bindTooltip(
            `<div style="text-align:center;padding:6px;"><strong style="font-size:14px;">${name}</strong><br/><span style="font-size:13px;color:#4B5563;">${participationCount} respuestas</span></div>`,
            { direction: "top", offset: [0, -10], opacity: 0.95 }
          ).addTo(mapInstance);
        markersRef.current.push(m);
        return;
      }

      if (!selectedQuestion) return;

      const nbResults = selectedQuestion.results_by_neighborhood?.[name];
      if (!nbResults) {
        const m = L.circleMarker([coords.lat, coords.lng], { color: "#9CA3AF", fillColor: "#9CA3AF", fillOpacity: 0.4, radius: 8, weight: 2 })
          .bindTooltip(
            `<div style="text-align:center;padding:6px;"><strong>${name}</strong><br/><span style="font-size:12px;color:#9CA3AF;">Sin datos</span></div>`,
            { direction: "top", offset: [0, -10], opacity: 0.95 }
          ).addTo(mapInstance);
        markersRef.current.push(m);
        return;
      }

      // RATING
      if (isRating) {
        const avg: number = (nbResults as any).average ?? 0;
        const totalR: number = (nbResults as any).total_ratings ?? 0;
        const color = ratingColor(avg);
        const stars = "★".repeat(Math.round(avg)) + "☆".repeat(5 - Math.round(avg));
        const tooltip = `<div style="padding:8px;min-width:160px;">
          <strong style="font-size:14px;">${name}</strong><br/>
          <span style="font-size:11px;color:#6B7280;">${participationCount} respuestas</span>
          <hr style="margin:6px 0;border-color:#E5E7EB;"/>
          <div style="font-size:18px;color:#F59E0B;">${stars}</div>
          <div style="font-size:13px;font-weight:600;color:${color};">${avg.toFixed(2)} / 5</div>
          <div style="font-size:11px;color:#6B7280;">${totalR} calificaciones</div>
        </div>`;
        const m = L.circle([coords.lat, coords.lng], { color, fillColor: color, fillOpacity: 0.65, radius: 200, weight: 3 })
          .bindTooltip(tooltip, { direction: "top", offset: [0, -10], opacity: 0.95 })
          .addTo(mapInstance);
        markersRef.current.push(m);
        return;
      }

      // SINGLE_CHOICE / PERCENTAGE_DISTRIBUTION
      const resultEntries = Object.entries(nbResults).sort((a, b) => {
        const aVal = (a[1] as any).percentage ?? (a[1] as any).votes ?? 0;
        const bVal = (b[1] as any).percentage ?? (b[1] as any).votes ?? 0;
        return bVal - aVal;
      });

      const tooltipLines = resultEntries.map(([key, val]) => {
        const v = val as any;
        const label = v.label || optionLabels[key] || key;
        const pct = v.percentage != null ? `${(v.percentage as number).toFixed(1)}%` : "";
        const votes = v.votes != null ? ` (${v.votes} votos)` : "";
        return `<span style="color:${optionColorMap[key] || "#666"};font-weight:600;">&#9679;</span> ${label}: ${pct}${votes}`;
      }).join("<br/>");

      const tooltip = `<div style="padding:8px;min-width:180px;">
        <strong style="font-size:14px;">${name}</strong><br/>
        <span style="font-size:11px;color:#6B7280;">${participationCount} respuestas</span>
        <hr style="margin:6px 0;border-color:#E5E7EB;"/>
        <div style="font-size:12px;line-height:1.6;">${tooltipLines}</div>
      </div>`;

      if (viewMode === "winner-color") {
        const winnerKey = resultEntries[0]?.[0] ?? "";
        const winnerColor = optionColorMap[winnerKey] || "#9CA3AF";
        const m = L.circle([coords.lat, coords.lng], { color: winnerColor, fillColor: winnerColor, fillOpacity: 0.65, radius: 200, weight: 3 })
          .bindTooltip(tooltip, { direction: "top", offset: [0, -10], opacity: 0.95 })
          .addTo(mapInstance);
        markersRef.current.push(m);
      } else if (viewMode === "pie-charts") {
        const segments = resultEntries.map(([key, val]) => ({
          label: (val as any).label || key,
          value: (val as any).percentage ?? (val as any).votes ?? 0,
          color: optionColorMap[key] || "#9CA3AF",
        }));
        const svgHtml = createPieSvg(segments, 50);
        const icon = L.divIcon({ html: svgHtml, className: "pie-chart-icon", iconSize: [50, 50], iconAnchor: [25, 25] });
        const m = L.marker([coords.lat, coords.lng], { icon })
          .bindTooltip(tooltip, { direction: "top", offset: [0, -25], opacity: 0.95 })
          .addTo(mapInstance);
        markersRef.current.push(m);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, viewMode, effectiveQuestionId, neighborhoodData]);

  // --- Render ---

  if (!mounted) {
    return (
      <div className="bg-[#3C2E51] rounded-2xl shadow-none border border-white/10 p-6">
        <h3 className="text-xl font-bold text-[#F2F3F4] mb-2">Desglose por Zona Geográfica</h3>
        <div className="h-96 bg-[#201631] rounded-lg flex items-center justify-center">
          <p className="text-[#F2F3F4]/50">Cargando mapa...</p>
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="bg-[#3C2E51] rounded-2xl shadow-none border border-white/10 p-6">
        <h3 className="text-xl font-bold text-[#F2F3F4] mb-2">Desglose por Zona Geográfica</h3>
        <p className="text-[#F2F3F4]/50 text-sm">No hay datos geográficos disponibles.</p>
      </div>
    );
  }

  const topZone = [...entries].sort((a, b) => b[1] - a[1])[0];
  const isRatingSelected = selectedQuestion?.question_type?.toLowerCase() === "rating";

  let optionLegend: { label: string; color: string }[] = [];
  if (viewMode !== "participation" && selectedQuestion) {
    if (isRatingSelected) {
      optionLegend = [
        { label: "Muy buena (4-5)", color: "#10B981" },
        { label: "Buena (3-4)", color: "#84CC16" },
        { label: "Regular (2-3)", color: "#F59E0B" },
        { label: "Mala (1-2)", color: "#EF4444" },
      ];
    } else {
      optionLegend = Object.entries(selectedQuestion.results).map(([key, val], idx) => ({
        label: (val as any).label || key,
        color: OPTION_COLORS[idx % OPTION_COLORS.length],
      }));
    }
  }

  return (
    <div className="bg-[#3C2E51] rounded-2xl shadow-none border border-white/10 p-6">
      <div className="mb-4">
        <h3 className="text-xl font-bold text-[#F2F3F4]">Desglose por Zona Geográfica</h3>
        <p className="text-sm text-[#F2F3F4]/50">Participación y votación por ubicación</p>
      </div>

      {/* View Mode Toggle */}
      <div className="flex gap-1 mb-4 bg-[#201631] rounded-lg p-1 w-fit">
        {(["participation", "pie-charts", "winner-color"] as ViewMode[]).map((mode) => (
          <button key={mode} onClick={() => setViewMode(mode)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${viewMode === mode ? "bg-[#5941CE] text-white shadow-sm" : "text-[#F2F3F4]/60 hover:text-[#F2F3F4]"}`}>
            {mode === "participation" ? "Participación" : mode === "pie-charts" ? "Pie Charts" : "Color Ganador"}
          </button>
        ))}
      </div>

      {/* Question Selector */}
      {viewMode !== "participation" && mappableQuestions.length > 0 && (
        <div className="mb-4">
          <select value={effectiveQuestionId} onChange={(e) => setSelectedQuestionId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-white/10 rounded-lg bg-[#201631] text-[#F2F3F4] focus:outline-none focus:ring-2 focus:ring-[#5941CE]">
            {mappableQuestions.map((q) => (
              <option key={q.question_id} value={q.question_id}>{q.question_text}</option>
            ))}
          </select>
        </div>
      )}

      {/* Map */}
      <div ref={mapContainerRef} className="h-[500px] rounded-lg overflow-hidden border border-white/10 mb-4" />

      {/* Legend */}
      {viewMode === "participation" ? (
        <div className="mb-4">
          <p className="text-xs font-medium text-[#F2F3F4]/60 mb-2">Intensidad de participación:</p>
          <div className="flex flex-wrap gap-3">
            {[{ color: "#EF4444", label: "Muy Alta" }, { color: "#F97316", label: "Alta" }, { color: "#EAB308", label: "Media" }, { color: "#22C55E", label: "Baja-Media" }, { color: "#3B82F6", label: "Baja" }].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs text-[#F2F3F4]/60">{label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : optionLegend.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-[#F2F3F4]/60 mb-2">
            {isRatingSelected ? "Escala de calificación:" : viewMode === "winner-color" ? "Color por opción ganadora:" : "Opciones:"}
          </p>
          <div className="flex flex-wrap gap-3">
            {optionLegend.map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs text-[#F2F3F4]/60">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insight */}
      <div className="bg-[#201631] border border-white/10 rounded-lg p-4">
        <p className="text-sm text-[#F2F3F4]/70">
          {viewMode === "participation" ? (
            <>La zona <span className="font-semibold text-[#F2F3F4]">{topZone[0]}</span> lidera con <span className="font-semibold text-[#F2F3F4]">{topZone[1].toLocaleString()}</span> respuestas.</>
          ) : viewMode === "pie-charts" ? (
            isRatingSelected ? "Cada barrio muestra un círculo con color según la calificación promedio. Pase el cursor para ver el detalle." : "Cada barrio muestra un mini gráfico circular con la distribución de respuestas."
          ) : (
            isRatingSelected ? "Cada barrio toma el color según su calificación promedio. Verde = buena gestión, Rojo = mala gestión." : "Cada barrio toma el color de la opción más votada."
          )}
        </p>
      </div>

      <style jsx global>{`.pie-chart-icon { background: transparent !important; border: none !important; }`}</style>
    </div>
  );
}
