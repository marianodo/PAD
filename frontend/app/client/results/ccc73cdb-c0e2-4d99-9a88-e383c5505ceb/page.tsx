"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import dynamic from "next/dynamic";
import ChatBot from "@/components/ChatBot";

const GeographicHeatMap = dynamic(() => import("@/components/GeographicHeatMap"), {
  ssr: false,
  loading: () => (
    <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6 h-96 flex items-center justify-center">
      <p className="text-[#FFFFFF]/50">Cargando mapa...</p>
    </div>
  ),
});

// Coordenadas de localidades de Córdoba (~160 ciudades)
const LOCALIDAD_COORDS: Record<string, { lat: number; lng: number }> = {
  "Córdoba Capital": { lat: -31.4201, lng: -64.1888 },
  "Villa Allende": { lat: -31.2958, lng: -64.2953 },
  "Mendiolaza": { lat: -31.2800, lng: -64.3070 },
  "Unquillo": { lat: -31.2300, lng: -64.3170 },
  "Saldán": { lat: -31.3070, lng: -64.3090 },
  "La Calera": { lat: -31.3450, lng: -64.3360 },
  "Malagueño": { lat: -31.4640, lng: -64.3580 },
  "Mi Granja": { lat: -31.4100, lng: -64.2900 },
  "Juárez Celman": { lat: -31.4000, lng: -64.1300 },
  "Colonia Tirolesa": { lat: -31.2700, lng: -64.0900 },
  "Estación Juárez Celman": { lat: -31.4050, lng: -64.1200 },
  "Toledo": { lat: -31.5500, lng: -64.0100 },
  "Monte Cristo": { lat: -31.3430, lng: -63.9440 },
  "Malvinas Argentinas": { lat: -31.3840, lng: -64.0500 },
  "Alta Gracia": { lat: -31.6553, lng: -64.4330 },
  "Villa Carlos Paz": { lat: -31.4240, lng: -64.4980 },
  "Cosquín": { lat: -31.2440, lng: -64.4660 },
  "La Falda": { lat: -31.0900, lng: -64.4900 },
  "Jesús María": { lat: -30.9817, lng: -64.0944 },
  "Colonia Caroya": { lat: -30.9900, lng: -64.0930 },
  "Villa del Dique": { lat: -32.1700, lng: -64.4500 },
  "Santa Rosa de Calamuchita": { lat: -32.0670, lng: -64.5350 },
  "Embalse": { lat: -32.1820, lng: -64.4100 },
  "Almafuerte": { lat: -32.1950, lng: -64.2520 },
  "Villa General Belgrano": { lat: -31.9760, lng: -64.5640 },
  "Tanti": { lat: -31.3500, lng: -64.5900 },
  "Bialet Massé": { lat: -31.3200, lng: -64.4600 },
  "Huerta Grande": { lat: -31.0700, lng: -64.4900 },
  "Valle Hermoso": { lat: -31.1200, lng: -64.4800 },
  "La Cumbre": { lat: -31.0200, lng: -64.5000 },
  "Los Cocos": { lat: -30.9400, lng: -64.5200 },
  "Capilla del Monte": { lat: -30.8600, lng: -64.5300 },
  "San Marcos Sierras": { lat: -30.7700, lng: -64.6300 },
  "Mina Clavero": { lat: -31.7200, lng: -65.0000 },
  "Nono": { lat: -31.7950, lng: -65.0100 },
  "Villa Cura Brochero": { lat: -31.7100, lng: -65.0200 },
  "Villa Dolores": { lat: -31.9427, lng: -65.1869 },
  "San Javier": { lat: -32.0600, lng: -65.0500 },
  "Yacanto": { lat: -31.7300, lng: -65.0000 },
  "Los Reartes": { lat: -31.9200, lng: -64.5600 },
  "Villa Rumipal": { lat: -32.1900, lng: -64.4800 },
  "Río Ceballos": { lat: -31.1660, lng: -64.3240 },
  "Salsipuedes": { lat: -31.1400, lng: -64.3000 },
  "Agua de Oro": { lat: -31.0700, lng: -64.2960 },
  "La Granja": { lat: -31.0300, lng: -64.2700 },
  "Río Cuarto": { lat: -33.1307, lng: -64.3499 },
  "Villa María": { lat: -32.4074, lng: -63.2428 },
  "Río Tercero": { lat: -32.1726, lng: -64.1086 },
  "Oliva": { lat: -32.0465, lng: -63.5673 },
  "Oncativo": { lat: -31.9100, lng: -63.6800 },
  "Hernando": { lat: -32.4270, lng: -63.7320 },
  "Villa Nueva": { lat: -32.4350, lng: -63.2500 },
  "Bell Ville": { lat: -32.6263, lng: -62.6895 },
  "Leones": { lat: -32.6568, lng: -62.2969 },
  "Marcos Juárez": { lat: -32.6963, lng: -62.1058 },
  "Corral de Bustos": { lat: -33.2850, lng: -62.1880 },
  "Inriville": { lat: -33.0500, lng: -62.2300 },
  "Canals": { lat: -33.5620, lng: -62.8910 },
  "Laboulaye": { lat: -34.1270, lng: -63.3910 },
  "General Cabrera": { lat: -32.8200, lng: -63.8700 },
  "General Deheza": { lat: -32.7590, lng: -63.7900 },
  "Las Perdices": { lat: -32.6980, lng: -63.7090 },
  "Berrotarán": { lat: -32.4530, lng: -64.3870 },
  "Elena": { lat: -32.5100, lng: -63.4700 },
  "Morrison": { lat: -32.5900, lng: -63.7200 },
  "Adelia María": { lat: -33.6300, lng: -64.0200 },
  "Vicuña Mackenna": { lat: -33.9200, lng: -64.3900 },
  "Coronel Moldes": { lat: -33.6300, lng: -64.5900 },
  "Sampacho": { lat: -33.3800, lng: -64.7200 },
  "Alcira Gigena": { lat: -32.7600, lng: -64.4400 },
  "Huinca Renancó": { lat: -34.8400, lng: -64.3700 },
  "General Levalle": { lat: -34.0100, lng: -63.9200 },
  "Buchardo": { lat: -34.6800, lng: -63.5500 },
  "Italó": { lat: -34.7800, lng: -63.7800 },
  "Mattaldi": { lat: -34.4800, lng: -64.1800 },
  "Del Campillo": { lat: -34.3700, lng: -64.4800 },
  "San Francisco": { lat: -31.4281, lng: -62.0827 },
  "Morteros": { lat: -30.7108, lng: -62.0044 },
  "Brinkmann": { lat: -30.8700, lng: -62.0400 },
  "Porteña": { lat: -31.0100, lng: -62.0700 },
  "Freyre": { lat: -31.1700, lng: -62.1000 },
  "Devoto": { lat: -31.4000, lng: -62.3100 },
  "Arroyito": { lat: -31.4200, lng: -63.0500 },
  "El Tío": { lat: -31.3800, lng: -62.8300 },
  "Las Varillas": { lat: -31.8700, lng: -62.7200 },
  "San Marcos Sud": { lat: -32.6800, lng: -62.5000 },
  "Monte Maíz": { lat: -33.2040, lng: -62.6070 },
  "Justiniano Posse": { lat: -32.8800, lng: -62.6800 },
  "General Roca": { lat: -32.7300, lng: -61.9100 },
  "Noetinger": { lat: -32.3600, lng: -62.3100 },
  "Monte Buey": { lat: -32.9200, lng: -62.4600 },
  "Isla Verde": { lat: -33.2400, lng: -62.3900 },
  "Arias": { lat: -33.6400, lng: -62.4000 },
  "Camilo Aldao": { lat: -33.1300, lng: -62.1000 },
  "Wenceslao Escalante": { lat: -33.2100, lng: -62.1700 },
  "Pascanas": { lat: -33.1100, lng: -63.0400 },
  "Etruria": { lat: -32.9500, lng: -63.2500 },
  "Ausonia": { lat: -30.7900, lng: -62.0700 },
  "San José de la Dormida": { lat: -30.3500, lng: -63.9500 },
  "Deán Funes": { lat: -30.4237, lng: -64.3503 },
  "Cruz del Eje": { lat: -30.7260, lng: -64.8070 },
  "Quilino": { lat: -30.2100, lng: -64.4900 },
  "Villa de Soto": { lat: -30.8600, lng: -64.9900 },
  "Serrezuela": { lat: -30.6400, lng: -65.3800 },
  "San Carlos Minas": { lat: -31.1800, lng: -65.1100 },
  "Tulumba": { lat: -30.3900, lng: -64.1200 },
  "Santa Elena": { lat: -30.5200, lng: -64.3600 },
  "Ischilín": { lat: -30.5800, lng: -64.3400 },
  "Villa de María": { lat: -29.9000, lng: -63.7200 },
  "Sobremonte": { lat: -29.7500, lng: -64.0500 },
  "San Pedro Norte": { lat: -30.5700, lng: -64.2400 },
  "Sebastián Elcano": { lat: -30.1700, lng: -63.5900 },
  "Lucio V. Mansilla": { lat: -31.1400, lng: -63.6200 },
  "Villa de Pocho": { lat: -31.4800, lng: -65.2800 },
  "Chancaní": { lat: -31.4100, lng: -65.4500 },
  "Salsacate": { lat: -31.3200, lng: -65.0900 },
  "Taninga": { lat: -31.3400, lng: -65.0200 },
  "La Higuera": { lat: -31.2800, lng: -65.0600 },
  "Villa de las Rosas": { lat: -31.9500, lng: -65.0700 },
  "Las Tapias": { lat: -31.9100, lng: -65.1400 },
  "San Pedro": { lat: -31.8900, lng: -65.1500 },
  "La Paz": { lat: -31.8600, lng: -65.1500 },
  "Los Hornillos": { lat: -31.8800, lng: -65.0500 },
  "Las Calles": { lat: -31.8500, lng: -65.0700 },
  "Villa Huidobro": { lat: -34.8400, lng: -64.5800 },
  "Jovita": { lat: -34.0000, lng: -63.7700 },
  "General Baldissera": { lat: -33.1200, lng: -62.3100 },
  "Alejo Ledesma": { lat: -33.6100, lng: -62.6200 },
  "Ordóñez": { lat: -32.8400, lng: -62.8700 },
  "Los Surgentes": { lat: -33.0100, lng: -62.4000 },
  "Bengolea": { lat: -33.0300, lng: -63.6700 },
  "Pilar": { lat: -31.6800, lng: -63.8800 },
  "Calchín": { lat: -31.5700, lng: -63.2800 },
  "Villa del Rosario": { lat: -31.5600, lng: -63.5300 },
  "Villa del Totoral": { lat: -30.7500, lng: -64.0700 },
  "Sinsacate": { lat: -30.9400, lng: -64.1000 },
  "Obispo Trejo": { lat: -30.7800, lng: -63.4000 },
  "James Craik": { lat: -32.1600, lng: -63.4600 },
  "Tancacha": { lat: -32.2400, lng: -63.9800 },
  "Despeñaderos": { lat: -31.8100, lng: -64.2900 },
  "San Agustín": { lat: -31.9800, lng: -64.3700 },
  "Anisacate": { lat: -31.7200, lng: -64.4100 },
  "Los Cóndores": { lat: -32.3100, lng: -64.2700 },
  "Luque": { lat: -31.6400, lng: -63.3400 },
  "Sacanta": { lat: -31.6600, lng: -62.8800 },
  "Balnearia": { lat: -31.0200, lng: -62.6600 },
  "Marull": { lat: -30.9900, lng: -62.8300 },
  "La Para": { lat: -30.8900, lng: -63.0100 },
  "Villa Fontana": { lat: -31.4500, lng: -63.0300 },
  "Pampayasta": { lat: -32.2800, lng: -63.6700 },
  "Lozada": { lat: -31.6300, lng: -64.1100 },
  "Dalmacio Vélez Sársfield": { lat: -31.5300, lng: -63.3900 },
  "Saturnino María Laspiur": { lat: -31.7000, lng: -62.8800 },
  "Pozo del Molle": { lat: -32.0200, lng: -62.9200 },
  "Idiazábal": { lat: -32.0100, lng: -63.0300 },
  "General Fotheringham": { lat: -31.9800, lng: -62.8500 },
  "Carrilobo": { lat: -31.7300, lng: -63.1200 },
  "Arroyo Cabral": { lat: -32.4900, lng: -63.4000 },
  "Ticino": { lat: -32.6900, lng: -63.4300 },
  "Alejandro Roca": { lat: -33.3500, lng: -63.7200 },
  "Ucacha": { lat: -33.0300, lng: -63.5000 },
  "Reducción": { lat: -32.4100, lng: -64.3900 },
  "Los Cisnes": { lat: -32.5200, lng: -64.3000 },
  "Serrano": { lat: -33.5400, lng: -64.4600 },
  "Bulnes": { lat: -33.3700, lng: -64.1500 },
  "Washington": { lat: -31.2000, lng: -62.1100 },
  "La Puerta": { lat: -31.0600, lng: -64.4700 },
  "Charbonier": { lat: -31.1100, lng: -64.4500 },
  "San Esteban": { lat: -31.5800, lng: -64.5300 },
};

