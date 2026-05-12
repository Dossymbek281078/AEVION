"use client";
import Link from "next/link";
import { useState } from "react";
import { DimLine, HatchFill, Arrow, LevelMark, DrawingTitle } from "../_svg";

function check(input: string, answers: string[], tol = 0.02) {
  const v = parseFloat(input.replace(",", "."));
  if (isNaN(v)) return false;
  return answers.some(a => {
    const e = parseFloat(a.replace(",", "."));
    return !isNaN(e) && Math.abs((v - e) / e) < tol;
  });
}

/** Поперечный разрез траншеи теплосети — двухтрубная бесканальная прокладка */
function HeatingSVG() {
  // координаты — viewBox 800x460
  const groundY = 80;          // линия планировки (земля)
  const trenchTopY = groundY;  // верх траншеи
  const trenchBotY = 360;      // низ траншеи (глубина 0.9 м)
  const cx = 400;              // центр траншеи по X
  const widthBot = 280;        // ширина по низу 0.8 м (масштабно)
  const widthTop = 380;        // ширина по верху (с откосами m=0.5)
  const sandBaseH = 32;        // песчаное основание 100 мм

  // Трубы Т1 (подача, слева) и Т2 (обратка, справа)
  // Расстояние между осями 200 мм → масштабно ~70 px
  const pipeAxisDX = 70;
  const pipeY = trenchBotY - sandBaseH - 70;
  const pipeXT1 = cx - pipeAxisDX / 2;
  const pipeXT2 = cx + pipeAxisDX / 2;
  const rPipe = 14;            // Ø108 мм трубы
  const rIns = 30;             // изоляция 60 мм + покровный 5 мм → радиус ~30 px
  const rPe = 32;              // покровный полиэтилен

  // Точки траншеи (трапеция — откосы m=0.5)
  const tx1 = cx - widthTop / 2, tx2 = cx + widthTop / 2;
  const bx1 = cx - widthBot / 2, bx2 = cx + widthBot / 2;

  // Бетонная подушка-опора под обеими трубами
  const padX = cx - 80, padY = trenchBotY - sandBaseH - 14, padW = 160, padH = 14;

  return (
    <svg viewBox="0 0 800 460" className="w-full h-auto" style={{ maxHeight: 420 }}>
      {/* Заголовок */}
      <g transform="translate(20,20)">
        <DrawingTitle
          title="Поперечный разрез траншеи Т1/Т2"
          subtitle="Бесканальная прокладка тепловой сети, двухтрубная"
          scale="1:25"
          number="Школа №47, ТП-1"
        />
      </g>

      {/* Грунт обратной засыпки (суглинок) над траншеей и по бокам */}
      <HatchFill x={20} y={groundY} w={tx1 - 20} h={trenchBotY - groundY} color="#a16207" spacing={10} />
      <HatchFill x={tx2} y={groundY} w={780 - tx2} h={trenchBotY - groundY} color="#a16207" spacing={10} />

      {/* Засыпка песком в траншее (от верха изоляции до планировки) */}
      <polygon
        points={`${tx1},${groundY} ${tx2},${groundY} ${bx2},${pipeY - rIns - 8} ${bx1},${pipeY - rIns - 8}`}
        fill="#fef3c7" stroke="#ca8a04" strokeWidth={0.8} strokeDasharray="2 2"
      />
      <text x={cx} y={groundY + 24} textAnchor="middle" fontSize={9} fill="#92400e" fontStyle="italic">
        Грунт обратной засыпки (суглинок)
      </text>
      <text x={cx} y={pipeY - rIns - 20} textAnchor="middle" fontSize={8} fill="#92400e">
        Песок, h ≥ 200 мм над изоляцией
      </text>

      {/* Контур траншеи */}
      <polyline
        points={`${tx1},${groundY} ${bx1},${trenchBotY} ${bx2},${trenchBotY} ${tx2},${groundY}`}
        fill="none" stroke="#475569" strokeWidth={1.5}
      />

      {/* Песчаное основание (100 мм) */}
      <rect x={bx1} y={trenchBotY - sandBaseH} width={widthBot} height={sandBaseH}
        fill="#fde68a" stroke="#ca8a04" strokeWidth={1} />
      <text x={cx} y={trenchBotY - 8} textAnchor="middle" fontSize={8} fill="#92400e">
        Песчаное основание 100 мм
      </text>

      {/* Бетонная подушка-опора */}
      <rect x={padX} y={padY} width={padW} height={padH} fill="#cbd5e1" stroke="#475569" strokeWidth={1.2} />
      {/* штриховка бетона */}
      {Array.from({ length: 12 }).map((_, i) => (
        <line key={i}
          x1={padX + i * 14 - padH} y1={padY}
          x2={padX + i * 14} y2={padY + padH}
          stroke="#94a3b8" strokeWidth={0.5} />
      ))}
      <text x={padX + padW + 6} y={padY + 10} fontSize={8} fill="#475569">
        Бетонная подушка (через 6 м)
      </text>

      {/* === Труба Т1 (подача, красная) === */}
      {/* Покровный полиэтилен */}
      <circle cx={pipeXT1} cy={pipeY} r={rPe} fill="#f1f5f9" stroke="#64748b" strokeWidth={0.8} strokeDasharray="2 2" />
      {/* Минвата */}
      <circle cx={pipeXT1} cy={pipeY} r={rIns} fill="rgba(251,191,36,0.35)" stroke="#f59e0b" strokeWidth={1} />
      {/* Сама труба */}
      <circle cx={pipeXT1} cy={pipeY} r={rPipe} fill="#fee2e2" stroke="#dc2626" strokeWidth={2} />
      <text x={pipeXT1} y={pipeY + 4} textAnchor="middle" fontSize={10} fontWeight="700" fill="#dc2626">Т1</text>
      <text x={pipeXT1 - 50} y={pipeY - rPe - 2} fontSize={8} fill="#dc2626">Подача 95°C</text>
      <text x={pipeXT1 - 50} y={pipeY - rPe + 8} fontSize={7} fill="#dc2626">Ø108×4</text>

      {/* === Труба Т2 (обратка, синяя) === */}
      <circle cx={pipeXT2} cy={pipeY} r={rPe} fill="#f1f5f9" stroke="#64748b" strokeWidth={0.8} strokeDasharray="2 2" />
      <circle cx={pipeXT2} cy={pipeY} r={rIns} fill="rgba(251,191,36,0.35)" stroke="#f59e0b" strokeWidth={1} />
      <circle cx={pipeXT2} cy={pipeY} r={rPipe} fill="#dbeafe" stroke="#2563eb" strokeWidth={2} />
      <text x={pipeXT2} y={pipeY + 4} textAnchor="middle" fontSize={10} fontWeight="700" fill="#2563eb">Т2</text>
      <text x={pipeXT2 + 16} y={pipeY - rPe - 2} fontSize={8} fill="#2563eb">Обратка 70°C</text>
      <text x={pipeXT2 + 16} y={pipeY - rPe + 8} fontSize={7} fill="#2563eb">Ø108×4</text>

      {/* Стрелка от изоляции к подписи */}
      <Arrow x1={pipeXT1 - 60} y1={pipeY + 50} x2={pipeXT1 - rIns + 4} y2={pipeY + 14} color="#f59e0b" />
      <text x={pipeXT1 - 130} y={pipeY + 56} fontSize={8} fill="#92400e">
        Минвата 60 мм + ПЭ 5 мм
      </text>

      {/* === Размерные линии === */}
      {/* Расстояние между осями 200 мм */}
      <DimLine x1={pipeXT1} y1={pipeY - rIns - 40} x2={pipeXT2} y2={pipeY - rIns - 40}
        label="200 мм (между осями)" color="#0ea5e9" />
      <line x1={pipeXT1} y1={pipeY - rIns - 4} x2={pipeXT1} y2={pipeY - rIns - 42} stroke="#0ea5e9" strokeWidth={0.5} strokeDasharray="2 2" />
      <line x1={pipeXT2} y1={pipeY - rIns - 4} x2={pipeXT2} y2={pipeY - rIns - 42} stroke="#0ea5e9" strokeWidth={0.5} strokeDasharray="2 2" />

      {/* Глубина заложения 0.7 м (от планировки до верха изоляции) */}
      <DimLine x1={tx2 + 60} y1={groundY} x2={tx2 + 60} y2={pipeY - rIns}
        label="h ≥ 0.7 м" color="#475569" offset={28} />

      {/* Полная глубина траншеи 0.9 м */}
      <DimLine x1={tx2 + 110} y1={groundY} x2={tx2 + 110} y2={trenchBotY}
        label="H = 0.9 м" color="#475569" offset={28} />

      {/* Ширина траншеи по низу 0.8 м */}
      <DimLine x1={bx1} y1={trenchBotY + 24} x2={bx2} y2={trenchBotY + 24}
        label="b = 0.8 м (по низу)" color="#475569" />

      {/* Ширина траншеи по верху */}
      <DimLine x1={tx1} y1={groundY - 16} x2={tx2} y2={groundY - 16}
        label="B = 1.7 м (по верху, откос m=0.5)" color="#475569" />

      {/* Диаметр изоляции */}
      <DimLine x1={pipeXT2 - rIns} y1={pipeY + rIns + 20} x2={pipeXT2 + rIns} y2={pipeY + rIns + 20}
        label="Ø228 (с изоляцией)" color="#f59e0b" fontSize={8} />

      {/* === Уровни (отметки) === */}
      {/* Линия земли — горизонталь сплошная по всей ширине */}
      <line x1={20} y1={groundY} x2={780} y2={groundY} stroke="#475569" strokeWidth={1.2} />
      <LevelMark x={30} y={groundY} label="0.000 (планировка)" side="right" />
      <LevelMark x={30} y={pipeY} label="−0.85 (ось труб)" side="right" />
      <LevelMark x={30} y={trenchBotY} label="−0.90 (низ траншеи)" side="right" />

      {/* Маленький значок «земля» — короткие штрихи под линией планировки слева */}
      {Array.from({ length: 4 }).map((_, i) => (
        <line key={i} x1={730 + i * 6} y1={groundY} x2={734 + i * 6} y2={groundY - 4} stroke="#475569" strokeWidth={0.6} />
      ))}

      {/* Легенда */}
      <g transform="translate(20,420)">
        <circle cx={6} cy={4} r={5} fill="#fee2e2" stroke="#dc2626" strokeWidth={1.5} />
        <text x={16} y={8} fontSize={9} fill="#475569">Т1 — подача 95°C</text>
        <circle cx={130} cy={4} r={5} fill="#dbeafe" stroke="#2563eb" strokeWidth={1.5} />
        <text x={140} y={8} fontSize={9} fill="#475569">Т2 — обратка 70°C</text>
        <rect x={258} y={0} width={12} height={9} fill="rgba(251,191,36,0.35)" stroke="#f59e0b" strokeWidth={1} />
        <text x={274} y={8} fontSize={9} fill="#475569">Изоляция (минвата + ПЭ)</text>
        <rect x={430} y={0} width={12} height={9} fill="#fde68a" stroke="#ca8a04" strokeWidth={1} />
        <text x={446} y={8} fontSize={9} fill="#475569">Песок</text>
        <rect x={500} y={0} width={12} height={9} fill="#cbd5e1" stroke="#475569" strokeWidth={1} />
        <text x={516} y={8} fontSize={9} fill="#475569">Бетонная опора</text>
      </g>
    </svg>
  );
}

