"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChartDataItem {
  label: string;
  value: number;
  color?: string;
}

interface ChartInfo {
  type: "bar" | "pie";
  title: string;
  data: ChartDataItem[];
}

interface Message {
  role: "user" | "assistant";
  content: string;
  charts?: ChartInfo[];
}

interface ChatBotProps {
  surveyId: string;
}

const CHART_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"];

export default function ChatBot({ surveyId }: ChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    try {
      const token = localStorage.getItem("access_token");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/surveys/${surveyId}/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: userMessage.content,
            history: messages,
          }),
        }
      );

      if (!response.ok) throw new Error("Error al enviar mensaje");

      const data = await response.json();
      const assistantMsg: Message = {
        role: "assistant",
        content: data.response,
        charts: data.charts?.length > 0 ? data.charts : undefined,
      };
      setMessages([...updatedMessages, assistantMsg]);
      if (data.charts?.length > 0) {
        setIsExpanded(true);
      }
    } catch {
      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content:
            "Lo siento, hubo un error al procesar tu pregunta. Intenta de nuevo.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const renderChatBarChart = (chart: ChartInfo) => {
    const maxValue = Math.max(...chart.data.map((d) => d.value), 1);
    return (
      <div className="mt-3 bg-white/10 rounded-xl p-3 border border-white/10">
        <h4 className="text-xs font-bold text-white/80 mb-2">{chart.title}</h4>
        <div className="space-y-2">
          {chart.data.map((item, index) => {
            const barWidth = (item.value / maxValue) * 100;
            const color = item.color || CHART_COLORS[index % CHART_COLORS.length];
            return (
              <div key={index}>
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-xs text-white/60 truncate mr-2">{item.label}</span>
                  <span className="text-xs font-semibold text-white/80 shrink-0">{item.value}</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{ width: `${barWidth}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderChatPieChart = (chart: ChartInfo) => {
    const total = chart.data.reduce((sum, d) => sum + d.value, 0);
    if (total === 0) return null;

    const size = 140;
    const center = size / 2;
    const radius = 55;

    let cumPct = 0;
    const segments = chart.data.map((item, index) => {
      const pct = (item.value / total) * 100;
      const startAngle = (cumPct / 100) * 360;
      cumPct += pct;
      const endAngle = (cumPct / 100) * 360;
      return { ...item, pct, startAngle, endAngle, color: item.color || CHART_COLORS[index % CHART_COLORS.length] };
    });

    const toXY = (angle: number) => {
      const rad = ((angle - 90) * Math.PI) / 180;
      return { x: center + radius * Math.cos(rad), y: center + radius * Math.sin(rad) };
    };

    return (
      <div className="mt-3 bg-white/10 rounded-xl p-3 border border-white/10">
        <h4 className="text-xs font-bold text-white/80 mb-2">{chart.title}</h4>
        <div className="flex items-center gap-3">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
            {segments.map((seg, i) => {
              if (seg.endAngle - seg.startAngle >= 359.99) {
                return <circle key={i} cx={center} cy={center} r={radius} fill={seg.color} />;
              }
              const s = toXY(seg.startAngle);
              const e = toXY(seg.endAngle);
              const large = seg.endAngle - seg.startAngle > 180 ? 1 : 0;
              const d = `M ${center} ${center} L ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y} Z`;
              return <path key={i} d={d} fill={seg.color} />;
            })}
          </svg>
          <div className="flex flex-col gap-1 min-w-0">
            {segments.map((seg, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: seg.color }} />
                <span className="text-xs text-white/60 truncate">{seg.label} ({seg.pct.toFixed(1)}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderChart = (chart: ChartInfo) => {
    if (chart.type === "bar") return renderChatBarChart(chart);
    if (chart.type === "pie") return renderChatPieChart(chart);
    return null;
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-[1001] bg-[#2962FF] hover:bg-[#1a4fd4] text-white rounded-full w-14 h-14 shadow-lg flex items-center justify-center transition-all hover:scale-105 print-hide"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      </button>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 z-[1001] bg-[#1a1a2e] rounded-2xl shadow-2xl border border-white/10 flex flex-col overflow-hidden print-hide transition-all duration-300 ease-in-out ${
      isExpanded
        ? "w-[calc(100vw-2rem)] sm:w-[600px] h-[700px]"
        : "w-[calc(100vw-2rem)] sm:w-96 h-[500px]"
    }`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2962FF] to-[#1a4fd4] px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">
              Asistente de Consulta
            </h3>
            <p className="text-white/70 text-xs">Powered by Claude AI</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-white/80 hover:text-white transition"
            title={isExpanded ? "Reducir" : "Expandir"}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isExpanded ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9L4 4m0 0v5m0-5h5m6 6l5 5m0 0v-5m0 5h-5" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
              )}
            </svg>
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="text-white/80 hover:text-white transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-[#2962FF]/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-6 h-6 text-[#2962FF]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-white/60 text-sm mb-3">
              Preguntame sobre los resultados de esta consulta
            </p>
            <div className="space-y-2">
              {[
                "Cual es el barrio con mas participacion?",
                "Como votaron las mujeres?",
                "Que opinan los jovenes de 18 a 30?",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setInput(q);
                    setTimeout(() => inputRef.current?.focus(), 0);
                  }}
                  className="block w-full text-left text-xs text-[#2962FF] bg-[#2962FF]/5 hover:bg-[#2962FF]/10 rounded-lg px-3 py-2 transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`${
                isExpanded && msg.charts?.length ? "max-w-[95%]" : "max-w-[80%]"
              } rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === "user"
                  ? "bg-[#2962FF] text-white rounded-br-md whitespace-pre-wrap"
                  : "bg-white/10 text-white/90 rounded-bl-md"
              }`}
            >
              {msg.role === "user" ? (
                msg.content
              ) : (
                <>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h3: ({ children }) => <h3 className="font-bold text-sm mt-2 mb-1">{children}</h3>,
                      h4: ({ children }) => <h4 className="font-bold text-sm mt-1.5 mb-0.5">{children}</h4>,
                      strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                      em: ({ children }) => <em className="italic">{children}</em>,
                      ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 my-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 my-1">{children}</ol>,
                      li: ({ children }) => <li className="text-sm">{children}</li>,
                      p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                      table: ({ children }) => <div className="overflow-x-auto my-2"><table className="text-xs border-collapse w-full">{children}</table></div>,
                      thead: ({ children }) => <thead className="bg-white/10">{children}</thead>,
                      th: ({ children }) => <th className="border border-white/20 px-2 py-1 text-left font-semibold">{children}</th>,
                      td: ({ children }) => <td className="border border-white/20 px-2 py-1">{children}</td>,
                      tr: ({ children }) => <tr className="even:bg-white/5">{children}</tr>,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                  {msg.charts?.map((chart, ci) => (
                    <div key={ci}>{renderChart(chart)}</div>
                  ))}
                </>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/10 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce [animation-delay:0ms]" />
                <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce [animation-delay:150ms]" />
                <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-white/10 p-3 flex-shrink-0">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu pregunta..."
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 border border-white/20 bg-white/5 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2962FF] focus:border-transparent disabled:opacity-50 placeholder:text-white/40"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="bg-[#2962FF] hover:bg-[#1a4fd4] disabled:opacity-50 disabled:hover:bg-[#2962FF] text-white rounded-xl px-4 py-2.5 transition flex-shrink-0"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
