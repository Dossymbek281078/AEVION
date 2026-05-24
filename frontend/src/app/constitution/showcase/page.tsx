"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  classify,
  PRESETS,
  SLIDER_META,
  SLIDER_SHORT_LABELS,
  type Sliders,
} from "@/lib/constitution";
import { useFunnel } from "@/lib/useFunnel";

const SHOWCASE_PRESETS = [
  "Open Access (идеал)",
  "Скандинавская",
  "Авторитарная",
  "Феодализм",
];

const ACADEMIC_QUOTES = [
  {
    text: "Открытые порядки — это режимы, в которых элиты конкурируют, но не уничтожают друг друга, потому что правила одинаковы.",
    cite: "North, Wallis & Weingast",
    work: "Violence and Social Orders",
  },
  {
    text: "Включающие институты делают пирог растущим. Извлекающие — фиксируют его.",
    cite: "Acemoglu & Robinson",
    work: "Why Nations Fail",
  },
  {
    text: "Общие ресурсы лучше всего управляются полицентричными сообществами, не централизованным государством.",
    cite: "Elinor Ostrom",
    work: "Governing the Commons",
  },
  {
    text: "Кто принимает решение, должен лично нести его последствия.",
    cite: "Nassim Taleb",
    work: "Skin in the Game",
  },
];

const CODE_SAMPLE = `// 1 строка → получи 10 режимов
const r = await fetch(
  "https://aevion.app/api-backend/api/constitution/public/regimes"
);
const { items } = await r.json();
console.log(items[0].id); // "open-access"`;

