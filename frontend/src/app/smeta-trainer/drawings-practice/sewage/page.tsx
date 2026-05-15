"use client";
import Link from "next/link";
import { useState } from "react";
import { DimLine, HatchFill, Arrow, LevelMark, DrawingTitle } from "../_svg";

function check(i: string, a: string[]) {
  const v = parseFloat(i.replace(",", "."));
  return a.some((x) => {
    const e = parseFloat(x.replace(",", "."));
    return !isNaN(v) && !isNaN(e) && Math.abs((v - e) / e) < 0.025;
  });
}

// ── SVG: Продольный профиль самотечной канализации ─────────────────────────
function SewageSVG({ hl }: { hl: Set<string> }) {
  // Геометрия: 2 колодца на расстоянии 30 м, глубина 2.5 м, уклон i=0.008
  // Масштаб по длине очень другой, чем по глубине — продольный профиль традиционно.
  const OX = 90;        // левый край (КК-1)
  const OY = 50;        // отметка земли в SVG
  const LX = 480;       // длина прогона трубы по X (px) — 30 м
  const SY = 80;        // вертикальный масштаб: 1 м = 80 px (для глубины)
  const DEPTH1 = 2.5 * SY; // глубина КК-1 = 2.5 м
  const DROP = 0.008 * 30 * SY; // перепад трубы 0.24 м → 19.2 px
  const PIPE_D = 16;    // Ø200 на чертеже (условно толще для видимости)
  const BED = 8;        // основание 100 мм (условно)
  const MH_W = 36;      // диаметр колодца на чертеже (условно для Ø1000)
  const MH_WALL = 4;
  const COVER_H = 10;

  // Координаты ключевых точек
  const x1 = OX;                 // ось КК-1
  const x2 = OX + LX;            // ось КК-2
  const yGround = OY;
  const yPipe1Top = OY + DEPTH1;            // верх трубы у КК-1
  const yPipe2Top = OY + DEPTH1 + DROP;     // верх трубы у КК-2
  const yPipe1Bot = yPipe1Top + PIPE_D;
  const yPipe2Bot = yPipe2Top + PIPE_D;
  const yBed1Top = yPipe1Bot;
  const yBed1Bot = yBed1Top + BED;
  const yBed2Bot = yPipe2Bot + BED;

  return (
    <svg viewBox="0 0 680 380" className="w-full h-auto" style={{ maxHeight: 380 }}>
      {/* Заголовок */}
      <g transform="translate(20, 18)">
        <DrawingTitle
          title="Продольный профиль К1 · самотёчная канализация"
          subtitle="ПВХ Ø200 · L=30.0 м · i=0.008 · h=2.50 м"
          scale="1:50 / 1:200"
          number="Школа №47 · К1-01"
        />
      </g>

      {/* Линия земли */}
      <line
        x1={OX - 50}
        y1={yGround}
        x2={x2 + 60}
        y2={yGround}
        stroke="#475569"
        strokeWidth={1.6}
      />
      {/* Штриховка грунта (тонкая полоса вдоль земли) */}
      <HatchFill x={OX - 50} y={yGround - 12} w={x2 + 60 - (OX - 50)} h={12} color="#c4a26a" spacing={10} />

      {/* Засыпка над трубой (от верха трубы + 300мм до земли — фон) */}
      <rect
        x={OX}
        y={yGround + 1}
        width={LX}
        height={DEPTH1 - 0.3 * SY}
        fill={hl.has("backfill") ? "rgba(251,191,36,0.18)" : "rgba(203,213,225,0.25)"}
      />

      {/* Зона засыпки пазух песком (300 мм над верхом трубы) — отдельным цветом */}
      <polygon
        points={`
          ${OX},${yPipe1Top - 0.3 * SY}
          ${x2},${yPipe2Top - 0.3 * SY}
          ${x2},${yPipe2Top}
          ${OX},${yPipe1Top}
        `}
        fill={hl.has("sand-cover") ? "#fde68a" : "#fef3c7"}
        stroke="#d97706"
        strokeWidth={0.8}
        strokeDasharray="3 2"
        opacity={0.7}
      />
      <text
        x={(OX + x2) / 2}
        y={yPipe1Top - 0.3 * SY / 2 + 3}
        textAnchor="middle"
        fontSize={8}
        fill="#92400e"
      >
        засыпка пазух песком h=300мм над трубой
      </text>

      {/* Песчаное основание под трубой (100 мм) */}
      <polygon
        points={`
          ${OX},${yBed1Top}
          ${x2},${yPipe2Bot}
          ${x2},${yBed2Bot}
          ${OX},${yBed1Bot}
        `}
        fill={hl.has("bed") ? "#fde68a" : "#fef3c7"}
        stroke={hl.has("bed") ? "#f59e0b" : "#d97706"}
        strokeWidth={1.2}
      />
      <text
        x={(OX + x2) / 2}
        y={(yBed1Bot + yBed2Bot) / 2 + 3}
        textAnchor="middle"
        fontSize={8}
        fill={hl.has("bed") ? "#92400e" : "#b45309"}
      >
        Песчаное основание 100 мм
      </text>

      {/* Труба ПВХ Ø200 — две параллельные линии (верх и низ) с уклоном */}
      <polygon
        points={`
          ${OX},${yPipe1Top}
          ${x2},${yPipe2Top}
          ${x2},${yPipe2Bot}
          ${OX},${yPipe1Bot}
        `}
        fill={hl.has("pipe") ? "#bfdbfe" : "#dbeafe"}
        stroke={hl.has("pipe") ? "#1d4ed8" : "#2563eb"}
        strokeWidth={1.6}
      />
      <text
        x={(OX + x2) / 2}
        y={(yPipe1Top + yPipe1Bot + yPipe2Top + yPipe2Bot) / 4 + 3}
        textAnchor="middle"
        fontSize={9}
        fontWeight="600"
        fill="#1e3a8a"
      >
        ПВХ Ø200 · i=0.008
      </text>

      {/* Колодец КК-1 (слева) — разрез круглого колодца Ø1000 */}
      <g>
        {/* Внешние стенки */}
        <rect
          x={x1 - MH_W / 2 - MH_WALL}
          y={yGround - COVER_H}
          width={MH_W + 2 * MH_WALL}
          height={DEPTH1 + COVER_H + BED + 6}
          fill="#e2e8f0"
          stroke={hl.has("manhole") ? "#1d4ed8" : "#475569"}
          strokeWidth={hl.has("manhole") ? 2 : 1.4}
        />
        {/* Внутренняя полость */}
        <rect
          x={x1 - MH_W / 2}
          y={yGround - COVER_H + 4}
          width={MH_W}
          height={DEPTH1 + COVER_H - 4}
          fill="#f8fafc"
          stroke="#94a3b8"
          strokeWidth={0.8}
        />
        {/* Лоток (сток на дне) */}
        <rect
          x={x1 - MH_W / 2}
          y={yPipe1Bot - 2}
          width={MH_W}
          height={6}
          fill="#cbd5e1"
          stroke="#64748b"
          strokeWidth={0.6}
        />
        {/* Люк */}
        <rect
          x={x1 - 8}
          y={yGround - COVER_H}
          width={16}
          height={3}
          fill="#1e293b"
        />
        <text x={x1} y={yGround - COVER_H - 4} textAnchor="middle" fontSize={9} fontWeight="700" fill="#1e293b">
          КК-1
        </text>
      </g>

      {/* Колодец КК-2 (справа) — глубже на 0.24 м */}
      <g>
        <rect
          x={x2 - MH_W / 2 - MH_WALL}
          y={yGround - COVER_H}
          width={MH_W + 2 * MH_WALL}
          height={DEPTH1 + DROP + COVER_H + BED + 6}
          fill="#e2e8f0"
          stroke={hl.has("manhole") ? "#1d4ed8" : "#475569"}
          strokeWidth={hl.has("manhole") ? 2 : 1.4}
        />
        <rect
          x={x2 - MH_W / 2}
          y={yGround - COVER_H + 4}
          width={MH_W}
          height={DEPTH1 + DROP + COVER_H - 4}
          fill="#f8fafc"
          stroke="#94a3b8"
          strokeWidth={0.8}
        />
        <rect
          x={x2 - MH_W / 2}
          y={yPipe2Bot - 2}
          width={MH_W}
          height={6}
          fill="#cbd5e1"
          stroke="#64748b"
          strokeWidth={0.6}
        />
        <rect
          x={x2 - 8}
          y={yGround - COVER_H}
          width={16}
          height={3}
          fill="#1e293b"
        />
        <text x={x2} y={yGround - COVER_H - 4} textAnchor="middle" fontSize={9} fontWeight="700" fill="#1e293b">
          КК-2
        </text>
      </g>

      {/* Отметки уровней — слева у КК-1 */}
      <LevelMark x={OX - MH_W / 2 - MH_WALL - 8} y={yGround} label="▽ 0.000 (земля)" side="left" />
      <LevelMark x={OX - MH_W / 2 - MH_WALL - 8} y={yPipe1Bot} label="▽ −2.700 (низ трубы)" side="left" />

      {/* Отметки уровней — справа у КК-2 */}
      <LevelMark x={x2 + MH_W / 2 + MH_WALL + 8} y={yGround} label="▽ 0.000" side="right" />
      <LevelMark x={x2 + MH_W / 2 + MH_WALL + 8} y={yPipe2Bot} label="▽ −2.940" side="right" />

      {/* Размер: глубина заложения у КК-1 */}
      <DimLine
        x1={OX - 70}
        y1={yGround}
        x2={OX - 70}
        y2={yPipe1Top}
        label="h=2.50 м"
      />
      {/* Размер: расстояние между колодцами */}
      <DimLine
        x1={OX}
        y1={yGround - 28}
        x2={x2}
        y2={yGround - 28}
        label="L = 30.0 м"
      />
      {/* Размер: диаметр трубы (показ Ø200) */}
      <g>
        <line
          x1={(OX + x2) / 2 - 30}
          y1={(yPipe1Top + yPipe2Top) / 2}
          x2={(OX + x2) / 2 - 30}
          y2={(yPipe1Bot + yPipe2Bot) / 2}
          stroke="#94a3b8"
          strokeWidth={0.8}
        />
        <text
          x={(OX + x2) / 2 - 38}
          y={(yPipe1Top + yPipe1Bot + yPipe2Top + yPipe2Bot) / 4 + 3}
          textAnchor="end"
          fontSize={9}
          fill="#475569"
          fontStyle="italic"
        >
          Ø200
        </text>
      </g>

      {/* Уклон — стрелка вдоль трубы */}
      <Arrow
        x1={OX + 60}
        y1={yPipe1Top - 14}
        x2={x2 - 60}
        y2={yPipe2Top - 14 + (yPipe2Top - yPipe1Top)}
        color="#0d9488"
      />
      <text
        x={(OX + x2) / 2}
        y={yPipe1Top - 18}
        textAnchor="middle"
        fontSize={9}
        fill="#0d9488"
        fontWeight="600"
      >
        i = 0.008 (8‰) → Δh = 0.24 м
      </text>
    </svg>
  );
}

