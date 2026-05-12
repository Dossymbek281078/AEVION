"use client";
import Link from "next/link";
import { useState } from "react";
import { DimLine, LevelMark, DrawingTitle } from "../_svg";

function check(i: string, a: number, tol: number) {
  const v = parseFloat(i.replace(",", "."));
  if (isNaN(v)) return false;
  if (tol === 0) return Math.abs(v - a) < 0.001;
  return Math.abs((v - a) / a) < tol;
}

function VentSVG() {
  // Аксонометрическая схема приточно-вытяжной системы воздуховодов
  // Магистраль 800×500 мм по горизонтали, 3 ответвления вниз с решётками
  const OX = 80;
  const OY = 110;
  const mainLen = 540;       // длина магистрали в px (= 18 м, ~30 px/м)
  const mainH = 32;          // высота прямоугольной магистрали в проекции
  const branchSpacing = 160; // расстояние между ответвлениями в px (≈5.3 м между ними)
  const branchLen = 110;     // длина ответвления вниз в px (= 6 м проекция)
  const branchW = 16;        // ширина ответвления в проекции (400×250)

  const branches = [0, 1, 2].map(i => OX + 80 + i * branchSpacing);

  return (
    <svg viewBox="0 0 800 450" className="w-full h-auto" style={{ maxHeight: 380 }}>
      {/* Заголовок */}
      <g transform="translate(20,20)">
        <DrawingTitle
          title="Приточно-вытяжная система — аксонометрия"
          subtitle="Магистраль 800×500, 3 ответвления 400×250, 6 решёток АДН 200×200"
          scale="1:75"
          number="Школа №47"
        />
      </g>

      {/* Подвесное пространство — потолок (низ перекрытия +4.000) */}
      <line x1={20} y1={OY - 40} x2={780} y2={OY - 40} stroke="#94a3b8" strokeWidth={1} strokeDasharray="6 3" />
      <text x={28} y={OY - 44} fontSize={8} fill="#64748b" fontStyle="italic">низ перекрытия +4.000</text>

      {/* Изоляция магистрали — внешний контур (минвата 50 мм + покровный слой) */}
      <rect x={OX - 4} y={OY - 8} width={mainLen + 8} height={mainH + 16}
        fill="rgba(251,191,36,0.18)" stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 2" />
      <text x={OX + mainLen + 14} y={OY + 4} fontSize={8} fill="#92400e">
        изоляция
      </text>
      <text x={OX + mainLen + 14} y={OY + 14} fontSize={7} fill="#92400e" fontStyle="italic">
        минвата 50 мм
      </text>
      <text x={OX + mainLen + 14} y={OY + 22} fontSize={7} fill="#92400e" fontStyle="italic">
        + покровный
      </text>

      {/* Магистральный воздуховод 800×500 — горизонтальная труба */}
      <rect x={OX} y={OY} width={mainLen} height={mainH}
        fill="#e2e8f0" stroke="#475569" strokeWidth={1.5} />
      {/* Внутренняя линия для объёма */}
      <line x1={OX} y1={OY + mainH * 0.35} x2={OX + mainLen} y2={OY + mainH * 0.35}
        stroke="#94a3b8" strokeWidth={0.5} />

      {/* Фланцы магистрали — рёбра через 1.5 м (= 45 px) */}
      {Array.from({ length: 13 }, (_, i) => OX + i * 45).map((fx, i) => (
        <line key={`fl-${i}`} x1={fx} y1={OY - 4} x2={fx} y2={OY + mainH + 4}
          stroke="#1e293b" strokeWidth={1.4} />
      ))}

      {/* Хомуты крепления магистрали — через 2 м (= 60 px), показаны сверху */}
      {Array.from({ length: 10 }, (_, i) => OX + i * 60).map((cx, i) => (
        <g key={`cl-${i}`}>
          {/* Подвес */}
          <line x1={cx} y1={OY - 40} x2={cx} y2={OY} stroke="#64748b" strokeWidth={0.8} />
          {/* Хомут — маленький прямоугольник сверху */}
          <rect x={cx - 5} y={OY - 6} width={10} height={6}
            fill="#cbd5e1" stroke="#334155" strokeWidth={0.8} />
        </g>
      ))}

      {/* Ответвления и решётки */}
      {branches.map((bx, bi) => (
        <g key={`br-${bi}`}>
          {/* Отвод 90° — дуга соединения */}
          <path d={`M ${bx - 8} ${OY + mainH} Q ${bx} ${OY + mainH + 10} ${bx + branchW + 8} ${OY + mainH}`}
            fill="none" stroke="#475569" strokeWidth={1} />

          {/* Ответвление 400×250 — прямоугольник вниз */}
          <rect x={bx} y={OY + mainH} width={branchW} height={branchLen}
            fill="#f1f5f9" stroke="#475569" strokeWidth={1.3} />

          {/* Фланцы ответвления (через 1.5 м = 27.5 px по проекции) */}
          {[0.25, 0.5, 0.75].map((t, k) => (
            <line key={`bfl-${bi}-${k}`}
              x1={bx - 3} y1={OY + mainH + branchLen * t}
              x2={bx + branchW + 3} y2={OY + mainH + branchLen * t}
              stroke="#1e293b" strokeWidth={1.1} />
          ))}

          {/* Подпись ответвления */}
          {bi === 0 && (
            <text x={bx + branchW + 6} y={OY + mainH + 30} fontSize={8} fill="#0f766e">
              Ответвление 400×250
            </text>
          )}

          {/* 2 решётки АДН на каждом ответвлении — на разных уровнях */}
          {[0.45, 0.95].map((t, k) => {
            const gy = OY + mainH + branchLen * t;
            return (
              <g key={`gr-${bi}-${k}`}>
                {/* Подводка к решётке (короткий короб вбок) */}
                <line x1={bx + branchW} y1={gy} x2={bx + branchW + 22} y2={gy}
                  stroke="#475569" strokeWidth={1} />
                {/* Решётка АДН 200×200 — квадрат с жалюзи */}
                <rect x={bx + branchW + 22} y={gy - 9} width={18} height={18}
                  fill="#ccfbf1" stroke="#0d9488" strokeWidth={1.2} />
                {/* Жалюзи (горизонтальные линии) */}
                {[0.25, 0.5, 0.75].map((j, jj) => (
                  <line key={`lv-${bi}-${k}-${jj}`}
                    x1={bx + branchW + 24} y1={gy - 9 + 18 * j}
                    x2={bx + branchW + 38} y2={gy - 9 + 18 * j}
                    stroke="#0d9488" strokeWidth={0.6} />
                ))}
                {/* Стрелка потока воздуха */}
                <line x1={bx + branchW + 44} y1={gy} x2={bx + branchW + 60} y2={gy}
                  stroke="#0d9488" strokeWidth={1} />
                <polygon points={`${bx + branchW + 60},${gy} ${bx + branchW + 56},${gy - 3} ${bx + branchW + 56},${gy + 3}`}
                  fill="#0d9488" />
              </g>
            );
          })}

          {/* Подпись решёток на первом ответвлении */}
          {bi === 0 && (
            <text x={bx + branchW + 24} y={OY + mainH + branchLen + 22}
              fontSize={7} fill="#0f766e" fontStyle="italic">
              АДН 200×200
            </text>
          )}
        </g>
      ))}

      {/* Подпись магистрали */}
      <text x={OX + mainLen / 2} y={OY - 18} textAnchor="middle"
        fontSize={9} fontWeight="600" fill="#0f766e">
        Магистраль 800×500 (оцинк. сталь)
      </text>

      {/* DimLine — длина магистрали 18 м */}
      <DimLine x1={OX} y1={OY + mainH + 90} x2={OX + mainLen} y2={OY + mainH + 90}
        label="L = 18.0 м" color="#0f766e" />
      <line x1={OX} y1={OY + mainH + 4} x2={OX} y2={OY + mainH + 95} stroke="#94a3b8" strokeWidth={0.4} />
      <line x1={OX + mainLen} y1={OY + mainH + 4} x2={OX + mainLen} y2={OY + mainH + 95}
        stroke="#94a3b8" strokeWidth={0.4} />

      {/* DimLine — длина ответвления 6 м (на крайнем правом) */}
      <DimLine
        x1={branches[2] + branchW + 80} y1={OY + mainH}
        x2={branches[2] + branchW + 80} y2={OY + mainH + branchLen}
        label="6.0 м" color="#0f766e" offset={-12}
      />
      <line x1={branches[2] + branchW + 6} y1={OY + mainH} x2={branches[2] + branchW + 84} y2={OY + mainH}
        stroke="#94a3b8" strokeWidth={0.4} />
      <line x1={branches[2] + branchW + 6} y1={OY + mainH + branchLen} x2={branches[2] + branchW + 84} y2={OY + mainH + branchLen}
        stroke="#94a3b8" strokeWidth={0.4} />

      {/* Размер сечения магистрали 800×500 */}
      <g transform={`translate(${OX - 50},${OY - 6})`}>
        <rect x={0} y={0} width={28} height={mainH + 12} fill="none" stroke="#0f766e" strokeWidth={0.6} strokeDasharray="2 2" />
        <text x={14} y={-4} textAnchor="middle" fontSize={7} fill="#0f766e">800</text>
        <text x={-6} y={mainH / 2 + 6} textAnchor="end" fontSize={7} fill="#0f766e">500</text>
      </g>

      {/* Размер сечения ответвления 400×250 (на первом) */}
      <g transform={`translate(${branches[0] - 6},${OY + mainH + 60})`}>
        <text x={-4} y={0} textAnchor="end" fontSize={7} fill="#0f766e">400</text>
        <text x={-4} y={10} textAnchor="end" fontSize={7} fill="#0f766e">×250</text>
      </g>

      {/* LevelMark — низ воздуховода +3.000 (потолок 4.000 - 1.0 м запас на изол./подвес) */}
      <LevelMark x={OX + mainLen + 60} y={OY + mainH + 8} label="+3.000" side="right" color="#0f766e" />

      {/* Легенда */}
      <g transform={`translate(${OX},${OY + mainH + branchLen + 60})`}>
        <rect x={0} y={0} width={20} height={10} fill="#e2e8f0" stroke="#475569" strokeWidth={1} />
        <text x={24} y={9} fontSize={8} fill="#475569">Воздуховод оцинк.</text>

        <rect x={140} y={0} width={20} height={10} fill="rgba(251,191,36,0.18)" stroke="#f59e0b" strokeWidth={1} strokeDasharray="3 2" />
        <text x={164} y={9} fontSize={8} fill="#92400e">Изоляция минвата</text>

        <rect x={290} y={0} width={12} height={10} fill="#ccfbf1" stroke="#0d9488" strokeWidth={1} />
        <text x={306} y={9} fontSize={8} fill="#0f766e">Решётка АДН</text>

        <rect x={420} y={2} width={10} height={6} fill="#cbd5e1" stroke="#334155" strokeWidth={0.8} />
        <text x={434} y={9} fontSize={8} fill="#475569">Хомут</text>

        <line x1={490} y1={0} x2={490} y2={10} stroke="#1e293b" strokeWidth={1.4} />
        <text x={496} y={9} fontSize={8} fill="#475569">Фланец</text>
      </g>
    </svg>
  );
}

