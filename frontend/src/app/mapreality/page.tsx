"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Category = "medical" | "volunteer" | "tools" | "info" | "emergency";

type Signal = {
  id: string;
  x: number;
  y: number;
  category: Category;
  title: string;
  region: string;
  urgency: 1 | 2 | 3;
  hash: string;
};

const CATS: Record<Category, { icon: string; label: string; color: string }> = {
  medical: { icon: "🩺", label: "Медики", color: "#22d3ee" },
  volunteer: { icon: "🤝", label: "Волонтёры", color: "#34d399" },
  tools: { icon: "🛠", label: "Инструменты", color: "#fbbf24" },
  info: { icon: "📚", label: "Информация", color: "#a78bfa" },
  emergency: { icon: "🚨", label: "ЧС", color: "#f87171" },
};

const SIGNALS: Signal[] = [
  { id: "s1", x: 540, y: 180, category: "medical", title: "Нужны 3 врача общей практики", region: "Алматы", urgency: 3, hash: "qs:8a7f…2c1b" },
  { id: "s2", x: 580, y: 130, category: "volunteer", title: "Ремонт приюта · нужны 12 человек", region: "Астана", urgency: 2, hash: "qs:4e2d…91ac" },
  { id: "s3", x: 510, y: 220, category: "tools", title: "Дрель + лестница для школы №47", region: "Шымкент", urgency: 1, hash: "qs:1f9b…77de" },
  { id: "s4", x: 620, y: 200, category: "info", title: "Перевод документов RU↔KK", region: "Караганда", urgency: 1, hash: "qs:c0aa…3f12" },
  { id: "s5", x: 470, y: 250, category: "emergency", title: "Подтопление · нужна откачка", region: "Атырау", urgency: 3, hash: "qs:9bd4…6e0f" },
  { id: "s6", x: 300, y: 160, category: "medical", title: "Педиатр на 2 смены", region: "Минск", urgency: 2, hash: "qs:55ab…2210" },
  { id: "s7", x: 200, y: 200, category: "volunteer", title: "Раздача еды бездомным", region: "Берлин", urgency: 2, hash: "qs:7c3e…b001" },
  { id: "s8", x: 660, y: 270, category: "info", title: "Юридическая помощь беженцам", region: "Ташкент", urgency: 1, hash: "qs:de10…aa44" },
  { id: "s9", x: 720, y: 150, category: "tools", title: "Генератор 5 кВт на 1 день", region: "Новосибирск", urgency: 2, hash: "qs:0042…ffcd" },
  { id: "s10", x: 400, y: 290, category: "emergency", title: "Поиск пропавшего · нужна группа", region: "Тбилиси", urgency: 3, hash: "qs:abe7…5511" },
];

const REGIONS = ["Алматы", "Астана", "Шымкент", "Караганда", "Атырау"];

