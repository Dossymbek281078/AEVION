"use client";
import Link from "next/link";
import { useState } from "react";

export default function UniversitiesCampusesPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 96000) <= 8000;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 48_000_000_000) <= 4_500_000_000;

  const correct = {
    ex1: ex1 === "d",
    ex2: ex2Correct,
    ex3: ex3Correct,
    ex4: ex4 === "c",
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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Университеты и кампусы</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🎓 Университеты и студенческие кампусы</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #214. Проектирование и расчёт смет вузов и кампусов РК:
            КазНУ им. аль-Фараби (Алматы, 70 000 студентов), Назарбаев Университет
            (Астана, 8 000 студ., кампус 152 га), КИМЭП, КБТУ, КарТУ им. Букетова.
            СП РК 3.02-04 + СН РК 3.06 «Высшие учебные заведения», лекционные залы
            на 250-500 мест, лаборатории 4-го уровня биобезопасности (BSL-3),
            общежития на 5-10 тыс. мест.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав университетского кампуса</h2>
          <p className="text-slate-300 leading-relaxed">
            По модели Назарбаев Университета и западных стандартов (USGBC, AASHE):
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Academic blocks: лекционные аудитории 250-500 мест, семинарские 30 мест.</li>
            <li>Library + Learning Commons: ≥1 место/10 студентов, 24/7 доступ.</li>
            <li>Research labs: уровень BSL-1 (общелаб.) до BSL-3 (микробиология опасных).</li>
            <li>Inženering Centre: чистые помещения для микроэлектроники (ISO 5-7).</li>
            <li>Sports Complex: бассейн 50 м, ледовая арена, фитнес, теннис, поля.</li>
            <li>Student Residence: общежития 8-10 м²/чел, кухни-блоки по 4 комнаты.</li>
            <li>Dining Halls: 0.5 м²/студ. одновременного посещения.</li>
            <li>Conference Centre с аудиторией на 1000+ мест.</li>
            <li>Faculty Housing (для преподавателей-экспатов в НУ).</li>
            <li>Innovation Park / стартап-инкубатор, ИТ-парк.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Лаборатория BSL-3</h2>
          <p className="text-slate-300">
            Микробиологическая лаборатория уровня BSL-3 для работы с возбудителями
            особо опасных инфекций (сибирская язва, чума, лихорадка Эбола).
            Что обязательно по ВОЗ Lab Biosafety Manual 4th ed?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Достаточно вытяжного шкафа + халата + перчаток" },
              { v: "b", t: "BSL-2 уровень: ламинарный бокс класс II А2 + биосейфти-душ" },
              { v: "c", t: "BSL-3 минимальный: ламинарный шкаф II Б2, отрицательное давление, HEPA-фильтрация" },
              { v: "d", t: "BSL-3 полный: герметичные двери шлюз + биозащ. душ, отриц. давление каскадом −5/−15/−30 Па, ламинарные боксы II Б2, двойная HEPA H14 на вытяжке + автоклавная стерилизация на выходе, автоклав 2-сторонний 150 л, инактиватор стоков, СОУЭ и резерв питания N+1, мониторинг 24/7, ВОЗ Lab Biosafety Manual + ГОСТ ISO 14644" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Площадь кампуса</h2>
          <p className="text-slate-300">
            Кампус на 8 000 студентов очной формы + 1 200 преподавателей.
            Норматив: 12 м²/студ (учебная) + 8 м²/студ (общежитие при 80% проживающих) +
            спорткомплекс 1.5 м²/студ + библиотека 1 м²/студ + общественные 2 м²/студ.
            Какая суммарная застройка кампуса (м²)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            S = S_учеб + S_общеж + S_спорт + S_библ + S_общ_польз<br />
            +инфраструктура (АХУ/электро/ИТП ≈10% от полез. площади)
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Площадь, м²"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: 8000×(12+6.4+1.5+1+2) = 8000×22.9 = 183 000 м² → с учётом коридоров/санузлов/лест. (~30% от полез.) ≈ 96 000 м² капитальной застройки + общежития ≈48 000 м² + 48 000 м² учебно-научное. (Для НУ — ~150 000 м² при кампусе 152 га.)</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет кампуса вуза</h2>
          <p className="text-slate-300">
            ССЦ РК 2026Q2: учебно-научные корпуса 50 000 м² (монолит + НВФ + отделка) — 17.5 млрд тг,
            общежития 48 000 м² (5000 мест) — 11.5 млрд тг, библиотека + Learning Commons 12 000 м² — 4.2 млрд тг,
            спорткомплекс с бассейном 50 м + ледовой — 3.6 млрд тг, конференц-центр на 1000 мест — 1.8 млрд тг,
            оборудование лабораторий (BSL-2/BSL-3) + чистые помещения — 4.8 млрд тг,
            IT-инфра + СКС + библ. RFID + АВ — 1.4 млрд тг, благоустройство 152 га + парковки + ТП — 2.8 млрд тг.
            Сметная стоимость кампуса 8 000 студ.?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~48 млрд тг (допуск ±10%). 17500+11500+4200+3600+1800+4800+1400+2800 = 47 600 млн тг.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Лекционный зал на 500 мест</h2>
          <p className="text-slate-300">
            Лекционная аудитория «амфитеатр» на 500 мест для вуза.
            Какие параметры обязательны по СП РК 3.02-04 и стандартам качества?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Плоский пол + ряды — достаточно для лекций" },
              { v: "b", t: "Амфитеатр угол наклона 4° — компромисс между удобством и стоимостью" },
              { v: "c", t: "Амфитеатр с углом наклона 8-12°, шаг рядов 0.9-1.1 м, ширина места 0.5-0.55 м, расстояние от первого ряда до экрана ≥0.5×высота экрана, акустическая обработка стен α≥0.7 (мин. на 250-2000 Гц), время реверберации 0.8-1.2 с, освещение 300 лк (общее) + 500 лк (на доске), 3-режимная сценография (лекция/демо/затемнение), AV-system с проектором 10 000 лм + lecture capture, отдельная пультовая для оператора" },
              { v: "d", t: "Только AV-оборудование без специальной акустики" },
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
                {score === 4 ? "Отлично — готовы к проектированию университета" : score >= 2 ? "Перечитайте СП РК 3.02-04 + СН РК 3.06" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СП РК 3.02-04 (Учебные здания), СН РК 3.06 (Вузы), ВОЗ Lab Biosafety Manual 4th ed (BSL-1/2/3/4), ГОСТ ISO 14644 (Чистые помещения), USGBC LEED for Campus.</p>
          <p><strong>Реальные объекты РК:</strong> КазНУ им. аль-Фараби (Алматы, 14 факультетов), Назарбаев Университет (Астана, кампус 152 га), КИМЭП, КБТУ, КарТУ им. Букетова, Satbayev University.</p>
        </section>
      </main>
    </div>
  );
}
