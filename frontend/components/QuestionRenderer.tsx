"use client";

import { useState, useEffect } from "react";
import type { Question, Answer } from "@/types";
import { QuestionType } from "@/types";

interface QuestionRendererProps {
  question: Question;
  onAnswer: (answer: Answer) => void;
  initialAnswer?: Answer;
}

export function QuestionRenderer({
  question,
  onAnswer,
  initialAnswer,
}: QuestionRendererProps) {
  const [answer, setAnswer] = useState<Answer>(
    initialAnswer || {
      question_id: question.id,
    }
  );

  useEffect(() => {
    if (initialAnswer) {
      setAnswer(initialAnswer);
    } else {
      // Reset answer when question changes
      setAnswer({ question_id: question.id });
    }
  }, [initialAnswer, question.id]);

  const handleChange = (updatedAnswer: Partial<Answer>) => {
    const newAnswer = { ...answer, ...updatedAnswer };
    console.log("QuestionRenderer - handleChange called");
    console.log("Updated answer:", updatedAnswer);
    console.log("New answer:", newAnswer);
    setAnswer(newAnswer);
    onAnswer(newAnswer);
  };

  // Renderizado según tipo de pregunta
  switch (question.question_type) {
    case QuestionType.SINGLE_CHOICE:
      return (
        <div className="space-y-3">
          {question.options.map((option) => (
            <label
              key={option.id}
              className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 transition"
            >
              <input
                type="radio"
                name={question.id}
                value={option.id}
                checked={answer.option_id === option.id}
                onChange={() => handleChange({ option_id: option.id })}
                className="w-5 h-5 text-blue-600"
              />
              <span className="ml-3 text-gray-800">{option.option_text}</span>
            </label>
          ))}
        </div>
      );

    case QuestionType.MULTIPLE_CHOICE:
      return (
        <div className="space-y-3">
          {question.options.map((option) => (
            <label
              key={option.id}
              className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 transition"
            >
              <input
                type="checkbox"
                value={option.id}
                className="w-5 h-5 text-blue-600 rounded"
              />
              <span className="ml-3 text-gray-800">{option.option_text}</span>
            </label>
          ))}
        </div>
      );

    case QuestionType.PERCENTAGE_DISTRIBUTION:
      return (
        <PercentageDistribution
          question={question}
          answer={answer}
          onChange={handleChange}
        />
      );

    case QuestionType.RATING:
      return (
        <div className="flex justify-center gap-4 py-8">
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              onClick={() => handleChange({ rating })}
              className={`text-5xl transition-all ${
                answer.rating && answer.rating >= rating
                  ? "text-yellow-400"
                  : "text-gray-300"
              } hover:text-yellow-300`}
            >
              ★
            </button>
          ))}
        </div>
      );

    case QuestionType.OPEN_TEXT:
      return (
        <textarea
          value={answer.answer_text || ""}
          onChange={(e) => handleChange({ answer_text: e.target.value })}
          className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition min-h-[120px]"
          placeholder="Escribe tu respuesta aquí..."
        />
      );

    default:
      return <div>Tipo de pregunta no soportado</div>;
  }
}

// Componente especializado para distribución porcentual
function PercentageDistribution({
  question,
  answer,
  onChange,
}: {
  question: Question;
  answer: Answer;
  onChange: (update: Partial<Answer>) => void;
}) {
  const [percentages, setPercentages] = useState<Record<string, number>>(
    answer.percentage_data || {}
  );

  useEffect(() => {
    onChange({ percentage_data: percentages });
  }, [percentages]);

  const total = Object.values(percentages).reduce((sum, val) => sum + val, 0);
  const remaining = 100 - total;

  const handlePercentageChange = (optionId: string, value: string) => {
    const numValue = parseFloat(value) || 0;

    // Calculate current total excluding this option
    const otherTotal = Object.entries(percentages)
      .filter(([id]) => id !== optionId)
      .reduce((sum, [, val]) => sum + val, 0);

    // Maximum this option can be is 100 - otherTotal
    const maxAllowed = 100 - otherTotal;

    const newPercentages = {
      ...percentages,
      [optionId]: Math.min(maxAllowed, Math.max(0, numValue)),
    };
    setPercentages(newPercentages);
  };

  return (
    <div className="space-y-6">
      {/* Sticky Total Header */}
      <div className="sticky top-0 z-10 -mx-8 px-8 py-4 bg-white border-b-2 border-gray-200 shadow-sm">
        <div className="flex justify-between items-center">
          <span className="text-lg font-semibold text-gray-700">TOTAL</span>
          <span
            className={`text-3xl font-bold ${
              Math.abs(remaining) < 0.01 ? "text-green-600" : "text-gray-600"
            }`}
          >
            {total.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Sliders */}
      {question.options.map((option) => (
        <div key={option.id} className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-gray-700">
              {option.option_text}
            </label>
            <span className="text-lg font-semibold text-blue-600">
              {percentages[option.id] || 0}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={percentages[option.id] || 0}
            onChange={(e) =>
              handlePercentageChange(option.id, e.target.value)
            }
            className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            style={{
              background: `linear-gradient(to right, #2563eb 0%, #2563eb ${
                percentages[option.id] || 0
              }%, #e5e7eb ${percentages[option.id] || 0}%, #e5e7eb 100%)`,
            }}
          />
        </div>
      ))}

      <div
        className={`mt-6 p-4 rounded-lg ${
          Math.abs(remaining) < 0.01
            ? "bg-green-50 border-2 border-green-400"
            : "bg-yellow-50 border-2 border-yellow-400"
        }`}
      >
        <p className="text-sm font-medium">
          {Math.abs(remaining) < 0.01 ? (
            <span className="text-green-700">✓ Distribución completa</span>
          ) : remaining > 0 ? (
            <span className="text-yellow-700">
              Faltan {remaining.toFixed(1)}% por distribuir
            </span>
          ) : (
            <span className="text-yellow-700">
              Excede por {Math.abs(remaining).toFixed(1)}%
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
