"use client";

/**
 * Interactive Идея-Маркет — the live half of /ventures.
 *
 * Renders the 20 curated ideas with LIVE interest tallies from the backend
 * (`GET /api/ventures/ideas`), lets a visitor cast interest per idea
 * (`POST /api/ventures/ideas/:id/interest`, deduped server-side by IP-hash),
 * and lets them submit their own idea (`POST /api/ventures/submit`, stored
 * pending for moderation). Reuses the parent page's `.vtx` CSS (this component
 * renders inside the `.vtx` root).
 */

import { useEffect, useState } from "react";

type Idea = {
  id: string;
  name: string;
  desc: string;
  model: string;
  ceiling: string;
  diff: number;
  status: "live" | "open" | "lab" | "pump";
};

// Descriptions kept client-side (backend catalog carries id/name/model/ceiling);
// merged with live interest counts fetched from the API.
const IDEAS: Idea[] = [
  { id: "01", name: "AEVIA — longevity / anti-grey гамми", desc: "Красота и антиэйдж изнутри, подписка", model: "DTC + подписка", ceiling: "$1B", diff: 4, status: "live" },
  { id: "02", name: "AI-ресепшн / голосовой агент", desc: "Для клиник, СТО, салонов", model: "SaaS", ceiling: "$10M", diff: 3, status: "open" },
  { id: "03", name: "Collagen sticks — 口服美容", desc: "Beauty-дринк, рынок Китая $10B+", model: "DTC", ceiling: "$250M", diff: 4, status: "lab" },
  { id: "04", name: "Longevity coffee / грибной латте", desc: "Ежедневный ритуал, высокий повтор", model: "DTC", ceiling: "$120M", diff: 3, status: "lab" },
  { id: "05", name: "AI-лидоген как сервис", desc: "Замена Apollo/Clay для СНГ", model: "SaaS", ceiling: "$10M", diff: 3, status: "open" },
  { id: "06", name: "AI-клон эксперта", desc: "Платный чат-двойник блогеров, rev-share", model: "Creator SaaS", ceiling: "$10M", diff: 4, status: "open" },
  { id: "07", name: "DTC beauty / skincare hero-SKU", desc: "Один герой-продукт", model: "E-commerce", ceiling: "$80M", diff: 4, status: "open" },
  { id: "08", name: "Высокочек-курс по AI", desc: "Денежный насос, реальная история", model: "Info product", ceiling: "$20M", diff: 2, status: "pump" },
  { id: "09", name: "Pet-товар с подпиской", desc: "Корм / лакомство / гаджет", model: "DTC подписка", ceiling: "$60M", diff: 4, status: "open" },
  { id: "10", name: "White-label AI-платформа", desc: "Перепродажа под брендом реселлера", model: "B2B2C SaaS", ceiling: "$10M", diff: 3, status: "open" },
  { id: "11", name: "STEM-игрушка + unboxing-воронка", desc: "Дети, YouTube-дистрибуция", model: "DTC + media", ceiling: "$70M", diff: 4, status: "open" },
  { id: "12", name: "Функциональный beauty-снек", desc: "Коллаген / протеин-бар, ритейл", model: "Food", ceiling: "$90M", diff: 4, status: "open" },
  { id: "13", name: "Sleep / calm гамми", desc: "Мелатонин + адаптогены", model: "DTC подписка", ceiling: "$150M", diff: 3, status: "lab" },
  { id: "14", name: "Gut / probiotic гамми", desc: "Огромная растущая категория", model: "DTC подписка", ceiling: "$140M", diff: 3, status: "lab" },
  { id: "15", name: "Адаптоген-шот (энергия без сахара)", desc: "Prime-подобный вирус", model: "Напиток", ceiling: "$200M", diff: 4, status: "open" },
  { id: "16", name: "Compliance / документооборот AI", desc: "ИИ проверяет договоры", model: "SaaS", ceiling: "$10M", diff: 3, status: "open" },
  { id: "17", name: "Ниша-маркетплейс", desc: "Одна вертикаль, take-rate 15%", model: "Marketplace", ceiling: "$50M", diff: 5, status: "open" },
  { id: "18", name: "Nootropic / focus гамми", desc: "Продуктивность, студенты", model: "DTC подписка", ceiling: "$110M", diff: 3, status: "lab" },
  { id: "19", name: "Виральный health-гаджет", desc: "Умная бутылка / трекер", model: "Device", ceiling: "$100M", diff: 4, status: "open" },
  { id: "20", name: "3D-визуализация недвижимости", desc: "Сервис → SaaS для застройщиков", model: "Service → SaaS", ceiling: "$10M", diff: 3, status: "open" },
];

const STATUS_LABEL: Record<Idea["status"], string> = { live: "▲ LIVE", open: "open", lab: "в лаб.", pump: "насос" };

