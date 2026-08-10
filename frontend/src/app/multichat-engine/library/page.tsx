"use client";

// Библиотека бесед мультичата.
//
// Страница переведена на светлый газетный эталон AEVION 2026-08-10: до этого
// она оставалась тёмной (slate-950) и рядом с «Консилиумом» читалась как
// кусок другого продукта. Цвета — только через токены ./theme, сырых значений
// в файле нет: контраст проверяется тестом scripts/multichat-contrast.test.mjs,
// а литерал проверка не видит.

import { apiUrl } from "@/lib/apiBase";

import { useEffect, useState } from "react";
import Link from "next/link";
import { T } from "../theme";

interface Conversation {
  id: string;
  title: string;
  shareToken?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Usage {
  conversationId: string;
  calls: number;
  tokens: { input: number; output: number; total: number };
  costUsd: number;
  /** Вызовы, для которых цена неизвестна (бесплатный флот, локальная модель). */
  unpricedCalls?: number;
}

// Кнопки строки беседы — четыре роли, одна форма. Отдельными функциями, а не
// копиями объекта в JSX: пять одинаковых литералов подряд разъезжаются на
// первой же правке отступов.
const rowBtnBase = {
  borderRadius: 8,
  padding: "5px 10px",
  fontSize: 13,
  fontFamily: "inherit",
} as const;

function secondaryBtn(busy: boolean) {
  return {
    ...rowBtnBase,
    background: "transparent",
    color: busy ? T.textFaded : T.textDim,
    border: `1px solid ${T.lineSoft}`,
    cursor: busy ? "default" : "pointer",
  };
}

function accentBtn(busy: boolean) {
  return {
    ...rowBtnBase,
    background: busy ? T.btnDisabledBg : T.btnAccentBg,
    color: busy ? T.textMute : T.onAccentDeep,
    border: "none",
    fontWeight: 600,
    cursor: busy ? "default" : "pointer",
  };
}

function warnBtn(busy: boolean) {
  return {
    ...rowBtnBase,
    background: T.amberFill12,
    color: busy ? T.textFaded : T.warnBright,
    border: `1px solid ${T.amberEdge35}`,
    cursor: busy ? "default" : "pointer",
  };
}

function dangerBtn(busy: boolean) {
  return {
    ...rowBtnBase,
    background: "transparent",
    color: busy ? T.textFaded : T.badBright,
    border: `1px solid ${T.redEdge35}`,
    cursor: busy ? "default" : "pointer",
  };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MultichatLibraryPage() {
  const [token, setToken] = useState("");
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [usageMap, setUsageMap] = useState<Record<string, Usage>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("aevion_token") ?? "";
    setToken(t);
    if (!t) {
      setLoading(false);
      return;
    }
    void load(t, "");
  }, []);

