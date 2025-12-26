"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { surveysApi } from "@/lib/api";
import type { Survey } from "@/types";

export default function Home() {
  const router = useRouter();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSurvey = async () => {
      try {
        const response = await surveysApi.getActive();
        setSurvey(response.data);
      } catch (err) {
        setError("No hay encuesta activa disponible");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadSurvey();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (error || !survey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-md bg-white rounded-lg shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            Lo sentimos
          </h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8 md:p-12">
        <div className="text-center mb-8">
          <div className="inline-block bg-blue-100 rounded-full px-4 py-2 mb-4">
            <span className="text-blue-800 font-semibold text-sm">
              Participación Ciudadana
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Tú Decides
          </h1>
          <p className="text-lg text-gray-600">
            Tu opinión es importante para la gestión municipal
          </p>
        </div>

        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 mb-8 text-white">
          <h2 className="text-2xl font-bold mb-2">{survey.title}</h2>
          {survey.description && (
            <p className="text-blue-100">{survey.description}</p>
          )}
        </div>

        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8">
          <div className="flex items-start">
            <div className="ml-3">
              <p className="text-sm font-medium text-yellow-800">
                ¡Gana puntos por participar!
              </p>
              <p className="mt-1 text-sm text-yellow-700">
                Completa la encuesta y obtén{" "}
                <strong>
                  {survey.questions.length * survey.points_per_question +
                    survey.bonus_points}{" "}
                  puntos
                </strong>{" "}
                que podrás canjear por beneficios.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => router.push("/survey/register")}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-4 px-6 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            Comenzar Encuesta
          </button>

          <p className="text-center text-sm text-gray-500">
            Paso 1 de {survey.questions.length + 1} •{" "}
            {Math.ceil((survey.questions.length + 1) * 0.5)} minutos aprox.
          </p>
        </div>
      </div>
    </div>
  );
}
