"use client";
import { apiUrl } from "@/lib/apiBase";

import { useEffect, useState } from "react";
import Link from "next/link";

import { getAuthToken } from "@/lib/auth";
import { T } from "../theme";
import { agentFailure } from "../failureText";

// Библиотека беседы пользователя.
//
// Три дефекта, найденные 12.08.2026, все из класса «работает молча не так»:
//
// 1. Токен читался из localStorage по имени aevion_token. Такого ключа НЕ ПИШЕТ
//    ни одна строка фронтенда (канонический — aevion_auth_token_v1, см.
//    lib/auth.ts). То есть страница показывала «Войдите чтобы видеть свои чаты»
//    ВОШЕДШЕМУ человеку, всегда. Теперь токен берётся тем же getAuthToken(),
//    которым его кладёт вход, — одно имя на оба конца.
// 2. У загрузки не было catch. Сетевой сбой уходил в finally, loading гасло, и
//    экран уверенно писал «У вас пока нет чатов» — упавшее чтение становилось
//    фактом. Теперь сбой виден как сбой.
// 3. Список и экспорт шли на относительный путь, а остальные вызовы через
//    apiUrl(). Два способа обратиться к одному API расходятся на первой же
//    смене базы. Теперь один.
//
// Цвета — только через токены ../theme (сторож themeTokens.guard проверяет и
// hex, и классы Tailwind: страница была на тёмных slate-классах, пока весь
// модуль уже жил на светлом газетном эталоне).

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
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Причина отказа по-русски из тела ответа; общая с остальным модулем. */
async function failureOf(r: Response): Promise<string> {
  const d = (await r.json().catch(() => null)) as { error?: unknown } | null;
  return agentFailure(d?.error ?? `upstream ${r.status}`).human;
}

const btnBase: React.CSSProperties = {
  padding: "5px 9px",
  borderRadius: 6,
  fontSize: 12,
  border: `1px solid ${T.lineSoft}`,
  background: T.surfaceSoft,
  color: T.text,
  cursor: "pointer",
};

const btnAccent: React.CSSProperties = {
  ...btnBase,
  background: T.btnAccentBg,
  color: T.onAccent,
  border: "none",
  fontWeight: 600,
};

