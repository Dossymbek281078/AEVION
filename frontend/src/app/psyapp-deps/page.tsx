"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import MvpConceptBoard from "@/components/MvpConceptBoard";

type RiskPoint = { day: number; score: number; label?: string; action?: string };

const RISK_SERIES: RiskPoint[] = [
  { day: 1, score: 22 },
  { day: 2, score: 62, label: "Пиковая тревога", action: "Breathing exercise" },
  { day: 3, score: 38 },
  { day: 4, score: 48 },
  { day: 5, score: 78, label: "Trigger zone", action: "Short call with mentor" },
  { day: 6, score: 45, label: "Стабилизация", action: "Group chat" },
  { day: 7, score: 28 },
];

const SEED_MESSAGES = [
  { handle: "user-aa12", text: "Tough day yesterday, but 14 days clean now. Дышу — и держусь." },
  { handle: "user-bb33", text: "Proud of you. Месяц назад был на том же месте. Сейчас 47 дней." },
  { handle: "user-cc44", text: "Сегодня сорвался бы — открыл эту группу вместо приложения. Спасибо." },
  { handle: "user-dd55", text: "Маленький шаг каждый день. Триггер-детектор подсказал в 19:00 — успел." },
];

const MILESTONES = [
  { label: "1 день", progress: 100, note: "Первый день без — самый тяжёлый. Тело адаптируется." },
  { label: "30 дней", progress: 64, note: "Месяц — новые нейронные связи. Старый паттерн ослабевает." },
  { label: "90 дней", progress: 22, note: "Три месяца — статистически устойчивая ремиссия." },
];

function genHandle() {
  const a = "abcdefghjkmnpqrstuvwxyz";
  const r = () => a[Math.floor(Math.random() * a.length)];
  const n = () => Math.floor(Math.random() * 9) + 1;
  return `user-${r()}${r()}${n()}${n()}`;
}

