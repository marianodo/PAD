"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import {
  APIProvider,
  Map,
  useMap,
} from "@vis.gl/react-google-maps";
import { MarkerClusterer, Marker } from "@googlemaps/markerclusterer";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

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
  neighborhoodCoords: Record<string, { lat: number; lng: number }>;
  mapCenter?: [number, number];
  mapZoom?: number;
  circleRadius?: number;
  title?: string;
  subtitle?: string;
  participationOnly?: boolean;
  groupBy?: "neighborhood" | "city";
  populationData?: Record<string, number>;
}

type ViewMode = "participation" | "pie-charts" | "winner-color";
type ParticipationSubMode = "total" | "rate";

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

function normalizedColor(normalized: number): string {
  if (normalized >= 0.75) return "#10B981";  // Verde - Muy Alta
  if (normalized >= 0.5) return "#84CC16";   // Lima - Alta
  if (normalized >= 0.25) return "#EAB308";  // Amarillo - Media
  if (normalized >= 0.1) return "#F97316";   // Naranja - Baja
  return "#EF4444";                          // Rojo - Muy Baja
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

interface MarkerData {
  name: string;
  position: { lat: number; lng: number };
  color: string;
  radius: number;
  tooltip: string;
  isPie?: boolean;
  pieSvg?: string;
}

// Inner component that has access to map instance via useMap
function MarkersLayer({ markers }: { markers: MarkerData[] }) {
  const map = useMap();
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!map) return;

    // Custom tooltip div anchored to the map container
    const mapDiv = map.getDiv() as HTMLDivElement;
    if (!tooltipRef.current) {
      const tip = document.createElement("div");
      tip.style.cssText = [
        "position:absolute",
        "pointer-events:none",
        "background:#fff",
        "color:#111",
        "border-radius:8px",
        "box-shadow:0 4px 12px rgba(0,0,0,0.18)",
        "font-family:system-ui,-apple-system,sans-serif",
        "z-index:1000",
        "display:none",
        "transform:translate(-50%, calc(-100% - 14px))",
      ].join(";");
      mapDiv.appendChild(tip);
      tooltipRef.current = tip;
    }
    const tip = tooltipRef.current;

    // Clear existing clusterer
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
      clustererRef.current = null;
    }

    if (markers.length === 0) return;

    const projection = () => {
      // The OverlayView projection is the only way to convert LatLng -> pixel on the map
      // We use a tiny dummy OverlayView lazy-init
      return null;
    };
    void projection;

    // Helper: convert lat/lng to pixel relative to mapDiv using a one-shot OverlayView
    const overlayHelper = new google.maps.OverlayView();
    overlayHelper.draw = () => {};
    overlayHelper.setMap(map);

    const showTip = (m: MarkerData) => {
      const proj = overlayHelper.getProjection();
      if (!proj) return;
      const point = proj.fromLatLngToContainerPixel(new google.maps.LatLng(m.position.lat, m.position.lng));
      if (!point) return;
      tip.innerHTML = m.tooltip;
      tip.style.left = `${point.x}px`;
      tip.style.top = `${point.y}px`;
      tip.style.display = "block";
    };
    const hideTip = () => { tip.style.display = "none"; };

    const gMarkers: Marker[] = markers.map((m) => {
      const marker = new google.maps.Marker({
        position: m.position,
        icon: m.isPie && m.pieSvg
          ? {
              url: `data:image/svg+xml;utf-8,${encodeURIComponent(m.pieSvg)}`,
              scaledSize: new google.maps.Size(50, 50),
              anchor: new google.maps.Point(25, 25),
            }
          : {
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: m.color,
              fillOpacity: 0.65,
              strokeColor: m.color,
              strokeWeight: 2,
              scale: m.radius,
            },
        title: m.name,
      });
      marker.addListener("mouseover", () => showTip(m));
      marker.addListener("mouseout", hideTip);
      return marker;
    });

    clustererRef.current = new MarkerClusterer({
      map,
      markers: gMarkers,
      renderer: {
        render: ({ count, position }) => {
          let bg = "rgba(59, 130, 246, 0.85)";
          if (count >= 20) bg = "rgba(239, 68, 68, 0.9)";
          else if (count >= 10) bg = "rgba(234, 179, 8, 0.9)";
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">
            <circle cx="20" cy="20" r="18" fill="${bg}" stroke="white" stroke-width="2"/>
            <text x="20" y="25" text-anchor="middle" fill="white" font-size="13" font-weight="700" font-family="Arial">${count}</text>
          </svg>`;
          return new google.maps.Marker({
            position,
            icon: {
              url: `data:image/svg+xml;utf-8,${encodeURIComponent(svg)}`,
              scaledSize: new google.maps.Size(40, 40),
              anchor: new google.maps.Point(20, 20),
            },
            zIndex: 1000 + count,
          });
        },
      },
    });

    return () => {
      hideTip();
      overlayHelper.setMap(null);
      if (clustererRef.current) {
        clustererRef.current.clearMarkers();
        clustererRef.current = null;
      }
      gMarkers.forEach((m) => (m as google.maps.Marker).setMap(null));
    };
  }, [map, markers]);

  return null;
}

export default function GeographicHeatMap({
  neighborhoodData, questions, neighborhoodCoords,
  mapCenter = [-31.6553, -64.4330], mapZoom = 14, circleRadius: _circleRadius,
  title = "Desglose por Zona Geográfica", subtitle = "Participación y votación por ubicación",
  participationOnly = false,
  groupBy = "neighborhood",
  populationData,
}: GeographicHeatMapProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("participation");
  const [participationSub, setParticipationSub] = useState<ParticipationSubMode>("total");
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("");

  const entries = Object.entries(neighborhoodData).filter(([key]) => key !== "Sin especificar");
  const resultsKey = groupBy === "city" ? "results_by_city" : "results_by_neighborhood";

  const mappableQuestions = questions.filter(
    (q) => (q as any)[resultsKey] && Object.keys((q as any)[resultsKey]).length > 0
      && q.question_type !== "open_text"
  );

  const effectiveQuestionId = selectedQuestionId || (mappableQuestions[0]?.question_id ?? "");
  const selectedQuestion = mappableQuestions.find((q) => q.question_id === effectiveQuestionId) ?? null;

  // Build markers data based on viewMode
  const markers = useMemo<MarkerData[]>(() => {
    if (entries.length === 0) return [];

    const maxValue = Math.max(...entries.map(([, v]) => v));
    const minValue = Math.min(...entries.map(([, v]) => v));

    const rateMap: Record<string, number> = {};
    if (populationData) {
      entries.forEach(([name, count]) => {
        const pop = populationData[name];
        if (pop) rateMap[name] = (count / pop) * 100;
      });
    }
    const rateValues = Object.values(rateMap);
    const maxRate = rateValues.length > 0 ? Math.max(...rateValues) : 1;
    const minRate = rateValues.length > 0 ? Math.min(...rateValues) : 0;

    const isRating = selectedQuestion?.question_type?.toLowerCase() === "rating";

    const optionColorMap: Record<string, string> = {};
    const optionLabels: Record<string, string> = {};
    if (selectedQuestion && !isRating) {
      Object.entries(selectedQuestion.results).forEach(([key, val], idx) => {
        optionColorMap[key] = OPTION_COLORS[idx % OPTION_COLORS.length];
        optionLabels[key] = (val as any).label || key;
      });
    }

    const out: MarkerData[] = [];

    entries.forEach(([name, participationCount]) => {
      const coords = neighborhoodCoords[name];
      if (!coords) return;
      const position = { lat: coords.lat, lng: coords.lng };

      if (viewMode === "participation") {
        if (participationSub === "rate") {
          const population = populationData?.[name];
          if (!population) {
            out.push({
              name, position, color: "#9CA3AF", radius: 6,
              tooltip: `<div style="text-align:center;padding:6px;"><strong style="font-size:14px;">${name}</strong><br/><span style="font-size:13px;color:#4B5563;">${participationCount} respuestas</span><br/><span style="font-size:11px;color:#9CA3AF;">Sin datos de población</span></div>`,
            });
            return;
          }
          const rate = rateMap[name] ?? (participationCount / population) * 100;
          const normalized = maxRate > minRate ? (rate - minRate) / (maxRate - minRate) : 0.5;
          const color = normalizedColor(normalized);
          const radius = 8 + Math.round(normalized * 12);
          out.push({
            name, position, color, radius,
            tooltip: `<div style="text-align:center;padding:8px;min-width:180px;">
              <strong style="font-size:14px;">${name}</strong>
              <hr style="margin:6px 0;border-color:#E5E7EB;"/>
              <div style="font-size:18px;font-weight:700;color:${color};">${rate.toFixed(2)}%</div>
              <div style="font-size:11px;color:#6B7280;margin-top:2px;">tasa de participación</div>
              <hr style="margin:6px 0;border-color:#E5E7EB;"/>
              <div style="font-size:12px;color:#4B5563;">${participationCount.toLocaleString()} respuestas</div>
              <div style="font-size:12px;color:#4B5563;">${population.toLocaleString()} habitantes</div>
            </div>`,
          });
          return;
        }

        const normalized = maxValue > minValue ? (participationCount - minValue) / (maxValue - minValue) : 0.5;
        const color = normalizedColor(normalized);
        const radius = 8 + Math.round(normalized * 12);
        out.push({
          name, position, color, radius,
          tooltip: `<div style="text-align:center;padding:6px;"><strong style="font-size:14px;">${name}</strong><br/><span style="font-size:13px;color:#4B5563;">${participationCount} respuestas</span></div>`,
        });
        return;
      }

      if (!selectedQuestion) return;

      const nbResults = (selectedQuestion as any)[resultsKey]?.[name];
      if (!nbResults) {
        out.push({
          name, position, color: "#9CA3AF", radius: 8,
          tooltip: `<div style="text-align:center;padding:6px;"><strong>${name}</strong><br/><span style="font-size:12px;color:#9CA3AF;">Sin datos</span></div>`,
        });
        return;
      }

      if (isRating) {
        const avg: number = (nbResults as any).average ?? 0;
        const totalR: number = (nbResults as any).total_ratings ?? 0;
        const color = ratingColor(avg);
        const stars = "★".repeat(Math.round(avg)) + "☆".repeat(5 - Math.round(avg));
        out.push({
          name, position, color, radius: 12,
          tooltip: `<div style="padding:8px;min-width:160px;">
            <strong style="font-size:14px;">${name}</strong><br/>
            <span style="font-size:11px;color:#6B7280;">${participationCount} respuestas</span>
            <hr style="margin:6px 0;border-color:#E5E7EB;"/>
            <div style="font-size:18px;color:#F59E0B;">${stars}</div>
            <div style="font-size:13px;font-weight:600;color:${color};">${avg.toFixed(2)} / 5</div>
            <div style="font-size:11px;color:#6B7280;">${totalR} calificaciones</div>
          </div>`,
        });
        return;
      }

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
        out.push({ name, position, color: winnerColor, radius: 12, tooltip });
      } else if (viewMode === "pie-charts") {
        const segments = resultEntries.map(([key, val]) => ({
          label: (val as any).label || key,
          value: (val as any).percentage ?? (val as any).votes ?? 0,
          color: optionColorMap[key] || "#9CA3AF",
        }));
        const svgHtml = createPieSvg(segments, 50);
        out.push({ name, position, color: "#000", radius: 0, tooltip, isPie: true, pieSvg: svgHtml });
      }
    });

    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, participationSub, effectiveQuestionId, neighborhoodData, populationData, neighborhoodCoords]);

  // --- Render ---

  if (entries.length === 0) {
    return (
      <div className="bg-[#1a1a2e] rounded-2xl shadow-none border border-white/10 p-6">
        <h3 className="text-xl font-bold text-[#FFFFFF] mb-2">{title}</h3>
        <p className="text-[#FFFFFF]/50 text-sm">No hay datos geográficos disponibles.</p>
      </div>
    );
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="bg-[#1a1a2e] rounded-2xl shadow-none border border-white/10 p-6">
        <h3 className="text-xl font-bold text-[#FFFFFF] mb-2">{title}</h3>
        <p className="text-red-400 text-sm">Falta NEXT_PUBLIC_GOOGLE_MAPS_API_KEY en las variables de entorno.</p>
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
      optionLegend = Object.entries(selectedQuestion!.results).map(([key, val], idx) => ({
        label: (val as any).label || key,
        color: OPTION_COLORS[idx % OPTION_COLORS.length],
      }));
    }
  }

  return (
    <div className="bg-[#1a1a2e] rounded-2xl shadow-none border border-white/10 p-6">
      <div className="mb-4">
        <h3 className="text-xl font-bold text-[#FFFFFF]">Desglose por Zona Geográfica</h3>
        <p className="text-sm text-[#FFFFFF]/50">{subtitle}</p>
      </div>

      {/* View Mode Toggle */}
      {!participationOnly && (
        <div className="flex gap-1 mb-4 bg-[#000000] rounded-lg p-1 w-fit">
          {(["participation", "pie-charts", "winner-color"] as ViewMode[]).map((mode) => (
            <button key={mode} onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${viewMode === mode ? "bg-[#2962FF] text-white shadow-sm" : "text-[#FFFFFF]/60 hover:text-[#FFFFFF]"}`}>
              {mode === "participation" ? "Participación" : mode === "pie-charts" ? "Pie Charts" : "Color Ganador"}
            </button>
          ))}
        </div>
      )}

      {/* Participation Sub-tabs */}
      {viewMode === "participation" && populationData && (
        <div className="flex gap-1 mb-4 bg-[#000000]/50 rounded-lg p-1 w-fit">
          {([["total", "Total"], ["rate", "% Población"]] as [ParticipationSubMode, string][]).map(([sub, label]) => (
            <button key={sub} onClick={() => setParticipationSub(sub)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition ${participationSub === sub ? "bg-white/15 text-white" : "text-[#FFFFFF]/40 hover:text-[#FFFFFF]/70"}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Question Selector */}
      {!participationOnly && viewMode !== "participation" && mappableQuestions.length > 0 && (
        <div className="mb-4">
          <select value={effectiveQuestionId} onChange={(e) => setSelectedQuestionId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-white/10 rounded-lg bg-[#000000] text-[#FFFFFF] focus:outline-none focus:ring-2 focus:ring-[#2962FF]">
            {mappableQuestions.map((q) => (
              <option key={q.question_id} value={q.question_id}>{q.question_text}</option>
            ))}
          </select>
        </div>
      )}

      {/* Map */}
      <div className="h-[500px] rounded-lg overflow-hidden border border-white/10 mb-4">
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
          <Map
            defaultCenter={{ lat: mapCenter[0], lng: mapCenter[1] }}
            defaultZoom={mapZoom}
            mapId="pad-cordoba-map"
            gestureHandling="greedy"
            disableDefaultUI={false}
            style={{ width: "100%", height: "100%" }}
          >
            <MarkersLayer markers={markers} />
          </Map>
        </APIProvider>
      </div>

      {/* Legend */}
      {viewMode === "participation" ? (
        <div className="mb-4">
          <p className="text-xs font-medium text-[#FFFFFF]/60 mb-2">
            {participationSub === "rate" ? "Tasa de participación relativa:" : "Intensidad de participación:"}
          </p>
          <div className="flex flex-wrap gap-3">
            {([{ color: "#10B981", label: "Muy Alta" }, { color: "#84CC16", label: "Alta" }, { color: "#EAB308", label: "Media" }, { color: "#F97316", label: "Baja" }, { color: "#EF4444", label: "Muy Baja" }]
            ).map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs text-[#FFFFFF]/60">{label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : optionLegend.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-[#FFFFFF]/60 mb-2">
            {isRatingSelected ? "Escala de calificación:" : viewMode === "winner-color" ? "Color por opción ganadora:" : "Opciones:"}
          </p>
          <div className="flex flex-wrap gap-3">
            {optionLegend.map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs text-[#FFFFFF]/60">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insight */}
      <div className="bg-[#000000] border border-white/10 rounded-lg p-4">
        <p className="text-sm text-[#FFFFFF]/70">
          {viewMode === "participation" ? (
            participationSub === "rate" ? (
              (() => {
                const ranked = entries
                  .filter(([name]) => populationData?.[name])
                  .map(([name, count]) => ({ name, count, pop: populationData![name], rate: (count / populationData![name]) * 100 }))
                  .sort((a, b) => b.rate - a.rate);
                const top = ranked[0];
                const bottom = ranked[ranked.length - 1];
                return top && bottom ? (
                  <>Mayor tasa: <span className="font-semibold text-[#FFFFFF]">{top.name}</span> con <span className="font-semibold text-[#10B981]">{top.rate.toFixed(2)}%</span> ({top.count.toLocaleString()} resp. / {top.pop.toLocaleString()} hab.). Menor tasa: <span className="font-semibold text-[#FFFFFF]">{bottom.name}</span> con <span className="font-semibold text-[#EF4444]">{bottom.rate.toFixed(2)}%</span> ({bottom.count.toLocaleString()} resp. / {bottom.pop.toLocaleString()} hab.).</>
                ) : <>No hay datos de población disponibles.</>;
              })()
            ) : (
              <>La zona <span className="font-semibold text-[#FFFFFF]">{topZone[0]}</span> lidera con <span className="font-semibold text-[#FFFFFF]">{topZone[1].toLocaleString()}</span> respuestas.</>
            )
          ) : viewMode === "pie-charts" ? (
            isRatingSelected ? "Cada barrio muestra un círculo con color según la calificación promedio. Pase el cursor para ver el detalle." : "Cada barrio muestra un mini gráfico circular con la distribución de respuestas."
          ) : (
            isRatingSelected ? "Cada barrio toma el color según su calificación promedio. Verde = buena gestión, Rojo = mala gestión." : "Cada barrio toma el color de la opción más votada."
          )}
        </p>
      </div>
    </div>
  );
}
