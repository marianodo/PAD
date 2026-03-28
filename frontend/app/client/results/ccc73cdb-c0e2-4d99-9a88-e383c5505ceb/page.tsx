"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import ChatBot from "@/components/ChatBot";

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

interface MultipleChoiceResult {
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

const COLORS = [
  "#2962FF", "#00C853", "#FF6D00", "#AA00FF", "#D50000",
  "#0091EA", "#64DD17", "#FFD600", "#C51162", "#00BFA5",
  "#6200EA", "#33691E",
];

export default function CordobaDashboard() {
  const router = useRouter();

  const [results, setResults] = useState<SurveyResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"datos" | "ai-insights">("datos");
  const [aiInsights, setAiInsights] = useState<any[] | null>(null);
  const [aiPredictions, setAiPredictions] = useState<any[] | null>(null);
  const [loadingAiInsights, setLoadingAiInsights] = useState(false);
  const [aiInsightsError, setAiInsightsError] = useState("");
  const [ageDistGenderFilter, setAgeDistGenderFilter] = useState("Todos");
  const [multipleChoiceFilter, setMultipleChoiceFilter] = useState("General");
  const [multipleChoiceGenderFilter, setMultipleChoiceGenderFilter] = useState("Todos");

  const ageFilterOptions = ["General", "18-30", "31-45", "46-60", "60+"];

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchResults = async () => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) return;
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/surveys/${SURVEY_ID}/results`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error("Error al obtener los resultados");
      const data = await response.json();
      setResults(data);
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
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
  const getMultipleChoiceData = (q: QuestionSummary): Record<string, MultipleChoiceResult> => {
    if (multipleChoiceFilter !== "General") {
      const byAge = q.results_by_age?.[multipleChoiceFilter];
      if (byAge) return byAge as Record<string, MultipleChoiceResult>;
    }
    if (multipleChoiceGenderFilter !== "Todos") {
      const byGender = q.results_by_gender?.[multipleChoiceGenderFilter];
      if (byGender) return byGender as Record<string, MultipleChoiceResult>;
    }
    return q.results as Record<string, MultipleChoiceResult>;
  };

  // ── Renders ────────────────────────────────────────────────────────────────

  const renderMultipleChoice = (q: QuestionSummary) => {
    const data = getMultipleChoiceData(q);
    const entries = Object.entries(data).sort((a, b) => b[1].percentage - a[1].percentage);
    if (!entries.length) return <p className="text-[#FFFFFF]/50 text-sm">Sin datos aún.</p>;
    const max = entries[0][1].percentage;

    return (
      <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-[#FFFFFF]">{q.question_text}</h3>
            <p className="text-sm text-[#FFFFFF]/50 mt-1">{q.total_answers} respuestas · distribución de presupuesto</p>
          </div>
          {/* Filtros */}
          <div className="flex flex-wrap gap-2">
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
        </div>

        <div className="space-y-3">
          {entries.map(([key, val], i) => (
            <div key={key}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-[#FFFFFF]/80 truncate pr-4">{val.label}</span>
                <span className="text-sm font-semibold text-[#FFFFFF] shrink-0">{val.percentage.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-3">
                <div
                  className="h-3 rounded-full transition-all duration-500"
                  style={{
                    width: `${max > 0 ? (val.percentage / max) * 100 : 0}%`,
                    backgroundColor: COLORS[i % COLORS.length],
                  }}
                />
              </div>
              <p className="text-xs text-[#FFFFFF]/40 mt-0.5">{val.votes} respuestas</p>
            </div>
          ))}
        </div>

        {/* Insight */}
        {entries.length > 0 && (
          <div className="mt-6 p-4 bg-[#2962FF]/10 border border-[#2962FF]/20 rounded-xl">
            <p className="text-sm text-[#FFFFFF]/80">
              La opción más elegida es <span className="font-bold text-white">{entries[0][1].label}</span> con{" "}
              <span className="text-[#2962FF] font-bold">{entries[0][1].percentage.toFixed(1)}%</span> de las respuestas.
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderSingleChoice = (q: QuestionSummary) => {
    const entries = Object.entries(q.results as Record<string, SingleChoiceResult>);
    if (!entries.length) return <p className="text-[#FFFFFF]/50 text-sm">Sin datos aún.</p>;
    const total = entries.reduce((sum, [, v]) => sum + v.votes, 0);

    return (
      <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6 mb-6">
        <h3 className="text-lg font-bold text-[#FFFFFF] mb-1">{q.question_text}</h3>
        <p className="text-sm text-[#FFFFFF]/50 mb-6">{total} respuestas</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {entries.map(([key, val]) => {
            const isYes = val.label?.toLowerCase() === "sí" || val.label?.toLowerCase() === "si";
            const color = isYes ? "#00C853" : "#D50000";
            return (
              <div key={key} className="flex flex-col items-center justify-center p-8 rounded-2xl border-2"
                style={{ borderColor: color, backgroundColor: `${color}15` }}>
                <span className="text-5xl font-bold mb-2" style={{ color }}>{val.percentage.toFixed(1)}%</span>
                <span className="text-xl font-semibold text-[#FFFFFF]">{val.label}</span>
                <span className="text-sm text-[#FFFFFF]/50 mt-1">{val.votes} votos</span>
              </div>
            );
          })}
        </div>

        {entries.length === 2 && (
          <div className="mt-6 p-4 bg-[#1a1a2e] border border-white/10 rounded-xl">
            <div className="w-full bg-white/10 rounded-full h-4 overflow-hidden">
              <div className="h-4 rounded-full transition-all duration-700"
                style={{ width: `${entries[0][1].percentage}%`, backgroundColor: "#00C853" }} />
            </div>
            <div className="flex justify-between text-xs text-[#FFFFFF]/50 mt-1">
              <span>{entries[0][1].label} {entries[0][1].percentage.toFixed(1)}%</span>
              <span>{entries[1]?.[1].label} {entries[1]?.[1].percentage.toFixed(1)}%</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderRating = (q: QuestionSummary) => {
    const r = q.results as unknown as RatingResult;
    if (!r?.average) return <p className="text-[#FFFFFF]/50 text-sm">Sin datos aún.</p>;
    const dist = r.distribution || {};
    const maxDist = Math.max(...Object.values(dist));
    const goodRatings = ((dist["4"] || 0) + (dist["5"] || 0)) / (r.total_ratings || 1) * 100;
    const ratingColors = ["#D50000", "#FF6D00", "#FFD600", "#00C853", "#2962FF"];

    return (
      <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6 mb-6">
        <h3 className="text-lg font-bold text-[#FFFFFF] mb-1">{q.question_text}</h3>
        <p className="text-sm text-[#FFFFFF]/50 mb-6">{r.total_ratings} calificaciones</p>

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
    const data = ageDistGenderFilter === "Todos"
      ? genderData
      : Object.fromEntries(
        Object.entries(ageData).map(([age, genders]) => [age, (genders as any)[ageDistGenderFilter] || 0])
      );

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

    const iconMap: Record<string, JSX.Element> = {
      "trending-up": <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
      "alert": <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>,
      "target": <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      "users": <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    };

    const priorityColors: Record<string, string> = {
      high: "border-red-500/30 bg-red-500/5",
      medium: "border-yellow-500/30 bg-yellow-500/5",
      low: "border-green-500/30 bg-green-500/5",
    };

    return (
      <div className="space-y-4">
        {aiInsights.map((insight: any, i: number) => (
          <div key={i} className={`p-5 rounded-xl border ${priorityColors[insight.priority] || "border-white/10 bg-white/5"}`}>
            <div className="flex items-start gap-3">
              <div className="text-[#2962FF] mt-0.5">{iconMap[insight.icon] || iconMap["target"]}</div>
              <div>
                <h4 className="font-semibold text-[#FFFFFF] mb-1">{insight.title}</h4>
                <p className="text-sm text-[#FFFFFF]/70">{insight.description}</p>
                {insight.action && (
                  <p className="text-xs text-[#2962FF] mt-2 font-medium">→ {insight.action}</p>
                )}
              </div>
            </div>
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
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={() => router.push("/client")} className="px-4 py-2 bg-[#2962FF] text-white rounded-lg">
            Volver
          </button>
        </div>
      </div>
    );
  }

  if (!results) return null;

  const multipleQ = results.questions_summary.find(q => q.question_type === "percentage_distribution");
  const singleQ = results.questions_summary.find(q => q.question_type === "single_choice");
  const ratingQ = results.questions_summary.find(q => q.question_type === "rating");

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
              <Image src="/logo.jpeg" alt="Data Insights" width={48} height={48} className="rounded-xl" />
              <div>
                <h1 className="text-4xl font-bold text-[#FFFFFF]">Panel de Consultas Ciudadanas</h1>
                <p className="text-[#FFFFFF]/50 mt-2">Democratizando la Voluntad Popular</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs bg-[#00C853]/20 text-[#00C853] px-3 py-1.5 rounded-full font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00C853] animate-pulse" />
                Encuesta activa
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 border-b border-white/10">
          {[
            { id: "datos", label: "📊 Datos" },
            { id: "ai-insights", label: "🤖 AI Insights" },
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
                <p className="text-sm font-medium text-[#FFFFFF]/50">Desde el inicio de la encuesta</p>
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
            {multipleQ && renderMultipleChoice(multipleQ)}
            {singleQ && renderSingleChoice(singleQ)}
            {ratingQ && renderRating(ratingQ)}

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
      </div>
      </div>
      <ChatBot surveyId={SURVEY_ID} />
    </div>
  );
}
