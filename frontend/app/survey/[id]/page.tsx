"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { surveysApi, authApi } from "@/lib/api";
import { useSurveyStore } from "@/lib/store";
import { QuestionRenderer } from "@/components/QuestionRenderer";
import type { Survey, Answer, User } from "@/types";

export default function QuestionsPage() {
  const router = useRouter();
  const params = useParams();
  const surveyId = params.id as string;

  const { survey, answers, addAnswer, setCurrentStep, setSurvey, setUser } =
    useSurveyStore();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem("access_token");
    if (!token) {
      // Save the survey ID to redirect back after login
      router.push(`/auth/login?redirect=/survey/${surveyId}`);
      return;
    }

    const loadData = async () => {
      try {
        // Load user info
        const userResponse = await authApi.me();
        setCurrentUser(userResponse.data);
        setUser(userResponse.data);

        // Load specific survey by ID
        const surveyResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/surveys/${surveyId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!surveyResponse.ok) {
          throw new Error("Encuesta no encontrada");
        }

        const data = await surveyResponse.json();
        setSurvey(data);
      } catch (err) {
        setError("Error al cargar los datos");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [surveyId, router, setSurvey, setUser]);

  if (loading || !survey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Cargando encuesta...</p>
        </div>
      </div>
    );
  }

  const currentQuestion = survey.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === survey.questions.length - 1;
  const currentAnswer = answers.find((a) => a.question_id === currentQuestion.id);

  const canProceed = () => {
    console.log("=== canProceed called ===");
    console.log("Question type:", currentQuestion.question_type);
    console.log("Is required:", currentQuestion.is_required);
    console.log("Current answer:", currentAnswer);

    if (!currentQuestion.is_required) return true;
    if (!currentAnswer) {
      console.log("No answer found, returning false");
      return false;
    }

    switch (currentQuestion.question_type) {
      case "single_choice":
      case "multiple_choice":
        console.log("Checking option_id:", currentAnswer.option_id);
        return !!currentAnswer.option_id;
      case "rating":
        return !!currentAnswer.rating;
      case "open_text":
        return !!currentAnswer.answer_text?.trim();
      case "percentage_distribution":
        if (!currentAnswer.percentage_data) {
          console.log("No percentage_data");
          return false;
        }
        const total = Object.values(currentAnswer.percentage_data).reduce(
          (sum, val) => sum + val,
          0
        );
        console.log("Percentage total:", total, "Valid:", Math.abs(total - 100) < 0.01);
        return Math.abs(total - 100) < 0.01;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (isLastQuestion) {
      handleSubmit();
    } else {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setCurrentStep(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setCurrentStep(currentQuestionIndex - 1);
    } else {
      router.push("/survey/register");
    }
  };

  const handleSubmit = async () => {
    if (!currentUser || !survey) return;

    setSubmitting(true);
    setError(null);

    try {
      // Verificar si puede responder
      const canRespondCheck = await surveysApi.canRespond(survey.id, currentUser.id);

      if (!canRespondCheck.data.can_respond) {
        setError(canRespondCheck.data.message);
        setSubmitting(false);
        return;
      }

      // Enviar respuestas
      await surveysApi.submitResponse({
        survey_id: survey.id,
        user_id: currentUser.id,
        answers: answers,
        completed: true,
      });

      router.push("/survey/success");
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "Error al enviar la encuesta"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const progress = ((currentQuestionIndex + 1) / survey.questions.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Pregunta {currentQuestionIndex + 1} de {survey.questions.length}</span>
            <span>{Math.round(progress)}% completado</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-blue-600 to-indigo-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <div className="mb-8">
            <div className="inline-block bg-blue-100 rounded-full px-4 py-2 mb-4">
              <span className="text-blue-800 font-semibold text-sm">
                Paso {currentQuestionIndex + 2} de {survey.questions.length + 1}
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              {currentQuestion.question_text}
            </h2>
            {currentQuestion.is_required && (
              <p className="text-sm text-gray-500">* Campo obligatorio</p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="mb-8">
            <QuestionRenderer
              question={currentQuestion}
              onAnswer={addAnswer}
              initialAnswer={currentAnswer}
            />
          </div>

          <div className="flex gap-4">
            <button
              onClick={handlePrevious}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition"
            >
              Anterior
            </button>
            <button
              onClick={handleNext}
              disabled={!canProceed() || submitting}
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting
                ? "Enviando..."
                : isLastQuestion
                ? "Finalizar"
                : "Siguiente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
