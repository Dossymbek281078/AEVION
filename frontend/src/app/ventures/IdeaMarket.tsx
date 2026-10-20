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

import { useState } from "react";
import { InterestButton } from "./VenturesInterest";

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
export const IDEAS: Idea[] = [
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

export default function IdeaMarket() {
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
                  <InterestButton id={i.id} name={i.name} />
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
  const [f, setF] = useState({ name: "", pitch: "", model: "", ceiling: "", email: "" });
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
        setMsg({ kind: "err", text: d?.message || d?.error || `HTTP ${r.status}` });
        return;
      }
      // Ручка честно называет, КУДА легла идея: запасной путь помечен
      // storage:"memory" и живёт до перезапуска. Опасность здесь выше обычной:
      // тот же ответ несёт note «Идея принята — попадёт на маркет после
      // проверки», и раньше форма показывала ЭТУ фразу как успех, а поля
      // очищала. Человек терял набранное и уходил уверенным, что идея в
      // очереди на проверку.
      const storage = d?.storage ?? "db";
      if (storage !== "db" && storage !== "postgres") {
        setMsg({
          kind: "err",
          text:
            "Идею приняли, но сохранить её насовсем сейчас не вышло — это на нашей " +
            "стороне. Текст оставили в форме: отправьте ещё раз через минуту.",
        });
        return;
      }
      setMsg({ kind: "ok", text: d?.note || "Идея принята — попадёт на маркет после проверки." });
      setF({ name: "", pitch: "", model: "", ceiling: "", email: "" });
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
        <input style={input} type="email" aria-label="Почта автора (по желанию)" placeholder="Почта — по желанию, чтобы сообщить вам о решении" maxLength={120} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="submit" disabled={busy} style={{ padding: "10px 18px", borderRadius: 9, border: "none", background: "var(--amber)", color: "var(--ink)", fontWeight: 700, fontSize: 14, cursor: busy ? "default" : "pointer" }}>
            {busy ? "Отправка…" : "Отправить идею"}
          </button>
          {msg && <span style={{ fontSize: 13, color: msg.kind === "ok" ? "var(--teal)" : "#e0564a" }}>{msg.text}</span>}
        </div>
      </div>
      <p style={{ fontSize: 12, color: "var(--soft)", marginTop: 12, marginBottom: 0 }}>
        Идеи проходят модерацию перед публикацией: каждую читает человек из команды. Почта — по желанию: только чтобы сообщить вам о решении.
      </p>
    </form>
  );
}
