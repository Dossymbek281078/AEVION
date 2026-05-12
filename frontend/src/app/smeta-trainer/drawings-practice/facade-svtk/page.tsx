"use client";
import Link from "next/link";
import { useState } from "react";
import { BrickBlock, DimLine, Arrow, DrawingTitle } from "../_svg";

function check(input: string, accepts: string[], tol = 0.01): boolean {
  const v = parseFloat(input.replace(",", "."));
  return accepts.some((a) => {
    const e = parseFloat(a.replace(",", "."));
    if (isNaN(v) || isNaN(e)) return false;
    if (tol === 0) return Math.abs(v - e) < 0.5;
    return Math.abs((v - e) / e) <= tol;
  });
}

/* ─────────────── SVG: два варианта фасада в разрезе ─────────────── */
function FacadeSVG() {
  // Левый блок: СФТК
  // Правый блок: НВФ
  // Каждый — горизонтальный разрез: слои слева направо (изнутри наружу)
  const SCALE = 0.6; // мм → px (~0.6 px/мм для удобства)

  // СФТК слои
  const sftk = [
    { name: "Несущая стена кирпич/газобетон", th: 380, color: "brick" },
    { name: "Клеевой раствор", th: 5, color: "#cbd5e1" },
    { name: "Утеплитель ПСБ-С-25", th: 100, color: "#fed7aa" },
    { name: "Армирующий слой (стеклосетка + клей)", th: 5, color: "#bae6fd" },
    { name: "Грунтовка", th: 1, color: "#a7f3d0" },
    { name: "Декор. штукатурка (короед)", th: 3, color: "#fcd34d" },
  ];
  // НВФ слои
  const nvf = [
    { name: "Несущая стена 380 мм", th: 380, color: "brick" },
    { name: "Утеплитель минвата + ветрозащита", th: 100, color: "#e9d5ff" },
    { name: "Воздушный зазор (вентиляция)", th: 40, color: "#dbeafe" },
    { name: "Облицовка керамогранит 600×600", th: 10, color: "#94a3b8" },
  ];

  function renderLayers(
    layers: { name: string; th: number; color: string }[],
    ox: number,
    oy: number,
    title: string,
    subtitle: string,
    extras: (offset: number, totalThick: number) => React.ReactNode,
  ) {
    const H = 240;
    let cx = ox;
    const items: React.ReactElement[] = [];
    layers.forEach((L, i) => {
      const w = Math.max(L.th * SCALE, 4); // минимум 4 px для тонких
      if (L.color === "brick") {
        items.push(<BrickBlock key={i} x={cx} y={oy} w={w} h={H} brickH={14} brickW={22} />);
      } else {
        items.push(
          <rect key={i} x={cx} y={oy} width={w} height={H}
            fill={L.color} stroke="#475569" strokeWidth={0.8} />,
        );
      }
      // подпись толщины снизу
      items.push(
        <DimLine key={`d${i}`}
          x1={cx} y1={oy + H + 12 + (i % 2) * 14}
          x2={cx + w} y2={oy + H + 12 + (i % 2) * 14}
          label={`${L.th} мм`} offset={8} fontSize={7} />,
      );
      // подпись слоя справа от блока (выноска)
      const labelX = ox + 320;
      const labelY = oy + 14 + i * 22;
      items.push(
        <g key={`l${i}`}>
          <line x1={cx + w / 2} y1={oy} x2={labelX - 6} y2={labelY - 3}
            stroke="#94a3b8" strokeWidth={0.5} strokeDasharray="2 2" />
          <circle cx={cx + w / 2} cy={oy} r={1.5} fill="#475569" />
          <text x={labelX} y={labelY} fontSize={8} fill="#1e293b">
            {i + 1}. {L.name}
          </text>
        </g>,
      );
      cx += w;
    });
    const totalThick = cx - ox;
    return (
      <g>
        <g transform={`translate(${ox}, ${oy - 30})`}>
          <DrawingTitle title={title} subtitle={subtitle} scale="1:5" number="разрез" />
        </g>
        {items}
        {/* внутри (помещение) */}
        <text x={ox - 25} y={oy + H / 2} fontSize={8} fill="#64748b" transform={`rotate(-90, ${ox - 25}, ${oy + H / 2})`} textAnchor="middle">
          ВНУТРИ помещения
        </text>
        {/* снаружи */}
        <text x={cx + 6} y={oy + H + 4} fontSize={8} fill="#64748b">
          → СНАРУЖИ
        </text>
        {extras(ox, totalThick)}
      </g>
    );
  }

  return (
    <svg viewBox="0 0 880 420" className="w-full h-auto" style={{ maxHeight: 420 }}>
      {/* ===== Вариант А: СФТК ===== */}
      {renderLayers(sftk, 40, 60, "Вариант А — СФТК", "Композитная теплоизоляция", (ox, _t) => {
        // дюбель-гриб: горизонтальная стрелка через утеплитель
        const dx = ox + 380 * SCALE + 5 * SCALE + 50 * SCALE; // примерно через утеплитель
        return (
          <g>
            <Arrow x1={dx + 40} y1={140} x2={dx - 5} y2={140} color="#dc2626" size={5} />
            <text x={dx + 44} y={143} fontSize={7} fill="#dc2626" fontWeight="600">
              дюбель-«гриб» 6 шт/м²
            </text>
            <text x={dx + 44} y={154} fontSize={6.5} fill="#64748b" fontStyle="italic">
              крепит утеплитель + сетку
            </text>
          </g>
        );
      })}

      {/* ===== Вариант Б: НВФ ===== */}
      {renderLayers(nvf, 480, 60, "Вариант Б — НВФ", "Навесной вентилируемый фасад", (ox, _t) => {
        // воздушные стрелки: снизу вверх в воздушном зазоре
        const gapX = ox + 380 * SCALE + 100 * SCALE + 20 * SCALE; // середина воздушного зазора
        return (
          <g>
            {/* стрелки потока воздуха снизу вверх */}
            {[260, 220, 180, 140, 100].map((y, i) => (
              <Arrow key={i} x1={gapX} y1={y} x2={gapX} y2={y - 30} color="#0284c7" size={4} />
            ))}
            <text x={gapX + 8} y={70} fontSize={7} fill="#0284c7" fontWeight="600">
              ↑ воздух
            </text>
            <text x={gapX + 8} y={80} fontSize={6.5} fill="#64748b" fontStyle="italic">
              вентиляция 40 мм
            </text>
            {/* кронштейны: маленькие квадратики */}
            <rect x={ox + 380 * SCALE - 6} y={120} width={6} height={4} fill="#374151" />
            <rect x={ox + 380 * SCALE - 6} y={200} width={6} height={4} fill="#374151" />
            <text x={ox + 380 * SCALE - 70} y={123} fontSize={6.5} fill="#374151" fontWeight="600">
              кронштейн
            </text>
            <text x={ox + 380 * SCALE - 70} y={203} fontSize={6.5} fill="#374151" fontWeight="600">
              нерж. сталь
            </text>
            {/* направляющие профили (вертикальные) */}
            <rect x={ox + 380 * SCALE + 100 * SCALE + 40 * SCALE - 1} y={60} width={2} height={240} fill="#475569" />
          </g>
        );
      })}
    </svg>
  );
}

