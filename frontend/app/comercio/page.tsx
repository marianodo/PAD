"use client";

import { useCallback, useEffect, useState } from "react";
import { MERCHANT_TOKEN_KEY, merchantApi } from "@/lib/api";
import type { CouponValidation, Merchant } from "@/types";

type Entity = { id: string; name: string };

function errorMessage(err: any, fallback: string) {
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (detail?.message) return detail.message;
  return fallback;
}

export default function ComercioPage() {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadMe = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(MERCHANT_TOKEN_KEY)) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await merchantApi.me();
      setMerchant(res.data);
    } catch {
      localStorage.removeItem(MERCHANT_TOKEN_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const handleLogout = () => {
    localStorage.removeItem(MERCHANT_TOKEN_KEY);
    setMerchant(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/80">
        <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-[#2962FF] border-t-transparent" />
      </div>
    );
  }

  if (!merchant) {
    return <AuthPanel onAuthenticated={loadMe} />;
  }

  return (
    <div className="min-h-screen bg-gray-50/80">
      <header className="bg-white border-b">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{merchant.name}</p>
            <p className="text-xs text-gray-500 truncate">{merchant.client_name}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-700 shrink-0"
          >
            Salir
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {merchant.status === "approved" ? (
          <Validator />
        ) : (
          <AccountNotReady status={merchant.status} />
        )}
      </main>
    </div>
  );
}

/** Alta y login del comercio. */
function AuthPanel({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [entities, setEntities] = useState<Entity[]>([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);

  const [login, setLogin] = useState({ email: "", password: "" });
  const [signup, setSignup] = useState({
    client_id: "",
    name: "",
    email: "",
    password: "",
    cuit: "",
  });

  useEffect(() => {
    merchantApi
      .getEntities()
      .then((res) => setEntities(res.data))
      .catch(() => setError("No pudimos cargar la lista de municipios."));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const res = await merchantApi.login(login.email, login.password);
      localStorage.setItem(MERCHANT_TOKEN_KEY, res.data.access_token);
      onAuthenticated();
    } catch (err) {
      setError(errorMessage(err, "No pudimos iniciar sesión."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await merchantApi.register({
        client_id: signup.client_id,
        email: signup.email,
        password: signup.password,
        name: signup.name,
        cuit: signup.cuit || undefined,
      });
      setRegistered(true);
    } catch (err) {
      setError(errorMessage(err, "No pudimos crear la cuenta."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2962FF]/30 focus:border-[#2962FF]";

  if (registered) {
    return (
      <div className="min-h-screen bg-gray-50/80 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-full bg-[#00C853]/10 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-[#00A344]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="mt-4 text-xl font-bold text-gray-900">Solicitud enviada</h1>
          <p className="mt-2 text-sm text-gray-600">
            Vamos a verificar con el municipio que tu comercio está adherido al plan.
            Cuando te habilitemos vas a poder validar cupones.
          </p>
          <button
            onClick={() => {
              setRegistered(false);
              setTab("login");
            }}
            className="mt-5 w-full px-4 py-2.5 rounded-xl bg-[#2962FF] text-white font-medium hover:bg-[#1a4fd4]"
          >
            Ir al inicio de sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border p-6 sm:p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <p className="text-[10px] font-medium tracking-widest uppercase text-gray-400">
            PAD · Comercios adheridos
          </p>
          <h1 className="mt-1 text-xl font-bold text-gray-900">Validar cupones</h1>
        </div>

        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6">
          {(["login", "register"] as const).map((option) => (
            <button
              key={option}
              onClick={() => {
                setTab(option);
                setError("");
              }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                tab === option ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}
            >
              {option === "login" ? "Ingresar" : "Crear cuenta"}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
            {error}
          </div>
        )}

        {tab === "login" ? (
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="email"
              required
              placeholder="Email"
              className={inputClass}
              value={login.email}
              onChange={(e) => setLogin({ ...login, email: e.target.value })}
            />
            <input
              type="password"
              required
              placeholder="Contraseña"
              className={inputClass}
              value={login.password}
              onChange={(e) => setLogin({ ...login, password: e.target.value })}
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-4 py-2.5 rounded-xl bg-[#2962FF] text-white font-medium hover:bg-[#1a4fd4] disabled:opacity-50"
            >
              {isSubmitting ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-3">
            <select
              required
              className={inputClass}
              value={signup.client_id}
              onChange={(e) => setSignup({ ...signup, client_id: e.target.value })}
            >
              <option value="">Elegí tu municipio…</option>
              {entities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
            </select>
            <input
              required
              placeholder="Nombre del comercio"
              className={inputClass}
              value={signup.name}
              onChange={(e) => setSignup({ ...signup, name: e.target.value })}
            />
            <input
              placeholder="CUIT (opcional, 11 dígitos)"
              className={inputClass}
              value={signup.cuit}
              onChange={(e) => setSignup({ ...signup, cuit: e.target.value })}
            />
            <input
              type="email"
              required
              placeholder="Email"
              className={inputClass}
              value={signup.email}
              onChange={(e) => setSignup({ ...signup, email: e.target.value })}
            />
            <input
              type="password"
              required
              minLength={8}
              placeholder="Contraseña (mínimo 8 caracteres)"
              className={inputClass}
              value={signup.password}
              onChange={(e) => setSignup({ ...signup, password: e.target.value })}
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-4 py-2.5 rounded-xl bg-[#2962FF] text-white font-medium hover:bg-[#1a4fd4] disabled:opacity-50"
            >
              {isSubmitting ? "Enviando..." : "Crear cuenta"}
            </button>
            <p className="text-xs text-gray-500 text-center">
              La cuenta queda pendiente hasta que verifiquemos con el municipio que
              tu comercio está adherido.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

function AccountNotReady({ status }: { status: string }) {
  const rejected = status === "rejected";

  return (
    <div className="bg-white rounded-2xl border p-8 text-center">
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${
          rejected ? "bg-red-50" : "bg-amber-50"
        }`}
      >
        <svg
          className={`w-6 h-6 ${rejected ? "text-red-600" : "text-amber-600"}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={rejected ? "M6 18L18 6M6 6l12 12" : "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"}
          />
        </svg>
      </div>
      <h2 className="mt-4 text-lg font-bold text-gray-900">
        {rejected ? "Solicitud rechazada" : "Cuenta en revisión"}
      </h2>
      <p className="mt-2 text-sm text-gray-600 max-w-sm mx-auto">
        {rejected
          ? "No pudimos confirmar que tu comercio esté adherido al plan. Si creés que es un error, contactate con tu municipio."
          : "Todavía no podés consumir cupones. Estamos verificando con el municipio que tu comercio esté adherido al plan."}
      </p>
    </div>
  );
}

/** Validador de mostrador: se tipea el código, se verifica y se consume. */
function Validator() {
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [result, setResult] = useState<CouponValidation | null>(null);
  const [error, setError] = useState("");
  const [redeemed, setRedeemed] = useState<{ discount: number } | null>(null);

  const reset = () => {
    setCode("");
    setResult(null);
    setError("");
    setRedeemed(null);
  };

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setRedeemed(null);
    setChecking(true);
    try {
      const res = await merchantApi.validateCoupon(code.trim());
      setResult(res.data);
    } catch (err) {
      setError(errorMessage(err, "No pudimos verificar el cupón."));
    } finally {
      setChecking(false);
    }
  };

  const handleRedeem = async () => {
    if (!result) return;
    setRedeeming(true);
    setError("");
    try {
      const res = await merchantApi.redeemCoupon(result.code);
      setRedeemed({ discount: Number(res.data.discount_pct) });
      setResult(null);
    } catch (err) {
      setError(errorMessage(err, "No pudimos consumir el cupón."));
      setResult(null);
    } finally {
      setRedeeming(false);
    }
  };

  if (redeemed) {
    return (
      <div className="bg-white rounded-2xl border-2 border-[#00C853] p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-[#00C853]/10 flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-[#00A344]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="mt-4 text-2xl font-bold text-gray-900">Cupón consumido</h2>
        <p className="mt-1 text-gray-600">
          Aplicá <strong className="text-gray-900">{redeemed.discount}% de descuento</strong> en
          la compra.
        </p>
        <button
          onClick={reset}
          className="mt-6 w-full px-4 py-3 rounded-xl bg-[#2962FF] text-white font-medium hover:bg-[#1a4fd4]"
        >
          Validar otro cupón
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border p-6">
        <h2 className="font-semibold text-gray-900">Validar un cupón</h2>
        <p className="text-sm text-gray-500 mt-1">
          Pedile al cliente el código de 6 caracteres.
        </p>

        <form onSubmit={handleValidate} className="mt-4 space-y-3">
          <input
            required
            autoFocus
            maxLength={6}
            placeholder="A1B2C3"
            value={code}
            onChange={(e) =>
              // Solo los caracteres que puede tener un código: evita que un dedo
              // torcido mande una barra y reciba un error que no explica nada.
              setCode(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ""))
            }
            className="w-full px-4 py-4 rounded-xl border-2 border-gray-200 text-center text-3xl font-mono font-bold tracking-[0.3em] uppercase text-gray-900 focus:outline-none focus:border-[#2962FF]"
          />
          <button
            type="submit"
            disabled={checking || code.trim().length === 0}
            className="w-full px-4 py-3 rounded-xl bg-[#2962FF] text-white font-medium hover:bg-[#1a4fd4] disabled:opacity-50"
          >
            {checking ? "Verificando..." : "Verificar"}
          </button>
        </form>
      </div>

      {error && (
        <div className="bg-white rounded-2xl border-2 border-red-200 p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="mt-3 font-semibold text-gray-900">{error}</p>
          <button onClick={reset} className="mt-4 text-sm text-[#2962FF] hover:underline">
            Probar otro código
          </button>
        </div>
      )}

      {result && (
        <div className="bg-white rounded-2xl border-2 border-[#00C853] p-6">
          <div className="text-center">
            <p className="text-xs font-medium tracking-widest uppercase text-[#00A344]">
              Cupón válido
            </p>
            <p className="mt-2 text-5xl font-bold text-gray-900">
              {Number(result.discount_pct)}%
            </p>
            <p className="text-gray-500 text-sm mt-1">de descuento</p>
          </div>

          <div className="mt-5 pt-4 border-t text-sm text-gray-600 space-y-1">
            <p className="flex justify-between">
              <span>Código</span>
              <span className="font-mono font-semibold text-gray-900">{result.code}</span>
            </p>
            <p className="flex justify-between">
              <span>Vence</span>
              <span className="text-gray-900">
                {new Date(result.expires_at).toLocaleDateString("es-AR")}
              </span>
            </p>
          </div>

          <button
            onClick={handleRedeem}
            disabled={redeeming}
            className="mt-5 w-full px-4 py-3.5 rounded-xl bg-[#00C853] text-white font-semibold hover:bg-[#00A344] disabled:opacity-50"
          >
            {redeeming ? "Consumiendo..." : "Consumir cupón"}
          </button>
          <p className="mt-2 text-xs text-gray-400 text-center">
            Una vez consumido, el cupón no se puede volver a usar.
          </p>
        </div>
      )}
    </div>
  );
}
