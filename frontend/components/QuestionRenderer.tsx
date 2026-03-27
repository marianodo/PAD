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
    case QuestionType.SINGLE_CHOICE: {
      const hasImages = question.options.some((opt) => opt.image_url);

      if (hasImages) {
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {question.options.map((option) => (
              <label
                key={option.id}
                onClick={() => handleChange({ option_id: option.id })}
                className={`relative rounded-2xl overflow-hidden cursor-pointer transition-all border-3 ${
                  answer.option_id === option.id
                    ? "border-[#2962FF] shadow-lg shadow-[#2962FF]/10 ring-2 ring-[#2962FF]/20"
                    : "border-gray-200 hover:border-[#2962FF] hover:shadow-md"
                }`}
              >
                {option.image_url && (
                  <div className="aspect-[4/3] overflow-hidden">
                    <img
                      src={option.image_url}
                      alt={option.option_text}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start gap-2">
                    <input
                      type="radio"
                      name={question.id}
                      value={option.id}
                      checked={answer.option_id === option.id}
                      onChange={() => handleChange({ option_id: option.id })}
                      className="w-4 h-4 text-[#2962FF] mt-1 shrink-0"
                    />
                    <div>
                      <span className="font-semibold text-gray-900">{option.option_text}</span>
                      {option.description && (
                        <p className="text-sm text-gray-500 mt-1">{option.description}</p>
                      )}
                    </div>
                  </div>
                </div>
                {answer.option_id === option.id && (
                  <div className="absolute top-3 right-3 bg-[#2962FF] text-white rounded-full w-6 h-6 flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </label>
            ))}
          </div>
        );
      }

      return (
        <div className="space-y-3">
          {question.options.map((option) => (
            <label
              key={option.id}
              className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-[#2962FF] transition"
            >
              <input
                type="radio"
                name={question.id}
                value={option.id}
                checked={answer.option_id === option.id}
                onChange={() => handleChange({ option_id: option.id })}
                className="w-5 h-5 text-[#2962FF]"
              />
              <div className="ml-3">
                <span className="text-gray-800">{option.option_text}</span>
                {option.description && (
                  <p className="text-xs text-gray-400 mt-0.5">{option.description}</p>
                )}
              </div>
            </label>
          ))}
        </div>
      );
    }

    case QuestionType.MULTIPLE_CHOICE:
      return (
        <div className="space-y-3">
          {question.options.map((option) => (
            <label
              key={option.id}
              className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-[#2962FF] transition"
            >
              <input
                type="checkbox"
                value={option.id}
                className="w-5 h-5 text-[#2962FF] rounded"
              />
              <div className="ml-3">
                <span className="text-gray-800">{option.option_text}</span>
                {option.description && (
                  <p className="text-xs text-gray-400 mt-0.5">{option.description}</p>
                )}
              </div>
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
          className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-[#2962FF] focus:ring-2 focus:ring-[#2962FF]/20 outline-none transition min-h-[120px]"
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
  const [otherText, setOtherText] = useState<string>(answer.answer_text || "");

  useEffect(() => {
    onChange({ percentage_data: percentages, answer_text: otherText || undefined });
  }, [percentages, otherText]);

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
            <div>
              <label className="text-sm font-medium text-gray-700">
                {option.option_text}
              </label>
              {option.description && (
                <p className="text-xs text-gray-400 mt-0.5">{option.description}</p>
              )}
            </div>
            <span className="text-lg font-semibold text-[#2962FF] shrink-0 ml-4">
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
              background: `linear-gradient(to right, #2962FF 0%, #2962FF ${
                percentages[option.id] || 0
              }%, #e5e7eb ${percentages[option.id] || 0}%, #e5e7eb 100%)`,
            }}
          />
        </div>
      ))}

      {/* Otros */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <label className="text-sm font-medium text-gray-700">OTROS</label>
            <p className="text-xs text-gray-400 mt-0.5">Especificá otra área de tu interés</p>
          </div>
          <span className="text-lg font-semibold text-[#2962FF] shrink-0 ml-4">
            {percentages["otros"] || 0}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={percentages["otros"] || 0}
          onChange={(e) => handlePercentageChange("otros", e.target.value)}
          className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
          style={{
            background: `linear-gradient(to right, #2962FF 0%, #2962FF ${
              percentages["otros"] || 0
            }%, #e5e7eb ${percentages["otros"] || 0}%, #e5e7eb 100%)`,
          }}
        />
        {(percentages["otros"] || 0) > 0 && (
          <input
            type="text"
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            placeholder="¿En qué área te gustaría invertir?"
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[#2962FF] focus:ring-2 focus:ring-[#2962FF]/20 outline-none transition"
          />
        )}
      </div>

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
