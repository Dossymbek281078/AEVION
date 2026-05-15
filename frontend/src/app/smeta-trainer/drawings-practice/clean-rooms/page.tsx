"use client";

import Link from "next/link";
import { useState } from "react";

export default function CleanRoomsPage() {
  const [ex1, setEx1] = useState<string | null>(null);
  const [ex1Res, setEx1Res] = useState<null | "ok" | "bad">(null);
  const [ex1Sol, setEx1Sol] = useState(false);

  const [ex2, setEx2] = useState<string | null>(null);
  const [ex2Res, setEx2Res] = useState<null | "ok" | "bad">(null);
  const [ex2Sol, setEx2Sol] = useState(false);

  const [ex3, setEx3] = useState("");
  const [ex3Res, setEx3Res] = useState<null | "ok" | "bad">(null);
  const [ex3Sol, setEx3Sol] = useState(false);

  const [ex4, setEx4] = useState<string | null>(null);
  const [ex4Res, setEx4Res] = useState<null | "ok" | "bad">(null);
  const [ex4Sol, setEx4Sol] = useState(false);

  const checkEx1 = () => setEx1Res(ex1 === "b" ? "ok" : "bad");
  const checkEx2 = () => setEx2Res(ex2 === "c" ? "ok" : "bad");
  const checkEx3 = () => {
    const v = parseFloat(ex3);
    if (!isFinite(v)) return setEx3Res("bad");
    setEx3Res(Math.abs(v - 300_000_000) <= 10_000_000 ? "ok" : "bad");
  };
  const checkEx4 = () => setEx4Res(ex4 === "d" ? "ok" : "bad");

  const isoClasses = [
    {
      iso: "ISO 1",
      particles: "≤ 10 частиц/м³ (≥0.1 мкм)",
      us: "Class 1",
      examples: "Нано-электроника, производство процессоров (Intel, TSMC 3–7 нм)",
    },
    {
      iso: "ISO 2",
      particles: "≤ 100 частиц/м³",
      us: "Class 10",
      examples: "Нано-технологии, квантовые чипы, полупроводниковые вафли",
    },
    {
      iso: "ISO 3",
      particles: "≤ 1 000 частиц/м³",
      us: "Class 100",
      examples: "Производство жёстких дисков, оптических систем",
    },
    {
      iso: "ISO 4",
      particles: "≤ 10 000 частиц/м³",
      us: "Class 1 000",
      examples: "Фармацевтические асептические линии (ампулы, инфузионные растворы)",
    },
    {
      iso: "ISO 5",
      particles: "≤ 3 520 частиц ≥0.5 мкм/м³",
      us: "Class 100",
      examples: "Операционные залы больниц, производство стерильных инъекций",
    },
    {
      iso: "ISO 6",
      particles: "≤ 35 200 частиц/м³",
      us: "Class 1 000",
      examples: "Фармацевтические производства (таблетки), пищевые производства",
    },
    {
      iso: "ISO 7",
      particles: "≤ 352 000 частиц/м³",
      us: "Class 10 000",
      examples: "Упаковка стерильной фармы, медицинские устройства, лаборатории",
    },
    {
      iso: "ISO 8",
      particles: "≤ 3 520 000 частиц/м³",
      us: "Class 100 000",
      examples: "Упаковка фармы, пищевые цеха с высокими требованиями к чистоте",
    },
    {
      iso: "ISO 9",
      particles: "≤ 35 200 000 частиц/м³",
      us: "Нет аналога",
      examples: "Обычный воздух промышленного помещения — нижняя граница нормирования",
    },
  ];

  const constructiveFeatures = [
    {
      name: "Антистатические полы",
      desc: "Эпоксидные или виниловые антистатические покрытия (сопротивление 10⁵–10⁹ Ом). Швы герметизированы. Без пыле-отделения. В особо чистых помещениях — перфорированные полы для вентиляции снизу.",
      icon: "⚡",
    },
    {
      name: "Потолок с HEPA-фильтрами",
      desc: "Подшивной потолок с панелями HEPA (H14) или ULPA (U15-U17). Степень заполнения потолка фильтрами: ISO 5 — 100%, ISO 7 — 25–50%. Каждая фильтро-панель: 1 200 × 600 мм, расход: 0.45 м³/с.",
      icon: "🔲",
    },
    {
      name: "Ламинарный поток воздуха",
      desc: "Воздух движется строго вертикально — сверху вниз (downflow). Скорость: 0.3–0.5 м/с (ISO 5), 0.1–0.3 м/с (ISO 7). Захватывает частицы и уносит через перфорированный пол или решётки по периметру.",
      icon: "💨",
    },
    {
      name: "Избыточное давление",
      desc: "В чистой комнате поддерживается давление +15–50 Па выше коридора. Воздух перетекает наружу, предотвращая попадание грязного воздуха через неплотности. Каскадное давление: чистое > предкамера > коридор.",
      icon: "🔒",
    },
  ];

  const kazApplications = [
    {
      company: "Химфарм (Шымкент)",
      type: "Фармацевтический завод",
      iso: "ISO 5–7",
      note: "Крупнейший производитель лекарств РК. Реконструкция линий в 2019–2022. GMP-сертификат.",
    },
    {
      company: "Nobel Almaty Pharmaceutical",
      type: "Фармацевтика",
      iso: "ISO 5–6",
      note: "Алматы. Производство инъекционных препаратов, ампулы, флаконы. GMP EU.",
    },
    {
      company: "НЦОТ (Нац. центр онкологии, Астана)",
      type: "Операционные блоки",
      iso: "ISO 5",
      note: "Операционные залы для онкохирургии. Ламинарные потолки ULPA + спецвентиляция.",
    },
    {
      company: "Казахский НИИ онкологии",
      type: "Лабораторный комплекс",
      iso: "ISO 6–7",
      note: "Микробиологические лаборатории BSL-2/BSL-3 (с избыточным отрицательным давлением).",
    },
    {
      company: "NIS Tech Park (Назарбаев Университет)",
      type: "Полупроводниковая лаборатория",
      iso: "ISO 4–5",
      note: "Cleanroom для исследований в нанотехнологиях и полупроводниках. Единственная в РК.",
    },
  ];

  const costBenchmarks = [
    { iso: "ISO 4–5", use: "Операционные залы, стерильные фарм. линии", min: "3 000 000", max: "8 000 000", note: "100% покрытие HEPA/ULPA, ламинарный ток, хирургические светильники" },
    { iso: "ISO 6–7", use: "Фармацевтическая упаковка, лаборатории", min: "1 000 000", max: "3 000 000", note: "Частичное HEPA, приточно-вытяжная с фильтрацией, эпоксидные полы" },
    { iso: "ISO 8", use: "Пищевые производства, базовая фарма", min: "300 000", max: "800 000", note: "Стандартные требования: мойкабельные поверхности, контроль частиц" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-teal-300 hover:text-teal-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Чистые комнаты</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🧪 Чистые комнаты
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            Чистая комната (cleanroom) — специально оборудованное помещение с контролируемым
            количеством частиц пыли, температурой, влажностью и давлением. Применяются
            в фармацевтике, микроэлектронике, медицине. Строительство чистых комнат —
            высокоспециализированная область с бюджетами от <strong className="text-teal-300">1 до 8 млн тг/м²</strong>.
            В РК рынок растёт в связи с развитием фармацевтической промышленности.
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-teal-900/40 rounded-lg p-3 bg-teal-950/20">
              <div className="text-teal-500 uppercase tracking-wider mb-1">Стандарт классификации</div>
              <div className="text-slate-300">ISO 14644-1 (ISO 1–9)</div>
            </div>
            <div className="border border-teal-900/40 rounded-lg p-3 bg-teal-950/20">
              <div className="text-teal-500 uppercase tracking-wider mb-1">Доля вентиляции в бюджете</div>
              <div className="text-slate-300">40–60% стоимости cleanroom</div>
            </div>
            <div className="border border-teal-900/40 rounded-lg p-3 bg-teal-950/20">
              <div className="text-teal-500 uppercase tracking-wider mb-1">Самые чистые в мире</div>
              <div className="text-slate-300">ISO 1: цеха TSMC, Intel — 10 частиц/м³</div>
            </div>
          </div>
        </section>

        {/* Section 1: ISO классы */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📊 Section 1. Классы чистоты ISO 1–9
          </h2>
          <p className="text-sm text-slate-400">
            Стандарт ISO 14644-1 определяет 9 классов чистоты по концентрации
            твёрдых частиц в воздухе. Чем ниже номер ISO — тем жёстче требования
            и выше стоимость строительства.
          </p>
          <div className="overflow-x-auto border border-teal-900/30 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-20">Класс ISO</th>
                  <th className="text-left px-4 py-3 w-56">Частиц ≥0.5 мкм / м³</th>
                  <th className="text-left px-4 py-3 w-28">US FED (аналог)</th>
                  <th className="text-left px-4 py-3">Примеры применения</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {isoClasses.map((c) => (
                  <tr
                    key={c.iso}
                    className={`hover:bg-slate-900/40 ${
                      c.iso === "ISO 5" ? "bg-teal-950/20" : ""
                    }`}
                  >
                    <td
                      className={`px-4 py-3 font-bold text-sm ${
                        c.iso === "ISO 5"
                          ? "text-teal-300"
                          : parseInt(c.iso.split(" ")[1]) <= 4
                          ? "text-emerald-300"
                          : parseInt(c.iso.split(" ")[1]) >= 8
                          ? "text-slate-500"
                          : "text-slate-300"
                      }`}
                    >
                      {c.iso}
                    </td>
                    <td className="px-4 py-3 font-mono text-amber-300 text-xs">{c.particles}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{c.us}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{c.examples}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">
            * ISO 5 (бывший US FED Class 100) выделен — это наиболее распространённый
            класс для операционных залов и стерильного фармацевтического производства в РК.
          </p>
        </section>

        {/* Section 2: Конструктив */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🏗 Section 2. Особенности конструктива чистых комнат
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {constructiveFeatures.map((f) => (
              <div key={f.name} className="border border-teal-900/30 bg-teal-950/10 rounded-xl p-5">
                <h3 className="text-base font-semibold text-teal-300 mb-2">
                  {f.icon} {f.name}
                </h3>
                <p className="text-sm text-slate-300">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="border border-slate-800 rounded-xl p-4 bg-slate-900/30 text-sm text-slate-400">
            <strong className="text-slate-300">Дополнительные требования к ограждениям:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
              <li>Стены: сэндвич-панели с полиэстерным покрытием или гипсокартон с эпоксидным мытьём</li>
              <li>Все стыки, углы — радиусные (без прямых углов для устранения «пылевых ловушек»)</li>
              <li>Двери: герметичные, с самозакрывателями, без порогов (либо с герметичным порогом)</li>
              <li>Освещение: встроенные светодиодные светильники с герметичными корпусами IP54+</li>
              <li>Окна (если есть): двойной или тройной стеклопакет в герметичных рамах</li>
            </ul>
          </div>
        </section>

        {/* Section 3: Казахстан */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🇰🇿 Section 3. Применение в Казахстане
          </h2>
          <div className="space-y-3">
            {kazApplications.map((a) => (
              <div key={a.company} className="border border-slate-800 rounded-xl p-4 bg-slate-900/30 grid grid-cols-1 md:grid-cols-4 gap-2 items-start">
                <div>
                  <div className="text-teal-300 font-semibold text-sm">{a.company}</div>
                  <div className="text-slate-500 text-xs">{a.type}</div>
                </div>
                <div className="text-center md:text-left">
                  <div className="text-xs text-slate-500 uppercase tracking-wider">Класс</div>
                  <div className="font-mono text-amber-300 text-sm">{a.iso}</div>
                </div>
                <div className="md:col-span-2 text-xs text-slate-400 italic">{a.note}</div>
              </div>
            ))}
          </div>
          <div className="border border-teal-900/20 bg-teal-950/10 rounded-xl p-4 text-sm">
            <strong className="text-teal-300">Перспективы рынка чистых комнат РК:</strong>
            <p className="text-slate-400 text-xs mt-2">
              Государственная программа развития фармацевтики РК до 2030 г. предусматривает
              строительство 5–8 новых GMP-предприятий и расширение существующих. Инвестиции —
              300+ млрд тг. Специалистов по строительству чистых комнат в РК критически мало:
              ~20–30 сертифицированных проектировщиков на всю страну. Зарплаты в 2–4 раза
              выше среднего сметчика.
            </p>
          </div>
        </section>

        {/* Section 4: Стоимость */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            💰 Section 4. Бенчмарки стоимости строительства
          </h2>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-24">Класс ISO</th>
                  <th className="text-left px-4 py-3">Применение</th>
                  <th className="text-left px-4 py-3 w-48">Стоимость (тг/м²)</th>
                  <th className="text-left px-4 py-3">Комментарий</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {costBenchmarks.map((b) => (
                  <tr key={b.iso} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 font-bold text-teal-300">{b.iso}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{b.use}</td>
                    <td className="px-4 py-3 font-mono text-emerald-300 text-xs">
                      {b.min} – {b.max} тг/м²
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs italic">{b.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">
            * Бенчмарки для РК на 2024–2025 гг. Стоимость «под ключ» включает строительство,
            вентиляцию, HEPA/ULPA фильтры, отделку, квалификацию (IQ/OQ/PQ). Не включает
            технологическое оборудование (ферментёры, реакторы, расфасовочные линии).
          </p>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Упражнения</h2>

          {/* Упр.1 */}
          <div className="border border-teal-900/30 rounded-xl p-5 bg-teal-950/10">
            <div className="text-xs text-teal-600 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Класс операционного зала
            </div>
            <div className="text-slate-200 mb-4">
              Проектируется операционный блок многопрофильной больницы в Алматы.
              Какой класс чистоты ISO требуется для <strong>операционного зала</strong>?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "ISO 8 (Class 100 000) — достаточно для медицинских помещений" },
                {
                  v: "b",
                  t: "ISO 5 (Class 100) — не более 3 520 частиц ≥0.5 мкм на м³. Обязателен для хирургических операционных по ASHRAE 170 и стандартам ВОЗ",
                },
                { v: "c", t: "ISO 3 (Class 100) — максимально чистый для любых медицинских операций" },
                { v: "d", t: "Для операционных нет обязательных требований по ISO, достаточно HEPA-фильтров" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1 === opt.v
                      ? "border-teal-600 bg-teal-950/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex1"
                    value={opt.v}
                    checked={ex1 === opt.v}
                    onChange={() => setEx1(opt.v)}
                    className="accent-teal-500"
                  />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={checkEx1}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-600 text-white rounded transition text-sm"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx1Sol((v) => !v)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm"
              >
                {ex1Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex1Res === "ok" && (
                <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">
                  ✅ Верно — ISO 5 для операционных
                </span>
              )}
              {ex1Res === "bad" && (
                <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">
                  ❌ Неверно — проверь таблицу ISO
                </span>
              )}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-teal-300">Решение:</strong> ISO 5 (≤ 3 520 частиц ≥0.5 мкм/м³)
                — международный стандарт для операционных залов. Обоснование:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li><strong>ASHRAE 170</strong> (Ventilation of Health Care Facilities): OR = ISO 5, 20 ACH минимум</li>
                  <li><strong>ГОСТ Р ИСО 14644</strong>: операционные — «защищённые зоны», ISO 5 min</li>
                  <li>Снижение вероятности постоперационных инфекций при ISO 5 vs ISO 8: в 3–5 раз</li>
                  <li>Стоимость операционного зала ISO 5 в РК: 3–8 млн тг/м² «под ключ»</li>
                  <li>Для хирургии имплантатов (суставы, клапаны): рекомендуется ISO 4–5</li>
                </ul>
                В РК обязательные требования к операционным прописаны в МСАН 2.08.01-09
                (Санитарные правила для ЛПУ). ISO-класс приводится в задании на проектирование.
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-teal-900/30 rounded-xl p-5 bg-teal-950/10">
            <div className="text-xs text-teal-600 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — HEPA-фильтры
            </div>
            <div className="text-slate-200 mb-4">
              В спецификацию чистой комнаты включены фильтры <strong>HEPA H14</strong>.
              Какие частицы они задерживают согласно стандарту DIN EN 1822?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Частицы ≥ 10 мкм с эффективностью 99.9% (крупные пылинки)" },
                { v: "b", t: "Частицы ≥ 1 мкм с эффективностью 99.5%" },
                {
                  v: "c",
                  t: "Частицы ≥ 0.3 мкм с эффективностью 99.97% — именно на 0.3 мкм HEPA имеет наименьшую эффективность (MPPS — Most Penetrating Particle Size)",
                },
                { v: "d", t: "Задерживают только биологические частицы (бактерии, вирусы), но не пыль" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex2 === opt.v
                      ? "border-teal-600 bg-teal-950/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex2"
                    value={opt.v}
                    checked={ex2 === opt.v}
                    onChange={() => setEx2(opt.v)}
                    className="accent-teal-500"
                  />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={checkEx2}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-600 text-white rounded transition text-sm"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx2Sol((v) => !v)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm"
              >
                {ex2Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex2Res === "ok" && (
                <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">
                  ✅ Верно — ≥0.3 мкм, 99.97%
                </span>
              )}
              {ex2Res === "bad" && (
                <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">
                  ❌ Неверно
                </span>
              )}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-teal-300">Решение:</strong> HEPA (High-Efficiency
                Particulate Air) — стандартизирован по DIN EN 1822 (EN ISO 29463).
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li><strong>H13:</strong> 99.95% для частиц ≥0.3 мкм</li>
                  <li><strong>H14:</strong> 99.995% для частиц ≥0.3 мкм — стандарт для ISO 5–6</li>
                  <li><strong>U15/U16/U17 (ULPA):</strong> 99.9995–99.9999997% — для ISO 1–4</li>
                  <li>0.3 мкм — MPPS (Most Penetrating Particle Size), наихудший случай для волокнистых фильтров (диффузия + инерция минимальны)</li>
                </ul>
                Стоимость HEPA H14 панели (600×600 мм): 50–150 тыс. тг.
                Замена фильтров (по перепаду давления): каждые 2–5 лет.
                При операционной ISO 5 (S=50 м²) — 100% потолок = 138 фильтров.
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-teal-900/30 rounded-xl p-5 bg-teal-950/10">
            <div className="text-xs text-teal-600 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Бюджет фармацевтической чистой комнаты
            </div>
            <div className="text-slate-200 mb-4">
              Строится чистая комната <strong>ISO 7</strong> для упаковки
              фармацевтической продукции. Площадь <strong>200 м²</strong>.
              Применяемый бенчмарк — <strong>1 500 000 тг/м²</strong>.
              Рассчитайте стоимость строительства (тенге).
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Стоимость строительства, тенге</span>
              <input
                value={ex3}
                onChange={(e) => setEx3(e.target.value)}
                type="number"
                className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100"
                placeholder="300000000"
              />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={checkEx3}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-600 text-white rounded transition text-sm"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx3Sol((v) => !v)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm"
              >
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex3Res === "ok" && (
                <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">
                  ✅ Верно — 300 000 000 тг (300 млн)
                </span>
              )}
              {ex3Res === "bad" && (
                <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">
                  ❌ Перепроверь: площадь × бенчмарк
                </span>
              )}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-teal-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Стоимость = Площадь × Бенчмарк
          = 200 м² × 1 500 000 тг/м²
          = 300 000 000 тг = 300 млн тг

Ориентировочная структура бюджета 300 млн тг:
• Вентиляция и фильтрация (HEPA, AHU): 40%  = 120 млн тг
• Строительная часть (стены, полы, потолки): 25% =  75 млн тг
• Электроснабжение + освещение:            15%  =  45 млн тг
• Антистатические полы (эпоксидные):        8%  =  24 млн тг
• Квалификация (IQ/OQ/PQ + тесты):         7%  =  21 млн тг
• Проектирование и надзор:                  5%  =  15 млн тг

Для сравнения: операционная ISO 5 (50 м²) по
бенчмарку 5 млн тг/м² = 250 млн тг (в 1.2 раза дешевле
меньшей по площади, но значительно более чистой).

Важно: цена техн. оборудования (расфасовочные линии,
конвейеры, упаковочные машины) — НЕ включена.
Оборудование может составлять ещё 200–500 млн тг.`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-teal-900/30 rounded-xl p-5 bg-teal-950/10">
            <div className="text-xs text-teal-600 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Защита от загрязнения
            </div>
            <div className="text-slate-200 mb-4">
              Как предотвратить попадание загрязнённого воздуха из коридора в
              чистую комнату через неплотности дверей и стыков?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Установить воздушную завесу над дверью (тепловую пушку)" },
                { v: "b", t: "Поставить сотрудника охраны, чтобы контролировал открывание дверей" },
                { v: "c", t: "Создать разрежение (отрицательное давление) в чистой комнате, чтобы воздух шёл внутрь" },
                {
                  v: "d",
                  t: "Создать избыточное давление (+15–20 Па) в чистой комнате — воздух постоянно вытекает наружу, препятствуя проникновению частиц из коридора",
                },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex4 === opt.v
                      ? "border-teal-600 bg-teal-950/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex4"
                    value={opt.v}
                    checked={ex4 === opt.v}
                    onChange={() => setEx4(opt.v)}
                    className="accent-teal-500"
                  />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={checkEx4}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-600 text-white rounded transition text-sm"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx4Sol((v) => !v)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm"
              >
                {ex4Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex4Res === "ok" && (
                <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">
                  ✅ Верно — избыточное давление +15–20 Па
                </span>
              )}
              {ex4Res === "bad" && (
                <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">
                  ❌ Неверно
                </span>
              )}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-teal-300">Решение:</strong> Избыточное давление —
                основной метод защиты чистых комнат от загрязнения.
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Чистая комната: +15–50 Па выше атмосферного давления коридора</li>
                  <li>Принцип: через любую щель воздух <em>вытекает</em> наружу, а не притекает</li>
                  <li>Каскадное давление: чистое (+50 Па) → предкамера (+20 Па) → коридор (0 Па)</li>
                  <li>ИСКЛЮЧЕНИЕ: BSL-3/4 лаборатории (опасные патогены) — <em>отрицательное</em> давление, чтобы заражённый воздух не вышел наружу</li>
                </ul>
                В системе вентиляции: контроллер поддерживает перепад давления автоматически.
                Датчик давления (0–100 Па): 50–200 тыс. тг. Контроллер HVAC с функцией
                управления давлением включается в смету раздела ОВиК (HVAC).
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          ISO 14644-1 (Cleanrooms and associated controlled environments). DIN EN 1822 (HEPA/ULPA фильтры).
          ASHRAE 170 (Ventilation of Health Care Facilities). GMP EU (аннекс 1, 2024 ред.).
          СП РК 2.02-05 (пожарная безопасность). МСАН 2.08.01-09 (ЛПУ в РК).
          Примеры РК: Химфарм, Nobel Almaty, НЦОТ Астана, НИИ онкологии.
        </div>
      </main>
    </div>
  );
}