// Población estimada por localidad (Censo 2022 aproximado)
const POBLACION_LOCALIDADES: Record<string, number> = {
  "Córdoba Capital": 1535000, "Río Cuarto": 170000, "Villa María": 100000,
  "San Francisco": 82000, "Alta Gracia": 55000, "Villa Carlos Paz": 75000,
  "Villa Allende": 35000, "La Calera": 32000, "Río Tercero": 50000,
  "Jesús María": 35000, "Cosquín": 25000, "La Falda": 20000,
  "Marcos Juárez": 30000, "Bell Ville": 35000, "Deán Funes": 25000,
  "Villa Dolores": 30000, "Cruz del Eje": 32000, "Laboulaye": 22000,
  "Unquillo": 20000, "Río Ceballos": 20000, "Malvinas Argentinas": 14000,
  "Colonia Caroya": 20000, "Mendiolaza": 15000, "Saldán": 12000,
  "Malagueño": 15000, "Monte Cristo": 10000, "Toledo": 8000,
  "Colonia Tirolesa": 6000, "Mi Granja": 5000, "Juárez Celman": 5000,
  "Estación Juárez Celman": 5000, "Salsipuedes": 12000,
  "Santa Rosa de Calamuchita": 15000, "Embalse": 10000,
  "Villa General Belgrano": 12000, "Almafuerte": 12000,
  "Villa del Dique": 8000, "Tanti": 8000, "Bialet Massé": 8000,
  "Huerta Grande": 6000, "Valle Hermoso": 6000, "La Cumbre": 8000,
  "Los Cocos": 4000, "Capilla del Monte": 12000, "La Granja": 5000,
  "San Marcos Sierras": 3000, "Agua de Oro": 5000, "Sinsacate": 5000,
  "Villa del Totoral": 8000, "Arroyito": 20000, "Las Varillas": 18000,
  "Oliva": 15000, "Oncativo": 14000, "Hernando": 10000,
  "Villa Nueva": 15000, "Leones": 12000, "Morteros": 18000,
  "Brinkmann": 8000, "Porteña": 5000, "Freyre": 6000,
  "Devoto": 7000, "El Tío": 4000, "San Pedro": 3000,
  "Balnearia": 5000, "Mina Clavero": 12000, "Villa Cura Brochero": 6000,
  "Nono": 3000, "Las Calles": 2000, "Los Hornillos": 2000,
  "San Javier": 4000, "Villa de las Rosas": 5000, "Las Tapias": 4000,
  "Sampacho": 8000, "Coronel Moldes": 8000, "Adelia María": 7000,
  "Vicuña Mackenna": 12000, "General Cabrera": 12000, "General Deheza": 10000,
  "Huinca Renancó": 9000, "Canals": 10000, "Arias": 8000,
  "Corral de Bustos": 8000, "Inriville": 4000, "Isla Verde": 5000,
  "Monte Buey": 6000, "Justiniano Posse": 8000, "Camilo Aldao": 5000,
  "Monte Maíz": 8000, "Noetinger": 5000,
  "Morrison": 3000, "Villa del Rosario": 15000, "Pilar": 15000,
  "Río Segundo": 20000, "Despeñaderos": 8000, "Anisacate": 6000,
  "Villa Huidobro": 5000, "Del Campillo": 4000, "Serrezuela": 2000,
  "Tulumba": 3000, "Chancaní": 2000, "Villa de Pocho": 2000,
  "Salsacate": 3000, "Sobremonte": 2000, "James Craik": 8000,
  "General Levalle": 5000, "General Roca": 4000, "Jovita": 4000,
  "Buchardo": 3000, "Mattaldi": 2000, "Serrano": 4000,
  "Alejandro Roca": 3000, "Alcira Gigena": 7000, "Berrotarán": 6000,
  "Elena": 2000, "Los Cóndores": 4000, "Reducción": 4000,
  "San Agustín": 4000, "Los Reartes": 3000, "Villa Rumipal": 4000,
  "Villa de María": 3000, "San José de la Dormida": 3000,
  "Quilino": 5000, "Sebastián Elcano": 3000, "San Pedro Norte": 2000,
  "Obispo Trejo": 4000, "Sacanta": 4000, "Calchín": 5000,
  "La Para": 4000, "La Paz": 4000, "Alejo Ledesma": 3000,
  "San Marcos Sud": 3000, "Pozo del Molle": 5000, "Tancacha": 4000,
  "Lozada": 3000, "Washington": 2000, "La Puerta": 3000,
  "Ucacha": 5000, "Bengolea": 2000, "Etruria": 4000,
  "Ausonia": 2000, "Carrilobo": 3000, "Arroyo Cabral": 4000,
  "Pascanas": 4000, "Los Surgentes": 3000, "Ticino": 3000,
  "Dalmacio Vélez Sársfield": 3000, "Villa Fontana": 2000,
  "Idiazábal": 3000, "Luque": 5000, "Lucio V. Mansilla": 2000,
  "Saturnino María Laspiur": 2000, "Pampayasta": 2000,
  "Ordóñez": 4000, "Las Perdices": 5000, "General Baldissera": 2000,
  "General Fotheringham": 2000, "Los Cisnes": 2000,
  "Wenceslao Escalante": 2000, "Italó": 2000, "Charbonier": 2000,
  "San Esteban": 3000, "San Carlos Minas": 2000, "Ischilín": 2000,
  "Taninga": 2000, "La Higuera": 2000, "Santa Elena": 2000,
  "Yacanto": 2000, "Marull": 3000, "Villa de Soto": 4000,
};

const SURVEY_ID = "ccc73cdb-c0e2-4d99-9a88-e383c5505ceb";

interface Demographics {
  by_age_group: Record<string, number>;
  by_age_group_by_gender: Record<string, Record<string, number>>;
  by_city: Record<string, number>;
  by_neighborhood: Record<string, number>;
  by_gender: Record<string, number>;
}

interface SingleChoiceResult {
  label: string;
  votes: number;
  percentage: number;
}

interface RatingResult {
  average: number;
  total_ratings: number;
  distribution?: Record<string, number>;
}

interface QuestionSummary {
  question_id: string;
  question_text: string;
  question_type: string;
  total_answers: number;
  results: Record<string, any>;
  results_by_age: Record<string, Record<string, any>>;
  results_by_gender: Record<string, Record<string, any>>;
  results_by_age_and_gender: Record<string, Record<string, any>>;
  results_by_neighborhood: Record<string, Record<string, any>>;
  results_by_city: Record<string, Record<string, any>>;
}

