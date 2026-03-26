"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { API_URL } from "@/lib/config";
import { fetchWithRetry } from "@/lib/utils";

export default function AdminLoginPage() {
  const router = useRouter();

  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetchWithRetry(
        `${API_URL}/api/v1/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            cuil: loginData.email, // Backend acepta email en campo cuil
            password: loginData.password,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Error al iniciar sesión");
      }

      const data = await response.json();
      localStorage.setItem("access_token", data.access_token);

      // Verificar el rol del usuario
      const userResponse = await fetchWithRetry(
        `${API_URL}/api/v1/auth/me`,
        {
          headers: {
            Authorization: `Bearer ${data.access_token}`,
          },
        }
      );

      if (userResponse.ok) {
        const userData = await userResponse.json();

        // Redirigir según el tipo de cuenta
        if (userData.account_type === "admin") {
          router.push("/admin");
        } else if (userData.account_type === "client") {
          router.push("/client");
        } else {
          router.push("/dashboard");
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
      title: "Resultados",
      desc: "Datos de consultas en vivo",
    },
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
          <path d="M22 12A10 10 0 0 0 12 2v10z" />
        </svg>
      ),
      title: "Demografía",
      desc: "Segmentación por zona y edad",
    },
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
      title: "Tendencias",
      desc: "Evolución de la participación",
    },
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
      ),
      title: "Seguridad",
      desc: "Datos encriptados y auditados",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 lg:fixed lg:inset-y-0 lg:left-0 bg-gradient-to-b from-[#000000] via-[#0a0a1a] to-[#1a1a2e] flex-col justify-between p-10 overflow-hidden">
        {/* Top: Logo + Badge */}
        <div>
          <div className="flex items-center gap-3 mb-8">
            <Image src="/logo_pad_white.png" alt="PAD" width={200} height={86} className="" />
          </div>

          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-1.5 mb-10">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-xs font-medium">Plataforma activa</span>
          </div>

          {/* Hero text */}
          <h1 className="text-2xl font-bold text-white leading-tight mb-5">
            Analizá las preferencias ciudadanas en tiempo real
          </h1>
          <p className="text-white/60 text-base leading-relaxed max-w-md mb-10">
            Accedé al Monitor de Participación para visualizar los resultados de las consultas y las tendencias, predicciones e insights detrás de los datos.
          </p>

          {/* Feature cards 2x2 */}
          <div className="grid grid-cols-2 gap-3">
            {features.map((f, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-[#00C853] mb-3">{f.icon}</div>
                <p className="text-white font-semibold text-sm mb-0.5">{f.title}</p>
                <p className="text-white/50 text-xs">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-white/40">
          <span>PAD &copy; 2026 &mdash; Participación Activa Digital</span>
          <div className="flex items-center gap-2">
            <span>Powered by</span>
            <Image src="/logo.jpeg" alt="Data Insights" width={20} height={20} className="rounded-md opacity-60" />
            <span className="text-white/60 font-medium">Data Insights S.A.S</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 lg:ml-[50%] flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Top bar with citizen link */}
        <div className="flex justify-end px-4 py-4 lg:p-6">
          <Link href="/auth/login" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors whitespace-nowrap">
            ¿Sos ciudadano? <span className="font-semibold text-[#2962FF]">Ingresá acá</span>
          </Link>
        </div>

        {/* Mobile logo */}
        <div className="lg:hidden flex justify-center pt-2 pb-4">
          <Image src="/logo_pad_dark.png" alt="PAD - Participación Activa Digital" width={160} height={65} />
        </div>

        {/* Form centered */}
        <div className="flex-1 flex items-center justify-center px-4 py-6 lg:px-6 lg:py-8">
          <div className="w-full max-w-md">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Acceso Gobierno</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Ingresá con las credenciales de tu gobierno local para acceder al panel de análisis.
              </p>
            </div>

            {error && (
              <div className="mb-5 p-3.5 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 rounded-r-lg">
                <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                  Correo institucional
                </label>
                <input
                  id="email"
                  type="email"
                  value={loginData.email}
                  onChange={(e) =>
                    setLoginData({ ...loginData, email: e.target.value })
                  }
                  placeholder="admin@municipio.gob.ar"
                  required
                  className="w-full px-4 py-3.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:border-[#2962FF] focus:ring-2 focus:ring-[#2962FF]/20 outline-none transition-all bg-white dark:bg-gray-800 dark:text-white text-sm"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                    Contraseña
                  </label>
                  <a href="#" className="text-sm text-[#2962FF] hover:text-[#1a4fd4] font-medium">
                    Recuperar acceso
                  </a>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={loginData.password}
                    onChange={(e) =>
                      setLoginData({ ...loginData, password: e.target.value })
                    }
                    placeholder="Tu contraseña"
                    required
                    className="w-full px-4 pr-12 py-3.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:border-[#2962FF] focus:ring-2 focus:ring-[#2962FF]/20 outline-none transition-all bg-white dark:bg-gray-800 dark:text-white text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                    tabIndex={-1}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {showPassword ? (
                        <>
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </>
                      ) : (
                        <>
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                          <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>
              </div>

              {/* Checkbox */}
              <div className="flex items-center gap-2">
                <input
                  id="remember"
                  type="checkbox"
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-[#2962FF] focus:ring-[#2962FF]"
                />
                <label htmlFor="remember" className="text-sm text-gray-600 dark:text-gray-400">
                  Mantener sesión iniciada
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#2962FF] hover:bg-[#1a4fd4] text-white py-3.5 rounded-full font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#2962FF]/25 text-sm flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Ingresando...
                  </>
                ) : (
                  <>
                    Ingresar al Panel
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            {/* Security badge */}
            <div className="mt-6 flex items-start gap-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl p-4">
              <div className="w-8 h-8 rounded-full bg-green-50 dark:bg-green-900/30 flex items-center justify-center shrink-0 mt-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Acceso seguro</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Conexión encriptada de extremo a extremo. Todos los accesos quedan registrados en la auditoría del sistema.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom footer */}
        <div className="px-6 py-5 text-center">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            ¿Problemas para acceder?{" "}
            <a href="#" className="text-[#2962FF] hover:text-[#1a4fd4] font-medium">
              Contactar soporte técnico
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