const STEPS = [
  {
    id: "trench-vol",
    hl: ["bed"],
    title: "Объём траншеи под канализацию",
    q:
      "Канализация ПВХ Ø200, прокладка между КК-1 и КК-2: L=30 м, глубина h=2.5 м. " +
      "По СНиП РК 3.05.04-2002 для Ø200 ширина траншеи по дну b=0.9 м. " +
      "Грунт суглинок (II гр.), откос m=0.5. Сечение — трапеция. Рассчитайте объём грунта.",
    ss: [
      {
        id: "top",
        l: "Ширина по верху, м",
        a: ["3.4", "3,4"],
        e: "0.90 + 2×(0.50×2.50) = 0.90 + 2.50 = 3.40 м",
      },
      {
        id: "sect",
        l: "Площадь поперечного сечения, м²",
        a: ["5.375", "5,375", "5.38", "5,38"],
        e: "(0.90 + 3.40)/2 × 2.50 = 4.30/2 × 2.50 = 5.375 м²",
      },
      {
        id: "vol",
        l: "Объём разработки грунта, м³",
        a: ["161.25", "161,25", "161.3", "161"],
        e: "5.375 × 30.0 = 161.25 м³ (формула призматоида V = ((b₁+b₂)/2)·h·L)",
      },
    ],
    vor:
      "Разработка грунта в траншее под канализацию (II гр.): 5.375×30.0 = 161.25 м³ " +
      "(СНиП РК 3.05.04-2002, ЭСН РК Сб.1-01-013)",
    theory:
      "Под напорные/самотёчные канализационные сети траншея считается как призматоид: " +
      "V = ((bдна + bверха)/2) × h × L. Откосы по табл.4 СНиП РК 5.01-15: для суглинка глубиной до 3 м — m=0.5.",
  },
  {
    id: "bed",
    hl: ["bed"],
    title: "Объём песчаного основания (подушки)",
    q:
      "Под трубу ПВХ Ø200 укладывается песчаное основание толщиной 100 мм по " +
      "спланированному дну траншеи. Ширина по низу b=0.9 м, длина L=30 м. " +
      "Подушка укладывается без откосов (внутри траншеи на ровное дно).",
    ss: [
      {
        id: "vol",
        l: "Объём песчаного основания, м³",
        a: ["2.7", "2,7"],
        e: "0.10 × 0.90 × 30.0 = 2.70 м³",
      },
    ],
    vor:
      "Песчаное основание h=100 мм под ПВХ Ø200: 0.10×0.90×30.0 = 2.70 м³ " +
      "(СНиП РК 3.05.04-2002, ЭСН РК Сб.1-03-001)",
    theory:
      "Песчаное основание для ПВХ-труб обязательно (СНиП РК 3.05.04-2002 п. 5.2). " +
      "Толщина 100–150 мм в зависимости от грунта. На скале и валунных грунтах — до 200 мм.",
  },
  {
    id: "slope",
    hl: ["pipe"],
    title: "Перепад отметок при уклоне i=0.008",
    q:
      "Самотёчная канализация ПВХ Ø200 уложена с нормативным уклоном i=0.008 (8‰). " +
      "Расстояние между колодцами L=30 м. Рассчитайте перепад отметок лотков " +
      "трубы между КК-1 и КК-2 (на сколько ниже КК-2 опущена труба).",
    ss: [
      {
        id: "dh",
        l: "Перепад Δh, м",
        a: ["0.24", "0,24"],
        e:
          "Δh = i × L = 0.008 × 30 = 0.24 м. Это нужно учесть в глубине КК-2: " +
          "если КК-1 имеет глубину 2.50 м, то КК-2 будет на 2.50 + 0.24 = 2.74 м.",
      },
    ],
    vor:
      "Перепад труб КК-1 → КК-2 при i=0.008 на L=30 м: Δh = 0.24 м " +
      "(СНиП РК 4.01-41-2006 табл.16 — мин. уклон Ø200: i=0.005, рекомендуемый i=0.008)",
    theory:
      "Минимальный уклон самотёчных канализационных труб (СНиП РК 4.01-41-2006): " +
      "Ø150 — i=0.008, Ø200 — i=0.005 (рекоменд. 0.007–0.008), Ø250 — i=0.004. " +
      "Малый уклон → засоры; большой → размыв трубы и шум.",
  },
];

