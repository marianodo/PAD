"use client";

import { useState } from "react";

interface ReportHighlight {
  title: string;
  description: string;
}

interface Report {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  icon: string;
  pdfUrl: string;
  color: string;
  bgLight: string;
  highlights: ReportHighlight[];
  keyActions: string[];
}

const reports: Report[] = [
  {
    id: "salud",
    title: "Salud",
    shortTitle: "Salud",
    description:
      "Obras de infraestructura sanitaria, modernización del sistema de salud, programas de prevención y formación profesional para 2026.",
    icon: "🏥",
    pdfUrl:
      "https://blobs.vusercontent.net/blob/SALUD%202026%20ALTA%20GRACIA-Fh1BZbhBam7IKR5qk3u78HyNL2zeLj.pdf",
    color: "bg-rose-500",
    bgLight: "bg-rose-50",
    highlights: [
      {
        title: "Ampliación Dispensario 3",
        description:
          "Ampliación del Dispensario Ramón Carrillo para aumentar capacidad de respuesta",
      },
      {
        title: "Nuevo Centro de Salud",
        description:
          "Centro moderno con especialidades interdisciplinarias en edificio recuperado",
      },
      {
        title: "Historia Clínica Digital",
        description:
          "Implementación de historia clínica digital y sistema de turnos accesible",
      },
    ],
    keyActions: [
      "Campañas de prevención contra el dengue",
      "Fortalecimiento de salud mental con la RAAC",
      "Programas de salud visual y traslados médicos",
      "Primeros 30 egresados de Enfermería en Alta Gracia",
      "Salud escolar alcanzando miles de estudiantes",
    ],
  },
  {
    id: "ayuda-social",
    title: "Ayuda Social",
    shortTitle: "Ayuda Social",
    description:
      "Políticas sociales centradas en la cercanía territorial y el acompañamiento a los sectores más vulnerables de la comunidad.",
    icon: "🤝",
    pdfUrl:
      "https://blobs.vusercontent.net/blob/AYUDA%20SOCIAL%202026%20ALTA%20GRACIA-nDadMiKBR3fQCDxLtqE5uVbuTyiRkW.pdf",
    color: "bg-amber-500",
    bgLight: "bg-amber-50",
    highlights: [
      {
        title: "Programa Estamos Cerca",
        description:
          "Eje central de gestión social con asistencia alimentaria y económica inmediata",
      },
      {
        title: "Terminar la Escuela",
        description: "Nueva iniciativa para quienes no completaron el secundario",
      },
      {
        title: "Centro de Desarrollo Infantil",
        description:
          "Nuevo centro en Barrio Parque San Juan para niños de 45 días a 3 años",
      },
    ],
    keyActions: [
      "Fortalecimiento de Salas Cuna con alimentación y estimulación",
      "Consolidación del Centro de Adultos Mayores en Barrio Don Bosco",
      "Beneficios tributarios para jubilados y pensionados",
      "Cuatro nuevas diplomaturas con aval de la UNC",
      "Pases libres de transporte para personas con discapacidad",
    ],
  },
  {
    id: "deportes-cultura-turismo",
    title: "Deportes, Cultura y Turismo",
    shortTitle: "Deportes",
    description:
      "Infraestructura deportiva, eventos culturales, festivales y estrategia de desarrollo turístico regional.",
    icon: "🏆",
    pdfUrl:
      "https://blobs.vusercontent.net/blob/DEPORTES%2C%20CULTURA%20Y%20TURISMO%202026%20ALTA%20GRACIA-VkmE0stgHEvAe2kTUlZo2tMdrkDfgx.pdf",
    color: "bg-emerald-500",
    bgLight: "bg-emerald-50",
    highlights: [
      {
        title: "Nuevo Playón Deportivo",
        description:
          "Construcción en el sector sur del Parque Deportivo con la calesita histórica",
      },
      {
        title: "Festival Peperina 10° Edición",
        description:
          "Organización de la décima edición del Festival Peperina en 2026",
      },
      {
        title: "Restauración del Viejo Casino",
        description:
          "Obra adjudicada para restauración integral e integración al circuito turístico",
      },
    ],
    keyActions: [
      "Programa Cuna de Campeones para atletas de alto rendimiento",
      "Escuelas Municipales de natación, atletismo, vóley, básquet",
      "Consolidación de pista BMX sede de campeonatos internacionales",
      "Festival de Colectividades, Jazz de Invierno y Happy Birra",
      "Impulso a la Economía Naranja como motor de empleo",
    ],
  },
  {
    id: "espacios-publicos",
    title: "Espacios Públicos",
    shortTitle: "Espacios",
    description:
      "Inversiones en recuperación del patrimonio histórico y creación de nuevos puntos de encuentro para la comunidad.",
    icon: "🌳",
    pdfUrl:
      "https://blobs.vusercontent.net/blob/ESPACIOS%20PUBLICOS%202026%20ALTA%20GRACIA-MxNVaY2UgbCh8TKzNUVs1FaISbnTOs.pdf",
    color: "bg-green-600",
    bgLight: "bg-green-50",
    highlights: [
      {
        title: "Transformación Belgrano 15",
        description:
          "Nuevo espacio integrando edificio municipal, ferias y áreas de esparcimiento",
      },
      {
        title: "Recuperación Colonia Santa Fe",
        description:
          "Restauración integral con financiamiento de la Provincia de Córdoba",
      },
      {
        title: "Centros de Participación Vecinal",
        description:
          "Construcción de dos centros nuevos en Villa Oviedo y Valle Buena Esperanza",
      },
    ],
    keyActions: [
      "Remodelación de Avenida Libertador etapa Llorens-Génova",
      "Renovación del sistema de iluminación LED en todos los barrios",
      "Mantenimiento de 13 puntos verdes de reciclaje",
      "Plan de reforestación con más de 1.000 árboles plantados",
      "Criterios de sustentabilidad en todos los proyectos",
    ],
  },
  {
    id: "seguridad",
    title: "Seguridad",
    shortTitle: "Seguridad",
    description:
      "Política de seguridad sostenida con inversiones en tecnología, vigilancia y prevención ciudadana.",
    icon: "🛡️",
    pdfUrl:
      "https://blobs.vusercontent.net/blob/SEGURIDAD%202026%20ALTA%20GRACIA-auKWLNDq0kwLQi9GvW22iU8YngLN4t.pdf",
    color: "bg-[#2962FF]",
    bgLight: "bg-[#2962FF]/5",
    highlights: [
      {
        title: "Nuevos Efectivos Policiales",
        description:
          "Formación de más de 60 suboficiales para trabajar en el territorio",
      },
      {
        title: "Programa Ojos en Alerta",
        description:
          "Red ciudadana con 3.900 participantes activos y 80-100 alertas diarias",
      },
      {
        title: "Lectores de Patentes",
        description:
          "Instalación de lectores en los accesos a la ciudad para prevención inteligente",
      },
    ],
    keyActions: [
      "Modernización de Central de Monitoreo con cámaras de alta resolución",
      "Creación de corredores seguros con vigilancia permanente",
      "Nueva rotonda sobre Ruta C-45 Norte para seguridad vial",
      "Más de 4.500 vecinos capacitados en prevención ciudadana",
      "Fortalecimiento de educación vial en escuelas",
    ],
  },
  {
    id: "servicios-publicos",
    title: "Servicios Públicos",
    shortTitle: "Servicios",
    description:
      "Inversiones en infraestructura básica, gestión de residuos, modernización tecnológica y transición energética.",
    icon: "🔧",
    pdfUrl:
      "https://blobs.vusercontent.net/blob/SERVICIOS%20PUBLICOS%202026%20ALTA%20GRACIA-4ZIwhU5hoUqce2ceasvxU0u1sVoNdY.pdf",
    color: "bg-orange-500",
    bgLight: "bg-orange-50",
    highlights: [
      {
        title: "Asistente Virtual 24/7",
        description:
          "Bot para consultas y reclamos disponible las 24 horas, los 365 días",
      },
      {
        title: "200 Nuevos Lotes Planificados",
        description:
          "Desarrollo de lotes con redes de agua, cloacas y servicios básicos",
      },
      {
        title: "Transición Energética",
        description:
          "Integración a Red Provincial de Carga de EPEC para movilidad eléctrica",
      },
    ],
    keyActions: [
      "Fortalecimiento de flota municipal con camiones y maquinaria vial",
      "Ampliación de redes de agua y cloacas",
      "Recuperación de 141 toneladas de materiales reciclables",
      "Saneamiento de lagunas sanitarias",
      "Mantenimiento continuo de plazas y costanera",
    ],
  },
  {
    id: "otras-acciones",
    title: "Otras Acciones",
    shortTitle: "Otras",
    description:
      "Desarrollo productivo, educación como motor de desarrollo y modernización del estado con transparencia.",
    icon: "💡",
    pdfUrl:
      "https://blobs.vusercontent.net/blob/OTRAS%20ACCIONES%202026%20ALTA%20GRACIA-hzr3NR4la08O8W69GkfyDaCdb6j9KR.pdf",
    color: "bg-yellow-500",
    bgLight: "bg-yellow-50",
    highlights: [
      {
        title: "Polo ALA Industrial",
        description:
          "Proyecto de 145 hectáreas sobre Ruta C45 para transformar la matriz económica",
      },
      {
        title: "Beneficios Fiscales",
        description:
          "Proyecto de ordenanza para exenciones a quienes inviertan y generen empleo",
      },
      {
        title: "6 Años de Superávit",
        description:
          "Orden financiero que permite realizar obras sin depender de fondos externos",
      },
    ],
    keyActions: [
      "Consolidación del Parque PyME inaugurado en 2023",
      "Construcción de 4 nuevas aulas en jardines de infantes",
      "Inicio del edificio propio del IPEM 345",
      "Primeros egresados de Enfermería y diplomaturas UNC",
      "Digitalización de licencias y habilitaciones comerciales",
    ],
  },
  {
    id: "obras",
    title: "Obras",
    shortTitle: "Obras",
    description:
      "Detalle de obras en ejecución y proyectos planificados para infraestructura educativa, vial, deportiva y de vivienda.",
    icon: "🏗️",
    pdfUrl:
      "https://blobs.vusercontent.net/blob/OBRAS%202026%20ALTA%20GRACIA-WinN0h3hMr7EXiHajFxPe0Y6xundwM.pdf",
    color: "bg-slate-600",
    bgLight: "bg-slate-50",
    highlights: [
      {
        title: "IPEM 345 Edificio Propio",
        description:
          "Construcción del edificio del IPEM 345 Maestro Hugo Barrera en zona oeste",
      },
      {
        title: "Avenida Libertador",
        description: "Segunda etapa de remodelación desde Llorens hasta Génova",
      },
      {
        title: "Nueva Escuela Secundaria",
        description:
          "Compromiso de construir secundaria en Barrio Tiro Federal",
      },
    ],
    keyActions: [
      "Ampliación del Dispensario 3 Ramón Carrillo",
      "Centro de Desarrollo Infantil en Barrio Parque San Juan",
      "Pavimentación de calle España y adoquinado en Belgrano",
      "Rotonda sobre Ruta C-45 Norte",
      "Compra de terrenos para 200 lotes planificados",
    ],
  },
];

