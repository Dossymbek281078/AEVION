"use client";

import React, { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

/**
 * Тест к уроку: вопросы, ответ и разбор.
 *
 * Три ручки модуля жили без единого вызывающего: автор не мог задать вопрос,
 * учащийся не мог на него ответить. На бэкенде они заработали 23.08.2026 —
 * до того вопросы хранились в памяти процесса и исчезали при выкатке.
 *
 * Правильный ответ приходит с сервера ТОЛЬКО автору курса; учащемуся его в
 * ответе нет вовсе, поэтому подсмотреть его на экране нельзя даже теоретически.
 */

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  /** Приходит только автору. У учащегося поля нет — это не «ноль», а отсутствие. */
  correctIndex?: number;
  explanation?: string | null;
}

interface Verdict {
  correct: boolean;
  correctIndex: number;
  explanation?: string;
}

const box: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 16,
  marginTop: 20,
  background: "#fff",
};

const noticeStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 8,
  background: "#fef3c7",
  border: "1px solid #fde68a",
  color: "#92400e",
  fontSize: 13,
  marginBottom: 12,
};

async function readJson(res: Response): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    data = {};
  }
  return { ok: res.ok, data };
}

function errorText(data: Record<string, unknown>, fallback: string): string {
  const w = typeof data.warning === "string" ? data.warning : null;
  const e = typeof data.error === "string" ? data.error : null;
  return w ?? e ?? fallback;
}

