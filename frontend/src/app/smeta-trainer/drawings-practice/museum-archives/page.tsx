"use client";
import Link from "next/link";
import { useState } from "react";

export default function MuseumArchivesPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 12) <= 1;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 58_000_000_000) <= 5_500_000_000;

  const correct = {
    ex1: ex1 === "c",
    ex2: ex2Correct,
    ex3: ex3Correct,
    ex4: ex4 === "d",
  };
  const score = Object.values(correct).filter(Boolean).length;

  const optClass = (state: string, value: string, ok: boolean) => {
    if (!showResults || state !== value) return state === value ? "border-blue-500 bg-blue-500/20" : "border-slate-700 hover:border-slate-500";
    return ok ? "border-emerald-500 bg-emerald-500/20" : "border-rose-500 bg-rose-500/20";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300 hover:text-blue-200 transition">← К разделам</Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Музеи и архивы</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🏛️ Музеи, архивы и фондохранилища</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #222. Проектирование и расчёт смет музейно-архивных зданий РК:
            Национальный музей РК (Астана, 74 000 м², открыт 2014, инвестиции $230 млн),
            Государственный музей искусств им. Кастеева (Алматы), ЦГА РК (Архивы).
            Климат-контроль фондохранилищ +18°C/RH 50%, освещ. экспозиции 50-200 лк
            (бумага)/300 лк (картины), HEPA F9/H13 фильтрация, противопожарное газовое
            Inergen (IG-541), стандарты ICOM, ISO 11799, СП 31-103.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Зонирование музея</h2>
          <p className="text-slate-300 leading-relaxed">
            По ICOM Museum Standards + ISO 11799 «Архивохранилища»:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Экспозиционные залы (постоянная экспозиция + временные выставки 3-6 мес).</li>
            <li>Фондохранилища (закрытые для посещения, 60-70% общей площади).</li>
            <li>Реставрационные мастерские (живопись, графика, дерево, металл, текстиль).</li>
            <li>Лаборатории атрибуции (РФА, ИК-Фурье спектроскопия, рентгенофлуоресцентн.).</li>
            <li>Учебные классы и образовательный центр для школьников.</li>
            <li>Конференц-зал на 250-500 мест с переводом 4-6 языков.</li>
            <li>Библиотека + читальный зал научных сотрудников + цифровой архив.</li>
            <li>Зона приёма посетителей: гардероб (1 м/м на 50-80 чел), кафе, магазин сувениров.</li>
            <li>Помещения экстренной обработки экспонатов (после пожара/наводнения).</li>
            <li>Транзитные комнаты (карантин 30 сут для новых поступлений — биозараж.).</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Климат-контроль фонда живописи</h2>
          <p className="text-slate-300">
            Фондохранилище живописи на холсте и масле (~5000 ед. хранения).
            Какие параметры микроклимата по ICOM + ISO 11799?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "+22°C / RH=65%, как в жилых помещениях — для удобства персонала" },
              { v: "b", t: "+15°C / RH=40%, как у архивных бумаг — общая норма" },
              { v: "c", t: "+18°C ±1°C (постоянно круглый год), RH=50% ±5%, скорость нарастания/спада ≤2°C/сутки и ≤5%/сутки (резкие перепады недопустимы, краска отслаивается), фильтрация HEPA F9 (PM2.5≤25 мкг/м³), активированный уголь для SO₂/NOx/O₃/уксусной кисл. (≤1 мкг/м³ каждого), УФ-фильтрация светильников (UV≤75 мкВт/лм), освещение макс. 150 лк для масла / 50 лк для пастели/акварели, dataloggers HOBO с веб-мониторингом, ICOM-CC + ISO 11799" },
              { v: "d", t: "+10°C/RH=30% для долговечности — арктический режим" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Кратность воздухообмена</h2>
          <p className="text-slate-300">
            Фондохранилище 5000 м² × h=4 м = 20 000 м³. Норма ISO 11799 — воздухообмен
            ≥6 раз/сутки рециркуляц. (для перемешивания и фильтрации) + 1 крата свежего
            воздуха (для людей и удаления газов). Какая часовая кратность общая (1/ч)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            n = (n_рец/24 + n_свеж/24) × 24<br />
            (6+6 в сутки → /24 = 0.25/0.25 + округление до 1/ч)
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Кратность × 10 (для 1.2 → 12)"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: общее за сутки 6+1=7 крат → 7/24 ≈ 0.29 1/ч. Но для учёта пиковых нагрузок (массовая фильтрация после ремонтных работ или открытия залов) — расчётно 1.2 1/ч (×10=12).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет музея 30 000 м²</h2>
          <p className="text-slate-300">
            ССЦ + импорт: монолит каркас 30 000 м² + перекрытия + ферменная крыша — 8.4 млрд тг,
            фасад премиум (натур. камень + витражи) — 3.6 млрд тг,
            отделка экспозиций + витрины Goppion/Klein — 6.8 млрд тг,
            фондохранилища с климатом + стеллажи Forster — 4.2 млрд тг,
            HVAC прецизионный + увлажнение пар-пар + HEPA + УФ — 7.8 млрд тг,
            СОУЭ + СОТ + СКУД + противокражные UV/IR-датчики + RFID — 4.6 млрд тг,
            газовое пожаротушение Inergen IG-541 + аэрозольное — 5.4 млрд тг,
            АВ-инфра + мультимедиа экспозиции + аудиогиды — 3.4 млрд тг,
            реставрационные мастерские + лаборатории атрибуции — 4.8 млрд тг,
            ИТ + цифровой архив + библиотека + образоват. — 2.8 млрд тг,
            благоустройство + парковка + охранный периметр — 3.6 млрд тг,
            проектирование + аудит ICOM + страхование коллекций — 2.6 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~58 млрд тг (допуск ±10%). 8.4+3.6+6.8+4.2+7.8+4.6+5.4+3.4+4.8+2.8+3.6+2.6 = 58.0 млрд тг. Национальный музей РК Астана (74 000 м², открыт 2014) стоил ~$230 млн ≈ 100 млрд тг — в 1.7 раза больше из-за престижного характера и удвоенной площади.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Газовое пожаротушение</h2>
          <p className="text-slate-300">
            В фондохранилище нельзя применять воду — она уничтожит экспонаты сильнее огня.
            Какая система газового пожаротушения по NFPA 2001 / ISO 14520?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "CO₂ высокого давления — самая дешёвая, но смертельно опасна для персонала" },
              { v: "b", t: "Хладон 23 (HFC-23) — устаревший, озоноразрушающий" },
              { v: "c", t: "Аэрозольное пожаротушение с порошком — повредит экспонаты" },
              { v: "d", t: "Inergen IG-541 (52% N₂ + 40% Ar + 8% CO₂): инертный газовый состав, снижает O₂ в защищаемом помещении с 21% до 12.5% (огонь не поддерживается, но человек способен дышать — 8% CO₂ стимулирует учащённое дыхание и адаптацию), без следов на экспонатах, не влагопоглощающий, время выпуска 60 сек до концентрации 42-46%, удержание ≥10 мин, баллоны 80-литровые × 350 шт для зала 5000 м², пожарные извещатели ASD VESDA (всасывающие) с 4 уровнями чувствительности, ручной запуск + автомат с 30-секундной задержкой, NFPA 2001 + ISO 14520-15 + ГОСТ Р 50969" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex4, o.v, correct.ex4)}`}>
                <input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={() => setEx4(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-between bg-slate-900/60 border border-slate-700 rounded-xl p-6">
          <button
            onClick={() => setShowResults(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition"
          >
            Проверить ответы
          </button>
          {showResults && (
            <div className="text-right">
              <div className={`text-2xl font-bold ${score === 4 ? "text-emerald-400" : score >= 2 ? "text-amber-400" : "text-rose-400"}`}>
                {score} / 4
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {score === 4 ? "Отлично — готовы к проектированию музея" : score >= 2 ? "Перечитайте ICOM-CC + ISO 11799 + NFPA 2001" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СП 31-103 (Зрелищные/Музеи), ISO 11799 (Архивохранилища), ICOM-CC (Conservation), NFPA 2001 (Чистые газы), ISO 14520-15 (Inergen), ГОСТ Р 50969.</p>
          <p><strong>Реальные объекты РК:</strong> Национальный музей РК (Астана, 74 000 м²), Музей искусств им. Кастеева (Алматы), ЦГА РК, Музей Первого Президента, Музей при КИМЭП.</p>
        </section>
      </main>
    </div>
  );
}
