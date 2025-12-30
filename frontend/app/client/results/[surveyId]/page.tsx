"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

interface Demographics {
  by_age_group: Record<string, number>;
  by_city: Record<string, number>;
  by_neighborhood: Record<string, number>;
}

interface SurveyResults {
  survey_id: string;
  total_responses: number;
  demographics: Demographics;
}

export default function SurveyResultsPage() {
  const router = useRouter();
  const params = useParams();
  const surveyId = params.surveyId as string;

  const [results, setResults] = useState<SurveyResults | null>(null);
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => router.push("/client")}
                className="text-blue-600 hover:text-blue-700 font-medium mb-2 flex items-center"
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
                Volver al Dashboard
              </button>
              <h1 className="text-3xl font-bold text-gray-900">
                Resultados de la Encuesta
              </h1>
              <p className="text-gray-600 mt-1">
                Análisis demográfico de las respuestas
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Total de Respuestas</p>
              <p className="text-4xl font-bold text-blue-600">
                {results.total_responses}
              </p>
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