export default function MultichatLibraryPage() {
  const [token, setToken] = useState("");
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [q, setQ] = useState("");
  const [usageMap, setUsageMap] = useState<Record<string, Usage>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const t = getAuthToken() ?? "";
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
      const path = query
        ? `/api/multichat/search?q=${encodeURIComponent(query)}&limit=200`
        : `/api/multichat/conversations`;
      const r = await fetch(apiUrl(path), { headers: { Authorization: `Bearer ${t}` } });
      if (!r.ok) {
        setError(await failureOf(r));
        return;
      }
      const d = await r.json();
      setItems(d.items ?? []);
    } catch {
      // Без этого сбой сети выглядел как пустая библиотека.
      setError("Не удалось получить список. Проверьте соединение и попробуйте снова.");
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
      setUsageMap((prev) => ({ ...prev, [id]: u }));
    } catch {
      // Расход — справка рядом с названием; молчаливый пропуск здесь уместен.
    }
  }

  async function rename(id: string) {
    const current = items.find((i) => i.id === id);
    const next = window.prompt("Новое название:", current?.title ?? "")?.trim();
    if (!next || next === current?.title) return;
    setBusyId(id);
    setError("");
    try {
      const r = await fetch(apiUrl(`/api/multichat/conversations/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: next }),
      });
      if (!r.ok) {
        setError(await failureOf(r));
        return;
      }
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, title: next } : i)));
    } catch {
      setError("Переименовать не удалось: сеть не ответила.");
    } finally {
      setBusyId(null);
    }
  }

  async function del(id: string) {
    const conv = items.find((i) => i.id === id);
    if (!window.confirm(`Удалить «${conv?.title}»? Это необратимо.`)) return;
    setBusyId(id);
    setError("");
    try {
      const r = await fetch(apiUrl(`/api/multichat/conversations/${id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        setError(await failureOf(r));
        return;
      }
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      setError("Удалить не удалось: сеть не ответила. Беседа осталась на месте.");
    } finally {
      setBusyId(null);
    }
  }

  async function share(id: string) {
    setBusyId(id);
    setError("");
    setNotice("");
    try {
      const r = await fetch(apiUrl(`/api/multichat/conversations/${id}/share`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        setError(await failureOf(r));
        return;
      }
      const d = (await r.json()) as { shareUrl?: string; shareToken?: string };
      const url = `${window.location.origin}${d.shareUrl ?? ""}`;
      // Копирование может быть запрещено (нет разрешения, не тот контекст) —
      // тогда ссылку надо ПОКАЗАТЬ, а не сказать «скопировано» и потерять её.
      const copied = await navigator.clipboard
        .writeText(url)
        .then(() => true)
        .catch(() => false);
      setNotice(copied ? `Ссылка скопирована: ${url}` : `Ссылка готова, скопируйте вручную: ${url}`);
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, shareToken: d.shareToken } : i)));
    } catch {
      setError("Открыть ссылку не удалось: сеть не ответила.");
    } finally {
      setBusyId(null);
    }
  }

  async function revoke(id: string) {
    if (!window.confirm("Отозвать открытую ссылку? Старая перестанет работать.")) return;
    setBusyId(id);
    setError("");
    setNotice("");
    try {
      const r = await fetch(apiUrl(`/api/multichat/conversations/${id}/share`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        setError(await failureOf(r));
        return;
      }
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, shareToken: null } : i)));
      setNotice("Ссылка отозвана.");
    } catch {
      setError("Отозвать не удалось: сеть не ответила. Ссылка ещё работает.");
    } finally {
      setBusyId(null);
    }
  }

  async function downloadExport(id: string, fmt: "json" | "csv") {
    setError("");
    try {
      const r = await fetch(apiUrl(`/api/multichat/conversations/${id}/export.${fmt}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        setError(await failureOf(r));
        return;
      }
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `multichat-${id}.${fmt}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setError("Скачать не удалось: сеть не ответила.");
    }
  }

  if (!token) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: T.canvas,
          color: T.text,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 24px",
        }}
      >
        <p style={{ color: T.textMute, fontSize: 15 }}>Войдите, чтобы видеть свои беседы.</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: T.canvas, color: T.text }}>
      <header
        style={{
          borderBottom: `1px solid ${T.line}`,
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/multichat-engine" style={{ color: T.textMute, fontSize: 14, textDecoration: "none" }}>
            ← Мультичат
          </Link>
          <span style={{ color: T.textFaded }}>·</span>
          <h1 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: T.text }}>Библиотека</h1>
        </div>
        <button
          onClick={() => void load(token, q)}
          disabled={loading}
          style={{ ...btnAccent, opacity: loading ? 0.4 : 1 }}
        >
          {loading ? "Обновляю…" : "Обновить"}
        </button>
      </header>

      <div style={{ maxWidth: 1024, margin: "0 auto", padding: "24px", display: "grid", gap: 16 }}>
        {error && (
          <div
            style={{
              background: T.surfaceSoft,
              border: `1px solid ${T.bad}`,
              borderRadius: 12,
              padding: 12,
              fontSize: 14,
              color: T.bad,
              lineHeight: 1.6,
            }}
          >
            {error}
          </div>
        )}
        {notice && (
          <div
            style={{
              background: T.surfaceSoft,
              border: `1px solid ${T.lineSoft}`,
              borderRadius: 12,
              padding: 12,
              fontSize: 13,
              color: T.textDim,
              wordBreak: "break-all",
            }}
          >
            {notice}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по названию…"
            style={{
              flex: 1,
              minWidth: 200,
              background: T.surface,
              border: `1px solid ${T.line}`,
              borderRadius: 8,
              padding: "9px 12px",
              fontSize: 14,
              color: T.text,
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void load(token, q);
            }}
          />
          <button onClick={() => void load(token, q)} style={btnAccent}>
            Найти
          </button>
          {q && (
            <button
              onClick={() => {
                setQ("");
                void load(token, "");
              }}
              style={btnBase}
            >
              Сбросить
            </button>
          )}
        </div>

        {loading && items.length === 0 && (
          <div style={{ color: T.textMute, fontSize: 14, padding: "48px 0", textAlign: "center" }}>
            Загрузка…
          </div>
        )}
        {!loading && !error && items.length === 0 && (
          <div style={{ color: T.textFaded, fontSize: 14, padding: "48px 0", textAlign: "center" }}>
            {q ? "По запросу ничего не найдено" : "У вас пока нет беседы"}
          </div>
        )}

        <div style={{ display: "grid", gap: 8 }}>
          {items.map((c) => {
            const u = usageMap[c.id];
            return (
              <div
                key={c.id}
                style={{
                  background: T.surface,
                  border: `1px solid ${T.lineSoft}`,
                  borderRadius: 12,
                  padding: 16,
                }}
                onMouseEnter={() => void loadUsage(c.id)}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link
                      href={`/multichat-engine?conv=${c.id}`}
                      style={{
                        fontWeight: 700,
                        fontSize: 16,
                        color: T.text,
                        textDecoration: "none",
                        display: "block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.title}
                    </Link>
                    <div style={{ fontSize: 11, color: T.textFaded, marginTop: 3 }}>
                      Изменена {fmtDate(c.updatedAt)} · создана {fmtDate(c.createdAt)}
                    </div>
                    {u && (
                      <div style={{ fontSize: 11, color: T.textFaded, marginTop: 4 }}>
                        Вызовов {u.calls} · токенов {u.tokens.total.toLocaleString("ru-RU")} · ${u.costUsd.toFixed(4)}
                      </div>
                    )}
                    {c.shareToken && (
                      <div style={{ fontSize: 11, color: T.good, marginTop: 4 }}>
                        Открытая ссылка:{" "}
                        <code style={{ background: T.surfaceSoft, padding: "1px 4px", borderRadius: 4 }}>
                          /multichat-engine/shared/{c.shareToken.slice(0, 12)}…
                        </code>
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => rename(c.id)} disabled={busyId === c.id} style={btnBase}>
                      Переименовать
                    </button>
                    <button onClick={() => void downloadExport(c.id, "json")} style={btnBase}>
                      Скачать JSON
                    </button>
                    <button onClick={() => void downloadExport(c.id, "csv")} style={btnBase}>
                      Скачать CSV
                    </button>
                    {c.shareToken ? (
                      <button onClick={() => revoke(c.id)} disabled={busyId === c.id} style={btnBase}>
                        Отозвать ссылку
                      </button>
                    ) : (
                      <button onClick={() => share(c.id)} disabled={busyId === c.id} style={btnAccent}>
                        Открыть ссылку
                      </button>
                    )}
                    <button
                      onClick={() => del(c.id)}
                      disabled={busyId === c.id}
                      style={{ ...btnBase, color: T.bad, borderColor: T.bad }}
                    >
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
