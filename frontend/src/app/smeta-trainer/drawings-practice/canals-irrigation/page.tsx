"use client";
import Link from "next/link";
import { useState } from "react";

export default function CanalsIrrigationPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 1280) <= 120;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 165_000_000_000) <= 15_000_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Магистральные каналы и ирригация</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">💧 Магистральные каналы и ирригация</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #230. Магистральные оросительные и водохозяйственные каналы РК:
            Большой Алматинский канал (БАК) 168 км, Q=85 м³/с — питьевая+ирригация
            Алматинской обл.; Канал им. К. Сатпаева 458 км Q=120 м³/с — переброска
            Иртыша в Центр. Каз.; Каратальский канал, Талас-Ассинский. Бетонная
            облицовка трапец. сечения 200 мм с тепловыми швами, шлюзы-регуляторы,
            насосные станции, дюкеры через реки/балки. СНиП 2.06.03, СН РК 4.01-02,
            ICID Guidelines for Canal Lining.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав магистрального канала</h2>
          <p className="text-slate-300 leading-relaxed">
            СНиП 2.06.03 «Мелиоративные системы и сооружения»:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Земляное русло трапец. сечения (заложение откосов m=1.5-2.5, ширина по дну 4-12 м, глубина 3-5 м).</li>
            <li>Бетонная облицовка плитами 200-300 мм (PCC C25/30 морозоустойчивый F300 W6) или геомембранная HDPE 2 мм.</li>
            <li>Швы тепловые с заполнителем PVC stop-water через 6-9 м, расширительные — через 25-30 м.</li>
            <li>Дренаж под облицовкой (геотекстиль NoNonwoven 400 г/м² + щебень + перфор. трубы Ø160 мм).</li>
            <li>Шлюзы-регуляторы (Sluice Gates) с подъёмными воротами Tainter (для расходов до 100 м³/с).</li>
            <li>Насосные станции на участках обратного уклона (Сатпаева — 22 НС, общая мощность ~750 МВт).</li>
            <li>Дюкеры через водотоки/балки/дороги (ж/б трубы Ø2-4 м или коробчатые сечения 6×4 м).</li>
            <li>Акведуки и мостовые переходы (преднапряж. ж/б балочный или арочный).</li>
            <li>Сбросные сооружения, водомеры (рейка, лоток Парсхалла, ультразвук. расходомеры).</li>
            <li>Полоса отвода ширина 50-100 м (с дорогой обслуживания и ЛЭП 10 кВ).</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Облицовка канала</h2>
          <p className="text-slate-300">
            Магистральный канал Q=85 м³/с в Алматинской обл. (засушливый климат,
            фильтрационные потери критичны). Какое решение по СНиП 2.06.03?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Земляное русло без облицовки — потери 30-40% не страшны" },
              { v: "b", t: "Глинистый замок 1 м толщины — традиционное решение" },
              { v: "c", t: "Бетонная плитная облицовка PCC C25/30 W6 F300 толщиной 220 мм на щебеночной подготовке 150 мм с геотекстилем 400 г/м² (защита от пучения), плиты 3×2 м с тепловыми швами PVC stop-water через 6 м, расширительными швами с битум-полимерной мастикой через 25 м, дренаж за облицовкой перфор. трубой Ø160 мм с уклоном к сборным колодцам через 100 м (предотвращает гидростатич. давление при понижении уровня в канале), фильтрационные потери снижаются с 30% до 3-5%, срок службы 50+ лет, СНиП 2.06.03 + ICID Canal Lining Guidelines" },
              { v: "d", t: "Только геомембрана HDPE 1.5 мм с защитным слоем" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Объём бетона облицовки</h2>
          <p className="text-slate-300">
            Канал L=80 км, трапец. сечение: ширина по дну b=8 м, глубина H=4 м,
            заложение m=2 (откосы). Облицовка бетоном 220 мм по дну + откосам
            (включая берму +0.5 м над расч. уровнем воды).
            Какой объём бетона нужен (м³)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            P_смоч = b + 2×H×√(1+m²)  (мокрый периметр)<br />
            V = P × δ_облиц × L<br />
            +20% на сборные плиты и потери (резка, брак)
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="V_бетона, ×100 м³ (1280 = 128 000)"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: P = 8 + 2×4×√(1+4) = 8 + 8×2.24 = 8 + 17.9 = 25.9 м (включая 0.5 м бермы → ~27 м); V = 27 × 0.22 × 80 000 = 475 200 м³ + 20% потерь = ~570 000 м³ для облицовки и плит = ~1 280 × 100 м³ с учётом мостов, шлюзов, узлов сопряжения (общие монолитные части ~1 280 × 100 м³).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет канала</h2>
          <p className="text-slate-300">
            ССЦ РК 2026Q2: земляные работы 80 км (отрывка 35 млн м³ грунта + насыпь дамб) — 26 млрд тг,
            бетонная облицовка плиты PCC + швы PVC + битум-мастика — 38 млрд тг,
            дренаж под облицовкой + геотекстиль — 4.2 млрд тг,
            6 шлюзов-регуляторов с Tainter-воротами + автоматика — 14 млрд тг,
            3 насосные станции (60 МВт суммарно) + резерв ДГУ — 32 млрд тг,
            4 дюкера через реки/балки (ж/б Ø3 м, L=300-800 м) — 18 млрд тг,
            2 акведука через крупные водотоки L=400 м — 12 млрд тг,
            автодорога обслуживания Кат. IV 80 км + мосты — 8.4 млрд тг,
            ЛЭП 10 кВ + ТП 1000 кВА × 24 шт. — 3.6 млрд тг,
            автоматика SCADA + расходомеры ультразвук. — 2.8 млрд тг,
            проектирование + изыскания + экспертиза — 4.6 млрд тг,
            НР+СП и резерв на удорожание — 1.4 млрд тг. Стоимость 80 км канала?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~165 млрд тг (допуск ±10%). 26+38+4.2+14+32+18+12+8.4+3.6+2.8+4.6+1.4 = 165 млрд тг. Удельная стоимость ~2 млрд тг/км — соответствует мировым magistral. каналам с насосными станциями. БАК (168 км) — ~280 млрд тг в ценах 2026.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Защита от ледостава и пучения</h2>
          <p className="text-slate-300">
            Канал в континентальной зоне РК работает в t° от −40°C зимой до +40°C летом.
            Какие меры защиты от разрушения облицовки?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Достаточно использовать морозостойкий бетон F200 без других мер" },
              { v: "b", t: "Откачать воду на зиму — простое решение" },
              { v: "c", t: "Только укрепить откосы крупным камнем" },
              { v: "d", t: "Комплекс мер: 1) Бетон F300 W6 c микрокремнезёмом и воздухововлекающими добавками SikaAer (содержание воздуха 4-6%); 2) Тепловые швы PVC stop-water через 6-9 м + расширительные с битум-полимерной мастикой через 25-30 м (компенсируют ±60 мм деформации); 3) Дренаж под облицовкой защищает от гидростатич. давления и пучения; 4) Морозоустойчивость основания: при наличии пучинистых грунтов — замена 1-1.5 м на песчано-щебеночную подушку, утепление пенополистиролом EPS 100 мм; 5) Зимний режим эксплуатации — поддержание расхода ≥0.3 м/с для предотвращения замерзания, ледоборные катера/буксиры; 6) Весенний пропуск ледохода через специальные ледосбросы; 7) Усиление кромок облицовки на углах поворотов и узлах сопряжения арматурой A-III Ø16 шагом 200 мм; 8) Ежегодная инспекция и ямочный ремонт мастиками + плитный ремонт при необходимости; СНиП 2.06.03 + СН РК 4.01-02 + ICID Cold Regions Engineering" },
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
                {score === 4 ? "Отлично — готовы к проектированию канала" : score >= 2 ? "Перечитайте СНиП 2.06.03 + СН РК 4.01-02 + ICID" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СНиП 2.06.03 (Мелиорация), СН РК 4.01-02, ICID Canal Lining Guidelines, ICOLD Bulletins, ISO 9001 для гидротехн. проектирования.</p>
          <p><strong>Реальные объекты РК:</strong> БАК Большой Алматинский Канал (168 км, Q=85 м³/с), Канал им. К. Сатпаева (458 км, переброска Иртыш-Центр. Каз.), Каратальский, Талас-Ассинский, БАК для г. Шымкент.</p>
        </section>
      </main>
    </div>
  );
}
