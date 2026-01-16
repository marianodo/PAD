"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { API_URL } from "@/lib/config";

interface Demographics {
  by_age_group: Record<string, number>;
  by_city: Record<string, number>;
  by_neighborhood: Record<string, number>;
}

interface PercentageResult {
  label: string;
  percentage: number;
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
  results: Record<string, PercentageResult | SingleChoiceResult>;
  results_by_age: Record<string, Record<string, PercentageResult | SingleChoiceResult>>;
}

interface EvolutionCategory {
  name: string;
  key: string;
  data: number[];
}

interface EvolutionData {
  months: string[];
  percentage_distribution: {
    question_id: string;
    question_text: string;
    categories: EvolutionCategory[];
  };
  single_choice: {
    question_id: string;
    question_text: string;
    projects: EvolutionCategory[];
  };
  rating: {
    question_id: string;
    question_text: string;
    data: number[];
  };
  by_age: Record<string, {
    percentage_distribution: { categories: EvolutionCategory[] };
    single_choice: { projects: EvolutionCategory[] };
    rating: { data: number[] };
  }>;
}

interface SurveyResults {
  survey_id: string;
  total_responses: number;
  monthly_responses: number;
  demographics: Demographics;
  questions_summary: QuestionSummary[];
  evolution_data: EvolutionData;
}

interface DashboardMetrics {
  totalResponses: number;
  totalResponsesChange: number;
  monthlyResponses: number;
  monthlyResponsesChange: number;
  uniqueCities: number;
}

