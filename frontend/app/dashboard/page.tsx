"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_URL } from "@/lib/config";

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

interface UserData {
  cuil: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  postal_code?: string;
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
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"surveys" | "points" | "profile">(
    "surveys"
  );
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<UserData | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    router.push("/auth/login");
  };

  const handleEditClick = () => {
    setEditData(userData);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditData(null);
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!editData) return;

    const token = localStorage.getItem("access_token");
    if (!token) return;

    try {
      const response = await fetch(
        `${API_URL}/api/v1/users/me`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: editData.name,
            email: editData.email,
            phone: editData.phone,
            address: editData.address,
            neighborhood: editData.neighborhood,
            city: editData.city,
            postal_code: editData.postal_code,
          }),
        }
      );

      if (response.ok) {
        const updatedUser = await response.json();
        setUserData(updatedUser);
        setUserName(updatedUser.name || "Usuario");
        setIsEditing(false);
        setEditData(null);
      } else {
        setError("Error al actualizar los datos");
      }
    } catch (err) {
      setError("Error al actualizar los datos");
    }
  };

  const handlePasswordChange = async () => {
    setPasswordError("");

    // Validation
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setPasswordError("Todos los campos son obligatorios");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError("La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("Las contraseñas no coinciden");
      return;
    }

    const token = localStorage.getItem("access_token");
    if (!token) return;

    try {
      const response = await fetch(
        `${API_URL}/api/v1/users/change-password`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            current_password: passwordData.currentPassword,
            new_password: passwordData.newPassword,
          }),
        }
      );

      if (response.ok) {
        setIsChangingPassword(false);
        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        alert("Contraseña actualizada exitosamente");
      } else {
        const data = await response.json();
        setPasswordError(data.detail || "Error al cambiar la contraseña");
      }
    } catch (err) {
      setPasswordError("Error al cambiar la contraseña");
    }
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
          `${API_URL}/api/v1/auth/me`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (userResponse.ok) {
          const userData = await userResponse.json();
          setUserName(userData.name || "Usuario");
          setUserData(userData);
        }

        // Fetch responses
        const responsesResponse = await fetch(
          `${API_URL}/api/v1/responses/my-responses`,
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
            <div className="p-6">
              {/* Nivel Actual Card */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-8 mb-8">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                      Nivel Actual
                    </h2>
                    <p className="text-gray-600">
                      Tu progreso en participación ciudadana
                    </p>
                  </div>
                  <div className="bg-white rounded-full p-4 shadow-sm">
                    <svg
                      className="w-8 h-8 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                      />
                    </svg>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="text-6xl font-bold text-gray-900 mb-2">
                    {stats.total_points}
                  </div>
                  <p className="text-gray-600 text-lg">puntos totales</p>
                </div>

                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      {stats.level}
                    </span>
                    <span className="text-sm text-gray-600">
                      {stats.points_to_next_level} puntos para{" "}
                      {stats.level === "Bronce" ? "Plata" : stats.level === "Plata" ? "Oro" : "Platino"}
                    </span>
                  </div>
                  <div className="w-full bg-gray-300 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-blue-600 to-blue-800 h-3 rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          stats.level === "Bronce"
                            ? (stats.total_points / 500) * 100
                            : stats.level === "Plata"
                            ? ((stats.total_points - 500) / 500) * 100
                            : ((stats.total_points - 1000) / 1000) * 100
                        }%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Niveles de Participación */}
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                Niveles de Participación
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Bronce */}
                <div className="bg-white border-2 border-gray-200 rounded-2xl p-6 relative">
                  {stats.total_points >= 0 && (
                    <div className="absolute top-4 right-4 flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-full">
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
                      Completado
                    </div>
                  )}
                  <h4 className="text-2xl font-bold text-gray-900 mb-4">Bronce</h4>
                  <div className="flex items-center gap-2 text-gray-600">
                    <svg
                      className="w-5 h-5 text-orange-400"
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
                    <span>0+ puntos</span>
                  </div>
                </div>

                {/* Plata */}
                <div
                  className={`border-2 rounded-2xl p-6 relative ${
                    stats.level === "Plata"
                      ? "bg-white border-blue-600"
                      : "bg-white border-gray-200"
                  }`}
                >
                  {stats.level === "Plata" && (
                    <div className="absolute top-4 right-4 px-3 py-1 bg-blue-900 text-white text-sm font-medium rounded-full">
                      Actual
                    </div>
                  )}
                  {stats.total_points >= 500 && stats.level !== "Plata" && (
                    <div className="absolute top-4 right-4 flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-full">
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
                      Completado
                    </div>
                  )}
                  <h4 className="text-2xl font-bold text-gray-900 mb-4">Plata</h4>
                  <div className="flex items-center gap-2 text-gray-600">
                    <svg
                      className="w-5 h-5 text-gray-400"
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
                    <span>500+ puntos</span>
                  </div>
                </div>

                {/* Oro */}
                <div
                  className={`border-2 rounded-2xl p-6 relative ${
                    stats.level === "Oro"
                      ? "bg-white border-blue-600"
                      : "bg-white border-gray-200"
                  }`}
                >
                  {stats.level === "Oro" && (
                    <div className="absolute top-4 right-4 px-3 py-1 bg-blue-900 text-white text-sm font-medium rounded-full">
                      Actual
                    </div>
                  )}
                  <h4 className="text-2xl font-bold text-gray-900 mb-4">Oro</h4>
                  <div className="flex items-center gap-2 text-gray-600">
                    <svg
                      className="w-5 h-5 text-yellow-500"
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
                    <span>1000+ puntos</span>
                  </div>
                </div>

                {/* Platino */}
                <div className="bg-white border-2 border-gray-200 rounded-2xl p-6 relative">
                  <h4 className="text-2xl font-bold text-gray-900 mb-4">Platino</h4>
                  <div className="flex items-center gap-2 text-gray-600">
                    <svg
                      className="w-5 h-5 text-purple-500"
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
                    <span>2000+ puntos</span>
                  </div>
                </div>
              </div>

              {/* Historial de Puntos */}
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                Historial de Puntos
              </h3>
              <div className="space-y-4">
                {responses
                  .filter((r) => r.completed)
                  .map((response) => (
                    <div
                      key={response.id}
                      className="flex items-center justify-between p-6 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition"
                    >
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-1">
                          {response.survey_title}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {formatDate(response.completed_at!)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-green-600 font-bold text-xl">
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
                            d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                          />
                        </svg>
                        +{response.points_earned}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {activeTab === "profile" && (
            <div className="p-6">
              {/* Datos Personales */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                      Datos Personales
                    </h2>
                    <p className="text-gray-600">
                      Administra tu información personal y de contacto
                    </p>
                  </div>
                  {!isEditing ? (
                    <button
                      onClick={handleEditClick}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                    >
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
                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                        />
                      </svg>
                      Editar
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={handleCancelEdit}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                      >
                        Guardar
                      </button>
                    </div>
                  )}
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Nombre completo */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nombre Completo
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editData?.name || ""}
                          onChange={(e) =>
                            setEditData({ ...editData!, name: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                        />
                      ) : (
                        <p className="text-gray-600">{userData?.name || "-"}</p>
                      )}
                    </div>

                    {/* Correo electrónico */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Correo electrónico
                      </label>
                      {isEditing ? (
                        <input
                          type="email"
                          value={editData?.email || ""}
                          onChange={(e) =>
                            setEditData({ ...editData!, email: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                        />
                      ) : (
                        <p className="text-gray-600">{userData?.email || "-"}</p>
                      )}
                    </div>

                    {/* Teléfono */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Teléfono
                      </label>
                      {isEditing ? (
                        <input
                          type="tel"
                          value={editData?.phone || ""}
                          onChange={(e) =>
                            setEditData({ ...editData!, phone: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                        />
                      ) : (
                        <p className="text-gray-600">{userData?.phone || "-"}</p>
                      )}
                    </div>

                    {/* Barrio */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Barrio
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editData?.neighborhood || ""}
                          onChange={(e) =>
                            setEditData({
                              ...editData!,
                              neighborhood: e.target.value,
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                        />
                      ) : (
                        <p className="text-gray-600">
                          {userData?.neighborhood || "-"}
                        </p>
                      )}
                    </div>

                    {/* Ciudad */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Ciudad
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editData?.city || ""}
                          onChange={(e) =>
                            setEditData({ ...editData!, city: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                        />
                      ) : (
                        <p className="text-gray-600">{userData?.city || "-"}</p>
                      )}
                    </div>

                    {/* Dirección */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Dirección
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editData?.address || ""}
                          onChange={(e) =>
                            setEditData({ ...editData!, address: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                        />
                      ) : (
                        <p className="text-gray-600">{userData?.address || "-"}</p>
                      )}
                    </div>

                    {/* CUIL - No editable */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        CUIL
                      </label>
                      <p className="text-gray-600">
                        {userData?.cuil
                          ? `${userData.cuil.slice(0, 2)}-${userData.cuil.slice(
                              2,
                              10
                            )}-${userData.cuil.slice(10)}`
                          : "-"}
                      </p>
                    </div>

                    {/* Código Postal */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Código Postal
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editData?.postal_code || ""}
                          onChange={(e) =>
                            setEditData({
                              ...editData!,
                              postal_code: e.target.value,
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                        />
                      ) : (
                        <p className="text-gray-600">
                          {userData?.postal_code || "-"}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Seguridad */}
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Seguridad
                  </h2>
                  <p className="text-gray-600">
                    Administra la seguridad de tu cuenta
                  </p>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-8">
                  <button
                    onClick={() => setIsChangingPassword(true)}
                    className="px-6 py-3 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
                  >
                    Cambiar Contraseña
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal para cambiar contraseña */}
          {isChangingPassword && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Cambiar Contraseña
                </h2>

                {passwordError && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{passwordError}</p>
                  </div>
                )}

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contraseña Actual
                    </label>
                    <input
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={(e) =>
                        setPasswordData({
                          ...passwordData,
                          currentPassword: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nueva Contraseña
                    </label>
                    <input
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) =>
                        setPasswordData({
                          ...passwordData,
                          newPassword: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Mínimo 6 caracteres
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Confirmar Nueva Contraseña
                    </label>
                    <input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) =>
                        setPasswordData({
                          ...passwordData,
                          confirmPassword: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setIsChangingPassword(false);
                      setPasswordData({
                        currentPassword: "",
                        newPassword: "",
                        confirmPassword: "",
                      });
                      setPasswordError("");
                    }}
                    className="flex-1 px-6 py-3 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handlePasswordChange}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-indigo-700 transition"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
