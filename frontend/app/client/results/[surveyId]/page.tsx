"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { API_URL } from "@/lib/config";

interface Demographics {
  by_age_group: Record<string, number>;
  by_city: Record<string, number>;
  by_neighborhood: Record<string, number>;
}

interface SurveyResults {
  survey_id: string;
  total_responses: number;
  monthly_responses: number;
  demographics: Demographics;
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

        {/* Charts Grid */}
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
