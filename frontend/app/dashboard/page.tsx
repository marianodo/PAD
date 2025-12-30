"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface SurveyResponse {
  id: string;
  survey_id: string;
  survey_title: string;
  completed: boolean;
  points_earned: number;
  started_at: string;
  completed_at: string | null;
}

interface UserStats {
  total_responses: number;
  total_points: number;
  level: string;
  points_to_next_level: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [stats, setStats] = useState<UserStats>({
    total_responses: 0,
    total_points: 0,
    level: "Plata",
    points_to_next_level: 250,
  });
  const [userName, setUserName] = useState("Usuario");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"surveys" | "points" | "profile">(
    "surveys"
  );

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    router.push("/auth/login");
  };

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/auth/login");
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch user info
        const userResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/me`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (userResponse.ok) {
          const userData = await userResponse.json();
          setUserName(userData.name || "Usuario");
        }

        // Fetch responses
        const responsesResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/responses/my-responses`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!responsesResponse.ok) {
          if (responsesResponse.status === 401) {
            localStorage.removeItem("access_token");
            router.push("/auth/login");
            return;
          }
          throw new Error("Error al cargar las respuestas");
        }

        const data = await responsesResponse.json();
        setResponses(data);

        // Calculate stats
        const completedResponses = data.filter((r: SurveyResponse) => r.completed);
        const totalPoints = completedResponses.reduce(
          (sum: number, r: SurveyResponse) => sum + r.points_earned,
          0
        );

        setStats({
          total_responses: completedResponses.length,
          total_points: totalPoints,
          level: totalPoints >= 1000 ? "Oro" : totalPoints >= 500 ? "Plata" : "Bronce",
          points_to_next_level: totalPoints >= 1000 ? 0 : totalPoints >= 500 ? 1000 - totalPoints : 500 - totalPoints,
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-AR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "America/Argentina/Buenos_Aires",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <div className="inline-block bg-gray-200 rounded-full px-4 py-1 mb-2">
                <span className="text-gray-700 text-sm font-medium">
                  Portal Ciudadano
                </span>
              </div>
              <h1 className="text-4xl font-bold text-gray-900">
                Hola, {userName}
              </h1>
              <p className="text-gray-600 mt-1">
                Bienvenido a tu portal de participación ciudadana
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
            >
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
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Encuestas Respondidas */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-600 font-medium">Encuestas Respondidas</h3>
              <svg
                className="w-6 h-6 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div className="text-4xl font-bold text-gray-900">{stats.total_responses}</div>
            <p className="text-sm text-gray-500 mt-1">Total completadas</p>
          </div>

          {/* Puntos Totales */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-600 font-medium">Puntos Totales</h3>
              <svg
                className="w-6 h-6 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
            </div>
            <div className="text-4xl font-bold text-gray-900">{stats.total_points}</div>
            <p className="text-sm text-gray-500 mt-1">Puntos acumulados</p>
          </div>

          {/* Nivel Participación */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-600 font-medium">Nivel Participación</h3>
              <svg
                className="w-6 h-6 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <div className="text-4xl font-bold text-gray-900">{stats.level}</div>
            <p className="text-sm text-gray-500 mt-1">
              {stats.points_to_next_level > 0
                ? `${stats.points_to_next_level} puntos para ${stats.level === "Bronce" ? "Plata" : "Oro"}`
                : "Nivel máximo alcanzado"}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-center gap-3 p-4 bg-gray-50 border-b border-gray-200">
            <button
              onClick={() => setActiveTab("surveys")}
              className={`flex items-center gap-2 px-12 py-3 font-medium transition-all rounded-xl ${
                activeTab === "surveys"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "bg-gray-50 text-gray-700 hover:bg-gray-100"
              }`}
            >
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Mis Encuestas
            </button>
            <button
              onClick={() => setActiveTab("points")}
              className={`flex items-center gap-2 px-12 py-3 font-medium transition-all rounded-xl ${
                activeTab === "points"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "bg-gray-50 text-gray-700 hover:bg-gray-100"
              }`}
            >
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
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
              Mis Puntos
            </button>
            <button
              onClick={() => setActiveTab("profile")}
              className={`flex items-center gap-2 px-12 py-3 font-medium transition-all rounded-xl ${
                activeTab === "profile"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "bg-gray-50 text-gray-700 hover:bg-gray-100"
              }`}
            >
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
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              Mi Perfil
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === "surveys" && (
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Encuestas Completadas
              </h2>
              <p className="text-gray-600 mb-6">
                Historial de todas tus participaciones en encuestas ciudadanas
              </p>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded">
                  <p className="text-red-700">{error}</p>
                </div>
              )}

              {responses.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-600 mb-4">
                    Aún no has respondido ninguna encuesta
                  </p>
                  <Link
                    href="/"
                    className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Ir a Encuestas
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {responses
                    .filter((r) => r.completed)
                    .map((response) => (
                      <div
                        key={response.id}
                        className="p-6 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-xl font-semibold text-gray-900">
                                {response.survey_title}
                              </h3>
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
                                <svg
                                  className="w-4 h-4"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                Completada
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <svg
                                className="w-4 h-4"
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
                              Completada el {formatDate(response.completed_at!)}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-2xl font-bold text-green-600">
                                +{response.points_earned}
                              </div>
                              <div className="text-sm text-gray-500">puntos</div>
                            </div>
                            <Link
                              href={`/dashboard/response/${response.id}`}
                              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                            >
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
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
                              </svg>
                              Ver
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "points" && (
            <div className="p-6 text-center py-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Mis Puntos</h2>
              <p className="text-gray-600">Esta sección está en desarrollo</p>
            </div>
          )}

          {activeTab === "profile" && (
            <div className="p-6 text-center py-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Mi Perfil</h2>
              <p className="text-gray-600">Esta sección está en desarrollo</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