type Exercise = {
  id: string;
  title: string;
  question: string;
  answers: string[];
  tol?: number;
  formula: string;
  explanation: string;
};

const EXERCISES: Exercise[] = [
  {
    id: "ex1",
    title: "Упражнение 1. Длина труб на участке",
    question: "Двухтрубная прокладка теплосети длиной L = 50 м (по трассе). Сколько м.п. труб Ø108×4 нужно учесть в ВОР по обеим ниткам?",
    answers: ["100"],
    tol: 0.005,
    formula: "L_общ = L · 2 = 50 · 2 = 100 м.п.",
    explanation: "Подача и обратка в смете — отдельные позиции, но одна расценка ЭСН РК Сб.24-02-001. Считаем длину каждой нитки и суммируем: 50 + 50 = 100 м.п.",
  },
  {
    id: "ex2",
    title: "Упражнение 2. Площадь изоляции одной трубы",
    question: "Труба Ø108 мм, толщина минваты 60 мм, длина 50 м. Найдите площадь изолируемой поверхности (без покровного слоя), м².",
    answers: ["35.81", "35.8", "35.7", "35.9"],
    tol: 0.02,
    formula: "S = π · (D + 2t) · L = π · (0.108 + 2·0.060) · 50 = π · 0.228 · 50 ≈ 35.81 м²",
    explanation: "Формула боковой поверхности цилиндра. Используется для расчёта расхода минваты по ЭСН РК Сб.26-01-027 и для определения площади покровного слоя. Внешний диаметр изоляции = 108 + 2·60 = 228 мм.",
  },
  {
    id: "ex3",
    title: "Упражнение 3. Объём минваты на участок (обе трубы)",
    question: "Найдите объём минваты для изоляции обеих ниток (Т1 + Т2) на участке 50 м. Внутренний Ø трубы 108 мм, наружный Ø с изоляцией 228 мм.",
    answers: ["3.16", "3.17", "3.15", "3.18", "3.2"],
    tol: 0.05,
    formula: "V = π · (D_нар² − D_внутр²)/4 · L · n = π · (0.228² − 0.108²)/4 · 50 · 2 ≈ 3.16 м³",
    explanation: "Объём кольцевого слоя изоляции на одну трубу: V₁ = π·(D²−d²)/4·L. Умножаем на 2 нитки. (0.228² − 0.108²) = 0.0520 − 0.0117 = 0.0403. V = π · 0.0403/4 · 100 ≈ 3.16 м³.",
  },
  {
    id: "ex4",
    title: "Упражнение 4. Объём траншеи под двухтрубную прокладку",
    question: "Траншея с откосами: ширина по низу b = 0.8 м, глубина H = 0.9 м (0.7 над изоляцией + Ø228 изоляции), коэффициент откоса m = 0.5 (суглинок), длина 50 м. Найдите объём грунта, м³.",
    answers: ["56.25", "56.3", "56.2"],
    tol: 0.02,
    formula: "V = ((b + B)/2) · H · L; B = b + 2·m·H = 0.8 + 2·0.5·0.9 = 1.7; V = ((0.8+1.7)/2) · 0.9 · 50 = 1.25 · 0.9 · 50 = 56.25 м³",
    explanation: "Формула объёма призмы с трапециевидным сечением. Ширина по верху B = b + 2mH (откосы). Этот объём идёт в позицию ЭСН РК Сб.1-01-013 «Разработка грунта экскаватором II группы».",
  },
];