/* ─────────────── Упражнения ─────────────── */
type Exercise = {
  id: string;
  title: string;
  question: string;
  hint?: string;
  accepts: string[];
  tol: number; // 0 = exact (по штукам), иначе доля
  expl: string;
  unit: string;
};

const EXERCISES: Exercise[] = [
  {
    id: "facade-area",
    title: "Упр. 1 — Площадь фасада здания",
    question:
      "Здание 18 × 12 × 9 м (длина × ширина × высота). Окна и двери в сумме = 60 м². Рассчитайте чистую площадь фасадных работ (м²).",
    hint:
      "P = 2·(18+12) = 60 м.п. Площадь без проёмов = 60·9 = 540 м². Минус проёмы 60 м².",
    accepts: ["480"],
    tol: 0.01,
    expl:
      "Периметр 2·(18+12) = 60 м.п. Брутто 60·9 = 540 м². Чистая = 540 − 60 = 480 м². По СНиП РК проёмы > 0.5 м² ВСЕГДА вычитаются для фасадных работ.",
    unit: "м²",
  },
  {
    id: "eps-volume",
    title: "Упр. 2 — Объём пенополистирола ПСБ-С-25 (СФТК)",
    question:
      "Площадь фасада 480 м². Толщина утеплителя 100 мм. Учесть отходы +5%. Рассчитайте объём ПСБ-С-25 (м³).",
    hint: "V = S · δ · 1.05.   δ = 0.10 м.",
    accepts: ["50.4", "50,4"],
    tol: 0.02,
    expl:
      "V₀ = 480 · 0.10 = 48 м³. С отходами: 48 · 1.05 = 50.4 м³. ПСБ-С-25 поставляется плитами 1.0×0.5 м толщиной 50/100 мм. Коэф. 1.05 учитывает раскрой и брак.",
    unit: "м³",
  },
  {
    id: "dowels",
    title: "Упр. 3 — Дюбели-«грибки» для СФТК",
    question:
      "Норма крепления для стандартного фасада до 5 этажей — 6 шт/м². Площадь 480 м². Сколько дюбелей нужно (шт)?",
    hint: "n = S · 6.",
    accepts: ["2880"],
    tol: 0,
    expl:
      "n = 480 · 6 = 2880 шт. Для угловых и верхних зон с повышенной ветровой нагрузкой норма — 8–10 шт/м² (усиленное крепление). См. ЭСН РК Сб.26.",
    unit: "шт",
  },
  {
    id: "ceramic",
    title: "Упр. 4 — Керамогранит для НВФ с подрезкой",
    question:
      "Площадь фасада 480 м². Плитка 600×600 мм (S₁ = 0.36 м²). Подрезка ×1.10. Рассчитайте площадь керамогранита с отходами (м²) ИЛИ количество плиток (шт).",
    hint:
      "n₀ = 480/0.36 = 1334 шт. С подрезкой: 1334·1.10 ≈ 1467 шт. S = 1467·0.36 = 528.1 м².",
    accepts: ["528", "528.1", "528,1", "1467"],
    tol: 0.01,
    expl:
      "Без отходов: 480/0.36 = 1334 плиток. С подрезкой ×1.10 → 1467 шт. Площадь с отходами 1467·0.36 = 528.1 м². На сложных фасадах (балконы, эркеры, окна) подрезка достигает 15–20%.",
    unit: "м² или шт",
  },
];

