"use client";
import Link from "next/link";
import { useState } from "react";

export default function ElevatorsGranariesPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 79) <= 5;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 8_500_000_000) <= 800_000_000;

  const correct = {
    ex1: ex1 === "c",
    ex2: ex2Correct,
    ex3: ex3Correct,
    ex4: ex4 === "b",
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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Элеваторы и зернохранилища</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🌾 Элеваторы и зернохранилища</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #195. Расчёт стоимости и проектирование объектов хранения зерна РК:
            силосы Ø6/9/12 м H=30 м из железобетона/металла, аспирационные системы,
            нории НЦ-100, конвейерные галереи. Нормативы: СН РК 3.04-13, СП 13-102,
            ГОСТ 27675-88, СП РК 3.02-105. Учебный кейс — элеватор 50 тыс. т Костанай.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Технологическая цепочка элеватора</h2>
          <p className="text-slate-300 leading-relaxed">
            Согласно СП РК 3.02-105 поток зерна от приёмки до отгрузки:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-slate-300 pl-2">
            <li>Автомобильная разгрузка (АРМ-5, АРМ-30) или ж/д приёмка.</li>
            <li>Очистка сепараторами БЦС-25/50 (отделение мусора, лёгких примесей).</li>
            <li>Сушка в зерносушилках (ДСП-32, ДСП-50) — снижение влажности до 14%.</li>
            <li>Подъём норией НЦ-100 на надсилосную галерею.</li>
            <li>Распределение по силосам через конвейеры.</li>
            <li>Хранение с активным вентилированием (контроль t° и влажности).</li>
            <li>Отгрузка ленточными конвейерами или нориями вниз.</li>
          </ol>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Выбор типа силоса</h2>
          <p className="text-slate-300">
            Для элеватора 50 тыс. т в Костанайской области (резко-континентальный климат,
            t° −40…+40°C, длительное хранение). Какой тип силоса предпочтительнее?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Металлические оцинкованные Ø9 м (дешевле, но конденсат и низкая огнестойкость)" },
              { v: "b", t: "Деревянные клеёные секции (экологичность, но огнеопасны)" },
              { v: "c", t: "Сборно-монолитные железобетонные Ø6 м H=30 м (огнестойкость R120, термоинерция, СП РК 3.02-105)" },
              { v: "d", t: "Кирпичные башни 8×8 м (традиционность, но дороже и трудоёмко)" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Расчёт количества силосов</h2>
          <p className="text-slate-300">
            Элеватор 50 000 т пшеницы (плотность 750 кг/м³). Силос Ø6 м H=30 м,
            коэффициент заполнения 0.85, конус днища съедает 5% объёма.
            Сколько силосов потребуется (округление вверх)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            V_силоса = π × (D/2)² × H × 0.95 × 0.85<br />
            M_силоса = V × ρ; N = M_общ / M_силоса (↑)
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Количество силосов, шт"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: V≈685 м³ → M≈407 т → ~79 силосов в кустах 6×13 или 7×12</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет элеватора 50 тыс. т</h2>
          <p className="text-slate-300">
            ССЦ РК 2026Q2: ж/б силос 6×30 м — 75 млн тг/шт (фундамент + конструкции + днище),
            рабочая башня с нориями — 1.2 млрд тг, сушилка ДСП-50 — 380 млн тг,
            автоприёмка + ж/д приёмка — 650 млн тг, лента + конвейеры + аспирация — 480 млн тг,
            КИП/электрика — 320 млн тг, благоустройство и подъездные — 220 млн тг.
            Сметная стоимость элеватора 50 тыс. т (~79 силосов)?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~8.5 млрд тг (допуск ±10%). 79×75 + 1200 + 380 + 650 + 480 + 320 + 220 = 8 175 млн тг ≈ 8.5 с НР+СП.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Аспирация и пожбезопасность</h2>
          <p className="text-slate-300">
            Зерновая пыль взрывоопасна (НПВ 30–60 г/м³, температура воспламенения ~440°C).
            Какое требование по СН РК 2.02-15 (пожарная безопасность) ключевое для элеватора?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Установка датчиков СО2 в каждом силосе и аварийная сигнализация" },
              { v: "b", t: "Класс взрывоопасной зоны В-IIa, аспирация с искрогасителями, взрыворазрядители на силосах, заземление оборудования" },
              { v: "c", t: "Огнетушители ОП-50 каждые 10 м по галереям, спринклерное пожаротушение водой" },
              { v: "d", t: "Установка систем газового пожаротушения CO2 во всех силосах" },
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
                {score === 4 ? "Отлично — готовы к проектированию элеватора" : score >= 2 ? "Перечитайте СП РК 3.02-105" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СН РК 3.04-13 (Зернохранилища), СП РК 3.02-105 (Технология), СН РК 2.02-15 (Пожбез), ГОСТ 27675-88 (Силосы), СП 13-102 (Конструктив).</p>
          <p><strong>Реальные объекты РК:</strong> АО «Иволга-Холдинг» (Костанай), Северо-Казахстанский элеваторный комплекс, Цеснаагро, элеваторы КТЖ ст. Тобол/Курган.</p>
        </section>
      </main>
    </div>
  );
}
