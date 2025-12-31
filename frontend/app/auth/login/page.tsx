"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";

  const [activeTab, setActiveTab] = useState<"login" | "register">("login");

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
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/login`,
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
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/register`,
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
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/login`,
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-12">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-block bg-gray-200 rounded-full px-6 py-2 mb-6">
            <span className="text-gray-700 font-medium text-sm">
              Portal Ciudadano
            </span>
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">Tú Decides</h1>
          <p className="text-lg text-gray-600">
            Accede a tu portal de participación ciudadana
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Bienvenido
            </h2>
            <p className="text-gray-600">
              Inicia sesión o crea una cuenta nueva
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mb-8">
            <button
              onClick={() => {
                setActiveTab("login");
                setError("");
              }}
              className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all ${
                activeTab === "login"
                  ? "bg-white border-2 border-gray-300 text-gray-900 shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              onClick={() => {
                setActiveTab("register");
                setError("");
              }}
              className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all ${
                activeTab === "register"
                  ? "bg-white border-2 border-gray-300 text-gray-900 shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Registrarse
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Login Form */}
          {activeTab === "login" && (
            <form onSubmit={handleLoginSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="cuil"
                  className="block text-sm font-semibold text-gray-900 mb-2"
                >
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
                  placeholder="20123456789"
                  required
                  maxLength={11}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
                />
                <p className="mt-1 text-xs text-gray-500">
                  11 dígitos sin guiones
                </p>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold text-gray-900 mb-2"
                >
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  value={loginData.password}
                  onChange={(e) =>
                    setLoginData({ ...loginData, password: e.target.value })
                  }
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-800 to-blue-900 text-white py-4 rounded-xl font-semibold hover:from-blue-900 hover:to-blue-950 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {isLoading ? "Ingresando..." : "Iniciar Sesión"}
              </button>
            </form>
          )}

          {/* Register Form */}
          {activeTab === "register" && (
            <form onSubmit={handleRegisterSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="reg-cuil"
                    className="block text-sm font-semibold text-gray-900 mb-2"
                  >
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    11 dígitos sin guiones
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="reg-name"
                    className="block text-sm font-semibold text-gray-900 mb-2"
                  >
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="reg-email"
                  className="block text-sm font-semibold text-gray-900 mb-2"
                >
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="reg-password"
                    className="block text-sm font-semibold text-gray-900 mb-2"
                  >
                    Contraseña <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="reg-password"
                    type="password"
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
                  />
                </div>

                <div>
                  <label
                    htmlFor="reg-confirm-password"
                    className="block text-sm font-semibold text-gray-900 mb-2"
                  >
                    Confirmar Contraseña <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="reg-confirm-password"
                    type="password"
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="reg-phone"
                  className="block text-sm font-semibold text-gray-900 mb-2"
                >
                  Teléfono
                </label>
                <input
                  id="reg-phone"
                  type="tel"
                  value={registerData.phone}
                  onChange={(e) =>
                    setRegisterData({ ...registerData, phone: e.target.value })
                  }
                  placeholder="11 1234 5678"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-address"
                  className="block text-sm font-semibold text-gray-900 mb-2"
                >
                  Dirección
                </label>
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="reg-neighborhood"
                    className="block text-sm font-semibold text-gray-900 mb-2"
                  >
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
                  />
                </div>

                <div>
                  <label
                    htmlFor="reg-city"
                    className="block text-sm font-semibold text-gray-900 mb-2"
                  >
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
                  />
                </div>

                <div>
                  <label
                    htmlFor="reg-postal-code"
                    className="block text-sm font-semibold text-gray-900 mb-2"
                  >
                    Código Postal
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-800 to-blue-900 text-white py-4 rounded-xl font-semibold hover:from-blue-900 hover:to-blue-950 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {isLoading ? "Registrando..." : "Crear Cuenta"}
              </button>
            </form>
          )}

          {/* Link to Admin/Client Login */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-center text-sm text-gray-600">
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
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Cargando...</div>}>
      <LoginForm />
    </Suspense>
  );
}