function ReportCard({ report, defaultExpanded = false }: { report: Report; defaultExpanded?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div
      id={report.id}
      className={`rounded-2xl border bg-white transition-all duration-300 hover:shadow-lg cursor-pointer ${
        isExpanded ? "ring-2 ring-[#2962FF] shadow-lg" : "border-gray-200"
      }`}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${report.color}`}
            >
              {report.icon}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{report.title}</h3>
              <p className="text-sm text-gray-500">Informe de Inversión 2026</p>
            </div>
          </div>
          <svg
            className={`h-5 w-5 shrink-0 text-gray-400 transition-transform duration-300 mt-1 ${
              isExpanded ? "rotate-90" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-gray-500">{report.description}</p>

        {/* Badges */}
        <div className="mt-4 flex flex-wrap gap-2">
          {report.highlights.slice(0, 2).map((h, i) => (
            <span
              key={i}
              className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600"
            >
              {h.title}
            </span>
          ))}
          {report.highlights.length > 2 && (
            <span className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-500">
              +{report.highlights.length - 2} más
            </span>
          )}
        </div>

        {/* Expanded content */}
        <div
          className={`grid transition-all duration-300 ${
            isExpanded ? "grid-rows-[1fr] opacity-100 mt-6" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <div className="space-y-6 border-t border-gray-100 pt-6">
              {/* Highlights */}
              <div>
                <h4 className="mb-3 text-sm font-semibold text-gray-900">Puntos Destacados</h4>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {report.highlights.map((h, i) => (
                    <div key={i} className={`rounded-lg p-3 ${report.bgLight}`}>
                      <h5 className="mb-1 text-sm font-medium text-gray-900">{h.title}</h5>
                      <p className="text-xs leading-relaxed text-gray-500">{h.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Key Actions */}
              <div>
                <h4 className="mb-3 text-sm font-semibold text-gray-900">Acciones Clave</h4>
                <ul className="space-y-2">
                  {report.keyActions.map((action, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-500">
                      <svg
                        className="mt-0.5 h-4 w-4 shrink-0 text-green-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Download */}
              <div className="border-t border-gray-100 pt-4">
                <a
                  href={report.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#2962FF] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a4fd4] transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Descargar PDF Completo
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AltaGracia2026() {
  const [activeSegment, setActiveSegment] = useState<string | null>(null);
  const [hashSegment, setHashSegment] = useState<string | null>(null);

  // Leer el hash de la URL para auto-expandir y hacer scroll a esa sección
  useState(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace("#", "");
      if (hash && reports.some((r) => r.id === hash)) {
        setHashSegment(hash);
        setTimeout(() => {
          document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
      }
    }
  });

  const filtered = activeSegment ? reports.filter((r) => r.id === activeSegment) : reports;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2962FF] text-white font-bold text-lg">
              AG
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">Municipalidad</div>
              <div className="text-xs text-gray-500">Alta Gracia</div>
            </div>
          </div>
          <span className="rounded-full bg-[#2962FF]/5 px-3 py-1 text-xs font-medium text-[#2962FF]">
            Informes 2026
          </span>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-[#2962FF] px-4 py-16 text-white md:py-24">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff12_1px,transparent_1px),linear-gradient(to_bottom,#ffffff12_1px,transparent_1px)] bg-[size:24px_24px]" />
        </div>
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur-sm">
            <span>📋</span>
            <span>Gestión Municipal 2026</span>
          </div>
          <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
            Informes de Inversión
            <br />
            <span className="text-white/80">por Segmento</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-white/80">
            Accedé a los informes detallados de las inversiones y acciones planificadas por la
            Municipalidad de Alta Gracia para el año 2026.
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
              <div className="text-3xl font-bold">{reports.length}</div>
              <div className="text-sm text-white/70">Segmentos</div>
            </div>
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
              <div className="text-3xl font-bold">2026</div>
              <div className="text-sm text-white/70">Año Fiscal</div>
            </div>
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
              <div className="text-3xl font-bold">
                {reports.reduce((acc, r) => acc + r.keyActions.length, 0)}+
              </div>
              <div className="text-sm text-white/70">Acciones</div>
            </div>
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
              <div className="text-3xl font-bold">PDF</div>
              <div className="text-sm text-white/70">Descargables</div>
            </div>
          </div>
        </div>
      </section>

      {/* Segment Nav */}
      <nav className="sticky top-16 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex items-center gap-1 overflow-x-auto py-3 scrollbar-hide">
            <button
              onClick={() => setActiveSegment(null)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeSegment === null
                  ? "bg-[#2962FF] text-white"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              Todos
            </button>
            {reports.map((r) => (
              <button
                key={r.id}
                onClick={() => setActiveSegment(r.id === activeSegment ? null : r.id)}
                className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  activeSegment === r.id
                    ? "bg-[#2962FF] text-white"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <span>{r.icon}</span>
                <span className="hidden sm:inline">{r.shortTitle}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {activeSegment ? reports.find((r) => r.id === activeSegment)?.title : "Todos los Informes"}
          </h2>
          <p className="mt-1 text-gray-500">
            {filtered.length} {filtered.length === 1 ? "informe" : "informes"} disponibles
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {filtered.map((report) => (
            <ReportCard key={report.id} report={report} defaultExpanded={report.id === hashSegment} />
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid gap-8 md:grid-cols-3">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2962FF] text-white font-bold">
                  AG
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  Municipalidad de Alta Gracia
                </span>
              </div>
              <p className="text-sm leading-relaxed text-gray-500">
                Informes de inversión y gestión municipal para el año 2026. Transparencia y
                compromiso con nuestra comunidad.
              </p>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Contacto</h3>
              <ul className="space-y-3 text-sm text-gray-500">
                <li className="flex items-center gap-2">
                  <span>📍</span>
                  <span>Padre Domingo Viera 160, Alta Gracia, Córdoba</span>
                </li>
                <li className="flex items-center gap-2">
                  <span>📞</span>
                  <span>(03547) 42-1455</span>
                </li>
                <li className="flex items-center gap-2">
                  <span>✉️</span>
                  <span>info@altagracia.gob.ar</span>
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Segmentos</h3>
              <ul className="grid grid-cols-2 gap-2 text-sm">
                {reports.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => {
                        setActiveSegment(r.id);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="text-gray-500 hover:text-gray-900 text-left"
                    >
                      {r.shortTitle}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-gray-200 pt-8 text-center text-sm text-gray-400">
            © {new Date().getFullYear()} Municipalidad de Alta Gracia. Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