type Exercise = {
  id: string;
  title: string;
  q: string;
  ans: number;
  tol: number;     // 0 = exact, иначе относительная погрешность
  unit: string;
  formula: string;
  exp: string;
};

const EXERCISES: Exercise[] = [
  {
    id: "ex1",
    title: "Площадь поверхности магистрали",
    q: "Магистральный воздуховод прямоугольный 800×500 мм, длина 18 м. Рассчитайте площадь поверхности (для расценки на монтаж и расчёта изоляции).",
    ans: 46.8,
    tol: 0.01,
    unit: "м²",
    formula: "F = 2·(a + b)·L = 2·(0.8 + 0.5)·18",
    exp: "F = 2·(0.8 + 0.5)·18 = 2·1.3·18 = 46.8 м². Формула 2·(a+b)·L — периметр сечения × длина. Используется для расчёта изоляции и расценок Сб.20 (монтаж) и Сб.26 (изоляция).",
  },
  {
    id: "ex2",
    title: "Площадь 3 ответвлений",
    q: "3 ответвления 400×250 мм по 6 м каждое. Рассчитайте суммарную площадь поверхности всех ответвлений.",
    ans: 23.4,
    tol: 0.01,
    unit: "м²",
    formula: "F₁ = 2·(0.4 + 0.25)·6 = 7.8 м² · 3",
    exp: "F одного = 2·(0.4 + 0.25)·6 = 2·0.65·6 = 7.8 м². Всего 3 ответвления: 3 × 7.8 = 23.4 м². Тот же принцип, что для магистрали — периметр × длину.",
  },
  {
    id: "ex3",
    title: "Объём минваты на изоляцию магистрали",
    q: "Изолируется только магистраль 800×500 (F = 46.8 м²) минватой толщиной 50 мм. Рассчитайте объём минваты по упрощённой формуле V = F·t.",
    ans: 2.34,
    tol: 0.02,
    unit: "м³",
    formula: "V = F·t = 46.8 · 0.05",
    exp: "V = 46.8 · 0.05 = 2.34 м³. Это упрощённая формула (площадь поверхности × толщина). Точная формула V = ((a+2t)·(b+2t) − a·b)·L даёт чуть больше (учитывает рост периметра по мере удаления от трубы), но в смете обычно применяется упрощённая.",
  },
  {
    id: "ex4",
    title: "Количество хомутов крепления магистрали",
    q: "Магистраль 18 м, шаг крепления хомутами — 2 м. По концам (в начале и в конце) хомут обязателен. Сколько хомутов потребуется?",
    ans: 10,
    tol: 0,
    unit: "шт",
    formula: "n = L/s + 1 = 18/2 + 1",
    exp: "n = 18/2 + 1 = 10 шт. Принцип «забор»: на n пролётов нужно n+1 столбов. Первый хомут — в начале, последний — в конце, между — через каждые 2 м. Для воздуховодов 800×500 шаг крепления 2-3 м (СП РК 4.02-101).",
  },
];