/* ─────────────── Страница ─────────────── */
export default function FacadeSvtkPage() {
  const [exIdx, setExIdx] = useState(0);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Set<string>>(new Set());
  const [showHint, setShowHint] = useState<Record<string, boolean>>({});

  const ex = EXERCISES[exIdx];
  const key = ex.id;
  const isOk = revealed[key] && check(inputs[key] ?? "", ex.accepts, ex.tol);
  const isErr = revealed[key] && !isOk;

  function handleCheck() {
    setRevealed((r) => ({ ...r, [key]: true }));
    if (check(inputs[key] ?? "", ex.accepts, ex.tol)) {
      setDone((d) => new Set([...d, ex.id]));
    }
  }

  const allDone = done.size === EXERCISES.length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-pink-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-pink-200 hover:text-white"
          >
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">
              🏢 Фасады — СФТК и навесные вентилируемые
            </h1>
            <p className="text-[10px] text-pink-200">
              {done.size}/{EXERCISES.length} упражнений выполнено
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 space-y-4">
        {/* SVG чертёж */}
        <section className="bg-white dark:bg-slate-900 border-2 border-pink-500 rounded-xl p-4">
          <h2 className="text-base font-bold text-pink-800 dark:text-pink-300 mb-2">
            📐 Конструктивные разрезы фасадных систем
          </h2>
          <FacadeSVG />
          <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 italic">
            Слева — СФТК (Система Фасадная Теплоизоляционная Композитная). Справа — НВФ (Навесной Вентилируемый Фасад).
            Толщины слоёв даны в мм. Обратите внимание на воздушный зазор 40 мм в НВФ — он критичен для отвода влаги.
          </p>
        </section>

        {/* Нормативный блок */}
        <section className="bg-pink-50 dark:bg-pink-900/20 border border-pink-300 dark:border-pink-700 rounded-xl p-4">
          <h2 className="text-sm font-bold text-pink-800 dark:text-pink-300 mb-2">
            📚 Нормативная база (РК)
          </h2>
          <ul className="text-xs text-pink-900 dark:text-pink-200 space-y-1.5 leading-relaxed">
            <li>
              <b>СП РК 2.04-104-2012</b> — «Тепловая защита зданий». Определяет требуемое сопротивление теплопередаче R₀ для региона.
            </li>
            <li>
              <b>СН РК 3.02-22-2014</b> — «Крыши и кровли» (раздел фасадных систем).
            </li>
            <li>
              <b>СН РК 2.02-05-2002</b> — «Пожарная безопасность зданий и сооружений». Класс пожарной опасности фасадной системы.
            </li>
            <li>
              <b>СНиП РК 1.04-26-2011</b> — «Реконструкция зданий и фасадов» (правила производства фасадных работ).
            </li>
            <li>
              <b>ТУ 5800-001</b> — на системы СФТК (конкретные производители: Caparol, Ceresit, Армекс).
            </li>
            <li>
              <b>Класс энергоэффективности:</b> B (нормально, базовая толщина утеплителя), А (повышенный, +50% к толщине утеплителя).
            </li>
          </ul>
        </section>

        {/* Сравнение СФТК vs НВФ */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 overflow-x-auto">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">
            ⚖️ Сравнение: СФТК vs НВФ
          </h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-pink-100 dark:bg-pink-900/30 text-pink-900 dark:text-pink-200">
                <th className="px-2 py-1.5 text-left font-semibold">Параметр</th>
                <th className="px-2 py-1.5 text-left font-semibold">СФТК</th>
                <th className="px-2 py-1.5 text-left font-semibold">НВФ</th>
              </tr>
            </thead>
            <tbody className="text-slate-700 dark:text-slate-300">
              {[
                ["Стоимость 1 м², тг", "18 000 – 25 000", "35 000 – 50 000"],
                ["Срок службы", "15 – 25 лет", "30 – 50 лет"],
                ["Скорость монтажа", "Быстро (1 м²/чел/день)", "Средне (0.5 м²/чел/день)"],
                ["Тепловое сопротивление", "Высокое (замкнутый контур)", "Очень высокое + вент. зазор"],
                ["Возможность ремонта", "Сложный (вырезать участок)", "Простой (заменить лист)"],
                ["Применение", "Жилые до 5 эт., детсады, школы", "Высотные, торговые, общественные"],
                ["Материал утеплителя", "Пенополистирол (горюч! Г1)", "Минвата (НГ — негорючий)"],
                ["Огнеопасность системы", "Класс К1", "Класс К0"],
              ].map((row, i) => (
                <tr
                  key={i}
                  className={
                    i % 2 === 0
                      ? "bg-slate-50 dark:bg-slate-800/40"
                      : "bg-white dark:bg-slate-900"
                  }
                >
                  <td className="px-2 py-1.5 font-medium">{row[0]}</td>
                  <td className="px-2 py-1.5">{row[1]}</td>
                  <td className="px-2 py-1.5">{row[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Упражнения */}
        <section className="bg-white dark:bg-slate-900 border-2 border-pink-500 rounded-xl p-4">
          <h2 className="text-base font-bold text-pink-800 dark:text-pink-300 mb-3">
            🧮 Интерактивные упражнения
          </h2>

          {/* Tabs */}
          <div className="flex gap-1 flex-wrap mb-3">
            {EXERCISES.map((e, i) => (
              <button
                key={e.id}
                onClick={() => setExIdx(i)}
                className={`text-[10px] px-2.5 py-1 rounded font-semibold ${
                  i === exIdx
                    ? "bg-pink-600 text-white"
                    : done.has(e.id)
                    ? "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                }`}
              >
                {done.has(e.id) ? "✓ " : ""}
                {i + 1}
              </button>
            ))}
          </div>

          <div className="border border-pink-200 dark:border-pink-800 rounded-lg p-3">
            <h3 className="text-sm font-bold text-pink-800 dark:text-pink-300 mb-1">
              {ex.title}
            </h3>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mb-2">
              {ex.question}
            </p>

            {ex.hint && (
              <button
                onClick={() =>
                  setShowHint((h) => ({ ...h, [key]: !h[key] }))
                }
                className="text-[10px] text-pink-600 dark:text-pink-400 underline mb-2"
              >
                {showHint[key] ? "▲ Скрыть подсказку" : "💡 Показать подсказку"}
              </button>
            )}
            {showHint[key] && ex.hint && (
              <div className="mb-2 bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-700 rounded p-2 text-[11px] text-pink-900 dark:text-pink-200 font-mono">
                {ex.hint}
              </div>
            )}

            <div
              className={`border-2 rounded-lg p-3 ${
                isOk
                  ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
                  : isErr
                  ? "border-red-300 bg-red-50 dark:bg-red-900/20"
                  : "border-slate-200 dark:border-slate-700"
              }`}
            >
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                Ваш ответ ({ex.unit}):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputs[key] ?? ""}
                  onChange={(e) =>
                    setInputs((p) => ({ ...p, [key]: e.target.value }))
                  }
                  onKeyDown={(e) =>
                    e.key === "Enter" && !revealed[key] && handleCheck()
                  }
                  disabled={!!revealed[key] && isOk}
                  placeholder="Число..."
                  className="flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-pink-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                />
                {(!revealed[key] || isErr) && (
                  <button
                    onClick={handleCheck}
                    disabled={!inputs[key]?.trim()}
                    className="px-3 py-1.5 bg-pink-600 text-white text-xs font-semibold rounded hover:bg-pink-700 disabled:opacity-40"
                  >
                    Проверить
                  </button>
                )}
              </div>
              {revealed[key] && (
                <div
                  className={`mt-2 text-xs leading-relaxed ${
                    isOk
                      ? "text-emerald-800 dark:text-emerald-300"
                      : "text-red-800 dark:text-red-300"
                  }`}
                >
                  {isOk ? "✓ Верно! " : "✗ Неверно. "}
                  {ex.expl}
                </div>
              )}
              {isErr && (
                <button
                  onClick={() => {
                    setInputs((p) => ({ ...p, [key]: "" }));
                    setRevealed((r) => ({ ...r, [key]: false }));
                  }}
                  className="mt-1 text-[10px] text-amber-700 dark:text-amber-400 underline"
                >
                  Попробовать снова
                </button>
              )}
            </div>

            {done.has(ex.id) && exIdx + 1 < EXERCISES.length && (
              <button
                onClick={() => setExIdx(exIdx + 1)}
                className="mt-3 w-full py-2 bg-pink-600 text-white text-sm font-semibold rounded-lg hover:bg-pink-700"
              >
                Следующее упражнение →
              </button>
            )}

            {allDone && (
              <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-700 rounded-lg text-center">
                <div className="text-2xl mb-1">🎉</div>
                <div className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                  Все 4 упражнения выполнены!
                </div>
                <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">
                  Вы освоили базовые расчёты СФТК и НВФ. Можно переходить к комплексной смете фасадных работ.
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Расценки ЭСН */}
        <section className="bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-xl p-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">
            💰 Расценки ЭСН РК
          </h2>
          <div className="grid md:grid-cols-2 gap-3 text-xs">
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                Для СФТК:
              </h3>
              <ul className="space-y-1 text-slate-700 dark:text-slate-300">
                <li>
                  <code className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1 rounded">
                    Сб.26-01-001
                  </code>{" "}
                  Утепление фасадов плитами ПСБ-С-25 на клее
                </li>
                <li>
                  <code className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1 rounded">
                    Сб.26-01-005
                  </code>{" "}
                  Армирующий слой со стеклосеткой
                </li>
                <li>
                  <code className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1 rounded">
                    Сб.15-01-008
                  </code>{" "}
                  Декоративная штукатурка короед
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                Для НВФ:
              </h3>
              <ul className="space-y-1 text-slate-700 dark:text-slate-300">
                <li>
                  <code className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1 rounded">
                    Сб.26-02-001
                  </code>{" "}
                  Установка кронштейнов вентфасада
                </li>
                <li>
                  <code className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1 rounded">
                    Сб.26-02-005
                  </code>{" "}
                  Утепление минватой 100 мм с пароветрозащитой
                </li>
                <li>
                  <code className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1 rounded">
                    Сб.26-02-010
                  </code>{" "}
                  Облицовка керамогранитом по системе ЭКО
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-300 dark:border-slate-600 text-[11px] text-slate-600 dark:text-slate-400">
            <b>Дополнительно (общие позиции для обоих типов):</b>
            <ul className="mt-1 space-y-0.5">
              <li>
                •{" "}
                <code className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1 rounded">
                  Сб.46
                </code>{" "}
                — устройство и разборка лесов (отдельная позиция)
              </li>
              <li>
                •{" "}
                <code className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1 rounded">
                  Сб.10
                </code>{" "}
                — грунтовка поверхностей (отдельная позиция)
              </li>
            </ul>
          </div>
        </section>

        {/* Фактоид (пожарная безопасность) */}
        <section className="bg-red-50 dark:bg-red-900/20 border-2 border-red-500 dark:border-red-700 rounded-xl p-4">
          <h2 className="text-sm font-bold text-red-800 dark:text-red-300 mb-1">
            ⚠ ВНИМАНИЕ — ПОЖАРНАЯ БЕЗОПАСНОСТЬ
          </h2>
          <p className="text-xs text-red-900 dark:text-red-200 leading-relaxed">
            По <b>СН РК 2.02-05-2002</b> для зданий <b>выше 5 этажей</b> применять только утеплитель из{" "}
            <b>минваты (класс НГ — негорючий)</b>. Пенополистирол (ПСБ-С-25, EPS) <b>ЗАПРЕЩЁН</b> на высотных зданиях:
            горючесть Г1–Г4. Это ключевое требование пожарной безопасности — нарушение блокирует ввод объекта в эксплуатацию.
            <br />
            <span className="text-[11px] italic">
              Совет сметчику: всегда сверяйся с этажностью объекта по проекту перед выбором типа фасадной системы и расценок.
            </span>
          </p>
        </section>
      </div>
    </div>
  );
}