function Dots({ n }: { n: number }) {
  return (
    <span className="vtx-dots" aria-label={`сложность ${n} из 5`}>
      {"●".repeat(n)}
      <span className="vtx-off">{"●".repeat(5 - n)}</span>
    </span>
  );
}

// Stable anonymous voter id (per browser) so the backend can dedup votes
// reliably even behind the Vercel->Railway proxy where client IP isn't visible.
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

export default function IdeaMarket() {
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
      const d = (await r.json()) as { interest?: number };
      if (r.ok && typeof d.interest === "number") {
        setInterest((m) => ({ ...m, [id]: d.interest as number }));
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

  return (
    <>
      <div className="vtx-board">
        <table className="vtx-table">
          <thead>
            <tr>
              <th>#</th><th>Идея</th><th>Модель</th><th>Ceiling</th><th>Сложн.</th><th>Статус</th><th>Интерес</th>
            </tr>
          </thead>
          <tbody>
            {IDEAS.map((i) => (
              <tr key={i.id}>
                <td className="vtx-num">{i.id}</td>
                <td><span className="vtx-name">{i.name}</span><br /><span className="vtx-desc">{i.desc}</span></td>
                <td>{i.model}</td>
                <td className="vtx-num vtx-cap">{i.ceiling}</td>
                <td><Dots n={i.diff} /></td>
                <td><span className={`vtx-pill vtx-${i.status}`}>{STATUS_LABEL[i.status]}</span></td>
                <td className="vtx-num">
                  <button
                    type="button"
                    onClick={() => vote(i.id)}
                    disabled={Boolean(voted[i.id]) || pending === i.id}
                    style={btnStyle(Boolean(voted[i.id]))}
                    title={voted[i.id] ? "Ты уже отметил интерес" : "Отметить интерес — «я бы это построил»"}
                  >
                    {voted[i.id] ? "✓ " : "👍 "}{interest[i.id] ?? 0}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="vtx-note">
        <b>Голосуй за идею.</b> «👍 интересно» — сигнал спроса от сообщества. Идеи с
        наибольшим интересом двигаются выше в очереди на запуск. Голос — один на идею.
      </div>
      <SubmitForm />
    </>
  );
}

function SubmitForm() {
  const [f, setF] = useState({ name: "", pitch: "", model: "", ceiling: "" });
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api-backend/api/ventures/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const d = await r.json();
      if (!r.ok) {
        setMsg({ kind: "err", text: d?.error || `HTTP ${r.status}` });
        return;
      }
      setMsg({ kind: "ok", text: d?.note || "Идея принята — попадёт на маркет после проверки." });
      setF({ name: "", pitch: "", model: "", ceiling: "" });
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Ошибка сети" });
    } finally {
      setBusy(false);
    }
  }

  const input: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 9,
    border: "1px solid var(--cardL)", background: "var(--card)", color: "var(--text)",
    fontSize: 14.5, fontFamily: "inherit",
  };

  return (
    <form onSubmit={submit} style={{ marginTop: 24, background: "var(--card)", border: "1px solid var(--cardL)", borderRadius: 14, padding: 20, boxShadow: "var(--sh)" }}>
      <p className="vtx-mth" style={{ color: "var(--amber)" }}>Предложи свою идею в маркет</p>
      <div style={{ display: "grid", gap: 10 }}>
        <input style={input} aria-label="Название идеи" placeholder="Название идеи*" maxLength={120} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <textarea aria-label="Питч идеи" style={{ ...input, minHeight: 84, resize: "vertical" }} placeholder="Питч: что это, для кого, как зарабатывает* (мин. 10 символов)" maxLength={600} value={f.pitch} onChange={(e) => setF({ ...f, pitch: e.target.value })} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <input style={input} aria-label="Модель бизнеса" placeholder="Модель (SaaS, DTC…)" maxLength={60} value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} />
          <input style={input} aria-label="Потолок рынка" placeholder="Потолок ($10M, $1B…)" maxLength={30} value={f.ceiling} onChange={(e) => setF({ ...f, ceiling: e.target.value })} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="submit" disabled={busy} style={{ padding: "10px 18px", borderRadius: 9, border: "none", background: "var(--amber)", color: "var(--ink)", fontWeight: 700, fontSize: 14, cursor: busy ? "default" : "pointer" }}>
            {busy ? "Отправка…" : "Отправить идею"}
          </button>
          {msg && <span style={{ fontSize: 13, color: msg.kind === "ok" ? "var(--teal)" : "#e0564a" }}>{msg.text}</span>}
        </div>
      </div>
      <p style={{ fontSize: 12, color: "var(--soft)", marginTop: 12, marginBottom: 0 }}>
        Идеи проходят модерацию перед публикацией. Контакты не собираем — только суть.
      </p>
    </form>
  );
}