export default function SurveyResultsPage() {
  const router = useRouter();
  const params = useParams();
  const surveyId = params.surveyId as string;

  const [results, setResults] = useState<SurveyResults | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalResponses: 0,
    totalResponsesChange: 0,
    monthlyResponses: 0,
    monthlyResponsesChange: 0,
    uniqueCities: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [budgetAgeFilter, setBudgetAgeFilter] = useState("General");
  const [projectsAgeFilter, setProjectsAgeFilter] = useState("General");
  const [ratingAgeFilter, setRatingAgeFilter] = useState("General");
  const [budgetEvolutionAgeFilter, setBudgetEvolutionAgeFilter] = useState("General");
  const [projectsEvolutionAgeFilter, setProjectsEvolutionAgeFilter] = useState("General");
  const [ratingEvolutionAgeFilter, setRatingEvolutionAgeFilter] = useState("General");
  const [hoveredRatingPoint, setHoveredRatingPoint] = useState<{index: number, value: number, month: string} | null>(null);

  const ageFilterOptions = ["General", "18-30", "31-45", "46-60", "60+"];

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/auth/admin-login");
      return;
    }

    const fetchResults = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/surveys/${surveyId}/results`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Error al obtener los resultados");
        }

        const data = await response.json();
        setResults(data);

        // Calcular métricas dinámicamente
        const uniqueCities = Object.keys(data.demographics.by_city).filter(
          city => city !== "Sin especificar"
        ).length;

        setMetrics({
          totalResponses: data.total_responses,
          totalResponsesChange: 0, // TODO: calcular del backend con datos históricos
          monthlyResponses: data.monthly_responses,
          monthlyResponsesChange: 0, // TODO: calcular del backend con datos históricos
          uniqueCities: uniqueCities,
        });

        setLoading(false);
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchResults();
  }, [surveyId, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-50">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Cargando resultados...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md">
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => router.push("/client")}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!results) {
    return null;
  }

  const calculatePercentage = (value: number, total: number) => {
    return total > 0 ? ((value / total) * 100).toFixed(1) : "0";
  };

  // Colores para el pie chart
  const pieColors = [
    "#3B82F6", // blue
    "#10B981", // green
    "#F59E0B", // amber
    "#EF4444", // red
    "#8B5CF6", // purple
    "#EC4899", // pink
    "#06B6D4", // cyan
    "#84CC16", // lime
  ];

  // Helper para encontrar pregunta por tipo
  const getQuestionByType = (type: string) => {
    return results?.questions_summary.find(q => q.question_type === type);
  };

  // Renderizar Pie Chart para distribución de presupuesto
  const renderBudgetPieChart = () => {
    const question = getQuestionByType("percentage_distribution");
    if (!question) return null;

    const data = budgetAgeFilter === "General"
      ? question.results
      : question.results_by_age[budgetAgeFilter] || {};

    const entries = Object.entries(data).sort((a, b) => {
      const aPerc = (a[1] as PercentageResult).percentage;
      const bPerc = (b[1] as PercentageResult).percentage;
      return bPerc - aPerc;
    });

    const hasData = entries.length > 0;

    const total = entries.reduce((sum, [_, val]) => sum + (val as PercentageResult).percentage, 0);

    // Calcular segmentos del pie
    let cumulativePercentage = 0;
    const segments = entries.map(([key, val], index) => {
      const result = val as PercentageResult;
      const percentage = result.percentage;
      const startAngle = (cumulativePercentage / total) * 360;
      cumulativePercentage += percentage;
      const endAngle = (cumulativePercentage / total) * 360;

      return {
        key,
        label: result.label,
        percentage,
        color: pieColors[index % pieColors.length],
        startAngle,
        endAngle,
      };
    });

    // SVG pie chart
    const size = 200;
    const center = size / 2;
    const radius = 80;

    const polarToCartesian = (angle: number) => {
      const angleRad = ((angle - 90) * Math.PI) / 180;
      return {
        x: center + radius * Math.cos(angleRad),
        y: center + radius * Math.sin(angleRad),
      };
    };

    const topCategory = hasData ? entries[0] : null;
    const topLabel = topCategory ? (topCategory[1] as PercentageResult).label : "";
    const topPercentage = topCategory ? (topCategory[1] as PercentageResult).percentage : 0;

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="mb-4">
          <h3 className="text-xl font-bold text-gray-900">Distribución de Presupuesto</h3>
          <p className="text-sm text-gray-500">Preferencias promedio de inversión ciudadana</p>
        </div>

        {/* Age Filter Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
          {ageFilterOptions.map((option) => (
            <button
              key={option}
              onClick={() => setBudgetAgeFilter(option)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition ${
                budgetAgeFilter === option
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        {!hasData ? (
          <div className="text-center text-gray-500 py-12">
            No hay datos para este grupo de edad
          </div>
        ) : (
          <>
            {/* Pie Chart and Legend */}
            <div className="flex items-center gap-8">
              {/* SVG Pie Chart */}
              <div className="relative">
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                  {segments.map((segment, index) => {
                    if (segment.endAngle - segment.startAngle >= 360) {
                      // Full circle
                      return (
                        <circle
                          key={index}
                          cx={center}
                          cy={center}
                          r={radius}
                          fill={segment.color}
                        />
                      );
                    }

                    const start = polarToCartesian(segment.startAngle);
                    const end = polarToCartesian(segment.endAngle);
                    const largeArc = segment.endAngle - segment.startAngle > 180 ? 1 : 0;

                    const d = [
                      `M ${center} ${center}`,
                      `L ${start.x} ${start.y}`,
                      `A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`,
                      "Z",
                    ].join(" ");

                    return <path key={index} d={d} fill={segment.color} />;
                  })}
                </svg>

                {/* Percentage labels on pie */}
                {segments.map((segment, index) => {
                  const midAngle = (segment.startAngle + segment.endAngle) / 2;
                  const labelRadius = radius * 0.65;
                  const angleRad = ((midAngle - 90) * Math.PI) / 180;
                  const x = center + labelRadius * Math.cos(angleRad);
                  const y = center + labelRadius * Math.sin(angleRad);

                  if (segment.percentage < 5) return null;

                  return (
                    <div
                      key={index}
                      className="absolute text-white text-xs font-bold"
                      style={{
                        left: x,
                        top: y,
                        transform: "translate(-50%, -50%)",
                      }}
                    >
                      {segment.percentage.toFixed(1)}%
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {segments.map((segment, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: segment.color }}
                    />
                    <span className="text-sm text-gray-600">{segment.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Insight */}
            <div className="mt-6 bg-blue-50 border border-blue-100 rounded-lg p-4">
              <p className="text-sm font-semibold text-blue-900">Insight Principal</p>
              <p className="text-sm text-blue-700">
                {topLabel} es la prioridad #1 con {topPercentage.toFixed(1)}% del presupuesto preferido
              </p>
            </div>
          </>
        )}
      </div>
    );
  };

  // Renderizar gráfico de Obras Públicas Prioritarias
  const renderProjectsChart = () => {
    const question = getQuestionByType("single_choice");
    if (!question) return null;

    const data = projectsAgeFilter === "General"
      ? question.results
      : question.results_by_age[projectsAgeFilter] || {};

    const entries = Object.entries(data).sort((a, b) => {
      const aResult = a[1] as SingleChoiceResult;
      const bResult = b[1] as SingleChoiceResult;
      return bResult.percentage - aResult.percentage;
    });

    const hasData = entries.length > 0;
    const projectColors = ["#3B82F6", "#10B981", "#8B5CF6"];
    const projectIcons = ["🏛️", "🌳", "🎭"];

    const winner = hasData ? entries[0] : null;
    const winnerResult = winner ? (winner[1] as SingleChoiceResult) : null;

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="mb-4">
          <h3 className="text-xl font-bold text-gray-900">Obras Públicas Prioritarias</h3>
          <p className="text-sm text-gray-500">Votación ciudadana sobre proyectos</p>
        </div>

        {/* Age Filter Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
          {ageFilterOptions.map((option) => (
            <button
              key={option}
              onClick={() => setProjectsAgeFilter(option)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition ${
                projectsAgeFilter === option
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        {!hasData ? (
          <div className="text-center text-gray-500 py-12">
            No hay datos para este grupo de edad
          </div>
        ) : (
          <>
            {/* Projects List */}
            <div className="space-y-4">
              {entries.map(([key, val], index) => {
                const result = val as SingleChoiceResult;
                // Parse label para extraer nombre y ubicación
                const labelParts = result.label.match(/^(.+?)\s*\((.+)\)$/);
                const projectName = labelParts ? labelParts[1] : result.label;
                const location = labelParts ? labelParts[2] : "";

                return (
                  <div
                    key={key}
                    className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                          style={{ backgroundColor: `${projectColors[index % 3]}20` }}
                        >
                          {projectIcons[index % 3]}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{projectName}</h4>
                          {location && (
                            <p className="text-sm text-gray-500">{location}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-gray-900">
                          {result.percentage.toFixed(1)}%
                        </p>
                        <p className="text-sm text-gray-500">
                          {result.votes.toLocaleString()} votos
                        </p>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-3 w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${result.percentage}%`,
                          backgroundColor: projectColors[index % 3],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Winner Insight */}
            {winnerResult && (
              <div className="mt-6 bg-amber-50 border border-amber-100 rounded-lg p-4">
                <p className="text-sm font-semibold text-amber-900">Proyecto Ganador</p>
                <p className="text-sm text-amber-700">
                  {winnerResult.label.split("(")[0].trim()} lidera con {winnerResult.percentage.toFixed(1)}% de preferencia ciudadana
                </p>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // Renderizar gráfico de Calificación de Gestión
  const renderRatingChart = () => {
    const question = getQuestionByType("rating");
    if (!question) return null;

    const generalResults = question.results as RatingResult;
    const isGeneral = ratingAgeFilter === "General";

    let average: number;
    let totalRatings: number;
    let distribution: Record<string, number> | undefined;

    if (isGeneral) {
      average = generalResults.average;
      totalRatings = generalResults.total_ratings;
      distribution = generalResults.distribution;
    } else {
      const ageResults = question.results_by_age[ratingAgeFilter] as RatingResult | undefined;
      if (!ageResults) {
        average = 0;
        totalRatings = 0;
        distribution = undefined;
      } else {
        average = ageResults.average;
        totalRatings = ageResults.total_ratings;
        distribution = ageResults.distribution;
      }
    }

    const hasData = totalRatings > 0;

    // Colores para las barras de rating (1-5)
    const ratingColors = ["#EF4444", "#F97316", "#EAB308", "#22C55E", "#3B82F6"];

    // Calcular porcentaje de calificaciones buenas (4-5 estrellas)
    let goodRatingPercentage = 0;
    if (distribution && totalRatings > 0) {
      const goodRatings = (distribution["4"] || 0) + (distribution["5"] || 0);
      goodRatingPercentage = (goodRatings / totalRatings) * 100;
    }

    // Encontrar el máximo para escalar las barras
    const maxCount = distribution
      ? Math.max(...Object.values(distribution), 1)
      : 1;

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="mb-4">
          <h3 className="text-xl font-bold text-gray-900">Calificación de Gestión</h3>
          <p className="text-sm text-gray-500">Satisfacción ciudadana general</p>
        </div>

        {/* Age Filter Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
          {ageFilterOptions.map((option) => (
            <button
              key={option}
              onClick={() => setRatingAgeFilter(option)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition ${
                ratingAgeFilter === option
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        {!hasData ? (
          <div className="text-center text-gray-500 py-12">
            No hay datos para este grupo de edad
          </div>
        ) : (
          <>
            {/* Stars and Average */}
            <div className="flex flex-col items-center mb-6">
              <div className="flex gap-1 mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <svg
                    key={star}
                    className={`w-8 h-8 ${
                      star <= Math.round(average)
                        ? "text-yellow-400"
                        : "text-gray-300"
                    }`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-4xl font-bold text-gray-900">{average.toFixed(1)}</p>
              <p className="text-sm text-gray-500">de 5 estrellas</p>
            </div>

            {/* Distribution bars */}
            {distribution && (
              <div className="space-y-3 mb-6">
                {[1, 2, 3, 4, 5].map((rating) => {
                  const count = distribution[String(rating)] || 0;
                  const percentage = totalRatings > 0 ? (count / totalRatings) * 100 : 0;

                  return (
                    <div key={rating} className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-600 w-6">
                        {rating}★
                      </span>
                      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${(count / maxCount) * 100}%`,
                            backgroundColor: ratingColors[rating - 1],
                          }}
                        />
                      </div>
                      <span className="text-sm text-gray-500 w-20 text-right">
                        {count.toLocaleString()} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Insight */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-700">
                <span className="font-semibold text-gray-900">
                  {goodRatingPercentage > 0 ? `${goodRatingPercentage.toFixed(1)}%` : `${average.toFixed(1)} promedio`}
                </span>
                {goodRatingPercentage > 0
                  ? " de ciudadanos califican la gestión como buena o excelente"
                  : ` de calificación basado en ${totalRatings.toLocaleString()} respuestas`}
              </p>
            </div>
          </>
        )}
      </div>
    );
  };

  // Renderizar gráfico de Evolución de Preferencias Presupuestales
  const renderBudgetEvolutionChart = () => {
    const evolutionData = results?.evolution_data;
    if (!evolutionData || !evolutionData.percentage_distribution?.categories) {
      return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="mb-4">
            <h3 className="text-xl font-bold text-gray-900">Evolución de Preferencias Presupuestales</h3>
            <p className="text-sm text-gray-500">Tendencias mensuales de asignación ciudadana</p>
          </div>
          <div className="text-center text-gray-500 py-12">
            No hay datos históricos disponibles
          </div>
        </div>
      );
    }

    const months = evolutionData.months;

    // Obtener categorías según filtro de edad
    const rawCategories = budgetEvolutionAgeFilter === "General"
      ? evolutionData.percentage_distribution.categories
      : evolutionData.by_age[budgetEvolutionAgeFilter]?.percentage_distribution?.categories || [];

    // Asignar colores a las categorías
    const categoryColors = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#EC4899", "#06B6D4"];
    const categories = rawCategories.map((cat, index) => ({
      ...cat,
      color: categoryColors[index % categoryColors.length]
    }));

    const hasData = months.length > 0 && categories.length > 0;

    const chartWidth = 600;
    const chartHeight = 300;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const graphWidth = chartWidth - padding.left - padding.right;
    const graphHeight = chartHeight - padding.top - padding.bottom;

    // Calcular max dinámicamente
    const allValues = categories.flatMap(c => c.data);
    const maxValue = Math.max(50, Math.ceil(Math.max(...allValues, 1) / 10) * 10);
    const minValue = 0;

    const xStep = months.length > 1 ? graphWidth / (months.length - 1) : graphWidth;
    const yScale = (value: number) =>
      graphHeight - ((value - minValue) / (maxValue - minValue)) * graphHeight;

    // Generar path para cada categoría
    const generatePath = (data: number[]) => {
      return data
        .map((value, index) => {
          const x = padding.left + index * xStep;
          const y = padding.top + yScale(value);
          return `${index === 0 ? "M" : "L"} ${x} ${y}`;
        })
        .join(" ");
    };

    // Encontrar tendencias (primera categoría con datos)
    const firstCategoryWithData = categories.find(c => c.data.some(v => v > 0));
    const trendData = firstCategoryWithData?.data || [];
    const startValue = trendData[0] || 0;
    const endValue = trendData[trendData.length - 1] || 0;
    const trendDirection = endValue > startValue ? "aumentó" : endValue < startValue ? "disminuyó" : "se mantuvo";
    const trendCategoryName = firstCategoryWithData?.name || "";

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="mb-4">
          <h3 className="text-xl font-bold text-gray-900">Evolución de Preferencias Presupuestales</h3>
          <p className="text-sm text-gray-500">Tendencias mensuales de asignación ciudadana</p>
        </div>

        {/* Age Filter Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
          {ageFilterOptions.map((option) => (
            <button
              key={option}
              onClick={() => setBudgetEvolutionAgeFilter(option)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition ${
                budgetEvolutionAgeFilter === option
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        {/* Line Chart */}
        {!hasData ? (
          <div className="text-center text-gray-500 py-12">
            No hay datos para este grupo de edad
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <svg width={chartWidth} height={chartHeight} className="mx-auto">
                {/* Grid lines */}
                {Array.from({ length: 5 }, (_, i) => Math.round((maxValue / 4) * i)).map((value) => (
                  <g key={value}>
                    <line
                      x1={padding.left}
                      y1={padding.top + yScale(value)}
                      x2={chartWidth - padding.right}
                      y2={padding.top + yScale(value)}
                      stroke="#E5E7EB"
                      strokeDasharray="4,4"
                    />
                    <text
                      x={padding.left - 10}
                      y={padding.top + yScale(value) + 4}
                      textAnchor="end"
                      className="text-xs fill-gray-500"
                    >
                      {value}%
                    </text>
                  </g>
                ))}

                {/* X-axis labels */}
                {months.map((month, index) => (
                  <text
                    key={month}
                    x={padding.left + index * xStep}
                    y={chartHeight - 10}
                    textAnchor="middle"
                    className="text-xs fill-gray-500"
                  >
                    {month}
                  </text>
                ))}

                {/* Lines for each category */}
                {categories.map((category) => (
                  <g key={category.name}>
                    <path
                      d={generatePath(category.data)}
                      fill="none"
                      stroke={category.color}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Data points */}
                    {category.data.map((value, index) => (
                      <circle
                        key={index}
                        cx={padding.left + index * xStep}
                        cy={padding.top + yScale(value)}
                        r={4}
                        fill={category.color}
                        stroke="white"
                        strokeWidth={2}
                      />
                    ))}
                  </g>
                ))}
              </svg>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {categories.map((category) => (
                <div key={category.name} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="text-sm text-gray-600">{category.name}</span>
                </div>
              ))}
            </div>

            {/* Insight */}
            {trendCategoryName && (
              <div className="mt-6 bg-blue-50 border border-blue-100 rounded-lg p-4">
                <p className="text-sm font-semibold text-blue-900">Tendencia Principal</p>
                <p className="text-sm text-blue-700">
                  La preferencia por {trendCategoryName} {trendDirection} de {startValue}% a {endValue}% en el período analizado
                </p>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // Renderizar gráfico de Evolución de Votación de Obras
  const renderProjectsEvolutionChart = () => {
    const evolutionData = results?.evolution_data;
    if (!evolutionData || !evolutionData.single_choice?.projects) {
      return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="mb-4">
            <h3 className="text-xl font-bold text-gray-900">Evolución de Votación de Obras</h3>
            <p className="text-sm text-gray-500">Cambios en preferencia de proyectos prioritarios</p>
          </div>
          <div className="text-center text-gray-500 py-12">
            No hay datos históricos disponibles
          </div>
        </div>
      );
    }

    const months = evolutionData.months;

    // Obtener proyectos según filtro de edad
    const rawProjects = projectsEvolutionAgeFilter === "General"
      ? evolutionData.single_choice.projects
      : evolutionData.by_age[projectsEvolutionAgeFilter]?.single_choice?.projects || [];

    // Asignar colores a los proyectos
    const projectColors = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444"];
    const projects = rawProjects.map((proj, index) => ({
      ...proj,
      color: projectColors[index % projectColors.length]
    }));

    const hasData = months.length > 0 && projects.length > 0;

    const chartWidth = 600;
    const chartHeight = 300;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const graphWidth = chartWidth - padding.left - padding.right;
    const graphHeight = chartHeight - padding.top - padding.bottom;

    // Calcular max dinámicamente
    const allValues = projects.flatMap(p => p.data);
    const maxValue = Math.max(60, Math.ceil(Math.max(...allValues, 1) / 10) * 10);
    const minValue = 0;

    const xStep = months.length > 1 ? graphWidth / (months.length - 1) : graphWidth;
    const yScale = (value: number) =>
      graphHeight - ((value - minValue) / (maxValue - minValue)) * graphHeight;

    const generatePath = (data: number[]) => {
      return data
        .map((value, index) => {
          const x = padding.left + index * xStep;
          const y = padding.top + yScale(value);
          return `${index === 0 ? "M" : "L"} ${x} ${y}`;
        })
        .join(" ");
    };

    // Encontrar proyecto líder actual
    const latestData = projects.map((p) => ({
      name: p.name,
      value: p.data[p.data.length - 1],
    }));
    const leader = latestData.sort((a, b) => b.value - a.value)[0];

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="mb-4">
          <h3 className="text-xl font-bold text-gray-900">Evolución de Votación de Obras</h3>
          <p className="text-sm text-gray-500">Cambios en preferencia de proyectos prioritarios</p>
        </div>

        {/* Age Filter Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
          {ageFilterOptions.map((option) => (
            <button
              key={option}
              onClick={() => setProjectsEvolutionAgeFilter(option)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition ${
                projectsEvolutionAgeFilter === option
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        {/* Line Chart */}
        {!hasData ? (
          <div className="text-center text-gray-500 py-12">
            No hay datos para este grupo de edad
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <svg width={chartWidth} height={chartHeight} className="mx-auto">
                {/* Grid lines */}
                {Array.from({ length: 5 }, (_, i) => Math.round((maxValue / 4) * i)).map((value) => (
                  <g key={value}>
                    <line
                      x1={padding.left}
                      y1={padding.top + yScale(value)}
                      x2={chartWidth - padding.right}
                      y2={padding.top + yScale(value)}
                      stroke="#E5E7EB"
                      strokeDasharray="4,4"
                    />
                    <text
                      x={padding.left - 10}
                      y={padding.top + yScale(value) + 4}
                      textAnchor="end"
                      className="text-xs fill-gray-500"
                    >
                      {value}%
                    </text>
                  </g>
                ))}

                {/* X-axis labels */}
                {months.map((month, index) => (
                  <text
                    key={month}
                    x={padding.left + index * xStep}
                    y={chartHeight - 10}
                    textAnchor="middle"
                    className="text-xs fill-gray-500"
                  >
                    {month}
                  </text>
                ))}

                {/* Lines for each project */}
                {projects.map((project) => (
              <g key={project.name}>
                <path
                  d={generatePath(project.data)}
                  fill="none"
                  stroke={project.color}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Data points */}
                {project.data.map((value, index) => (
                  <circle
                    key={index}
                    cx={padding.left + index * xStep}
                    cy={padding.top + yScale(value)}
                    r={4}
                    fill={project.color}
                    stroke="white"
                    strokeWidth={2}
                  />
                ))}
              </g>
              ))}
              </svg>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {projects.map((project) => (
                <div key={project.name} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="text-sm text-gray-600">{project.name}</span>
                </div>
              ))}
            </div>

            {/* Insight */}
            {leader && leader.value > 0 && (
              <div className="mt-6 bg-amber-50 border border-amber-100 rounded-lg p-4">
                <p className="text-sm font-semibold text-amber-900">Proyecto Líder</p>
                <p className="text-sm text-amber-700">
                  {leader.name} lidera actualmente con {leader.value}% de preferencia
                </p>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // Renderizar gráfico de Evolución de Satisfacción Ciudadana (Rating)
  const renderRatingEvolutionChart = () => {
    const evolutionData = results?.evolution_data;
    if (!evolutionData || !evolutionData.rating?.data) {
      return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <h3 className="text-xl font-bold text-gray-900">Evolución de Satisfacción Ciudadana</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">Calificación promedio mensual</p>
          <div className="text-center text-gray-500 py-12">
            No hay datos históricos disponibles
          </div>
        </div>
      );
    }

    const months = evolutionData.months;

    // Obtener datos según filtro de edad
    const ratingData = ratingEvolutionAgeFilter === "General"
      ? evolutionData.rating.data
      : evolutionData.by_age[ratingEvolutionAgeFilter]?.rating?.data || [];

    const hasData = months.length > 0 && ratingData.length > 0 && ratingData.some(v => v > 0);

    const chartWidth = 800;
    const chartHeight = 300;
    const padding = { top: 30, right: 30, bottom: 50, left: 50 };
    const graphWidth = chartWidth - padding.left - padding.right;
    const graphHeight = chartHeight - padding.top - padding.bottom;

    // Rating scale: 0 to 5
    const maxValue = 5;
    const minValue = 0;

    const xStep = months.length > 1 ? graphWidth / (months.length - 1) : graphWidth;
    const yScale = (value: number) =>
      graphHeight - ((value - minValue) / (maxValue - minValue)) * graphHeight;

    // Generar path para la línea
    const generatePath = (data: number[]) => {
      return data
        .map((value, index) => {
          const x = padding.left + index * xStep;
          const y = padding.top + yScale(value);
          return `${index === 0 ? "M" : "L"} ${x} ${y}`;
        })
        .join(" ");
    };

    // Generar área bajo la curva
    const generateAreaPath = (data: number[]) => {
      const linePath = data
        .map((value, index) => {
          const x = padding.left + index * xStep;
          const y = padding.top + yScale(value);
          return `${index === 0 ? "M" : "L"} ${x} ${y}`;
        })
        .join(" ");

      const lastX = padding.left + (data.length - 1) * xStep;
      const firstX = padding.left;
      const bottomY = padding.top + graphHeight;

      return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
    };

    // Calcular métricas de tendencia
    const startValue = ratingData[0] || 0;
    const endValue = ratingData[ratingData.length - 1] || 0;
    const improvement = startValue > 0 ? ((endValue - startValue) / startValue) * 100 : 0;
    const isPositive = improvement >= 0;

    // Calcular tendencia de los últimos 3 meses
    const last3Months = ratingData.slice(-3);
    const trend3Months = last3Months.length >= 2
      ? last3Months[last3Months.length - 1] >= last3Months[0] ? "Positiva" : "Negativa"
      : "Estable";

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <h3 className="text-xl font-bold text-gray-900">Evolución de Satisfacción Ciudadana</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">Calificación promedio mensual</p>

        {/* Age Filter Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
          {ageFilterOptions.map((option) => (
            <button
              key={option}
              onClick={() => setRatingEvolutionAgeFilter(option)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition ${
                ratingEvolutionAgeFilter === option
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        {!hasData ? (
          <div className="text-center text-gray-500 py-12">
            No hay datos para este grupo de edad
          </div>
        ) : (
          <>
            <div className="overflow-x-auto relative">
              <svg width={chartWidth} height={chartHeight} className="mx-auto">
                {/* Grid lines */}
                {[0, 1, 2, 3, 4, 5].map((value) => (
                  <g key={value}>
                    <line
                      x1={padding.left}
                      y1={padding.top + yScale(value)}
                      x2={chartWidth - padding.right}
                      y2={padding.top + yScale(value)}
                      stroke="#E5E7EB"
                      strokeDasharray="4,4"
                    />
                    <text
                      x={padding.left - 15}
                      y={padding.top + yScale(value) + 4}
                      textAnchor="end"
                      className="text-xs fill-gray-500"
                    >
                      {value}
                    </text>
                  </g>
                ))}

                {/* X-axis labels */}
                {months.map((month, index) => (
                  <text
                    key={month}
                    x={padding.left + index * xStep}
                    y={chartHeight - 15}
                    textAnchor="middle"
                    className="text-xs fill-gray-500"
                  >
                    {month}
                  </text>
                ))}

                {/* Area under the curve */}
                <path
                  d={generateAreaPath(ratingData)}
                  fill="url(#ratingGradient)"
                  opacity={0.3}
                />

                {/* Gradient definition */}
                <defs>
                  <linearGradient id="ratingGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#F59E0B" />
                    <stop offset="100%" stopColor="#FEF3C7" />
                  </linearGradient>
                </defs>

                {/* Line */}
                <path
                  d={generatePath(ratingData)}
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Data points with hover interaction */}
                {ratingData.map((value, index) => (
                  <g key={index}>
                    {/* Invisible larger circle for easier hover */}
                    <circle
                      cx={padding.left + index * xStep}
                      cy={padding.top + yScale(value)}
                      r={15}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredRatingPoint({ index, value, month: months[index] })}
                      onMouseLeave={() => setHoveredRatingPoint(null)}
                    />
                    {/* Visible point */}
                    <circle
                      cx={padding.left + index * xStep}
                      cy={padding.top + yScale(value)}
                      r={hoveredRatingPoint?.index === index ? 8 : 6}
                      fill="#F59E0B"
                      stroke="white"
                      strokeWidth={3}
                      className="transition-all duration-150"
                    />
                  </g>
                ))}

                {/* Tooltip */}
                {hoveredRatingPoint && (
                  <g>
                    {/* Vertical line */}
                    <line
                      x1={padding.left + hoveredRatingPoint.index * xStep}
                      y1={padding.top}
                      x2={padding.left + hoveredRatingPoint.index * xStep}
                      y2={padding.top + graphHeight}
                      stroke="#9CA3AF"
                      strokeWidth={1}
                      strokeDasharray="4,4"
                    />
                    {/* Tooltip box */}
                    <rect
                      x={padding.left + hoveredRatingPoint.index * xStep - 60}
                      y={padding.top + yScale(hoveredRatingPoint.value) - 50}
                      width={120}
                      height={40}
                      fill="white"
                      stroke="#E5E7EB"
                      strokeWidth={1}
                      rx={6}
                    />
                    <text
                      x={padding.left + hoveredRatingPoint.index * xStep}
                      y={padding.top + yScale(hoveredRatingPoint.value) - 35}
                      textAnchor="middle"
                      className="text-sm font-medium fill-gray-900"
                    >
                      {hoveredRatingPoint.month}
                    </text>
                    <text
                      x={padding.left + hoveredRatingPoint.index * xStep}
                      y={padding.top + yScale(hoveredRatingPoint.value) - 18}
                      textAnchor="middle"
                      className="text-sm fill-amber-600"
                    >
                      Calificación : {hoveredRatingPoint.value.toFixed(1)} estrellas
                    </text>
                  </g>
                )}
              </svg>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
                <p className="text-sm text-amber-700">Mejora</p>
                <p className={`text-xl font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {isPositive ? '+' : ''}{improvement.toFixed(1)}%
                </p>
                <p className="text-xs text-amber-600">desde {months[0] || 'inicio'}</p>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
                <p className="text-sm text-amber-700">Tendencia</p>
                <p className={`text-xl font-bold ${trend3Months === 'Positiva' ? 'text-green-600' : trend3Months === 'Negativa' ? 'text-red-600' : 'text-gray-600'}`}>
                  {trend3Months}
                </p>
                <p className="text-xs text-amber-600">últimos 3 meses</p>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderBarChart = (data: Record<string, number>, title: string, color: string) => {
    const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
    const maxValue = Math.max(...entries.map(([_, value]) => value), 1);

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">{title}</h3>
        {entries.length === 0 ? (
          <p className="text-gray-500 text-sm">No hay datos disponibles</p>
        ) : (
          <div className="space-y-3">
            {entries.map(([label, value]) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                  <span className="text-sm text-gray-600">
                    {value} ({calculatePercentage(value, results.total_responses)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className={`${color} h-2.5 rounded-full transition-all duration-300`}
                    style={{ width: `${(value / maxValue) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Back button */}
        <button
          onClick={() => router.push("/client")}
          className="text-blue-600 hover:text-blue-700 font-medium mb-4 flex items-center"
        >
          <svg
            className="w-5 h-5 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Volver
        </button>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">
                Panel de Encuestas Ciudadanas
              </h1>
              <p className="text-gray-500 mt-2">
                Democratizando la Voluntad Popular
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                <svg
                  className="w-5 h-5 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span className="text-sm font-medium text-gray-700">
                  Período
                </span>
              </button>

              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                <svg
                  className="w-5 h-5 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                  />
                </svg>
                <span className="text-sm font-medium text-gray-700">
                  Filtros
                </span>
              </button>

              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                <span className="text-sm font-medium">Exportar</span>
              </button>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Card 1: Respuestas Totales */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-2">
                  Respuestas Totales
                </p>
                <p className="text-4xl font-bold text-gray-900 mb-3">
                  {metrics.totalResponses.toLocaleString()}
                </p>
                <p className="text-sm text-green-600 font-medium">
                  +{metrics.totalResponsesChange}% vs. mes anterior
                </p>
              </div>
              <div className="bg-blue-100 rounded-full p-3">
                <svg
                  className="w-6 h-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Card 2: Respuestas Este Mes */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-2">
                  Respuestas Este Mes
                </p>
                <p className="text-4xl font-bold text-gray-900 mb-3">
                  {metrics.monthlyResponses.toLocaleString()}
                </p>
                <p className="text-sm text-green-600 font-medium">
                  +{metrics.monthlyResponsesChange}% vs. mes anterior
                </p>
              </div>
              <div className="bg-purple-100 rounded-full p-3">
                <svg
                  className="w-6 h-6 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Card 3: Ciudades Participantes */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-2">
                  Ciudades Participantes
                </p>
                <p className="text-4xl font-bold text-gray-900 mb-3">
                  {metrics.uniqueCities}
                </p>
                <p className="text-sm text-gray-500 font-medium">
                  Cobertura geográfica
                </p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Survey Results Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {renderBudgetPieChart()}
          {renderProjectsChart()}
        </div>

        {/* Rating Chart - Full width */}
        <div className="mb-8">
          {renderRatingChart()}
        </div>

        {/* Evolution Section Title */}
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Evolución Histórica</h2>

        {/* Evolution Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {renderBudgetEvolutionChart()}
          {renderProjectsEvolutionChart()}
        </div>

        {/* Rating Evolution Chart - Full width */}
        <div className="mb-8">
          {renderRatingEvolutionChart()}
        </div>

        {/* Demographics Section Title */}
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Demografía de Participantes</h2>

        {/* Demographics Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {renderBarChart(
            results.demographics.by_age_group,
            "Distribución por Edad",
            "bg-blue-600"
          )}
          {renderBarChart(
            results.demographics.by_city,
            "Distribución por Ciudad",
            "bg-cyan-600"
          )}
        </div>

        {/* Full width chart */}
        <div className="mb-6">
          {renderBarChart(
            results.demographics.by_neighborhood,
            "Distribución por Barrio",
            "bg-teal-600"
          )}
        </div>

        {/* Empty state */}
        {results.total_responses === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No hay respuestas aún
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Esta encuesta aún no ha recibido respuestas de usuarios.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