export default function ConstitutionShowcasePage() {
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const { track } = useFunnel();

  useEffect(() => { track("page_view", { source: "showcase" }); }, [track]);

  // Auto-cycle hero preset every 4 seconds
  useEffect(() => {
    const t = setInterval(() => setActiveIdx((i) => (i + 1) % SHOWCASE_PRESETS.length), 4000);
    return () => clearInterval(t);
  }, []);

  const preset = useMemo(() => {
    const name = SHOWCASE_PRESETS[activeIdx];
    return PRESETS.find((p) => p.name === name) ?? PRESETS[0];
  }, [activeIdx]);

  const sliders = preset.sliders;
  const regime = useMemo(() => classify(sliders), [sliders]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b1736] via-[#131f3d] to-[#050a1a] text-[#e7ecf8]">
      {/* HERO */}
      <section className="px-6 pt-16 pb-12">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-xs uppercase tracking-widest text-[#d4af37] mb-3">
              AEVION · Constitution
            </div>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight text-[#d4af37]">
              Устройство мира на 8 ползунках
            </h1>
            <p className="mt-5 text-[#e7ecf8] text-lg leading-relaxed">
              Open Access vs Nordic vs Authoritarian — одной анимацией.
              Подкрути ползунки, получи исторический режим. AI-советник
              расскажет, какие именно параметры менять.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/constitution"
                className="px-6 py-3 rounded-lg bg-[#d4af37] text-[#0b1736] font-bold hover:opacity-90"
              >
                Try it free →
              </Link>
              <Link
                href="/constitution/learn"
                className="px-6 py-3 rounded-lg border border-emerald-400/40 text-emerald-300 font-semibold hover:bg-emerald-500/10"
              >
                🎓 Academy
              </Link>
              <Link
                href="/constitution/pricing"
                className="px-6 py-3 rounded-lg border border-fuchsia-400/40 text-fuchsia-300 font-semibold hover:bg-fuchsia-500/10"
              >
                💎 Pricing
              </Link>
            </div>
            <div className="mt-6 text-xs text-[#9aa3c0]">
              Open-source · QSign-подписанные сценарии · 11 языков
            </div>
          </div>
          <div className="flex justify-center">
            <ShowcaseRadar sliders={sliders} label={preset.name} regime={regime.name} />
          </div>
        </div>
      </section>

      {/* SECTION 1: What */}
      <section className="px-6 py-12 bg-[#0b1736]/40">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-[#f5d27a] mb-4">
            Что это вообще
          </h2>
          <p className="text-[#e7ecf8] leading-relaxed mb-3">
            Constitution — это интерактивный симулятор политэкономии. Восемь
            ползунков измеряют четыре опоры любого общества: <b>пол снизу</b>{" "}
            (UBI, образование, медицина), <b>закон над верхом</b> (rule of
            law), <b>ротация и множественные статусы</b> (sortition, axes
            of respect), и <b>растущий пирог</b> (positive sum).
          </p>
          <p className="text-[#9aa3c0] leading-relaxed">
            Двигаешь — видишь, в какой исторический режим скатывается система.
            10 классифицированных режимов от <i>Open Access Order</i> до{" "}
            <i>Тоталитарной диктатуры</i>.
          </p>
        </div>
      </section>

      {/* SECTION 2: Why 8 sliders */}
      <section className="px-6 py-12">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-[#f5d27a] mb-6 text-center">
            Почему именно 8 ползунков
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Pillar
              num={1}
              title="Floor below — пол снизу"
              text="UBI, образование, здравоохранение. Когда у людей есть, что терять, исчезает экзистенциальная мотивация отнимать."
              sliders={["floor"]}
            />
            <Pillar
              num={2}
              title="Law above — закон над верхом"
              text="Олигарх тоже проигрывает в суде. Закон одинаково применяется к министру и к рыбаку. Снижает интра-элитную вражду."
              sliders={["ruleOfLaw", "transparency"]}
            />
            <Pillar
              num={3}
              title="Rotation & status — ротация и статусы"
              text="Афинский жребий + многомерное уважение. Кто захочет уйти — уходит, кому надо подняться — поднимается, и никто не борется за один-единственный приз."
              sliders={["rotation", "multiStatus", "polycentricity"]}
            />
            <Pillar
              num={4}
              title="Growing pie — растущий пирог"
              text="Без positiveSum никакая реформа не держится. Феодализм 800 лет именно потому, что экономика не росла."
              sliders={["skinInGame", "positiveSum"]}
            />
          </div>
        </div>
      </section>

      {/* SECTION 3: Academic quotes */}
      <section className="px-6 py-12 bg-[#0b1736]/40">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-[#f5d27a] mb-6 text-center">
            На чьих плечах
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ACADEMIC_QUOTES.map((q, i) => (
              <blockquote
                key={i}
                className="border-l-4 border-[#d4af37]/40 pl-4 py-2"
              >
                <p className="text-[#e7ecf8] italic mb-2">"{q.text}"</p>
                <div className="text-xs text-[#9aa3c0]">
                  — <b className="text-[#d4af37]">{q.cite}</b> ·{" "}
                  <i>{q.work}</i>
                </div>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 4: Open API */}
      <section className="px-6 py-12">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-[#f5d27a] mb-4 text-center">
            Open API + open source
          </h2>
          <p className="text-[#9aa3c0] text-center mb-6 max-w-2xl mx-auto">
            22 endpoints для интеграций. Public REST с 1h cache. Боты,
            research-тулзы, AI-агенты тянут конституционную таксономию одним
            cacheable GET.
          </p>
          <div className="bg-[#050a1a] border border-[#d4af37]/20 rounded-xl p-5 max-w-2xl mx-auto mb-4">
            <pre className="text-xs font-mono text-[#e7ecf8] overflow-x-auto whitespace-pre">
              {CODE_SAMPLE}
            </pre>
          </div>
          <div className="text-center">
            <Link
              href="/constitution/api"
              className="text-cyan-300 hover:underline"
            >
              → Developer Playground (try-now кнопки)
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 5: Pricing teaser */}
      <section className="px-6 py-12 bg-[#0b1736]/40">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-[#f5d27a] mb-2">
            $0 → $9 → $49
          </h2>
          <p className="text-[#9aa3c0] mb-6">
            Free навсегда. Pro для исследователей. Team для классов и
            think-tanks.
          </p>
          <Link
            href="/constitution/pricing"
            className="inline-block px-6 py-3 rounded-lg bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-[#0b1736] font-bold hover:opacity-90"
          >
            💎 Смотреть тарифы →
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-[#d4af37] mb-4">
            Готов попробовать?
          </h2>
          <p className="text-[#9aa3c0] mb-6">
            2 минуты на онбординг. Никакой регистрации. Никаких email
            предварительно.
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            <Link
              href="/constitution/welcome"
              className="px-8 py-4 rounded-lg bg-[#d4af37] text-[#0b1736] font-bold text-lg hover:opacity-90"
            >
              Начать с онбординга →
            </Link>
            <Link
              href="/constitution"
              className="px-8 py-4 rounded-lg border border-[#d4af37]/40 text-[#d4af37] font-semibold text-lg hover:bg-[#d4af37]/10"
            >
              Сразу в редактор
            </Link>
          </div>
        </div>
      </section>

      <footer className="px-6 py-8 text-center text-xs text-[#9aa3c0] border-t border-[#d4af37]/15">
        <p>
          AEVION Constitution · Open-source · QSign-signed scenarios · 11 langs
          ·{" "}
          <a
            href="mailto:support@aevion.app"
            className="text-[#d4af37] hover:underline"
          >
            support@aevion.app
          </a>
        </p>
      </footer>
    </div>
  );
}

function ShowcaseRadar({
  sliders,
  label,
  regime,
}: {
  sliders: Sliders;
  label: string;
  regime: string;
}) {
  const W = 400;
  const H = 400;
  const cx = W / 2;
  const cy = H / 2;
  const r = 140;
  const n = SLIDER_META.length;
  const angleFor = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pointAt = (i: number, val: number) => {
    const a = angleFor(i);
    const rad = (val / 100) * r;
    return { x: cx + rad * Math.cos(a), y: cy + rad * Math.sin(a) };
  };
  const polygonPoints = SLIDER_META
    .map((m, i) => {
      const p = pointAt(i, sliders[m.key]);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="text-center">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-md transition-all duration-700">
        {[25, 50, 75, 100].map((pct) => (
          <circle
            key={pct}
            cx={cx}
            cy={cy}
            r={(pct / 100) * r}
            fill="none"
            stroke="#d4af37"
            strokeOpacity={pct === 100 ? 0.4 : 0.15}
            strokeDasharray={pct === 100 ? undefined : "3 4"}
          />
        ))}
        {SLIDER_META.map((m, i) => {
          const outer = pointAt(i, 100);
          const labelPos = pointAt(i, 118);
          const a = angleFor(i);
          const anchor = Math.cos(a) > 0.3 ? "start" : Math.cos(a) < -0.3 ? "end" : "middle";
          return (
            <g key={m.key}>
              <line x1={cx} y1={cy} x2={outer.x} y2={outer.y} stroke="#d4af37" strokeOpacity={0.2} />
              <text x={labelPos.x} y={labelPos.y} fill="#9aa3c0" fontSize="10" textAnchor={anchor} dominantBaseline="middle">
                {SLIDER_SHORT_LABELS[m.key]}
              </text>
            </g>
          );
        })}
        <polygon
          points={polygonPoints}
          fill="#22d3ee"
          fillOpacity={0.32}
          stroke="#0891b2"
          strokeWidth={2}
          style={{ transition: "all 700ms ease-out" }}
        />
        {SLIDER_META.map((m, i) => {
          const p = pointAt(i, sliders[m.key]);
          return <circle key={m.key} cx={p.x} cy={p.y} r={3} fill="#0891b2" />;
        })}
      </svg>
      <div className="mt-2 text-sm text-[#9aa3c0]">{label}</div>
      <div className="text-lg font-bold text-[#d4af37]">{regime}</div>
    </div>
  );
}

function Pillar({
  num,
  title,
  text,
  sliders,
}: {
  num: number;
  title: string;
  text: string;
  sliders: string[];
}) {
  return (
    <div className="bg-[#0b1736]/60 border border-[#d4af37]/20 rounded-xl p-5">
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-3xl font-bold text-[#d4af37]/40">0{num}</span>
        <h3 className="text-lg font-bold text-[#f5d27a]">{title}</h3>
      </div>
      <p className="text-sm text-[#e7ecf8] mb-2">{text}</p>
      <div className="flex flex-wrap gap-1">
        {sliders.map((s) => (
          <code
            key={s}
            className="text-xs px-2 py-0.5 rounded bg-[#d4af37]/10 text-[#d4af37]"
          >
            {s}
          </code>
        ))}
      </div>
    </div>
  );
}
