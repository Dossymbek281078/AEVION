"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiUrl } from "@/lib/apiBase";

type ResultType = "qstore" | "qlearn" | "qnews" | "qevents" | "qjobs" | "qright";

interface SearchResult {
  id: string;
  type: ResultType;
  title: string;
  description: string;
  url: string;
  metadata?: Record<string, unknown>;
  score: number;
}

interface SearchResponse {
  q: string;
  total: number;
  results: SearchResult[];
  byType: Partial<Record<ResultType, SearchResult[]>>;
}

/** Порядок задаёт и порядок фильтров, и порядок групп в выдаче. */
const SOURCES: { type: ResultType; label: string; hint: string; color: string }[] = [
  { type: "qstore", label: "Товары", hint: "QStore", color: "#059669" },
  { type: "qlearn", label: "Курсы", hint: "QLearn", color: "#7c3aed" },
  { type: "qnews", label: "Новости", hint: "QNews", color: "#0ea5e9" },
  { type: "qevents", label: "События", hint: "QEvents", color: "#d97706" },
  { type: "qjobs", label: "Вакансии", hint: "QJobs", color: "#dc2626" },
  { type: "qright", label: "Права", hint: "QRight", color: "#0d9488" },
];

const SOURCE_BY_TYPE = new Map(SOURCES.map((s) => [s.type, s]));

const MIN_QUERY = 2;
const MAX_QUERY = 100;

function formatMeta(r: SearchResult): string | null {
  const m = r.metadata ?? {};
  const parts: string[] = [];
  if (typeof m.price === "number" && typeof m.currency === "string") {
    parts.push(`${(m.price / 100).toFixed(2)} ${m.currency.toUpperCase()}`);
  }
  if (typeof m.level === "string") parts.push(String(m.level));
  if (typeof m.category === "string") parts.push(String(m.category));
  if (typeof m.source === "string") parts.push(String(m.source));
  if (typeof m.company === "string") parts.push(String(m.company));
  if (typeof m.location === "string") parts.push(String(m.location));
  if (typeof m.kind === "string") parts.push(String(m.kind));
  return parts.length ? parts.join(" · ") : null;
}

