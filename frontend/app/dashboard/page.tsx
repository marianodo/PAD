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
  const [activeTab, setActiveTab] = useState<"surveys" | "points" | "profile">("surveys");
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<UserData | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordError, setPasswordError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    router.push("/auth/login");
  };

  const handleEditClick = () => { setEditData(userData); setIsEditing(true); };
  const handleCancelEdit = () => { setEditData(null); setIsEditing(false); };

  const handleSaveEdit = async () => {
    if (!editData) return;
    const token = localStorage.getItem("access_token");
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/v1/users/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: editData.name, email: editData.email, phone: editData.phone, address: editData.address, neighborhood: editData.neighborhood, city: editData.city, postal_code: editData.postal_code }),
      });
      if (response.ok) {
        const updatedUser = await response.json();
        setUserData(updatedUser);
        setUserName(updatedUser.name || "Usuario");
        setIsEditing(false);
        setEditData(null);
      } else { setError("Error al actualizar los datos"); }
    } catch (err) { setError("Error al actualizar los datos"); }
  };

  const handlePasswordChange = async () => {
    setPasswordError("");
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) { setPasswordError("Todos los campos son obligatorios"); return; }
    if (passwordData.newPassword.length < 6) { setPasswordError("La nueva contraseña debe tener al menos 6 caracteres"); return; }
    if (passwordData.newPassword !== passwordData.confirmPassword) { setPasswordError("Las contraseñas no coinciden"); return; }
    const token = localStorage.getItem("access_token");
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/v1/users/change-password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_password: passwordData.currentPassword, new_password: passwordData.newPassword }),
      });
      if (response.ok) {
        setIsChangingPassword(false);
        setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
        alert("Contraseña actualizada exitosamente");
      } else {
        const data = await response.json();
        setPasswordError(data.detail || "Error al cambiar la contraseña");
      }
    } catch (err) { setPasswordError("Error al cambiar la contraseña"); }
  };

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.push("/auth/login"); return; }
    const fetchData = async () => {
      try {
        const userResponse = await fetch(`${API_URL}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (userResponse.ok) { const ud = await userResponse.json(); setUserName(ud.name || "Usuario"); setUserData(ud); }
        const responsesResponse = await fetch(`${API_URL}/api/v1/responses/my-responses`, { headers: { Authorization: `Bearer ${token}` } });
        if (!responsesResponse.ok) { if (responsesResponse.status === 401) { localStorage.removeItem("access_token"); router.push("/auth/login"); return; } throw new Error("Error al cargar las respuestas"); }
        const data = await responsesResponse.json();
        setResponses(data);
        const completedResponses = data.filter((r: SurveyResponse) => r.completed);
        const totalPoints = completedResponses.reduce((sum: number, r: SurveyResponse) => sum + r.points_earned, 0);
        setStats({ total_responses: completedResponses.length, total_points: totalPoints, level: totalPoints >= 1000 ? "Oro" : totalPoints >= 500 ? "Plata" : "Bronce", points_to_next_level: totalPoints >= 1000 ? 0 : totalPoints >= 500 ? 1000 - totalPoints : 500 - totalPoints });
      } catch (err: any) { setError(err.message); } finally { setLoading(false); }
    };
    fetchData();
  }, [router]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-AR", { year: "numeric", month: "long", day: "numeric", timeZone: "America/Argentina/Buenos_Aires" });
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "Bronce": return { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-300", bar: "from-amber-400 to-amber-600", icon: "text-amber-600" };
      case "Plata": return { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-300", bar: "from-slate-400 to-slate-600", icon: "text-slate-500" };
      case "Oro": return { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-300", bar: "from-yellow-400 to-yellow-600", icon: "text-yellow-500" };
      case "Platino": return { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-300", bar: "from-purple-400 to-purple-600", icon: "text-purple-500" };
      default: return { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-300", bar: "from-blue-400 to-blue-600", icon: "text-blue-500" };
    }
  };

  const levelColors = getLevelColor(stats.level);
  const progressPercent = stats.level === "Bronce" ? Math.min((stats.total_points / 500) * 100, 100) : stats.level === "Plata" ? Math.min(((stats.total_points - 500) / 500) * 100, 100) : stats.level === "Oro" ? Math.min(((stats.total_points - 1000) / 1000) * 100, 100) : 100;
  const nextLevel = stats.level === "Bronce" ? "Plata" : stats.level === "Plata" ? "Oro" : "Platino";
  const nextLevelPoints = stats.level === "Bronce" ? 500 : stats.level === "Plata" ? 1000 : 2000;

  // Trophy/medal icons per level
  const LevelIcon = ({ level, className = "w-6 h-6" }: { level: string; className?: string }) => {
    const colors = getLevelColor(level);
    if (level === "Platino") {
      return (
        <svg className={`${className} ${colors.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.003 6.003 0 01-5.45 0m5.45 0a7.454 7.454 0 01-.982 3.172M12 9.728a6.003 6.003 0 01-2.48-5.228" />
        </svg>
      );
    }
    // Trophy icon for Bronce, Plata, Oro
    return (
      <svg className={`${className} ${colors.icon}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.003 6.003 0 01-5.45 0m5.45 0a7.454 7.454 0 01-.982 3.172M12 9.728a6.003 6.003 0 01-2.48-5.228" />
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/80">
        <div className="text-center">
          <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="mt-3 text-gray-500 text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  const navItems = [
    { id: "surveys" as const, label: "Mis Encuestas", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg> },
    { id: "points" as const, label: "Mis Puntos", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg> },
    { id: "profile" as const, label: "Mi Perfil", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> },
  ];

  const levels = [
    { name: "Bronce", min: 0 },
    { name: "Plata", min: 500 },
    { name: "Oro", min: 1000 },
    { name: "Platino", min: 2000 },
  ];

  return (
    <div className="min-h-screen bg-gray-50/80 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar - Dark blue */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-[280px] bg-gradient-to-b from-[#1a2342] to-[#243058] flex flex-col transform transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        {/* Spacer top */}
        <div className="pt-6" />

        {/* User card */}
        <div className="mx-4 mb-5 p-4 rounded-2xl bg-white/10 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
              {userName.split(" ").map(n => n.charAt(0).toUpperCase()).slice(0, 2).join("")}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{userName}</p>
              <p className="text-[11px] text-blue-200/70">{stats.total_responses} encuesta{stats.total_responses !== 1 ? "s" : ""} completada{stats.total_responses !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>

        {/* Menu label */}
        <div className="px-6 mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-300/50">Menu</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 mb-1 ${
                activeTab === item.id
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                  : "text-blue-200/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-3">
                {item.icon}
                {item.label}
              </span>
              {activeTab === item.id && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              )}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-blue-200/50 hover:text-red-300 hover:bg-white/10 transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Cerrar Sesion
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto">
        {/* Top header */}
        <div className="bg-white border-b border-gray-100 px-6 sm:px-8 py-6">
          <div className="flex items-center gap-3 mb-1">
            {/* Mobile menu button */}
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-500 hover:text-gray-800 mr-1">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <span className="inline-block bg-blue-100 text-blue-700 rounded-full px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
              Portal Ciudadano
            </span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard de Participacion Ciudadana</h2>
          <p className="text-sm text-gray-400 mt-1">Bienvenido, {userName.split(" ")[0]}. Aqui podes ver tu actividad y progreso.</p>
        </div>

        <div className="p-6 sm:p-8">
          {/* Stats row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
            {/* Encuestas Respondidas */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-300">
              <div className="flex items-start justify-between mb-4">
                <p className="text-sm text-gray-500 font-medium">Encuestas Respondidas</p>
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900">{stats.total_responses}</div>
              <p className="text-sm text-gray-400 mt-1">Total completadas</p>
            </div>

            {/* Puntos Totales */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-300">
              <div className="flex items-start justify-between mb-4">
                <p className="text-sm text-gray-500 font-medium">Puntos Totales</p>
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900">{stats.total_points}</div>
              <p className="text-sm text-gray-400 mt-1">Puntos acumulados</p>
            </div>

            {/* Nivel de Participacion */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-300">
              <div className="flex items-start justify-between mb-4">
                <p className="text-sm text-gray-500 font-medium">Nivel de Participacion</p>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stats.level === "Bronce" ? "bg-amber-50" : stats.level === "Plata" ? "bg-slate-50" : stats.level === "Oro" ? "bg-yellow-50" : "bg-purple-50"}`}>
                  <LevelIcon level={stats.level} className="w-5 h-5" />
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900">{stats.level}</div>
              <p className="text-sm text-gray-400 mt-1">
                {stats.points_to_next_level > 0 ? `${stats.points_to_next_level} pts para ${nextLevel}` : "Nivel máximo"}
              </p>
            </div>
          </div>

          {/* Level Progress Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            {/* Top row: level info + next level */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${levelColors.bg}`}>
                  <LevelIcon level={stats.level} className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Nivel {stats.level}</h3>
                  <p className="text-sm text-gray-400">{stats.total_points} / {nextLevelPoints} puntos</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Próximo nivel</p>
                <p className="text-base font-bold text-gray-900">{stats.points_to_next_level > 0 ? nextLevel : "Máximo"}</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-100 rounded-full h-2.5 mb-5">
              <div className={`bg-gradient-to-r ${levelColors.bar} h-2.5 rounded-full transition-all duration-700 ease-out`} style={{ width: `${progressPercent}%` }} />
            </div>

            {/* Level icons row */}
            <div className="flex items-center justify-between">
              {levels.map((level) => {
                const isActive = stats.level === level.name;
                const isPassed = stats.total_points >= level.min && !isActive;
                const isFuture = !isActive && !isPassed;
                return (
                  <div key={level.name} className={`flex flex-col items-center gap-1.5 transition-opacity duration-300 ${isFuture ? "opacity-40" : "opacity-100"}`}>
                    <LevelIcon level={level.name} className="w-6 h-6" />
                    <span className={`text-xs font-medium ${isActive ? "text-gray-900 font-semibold" : "text-gray-400"}`}>{level.name}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Content area */}
          {activeTab === "surveys" && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Historial de Encuestas</h3>
                <span className="text-xs text-gray-400 border border-gray-200 rounded-full px-3 py-1 font-medium">{responses.length} encuesta{responses.length !== 1 ? "s" : ""}</span>
              </div>

              {responses.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  </div>
                  <p className="text-gray-900 font-semibold mb-1">Sin encuestas todavía</p>
                  <p className="text-gray-400 text-sm mb-4">Completá tu primera encuesta para ganar puntos</p>
                  <Link href="/" className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-200 font-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    Explorar Encuestas
                  </Link>
                </div>
              ) : (
                <>
                  {/* Table header */}
                  <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50/80 text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                    <div className="col-span-4">Encuesta</div>
                    <div className="col-span-2">Fecha</div>
                    <div className="col-span-2">Estado</div>
                    <div className="col-span-2">Puntos</div>
                    <div className="col-span-2 text-right">Acción</div>
                  </div>

                  {/* Table rows */}
                  <div className="divide-y divide-gray-50">
                    {responses.map((response) => (
                      <div key={response.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-6 py-4 hover:bg-gray-50/60 transition-colors duration-150 items-center">
                        <div className="col-span-4">
                          <h4 className="font-semibold text-gray-900 text-sm">{response.survey_title}</h4>
                          <p className="text-xs text-gray-400 md:hidden mt-0.5">{response.completed_at ? formatDate(response.completed_at) : formatDate(response.started_at)}</p>
                        </div>
                        <div className="col-span-2 hidden md:flex items-center">
                          <span className="text-xs text-gray-500 flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            {response.completed_at ? formatDate(response.completed_at) : formatDate(response.started_at)}
                          </span>
                        </div>
                        <div className="col-span-2 hidden md:block">
                          {response.completed ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200/60">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                              Completada
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              Pendiente
                            </span>
                          )}
                        </div>
                        <div className="col-span-2 hidden md:block">
                          {response.completed ? (
                            <span className="text-emerald-600 font-bold text-sm">+{response.points_earned} <span className="text-xs font-normal text-gray-400">pts</span></span>
                          ) : (
                            <span className="text-gray-400 text-sm">—</span>
                          )}
                        </div>
                        <div className="col-span-2 flex md:justify-end items-center gap-2">
                          {/* Mobile badges */}
                          <span className={`md:hidden inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${response.completed ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                            {response.completed ? "Completada" : "Pendiente"}
                          </span>
                          <span className="md:hidden text-emerald-600 font-bold text-sm">{response.completed ? `+${response.points_earned}` : ""}</span>
                          {response.completed ? (
                            <Link
                              href={`/dashboard/response/${response.id}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all duration-200"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                              Ver Detalles
                            </Link>
                          ) : (
                            <Link
                              href={`/survey/${response.survey_id}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-all duration-200 shadow-sm"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              Continuar
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "points" && (
            <div className="space-y-5">
              {/* Level card */}
              <div className={`rounded-2xl p-6 border ${levelColors.border} ${levelColors.bg} shadow-sm`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-1">Nivel Actual</h2>
                    <p className="text-gray-500 text-sm">Tu progreso en participación ciudadana</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-white/80 flex items-center justify-center shadow-sm">
                    <LevelIcon level={stats.level} className="w-7 h-7" />
                  </div>
                </div>
                <div className="text-5xl font-bold text-gray-900 mb-1">{stats.total_points}</div>
                <p className="text-gray-500 text-sm mb-4">puntos totales</p>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-gray-600">{stats.level}</span>
                    <span className="text-xs text-gray-500">{stats.points_to_next_level > 0 ? `${stats.points_to_next_level} pts para ${nextLevel}` : "Nivel máximo"}</span>
                  </div>
                  <div className="w-full bg-white/60 rounded-full h-2.5">
                    <div className={`bg-gradient-to-r ${levelColors.bar} h-2.5 rounded-full transition-all duration-700`} style={{ width: `${progressPercent}%` }} />
                  </div>
                </div>
              </div>

              {/* Levels grid */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-base font-bold text-gray-900 mb-4">Niveles de Participación</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {levels.map((level) => {
                    const isActive = stats.level === level.name;
                    const isCompleted = stats.total_points >= level.min && !isActive;
                    return (
                      <div key={level.name} className={`rounded-xl p-4 border-2 transition-all duration-300 ${isActive ? `${getLevelColor(level.name).border} ${getLevelColor(level.name).bg} shadow-sm` : isCompleted ? "border-green-200 bg-green-50/50" : "border-gray-100 bg-gray-50/50"}`}>
                        <div className="flex flex-col items-center text-center gap-2">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isActive ? getLevelColor(level.name).bg : isCompleted ? "bg-green-100" : "bg-gray-100"}`}>
                            {isCompleted ? (
                              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                            ) : (
                              <LevelIcon level={level.name} className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-900 text-sm">{level.name}</h4>
                            {isActive && <span className="inline-block mt-1 px-2 py-0.5 bg-blue-600 text-white text-[10px] font-semibold rounded-full">Actual</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* History */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-base font-bold text-gray-900 mb-4">Historial de Puntos</h3>
                {responses.filter((r) => r.completed).length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">Aún no tenés puntos acumulados</p>
                ) : (
                  <div className="space-y-2">
                    {responses.filter((r) => r.completed).map((response) => (
                      <div key={response.id} className="flex items-center justify-between p-3.5 border border-gray-100 rounded-xl hover:border-gray-200 hover:shadow-sm transition-all duration-200">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900 text-sm">{response.survey_title}</h4>
                            <p className="text-xs text-gray-400 mt-0.5">{formatDate(response.completed_at!)}</p>
                          </div>
                        </div>
                        <span className="text-emerald-600 font-bold text-sm">+{response.points_earned} pts</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "profile" && (
            <div className="space-y-6">
              {/* Personal data */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-base font-bold text-gray-900 mb-0.5">Datos Personales</h2>
                    <p className="text-gray-400 text-sm">Administra tu información personal y de contacto</p>
                  </div>
                  {!isEditing ? (
                    <button onClick={handleEditClick} className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-gray-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 text-sm font-medium">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      Editar
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={handleCancelEdit} className="px-4 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition text-sm font-medium">Cancelar</button>
                      <button onClick={handleSaveEdit} className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition text-sm font-medium shadow-sm">Guardar</button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {[
                    { label: "Nombre Completo", key: "name", span: true, editable: true },
                    { label: "Correo electrónico", key: "email", editable: true },
                    { label: "Teléfono", key: "phone", editable: true },
                    { label: "Barrio", key: "neighborhood", editable: true },
                    { label: "Ciudad", key: "city", editable: true },
                    { label: "Dirección", key: "address", span: true, editable: true },
                    { label: "CUIL", key: "cuil", editable: false, format: (v: string) => v ? `${v.slice(0, 2)}-${v.slice(2, 10)}-${v.slice(10)}` : "-" },
                    { label: "Código Postal", key: "postal_code", editable: true },
                  ].map((field) => (
                    <div key={field.key} className={field.span ? "md:col-span-2" : ""}>
                      <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">{field.label}</label>
                      {isEditing && field.editable ? (
                        <input
                          type={field.key === "email" ? "email" : field.key === "phone" ? "tel" : "text"}
                          value={(editData as any)?.[field.key] || ""}
                          onChange={(e) => setEditData({ ...editData!, [field.key]: e.target.value })}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all"
                        />
                      ) : (
                        <p className="text-gray-900 text-sm font-medium py-2.5">
                          {field.format ? field.format((userData as any)?.[field.key] || "") : (userData as any)?.[field.key] || "—"}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Security */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-base font-bold text-gray-900 mb-0.5">Seguridad</h2>
                <p className="text-gray-400 text-sm mb-4">Administra la seguridad de tu cuenta</p>
                <button onClick={() => setIsChangingPassword(true)} className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-600 font-medium rounded-xl hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200 text-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  Cambiar Contraseña
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Password modal */}
      {isChangingPassword && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-7 shadow-2xl">
            <h2 className="text-xl font-bold text-gray-900 mb-5">Cambiar Contraseña</h2>
            {passwordError && (
              <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
                <p className="text-sm text-red-700">{passwordError}</p>
              </div>
            )}
            <div className="space-y-4 mb-6">
              {[
                { label: "Contraseña Actual", key: "currentPassword" },
                { label: "Nueva Contraseña", key: "newPassword", hint: "Mínimo 6 caracteres" },
                { label: "Confirmar Nueva Contraseña", key: "confirmPassword" },
              ].map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">{field.label}</label>
                  <input
                    type="password"
                    value={(passwordData as any)[field.key]}
                    onChange={(e) => setPasswordData({ ...passwordData, [field.key]: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all"
                  />
                  {field.hint && <p className="mt-1 text-[10px] text-gray-400">{field.hint}</p>}
                </div>
              ))}
            </div>
            <div className="flex gap-2.5">
              <button onClick={() => { setIsChangingPassword(false); setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" }); setPasswordError(""); }} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition text-sm">Cancelar</button>
              <button onClick={handlePasswordChange} className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition text-sm shadow-sm">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
