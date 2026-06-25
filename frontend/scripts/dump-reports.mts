/**
 * Dump del contenido estático actual de los reportes (alta-gracia, cordoba) a JSON,
 * para migrarlo a la DB. Inyecta el color real por segmento (que vivía en los componentes)
 * dentro de cada segmento. Se corre UNA vez, antes de borrar las páginas estáticas:
 *
 *   cd frontend && npx tsx scripts/dump-reports.mts
 */
import { writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { segments as agSegments } from "../app/reports/alta-gracia/2026/lib/data";
import { segments as cbaSegments } from "../app/reports/cordoba/2026/lib/data";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../../backend/scripts/report_seeds");
mkdirSync(OUT, { recursive: true });

// Colores reales por segmento (estaban hardcodeados en dashboard.tsx / segment-view.tsx)
const AG_COLORS: Record<string, string> = {
  "espacios-publicos": "#10b981",
  "servicios-publicos": "#f97316",
  "deportes-cultura-turismo": "#8b5cf6",
  "ayuda-social": "#f59e0b",
  "obras": "#ec4899",
  "salud": "#ef4444",
  "seguridad": "#0ea5e9",
  "otras-acciones": "#6366f1",
};
const CBA_COLORS: Record<string, string> = {
  "seguridad": "#0ea5e9",
  "salud": "#ef4444",
  "obra-publica": "#ec4899",
  "educacion": "#8b5cf6",
  "trabajo-empleo": "#f59e0b",
  "industria-produccion": "#10b981",
  "campo": "#84cc16",
  "economia-fiscal": "#6366f1",
};

const withColors = (segs: any[], colors: Record<string, string>) =>
  segs.map((s) => ({ ...s, color: colors[s.id] ?? "#0ea5e9" }));

const docs = [
  {
    slug: "alta-gracia-2026",
    period: "2026",
    client_name: "Municipalidad de Alta Gracia",
    config: {
      badge: "Gestión Municipal 2026",
      title: "Acciones 2026",
      titleHighlight: "Alta Gracia",
      description:
        "Detalle de acciones, inversiones y proyectos planificados por la Municipalidad de Alta Gracia para el ejercicio fiscal 2026, organizados por área de gestión.",
      descriptionMaxWidth: "max-w-xl",
      statsCategoryLabel: "Categorías",
      segmentWord: "categorías",
      year: "2026",
      footer: "P.A.D. — Participación Activa Digital | Municipalidad de Alta Gracia 2026",
    },
    segments: withColors(agSegments, AG_COLORS),
  },
  {
    slug: "cordoba-2026",
    period: "2026",
    client_name: "Gobierno de la Provincia de Córdoba",
    config: {
      badge: "Gestión Provincial 2026",
      title: "Plan de Gobierno 2026",
      titleHighlight: "Provincia de Córdoba",
      description:
        "Acciones, inversiones y compromisos anunciados por el Gobernador Martín Llaryora en la apertura de sesiones legislativas 2026, organizados por área de gestión.",
      descriptionMaxWidth: "max-w-2xl",
      statsCategoryLabel: "Áreas",
      segmentWord: "áreas",
      year: "2026",
      footer: "P.A.D. — Participación Activa Digital | Gobierno de la Provincia de Córdoba 2026",
    },
    segments: withColors(cbaSegments, CBA_COLORS),
  },
];

for (const d of docs) {
  writeFileSync(join(OUT, `${d.slug}.json`), JSON.stringify(d, null, 2));
  console.log(`wrote ${d.slug}.json — ${d.segments.length} segmentos`);
}
