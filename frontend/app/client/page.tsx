"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { API_URL } from "@/lib/config";

interface Survey {
  id: string;
  title: string;
  description: string;
  status: string;
  is_active: boolean;
  points_per_question: number;
  bonus_points: number;
  created_at: string;
  total_responses?: number;
}

interface TrendMonth {
  label: string;
  year: number;
  month: number;
  count: number;
}

interface TrendData {
  months: TrendMonth[];
  current_month: number;
  previous_month: number;
  trend_percentage: number;
}

export default function ClientDashboard() {
  const router = useRouter();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userName, setUserName] = useState("Cliente");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const [trendGender, setTrendGender] = useState("Todos");

  const fetchTrend = async (gender: string) => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    const params = gender !== "Todos" ? `?gender=${gender.toLowerCase()}` : "";
    const res = await fetch(`${API_URL}/api/v1/surveys/participation-trend${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setTrendData(await res.json());
  };

  useEffect(() => { fetchTrend(trendGender); }, [trendGender]);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/auth/admin-login");
      return;
    }

    const fetchData = async () => {
      try {
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

          if (userData.account_type !== "client") {
            if (userData.account_type === "admin") {
              router.push("/admin");
            } else {
              router.push("/dashboard");
            }
            return;
          }

          setUserName(userData.name || "Cliente");
        }

        const surveysResponse = await fetch(
          `${API_URL}/api/v1/surveys/`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (surveysResponse.ok) {
          const surveysData = await surveysResponse.json();
          setSurveys(surveysData);
        }

        const trendResponse = await fetch(
          `${API_URL}/api/v1/surveys/participation-trend`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (trendResponse.ok) {
          const trendResult = await trendResponse.json();
          setTrendData(trendResult);
        }

        setLoading(false);
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    router.push("/auth/admin-login");
  };

  const handleCopyLink = async (surveyId: string) => {
    const surveyLink = `${window.location.origin}/survey/${surveyId}`;
    try {
      await navigator.clipboard.writeText(surveyLink);
      setCopiedId(surveyId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Error al copiar el link:", err);
    }
  };

  const handleToggleStatus = async (surveyId: string, currentlyActive: boolean) => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    try {
      const response = await fetch(
        `${API_URL}/api/v1/surveys/${surveyId}/toggle`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ is_active: !currentlyActive }),
        }
      );

      if (response.ok) {
        setSurveys((prev) =>
          prev.map((s) =>
            s.id === surveyId
              ? { ...s, is_active: !currentlyActive, status: !currentlyActive ? "active" : "inactive" }
              : s
          )
        );
      }
    } catch (err) {
      console.error("Error al cambiar estado:", err);
    }
  };

  // Reportes disponibles (hardcoded por ahora, luego migrar a DB)
  const clientReports = [
    {
      municipality: "Municipalidad de Alta Gracia",
      slug: "alta-gracia",
      logo: "AG",
      color: "bg-[#2962FF]",
      periods: [
        {
          period: "2026",
          title: "Informe de Inversión 2026",
          description: "Obras, servicios, seguridad, salud y más. 8 segmentos disponibles.",
          url: "/reports/alta-gracia/2026",
          date: "Marzo 2026",
          segments: ["Salud", "Seguridad", "Obras", "Servicios", "Deportes", "Espacios", "Ayuda Social", "Otras Acciones"],
        },
      ],
    },
  ];

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const totalResponses = surveys.reduce((acc, s) => acc + (s.total_responses || 0), 0);
  const activeSurveys = surveys.filter((s) => s.is_active).length;
  const inactiveSurveys = surveys.length - activeSurveys;
  const avgResponses = surveys.length > 0 ? Math.round(totalResponses / surveys.length) : 0;

  const filteredSurveys = surveys.filter(
    (s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const menuItems = [
    {
      key: "dashboard",
      label: "Dashboard",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
        </svg>
      ),
    },
    {
      key: "reportes",
      label: "Reportes",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <line x1="10" y1="9" x2="8" y2="9" />
        </svg>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#000000]">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-[#00C853] border-r-transparent"></div>
          <p className="mt-4 text-[#FFFFFF]/60 font-sans">Cargando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#000000]">
        <div className="bg-[#1a1a2e] rounded-2xl p-8 max-w-md">
          <p className="text-red-400 font-sans">{error}</p>
        </div>
      </div>
    );
  }

  // Extract initials for avatar
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen flex bg-[#000000] font-sans">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile hamburger */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-4 left-4 z-40 lg:hidden bg-[#1a1a2e] p-2 rounded-lg border border-white/10"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Sidebar */}
      <aside className={`w-[280px] bg-[#000000] border-r border-white/5 flex flex-col fixed inset-y-0 left-0 z-30 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        {/* Logo */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <Image src="/logo_di_white.png" alt="Data Insights" width={100} height={40} />
            <div>
              <p className="text-[#FFFFFF]/40 text-[10px] font-medium tracking-widest uppercase">Panel de Gobierno</p>
              <p className="text-[#FFFFFF] text-base font-bold">PAD</p>
            </div>
          </div>
        </div>

        {/* User card */}
        <div className="mx-4 mb-6">
          <div className="bg-[#1a1a2e] rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#2962FF] flex items-center justify-center text-white text-sm font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-[#FFFFFF] text-sm font-medium truncate">{userName}</p>
              <p className="text-[#00C853] text-xs">Plan Profesional</p>
            </div>
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 px-4">
          <p className="text-[#FFFFFF]/30 text-[10px] font-semibold tracking-widest uppercase mb-3 px-3">Menu</p>
          <div className="space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.key}
                onClick={() => { setActiveSection(item.key); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeSection === item.key
                    ? "bg-[#2962FF] text-white shadow-lg shadow-[#2962FF]/30"
                    : "text-[#FFFFFF]/50 hover:text-[#FFFFFF] hover:bg-white/5"
                }`}
              >
                {item.icon}
                {item.label}
                {activeSection === item.key && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </nav>

        {/* Bottom actions */}
        <div className="px-4 pb-6 space-y-1">
          <div className="relative group">
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#FFFFFF]/50 hover:text-[#FFFFFF] hover:bg-white/5 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Soporte
            </button>
            <div className="absolute bottom-full left-0 mb-2 w-64 bg-[#2D1F45] border border-white/10 rounded-xl p-4 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity duration-200 z-50">
              <p className="text-xs text-[#FFFFFF]/50 uppercase tracking-wider mb-3">Contacto de Soporte</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-[#FFFFFF]/80">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#00C853] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                  Mariano Dominguez
                </div>
                <a href="tel:3517157848" className="flex items-center gap-2 text-sm text-[#FFFFFF]/80 hover:text-[#00C853] transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#00C853] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.92 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                  3517157848
                </a>
                <a href="mailto:mariano.dominguez@datainsights.com.ar" className="flex items-center gap-2 text-sm text-[#FFFFFF]/80 hover:text-[#00C853] transition-colors break-all">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#00C853] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                  </svg>
                  mariano.dominguez@datainsights.com.ar
                </a>
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#FFFFFF]/50 hover:text-red-400 hover:bg-white/5 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Cerrar Sesion
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-0 lg:ml-[280px] p-4 pt-16 lg:pt-8 lg:p-8 bg-[#000000] min-h-screen">
        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold text-[#FFFFFF]">Panel de Cliente</h1>
            <span className="inline-flex items-center gap-1.5 bg-[#00C853]/10 border border-[#00C853]/30 text-[#00C853] text-xs font-medium px-3 py-1 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00C853]" />
              Activo
            </span>
          </div>
          <p className="text-[#FFFFFF]/50 text-sm flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Bienvenido, {userName}
          </p>
        </div>

        {/* Stats + Surveys: solo en dashboard/surveys/results */}
        {activeSection !== "reportes" && activeSection !== "settings" && (<>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
          {/* Total Consultas */}
          <div className="bg-[#1a1a2e] rounded-2xl border border-white/5 p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-[#FFFFFF]/60">Total Consultas</p>
              <div className="w-10 h-10 rounded-xl bg-[#2962FF]/20 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#2962FF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-[#FFFFFF]">{surveys.length}</p>
            <p className="text-xs text-[#FFFFFF]/40 mt-1">{activeSurveys} activa{activeSurveys !== 1 ? 's' : ''}, {inactiveSurveys} inactiva{inactiveSurveys !== 1 ? 's' : ''}</p>
          </div>

          {/* Total Respuestas */}
          <div className="bg-[#1a1a2e] rounded-2xl border border-white/5 p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-[#FFFFFF]/60">Total Respuestas</p>
              <div className="w-10 h-10 rounded-xl bg-[#2962FF]/20 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#5E8AFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-[#FFFFFF]">{totalResponses.toLocaleString("es-AR")}</p>
            <p className="text-xs text-[#FFFFFF]/40 mt-1">Entre todas las consultas</p>
          </div>

          {/* Promedio por Consulta */}
          <div className="bg-[#1a1a2e] rounded-2xl border border-white/5 p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-[#FFFFFF]/60">Promedio por Consulta</p>
              <div className="w-10 h-10 rounded-xl bg-[#00C853]/10 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#00C853]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-[#FFFFFF]">{avgResponses.toLocaleString("es-AR")}</p>
            <p className="text-xs text-[#FFFFFF]/40 mt-1">Respuestas promedio</p>
          </div>

          {/* Tendencia Mensual */}
          <div className="bg-[#1a1a2e] rounded-2xl border border-white/5 p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-[#FFFFFF]/60">Tendencia Mensual</p>
              <div className="w-10 h-10 rounded-xl bg-[#00C853]/10 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#00C853]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-[#FFFFFF]">
              {trendData ? `${trendData.trend_percentage >= 0 ? '+' : ''}${trendData.trend_percentage}%` : '—'}
            </p>
            <p className="text-xs text-[#FFFFFF]/40 mt-1">vs. mes anterior</p>
          </div>
        </div>

        {/* Tendencia de Participación Chart */}
        {trendData && trendData.months.length > 0 && (
          <div className="bg-[#1a1a2e] rounded-2xl border border-white/5 p-6 mb-8">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-[#FFFFFF]">Tendencia de Participacion</h2>
              <p className="text-sm text-[#FFFFFF]/50 mt-0.5">Respuestas mensuales acumuladas</p>
            </div>
            {(() => {
              const months = trendData.months;
              const maxCount = Math.max(...months.map(m => m.count), 1);
              const W = 700;
              const H = 220;
              const padL = 45;
              const padR = 20;
              const padT = 20;
              const padB = 35;
              const chartW = W - padL - padR;
              const chartH = H - padT - padB;

              const points = months.map((m, i) => {
                const x = padL + (i / (months.length - 1)) * chartW;
                const y = padT + chartH - (m.count / maxCount) * chartH;
                return { x, y, ...m };
              });

              // Smooth curve using cubic bezier
              const smoothLine = points.map((p, i) => {
                if (i === 0) return `M ${p.x} ${p.y}`;
                const prev = points[i - 1];
                const cpx = (prev.x + p.x) / 2;
                return `C ${cpx} ${prev.y}, ${cpx} ${p.y}, ${p.x} ${p.y}`;
              }).join(' ');

              const areaPath = `${smoothLine} L ${points[points.length - 1].x} ${padT + chartH} L ${points[0].x} ${padT + chartH} Z`;

              // Y-axis ticks
              const yTicks = 4;
              const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => Math.round((maxCount / yTicks) * i));

              return (
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: '240px' }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2962FF" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#2962FF" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  {/* Horizontal grid lines + Y labels */}
                  {yTickValues.map((val, i) => {
                    const y = padT + chartH - (val / maxCount) * chartH;
                    return (
                      <g key={i}>
                        <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="white" strokeOpacity="0.06" strokeWidth="1" />
                        <text x={padL - 8} y={y + 4} textAnchor="end" fill="rgba(242,243,244,0.35)" fontSize="11" fontFamily="sans-serif">
                          {val}
                        </text>
                      </g>
                    );
                  })}
                  {/* Area */}
                  <path d={areaPath} fill="url(#areaGrad)" />
                  {/* Line */}
                  <path d={smoothLine} fill="none" stroke="#2962FF" strokeWidth="2.5" strokeLinecap="round" />
                  {/* Data points */}
                  {points.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r="4" fill="#2962FF" stroke="#1a1a2e" strokeWidth="2" />
                  ))}
                  {/* X-axis labels */}
                  {points.map((p, i) => (
                    <text key={i} x={p.x} y={H - 8} textAnchor="middle" fill="rgba(242,243,244,0.4)" fontSize="11" fontFamily="sans-serif">
                      {p.label}
                    </text>
                  ))}
                </svg>
              );
            })()}
          </div>
        )}

        {/* Surveys Table */}
        <div className="bg-[#1a1a2e] rounded-2xl border border-white/5">
          {/* Table header */}
          <div className="p-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#FFFFFF]">Mis Consultas</h2>
              <p className="text-sm text-[#FFFFFF]/50 mt-0.5">
                Visualiza y gestiona las consultas de tu organización
              </p>
            </div>
            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#FFFFFF]/30 absolute left-3 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Buscar consulta..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 bg-[#000000] border border-white/10 rounded-xl text-sm text-[#FFFFFF] placeholder-[#FFFFFF]/30 focus:border-[#2962FF] focus:ring-2 focus:ring-[#2962FF]/20 outline-none transition-all w-64"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-t border-white/5">
                  <th className="px-6 py-3 text-left text-[11px] font-semibold text-[#FFFFFF]/30 uppercase tracking-wider">Consulta</th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold text-[#FFFFFF]/30 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold text-[#FFFFFF]/30 uppercase tracking-wider">Respuestas</th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold text-[#FFFFFF]/30 uppercase tracking-wider">Fecha de Creacion</th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold text-[#FFFFFF]/30 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredSurveys.map((survey) => (
                  <tr key={survey.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-[#FFFFFF]">{survey.title}</div>
                      <div className="text-xs text-[#FFFFFF]/40 mt-0.5">
                        {survey.description?.substring(0, 50)}
                        {survey.description && survey.description.length > 50 && "..."}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {survey.is_active ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#00C853]">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#00C853]" />
                          Activa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#FFFFFF]/40">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#2d2d44]" />
                          Inactiva
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-sm text-[#FFFFFF]/70">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#FFFFFF]/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        {(survey.total_responses || 0).toLocaleString("es-AR")}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-sm text-[#FFFFFF]/50">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#FFFFFF]/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        {new Date(survey.created_at).toLocaleDateString("es-AR")}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => router.push(`/client/results/${survey.id}`)}
                          className="inline-flex items-center justify-center gap-1.5 w-[130px] py-1.5 text-xs font-medium text-white bg-[#2962FF] hover:bg-[#5E8AFF] rounded-lg transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="20" x2="18" y2="10" />
                            <line x1="12" y1="20" x2="12" y2="4" />
                            <line x1="6" y1="20" x2="6" y2="14" />
                          </svg>
                          Ver Resultados
                        </button>
                        <button
                          onClick={() => handleCopyLink(survey.id)}
                          className="inline-flex items-center justify-center gap-1.5 w-[110px] py-1.5 text-xs font-medium text-[#FFFFFF]/70 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg transition-colors"
                          title="Copiar link de la consulta"
                        >
                          {copiedId === survey.id ? (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-[#00C853]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              <span className="text-[#00C853]">Copiado</span>
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                              Copiar Link
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleToggleStatus(survey.id, survey.is_active)}
                          className={`inline-flex items-center justify-center gap-1.5 w-[110px] py-1.5 text-xs font-medium rounded-lg transition-colors border ${
                            survey.is_active
                              ? "text-red-400 bg-red-400/10 border-red-400/20 hover:bg-red-400/20"
                              : "text-[#00C853] bg-[#00C853]/10 border-[#00C853]/20 hover:bg-[#00C853]/20"
                          }`}
                        >
                          {survey.is_active ? (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="15" y1="9" x2="9" y2="15" />
                                <line x1="9" y1="9" x2="15" y2="15" />
                              </svg>
                              Desactivar
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                              </svg>
                              Activar
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredSurveys.length === 0 && (
            <div className="text-center py-16">
              <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-[#FFFFFF]/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <h3 className="mt-3 text-sm font-medium text-[#FFFFFF]/70">
                {searchQuery ? "Sin resultados" : "No hay consultas"}
              </h3>
              <p className="mt-1 text-sm text-[#FFFFFF]/40">
                {searchQuery
                  ? `No se encontraron consultas para "${searchQuery}"`
                  : "Tus consultas aparecerán aquí una vez que sean creadas"}
              </p>
            </div>
          )}
        </div>

        </>)}

        {/* Sección Reportes */}
        {activeSection === "reportes" && (
          <div className="mt-0">
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-[#FFFFFF]">Reportes</h2>
              <p className="text-sm text-[#FFFFFF]/50 mt-1">Informes de inversión publicados para cada municipio</p>
            </div>

            <div className="space-y-6">
              {clientReports.map((client) => (
                <div key={client.slug} className="bg-[#1a1a2e] rounded-2xl border border-white/5 overflow-hidden">
                  {/* Client header */}
                  <div className="p-6 border-b border-white/5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#2962FF] flex items-center justify-center text-white font-bold text-lg">
                      {client.logo}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-[#FFFFFF]">{client.municipality}</h3>
                      <p className="text-sm text-[#FFFFFF]/50">{client.periods.length} reporte{client.periods.length !== 1 ? "s" : ""} disponible{client.periods.length !== 1 ? "s" : ""}</p>
                    </div>
                  </div>

                  {/* Reports list */}
                  <div className="divide-y divide-white/5">
                    {client.periods.map((report) => (
                      <div key={report.period} className="p-6 flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-[#000000] flex items-center justify-center shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#2962FF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-semibold text-[#FFFFFF]">{report.title}</h4>
                              <span className="text-xs bg-[#00C853]/10 text-[#00C853] font-medium px-2 py-0.5 rounded-full border border-[#00C853]/20">{report.date}</span>
                            </div>
                            <p className="text-sm text-[#FFFFFF]/50 mt-0.5">{report.description}</p>
                            <div className="flex flex-wrap gap-1.5 mt-3">
                              {report.segments.map((seg) => (
                                <span key={seg} className="text-xs bg-[#000000] text-[#FFFFFF]/50 px-2 py-0.5 rounded-full border border-white/5">{seg}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <a
                          href={report.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#2962FF] hover:bg-[#5E8AFF] rounded-lg transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                          Ver Reporte
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
