"use client";

import Link from "next/link";
import { useState } from "react";

export default function EnergyEfficiencyPage() {
  // Упр.1 — класс энергоэф
  const [ex1, setEx1] = useState<string | null>(null);
  const [ex1Res, setEx1Res] = useState<null | "ok" | "bad">(null);
  const [ex1Sol, setEx1Sol] = useState(false);

  // Упр.2 — толщина утеплителя
  const [ex2T, setEx2T] = useState("");
  const [ex2Res, setEx2Res] = useState<null | "ok" | "bad">(null);
  const [ex2Sol, setEx2Sol] = useState(false);

  // Упр.3 — LEED-сертификация
  const [ex3, setEx3] = useState<string | null>(null);
  const [ex3Res, setEx3Res] = useState<null | "ok" | "bad">(null);
  const [ex3Sol, setEx3Sol] = useState(false);

  // Упр.4 — стоимость экономии
  const [ex4Saved, setEx4Saved] = useState("");
  const [ex4Res, setEx4Res] = useState<null | "ok" | "bad">(null);
  const [ex4Sol, setEx4Sol] = useState(false);

  const checkEx1 = () => setEx1Res(ex1 === "b" ? "ok" : "bad");
  const checkEx2 = () => {
    // R_req=3.8 м²·К/Вт для Алматы, λ_базальт=0.045 Вт/(м·К) → δ = (R - R_constr)·λ
    // R_constr (кирпич 380мм) ≈ 0.5, итого δ = (3.8-0.5)*0.045 = 0.149 м = 149 мм → округление 150 мм
    const t = parseFloat(ex2T);
    if (!isFinite(t)) return setEx2Res("bad");
    setEx2Res(Math.abs(t - 150) <= 10 ? "ok" : "bad");
  };
  const checkEx3 = () => setEx3Res(ex3 === "c" ? "ok" : "bad");
  const checkEx4 = () => {
    // Экономия 25% от 100 кВт·ч/м²/год × 1500 м² × 22 тг/кВт·ч = 825 000 тг/год
    const s = parseFloat(ex4Saved);
    if (!isFinite(s)) return setEx4Res("bad");
    const target = 0.25 * 100 * 1500 * 22; // 825 000
    setEx4Res(Math.abs(s - target) <= 20_000 ? "ok" : "bad");
  };

  const classes = [
    { cls: "A++", q: "≤ 25 кВт·ч/(м²·год)", note: "Пассивный дом (Passivhaus), солнечные панели + рекуперация" },
    { cls: "A+",  q: "26-50",                note: "«Зелёный» класс, тройные стеклопакеты, MVHR" },
    { cls: "A",   q: "51-80",                note: "Высокоэффективный (рекоменд. для нов. строит-ва в РК с 2025)" },
    { cls: "B",   q: "81-120",               note: "Эффективный (минимум для жилья после 2020 по СН РК 2.04-21)" },
    { cls: "C",   q: "121-160",              note: "Базовый — типичный дом 2010-х" },
    { cls: "D",   q: "161-200",              note: "Малоэффективный — советские панели" },
    { cls: "E",   q: "201-250",              note: "Низкоэффективный — реконструкции требует" },
    { cls: "F",   q: "≥ 251",                note: "Очень низкий — ветхое жильё" },
  ];

  const certifications = [
    {
      name: "LEED",
      org: "USGBC (US Green Building Council)",
      country: "США / международная",
      levels: "Certified (40-49) / Silver (50-59) / Gold (60-79) / Platinum (80+)",
      areas: "Sustainable Sites, Water, Energy, Materials, IEQ, Innovation",
      cost: "200-300 тыс. $ для среднего здания, регистрация + аудит + commissioning",
      rkExamples: "Esentai Tower (Gold), Ritz-Carlton Almaty (Silver), Astana International Financial Centre",
    },
    {
      name: "BREEAM",
      org: "BRE (Building Research Establishment), UK",
      country: "Великобритания",
      levels: "Pass / Good / Very Good / Excellent / Outstanding",
      areas: "Management, Health, Energy, Transport, Water, Materials, Waste, Pollution",
      cost: "150-250 тыс. €, активно используется для офисов и магазинов",
      rkExamples: "Talan Towers (Very Good), некоторые объекты Bayan Sulu",
    },
    {
      name: "EDGE",
      org: "IFC (International Finance Corporation), World Bank",
      country: "Международная",
      levels: "EDGE Certified (20%+) / Advanced (40%+) / Zero Carbon (100% + offsets)",
      areas: "Energy ≥20%, Water ≥20%, Materials ≥20% от стандартной модели",
      cost: "10-40 тыс. $, дешевле LEED/BREEAM, удобен для жилья и социального сектора",
      rkExamples: "Программа Жилстройсбербанка, проекты НПО «Казгидромет» / KazAID",
    },
    {
      name: "DGNB",
      org: "Deutsche Gesellschaft für Nachhaltiges Bauen",
      country: "Германия",
      levels: "Bronze / Silver / Gold / Platinum",
      areas: "Ecology, Economy, Social, Technical, Process, Site",
      cost: "100-200 тыс. €, life-cycle assessment, популярен в EU",
      rkExamples: "Точечно — посольство Германии в Астане",
    },
  ];

  const measures = [
    { name: "Утепление стен", reduce: "30-40%", cost: "8-15 тыс. тг/м² фасада", payback: "5-8 лет" },
    { name: "Утепление кровли", reduce: "10-15%", cost: "4-8 тыс. тг/м²", payback: "4-6 лет" },
    { name: "Тройные стеклопакеты", reduce: "10-15%", cost: "+30-50% к обычному окну", payback: "10-15 лет" },
    { name: "Рекуперация воздуха (MVHR)", reduce: "20-30%", cost: "350-700 тыс. тг на квартиру", payback: "6-10 лет" },
    { name: "ИТП с погодным регулированием", reduce: "10-20%", cost: "5-12 млн тг на дом", payback: "3-5 лет" },
    { name: "Светодиоды + датчики присутствия", reduce: "5-8% (электр.)", cost: "150-300 тыс. тг на этаж", payback: "2-3 года" },
    { name: "Солнечные коллекторы для ГВС", reduce: "до 50% ГВС", cost: "0.6-1.2 млн тг на дом", payback: "8-12 лет" },
    { name: "Тепловой насос грунт-вода", reduce: "60-70% тепла", cost: "8-15 млн тг на дом", payback: "10-15 лет" },
  ];

  const requirements = [
    { region: "Алматы", gsop: "3500-4000", r_wall: "3.8", r_roof: "5.5", r_window: "0.85" },
    { region: "Астана", gsop: "5500-6500", r_wall: "4.5", r_roof: "6.5", r_window: "1.05" },
    { region: "Шымкент", gsop: "2500-3000", r_wall: "3.2", r_roof: "4.8", r_window: "0.75" },
    { region: "Усть-Камен.", gsop: "5000-5800", r_wall: "4.3", r_roof: "6.2", r_window: "1.00" },
    { region: "Атырау", gsop: "3000-3500", r_wall: "3.6", r_roof: "5.2", r_window: "0.80" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Энергоэффективность</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🌱 Энергоэффективность зданий
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            Снижение энергопотребления — обязательное требование для всех новых зданий в РК
            (Закон РК «Об энергосбережении» 2012 г., СН РК 2.04-21-2004*, СП РК 2.04-104-2012).
            Для проектов с международным финансированием — обязательны{" "}
            <span className="text-emerald-300 font-medium">LEED / BREEAM / EDGE</span> сертификации.
            Утепление и инженерные мероприятия добавляют 6-12% к стоимости строительства, но
            возвращаются за 5-10 лет за счёт экономии отопления/электричества.
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Норматив</div>
              <div className="text-slate-300">СН РК 2.04-21 + СП РК 2.04-104 + ISO 50001</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Минимум с 2020</div>
              <div className="text-slate-300">Класс B (≤ 120 кВт·ч/м²·год отопл.)</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">ЕБРР / МБРР</div>
              <div className="text-slate-300">EDGE Cert. обязательно (Energy ≥ 20%)</div>
            </div>
          </div>
        </section>

        {/* Section 1: Классы */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📊 Section 1. Классы энергоэффективности (СН РК 2.04-21)
          </h2>
          <p className="text-slate-400 text-sm max-w-4xl">
            Класс присваивается по удельному годовому расходу тепловой энергии на отопление и
            вентиляцию (Q, кВт·ч/(м²·год)) с учётом ГСОП — градусо-суток отопительного периода.
            Указывается в Энергетическом паспорте здания — обязательном документе при сдаче.
          </p>

          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-24">Класс</th>
                  <th className="text-left px-4 py-3 w-48">Q, кВт·ч/(м²·год)</th>
                  <th className="text-left px-4 py-3">Описание</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {classes.map((c) => (
                  <tr key={c.cls} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 font-mono font-bold text-emerald-300">{c.cls}</td>
                    <td className="px-4 py-3 text-slate-200">{c.q}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{c.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2: Сопротивление теплопередаче */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🧱 Section 2. Требуемое сопротивление R, м²·К/Вт по регионам
          </h2>
          <p className="text-slate-400 text-sm max-w-4xl">
            Расчёт сопротивления теплопередаче от ГСОП (градусо-суток отоп. периода). Чем
            холоднее регион — тем выше требование. Толщина утеплителя δ = (R_req − R_constr)·λ,
            где λ — коэф. теплопроводности материала (мин. вата 0.045, ППС 0.034, ПИР 0.022).
          </p>

          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Регион</th>
                  <th className="text-left px-4 py-3">ГСОП</th>
                  <th className="text-left px-4 py-3">R_стен</th>
                  <th className="text-left px-4 py-3">R_кровли</th>
                  <th className="text-left px-4 py-3">R_окон</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {requirements.map((r) => (
                  <tr key={r.region} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 text-slate-100 font-medium">{r.region}</td>
                    <td className="px-4 py-3 text-slate-300">{r.gsop}</td>
                    <td className="px-4 py-3 text-emerald-300 font-mono">{r.r_wall}</td>
                    <td className="px-4 py-3 text-emerald-300 font-mono">{r.r_roof}</td>
                    <td className="px-4 py-3 text-emerald-300 font-mono">{r.r_window}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Меры */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            💡 Section 3. Меры энергосбережения и окупаемость
          </h2>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Мероприятие</th>
                  <th className="text-left px-4 py-3">Эффект</th>
                  <th className="text-left px-4 py-3">Стоимость</th>
                  <th className="text-left px-4 py-3">Окупаемость</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {measures.map((m) => (
                  <tr key={m.name} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 text-slate-100">{m.name}</td>
                    <td className="px-4 py-3 text-emerald-300 font-mono">{m.reduce}</td>
                    <td className="px-4 py-3 text-slate-300">{m.cost}</td>
                    <td className="px-4 py-3 text-amber-300">{m.payback}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 4: Сертификации */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🏆 Section 4. «Зелёные» сертификации
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {certifications.map((c) => (
              <div key={c.name} className="border border-emerald-800/40 bg-emerald-950/20 rounded-xl p-5">
                <h3 className="text-xl font-bold text-emerald-300 mb-1">{c.name}</h3>
                <div className="text-xs text-slate-500 mb-3">{c.org} · {c.country}</div>
                <dl className="text-sm space-y-2 text-slate-300">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Уровни</dt>
                    <dd>{c.levels}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Категории оценки</dt>
                    <dd className="text-xs">{c.areas}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Стоимость</dt>
                    <dd>{c.cost}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Примеры в РК</dt>
                    <dd className="italic text-slate-400 text-xs">{c.rkExamples}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
          <div className="bg-amber-950/30 border border-amber-800/60 rounded-lg p-4 text-sm text-amber-200">
            <strong>Выбор сертификации:</strong> для проектов с финансированием World Bank /
            ЕБРР / АБР — стандартом стал EDGE (дёшево и быстро, обязателен для жилья и
            социальной инфраструктуры). Для престижных коммерческих объектов (БЦ, отели) —
            LEED Gold/Platinum остаётся «золотым стандартом». BREEAM популярен в торговой
            недвижимости. DGNB — точечно для немецких/австрийских инвесторов.
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Section 5. Упражнения</h2>

          {/* Упр.1 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Минимальный класс по СН РК 2.04-21
            </div>
            <div className="text-slate-200 mb-4">
              Какой минимальный класс энергоэффективности обязателен для новых жилых
              многоквартирных зданий в РК после 2020 года согласно СН РК 2.04-21?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "A — высокоэффективный (≤ 80 кВт·ч)" },
                { v: "b", t: "B — эффективный (81-120 кВт·ч)" },
                { v: "c", t: "C — базовый (121-160 кВт·ч)" },
                { v: "d", t: "D — малоэффективный (161-200 кВт·ч)" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1 === opt.v ? "border-emerald-600 bg-emerald-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-emerald-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex1Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — класс B</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-emerald-300">Решение:</strong> Класс B (Эффективный)
                стал обязательным минимумом для новых МКД с 2020 года по СН РК 2.04-21*
                (внесённые поправки 2017-2019). С 2025 года в Алматы и Астане планируется
                переход на минимум класс A. Для проектов с финансированием ЕБРР/МБРР требование
                выше — соответствие EDGE Certified (Energy ≥ 20% экономии от базовой модели).
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Толщина утеплителя
            </div>
            <div className="text-slate-200 mb-4">
              Стена в Алматы: кирпич 380 мм + утеплитель + штукатурка. Требуемое
              R_стен = <strong>3.8 м²·К/Вт</strong> (см. таблицу). Сопротивление кладки + штукатурки
              R_constr ≈ <strong>0.5 м²·К/Вт</strong>. Утеплитель — мин. вата ROCKWOOL ФАСАД
              БАТТС, λ = <strong>0.045 Вт/(м·К)</strong>. Какая толщина утеплителя в мм нужна?
              (Округлить до ближайшего стандартного 10 мм.)
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Толщина δ, мм</span>
              <input value={ex2T} onChange={(e) => setEx2T(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="150" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex2Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 150 мм</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-emerald-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`δ = (R_req − R_constr) × λ
δ = (3.8 − 0.5) × 0.045
δ = 3.3 × 0.045 = 0.1485 м = 148.5 мм
→ округляем до 150 мм (стандартная толщина плиты)

Для Астаны: R_req=4.5 → δ = (4.5−0.5)×0.045 = 180 мм
Для Шымкента: R_req=3.2 → δ = (3.2−0.5)×0.045 = 121 мм → 130 мм
Если использовать ППС (λ=0.034): δ = 3.3×0.034 = 112 мм → 120 мм
Если ПИР (λ=0.022): δ = 3.3×0.022 = 73 мм → 80 мм (дороже, но тоньше)`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Сертификация для МБРР
            </div>
            <div className="text-slate-200 mb-4">
              Девелопер строит социальное жильё в Шымкенте на средства IFC (World Bank Group).
              IFC требует «зелёную» сертификацию с минимальной стоимостью аудита.
              Какая сертификация подойдёт лучше всего?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "LEED Gold (USGBC, США)" },
                { v: "b", t: "BREEAM Excellent (BRE, UK)" },
                { v: "c", t: "EDGE Certified (IFC/World Bank)" },
                { v: "d", t: "DGNB Silver (Германия)" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex3 === opt.v ? "border-emerald-600 bg-emerald-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex3" value={opt.v} checked={ex3 === opt.v} onChange={() => setEx3(opt.v)} className="accent-emerald-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — EDGE</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-emerald-300">Решение:</strong> EDGE (Excellence in
                Design for Greater Efficiencies) — собственная сертификация IFC, разработана
                специально для развивающихся рынков (включая РК). Стоимость 10-40 тыс. $ против
                200-300 тыс. $ для LEED. Требование — экономия ≥ 20% по энергии, воде и
                воплощённой энергии материалов от baseline. В РК активно используется
                Жилстройсбербанком и BI Group для социальных проектов. LEED/BREEAM применимы,
                но избыточны и дороги для социального жилья.
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Экономия от утепления
            </div>
            <div className="text-slate-200 mb-4">
              Жилой дом S = <strong>1 500 м²</strong>, базовое потребление тепла без
              мероприятий — <strong>100 кВт·ч/(м²·год)</strong>. После комплексного утепления
              стен + кровли + установки рекуператора экономия составила <strong>25%</strong>.
              Тариф тепла в Алматы — <strong>22 тг/кВт·ч</strong> (≈ 4 700 тг/Гкал).
              Какая годовая экономия в тенге? Введите площадь:
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Экономия, тг/год</span>
              <input value={ex4Saved} onChange={(e) => setEx4Saved(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="825000" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex4Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 825 000 тг/год</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-emerald-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Экономия = S × Q_base × % × Тариф
Экономия = 1500 × 100 × 0.25 × 22
Экономия = 825 000 тг/год

Капвложения (утепление 150 мм + рекуператоры):
~ 1500 м² × 8 000 тг = 12 000 000 тг (только утепление стен)
+ рекуператоры на 30 кв. × 500 000 = 15 000 000 тг
Итого ~ 27 млн тг

Окупаемость: 27 000 000 / 825 000 ≈ 33 года (без учёта роста
тарифов). Однако с учётом инфляции тепла 8-12%/год реальная
окупаемость — 12-15 лет. Плюс рост рыночной цены квартиры на 8-15%.`}
                </pre>
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          СН РК 2.04-21-2004* — Энергопотребление и тепловая защита. СП РК 2.04-104-2012 —
          Энергетическая эффективность. Закон РК «Об энергосбережении и повышении энерго-
          эффективности» от 13.01.2012 № 541-IV. EDGE — edgebuildings.com (IFC).
        </div>
      </main>
    </div>
  );
}