interface SurveyResults {
  survey_id: string;
  total_responses: number;
  monthly_responses: number;
  total_change?: number;
  monthly_change?: number;
  demographics: Demographics;
  questions_summary: QuestionSummary[];
  evolution_data: any;
}

const PIE_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16",
];

export default function CordobaDashboard() {
  const router = useRouter();

  const [results, setResults] = useState<SurveyResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"datos" | "ai-insights" | "reportes">("datos");
  const [segmentsData, setSegmentsData] = useState<any>(null);
  const [loadingSegments, setLoadingSegments] = useState(false);
  const [exportingXLSX, setExportingXLSX] = useState(false);
  const [segmentThreshold, setSegmentThreshold] = useState(20);
  const [expandedSegments, setExpandedSegments] = useState<Record<string, boolean>>({});
  const [aiInsights, setAiInsights] = useState<any[] | null>(null);
  const [aiPredictions, setAiPredictions] = useState<any[] | null>(null);
  const [loadingAiInsights, setLoadingAiInsights] = useState(false);
  const [aiInsightsError, setAiInsightsError] = useState("");
  const [ageDistGenderFilter, setAgeDistGenderFilter] = useState("Todos");
  const [multipleChoiceFilter, setMultipleChoiceFilter] = useState("General");
  const [multipleChoiceGenderFilter, setMultipleChoiceGenderFilter] = useState("Todos");
  const [singleChoiceAgeFilter, setSingleChoiceAgeFilter] = useState("General");
  const [singleChoiceGenderFilter, setSingleChoiceGenderFilter] = useState("Todos");
  const [ratingAgeFilter, setRatingAgeFilter] = useState("General");
  const [ratingGenderFilter, setRatingGenderFilter] = useState("Todos");
  // Evolution charts state
  const [budgetEvolutionAgeFilter, setBudgetEvolutionAgeFilter] = useState("General");
  const [budgetEvolutionGenderFilter, setBudgetEvolutionGenderFilter] = useState("Todos");
  const [ratingEvolutionAgeFilter, setRatingEvolutionAgeFilter] = useState("General");
  const [ratingEvolutionGenderFilter, setRatingEvolutionGenderFilter] = useState("Todos");
  const [hiddenBudgetCategories, setHiddenBudgetCategories] = useState<Set<string>>(new Set());
  const [hoveredRatingPoint, setHoveredRatingPoint] = useState<{ index: number; value: number; month: string } | null>(null);
  const [crossAnalysisTab, setCrossAnalysisTab] = useState<"city" | "age" | "gender">("city");

  const ageFilterOptions = ["General", "18-30", "31-45", "46-60", "60+"];

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchResults = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/surveys/${SURVEY_ID}/results`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!response.ok) throw new Error("Error al obtener los resultados");
        const data = await response.json();
        setResults(data);
        setLoading(false);
        return;
      } catch (err: any) {
        if (attempt === maxAttempts) {
          setError(err.message);
          setLoading(false);
        } else {
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }
    }
  };

  const loadCachedInsights = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/surveys/${SURVEY_ID}/ai-insights`,
        { method: "GET", headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.ok) {
        const data = await response.json();
        if (data.insights) setAiInsights(data.insights);
        if (data.predictions) setAiPredictions(data.predictions);
      }
    } catch { }
  };

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.push("/auth/admin-login"); return; }
    fetchResults();
    loadCachedInsights();
  }, []);

  const SURVEY_ID = "ccc73cdb-c0e2-4d99-9a88-e383c5505ceb";

  const fetchSegments = async (threshold: number) => {
    try {
      setLoadingSegments(true);
      const token = localStorage.getItem("access_token");
      if (!token) return;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/surveys/${SURVEY_ID}/segments?threshold=${threshold}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) setSegmentsData(await res.json());
    } catch (err) {
      console.error("Error fetching segments:", err);
    } finally {
      setLoadingSegments(false);
    }
  };

  useEffect(() => {
    if (activeTab === "reportes" && !segmentsData) fetchSegments(segmentThreshold);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "reportes") {
      const timer = setTimeout(() => fetchSegments(segmentThreshold), 400);
      return () => clearTimeout(timer);
    }
  }, [segmentThreshold]);

  const handleExportXLSX = async () => {
    try {
      setExportingXLSX(true);
      const token = localStorage.getItem("access_token");
      if (!token) return;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/surveys/${SURVEY_ID}/segments/export?threshold=${segmentThreshold}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `segmentos-cordoba.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Error exporting XLSX:", err);
    } finally {
      setExportingXLSX(false);
    }
  };

  const generateAIInsights = async () => {
    setLoadingAiInsights(true);
    setAiInsightsError("");
    try {
      const token = localStorage.getItem("access_token");
      const [insightsRes, predictionsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/surveys/${SURVEY_ID}/ai-insights`, {
          method: "POST", headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/surveys/${SURVEY_ID}/ai-predictions`, {
          method: "POST", headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (!insightsRes.ok) {
        const e = await insightsRes.json();
        throw new Error(e.detail || "Error al generar insights");
      }
      const insightsData = await insightsRes.json();
      setAiInsights(insightsData.insights);
      if (predictionsRes.ok) {
        const predictionsData = await predictionsRes.json();
        setAiPredictions(predictionsData.predictions);
      }
    } catch (err: any) {
      setAiInsightsError(err.message || "Error al generar insights con IA");
    } finally {
      setLoadingAiInsights(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getFilteredData = (q: QuestionSummary, ageFilter: string, genderFilter: string) => {
    if (ageFilter !== "General" && genderFilter !== "Todos") {
      const key = `${ageFilter}|${genderFilter.toLowerCase()}`;
      return q.results_by_age_and_gender?.[key] || {};
    }
    if (genderFilter !== "Todos") {
      return q.results_by_gender?.[genderFilter.toLowerCase()] || {};
    }
    if (ageFilter !== "General") {
      return q.results_by_age?.[ageFilter] || {};
    }
    return q.results;
  };

  // ── Renders ────────────────────────────────────────────────────────────────

  const renderBudgetPieChart = (q: QuestionSummary) => {
    const data = getFilteredData(q, multipleChoiceFilter, multipleChoiceGenderFilter) as Record<string, { label: string; percentage: number }>;
    const entries = Object.entries(data).sort((a, b) => b[1].percentage - a[1].percentage);
    if (!entries.length) return <p className="text-[#FFFFFF]/50 text-sm">Sin datos aún.</p>;

    const total = entries.reduce((sum, [, val]) => sum + val.percentage, 0);
    let cumulative = 0;
    const segments = entries.map(([key, val], index) => {
      const pct = val.percentage;
      const startAngle = (cumulative / total) * 360;
      cumulative += pct;
      const endAngle = (cumulative / total) * 360;
      return { key, label: val.label, percentage: pct, color: PIE_COLORS[index % PIE_COLORS.length], startAngle, endAngle };
    });

    const size = 240;
    const center = size / 2;
    const radius = 100;
    const labelRadius = radius * 0.68;
    const polarToCartesian = (angle: number, r: number = radius) => {
      const rad = ((angle - 90) * Math.PI) / 180;
      return { x: center + r * Math.cos(rad), y: center + r * Math.sin(rad) };
    };

    return (
      <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-[#FFFFFF]">{q.question_text}</h3>
          <p className="text-sm text-[#FFFFFF]/50 mt-1">{q.total_answers} respuestas · distribución de presupuesto</p>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex gap-0 bg-[#000000] rounded-lg p-1">
            {ageFilterOptions.map(opt => (
              <button key={opt} onClick={() => setMultipleChoiceFilter(opt)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap ${multipleChoiceFilter === opt ? "bg-[#2962FF] text-white" : "text-[#FFFFFF]/60 hover:text-white"}`}>
                {opt}
              </button>
            ))}
          </div>
          <div className="flex gap-0 bg-[#000000] rounded-lg p-1">
            {["Todos", "Masculino", "Femenino"].map(opt => (
              <button key={opt} onClick={() => setMultipleChoiceGenderFilter(opt)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap ${multipleChoiceGenderFilter === opt ? "bg-[#2962FF] text-white" : "text-[#FFFFFF]/60 hover:text-white"}`}>
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Pie + Legend */}
        <div className="flex flex-col items-center gap-4">
          {/* SVG Pie with labels inside */}
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {segments.map((seg, i) => {
              if (seg.endAngle - seg.startAngle >= 360) {
                return <circle key={`c-${i}`} cx={center} cy={center} r={radius} fill={seg.color} />;
              }
              const start = polarToCartesian(seg.startAngle);
              const end = polarToCartesian(seg.endAngle);
              const largeArc = seg.endAngle - seg.startAngle > 180 ? 1 : 0;
              const d = `M ${center} ${center} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
              const midAngle = (seg.startAngle + seg.endAngle) / 2;
              const lp = polarToCartesian(midAngle, labelRadius);
              return (
                <g key={i}>
                  <path d={d} fill={seg.color} />
                  {seg.percentage >= 5 && (
                    <text
                      x={lp.x}
                      y={lp.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      fontSize="10"
                      fontWeight="bold"
                    >
                      {seg.percentage.toFixed(1)}%
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Legend — no percentage, just color + label */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 w-full">
            {segments.map((seg, i) => (
              <div key={i} className="flex items-center gap-2 min-w-0">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                <span className="text-xs text-[#FFFFFF]/70 truncate">{seg.label}</span>
              </div>
            ))}
          </div>
        </div>

        {segments.length > 0 && (
          <div className="mt-4 p-3 bg-[#2962FF]/10 border border-[#2962FF]/20 rounded-xl">
            <p className="text-xs text-[#FFFFFF]/80">
              Prioridad #1: <span className="font-bold text-white">{segments[0].label}</span>{" "}
              con <span className="text-[#2962FF] font-bold">{segments[0].percentage.toFixed(1)}%</span>
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderSingleChoice = (q: QuestionSummary) => {
    const data = getFilteredData(q, singleChoiceAgeFilter, singleChoiceGenderFilter) as Record<string, SingleChoiceResult>;
    const entries = Object.entries(data);
    if (!entries.length) return <p className="text-[#FFFFFF]/50 text-sm">Sin datos aún.</p>;
    const total = entries.reduce((sum, [, v]) => sum + v.votes, 0);

    return (
      <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6">
        <h3 className="text-lg font-bold text-[#FFFFFF] mb-1">{q.question_text}</h3>
        <p className="text-sm text-[#FFFFFF]/50 mb-4">{total} respuestas</p>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex gap-0 bg-[#000000] rounded-lg p-1">
            {ageFilterOptions.map(opt => (
              <button key={opt} onClick={() => setSingleChoiceAgeFilter(opt)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap ${singleChoiceAgeFilter === opt ? "bg-[#2962FF] text-white" : "text-[#FFFFFF]/60 hover:text-white"}`}>
                {opt}
              </button>
            ))}
          </div>
          <div className="flex gap-0 bg-[#000000] rounded-lg p-1">
            {["Todos", "Masculino", "Femenino"].map(opt => (
              <button key={opt} onClick={() => setSingleChoiceGenderFilter(opt)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap ${singleChoiceGenderFilter === opt ? "bg-[#2962FF] text-white" : "text-[#FFFFFF]/60 hover:text-white"}`}>
                {opt}
              </button>
            ))}
          </div>
        </div>

        {(() => {
          const sorted = [...entries].sort((a, b) => {
            const aYes = a[1].label?.toLowerCase() === "sí" || a[1].label?.toLowerCase() === "si";
            const bYes = b[1].label?.toLowerCase() === "sí" || b[1].label?.toLowerCase() === "si";
            return aYes === bYes ? 0 : aYes ? -1 : 1;
          });
          const yesEntry = sorted[0]?.[1];
          const noEntry = sorted[1]?.[1];
          return (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sorted.map(([key, val]) => {
                  const isYes = val.label?.toLowerCase() === "sí" || val.label?.toLowerCase() === "si";
                  const color = isYes ? "#00C853" : "#D50000";
                  return (
                    <div key={key} className="flex flex-col items-center justify-center p-6 rounded-2xl border-2"
                      style={{ borderColor: color, backgroundColor: `${color}15` }}>
                      <span className="text-4xl font-bold mb-2" style={{ color }}>{val.percentage.toFixed(1)}%</span>
                      <span className="text-lg font-semibold text-[#FFFFFF]">{val.label}</span>
                      <span className="text-sm text-[#FFFFFF]/50 mt-1">{val.votes} votos</span>
                    </div>
                  );
                })}
              </div>

              {yesEntry && noEntry && (
                <div className="mt-4 p-3 bg-[#1a1a2e] border border-white/10 rounded-xl">
                  <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                    <div className="h-3 rounded-full transition-all duration-700"
                      style={{ width: `${yesEntry.percentage}%`, backgroundColor: "#00C853" }} />
                  </div>
                  <div className="flex justify-between text-xs text-[#FFFFFF]/50 mt-1">
                    <span>{yesEntry.label} {yesEntry.percentage.toFixed(1)}%</span>
                    <span>{noEntry.label} {noEntry.percentage.toFixed(1)}%</span>
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>
    );
  };

  const renderRating = (q: QuestionSummary) => {
    const r = getFilteredData(q, ratingAgeFilter, ratingGenderFilter) as unknown as RatingResult;
    if (!r?.average) return <p className="text-[#FFFFFF]/50 text-sm">Sin datos aún.</p>;
    const dist = r.distribution || {};
    const maxDist = Math.max(...Object.values(dist));
    const goodRatings = ((dist["4"] || 0) + (dist["5"] || 0)) / (r.total_ratings || 1) * 100;
    const ratingColors = ["#D50000", "#FF6D00", "#FFD600", "#00C853", "#2962FF"];

    return (
      <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6 mb-6">
        <h3 className="text-lg font-bold text-[#FFFFFF] mb-1">{q.question_text}</h3>
        <p className="text-sm text-[#FFFFFF]/50 mb-4">{r.total_ratings} calificaciones</p>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex gap-0 bg-[#000000] rounded-lg p-1">
            {ageFilterOptions.map(opt => (
              <button key={opt} onClick={() => setRatingAgeFilter(opt)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap ${ratingAgeFilter === opt ? "bg-[#2962FF] text-white" : "text-[#FFFFFF]/60 hover:text-white"}`}>
                {opt}
              </button>
            ))}
          </div>
          <div className="flex gap-0 bg-[#000000] rounded-lg p-1">
            {["Todos", "Masculino", "Femenino"].map(opt => (
              <button key={opt} onClick={() => setRatingGenderFilter(opt)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap ${ratingGenderFilter === opt ? "bg-[#2962FF] text-white" : "text-[#FFFFFF]/60 hover:text-white"}`}>
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Promedio */}
          <div className="flex flex-col items-center justify-center min-w-[140px]">
            <span className="text-6xl font-bold text-[#FFFFFF]">{r.average.toFixed(1)}</span>
            <span className="text-[#FFFFFF]/50 text-sm mt-1">sobre 5</span>
            <div className="flex gap-1 mt-3">
              {[1, 2, 3, 4, 5].map(s => (
                <span key={s} className="text-2xl" style={{ color: s <= Math.round(r.average) ? "#FFD600" : "#FFFFFF20" }}>★</span>
              ))}
            </div>
            <div className="mt-4 text-center">
              <span className="text-2xl font-bold text-[#00C853]">{goodRatings.toFixed(0)}%</span>
              <p className="text-xs text-[#FFFFFF]/50">calificaciones positivas (4-5★)</p>
            </div>
          </div>

          {/* Distribución */}
          <div className="flex-1 space-y-2">
            {[5, 4, 3, 2, 1].map(star => {
              const count = dist[String(star)] || 0;
              const pct = maxDist > 0 ? (count / maxDist) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-3">
                  <span className="text-sm text-[#FFFFFF]/70 w-6 text-right">{star}★</span>
                  <div className="flex-1 bg-white/10 rounded-full h-3">
                    <div className="h-3 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: ratingColors[star - 1] }} />
                  </div>
                  <span className="text-xs text-[#FFFFFF]/50 w-8">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderAgeDistribution = () => {
    if (!results) return null;
    const ageData = results.demographics.by_age_group_by_gender;
    const genderData = results.demographics.by_age_group;
    let data: Record<string, number>;
    if (ageDistGenderFilter === "Todos") {
      data = genderData;
    } else {
      // ageData structure: { "masculino": {"18-30": 100, ...}, "femenino": {...} }
      const key = ageDistGenderFilter.toLowerCase();
      data = (ageData[key] || ageData[ageDistGenderFilter] || {}) as Record<string, number>;
    }

    const entries = Object.entries(data).filter(([k]) => k !== "Sin especificar");
    if (!entries.length) return null;
    const total = entries.reduce((s, [, v]) => s + v, 0);
    const sorted = entries.sort((a, b) => b[1] - a[1]);
    const max = sorted[0][1];

    const barColors = ["#FF6B9D", "#A855F7", "#3B82F6", "#22C55E", "#F59E0B"];

    return (
      <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-[#FFFFFF]">Desglose por Edad</h3>
            <p className="text-sm text-[#FFFFFF]/50">Participación por grupo etario</p>
          </div>
          <div className="flex gap-0 bg-[#000000] rounded-lg p-1">
            {["Todos", "Masculino", "Femenino"].map(opt => (
              <button key={opt} onClick={() => setAgeDistGenderFilter(opt)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${ageDistGenderFilter === opt ? "bg-[#2962FF] text-white" : "text-[#FFFFFF]/60 hover:text-white"}`}>
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {sorted.map(([age, count], i) => {
            const pct = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={age}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[#FFFFFF]/80">{age}</span>
                  <span className="text-[#FFFFFF]/50">{count}</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-6 relative">
                  <div className="h-6 rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                    style={{ width: `${max > 0 ? (count / max) * 100 : 0}%`, backgroundColor: barColors[i % barColors.length] }}>
                    <span className="text-white text-xs font-semibold">{pct.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-[#FFFFFF]/40 mt-3">
          El grupo etario <strong className="text-white">{sorted[0]?.[0]}</strong> representa la mayor participación con{" "}
          <strong className="text-white">{total > 0 ? ((sorted[0]?.[1] / total) * 100).toFixed(1) : 0}%</strong>
        </p>
      </div>
    );
  };

  const renderGenderDistribution = () => {
    if (!results) return null;
    const data = results.demographics.by_gender;
    const entries = Object.entries(data).filter(([k]) => k !== "Sin especificar");
    if (!entries.length) return null;
    const total = entries.reduce((s, [, v]) => s + v, 0);

    const genderColors: Record<string, string> = {
      Masculino: "#3B82F6", Femenino: "#EC4899", "No binario": "#A855F7", Otro: "#F59E0B",
    };

    return (
      <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6 mb-6">
        <h3 className="text-xl font-bold text-[#FFFFFF] mb-4">Distribución por Género</h3>
        <div className="flex gap-4 flex-wrap">
          {entries.map(([gender, count]) => {
            const pct = total > 0 ? (count / total) * 100 : 0;
            const color = genderColors[gender] || "#6B7280";
            return (
              <div key={gender} className="flex-1 min-w-[120px] p-4 rounded-xl border"
                style={{ borderColor: color, backgroundColor: `${color}15` }}>
                <p className="text-2xl font-bold" style={{ color }}>{pct.toFixed(1)}%</p>
                <p className="text-sm text-[#FFFFFF]/70 mt-1">{gender}</p>
                <p className="text-xs text-[#FFFFFF]/40">{count} respuestas</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── AI Insights Section ────────────────────────────────────────────────────

  const renderInsightsSection = () => {
    if (!aiInsights?.length) return null;

    const categoryIcons: Record<string, JSX.Element> = {
      participation: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
      satisfaction: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      demographics: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
      infrastructure: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
      consensus: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    };

    return (
      <div className="space-y-4">
        {aiInsights.map((insight: any, i: number) => (
          <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="text-[#2962FF]">
                  {categoryIcons[insight.category] || categoryIcons["consensus"]}
                </div>
                <h4 className="font-semibold text-[#FFFFFF]">{insight.title}</h4>
              </div>
              {insight.impact && (
                <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${
                  insight.impact === "Alta"
                    ? "bg-red-500/20 text-red-400"
                    : insight.impact === "Media"
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-[#000000] text-[#FFFFFF]/80"
                }`}>
                  Impacto: {insight.impact}
                </span>
              )}
            </div>

            <p className="text-sm text-[#FFFFFF]/80 mb-3 ml-8">{insight.description}</p>

            {insight.recommendation && (
              <div className="ml-8 bg-white/5 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-xs font-medium text-amber-400">Recomendación</p>
                    <p className="text-sm text-[#FFFFFF]/80">{insight.recommendation}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderPredictionsSection = () => {
    if (!results) return null;
    const predictions = aiPredictions || [
      { icon: "👥", title: "Participación Proyectada", description: "Basado en tendencia actual, se esperan más respuestas en los próximos meses.", confidence: 80 },
      { icon: "📊", title: "Preferencias Estables", description: "Las preferencias ciudadanas muestran consistencia con el tiempo.", confidence: 75 },
      { icon: "⭐", title: "Calificación en Tendencia", description: "La calificación de gestión muestra una tendencia sostenida.", confidence: 70 },
    ];

    return (
      <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6 mb-8">
        <div className="flex items-center gap-2 mb-6">
          <svg className="w-6 h-6 text-[#2962FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <h2 className="text-2xl font-bold text-[#FFFFFF]">Predicciones y Proyecciones</h2>
        </div>

        <div className="space-y-4">
          {predictions.map((p: any, i: number) => (
            <div key={i} className="bg-[#000000] rounded-xl p-4 border border-white/5">
              <div className="flex gap-4">
                <div className="text-3xl shrink-0">{p.icon}</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-[#FFFFFF] mb-1">{p.title}</h3>
                  <p className="text-sm text-[#FFFFFF]/70 mb-3">{p.description}</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-white/10 rounded-full h-2">
                      <div className="bg-[#2962FF] h-2 rounded-full" style={{ width: `${p.confidence}%` }} />
                    </div>
                    <span className="text-sm font-medium text-[#FFFFFF]/80 min-w-[7rem] text-right">
                      Confianza: {p.confidence}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-4 text-xs text-[#FFFFFF]/50 pt-4 border-t border-white/10">
          <span className="bg-[#2962FF]/20 text-[#5E8AFF] px-3 py-1 rounded-full font-medium">
            {aiPredictions ? "Generado con Claude AI" : "Análisis Predictivo"}
          </span>
          <span>Basado en: {results.total_responses.toLocaleString()} respuestas</span>
        </div>
      </div>
    );
  };

  // ── Loading / Error ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#000000]">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-[#2962FF] border-r-transparent" />
          <p className="mt-4 text-[#FFFFFF]/70">Cargando resultados...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#000000]">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-[#FFFFFF] font-semibold text-lg mb-2">No se pudo cargar la información</p>
          <p className="text-[#FFFFFF]/50 text-sm mb-6">Hubo un problema al conectarse con el servidor. Por favor intentá de nuevo.</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { setError(""); setLoading(true); fetchResults(); }}
              className="px-4 py-2 bg-[#2962FF] text-white rounded-lg text-sm font-medium"
            >
              Reintentar
            </button>
            <button
              onClick={() => router.push("/client")}
              className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-medium"
            >
              Volver
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!results) return null;

  // ── Shared filter renderer ─────────────────────────────────────────────────
  const renderCombinedFilters = (
    ageFilter: string, setAgeFilter: (v: string) => void,
    genderFilter: string, setGenderFilter: (v: string) => void
  ) => (
    <div className="flex flex-nowrap gap-2 mb-4 overflow-x-auto">
      <div className="flex gap-1 bg-[#000000]/40 rounded-lg p-1 shrink-0">
        {["General", "18-30", "31-45", "46-60", "60+"].map(opt => (
          <button key={opt} onClick={() => setAgeFilter(opt)}
            className={`px-2 py-1 text-xs rounded-md transition-colors whitespace-nowrap ${ageFilter === opt ? "bg-[#2962FF] text-white" : "text-[#FFFFFF]/50 hover:text-white"}`}>
            {opt}
          </button>
        ))}
      </div>
      <div className="flex gap-1 bg-[#000000]/40 rounded-lg p-1 shrink-0">
        {["Todos", "Masculino", "Femenino"].map(opt => (
          <button key={opt} onClick={() => setGenderFilter(opt)}
            className={`px-2 py-1 text-xs rounded-md transition-colors whitespace-nowrap ${genderFilter === opt ? "bg-[#2962FF] text-white" : "text-[#FFFFFF]/50 hover:text-white"}`}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );

  // ── Evolución de Preferencias (percentage_distribution) ────────────────────
  const renderBudgetEvolutionChart = () => {
    const evolutionData = results?.evolution_data;
    if (!evolutionData || !evolutionData.percentage_distribution?.categories) {
      return (
        <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6">
          <h3 className="text-xl font-bold text-[#FFFFFF]">Evolución de Preferencias</h3>
          <p className="text-sm text-[#FFFFFF]/50">Tendencias mensuales de asignación ciudadana</p>
          <div className="text-center text-[#FFFFFF]/50 py-12">No hay datos históricos disponibles</div>
        </div>
      );
    }

    const months = evolutionData.months;
    let rawCategories;
    if (budgetEvolutionAgeFilter !== "General" && budgetEvolutionGenderFilter !== "Todos") {
      const key = `${budgetEvolutionAgeFilter}|${budgetEvolutionGenderFilter.toLowerCase()}`;
      rawCategories = evolutionData.by_age_and_gender?.[key]?.percentage_distribution?.categories || [];
    } else if (budgetEvolutionGenderFilter !== "Todos") {
      rawCategories = evolutionData.by_gender?.[budgetEvolutionGenderFilter.toLowerCase()]?.percentage_distribution?.categories || [];
    } else if (budgetEvolutionAgeFilter !== "General") {
      rawCategories = evolutionData.by_age?.[budgetEvolutionAgeFilter]?.percentage_distribution?.categories || [];
    } else {
      rawCategories = evolutionData.percentage_distribution.categories;
    }

    const categoryColors = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#EC4899", "#06B6D4"];
    const categories = rawCategories.map((cat: any, index: number) => ({ ...cat, color: categoryColors[index % categoryColors.length] }));
    const hasData = months.length > 0 && categories.length > 0;

    const padding = { top: 20, right: 30, bottom: 40, left: 55 };
    const chartWidth = padding.left + padding.right + (months.length - 1) * 180 + 20;
    const chartHeight = 320;
    const graphWidth = chartWidth - padding.left - padding.right;
    const graphHeight = chartHeight - padding.top - padding.bottom;
    const allValues = categories.flatMap((c: any) => c.data as number[]);
    const maxValue = Math.max(50, Math.ceil(Math.max(...allValues, 1) / 10) * 10);
    const xStep = months.length > 1 ? graphWidth / (months.length - 1) : graphWidth;
    const yScale = (v: number) => graphHeight - ((v / maxValue) * graphHeight);
    const generatePath = (data: number[]) =>
      data.map((v, i) => `${i === 0 ? "M" : "L"} ${padding.left + i * xStep} ${padding.top + yScale(v)}`).join(" ");

    const firstCat = categories.find((c: any) => c.data.some((v: number) => v > 0));
    const trendData: number[] = firstCat?.data || [];
    const startVal = trendData[0] || 0;
    const endVal = trendData[trendData.length - 1] || 0;
    const trendDir = endVal > startVal ? "aumentó" : endVal < startVal ? "disminuyó" : "se mantuvo";

    return (
      <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6">
        <div className="mb-4">
          <h3 className="text-xl font-bold text-[#FFFFFF]">Evolución de Preferencias</h3>
          <p className="text-sm text-[#FFFFFF]/50">Tendencias mensuales de asignación ciudadana</p>
        </div>
        {renderCombinedFilters(budgetEvolutionAgeFilter, setBudgetEvolutionAgeFilter, budgetEvolutionGenderFilter, setBudgetEvolutionGenderFilter)}
        {!hasData ? (
          <div className="text-center text-[#FFFFFF]/50 py-12">No hay datos para este filtro</div>
        ) : (
          <>
            <div className="flex gap-6">
              {/* Chart */}
              <div className="flex-1 min-w-0">
                <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
                  {Array.from({ length: 5 }, (_, i) => Math.round((maxValue / 4) * i)).map(v => (
                    <g key={v}>
                      <line x1={padding.left} y1={padding.top + yScale(v)} x2={chartWidth - padding.right} y2={padding.top + yScale(v)} stroke="#E5E7EB" strokeDasharray="4,4" />
                      <text x={padding.left - 10} y={padding.top + yScale(v) + 4} textAnchor="end" className="text-xs fill-gray-500">{v}%</text>
                    </g>
                  ))}
                  {months.map((month: string, i: number) => (
                    <text key={month} x={padding.left + i * xStep} y={chartHeight - 10} textAnchor="middle" className="text-xs fill-gray-500">{month}</text>
                  ))}
                  {categories.filter((c: any) => !hiddenBudgetCategories.has(c.name)).map((cat: any) => (
                    <g key={cat.name}>
                      <path d={generatePath(cat.data)} fill="none" stroke={cat.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                      {cat.data.map((v: number, i: number) => (
                        <circle key={i} cx={padding.left + i * xStep} cy={padding.top + yScale(v)} r={4} fill={cat.color} stroke="white" strokeWidth={2} />
                      ))}
                    </g>
                  ))}
                </svg>
              </div>
              {/* Legend — right side */}
              <div className="flex flex-col gap-1 justify-center min-w-[220px] max-w-[260px]">
                {categories.map((cat: any) => {
                  const isHidden = hiddenBudgetCategories.has(cat.name);
                  const lastVal = cat.data[cat.data.length - 1] ?? 0;
                  return (
                    <button key={cat.name}
                      onClick={() => setHiddenBudgetCategories(prev => { const n = new Set(prev); n.has(cat.name) ? n.delete(cat.name) : n.add(cat.name); return n; })}
                      className="flex items-center gap-2 text-left transition-opacity px-2 py-1 rounded hover:bg-white/5"
                      style={{ opacity: isHidden ? 0.3 : 1 }}>
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className={`text-xs flex-1 ${isHidden ? "line-through text-[#FFFFFF]/30" : "text-[#FFFFFF]/70"}`}>{cat.name}</span>
                      <span className="text-xs text-[#FFFFFF]/40 font-medium">{lastVal.toFixed(1)}%</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {firstCat && (
              <div className="mt-4 bg-[#2962FF]/10 border border-[#2962FF]/20 rounded-lg p-4">
                <p className="text-sm font-semibold text-[#5E8AFF]">Tendencia Principal</p>
                <p className="text-sm text-[#5E8AFF]">La preferencia por {firstCat.name} {trendDir} de {startVal}% a {endVal}% en el período analizado</p>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // ── Evolución de Satisfacción Ciudadana (rating) ───────────────────────────
  const renderRatingEvolutionChart = () => {
    const evolutionData = results?.evolution_data;
    if (!evolutionData || !evolutionData.rating?.data) {
      return (
        <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <h3 className="text-xl font-bold text-[#FFFFFF]">Evolución de Satisfacción Ciudadana</h3>
          </div>
          <p className="text-sm text-[#FFFFFF]/50 mb-4">Calificación promedio mensual</p>
          <div className="text-center text-[#FFFFFF]/50 py-12">No hay datos históricos disponibles</div>
        </div>
      );
    }

    const months = evolutionData.months;
    let ratingData: number[];
    if (ratingEvolutionAgeFilter !== "General" && ratingEvolutionGenderFilter !== "Todos") {
      const key = `${ratingEvolutionAgeFilter}|${ratingEvolutionGenderFilter.toLowerCase()}`;
      ratingData = evolutionData.by_age_and_gender?.[key]?.rating?.data || [];
    } else if (ratingEvolutionGenderFilter !== "Todos") {
      ratingData = evolutionData.by_gender?.[ratingEvolutionGenderFilter.toLowerCase()]?.rating?.data || [];
    } else if (ratingEvolutionAgeFilter !== "General") {
      ratingData = evolutionData.by_age?.[ratingEvolutionAgeFilter]?.rating?.data || [];
    } else {
      ratingData = evolutionData.rating.data;
    }

    const hasData = months.length > 0 && ratingData.length > 0 && ratingData.some((v: number) => v > 0);
    const padding = { top: 30, right: 30, bottom: 50, left: 55 };
    const chartWidth = padding.left + padding.right + (months.length - 1) * 180 + 30;
    const chartHeight = 320;
    const graphWidth = chartWidth - padding.left - padding.right;
    const graphHeight = chartHeight - padding.top - padding.bottom;
    const xStep = months.length > 1 ? graphWidth / (months.length - 1) : graphWidth;
    const yScale = (v: number) => graphHeight - (v / 5) * graphHeight;
    const generatePath = (data: number[]) =>
      data.map((v, i) => `${i === 0 ? "M" : "L"} ${padding.left + i * xStep} ${padding.top + yScale(v)}`).join(" ");
    const generateAreaPath = (data: number[]) => {
      const line = data.map((v, i) => `${i === 0 ? "M" : "L"} ${padding.left + i * xStep} ${padding.top + yScale(v)}`).join(" ");
      return `${line} L ${padding.left + (data.length - 1) * xStep} ${padding.top + graphHeight} L ${padding.left} ${padding.top + graphHeight} Z`;
    };

    const startVal = ratingData[0] || 0;
    const endVal = ratingData[ratingData.length - 1] || 0;
    const improvement = startVal > 0 ? ((endVal - startVal) / startVal) * 100 : 0;
    const isPositive = improvement >= 0;
    const last3 = ratingData.slice(-3);
    const trend3 = last3.length >= 2 ? (last3[last3.length - 1] >= last3[0] ? "Positiva" : "Negativa") : "Estable";

    return (
      <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6">
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <h3 className="text-xl font-bold text-[#FFFFFF]">Evolución de Satisfacción Ciudadana</h3>
        </div>
        <p className="text-sm text-[#FFFFFF]/50 mb-4">Calificación promedio mensual</p>
        {renderCombinedFilters(ratingEvolutionAgeFilter, setRatingEvolutionAgeFilter, ratingEvolutionGenderFilter, setRatingEvolutionGenderFilter)}
        {!hasData ? (
          <div className="text-center text-[#FFFFFF]/50 py-12">No hay datos para este filtro</div>
        ) : (
          <>
            <div className="flex gap-6">
            <div className="flex-1 min-w-0">
              <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
                <defs>
                  <linearGradient id="ratingGradientCba" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#F59E0B" />
                    <stop offset="100%" stopColor="#FEF3C7" />
                  </linearGradient>
                </defs>
                {[0, 1, 2, 3, 4, 5].map(v => (
                  <g key={v}>
                    <line x1={padding.left} y1={padding.top + yScale(v)} x2={chartWidth - padding.right} y2={padding.top + yScale(v)} stroke="#E5E7EB" strokeDasharray="4,4" />
                    <text x={padding.left - 15} y={padding.top + yScale(v) + 4} textAnchor="end" className="text-xs fill-gray-500">{v}</text>
                  </g>
                ))}
                {months.map((month: string, i: number) => (
                  <text key={month} x={padding.left + i * xStep} y={chartHeight - 15} textAnchor="middle" className="text-xs fill-gray-500">{month}</text>
                ))}
                <path d={generateAreaPath(ratingData)} fill="url(#ratingGradientCba)" opacity={0.3} />
                <path d={generatePath(ratingData)} fill="none" stroke="#F59E0B" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                {ratingData.map((v: number, i: number) => (
                  <g key={i}>
                    <circle cx={padding.left + i * xStep} cy={padding.top + yScale(v)} r={15} fill="transparent" className="cursor-pointer"
                      onMouseEnter={() => setHoveredRatingPoint({ index: i, value: v, month: months[i] })}
                      onMouseLeave={() => setHoveredRatingPoint(null)} />
                    <circle cx={padding.left + i * xStep} cy={padding.top + yScale(v)} r={hoveredRatingPoint?.index === i ? 8 : 6}
                      fill="#F59E0B" stroke="white" strokeWidth={3} className="transition-all duration-150" />
                  </g>
                ))}
                {hoveredRatingPoint && (
                  <g>
                    <line x1={padding.left + hoveredRatingPoint.index * xStep} y1={padding.top} x2={padding.left + hoveredRatingPoint.index * xStep} y2={padding.top + graphHeight} stroke="#9CA3AF" strokeWidth={1} strokeDasharray="4,4" />
                    <rect x={padding.left + hoveredRatingPoint.index * xStep - 60} y={padding.top + yScale(hoveredRatingPoint.value) - 50} width={120} height={40} fill="white" stroke="#E5E7EB" strokeWidth={1} rx={6} />
                    <text x={padding.left + hoveredRatingPoint.index * xStep} y={padding.top + yScale(hoveredRatingPoint.value) - 35} textAnchor="middle" className="text-sm font-medium fill-gray-900">{hoveredRatingPoint.month}</text>
                    <text x={padding.left + hoveredRatingPoint.index * xStep} y={padding.top + yScale(hoveredRatingPoint.value) - 18} textAnchor="middle" className="text-sm fill-amber-600">⭐ {hoveredRatingPoint.value.toFixed(1)}</text>
                  </g>
                )}
              </svg>
            </div>
            {/* Stats — right side */}
            <div className="flex flex-col gap-4 justify-center min-w-[180px]">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                <p className="text-sm text-amber-400">Mejora</p>
                <p className={`text-2xl font-bold ${isPositive ? "text-[#00C853]" : "text-red-400"}`}>{isPositive ? "+" : ""}{improvement.toFixed(1)}%</p>
                <p className="text-xs text-amber-400/70">desde {months[0] || "inicio"}</p>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                <p className="text-sm text-amber-400">Tendencia</p>
                <p className={`text-2xl font-bold ${trend3 === "Positiva" ? "text-[#00C853]" : trend3 === "Negativa" ? "text-red-400" : "text-[#FFFFFF]/70"}`}>{trend3}</p>
                <p className="text-xs text-amber-400/70">últimos 3 meses</p>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                <p className="text-sm text-amber-400">Último mes</p>
                <p className="text-2xl font-bold text-[#FFFFFF]">{"★".repeat(Math.round(endVal))}{"☆".repeat(5 - Math.round(endVal))}</p>
                <p className="text-xs text-amber-400/70">{endVal.toFixed(2)} / 5</p>
              </div>
            </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const multipleQ = results.questions_summary.find(q => q.question_type === "percentage_distribution");
  const singleQ = results.questions_summary.find(q => q.question_type === "single_choice");
  const ratingQ = results.questions_summary.find(q => q.question_type === "rating");

  const renderOtrosSummary = () => {
    if (!multipleQ) return null;
    const otrosSummary = (multipleQ as any).otros_summary as Array<{ text: string; count: number }> | undefined;
    if (!otrosSummary || otrosSummary.length === 0) return null;
    const totalOtros = otrosSummary.reduce((sum, item) => sum + item.count, 0);
    return (
      <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6 mb-6">
        <div className="mb-4">
          <h3 className="text-xl font-bold text-[#FFFFFF]">Otras Propuestas Ciudadanas</h3>
          <p className="text-sm text-[#FFFFFF]/50">{totalOtros} personas sugirieron áreas adicionales de inversión</p>
        </div>
        <div className="space-y-3">
          {otrosSummary.slice(0, 10).map((item, index) => {
            const pct = ((item.count / totalOtros) * 100).toFixed(0);
            return (
              <div key={index} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-[#FFFFFF]/80">{item.text}</span>
                    <span className="text-sm text-[#FFFFFF]/50">{item.count} mención{item.count !== 1 ? "es" : ""}</span>
                  </div>
                  <div className="w-full bg-[#000000] rounded-full h-2">
                    <div className="bg-[#2962FF] h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderCrossAnalysis = () => {
    const priorityColors = ["#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4"];

    type SegmentKey = "results_by_city" | "results_by_age" | "results_by_gender";
    type DemographicKey = "by_city" | "by_age_group" | "by_gender";

    const segmentKeyMap: Record<string, SegmentKey> = {
      city: "results_by_city", age: "results_by_age", gender: "results_by_gender",
    };
    const demographicKeyMap: Record<string, DemographicKey> = {
      city: "by_city", age: "by_age_group", gender: "by_gender",
    };
    const tabLabels: Record<string, string> = { city: "Por Ciudad", age: "Por Edad", gender: "Por Género" };
    const columnLabel: Record<string, string> = { city: "Ciudad", age: "Edad", gender: "Género" };

    const segmentKey = segmentKeyMap[crossAnalysisTab];
    const demographicKey = demographicKeyMap[crossAnalysisTab];
    const demographics = (results.demographics as any)[demographicKey] || {};

    const groups = Object.entries(demographics as Record<string, number>)
      .filter(([key]) => key !== "Sin especificar" && key !== "Menor de 18")
      .sort((a, b) => b[1] - a[1]);

    const displayGroups = crossAnalysisTab === "city" ? groups.slice(0, 15) : groups;

    const getTopPriorities = (data: Record<string, any> | undefined, n: number) => {
      if (!data) return [];
      return Object.entries(data)
        .filter(([, val]) => (val as any).label !== "OTROS")
        .map(([key, val]) => ({ key, label: (val as any).label || key, percentage: (val as any).percentage || 0 }))
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, n);
    };

    const allBudgetLabels: string[] = [];
    groups.forEach(([groupName]) => {
      const data = (multipleQ as any)?.[segmentKey]?.[groupName];
      if (data) Object.values(data).forEach((val: any) => {
        const label = val.label || "";
        if (label && label !== "OTROS" && !allBudgetLabels.includes(label)) allBudgetLabels.push(label);
      });
    });
    const budgetColorMap: Record<string, string> = {};
    allBudgetLabels.forEach((label, idx) => { budgetColorMap[label] = priorityColors[idx % priorityColors.length]; });

    return (
      <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6 mb-6">
        <div className="mb-4">
          <h3 className="text-xl font-bold text-[#FFFFFF]">Análisis Cruzado</h3>
          <p className="text-sm text-[#FFFFFF]/50">Compara preferencias segmentando por diferentes dimensiones</p>
        </div>

        <div className="flex gap-1 mb-6 bg-[#000000] rounded-lg p-1 w-fit">
          {(["city", "age", "gender"] as const).map((tab) => (
            <button key={tab} onClick={() => setCrossAnalysisTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition ${crossAnalysisTab === tab ? "bg-[#1a1a2e] text-[#FFFFFF] shadow-none" : "text-[#FFFFFF]/50 hover:text-[#FFFFFF]"}`}>
              {tabLabels[tab]}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-2 font-semibold text-[#FFFFFF]/80">{columnLabel[crossAnalysisTab]}</th>
                <th className="text-center py-3 px-2 font-semibold text-[#FFFFFF]/80">Respuestas</th>
                {multipleQ && <th className="text-left py-3 px-2 font-semibold text-[#FFFFFF]/80">Prioridad #1</th>}
                {multipleQ && <th className="text-left py-3 px-2 font-semibold text-[#FFFFFF]/80">Prioridad #2</th>}
                {multipleQ && <th className="text-left py-3 px-2 font-semibold text-[#FFFFFF]/80">Prioridad #3</th>}
                {singleQ && <th className="text-left py-3 px-2 font-semibold text-[#FFFFFF]/80">Apoyo gestión</th>}
                {ratingQ && <th className="text-right py-3 px-2 font-semibold text-[#FFFFFF]/80">Calificación</th>}
              </tr>
            </thead>
            <tbody>
              {displayGroups.map(([groupName, count]) => {
                const budgetData = (multipleQ as any)?.[segmentKey]?.[groupName];
                const singleData = (singleQ as any)?.[segmentKey]?.[groupName];
                const ratingData = (ratingQ as any)?.[segmentKey]?.[groupName];
                const priorities = getTopPriorities(budgetData, 3);
                const topSingle = singleData ? Object.entries(singleData)
                  .map(([k, v]) => ({ key: k, label: (v as any).label || k, percentage: (v as any).percentage || 0 }))
                  .sort((a, b) => b.percentage - a.percentage)[0] : null;
                const rating = ratingData ? { average: ratingData.average || 0, total: ratingData.total_ratings || 0 } : null;
                const ratingColor = rating && rating.average >= 4 ? "text-[#00C853]" : rating && rating.average >= 3 ? "text-orange-500" : "text-red-500";

                return (
                  <tr key={groupName} className="border-b border-white/5 hover:bg-[#000000] transition">
                    <td className="py-3 px-2 font-medium text-[#FFFFFF]">{groupName}</td>
                    <td className="py-3 px-2 text-center text-[#FFFFFF]/70">{(count as number).toLocaleString()}</td>
                    {multipleQ && [0, 1, 2].map((i) => (
                      <td key={i} className="py-3 px-2">
                        {priorities[i] ? (
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: budgetColorMap[priorities[i].label] || "#9CA3AF" }} />
                            <span className="text-[#FFFFFF] text-xs">{priorities[i].label}</span>
                            <span className="text-[#FFFFFF]/40 text-xs">({priorities[i].percentage.toFixed(1)}%)</span>
                          </div>
                        ) : <span className="text-[#FFFFFF]/30">—</span>}
                      </td>
                    ))}
                    {singleQ && (
                      <td className="py-3 px-2">
                        {topSingle ? (
                          <span className="text-[#FFFFFF] text-xs">{topSingle.label} <span className="text-[#FFFFFF]/40">({topSingle.percentage.toFixed(1)}%)</span></span>
                        ) : <span className="text-[#FFFFFF]/30">—</span>}
                      </td>
                    )}
                    {ratingQ && (
                      <td className="py-3 px-2 text-right">
                        {rating && rating.total > 0 ? (
                          <span className={`font-bold ${ratingColor}`}>{rating.average.toFixed(1)}<span className="text-[#FFFFFF]/40 font-normal">/5</span></span>
                        ) : <span className="text-[#FFFFFF]/30">—</span>}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {crossAnalysisTab === "city" && groups.length > 15 && (
          <p className="text-xs text-[#FFFFFF]/40 mt-3">Mostrando las 15 ciudades con más respuestas de {groups.length} totales</p>
        )}
      </div>
    );
  };

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#000000] text-white">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Back button */}
        <button
          onClick={() => router.push("/client")}
          className="text-[#2962FF] hover:text-[#5E8AFF] font-medium mb-4 flex items-center"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </button>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Image src="/logo_di_white.png" alt="Data Insights" width={120} height={48} />
              <div>
                <h1 className="text-4xl font-bold text-[#FFFFFF]">Panel de Consultas Ciudadanas</h1>
                <p className="text-[#2962FF] font-semibold text-sm mt-1">Gobierno de la Provincia de Córdoba</p>
                <p className="text-[#FFFFFF]/50 mt-1">Democratizando la Voluntad Popular</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs bg-[#00C853]/20 text-[#00C853] px-3 py-1.5 rounded-full font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00C853] animate-pulse" />
                Consulta activa
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 border-b border-white/10">
          {[
            { id: "datos", label: "📊 Datos" },
            { id: "ai-insights", label: "🤖 AI Insights" },
            { id: "reportes", label: "📋 Reportes" },
          ].map(tab => (
            <button key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === tab.id
                ? "border-[#2962FF] text-[#2962FF]"
                : "border-transparent text-[#FFFFFF]/50 hover:text-white"}`}>
              {tab.label}
            </button>
          ))}
        </div>

      <div className="">

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-[#FFFFFF]/70 mb-2">Respuestas Totales</p>
                <p className="text-4xl font-bold text-[#FFFFFF] mb-3">{results.total_responses.toLocaleString()}</p>
                <p className="text-sm font-medium text-[#FFFFFF]/50">Desde el inicio de la consulta</p>
              </div>
              <div className="bg-[#2962FF]/20 rounded-full p-3">
                <svg className="w-6 h-6 text-[#2962FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-[#FFFFFF]/70 mb-2">Respuestas Este Mes</p>
                <p className="text-4xl font-bold text-[#FFFFFF] mb-3">{results.monthly_responses.toLocaleString()}</p>
                <p className={`text-sm font-medium ${(results.monthly_change ?? 0) >= 0 ? "text-[#00C853]" : "text-red-500"}`}>
                  {(results.monthly_change ?? 0) >= 0 ? "+" : ""}{results.monthly_change ?? 0}% vs. mes anterior
                </p>
              </div>
              <div className="bg-[#2962FF]/20 rounded-full p-3">
                <svg className="w-6 h-6 text-[#5E8AFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-[#FFFFFF]/70 mb-2">Calificación Promedio</p>
                <p className="text-4xl font-bold text-[#FFFFFF] mb-3">
                  {ratingQ ? ((ratingQ.results as unknown as RatingResult).average?.toFixed(1) ?? "—") : "—"}
                  <span className="text-xl text-[#FFFFFF]/50">/5</span>
                </p>
                <p className="text-sm text-[#FFD600] font-medium">
                  {"★".repeat(Math.round((ratingQ?.results as unknown as RatingResult)?.average ?? 0))}
                  {"☆".repeat(5 - Math.round((ratingQ?.results as unknown as RatingResult)?.average ?? 0))}
                </p>
              </div>
              <div className="bg-[#FFD600]/20 rounded-full p-3">
                <svg className="w-6 h-6 text-[#FFD600]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Tab: Datos */}
        {activeTab === "datos" && (
          <div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {multipleQ && renderBudgetPieChart(multipleQ)}
              {singleQ && renderSingleChoice(singleQ)}
            </div>
            {renderOtrosSummary()}
            {ratingQ && renderRating(ratingQ)}

            {/* Mapa por Localidad */}
            {results.demographics.by_city && (
              <div className="mb-6">
                <GeographicHeatMap
                  neighborhoodData={results.demographics.by_city}
                  questions={results.questions_summary}
                  neighborhoodCoords={LOCALIDAD_COORDS}
                  mapCenter={[-31.8, -64.0]}
                  mapZoom={7}
                  circleRadius={8000}
                  groupBy="city"
                  title="Desglose por Localidad"
                  subtitle="Participación por ciudad de la provincia"
                  populationData={POBLACION_LOCALIDADES}
                />
              </div>
            )}

            {/* Análisis Cruzado */}
            {renderCrossAnalysis()}

            {/* Gráficos de evolución temporal */}
            <div className="flex flex-col gap-6 mb-6">
              {renderBudgetEvolutionChart()}
              {renderRatingEvolutionChart()}
            </div>

            {/* Demografía */}
            <h2 className="text-2xl font-bold text-[#FFFFFF] mb-4 mt-4">Desglose Demográfico</h2>
            {renderAgeDistribution()}
            {renderGenderDistribution()}
          </div>
        )}

        {/* Tab: AI Insights */}
        {activeTab === "ai-insights" && (
          <div>
            {/* Insights */}
            <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6 mb-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-[#FFFFFF]">Insights de IA para Toma de Decisiones</h3>
                  <p className="text-sm text-[#FFFFFF]/50">
                    {aiInsights ? "Generado con Claude AI" : "Análisis basado en reglas"}
                  </p>
                </div>
                <button onClick={generateAIInsights} disabled={loadingAiInsights}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${loadingAiInsights
                    ? "bg-[#000000] text-[#FFFFFF]/40 cursor-not-allowed"
                    : aiInsights
                      ? "bg-[#2962FF]/20 text-[#5E8AFF] hover:bg-[#2962FF]/30"
                      : "bg-[#2962FF] text-white hover:bg-[#5E8AFF]"}`}>
                  {loadingAiInsights ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Generando...
                    </>
                  ) : aiInsights ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Regenerar con IA
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Generar con Claude AI
                    </>
                  )}
                </button>
              </div>

              {aiInsightsError && (
                <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-sm text-red-400">{aiInsightsError}</p>
                </div>
              )}

              {aiInsights ? renderInsightsSection() : (
                <div className="text-center py-12 text-[#FFFFFF]/40">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <p>Generá insights con IA para obtener análisis avanzado de los datos</p>
                </div>
              )}
            </div>

            {renderPredictionsSection()}
          </div>
        )}

        {/* Tab: Reportes */}
        {activeTab === "reportes" && (
          <div>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-[#FFFFFF]">Segmentación por Preferencias</h2>
              <p className="text-[#FFFFFF]/50 mt-1">
                Clasificación de votantes según las áreas donde asignaron mayor porcentaje de inversión.
                Ideal para enviar reportes personalizados a cada segmento.
              </p>
            </div>

            {/* Threshold slider + Export */}
            <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6 mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium text-[#FFFFFF]/80 block mb-2">
                    Umbral mínimo: <span className="text-[#2962FF] font-bold text-lg">{segmentThreshold}%</span>
                  </label>
                  <p className="text-xs text-[#FFFFFF]/40 mb-3">
                    Una persona se incluye en un segmento si asignó al menos este porcentaje al área
                  </p>
                  <input
                    type="range" min="1" max="100" value={segmentThreshold}
                    onChange={(e) => setSegmentThreshold(parseInt(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    style={{ background: `linear-gradient(to right, #2563eb 0%, #2563eb ${segmentThreshold}%, #e5e7eb ${segmentThreshold}%, #e5e7eb 100%)` }}
                  />
                  <div className="flex justify-between text-xs text-[#FFFFFF]/40 mt-1">
                    <span>1%</span><span>50%</span><span>100%</span>
                  </div>
                </div>
                <button
                  onClick={handleExportXLSX}
                  disabled={!segmentsData || segmentsData.segments.length === 0 || exportingXLSX}
                  className="px-6 py-3 bg-[#00C853] text-white rounded-lg font-medium hover:bg-[#33D968] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
                >
                  {exportingXLSX ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-r-transparent rounded-full animate-spin" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Exportar XLSX
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Loading */}
            {loadingSegments && (
              <div className="flex justify-center items-center py-12">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#2962FF] border-r-transparent" />
                <span className="ml-3 text-[#FFFFFF]/50">Cargando segmentos...</span>
              </div>
            )}

            {/* Summary + cards */}
            {segmentsData && !loadingSegments && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                  <div className="bg-[#1a1a2e] rounded-xl border border-white/10 p-4 text-center">
                    <p className="text-2xl font-bold text-[#2962FF]">{segmentsData.segments.length}</p>
                    <p className="text-xs text-[#FFFFFF]/50">Segmentos</p>
                  </div>
                  <div className="bg-[#1a1a2e] rounded-xl border border-white/10 p-4 text-center">
                    <p className="text-2xl font-bold text-[#FFFFFF]">{segmentsData.total_respondents}</p>
                    <p className="text-xs text-[#FFFFFF]/50">Votantes totales</p>
                  </div>
                  <div className="bg-[#1a1a2e] rounded-xl border border-white/10 p-4 text-center">
                    <p className="text-2xl font-bold text-[#00C853]">
                      {segmentsData.segments.reduce((sum: number, s: any) => sum + s.count, 0)}
                    </p>
                    <p className="text-xs text-[#FFFFFF]/50">Asignaciones totales</p>
                  </div>
                  <div className="bg-[#1a1a2e] rounded-xl border border-white/10 p-4 text-center">
                    <p className="text-2xl font-bold text-[#5E8AFF]">{segmentThreshold}%</p>
                    <p className="text-xs text-[#FFFFFF]/50">Umbral activo</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {segmentsData.segments.map((segment: any) => {
                    const isExpanded = expandedSegments[segment.area_key] || false;
                    const displayUsers = isExpanded ? segment.users : segment.users.slice(0, 5);
                    const pctOfTotal = ((segment.count / segmentsData.total_respondents) * 100).toFixed(1);
                    return (
                      <div key={segment.area_key} className="bg-[#1a1a2e] rounded-2xl border border-white/10 overflow-hidden">
                        <div className="p-6 border-b border-white/5">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-lg font-bold text-[#FFFFFF]">{segment.area}</h3>
                              <p className="text-sm text-[#FFFFFF]/50">
                                {segment.count} persona{segment.count !== 1 ? "s" : ""} ({pctOfTotal}% del total)
                              </p>
                            </div>
                            <div className="bg-[#2962FF]/10 text-[#5E8AFF] px-4 py-2 rounded-full text-sm font-semibold">
                              {segment.count}
                            </div>
                          </div>
                          <div className="mt-3 w-full bg-[#000000] rounded-full h-2">
                            <div className="bg-[#2962FF] h-2 rounded-full transition-all" style={{ width: `${pctOfTotal}%` }} />
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-[#000000]">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-[#FFFFFF]/50 uppercase">Nombre</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-[#FFFFFF]/50 uppercase">Email</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-[#FFFFFF]/50 uppercase">Ciudad</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-[#FFFFFF]/50 uppercase">% Asignado</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {displayUsers.map((user: any, idx: number) => (
                                <tr key={idx} className="hover:bg-[#000000]">
                                  <td className="px-6 py-3 text-sm text-[#FFFFFF]">{user.name}</td>
                                  <td className="px-6 py-3 text-sm text-[#FFFFFF]/50">{user.email}</td>
                                  <td className="px-6 py-3 text-sm text-[#FFFFFF]/50">{user.neighborhood ?? user.city ?? "—"}</td>
                                  <td className="px-6 py-3 text-sm text-right font-semibold text-[#2962FF]">{user.percentage}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {segment.users.length > 5 && (
                          <div className="px-6 py-3 border-t border-white/5 bg-[#000000]">
                            <button
                              onClick={() => setExpandedSegments(prev => ({ ...prev, [segment.area_key]: !isExpanded }))}
                              className="text-sm text-[#2962FF] hover:text-[#5E8AFF] font-medium"
                            >
                              {isExpanded ? "Ver menos" : `Ver todos (${segment.users.length} personas)`}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {segmentsData.segments.length === 0 && (
                  <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-12 text-center">
                    <p className="text-[#FFFFFF]/50">No hay segmentos con el umbral seleccionado. Probá bajando el porcentaje.</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
      </div>
      <ChatBot surveyId={SURVEY_ID} />
    </div>
  );
}
