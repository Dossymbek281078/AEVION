"use client";

/**
 * 152 (18.10.2026). Общее состояние голосов «👍 интересно» для всей страницы /ventures.
 *
 * До 152 состояние (счётчики, «я уже голосовал», запрос) жило внутри IdeaMarket — таблицы из 20 замыслов
 * на ~1831 px. Теперь три первые карточки с той же кнопкой стоят в шапке (первый экран гостя), а таблица —
 * ниже; обе поверхности читают ОДНО состояние, чтобы голос в шапке сразу менял счётчик в таблице и наоборот.
 *
 * Голос без входа: ручка POST /api/ventures/ideas/:id/interest дедупит по voterId из localStorage
 * (tests/venturesGolosBezVhoda152.guard.test.ts в бэкенде).
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Состояние = {
  interest: Record<string, number>;
  voted: Record<string, boolean>;
  pending: string | null;
  vote: (id: string) => Promise<void>;
};

const Контекст = createContext<Состояние | null>(null);

function anonVoterId(): string {
  try {
    let id = localStorage.getItem("aevion_ventures_voter");
    if (!id) {
      id = (crypto?.randomUUID?.() ?? `v-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      localStorage.setItem("aevion_ventures_voter", id);
    }
    return id;
  } catch {
    return "";
  }
}

export function VenturesInterestProvider({ children }: { children: ReactNode }) {
  const [interest, setInterest] = useState<Record<string, number>>({});
  const [voted, setVoted] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api-backend/api/ventures/ideas")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { ideas: { id: string; interest: number }[] }) => {
        if (cancelled) return;
        const map: Record<string, number> = {};
        for (const i of d.ideas) map[i.id] = i.interest;
        setInterest(map);
      })
      .catch(() => { /* board still renders with 0 counts */ });
    try {
      const raw = localStorage.getItem("aevion_ventures_voted");
      if (raw) setVoted(JSON.parse(raw));
    } catch { /* ignore */ }
    return () => { cancelled = true; };
  }, []);

  async function vote(id: string) {
    if (pending || voted[id]) return;
    setPending(id);
    try {
      const r = await fetch(`/api-backend/api/ventures/ideas/${id}/interest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "build", voterId: anonVoterId() }),
      });
      const d = (await r.json()) as { interest?: number; storage?: string };
      if (r.ok && typeof d.interest === "number") {
        setInterest((m) => ({ ...m, [id]: d.interest as number }));
        // 20.10.2026: storage "memory" — база не приняла, голос живёт до перезапуска сервера.
        // Не запоминаем его как окончательный: кнопка остаётся, человек может отдать голос снова.
        if (d.storage === "memory") return;
        setVoted((v) => {
          const next = { ...v, [id]: true };
          try { localStorage.setItem("aevion_ventures_voted", JSON.stringify(next)); } catch { /* ignore */ }
          return next;
        });
      }
    } catch { /* noop */ } finally {
      setPending(null);
    }
  }

  return <Контекст.Provider value={{ interest, voted, pending, vote }}>{children}</Контекст.Provider>;
}

export function useVenturesInterest(): Состояние {
  const c = useContext(Контекст);
  if (!c) throw new Error("useVenturesInterest вне VenturesInterestProvider: оберните страницу /ventures провайдером");
  return c;
}

const btnStyle = (on: boolean): React.CSSProperties => ({
  fontFamily: "ui-monospace,Menlo,monospace",
  fontSize: 12,
  padding: "3px 9px",
  borderRadius: 999,
  border: "1px solid var(--amber)",
  color: on ? "var(--ink)" : "var(--amber)",
  background: on ? "var(--amber)" : "transparent",
  cursor: on ? "default" : "pointer",
  whiteSpace: "nowrap",
});

/** Кнопка «👍 N» одного замысла — одна и та же в шапке и в таблице. */
export function InterestButton({ id, name, size = "s" }: { id: string; name: string; size?: "s" | "m" }) {
  const { interest, voted, pending, vote } = useVenturesInterest();
  const on = Boolean(voted[id]);
  const style = size === "m" ? { ...btnStyle(on), fontSize: 14, padding: "8px 14px" } : btnStyle(on);
  return (
    <button
      type="button"
      data-ventures-interest={id}
      aria-label={`${on ? "Голос отдан" : "Отметить интерес"}: ${name}`}
      onClick={() => vote(id)}
      disabled={on || pending === id}
      style={style}
      title={on ? "Ты уже отметил интерес" : "Отметить интерес — «я бы это построил»"}
    >
      {on ? "✓ " : "👍 "}{interest[id] ?? 0}
    </button>
  );
}