export default function SewagePage() {
  const [xi, sxi] = useState(0);
  const [si, ssi] = useState(0);
  const [inp, setInp] = useState<Record<string, string>>({});
  const [rev, setRev] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Set<string>>(new Set());
  const ex = STEPS[xi];
  const step = ex.ss[si];
  const k = `${ex.id}-${step.id}`;
  const ok = rev[k] && check(inp[k] ?? "", step.a);
  const err = rev[k] && !ok;
  function go() {
    setRev((r) => ({ ...r, [k]: true }));
    if (check(inp[k] ?? "", step.a)) {
      setTimeout(() => {
        if (si + 1 < ex.ss.length) {
          ssi(si + 1);
          setRev({});
        } else {
          setDone((d) => new Set([...d, ex.id]));
        }
      }, 700);
    }
  }
  const allDone = done.size === STEPS.length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-teal-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-teal-200 hover:text-white"
          >
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">🚰 Канализация — наружные сети</h1>
            <p className="text-[10px] text-teal-200">
              СНиП РК 4.01-41-2006 · ЭСН РК Сб.22 · {done.size}/{STEPS.length} пройдено
            </p>
          </div>
          <Link
            href="/smeta-trainer/drawings-practice/normatives#sewage"
            className="text-[10px] bg-teal-900 text-teal-200 px-2 py-1 rounded hover:bg-teal-800"
          >
            📋 Нормативы
          </Link>
        </div>
      </header>

      {allDone ? (
        <div className="max-w-2xl mx-auto py-16 text-center px-4">
          <div className="text-5xl mb-3">🚰</div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            Канализация освоена!
          </h2>
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg p-4 text-left mb-4 text-xs space-y-1">
            {STEPS.map((s) => (
              <div key={s.id} className="flex gap-2">
                <span className="text-emerald-500">✓</span>
                <code className="text-[10px] font-mono">{s.vor}</code>
              </div>
            ))}
          </div>
          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={() => {
                sxi(0);
                ssi(0);
                setInp({});
                setRev({});
                setDone(new Set());
              }}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-sm font-semibold rounded-lg"
            >
              Снова
            </button>
            <Link
              href="/smeta-trainer/drawings-practice/hub"
              className="px-4 py-2 bg-teal-700 text-white text-sm font-semibold rounded-lg"
            >
              → К разделам
            </Link>
          </div>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-3">
            <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
              <SewageSVG hl={new Set(ex.hl)} />
              {ex.theory && (
                <div className="mt-2 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-700 rounded p-2 text-[10px] text-teal-800 dark:text-teal-300">
                  📖 {ex.theory}
                </div>
              )}
            </div>

            {/* Нормативный блок */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-3 text-xs text-blue-900 dark:text-blue-200">
              <div className="font-bold mb-1.5 text-sm">📘 Нормативная база</div>
              <ul className="space-y-1 list-disc list-inside leading-relaxed">
                <li>
                  <b>СНиП РК 4.01-41-2006</b> «Канализация. Наружные сети и сооружения» —
                  основной норматив проектирования и устройства.
                </li>
                <li>
                  <b>Минимальный уклон</b> для самотёчных труб Ø200: <code>i=0.005</code>,
                  рекомендуемый <code>i=0.007–0.008</code> (табл. 16).
                </li>
                <li>
                  <b>Минимальная глубина заложения</b>: hпром + 0.3 м.
                  Для Алматы hпром=1.2 м → итого ≥ <b>1.5 м</b>.
                  В нашем примере h=2.5 м — с запасом.
                </li>
                <li>
                  <b>Колодцы</b>: круглые КК Ø1000 мм по серии <b>3.900.1-14</b>
                  (типовой проект сборных ЖБ-колодцев).
                </li>
                <li>
                  <b>Песчаное основание</b>: 100–150 мм по СНиП РК 3.05.04-2002, п. 5.2
                  (для ПВХ-труб обязательно). Засыпка пазух песком до отметки
                  «верх трубы + 300 мм».
                </li>
              </ul>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex gap-1 flex-wrap">
              {STEPS.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => {
                    sxi(i);
                    ssi(0);
                    setInp({});
                    setRev({});
                  }}
                  className={`text-[10px] px-2 py-1 rounded font-semibold ${
                    i === xi
                      ? "bg-teal-600 text-white"
                      : done.has(s.id)
                      ? "bg-teal-100 text-teal-800 dark:bg-teal-900/30"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {done.has(s.id) ? "✓" : i + 1}
                </button>
              ))}
            </div>

            <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                {ex.title}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                {ex.q}
              </p>
              {ex.ss.length > 1 && (
                <div className="flex gap-1 mb-3">
                  {ex.ss.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full ${
                        i < si
                          ? "bg-teal-500"
                          : i === si
                          ? "bg-teal-300"
                          : "bg-slate-200 dark:bg-slate-700"
                      }`}
                    />
                  ))}
                </div>
              )}
              {!done.has(ex.id) ? (
                <div
                  className={`border-2 rounded-lg p-3 ${
                    ok
                      ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
                      : err
                      ? "border-red-300 bg-red-50 dark:bg-red-900/20"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Шаг {si + 1}/{ex.ss.length}: {step.l}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inp[k] ?? ""}
                      onChange={(e) =>
                        setInp((p) => ({ ...p, [k]: e.target.value }))
                      }
                      onKeyDown={(e) => e.key === "Enter" && !rev[k] && go()}
                      disabled={!!rev[k]}
                      placeholder="Число..."
                      className="flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-teal-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                    />
                    {!rev[k] && (
                      <button
                        onClick={go}
                        disabled={!inp[k]?.trim()}
                        className="px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded hover:bg-teal-700 disabled:opacity-40"
                      >
                        Проверить
                      </button>
                    )}
                  </div>
                  {rev[k] && (
                    <div
                      className={`mt-2 text-xs leading-relaxed ${
                        ok
                          ? "text-emerald-800 dark:text-emerald-300"
                          : "text-red-800 dark:text-red-300"
                      }`}
                    >
                      {ok ? "✓ " : "✗ "}
                      {step.e}
                    </div>
                  )}
                  {err && (
                    <button
                      onClick={() => {
                        setInp((p) => ({ ...p, [k]: "" }));
                        setRev((r) => ({ ...r, [k]: false }));
                      }}
                      className="mt-1 text-[10px] text-amber-700 underline"
                    >
                      Попробовать снова
                    </button>
                  )}
                </div>
              ) : (
                <div className="border-2 border-teal-300 bg-teal-50 dark:bg-teal-900/20 rounded-lg p-3">
                  <div className="text-xs font-bold text-teal-800 dark:text-teal-300 mb-1">
                    ✓ Завершено
                  </div>
                  <code className="text-[10px] font-mono text-teal-700 dark:text-teal-400 block">
                    {ex.vor}
                  </code>
                </div>
              )}
            </div>

            {done.has(ex.id) && xi + 1 < STEPS.length && (
              <button
                onClick={() => {
                  sxi(xi + 1);
                  ssi(0);
                  setInp({});
                  setRev({});
                }}
                className="w-full py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700"
              >
                Следующее →
              </button>
            )}

            {/* Расценки ЭСН */}
            <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-[11px] text-slate-700 dark:text-slate-300">
              <div className="font-bold mb-1.5 text-xs text-slate-800 dark:text-slate-200">
                💰 Применимые расценки ЭСН РК
              </div>
              <ul className="space-y-1 leading-relaxed">
                <li>
                  <code className="font-mono text-[10px] text-teal-700 dark:text-teal-400">
                    Сб.22-01-001
                  </code>
                  {" "}— Прокладка труб ПВХ канализационных Ø200 мм
                </li>
                <li>
                  <code className="font-mono text-[10px] text-teal-700 dark:text-teal-400">
                    Сб.1-01-013
                  </code>
                  {" "}— Разработка грунта в отвал экскаватором, II группа грунта
                </li>
                <li>
                  <code className="font-mono text-[10px] text-teal-700 dark:text-teal-400">
                    Сб.1-02-005
                  </code>
                  {" "}— Засыпка траншей вручную, II группа
                </li>
                <li>
                  <code className="font-mono text-[10px] text-teal-700 dark:text-teal-400">
                    Сб.22-03-002
                  </code>
                  {" "}— Установка колодца канализационного КК-1000
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
