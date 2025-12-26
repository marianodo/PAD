"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSurveyStore } from "@/lib/store";
import { usersApi } from "@/lib/api";
import type { UserPoints } from "@/types";

export default function SuccessPage() {
  const router = useRouter();
  const { user, survey, reset } = useSurveyStore();
  const [points, setPoints] = useState<UserPoints | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }

    const loadPoints = async () => {
      try {
        const response = await usersApi.getPoints(user.id);
        setPoints(response.data);
      } catch (err) {
        console.error("Error loading points:", err);
      } finally {
        setLoading(false);
      }
    };

    loadPoints();
  }, [user, router]);

  const handleFinish = () => {
    reset();
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-8">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8 md:p-12 text-center">
        {/* Success Icon */}
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full">
            <svg
              className="w-12 h-12 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          ¡Gracias por Participar!
        </h1>

        <p className="text-lg text-gray-600 mb-8">
          Tu opinión es muy importante para mejorar la gestión municipal
        </p>

        {/* Points Card */}
        {points && (
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-8 mb-8 text-white">
            <p className="text-lg mb-2">Has ganado</p>
            <p className="text-6xl font-bold mb-2">{points.total_points}</p>
            <p className="text-lg">puntos</p>

            <div className="mt-6 pt-6 border-t border-blue-400">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-blue-200 text-sm">Puntos Disponibles</p>
                  <p className="text-2xl font-bold">{points.available_points}</p>
                </div>
                <div>
                  <p className="text-blue-200 text-sm">Puntos Canjeados</p>
                  <p className="text-2xl font-bold">{points.redeemed_points}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-blue-50 border-l-4 border-blue-400 p-6 mb-8 text-left">
          <h3 className="font-semibold text-blue-900 mb-2">
            ¿Qué pasa ahora?
          </h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                Recibirás reportes personalizados sobre los temas de tu interés
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                Podrás canjear tus puntos por beneficios municipales
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                Tu opinión será considerada en las decisiones de gestión
              </span>
            </li>
          </ul>
        </div>

        <button
          onClick={handleFinish}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-4 px-6 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          Finalizar
        </button>

        <p className="mt-6 text-sm text-gray-500">
          Podrás responder nuevamente en 30 días
        </p>
      </div>
    </div>
  );
}
