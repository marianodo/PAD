"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { API_URL } from "@/lib/config";

interface Answer {
  id: string;
  question_id: string;
  question_text: string;
  question_type: string;
  option_id?: string;
  option_text?: string;
  answer_text?: string;
  rating?: number;
  percentage_data?: Record<string, number>;
  created_at: string;
}

interface ResponseDetail {
  id: string;
  survey_id: string;
  survey_title: string;
  survey_description?: string;
  completed: boolean;
  points_earned: number;
  started_at: string;
  completed_at?: string;
  answers: Answer[];
}

export default function ResponseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const responseId = params.id as string;

  const [response, setResponse] = useState<ResponseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/auth/login");
      return;
    }

    const fetchResponseDetail = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/responses/my-responses/${responseId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!res.ok) {
          if (res.status === 401) {
            localStorage.removeItem("access_token");
            router.push("/auth/login");
            return;
          }
          throw new Error("Error al cargar el detalle");
        }

        const data = await res.json();
        setResponse(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchResponseDetail();
  }, [responseId, router]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-AR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Argentina/Buenos_Aires",
    });
  };

  const renderAnswer = (answer: Answer) => {
    switch (answer.question_type) {
      case "single_choice":
        return (
          <p className="text-gray-800">
            <span className="font-semibold">Respuesta:</span>{" "}
            {answer.option_text}
          </p>
        );

      case "rating":
        return (
          <div className="flex items-center gap-2">
            <span className="text-gray-700">Rating:</span>
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                className={`text-2xl ${
                  star <= (answer.rating || 0)
                    ? "text-yellow-400"
                    : "text-gray-300"
                }`}
              >
                ★
              </span>
            ))}
          </div>
        );

      case "open_text":
        return (
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-gray-800 whitespace-pre-wrap">
              {answer.answer_text}
            </p>
          </div>
        );

      case "percentage_distribution":
        return (
          <div className="space-y-2">
            {answer.percentage_data &&
              Object.entries(answer.percentage_data).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center">
                  <span className="text-gray-700">{key}:</span>
                  <span className="font-semibold text-blue-600">{value}%</span>
                </div>
              ))}
          </div>
        );

      default:
        return <p className="text-gray-600">Sin respuesta</p>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Cargando detalle...</p>
        </div>
      </div>
    );
  }

  if (error || !response) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-md bg-white rounded-lg shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Error</h1>
          <p className="text-gray-600 mb-6">{error || "Respuesta no encontrada"}</p>
          <Link
            href="/dashboard"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Volver al Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Volver al Dashboard
          </Link>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {response.survey_title}
          </h1>

          {response.survey_description && (
            <p className="text-gray-600 mb-4">{response.survey_description}</p>
          )}

          <div className="flex items-center gap-4 flex-wrap">
            <span
              className={`inline-block px-4 py-2 rounded-full text-sm font-semibold ${
                response.completed
                  ? "bg-green-100 text-green-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {response.completed ? "Completada" : "En progreso"}
            </span>
            <span className="text-blue-600 font-semibold text-lg">
              {response.points_earned} puntos ganados
            </span>
            <span className="text-gray-600 text-sm">
              {response.completed && response.completed_at
                ? `Completada el ${formatDate(response.completed_at)}`
                : `Iniciada el ${formatDate(response.started_at)}`}
            </span>
          </div>
        </div>

        {/* Answers */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Tus Respuestas
          </h2>

          {response.answers.length === 0 ? (
            <p className="text-gray-600 text-center py-8">
              No hay respuestas registradas
            </p>
          ) : (
            <div className="space-y-6">
              {response.answers.map((answer, index) => (
                <div
                  key={answer.id}
                  className="p-6 border-2 border-gray-200 rounded-lg"
                >
                  <div className="flex items-start gap-4">
                    <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        {answer.question_text}
                      </h3>
                      {renderAnswer(answer)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