const JSONLD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "AEVION MapReality",
  applicationCategory: "MappingApplication",
  description:
    "Карта реальных потребностей — гражданские сигналы с гео-привязкой, аудит через QSign, открытый API.",
  url: "https://aevion.app/mapreality",
  operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function MapRealityPage() {
  const [active, setActive] = useState<Set<Category>>(
    new Set(["medical", "volunteer", "tools", "info", "emergency"]),
  );
  const [hover, setHover] = useState<Signal | null>(null);
  const [form, setForm] = useState({ text: "", region: REGIONS[0], category: "medical" as Category });
  const [toast, setToast] = useState<string | null>(null);

  const visible = useMemo(() => SIGNALS.filter((s) => active.has(s.category)), [active]);

  function toggle(c: Category) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.text.trim()) return;
    setToast("1/2 Signing via QSign…");
    setTimeout(() => {
      setToast("2/2 Signal published (pending verification)");
      setTimeout(() => setToast(null), 2200);
    }, 900);
    setForm({ text: "", region: REGIONS[0], category: "medical" });
  }

  const apiSample = `GET /api/mapreality/signals?category=medical&region=almaty`;
  const apiResp = `{
  "signals": [
    {
      "id": "s1",
      "category": "medical",
      "title": "Нужны 3 врача общей практики",
      "region": "almaty",
      "urgency": 3,
      "qsign": "qs:8a7f…2c1b",
      "createdAt": "2026-05-11T08:14:02Z"
    }
  ],
  "total": 1,
  "auditLog": "https://aevion.app/qsign/audit/s1"
}`;

  return (
    <main className="min-h-screen bg-[#04080d] text-slate-100">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSONLD) }} />

      <header className="border-b border-cyan-500/20 bg-[#04080d]/90 px-5 py-3 backdrop-blur sticky top-0 z-30">
        <Link href="/" className="text-sm text-cyan-300 hover:text-cyan-200">
          ← AEVION · <span className="font-semibold">MapReality</span> ·{" "}
          <span className="ml-1 rounded bg-cyan-500/15 px-2 py-0.5 text-xs text-cyan-200 ring-1 ring-cyan-400/30">IDEA</span>
        </Link>
      </header>

      <section className="mx-auto max-w-6xl px-5 pt-12 pb-6 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          The map editors{" "}
          <span className="bg-gradient-to-r from-cyan-300 to-teal-300 bg-clip-text text-transparent">don&apos;t show you.</span>
        </h1>
        <p className="mt-4 max-w-2xl mx-auto text-slate-300">
          Гражданские сигналы с гео-привязкой — где нужны врачи, волонтёры, инструменты, информация. Без редакторского
          фильтра. Каждый источник аудируется через QSign.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-4">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {(Object.keys(CATS) as Category[]).map((c) => {
            const on = active.has(c);
            return (
              <button
                key={c}
                onClick={() => toggle(c)}
                className={`rounded-full px-3 py-1 text-xs ring-1 transition ${
                  on
                    ? "bg-cyan-500/15 text-cyan-200 ring-cyan-400/40"
                    : "bg-slate-900/60 text-slate-400 ring-slate-700 hover:text-slate-200"
                }`}
              >
                <span className="mr-1">{CATS[c].icon}</span>
                {CATS[c].label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-10">
        <div className="rounded-2xl bg-gradient-to-b from-slate-900/80 to-[#06101a] p-3 ring-1 ring-cyan-400/15">
          <div className="relative">
            <svg viewBox="0 0 800 400" className="w-full h-auto" role="img" aria-label="Карта сигналов">
              <defs>
                <radialGradient id="bg" cx="50%" cy="50%" r="60%">
                  <stop offset="0%" stopColor="#0e2a3a" />
                  <stop offset="100%" stopColor="#04080d" />
                </radialGradient>
              </defs>
              <rect width="800" height="400" fill="url(#bg)" />
              <g stroke="#0e2a3a" strokeWidth="0.5">
                {Array.from({ length: 9 }).map((_, i) => (
                  <line key={`v${i}`} x1={(i + 1) * 80} y1="0" x2={(i + 1) * 80} y2="400" />
                ))}
                {Array.from({ length: 5 }).map((_, i) => (
                  <line key={`h${i}`} x1="0" y1={(i + 1) * 67} x2="800" y2={(i + 1) * 67} />
                ))}
              </g>
              <g fill="#0a1e2b" stroke="#0e3a52" strokeWidth="1">
                <path d="M80 140 Q160 100 260 130 T420 150 Q520 180 600 150 T780 170 L780 260 Q700 240 600 260 T420 270 Q300 290 200 270 T80 250 Z" />
                <path d="M120 90 Q200 70 300 90 T460 100 L460 130 Q360 130 260 120 T120 130 Z" opacity="0.6" />
                <path d="M500 290 Q600 280 700 300 T780 320 L780 360 Q680 350 580 340 T500 330 Z" opacity="0.6" />
              </g>

              {visible.map((s) => {
                const cat = CATS[s.category];
                const r = 5 + s.urgency * 3;
                return (
                  <g
                    key={s.id}
                    onMouseEnter={() => setHover(s)}
                    onMouseLeave={() => setHover(null)}
                    style={{ cursor: "pointer" }}
                  >
                    <circle cx={s.x} cy={s.y} r={r + 6} fill={cat.color} opacity="0.15">
                      <animate attributeName="r" values={`${r};${r + 12};${r}`} dur="2.4s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.35;0;0.35" dur="2.4s" repeatCount="indefinite" />
                    </circle>
                    <circle cx={s.x} cy={s.y} r={r} fill={cat.color} stroke="#04080d" strokeWidth="1.5" />
                    <text x={s.x} y={s.y + 4} textAnchor="middle" fontSize="11" pointerEvents="none">
                      {cat.icon}
                    </text>
                  </g>
                );
              })}
            </svg>

            {hover && (
              <div
                className="pointer-events-none absolute rounded-lg bg-[#04080d]/95 px-3 py-2 text-xs ring-1 ring-cyan-400/40 shadow-xl"
                style={{
                  left: `${Math.min((hover.x / 800) * 100, 70)}%`,
                  top: `${Math.min((hover.y / 400) * 100 + 4, 80)}%`,
                  maxWidth: 260,
                }}
              >
                <div className="font-semibold text-cyan-200">
                  {CATS[hover.category].icon} {hover.title}
                </div>
                <div className="mt-0.5 text-slate-400">📍 {hover.region}</div>
                <div className="mt-1 inline-block rounded bg-cyan-500/15 px-2 py-0.5 text-[10px] text-cyan-200 ring-1 ring-cyan-400/30">
                  QSIGN · {hover.hash}
                </div>
              </div>
            )}
          </div>
          <div className="px-2 pt-2 pb-1 text-xs text-slate-500">
            {visible.length} сигналов · радиус пульса = срочность · наведите курсор для деталей
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-10">
        <form
          onSubmit={submit}
          className="rounded-2xl bg-slate-900/60 p-5 ring-1 ring-slate-800"
        >
          <h2 className="text-lg font-semibold text-cyan-200">Подать сигнал</h2>
          <p className="mt-1 text-sm text-slate-400">Опишите потребность — подписывается через QSign.</p>

          <textarea
            value={form.text}
            onChange={(e) => setForm({ ...form, text: e.target.value })}
            placeholder="Опишите потребность: что, сколько, к какому сроку…"
            className="mt-3 w-full min-h-[90px] rounded-lg bg-[#04080d] px-3 py-2 text-sm ring-1 ring-slate-800 focus:ring-cyan-400/40 focus:outline-none"
            required
          />

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs text-slate-400">
              Регион
              <select
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                className="mt-1 w-full rounded-lg bg-[#04080d] px-3 py-2 text-sm text-slate-200 ring-1 ring-slate-800 focus:ring-cyan-400/40 focus:outline-none"
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-400">
              Категория
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as Category })}
                className="mt-1 w-full rounded-lg bg-[#04080d] px-3 py-2 text-sm text-slate-200 ring-1 ring-slate-800 focus:ring-cyan-400/40 focus:outline-none"
              >
                {(Object.keys(CATS) as Category[]).map((c) => (
                  <option key={c} value={c}>
                    {CATS[c].icon} {CATS[c].label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="submit"
            className="mt-4 rounded-lg bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-200 ring-1 ring-cyan-400/40 hover:bg-cyan-500/30"
          >
            Подать сигнал
          </button>
        </form>
      </section>

      <section className="mx-auto max-w-4xl px-5 pb-12">
        <h2 className="text-lg font-semibold text-cyan-200">Open API</h2>
        <p className="mt-1 text-sm text-slate-400">
          Любой может построить свою визуализацию. Без vendor-lock, без редакторского API-токена.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-[#04080d] p-4 text-xs text-cyan-200 ring-1 ring-cyan-400/20">
{apiSample}
        </pre>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-[#04080d] p-4 text-xs text-slate-300 ring-1 ring-slate-800">
{apiResp}
        </pre>
      </section>

      <section className="mx-auto max-w-4xl px-5 pb-16">
        <h3 className="text-sm uppercase tracking-wider text-slate-500">Связанные модули</h3>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href="/planet" className="rounded-xl bg-slate-900/60 p-4 ring-1 ring-slate-800 hover:ring-cyan-400/40 transition">
            <div className="font-semibold text-cyan-200">AEVION Planet</div>
            <div className="mt-1 text-xs text-slate-400">Compliance + сертификаты — слой, поверх которого нарастает MapReality.</div>
          </Link>
          <Link href="/qsign" className="rounded-xl bg-slate-900/60 p-4 ring-1 ring-slate-800 hover:ring-cyan-400/40 transition">
            <div className="font-semibold text-cyan-200">QSign</div>
            <div className="mt-1 text-xs text-slate-400">Подпись источников сигнала — anti-fake-signal защита.</div>
          </Link>
          <Link href="/qchaingov" className="rounded-xl bg-slate-900/60 p-4 ring-1 ring-slate-800 hover:ring-cyan-400/40 transition">
            <div className="font-semibold text-cyan-200">QChainGov</div>
            <div className="mt-1 text-xs text-slate-400">DAO-губернатор — куда MapReality передаёт сигналы на голосование.</div>
          </Link>
        </div>
      </section>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-[#04080d] px-4 py-3 text-sm text-cyan-200 ring-1 ring-cyan-400/40 shadow-xl">
          {toast}
        </div>
      )}
    </main>
  );
}
