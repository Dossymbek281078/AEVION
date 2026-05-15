"use client";
import Link from "next/link";
import { useState } from "react";

export default function BanksBranchesPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 320) <= 30;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 980_000_000) <= 100_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Банковские отделения и хранилища</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🏦 Банковские отделения и денежные хранилища</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #209. Проектирование и расчёт смет на банковские отделения и хранилища РК:
            Halyk Bank, Kaspi, ForteBank, Jusan, Народный, Bank CenterCredit. Денежные
            хранилища класса III по ГОСТ Р 50862, бронированные двери класс 4 ГОСТ Р 51072,
            бронестёкла Б3 EN 1063, СКУД, СОТ, СОС, кассовые узлы. Учебный кейс — отделение
            КУМ Halyk 800 м² с хранилищем 25 м².
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав банковского отделения</h2>
          <p className="text-slate-300 leading-relaxed">
            Согласно ВСН 62-91-94 «Проектирование зданий банков» и Правилам АРФР РК:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Операционный зал (4 м²/клиент-операционист, освещ. 400 лк).</li>
            <li>Кассовый узел с бронекабинами Б3 EN 1063 (бронестекло 28 мм).</li>
            <li>Денежное хранилище (ДХ) класс III: стены ≥250 мм армобетон, дверь класс 4.</li>
            <li>Пересчётный кассовый узел (для розничного банка с депоблоком).</li>
            <li>Зона СБ (мониторинг СОТ, СКУД, СОС, ВТУ).</li>
            <li>Зона VIP/Premium (отдельный вход, переговорные).</li>
            <li>Серверная (СКС, мини-АТС, ББП, ИБП).</li>
            <li>Венткамера, ЭЩ, санузлы, гардероб, ст. зона.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Класс защиты хранилища</h2>
          <p className="text-slate-300">
            Банк планирует хранить до 500 млн тг кассового остатка + сейфовые ячейки клиентов.
            Какой класс ДХ требуется по ГОСТ Р 50862?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Класс I (до 30 кг ВВ-стойкости) — для отделений с минимальным остатком" },
              { v: "b", t: "Класс II (45 кг) — стены 200 мм бетон, дверь класс 2" },
              { v: "c", t: "Класс III (60 кг ВВ + 30 мин взлома) — типовой для банковских отделений среднего уровня" },
              { v: "d", t: "Класс III с дверью класс 4 (60 мин взлом термический+механический): стены ≥250 мм армобетон Кл-А-III, потолок и пол того же класса, замки Mauer/Kaba двухключевые + кодовый, СКУД с двойной идентификацией, ИК-датчики + сейсмо, СОС реагирует за 3 сек" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Объём армобетона хранилища</h2>
          <p className="text-slate-300">
            Хранилище в плане 5×5 м H=3 м (чистые размеры). Толщина стен/пола/потолка 280 мм
            (с защитным армированием и закладными деталями).
            Сколько м³ армобетона B30 нужно (≈)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            V_общ = V_наруж − V_внутр<br />
            V_наруж = (5+0.56)×(5+0.56)×(3+0.56)<br />
            V_внутр = 5×5×3 = 75 м³
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="V, м³"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: V_нар = 5.56×5.56×3.56 ≈ 110 м³; V_бетон = 110−75 = 35 м³ × повышенная плотность армирования и доп. слои защиты (плёнки, теплозвукоизол.) → объём ниши и проёмов добавит ~30%, итого по смете ~320 м³ включая фундамент + дверной короб.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет отделения 800 м²</h2>
          <p className="text-slate-300">
            ССЦ РК 2026Q2: ремонт класса А премиум 800 м² (без коробки здания) — 360 млн тг,
            хранилище кл. III с дверью кл. 4 — 240 млн тг (включая систему депозитарных ячеек 200 шт),
            кассовый узел 6 окон + бронекабины Б3 — 95 млн тг, СКУД/СОТ/СОС/ВТУ NICE+HID — 85 млн тг,
            СКС CAT6A + IT-инфра + ИБП — 75 млн тг, мебель + дизайн брендбук — 80 млн тг,
            кондиционирование VRF Daikin + вентиляция — 45 млн тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~980 млн тг (допуск ±10%). 360+240+95+85+75+80+45 = 980 млн тг.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Защита кассового узла</h2>
          <p className="text-slate-300">
            Что обязательно для кассы операционного отделения по ГОСТ Р 51072 и Правилам АРФР?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Достаточно стеклянной перегородки и обычной двери" },
              { v: "b", t: "Бронестекло Б1 (защита от пистолета ПМ) — минимальный класс" },
              { v: "c", t: "Бронекабина класс защиты Б3 (БР3, защита от АК-74 7.62 мм) по ГОСТ Р 50941, стекло 28 мм EN 1063, тревожная сигнализация на полу/под столом, замкнутый узел с шлюзом, СКУД на вход в кассу, видеонаблюдение с архивом ≥30 дней, бронедверь с переговорным окном" },
              { v: "d", t: "Только видеонаблюдение и тревожная кнопка — без бронирования" },
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
                {score === 4 ? "Отлично — готовы к проектированию банковского отделения" : score >= 2 ? "Перечитайте ГОСТ Р 50862, 51072, ВСН 62-91-94" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> ВСН 62-91-94 (Банки), ГОСТ Р 50862-2017 (Хранилища), ГОСТ Р 51072-2005 (Двери), EN 1063 (Бронестёкла), ГОСТ Р 50941 (Кабины).</p>
          <p><strong>Реальные объекты РК:</strong> Halyk Bank (Алматы, Нур-Султан HQ), Kaspi центры (1200 отделений), ForteBank, Jusan Bank, Bank CenterCredit.</p>
        </section>
      </main>
    </div>
  );
}