export default function PsyAppDepsPage() {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState(SEED_MESSAGES);
  const [hover, setHover] = useState<RiskPoint | null>(null);

  const jsonLd = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "MedicalWebPage",
      name: "PsyApp · Dependency Recovery",
      about: {
        "@type": "MedicalCondition",
        name: "Substance and behavioral dependencies",
        possibleTreatment: [
          { "@type": "TherapeuticProcedure", name: "Behavioral trigger monitoring" },
          { "@type": "TherapeuticProcedure", name: "Anonymous peer support" },
        ],
      },
      audience: {
        "@type": "PeopleAudience",
        suggestedMinAge: 18,
      },
      isPartOf: { "@type": "WebSite", name: "AEVION" },
    }),
    []
  );

  function post() {
    const t = draft.trim();
    if (!t) return;
    setMessages((m) => [{ handle: genHandle(), text: t }, ...m].slice(0, 20));
    setDraft("");
  }

  const W = 640;
  const H = 200;
  const PAD = 28;
  const xs = (i: number) => PAD + (i * (W - PAD * 2)) / (RISK_SERIES.length - 1);
  const ys = (v: number) => H - PAD - (v / 100) * (H - PAD * 2);
  const path = RISK_SERIES.map((p, i) => `${i === 0 ? "M" : "L"}${xs(i)},${ys(p.score)}`).join(" ");
  const area = `${path} L${xs(RISK_SERIES.length - 1)},${H - PAD} L${xs(0)},${H - PAD} Z`;
  const thresholdY = ys(70);

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-950 via-zinc-950 to-black text-zinc-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="border-b border-rose-900/40 bg-black/40 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="text-sm text-rose-300 hover:text-rose-200">
            ← AEVION · PsyApp · <span className="text-rose-500">RESEARCH</span>
          </Link>
          <span className="text-[10px] uppercase tracking-widest text-rose-400/70">демо · mock data</span>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 pt-16 pb-10">
        <p className="text-xs uppercase tracking-[0.3em] text-rose-400/80">Addiction Recovery</p>
        <h1 className="mt-3 text-4xl md:text-5xl font-semibold tracking-tight">
          Out of the loop, <span className="text-rose-400">on purpose.</span>
        </h1>
        <p className="mt-4 text-zinc-300 max-w-2xl leading-relaxed">
          Платформа выхода из зависимостей (алкоголь · курение · ставки). Поведенческая триггер-детекция,
          анонимная групповая поддержка и профилактика срывов. 18+. Не диагноз — поддержка.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-10">
        <div className="rounded-2xl border border-rose-900/40 bg-black/40 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-rose-200">Trigger-детектор · 7 дней</h2>
            <span className="text-[10px] uppercase tracking-widest text-rose-400/70">демо · mock data</span>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Risk timeline">
            <defs>
              <linearGradient id="riskFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <line x1={PAD} y1={thresholdY} x2={W - PAD} y2={thresholdY} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity="0.6" />
            <text x={W - PAD} y={thresholdY - 6} textAnchor="end" fontSize="10" fill="#fca5a5">
              threshold · 70
            </text>
            <path d={area} fill="url(#riskFill)" />
            <path d={path} fill="none" stroke="#fb7185" strokeWidth="2" />
            {RISK_SERIES.map((p, i) => {
              const cx = xs(i);
              const cy = ys(p.score);
              const red = p.score >= 70;
              return (
                <g key={i} onMouseEnter={() => setHover(p)} onMouseLeave={() => setHover(null)}>
                  <circle cx={cx} cy={cy} r={red ? 6 : 4} fill={red ? "#ef4444" : "#fb7185"} stroke="#0a0a0a" strokeWidth="2" />
                  <text x={cx} y={H - 8} textAnchor="middle" fontSize="10" fill="#9ca3af">
                    D{p.day}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="mt-3 min-h-[44px] text-sm">
            {hover ? (
              <div className="rounded-lg border border-rose-700/40 bg-rose-950/50 px-3 py-2">
                <span className="text-rose-200 font-medium">Day {hover.day} · risk {hover.score}</span>
                {hover.label ? <span className="text-zinc-400"> · {hover.label}</span> : null}
                {hover.action ? (
                  <div className="text-xs text-rose-300/90 mt-1">Suggested: {hover.action}</div>
                ) : null}
              </div>
            ) : (
              <span className="text-zinc-500 text-xs">Наведите на точку — увидите рекомендуемое действие.</span>
            )}
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-10">
        <div className="rounded-2xl border border-rose-900/40 bg-black/40 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-rose-200">Anonymous Group Support</h2>
            <span className="text-[10px] uppercase tracking-widest text-rose-400/70">ephemeral handles · демо</span>
          </div>
          <div className="space-y-2 mb-4 max-h-72 overflow-y-auto">
            {messages.map((m, i) => (
              <div key={i} className="rounded-lg bg-zinc-900/60 border border-zinc-800 px-3 py-2">
                <div className="text-[11px] text-rose-300/80 font-mono">{m.handle}</div>
                <div className="text-sm text-zinc-200 mt-1">{m.text}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && post()}
              placeholder="Поделитесь анонимно"
              className="flex-1 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm placeholder:text-zinc-500 focus:outline-none focus:border-rose-500"
            />
            <button
              onClick={post}
              className="rounded-lg bg-rose-600 hover:bg-rose-500 px-4 py-2 text-sm font-medium"
            >
              Отправить
            </button>
          </div>
          <p className="text-[11px] text-zinc-500 mt-3">
            Handle генерируется случайно при каждой отправке. Без логина, без следа.
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-10">
        <h2 className="text-lg font-semibold text-rose-200 mb-4">Recovery Timeline</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {MILESTONES.map((m) => (
            <div key={m.label} className="rounded-2xl border border-rose-900/40 bg-black/40 p-5">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-semibold text-rose-300">{m.label}</span>
                <span className="text-xs text-zinc-400">{m.progress}%</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-rose-500 to-rose-300"
                  style={{ width: `${m.progress}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-zinc-300 leading-relaxed">{m.note}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-rose-900/40 bg-gradient-to-br from-rose-950/60 to-black p-5">
          <div className="text-xs uppercase tracking-widest text-rose-400/80">Bridge → QGood</div>
          <h3 className="mt-1 text-lg font-semibold">Когда поведенческий риск переходит в клинический</h3>
          <p className="mt-2 text-sm text-zinc-300 leading-relaxed">
            Если детектор фиксирует устойчивое превышение порога 70 более 48 часов — PsyApp предлагает
            мост к QGood: clinical-grade поддержка, защищённый канал, профильный специалист. Решение —
            всегда за вами.
          </p>
          <Link href="/qgood" className="inline-block mt-3 text-sm text-rose-300 hover:text-rose-200">
            Перейти к QGood →
          </Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-10">
        <div className="rounded-2xl border border-amber-700/40 bg-amber-950/30 p-5">
          <p className="text-sm italic text-amber-200/90 leading-relaxed">
            Не замена клинической помощи. При срочной нужде — обращайтесь к специалисту.
            PsyApp — поддержка между сессиями, не диагноз и не терапия.
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-16">
        <h2 className="text-sm uppercase tracking-widest text-zinc-400 mb-3">Связанные модули</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <Link
            href="/qgood"
            className="rounded-xl border border-zinc-800 hover:border-rose-700 bg-black/40 p-4 transition"
          >
            <div className="text-rose-300 font-semibold">QGood</div>
            <p className="text-xs text-zinc-400 mt-1">Clinical-grade mental health — куда эскалируется риск.</p>
          </Link>
          <Link
            href="/healthai"
            className="rounded-xl border border-zinc-800 hover:border-rose-700 bg-black/40 p-4 transition"
          >
            <div className="text-rose-300 font-semibold">HealthAI</div>
            <p className="text-xs text-zinc-400 mt-1">Health-screener + триаж, фоновый сигнал биомаркеров.</p>
          </Link>
          <Link
            href="/qlife"
            className="rounded-xl border border-zinc-800 hover:border-rose-700 bg-black/40 p-4 transition"
          >
            <div className="text-rose-300 font-semibold">QLife</div>
            <p className="text-xs text-zinc-400 mt-1">Personal OS, где PsyApp работает фоном.</p>
          </Link>
        </div>
      </section>

      <MvpConceptBoard
        moduleId="psyapp-deps"
        noun="assessments"
        titleField="title"
        summaryField="category"
        accent="rose"
        sectionTitle="Public assessment templates"
        sectionHint="Анонимные шаблоны самопроверок от сообщества (без диагнозов). Для исследований и образовательных целей."
        fields={[
          { key: "title", label: "Название шаблона", required: true, placeholder: "Burnout self-check (workplace)" },
          { key: "category", label: "Категория", required: true, placeholder: "burnout · anxiety · dependency · sleep" },
          { key: "description", label: "Описание", type: "textarea", required: false, placeholder: "Когда применять, какие вопросы. Без клинических утверждений." },
        ]}
      />

      <footer className="border-t border-rose-900/30 py-6 text-center text-[11px] text-zinc-500">
        AEVION · PsyApp · RESEARCH · демо · mock data · 18+
      </footer>
    </div>
  );
}