  async function load(t: string, query: string) {
    setLoading(true);
    setError("");
    try {
      // Через apiUrl, как и все остальные вызовы страницы: голый `/api/...`
      // уходит в сам Next (переписан только `/api-backend/*`) и стабильно
      // отвечает 404 — список не грузился ни разу.
      const url = query
        ? apiUrl(`/api/multichat/search?q=${encodeURIComponent(query)}&limit=200`)
        : apiUrl(`/api/multichat/conversations`);
      const r = await fetch(url, { headers: { Authorization: `Bearer ${t}` } });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(`Ошибка: ${d.error ?? r.status}`);
        return;
      }
      const d = await r.json();
      setItems(d.items ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function loadUsage(id: string) {
    if (usageMap[id]) return;
    try {
      const r = await fetch(apiUrl(`/api/multichat/conversations/${id}/usage`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return;
      const u = (await r.json()) as Usage;
      setUsageMap(prev => ({ ...prev, [id]: u }));
    } catch {
      // ignore
    }
  }

  async function rename(id: string) {
    const current = items.find(i => i.id === id);
    const next = prompt("Новое название:", current?.title ?? "")?.trim();
    if (!next || next === current?.title) return;
    setBusyId(id);
    try {
      const r = await fetch(apiUrl(`/api/multichat/conversations/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: next }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        alert(`Ошибка: ${d.error ?? r.status}`);
        return;
      }
      setItems(prev => prev.map(i => (i.id === id ? { ...i, title: next } : i)));
    } finally {
      setBusyId(null);
    }
  }

  async function del(id: string) {
    const conv = items.find(i => i.id === id);
    if (!confirm(`Удалить "${conv?.title}"? Это необратимо.`)) return;
    setBusyId(id);
    try {
      const r = await fetch(apiUrl(`/api/multichat/conversations/${id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        alert(`Ошибка: ${d.error ?? r.status}`);
        return;
      }
      setItems(prev => prev.filter(i => i.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  async function share(id: string) {
    setBusyId(id);
    try {
      const r = await fetch(apiUrl(`/api/multichat/conversations/${id}/share`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        alert(`Ошибка: ${d.error ?? r.status}`);
        return;
      }
      const url = `${window.location.origin}${d.shareUrl}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      alert(`Public URL скопирован:\n${url}`);
      setItems(prev => prev.map(i => (i.id === id ? { ...i, shareToken: d.shareToken } : i)));
    } finally {
      setBusyId(null);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Отозвать public-ссылку? Старая перестанет работать.")) return;
    setBusyId(id);
    try {
      const r = await fetch(apiUrl(`/api/multichat/conversations/${id}/share`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        alert(`Ошибка: ${r.status}`);
        return;
      }
      setItems(prev => prev.map(i => (i.id === id ? { ...i, shareToken: null } : i)));
    } finally {
      setBusyId(null);
    }
  }

  function downloadExport(id: string, fmt: "json" | "csv") {
    const url = apiUrl(`/api/multichat/conversations/${id}/export.${fmt}`);
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      // Без проверки r.ok страница молча сохраняла страницу ошибки под именем
      // multichat-….json — «скачалось» и «скачалось нужное» это разные вещи.
      .then(r => {
        if (!r.ok) throw new Error(String(r.status));
        return r.blob();
      })
      .then(blob => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `multichat-${id}.${fmt}`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => alert("Не удалось скачать"));
  }

  if (!token) {
    return (
      <div style={{ minHeight: "100vh", background: T.canvas, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <p style={{ color: T.textMute, fontSize: 15, textAlign: "center", maxWidth: 420, lineHeight: 1.6 }}>
          Войдите, чтобы увидеть свои беседы. Библиотека хранит вопросы, ответы всех
          агентов и расход по каждой беседе.
        </p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: T.canvas, color: T.text }}>
      <header
        style={{
          borderBottom: `1px solid ${T.lineSoft}`,
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <Link href="/multichat-engine" style={{ color: T.textMute, fontSize: 14, textDecoration: "none" }}>
            ← Мультичат
          </Link>
          <span style={{ color: T.textFaded }}>·</span>
          <h1 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: T.text }}>Библиотека бесед</h1>
        </div>
        <button
          onClick={() => void load(token, q)}
          disabled={loading}
          style={{
            background: loading ? T.btnDisabledBg : T.btnAccentBg,
            color: loading ? T.textMute : T.onAccentDeep,
            border: "none",
            borderRadius: 8,
            padding: "7px 14px",
            fontSize: 13,
            fontWeight: 600,
            cursor: loading ? "default" : "pointer",
          }}
        >
          {loading ? "Обновляю…" : "Обновить"}
        </button>
      </header>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px", display: "grid", gap: 16 }}>
        {error && (
          <div style={{ background: T.redFill18, border: `1px solid ${T.redEdge45}`, borderRadius: 10, padding: 12, fontSize: 14, color: T.bad }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Поиск по названию…"
            style={{
              flex: "1 1 220px",
              background: T.surface,
              border: `1px solid ${T.lineSoft}`,
              borderRadius: 10,
              padding: "9px 12px",
              fontSize: 14,
              color: T.text,
              fontFamily: "inherit",
            }}
            onKeyDown={e => {
              if (e.key === "Enter") void load(token, q);
            }}
          />
          <button
            onClick={() => void load(token, q)}
            style={{
              background: T.btnAccentBg, color: T.onAccentDeep, border: "none", borderRadius: 10,
              padding: "9px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
          >
            Найти
          </button>
          {q && (
            <button
              onClick={() => {
                setQ("");
                void load(token, "");
              }}
              style={{
                background: "transparent", color: T.textDim, border: `1px solid ${T.lineSoft}`,
                borderRadius: 10, padding: "9px 14px", fontSize: 14, cursor: "pointer",
              }}
            >
              Сбросить
            </button>
          )}
        </div>

        {loading && items.length === 0 && (
          <div style={{ color: T.textMute, fontSize: 14, padding: "48px 0", textAlign: "center" }}>Загрузка…</div>
        )}
        {!loading && items.length === 0 && (
          <div style={{ color: T.textMute, fontSize: 14, padding: "48px 0", textAlign: "center", lineHeight: 1.6 }}>
            {q ? (
              "По запросу ничего не найдено"
            ) : (
              <>
                Здесь пока пусто.{" "}
                <Link href="/multichat-engine" style={{ color: T.accent }}>
                  Спросите консилиум
                </Link>{" "}
                — беседа появится в библиотеке сразу после ответа.
              </>
            )}
          </div>
        )}

        <div style={{ display: "grid", gap: 10 }}>
          {items.map(c => {
            const u = usageMap[c.id];
            const busy = busyId === c.id;
            return (
              <div
                key={c.id}
                style={{ background: T.surface, border: `1px solid ${T.lineSoft}`, borderRadius: 12, padding: 16 }}
                onMouseEnter={() => void loadUsage(c.id)}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                    <Link
                      href={`/multichat-engine?conv=${c.id}`}
                      style={{
                        fontSize: 16, fontWeight: 600, color: T.text, textDecoration: "none",
                        display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}
                    >
                      {c.title}
                    </Link>
                    <div style={{ fontSize: 12, color: T.textFaded, marginTop: 3 }}>
                      Изменена {fmtDate(c.updatedAt)} · создана {fmtDate(c.createdAt)}
                    </div>
                    {u && (
                      <div style={{ fontSize: 12, color: T.textMute, marginTop: 5, fontFamily: "ui-monospace, monospace" }}>
                        {u.calls} вызовов · {u.tokens.total.toLocaleString("ru-RU")} токенов · ${u.costUsd.toFixed(4)}
                        {/* «$0.0000» при неизвестной цене читается как «бесплатно».
                            Говорим прямо, сколько вызовов посчитать не смогли. */}
                        {u.unpricedCalls ? (
                          <span style={{ color: T.warn }}> · {u.unpricedCalls} без известной цены</span>
                        ) : null}
                      </div>
                    )}
                    {c.shareToken && (
                      <div style={{ fontSize: 12, color: T.accent, marginTop: 5 }}>
                        Открыта по ссылке:{" "}
                        <code style={{ background: T.surfaceSoft, padding: "1px 5px", borderRadius: 4, color: T.textDim }}>
                          /multichat-engine/shared/{c.shareToken.slice(0, 12)}…
                        </code>
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => rename(c.id)} disabled={busy} style={secondaryBtn(busy)}>
                      Переименовать
                    </button>
                    <button onClick={() => downloadExport(c.id, "json")} style={secondaryBtn(false)}>
                      Скачать JSON
                    </button>
                    <button onClick={() => downloadExport(c.id, "csv")} style={secondaryBtn(false)}>
                      Скачать CSV
                    </button>
                    {c.shareToken ? (
                      <button onClick={() => revoke(c.id)} disabled={busy} style={warnBtn(busy)}>
                        Отозвать ссылку
                      </button>
                    ) : (
                      <button onClick={() => share(c.id)} disabled={busy} style={accentBtn(busy)}>
                        Поделиться
                      </button>
                    )}
                    <button onClick={() => del(c.id)} disabled={busy} style={dangerBtn(busy)}>
                      Удалить
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