export default function SearchClient() {
  const router = useRouter();
  const params = useSearchParams();
  const initialQ = params.get("q") ?? "";

  const [input, setInput] = useState(initialQ);
  const [active, setActive] = useState<ResultType[]>([]);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const typesParam = useMemo(
    () => (active.length ? active.join(",") : SOURCES.map((s) => s.type).join(",")),
    [active],
  );

  const run = useCallback(
    async (q: string, types: string) => {
      const trimmed = q.trim();
      if (trimmed.length < MIN_QUERY) {
        abortRef.current?.abort();
        setData(null);
        setError(null);
        setLoading(false);
        return;
      }
      // Предыдущий запрос отменяем: иначе медленный ответ на короткий запрос
      // может прийти позже и затереть выдачу по более полному запросу.
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      setError(null);
      try {
        const url = apiUrl(
          `/api/search?q=${encodeURIComponent(trimmed.slice(0, MAX_QUERY))}&limit=10&types=${encodeURIComponent(types)}`,
        );
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error || `HTTP ${res.status}`);
        }
        const json = (await res.json()) as SearchResponse;
        if (ctrl.signal.aborted) return;
        setData(json);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setData(null);
        setError(
          (e as Error).message === "db_unavailable"
            ? "Поиск временно недоступен — база не отвечает. Попробуйте через минуту."
            : "Не удалось выполнить поиск. Проверьте связь и попробуйте ещё раз.",
        );
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    },
    [],
  );

  // Ввод с задержкой: не бомбим бэкенд на каждую букву (лимит 60 запросов/мин).
  useEffect(() => {
    const t = setTimeout(() => void run(input, typesParam), 250);
    return () => clearTimeout(t);
  }, [input, typesParam, run]);

  // Запрос живёт в адресе — ссылкой на выдачу можно поделиться.
  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = input.trim();
      const next = trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search";
      if (typeof window !== "undefined" && window.location.pathname + window.location.search !== next) {
        router.replace(next, { scroll: false });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [input, router]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const toggle = (t: ResultType) =>
    setActive((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const groups = useMemo(() => {
    if (!data) return [];
    return SOURCES.map((s) => ({ source: s, items: data.byType?.[s.type] ?? [] })).filter(
      (g) => g.items.length > 0,
    );
  }, [data]);

  const tooShort = input.trim().length > 0 && input.trim().length < MIN_QUERY;

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "28px 16px 64px" }}>
      <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.02em", color: "#0f172a", margin: "0 0 6px" }}>
        Поиск по AEVION
      </h1>
      <p style={{ color: "#475569", fontSize: 15, lineHeight: 1.5, margin: "0 0 18px" }}>
        Один запрос — товары, курсы, новости, события, вакансии и записи реестра прав сразу.
      </p>

      <div style={{ position: "relative" }}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setInput("");
          }}
          maxLength={MAX_QUERY}
          placeholder="Например: ai, здоровье, шахматы, contract"
          aria-label="Строка поиска по платформе AEVION"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "14px 44px 14px 16px",
            fontSize: 17,
            borderRadius: 12,
            border: "1px solid rgba(15,23,42,0.14)",
            background: "#fff",
            color: "#0f172a",
            outline: "none",
          }}
        />
        {input ? (
          <button
            type="button"
            onClick={() => {
              setInput("");
              inputRef.current?.focus();
            }}
            aria-label="Очистить запрос"
            style={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              border: "none",
              background: "transparent",
              fontSize: 20,
              lineHeight: 1,
              color: "#94a3b8",
              cursor: "pointer",
              padding: 8,
            }}
          >
            ×
          </button>
        ) : null}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "12px 0 4px" }}>
        {SOURCES.map((s) => {
          const on = active.includes(s.type);
          return (
            <button
              key={s.type}
              type="button"
              onClick={() => toggle(s.type)}
              aria-pressed={on}
              style={{
                padding: "6px 11px",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                border: `1px solid ${on ? s.color : "rgba(15,23,42,0.14)"}`,
                background: on ? s.color : "#fff",
                color: on ? "#fff" : "#334155",
              }}
            >
              {s.label}
            </button>
          );
        })}
        {active.length ? (
          <button
            type="button"
            onClick={() => setActive([])}
            style={{
              padding: "6px 11px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              border: "1px dashed rgba(15,23,42,0.2)",
              background: "transparent",
              color: "#64748b",
            }}
          >
            Показать всё
          </button>
        ) : null}
      </div>

      <div style={{ minHeight: 22, margin: "10px 0 6px", fontSize: 13, color: "#64748b" }}>
        {loading
          ? "Ищем…"
          : tooShort
            ? `Введите минимум ${MIN_QUERY} символа`
            : data
              ? data.total > 0
                ? `Найдено: ${data.total}`
                : "Ничего не нашлось — попробуйте другое слово"
              : ""}
      </div>

      {error ? (
        <div
          role="alert"
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            background: "rgba(220,38,38,0.06)",
            border: "1px solid rgba(220,38,38,0.25)",
            color: "#991b1b",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      ) : null}

      {groups.map((g) => (
        <section key={g.source.type} style={{ marginTop: 22 }}>
          <h2
            style={{
              fontSize: 13,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: g.source.color,
              margin: "0 0 10px",
            }}
          >
            {g.source.label}
            <span style={{ color: "#94a3b8", fontWeight: 600, marginLeft: 8, textTransform: "none", letterSpacing: 0 }}>
              {g.source.hint} · {g.items.length}
            </span>
          </h2>

          <div style={{ display: "grid", gap: 10 }}>
            {g.items.map((r) => {
              const meta = formatMeta(r);
              return (
                <Link
                  key={`${r.type}:${r.id}`}
                  href={r.url}
                  style={{
                    display: "block",
                    padding: "13px 15px",
                    borderRadius: 12,
                    border: "1px solid rgba(15,23,42,0.08)",
                    background: "#fff",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a", lineHeight: 1.35 }}>{r.title}</div>
                  {r.description ? (
                    <div style={{ marginTop: 5, fontSize: 14, color: "#475569", lineHeight: 1.5 }}>{r.description}</div>
                  ) : null}
                  {meta ? (
                    <div style={{ marginTop: 7, fontSize: 12.5, color: "#64748b", fontWeight: 600 }}>{meta}</div>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      {!input.trim() ? (
        <div style={{ marginTop: 26, fontSize: 14, color: "#475569", lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>Где ищем</div>
          {SOURCES.map((s) => (
            <div key={s.type}>
              <span style={{ color: s.color, fontWeight: 700 }}>{s.label}</span>
              <span style={{ color: "#94a3b8" }}> — {SOURCE_BY_TYPE.get(s.type)?.hint}</span>
            </div>
          ))}
        </div>
      ) : null}
    </main>
  );
}
