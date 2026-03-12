"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { API_URL } from "@/lib/config";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";

  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  // Login state
  const [loginData, setLoginData] = useState({
    cuil: "",
    password: "",
  });

  // Register state
  const [registerData, setRegisterData] = useState({
    cuil: "",
    password: "",
    confirmPassword: "",
    email: "",
    name: "",
  });

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/v1/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            cuil: loginData.cuil,
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
      router.push(redirect);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (registerData.password !== registerData.confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setIsLoading(true);

    try {
      const { confirmPassword, ...registerPayload } = registerData;
      const cleanPayload = Object.fromEntries(
        Object.entries(registerPayload).map(([k, v]) => [k, v === "" ? null : v])
      );

      const response = await fetch(
        `${API_URL}/api/v1/auth/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(cleanPayload),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Error al registrarse");
      }

      // Auto-login after registration
      const loginResponse = await fetch(
        `${API_URL}/api/v1/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            cuil: registerData.cuil,
            password: registerData.password,
          }),
        }
      );

      if (loginResponse.ok) {
        const data = await loginResponse.json();
        localStorage.setItem("access_token", data.access_token);
        router.push("/");
      } else {
        router.push("/auth/login");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCuil = (value: string) => {
    const digits = value.replace(/\D/g, "");
    return digits.slice(0, 11);
  };

  const features = [
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: "Rápido",
      desc: "Participá en solo 1 minuto",
    },
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
        </svg>
      ),
      title: "Simple",
      desc: "Sin registros complicados",
    },
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
      title: "Impacto",
      desc: "Participá y marcá la diferencia",
    },
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
      ),
      title: "Seguro",
      desc: "Tus datos están protegidos",
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
            Tu voz importa. Participá y transformá la democracia.
          </h1>
          <p className="text-white/60 text-base leading-relaxed max-w-md mb-10">
            Accedé a las consultas ciudadanas, votá por tus preferencias y sé parte de las decisiones que importan en tu comunidad.
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
      <div className="flex-1 lg:ml-[50%] flex flex-col min-h-screen bg-gray-50">
        {/* Top bar with admin link */}
        <div className="flex justify-end px-4 py-4 lg:p-6">
          <Link href="/auth/admin-login" className="text-sm text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap">
            ¿Sos administrador? <span className="font-semibold text-[#2962FF]">Ingresá acá</span>
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
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Portal Ciudadano</h2>
              <p className="text-gray-500 text-sm">
                Ingresá con tu CUIL para participar en las consultas de tu municipio.
              </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => {
                  setActiveTab("login");
                  setError("");
                }}
                className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
                  activeTab === "login"
                    ? "bg-white border border-gray-300 text-gray-900 shadow-sm"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200 border border-transparent"
                }`}
              >
                Iniciar Sesión
              </button>
              <button
                onClick={() => {
                  setActiveTab("register");
                  setError("");
                }}
                className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
                  activeTab === "register"
                    ? "bg-white border border-gray-300 text-gray-900 shadow-sm"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200 border border-transparent"
                }`}
              >
                Registrarse
              </button>
            </div>

            {error && (
              <div className="mb-5 p-3.5 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            {/* Login Form */}
            {activeTab === "login" && (
              <form onSubmit={handleLoginSubmit} className="space-y-5">
                <div>
                  <label htmlFor="cuil" className="block text-sm font-semibold text-gray-700 mb-1.5">
                    CUIL
                  </label>
                  <input
                    id="cuil"
                    type="text"
                    value={loginData.cuil}
                    onChange={(e) =>
                      setLoginData({
                        ...loginData,
                        cuil: formatCuil(e.target.value),
                      })
                    }
                    placeholder="20122456789"
                    required
                    maxLength={11}
                    className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:border-[#2962FF] focus:ring-2 focus:ring-[#2962FF]/20 outline-none transition-all bg-white text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    11 dígitos sin guiones
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
                      Contraseña
                    </label>
                    <a href="#" className="text-sm text-[#2962FF] hover:text-[#1a4fd4] font-medium">
                      ¿Olvidaste tu contraseña?
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
                      minLength={6}
                      className="w-full px-4 pr-12 py-3.5 border border-gray-200 rounded-xl focus:border-[#2962FF] focus:ring-2 focus:ring-[#2962FF]/20 outline-none transition-all bg-white text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                      Iniciar Sesión
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Register Form */}
            {activeTab === "register" && (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="reg-cuil" className="block text-sm font-semibold text-gray-700 mb-1.5">
                      CUIL <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="reg-cuil"
                      type="text"
                      value={registerData.cuil}
                      onChange={(e) =>
                        setRegisterData({
                          ...registerData,
                          cuil: formatCuil(e.target.value),
                        })
                      }
                      placeholder="20123456789"
                      required
                      maxLength={11}
                      className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:border-[#2962FF] focus:ring-2 focus:ring-[#2962FF]/20 outline-none transition-all bg-white text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="reg-name" className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Nombre Completo <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="reg-name"
                      type="text"
                      value={registerData.name}
                      onChange={(e) =>
                        setRegisterData({ ...registerData, name: e.target.value })
                      }
                      placeholder="Juan Pérez"
                      required
                      className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:border-[#2962FF] focus:ring-2 focus:ring-[#2962FF]/20 outline-none transition-all bg-white text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-email" className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Correo electrónico <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    value={registerData.email}
                    onChange={(e) =>
                      setRegisterData({ ...registerData, email: e.target.value })
                    }
                    placeholder="tu@email.com"
                    required
                    className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:border-[#2962FF] focus:ring-2 focus:ring-[#2962FF]/20 outline-none transition-all bg-white text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="reg-password" className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Contraseña <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="reg-password"
                        type={showRegPassword ? "text" : "password"}
                        value={registerData.password}
                        onChange={(e) =>
                          setRegisterData({
                            ...registerData,
                            password: e.target.value,
                          })
                        }
                        placeholder="••••••••"
                        required
                        minLength={6}
                        className="w-full px-4 pr-12 py-3.5 border border-gray-200 rounded-xl focus:border-[#2962FF] focus:ring-2 focus:ring-[#2962FF]/20 outline-none transition-all bg-white text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          {showRegPassword ? (
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

                  <div>
                    <label htmlFor="reg-confirm-password" className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Confirmar <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="reg-confirm-password"
                        type={showRegConfirmPassword ? "text" : "password"}
                        value={registerData.confirmPassword}
                        onChange={(e) =>
                          setRegisterData({
                            ...registerData,
                            confirmPassword: e.target.value,
                          })
                        }
                        placeholder="••••••••"
                        required
                        minLength={6}
                        className="w-full px-4 pr-12 py-3.5 border border-gray-200 rounded-xl focus:border-[#2962FF] focus:ring-2 focus:ring-[#2962FF]/20 outline-none transition-all bg-white text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          {showRegConfirmPassword ? (
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
                      Registrando...
                    </>
                  ) : (
                    <>
                      Crear Cuenta
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Security badge */}
            <div className="mt-6 flex items-start gap-3 bg-gray-50 border border-gray-100 rounded-xl p-4">
              <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center shrink-0 mt-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Participación segura</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Tu identidad y tus respuestas están protegidas con encriptación de extremo a extremo.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom footer */}
        <div className="px-6 py-5 text-center">
          <p className="text-xs text-gray-400">
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

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin h-8 w-8 border-4 border-[#2962FF] border-t-transparent rounded-full" />
    </div>}>
      <LoginForm />
    </Suspense>
  );
}