export default function VentilationPage() {
  const [inp, setInp] = useState<Record<string, string>>({});
  const [rev, setRev] = useState<Record<string, boolean>>({});

  function go(ex: Exercise) {
    setRev(r => ({ ...r, [ex.id]: true }));
  }

  function reset(ex: Exercise) {
    setInp(p => ({ ...p, [ex.id]: "" }));
    setRev(r => ({ ...r, [ex.id]: false }));
  }

  const doneCount = EXERCISES.filter(e => rev[e.id] && check(inp[e.id] ?? "", e.ans, e.tol)).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-teal-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link href="/smeta-trainer/drawings-practice/hub" className="text-xs text-teal-200 hover:text-white">
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">🌬 Вентиляция — приточно-вытяжная система</h1>
            <p className="text-[10px] text-teal-200">{doneCount}/{EXERCISES.length} упражнений решено</p>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* SVG + Нормативы (левая колонка, 2/3) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
            <VentSVG />
          </div>

          {/* Нормативный блок */}
          <div className="border-2 border-teal-400 bg-teal-50 dark:bg-teal-900/20 rounded-xl p-4">
            <h3 className="text-sm font-bold text-teal-800 dark:text-teal-300 mb-2">
              📘 Нормативы — СП РК 4.02-101-2012
            </h3>
            <p className="text-[11px] text-teal-700 dark:text-teal-400 mb-2 italic">
              «Отопление, вентиляция и кондиционирование»
            </p>
            <ul className="text-xs text-teal-900 dark:text-teal-200 space-y-1.5 leading-relaxed">
              <li>
                <strong>Класс воздуховодов:</strong> Н — нормальной плотности (применяется для общественных зданий, в т.ч. школ)
              </li>
              <li>
                <strong>Толщина стали:</strong> 0.5–0.7 мм для воздуховодов размером до 1000 мм
              </li>
              <li>
                <strong>Площадь поверхности (прямоугольник):</strong>{" "}
                <code className="font-mono bg-teal-100 dark:bg-teal-900/50 px-1 rounded">F = 2·(a + b)·L</code>
              </li>
              <li>
                <strong>Изоляция магистральных воздуховодов:</strong> минеральная вата 40–60 мм + покровный слой
              </li>
              <li>
                <strong>Шаг хомутов крепления:</strong> 1.5–3 м (зависит от размера; для 800×500 — обычно 2 м)
              </li>
              <li>
                <strong>Фланцевое соединение:</strong> через 1.25–1.5 м
              </li>
            </ul>
          </div>

          {/* ЭСН расценки */}
          <div className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl p-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
              💰 Расценки ЭСН РК (для ВОР)
            </h3>
            <ul className="text-[11px] text-slate-700 dark:text-slate-300 space-y-1 font-mono leading-relaxed">
              <li>
                <span className="text-teal-700 dark:text-teal-400">Сб.20-01-001</span> — Монтаж воздуховодов прямоугольных, периметр до 2400 мм
              </li>
              <li>
                <span className="text-teal-700 dark:text-teal-400">Сб.20-02-005</span> — Установка воздухораспределителей АДН
              </li>
              <li>
                <span className="text-teal-700 dark:text-teal-400">Сб.26-01-027</span> — Изоляция воздуховодов минватой 50 мм
              </li>
              <li>
                <span className="text-teal-700 dark:text-teal-400">Сб.26-02-005</span> — Покровный слой ПЭ
              </li>
              <li>
                <span className="text-teal-700 dark:text-teal-400">Сб.20-04-001</span> — Установка дроссель-клапана 400×250
              </li>
            </ul>
          </div>
        </div>

        {/* Упражнения (правая колонка, 1/3) */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
            Упражнения
          </h2>
          {EXERCISES.map((ex, idx) => {
            const v = inp[ex.id] ?? "";
            const reviewed = !!rev[ex.id];
            const ok = reviewed && check(v, ex.ans, ex.tol);
            const err = reviewed && !ok;
            return (
              <div
                key={ex.id}
                className={`bg-white dark:bg-slate-900 border-2 rounded-xl p-3 transition-colors ${
                  ok
                    ? "border-emerald-300"
                    : err
                    ? "border-red-300"
                    : "border-teal-200 dark:border-teal-800"
                }`}
              >
                <div className="flex items-start gap-2 mb-1.5">
                  <span className="flex-shrink-0 w-5 h-5 bg-teal-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
                    {ex.title}
                  </h3>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
                  {ex.q}
                </p>
                <div className="text-[10px] text-teal-700 dark:text-teal-400 italic mb-2 font-mono">
                  {ex.formula}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={v}
                    onChange={e => setInp(p => ({ ...p, [ex.id]: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && !reviewed && v.trim() && go(ex)}
                    disabled={reviewed && ok}
                    placeholder={`Ответ в ${ex.unit}...`}
                    className="flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-teal-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 disabled:opacity-60"
                  />
                  {!reviewed && (
                    <button
                      onClick={() => go(ex)}
                      disabled={!v.trim()}
                      className="px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded hover:bg-teal-700 disabled:opacity-40"
                    >
                      Проверить
                    </button>
                  )}
                </div>
                {reviewed && (
                  <div
                    className={`mt-2 text-[11px] leading-relaxed ${
                      ok
                        ? "text-emerald-800 dark:text-emerald-300"
                        : "text-red-800 dark:text-red-300"
                    }`}
                  >
                    {ok ? "✓ Верно. " : `✗ Правильный ответ: ${ex.ans} ${ex.unit}. `}
                    {ex.exp}
                  </div>
                )}
                {err && (
                  <button
                    onClick={() => reset(ex)}
                    className="mt-1.5 text-[10px] text-amber-700 dark:text-amber-400 underline"
                  >
                    Попробовать снова
                  </button>
                )}
              </div>
            );
          })}

          {doneCount === EXERCISES.length && (
            <div className="bg-teal-100 dark:bg-teal-900/30 border-2 border-teal-500 rounded-xl p-4 text-center">
              <div className="text-3xl mb-2">🎉</div>
              <div className="text-sm font-bold text-teal-800 dark:text-teal-200">
                Все упражнения пройдены!
              </div>
              <Link
                href="/smeta-trainer/drawings-practice/hub"
                className="inline-block mt-3 px-4 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800"
              >
                ← К разделам
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