const ESN_ITEMS = [
  { code: "ЭСН РК Сб.24-02-001", title: "Прокладка трубопроводов теплосети из стальных труб Ø108", unit: "м.п." },
  { code: "ЭСН РК Сб.26-01-027", title: "Изоляция трубопроводов матами минераловатными, толщина 60 мм", unit: "м³" },
  { code: "ЭСН РК Сб.26-02-005", title: "Покровный слой из полиэтиленовой плёнки", unit: "м²" },
  { code: "ЭСН РК Сб.1-01-013", title: "Разработка грунта экскаватором, II группа", unit: "м³" },
  { code: "ЭСН РК Сб.1-02-005", title: "Засыпка вручную, II группа", unit: "м³" },
];

export default function HeatingPage() {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  function setInp(id: string, v: string) {
    setInputs(p => ({ ...p, [id]: v }));
  }
  function reveal(id: string) {
    setRevealed(r => ({ ...r, [id]: true }));
  }
  function reset(id: string) {
    setInputs(p => ({ ...p, [id]: "" }));
    setRevealed(r => ({ ...r, [id]: false }));
  }

  const doneCount = EXERCISES.filter(ex => {
    return revealed[ex.id] && check(inputs[ex.id] ?? "", ex.answers, ex.tol ?? 0.02);
  }).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-orange-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-orange-200 hover:text-white"
          >
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">♨️ Тепловые сети — двухтрубная прокладка</h1>
            <p className="text-[10px] text-orange-200">{doneCount}/{EXERCISES.length} упражнений решено</p>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Левая колонка: чертёж + норматив */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <HeatingSVG />
          </div>

          {/* Нормативный блок */}
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">📖</span>
              <h2 className="text-sm font-bold text-orange-900 dark:text-orange-200">
                Нормативная база — СП РК 4.02-42-2006 «Тепловые сети»
              </h2>
            </div>
            <ul className="text-xs text-orange-900 dark:text-orange-200 space-y-1.5 leading-relaxed list-disc pl-5">
              <li>
                <b>Минимальная глубина заложения</b> для бесканальной прокладки — <b>0.7 м</b> от верха
                изоляции до планировочной отметки (СП РК 4.02-42-2006, п. 9.5).
              </li>
              <li>
                <b>Расстояние между трубами</b> — не менее <b>100 мм в свету</b> между наружными
                диаметрами изоляции; принимаем 200 мм между осями для удобства монтажа.
              </li>
              <li>
                <b>Толщина изоляции</b> для теплоносителя T = 95 °C — <b>60 мм минваты</b> URSA или
                Rockwool по СП РК 2.04-104-2012 «Тепловая изоляция оборудования и трубопроводов».
              </li>
              <li>
                <b>Скользящие опоры</b> — бетонные подушки <b>через 6 м</b> для Ø108 (по таблице
                расстояний между опорами стальных труб).
              </li>
              <li>
                <b>Покровный слой</b> — полиэтиленовая плёнка 5 мм или рубероид по ЭСН РК
                Сб.26-02-005, защищает изоляцию от увлажнения грунтом.
              </li>
            </ul>
          </div>
        </div>

        {/* Правая колонка: упражнения */}
        <div className="space-y-3">
          {EXERCISES.map((ex, idx) => {
            const id = ex.id;
            const v = inputs[id] ?? "";
            const r = !!revealed[id];
            const ok = r && check(v, ex.answers, ex.tol ?? 0.02);
            const err = r && !ok;
            return (
              <div
                key={id}
                className={`bg-white dark:bg-slate-900 border rounded-xl p-3 ${
                  ok
                    ? "border-emerald-300 dark:border-emerald-700"
                    : err
                    ? "border-red-300 dark:border-red-700"
                    : "border-slate-200 dark:border-slate-700"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">{ex.title}</h3>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">#{idx + 1}</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
                  {ex.question}
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={v}
                    onChange={e => setInp(id, e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !r && reveal(id)}
                    disabled={r && ok}
                    placeholder="Ответ (число)..."
                    className="flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-orange-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                  />
                  {!r && (
                    <button
                      onClick={() => reveal(id)}
                      disabled={!v.trim()}
                      className="px-3 py-1.5 bg-orange-600 text-white text-xs font-semibold rounded hover:bg-orange-700 disabled:opacity-40"
                    >
                      Проверить
                    </button>
                  )}
                  {err && (
                    <button
                      onClick={() => reset(id)}
                      className="px-2 py-1.5 bg-slate-200 dark:bg-slate-700 text-xs font-semibold rounded text-slate-700 dark:text-slate-200"
                    >
                      ↻
                    </button>
                  )}
                </div>

                {r && (
                  <div
                    className={`mt-2 text-[11px] leading-relaxed rounded p-2 ${
                      ok
                        ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700"
                        : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-700"
                    }`}
                  >
                    <div className="font-semibold mb-1">
                      {ok ? "✓ Верно" : `✗ Правильный ответ: ${ex.answers[0]}`}
                    </div>
                    <code className="block text-[10px] font-mono mb-1 opacity-90">{ex.formula}</code>
                    <div>{ex.explanation}</div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Расценки ЭСН */}
          <div className="bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">📋</span>
              <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Расценки ЭСН для участка
              </h2>
            </div>
            <ul className="space-y-1.5">
              {ESN_ITEMS.map(it => (
                <li
                  key={it.code}
                  className="text-[10px] leading-snug border-l-2 border-slate-400 dark:border-slate-600 pl-2"
                >
                  <code className="font-mono text-slate-900 dark:text-slate-100 font-semibold">
                    {it.code}
                  </code>
                  <div className="text-slate-600 dark:text-slate-400">
                    {it.title} <span className="text-slate-400 dark:text-slate-500">[{it.unit}]</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