export default function LessonQuiz({
  courseId,
  lessonId,
  token,
  isAuthor,
}: {
  courseId: string;
  lessonId: string;
  token: string | null;
  isAuthor: boolean;
}) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [chosen, setChosen] = useState<Record<string, number>>({});
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [q, setQ] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [correct, setCorrect] = useState(0);
  const [authorNotice, setAuthorNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(apiUrl(`/api/qlearn/courses/${courseId}/lessons/${lessonId}/quiz`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const { ok, data } = await readJson(res);
      if (!ok) {
        // Пустой тест читается как «вопросов нет» — это не то же самое, что
        // «хранилище не ответило», и путать их нельзя.
        setLoadError(errorText(data, "Тест не загрузился. Попробуйте позже."));
        return;
      }
      setQuestions(Array.isArray(data.questions) ? (data.questions as QuizQuestion[]) : []);
    } catch {
      setLoadError("Сеть недоступна. Тест не загрузился.");
    } finally {
      setLoading(false);
    }
  }, [courseId, lessonId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const answer = async (questionId: string) => {
    const answerIndex = chosen[questionId];
    if (typeof answerIndex !== "number") {
      setNotice("Выберите вариант.");
      return;
    }
    if (!token) {
      setNotice("Войдите, чтобы ответить.");
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(
        apiUrl(`/api/qlearn/courses/${courseId}/lessons/${lessonId}/quiz/submit`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ questionId, answerIndex }),
        },
      );
      const { ok, data } = await readJson(res);
      if (!ok) {
        // Разбор НЕ показываем: иначе провал проверки выглядит как проверка.
        setNotice(errorText(data, "Ответ не засчитан."));
        return;
      }
      setVerdicts((prev) => ({ ...prev, [questionId]: data as unknown as Verdict }));
    } catch {
      setNotice("Сеть недоступна. Ответ не засчитан.");
    } finally {
      setBusy(false);
    }
  };

  const addQuestion = async () => {
    if (!token || !q.trim()) {
      setAuthorNotice("Вопрос обязателен.");
      return;
    }
    const clean = options.map((o) => o.trim()).filter(Boolean);
    if (clean.length < 2) {
      setAuthorNotice("Нужно хотя бы два варианта ответа.");
      return;
    }
    if (correct >= clean.length) {
      setAuthorNotice("Правильный вариант указывает на пустую строку.");
      return;
    }
    setBusy(true);
    setAuthorNotice(null);
    try {
      const res = await fetch(
        apiUrl(`/api/qlearn/me/courses/${courseId}/lessons/${lessonId}/quiz`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ question: q.trim(), options: clean, correctIndex: correct }),
        },
      );
      const { ok, data } = await readJson(res);
      if (!ok) {
        // Список не трогаем: вопрос, нарисованный до ответа сервера, исчезнет
        // при следующей загрузке.
        setAuthorNotice(errorText(data, "Вопрос не сохранён."));
        return;
      }
      setQ("");
      setOptions(["", ""]);
      setCorrect(0);
      await load();
    } catch {
      setAuthorNotice("Сеть недоступна. Вопрос не сохранён.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div style={{ ...box, color: "#64748b", fontSize: 13 }}>Загружаем тест…</div>;
  }

  if (loadError) {
    return (
      <div style={box}>
        <div style={noticeStyle}>{loadError}</div>
        <button
          onClick={() => void load()}
          style={{
            padding: "6px 12px", borderRadius: 8, border: "1px solid #e2e8f0",
            background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer",
          }}
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  if (questions.length === 0 && !isAuthor) return null;

  return (
    <div style={box}>
      <h4 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: "0 0 12px" }}>
        Проверьте себя
      </h4>

      {notice && <div style={noticeStyle}>{notice}</div>}

      {questions.length === 0 ? (
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
          К уроку пока нет вопросов.
        </div>
      ) : (
        questions.map((item) => {
          const verdict = verdicts[item.id];
          return (
            <div key={item.id} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 8 }}>
                {item.question}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {item.options.map((opt, i) => (
                  <label
                    key={i}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      fontSize: 14, color: "#334155", cursor: verdict ? "default" : "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name={`q-${item.id}`}
                      checked={chosen[item.id] === i}
                      disabled={Boolean(verdict)}
                      onChange={() => setChosen((p) => ({ ...p, [item.id]: i }))}
                    />
                    <span>{opt}</span>
                    {verdict && verdict.correctIndex === i && (
                      <span style={{ color: "#0d9488", fontWeight: 700, fontSize: 12 }}>
                        верный
                      </span>
                    )}
                  </label>
                ))}
              </div>
              {verdict ? (
                <div
                  style={{
                    marginTop: 8, fontSize: 13, fontWeight: 700,
                    color: verdict.correct ? "#0f766e" : "#b45309",
                  }}
                >
                  {verdict.correct ? "Верно" : "Пока нет"}
                  {verdict.explanation && (
                    <div style={{ fontWeight: 400, color: "#475569", marginTop: 4 }}>
                      {verdict.explanation}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => void answer(item.id)}
                  disabled={busy}
                  style={{
                    marginTop: 8, padding: "6px 14px", borderRadius: 8, border: "none",
                    background: "#0d9488", color: "#fff", fontWeight: 700, fontSize: 13,
                    cursor: busy ? "default" : "pointer", opacity: busy ? 0.5 : 1,
                  }}
                >
                  Ответить
                </button>
              )}
            </div>
          );
        })
      )}

      {isAuthor && (
        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 14, marginTop: 6 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 8 }}>
            Добавить вопрос
          </div>
          {authorNotice && <div style={noticeStyle}>{authorNotice}</div>}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Вопрос"
            aria-label="Вопрос"
            style={{
              width: "100%", padding: "8px 12px", borderRadius: 8,
              border: "1px solid #e2e8f0", fontSize: 14, marginBottom: 8,
            }}
          />
          {options.map((opt, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <input
                type="radio"
                name="correct-option"
                checked={correct === i}
                onChange={() => setCorrect(i)}
                aria-label={`Вариант ${i + 1} правильный`}
              />
              <input
                value={opt}
                onChange={(e) =>
                  setOptions((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
                }
                placeholder={`Вариант ${i + 1}`}
                aria-label={`Вариант ${i + 1}`}
                style={{
                  flex: 1, padding: "7px 10px", borderRadius: 8,
                  border: "1px solid #e2e8f0", fontSize: 14,
                }}
              />
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
            <button
              onClick={() => setOptions((p) => [...p, ""])}
              style={{
                padding: "6px 12px", borderRadius: 8, border: "1px solid #e2e8f0",
                background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer",
              }}
            >
              Ещё вариант
            </button>
            <button
              onClick={() => void addQuestion()}
              disabled={busy || !q.trim()}
              style={{
                padding: "6px 14px", borderRadius: 8, border: "none",
                background: "linear-gradient(135deg, #0d9488 0%, #7c3aed 100%)",
                color: "#fff", fontWeight: 700, fontSize: 13,
                cursor: busy || !q.trim() ? "default" : "pointer",
                opacity: busy || !q.trim() ? 0.5 : 1,
              }}
            >
              Сохранить вопрос
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
