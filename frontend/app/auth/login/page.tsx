"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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
    phone: "",
    address: "",
    neighborhood: "",
    city: "",
    postal_code: "",
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

      const response = await fetch(
        `${API_URL}/api/v1/auth/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(registerPayload),
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

  // SVG Icons
  const UserIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );

  const LockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );

  const EyeIcon = ({ open }: { open: boolean }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 hover:text-gray-600 cursor-pointer" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {open ? (
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
  );

  const MailIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );

  const PhoneIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );

  const inputClass = "w-full pl-11 pr-4 py-3.5 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-gray-50 focus:bg-white text-sm";
  const inputWithEyeClass = "w-full pl-11 pr-12 py-3.5 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-gray-50 focus:bg-white text-sm";
  const labelClass = "block text-sm font-semibold text-gray-700 mb-1.5";

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-b from-[#0d1b33] via-[#152452] to-[#2a4494] relative overflow-hidden flex-col">
        {/* Title - positioned in upper third, horizontally centered */}
        <div className="relative z-10 text-center px-12 pt-[12vh]">
          <h1 className="text-5xl font-bold text-white italic tracking-wide" style={{ fontFamily: "'Georgia', serif" }}>
            Tú Decides{" "}
            <svg xmlns="http://www.w3.org/2000/svg" className="inline-block h-10 w-10 mb-1 text-white/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </h1>
        </div>

        {/* Gears and circles - background decoration */}
        <div className="absolute inset-0">
          {/* Orbit rings */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px]">
            {/* Outer ring */}
            <div className="absolute inset-0 rounded-full border border-blue-400/20" />
            {/* Middle ring */}
            <div className="absolute inset-[50px] rounded-full border border-blue-400/15" />
            {/* Inner ring */}
            <div className="absolute inset-[100px] rounded-full border border-blue-300/10" />

            {/* Dots on outer ring */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-400/50 rounded-full" />
            <div className="absolute top-[12%] right-[5%] w-2 h-2 bg-blue-300/40 rounded-full" />
            <div className="absolute top-[12%] left-[5%] w-2.5 h-2.5 bg-blue-400/35 rounded-full" />
            <div className="absolute bottom-[12%] right-[5%] w-3 h-3 bg-blue-400/40 rounded-full" />
            <div className="absolute bottom-[12%] left-[5%] w-2 h-2 bg-blue-300/30 rounded-full" />
            <div className="absolute top-1/2 right-0 -translate-y-1/2 w-2.5 h-2.5 bg-blue-400/40 rounded-full" />
            <div className="absolute top-1/2 left-0 -translate-y-1/2 w-2 h-2 bg-blue-300/30 rounded-full" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-blue-400/35 rounded-full" />

            {/* Dots on middle ring */}
            <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-300/30 rounded-full" />
            <div className="absolute top-[30%] right-[15%] w-2.5 h-2.5 bg-blue-400/35 rounded-full" />
            <div className="absolute bottom-[25%] left-[13%] w-2 h-2 bg-blue-300/25 rounded-full" />

            {/* Connecting lines from center outward */}
            <div className="absolute top-0 left-1/2 w-px h-[50px] bg-gradient-to-b from-blue-400/30 to-transparent" />
            <div className="absolute bottom-0 left-1/2 w-px h-[50px] bg-gradient-to-t from-blue-400/30 to-transparent" />
            <div className="absolute top-1/2 right-0 w-[50px] h-px bg-gradient-to-l from-blue-400/30 to-transparent" />
            <div className="absolute top-1/2 left-0 w-[50px] h-px bg-gradient-to-r from-blue-400/30 to-transparent" />
            {/* Diagonal lines */}
            <div className="absolute top-[10%] right-[10%] w-px h-[40px] bg-gradient-to-b from-blue-400/20 to-transparent rotate-45 origin-top" />
            <div className="absolute top-[10%] left-[10%] w-px h-[40px] bg-gradient-to-b from-blue-400/20 to-transparent -rotate-45 origin-top" />
          </div>

          {/* Gears SVG - centered */}
          <svg className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] text-blue-400/25" viewBox="0 0 420 420" fill="none">
            {/* Large center gear */}
            <g transform="translate(210, 210)">
              <circle r="70" stroke="currentColor" strokeWidth="2" fill="none" />
              <circle r="50" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.7" />
              <circle r="30" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.5" />
              <circle r="10" fill="currentColor" opacity="0.3" />
              {/* Gear teeth */}
              {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => (
                <rect
                  key={`lg-${angle}`}
                  x="-6"
                  y="-82"
                  width="12"
                  height="16"
                  rx="2"
                  fill="currentColor"
                  opacity="0.35"
                  transform={`rotate(${angle})`}
                />
              ))}
              {/* Inner spokes */}
              {[0, 60, 120, 180, 240, 300].map((angle) => (
                <line
                  key={`spoke-${angle}`}
                  x1="0" y1="-30" x2="0" y2="-50"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  opacity="0.3"
                  transform={`rotate(${angle})`}
                />
              ))}
            </g>
            {/* Medium gear top-right */}
            <g transform="translate(315, 120)">
              <circle r="42" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <circle r="28" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.6" />
              <circle r="14" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.4" />
              <circle r="5" fill="currentColor" opacity="0.3" />
              {[0, 40, 80, 120, 160, 200, 240, 280, 320].map((angle) => (
                <rect
                  key={`md-${angle}`}
                  x="-5"
                  y="-51"
                  width="10"
                  height="13"
                  rx="2"
                  fill="currentColor"
                  opacity="0.3"
                  transform={`rotate(${angle})`}
                />
              ))}
            </g>
            {/* Medium gear bottom-left */}
            <g transform="translate(115, 310)">
              <circle r="45" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <circle r="30" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.6" />
              <circle r="15" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.4" />
              <circle r="6" fill="currentColor" opacity="0.3" />
              {[0, 36, 72, 108, 144, 180, 216, 252, 288, 324].map((angle) => (
                <rect
                  key={`bl-${angle}`}
                  x="-5"
                  y="-54"
                  width="10"
                  height="13"
                  rx="2"
                  fill="currentColor"
                  opacity="0.3"
                  transform={`rotate(${angle})`}
                />
              ))}
            </g>
            {/* Small gear bottom-right */}
            <g transform="translate(320, 320)">
              <circle r="25" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <circle r="12" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.5" />
              <circle r="4" fill="currentColor" opacity="0.3" />
              {[0, 51, 102, 153, 204, 255, 306].map((angle) => (
                <rect
                  key={`sm-${angle}`}
                  x="-4"
                  y="-31"
                  width="8"
                  height="10"
                  rx="2"
                  fill="currentColor"
                  opacity="0.3"
                  transform={`rotate(${angle})`}
                />
              ))}
            </g>
          </svg>
        </div>

        {/* Decorative star bottom-right */}
        <div className="absolute bottom-6 right-6 text-blue-300/25">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
          </svg>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 px-4 py-8 lg:py-12">
        <div className="w-full max-w-md">
          {/* Portal badge - visible on mobile too */}
          <div className="text-center mb-6">
            <span className="inline-block bg-gray-100 border border-gray-200 rounded-full px-5 py-1.5 text-gray-600 text-xs font-medium tracking-wide uppercase">
              Portal Ciudadano
            </span>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-xl p-7 md:p-9">
            <div className="mb-7">
              <h2 className="text-3xl font-bold text-gray-900 mb-1">
                Bienvenido
              </h2>
              <p className="text-gray-500 text-sm">
                Accede a tu portal de participación ciudadana
              </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-3 mb-7">
              <button
                onClick={() => {
                  setActiveTab("login");
                  setError("");
                }}
                className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
                  activeTab === "login"
                    ? "bg-white border border-gray-300 text-gray-900 shadow-sm"
                    : "bg-gray-50 text-gray-500 hover:bg-gray-100 border border-transparent"
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
                    : "bg-gray-50 text-gray-500 hover:bg-gray-100 border border-transparent"
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
                  <label htmlFor="cuil" className={labelClass}>
                    CUIL
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                      <UserIcon />
                    </div>
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
                      className={inputClass}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    11 dígitos sin guiones
                  </p>
                </div>

                <div>
                  <label htmlFor="password" className={labelClass}>
                    Contraseña
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                      <LockIcon />
                    </div>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={loginData.password}
                      onChange={(e) =>
                        setLoginData({ ...loginData, password: e.target.value })
                      }
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className={inputWithEyeClass}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2"
                      tabIndex={-1}
                    >
                      <EyeIcon open={showPassword} />
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <a href="#" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-blue-700 to-blue-900 text-white py-3.5 rounded-xl font-semibold hover:from-blue-800 hover:to-blue-950 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg text-sm"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Ingresando...
                    </span>
                  ) : (
                    "Iniciar Sesión"
                  )}
                </button>
              </form>
            )}

            {/* Register Form */}
            {activeTab === "register" && (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="reg-cuil" className={labelClass}>
                      CUIL <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                        <UserIcon />
                      </div>
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
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-name" className={labelClass}>
                      Nombre Completo <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                        <UserIcon />
                      </div>
                      <input
                        id="reg-name"
                        type="text"
                        value={registerData.name}
                        onChange={(e) =>
                          setRegisterData({ ...registerData, name: e.target.value })
                        }
                        placeholder="Juan Pérez"
                        required
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-email" className={labelClass}>
                    Correo electrónico <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                      <MailIcon />
                    </div>
                    <input
                      id="reg-email"
                      type="email"
                      value={registerData.email}
                      onChange={(e) =>
                        setRegisterData({ ...registerData, email: e.target.value })
                      }
                      placeholder="tu@email.com"
                      required
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="reg-password" className={labelClass}>
                      Contraseña <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                        <LockIcon />
                      </div>
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
                        className={inputWithEyeClass}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2"
                        tabIndex={-1}
                      >
                        <EyeIcon open={showRegPassword} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-confirm-password" className={labelClass}>
                      Confirmar <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                        <LockIcon />
                      </div>
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
                        className={inputWithEyeClass}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2"
                        tabIndex={-1}
                      >
                        <EyeIcon open={showRegConfirmPassword} />
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-phone" className={labelClass}>
                    Teléfono
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                      <PhoneIcon />
                    </div>
                    <input
                      id="reg-phone"
                      type="tel"
                      value={registerData.phone}
                      onChange={(e) =>
                        setRegisterData({ ...registerData, phone: e.target.value })
                      }
                      placeholder="11 1234 5678"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-address" className={labelClass}>
                    Dirección
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </div>
                    <input
                      id="reg-address"
                      type="text"
                      value={registerData.address}
                      onChange={(e) =>
                        setRegisterData({
                          ...registerData,
                          address: e.target.value,
                        })
                      }
                      placeholder="Calle 123"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="reg-neighborhood" className={labelClass}>
                      Barrio
                    </label>
                    <input
                      id="reg-neighborhood"
                      type="text"
                      value={registerData.neighborhood}
                      onChange={(e) =>
                        setRegisterData({
                          ...registerData,
                          neighborhood: e.target.value,
                        })
                      }
                      placeholder="Centro"
                      className="w-full px-3.5 py-3.5 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-gray-50 focus:bg-white text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="reg-city" className={labelClass}>
                      Ciudad
                    </label>
                    <input
                      id="reg-city"
                      type="text"
                      value={registerData.city}
                      onChange={(e) =>
                        setRegisterData({ ...registerData, city: e.target.value })
                      }
                      placeholder="Buenos Aires"
                      className="w-full px-3.5 py-3.5 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-gray-50 focus:bg-white text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="reg-postal-code" className={labelClass}>
                      C. Postal
                    </label>
                    <input
                      id="reg-postal-code"
                      type="text"
                      value={registerData.postal_code}
                      onChange={(e) =>
                        setRegisterData({
                          ...registerData,
                          postal_code: e.target.value,
                        })
                      }
                      placeholder="1000"
                      className="w-full px-3.5 py-3.5 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-gray-50 focus:bg-white text-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-blue-700 to-blue-900 text-white py-3.5 rounded-xl font-semibold hover:from-blue-800 hover:to-blue-950 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg text-sm"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Registrando...
                    </span>
                  ) : (
                    "Crear Cuenta"
                  )}
                </button>
              </form>
            )}

            {/* Link to Admin/Client Login */}
            <div className="mt-6 pt-5 border-t border-gray-100">
              <p className="text-center text-xs text-gray-500">
                ¿Eres administrador o cliente?{" "}
                <Link
                  href="/auth/admin-login"
                  className="text-blue-600 hover:text-blue-700 font-semibold"
                >
                  Accede aquí
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
    </div>}>
      <LoginForm />
    </Suspense>
  );
}
