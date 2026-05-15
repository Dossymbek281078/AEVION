"use client";

import Link from "next/link";
import { useState } from "react";

type Result = { ok: boolean; msg: string } | null;

export default function AsbestosRemovalPage() {
  const [a1, setA1] = useState<string>("");
  const [r1, setR1] = useState<Result>(null);
  const [s1, setS1] = useState(false);

  const [a2, setA2] = useState<string>("");
  const [r2, setR2] = useState<Result>(null);
  const [s2, setS2] = useState(false);

  const [a3, setA3] = useState<string>("");
  const [r3, setR3] = useState<Result>(null);
  const [s3, setS3] = useState(false);

  const [a4, setA4] = useState<string>("");
  const [r4, setR4] = useState<Result>(null);
  const [s4, setS4] = useState(false);

  const checkChoice = (val: string, correct: string): Result => {
    if (!val) return { ok: false, msg: "Выберите вариант ответа." };
    return val === correct
      ? { ok: true, msg: "Верно: требуется полный проект организации работ + согласование с СЭС РК." }
      : { ok: false, msg: "Неверно. Шифер 1990 г. — это АСМ I категории, обычный демонтаж запрещён." };
  };

  const checkNumeric = (val: string, target: number, tol: number, unit: string): Result => {
    const n = parseFloat(val.replace(",", "."));
    if (isNaN(n)) return { ok: false, msg: "Введите число." };
    const diff = Math.abs(n - target) / target;
    return diff <= tol
      ? { ok: true, msg: `Верно (±${(tol * 100).toFixed(0)}%): ≈ ${target} ${unit}.` }
      : { ok: false, msg: `Не попали в допуск ±${(tol * 100).toFixed(0)}%. Эталон ≈ ${target} ${unit}.` };
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-stone-800/60 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-stone-300 hover:text-amber-300 transition-colors text-sm"
          >
            ← К разделам
          </Link>
          <span className="text-xs text-stone-500 uppercase tracking-wider">
            AEVION Smeta Trainer · Опасные работы
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-amber-200 mb-3">
            ☣️ Демонтаж асбеста — шифер, плиты, изоляция
          </h1>
          <p className="text-stone-300 leading-relaxed">
            Асбестосодержащие материалы (АСМ) — хризотил-асбест и амфиболы — относятся к канцерогенам
            группы 1 по классификации ВОЗ/IARC. Демонтаж АСМ в Республике Казахстан регулируется
            <span className="text-amber-300"> СанПиН РК «Гигиенические требования к производству асбеста и асбестосодержащих материалов»</span>,
            <span className="text-amber-300"> ГОСТ Р 56218-2014</span> «Демонтаж асбестосодержащих изделий и материалов»,
            <span className="text-amber-300"> ТР ТС 010/2011</span> и рекомендациями ВОЗ.
          </p>
          <p className="text-stone-400 mt-3 text-sm leading-relaxed">
            Стоимость демонтажа в РК (2025–2026): <span className="text-amber-300 font-semibold">2 500 – 8 500 тг/м²</span> — в
            зависимости от категории АСМ, способа упаковки, расстояния до лицензированного полигона
            и стоимости проекта/лабораторных заключений.
          </p>
        </section>

        <section className="rounded-2xl bg-stone-900/40 border border-stone-800 p-6">
          <h2 className="text-xl font-semibold text-amber-200 mb-4">
            1. Категории АСМ, встречающиеся при сносе/реконструкции
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-stone-400 border-b border-stone-700">
                  <th className="text-left py-2 px-3">Тип АСМ</th>
                  <th className="text-left py-2 px-3">Где встречается</th>
                  <th className="text-left py-2 px-3">Категория опасности</th>
                  <th className="text-left py-2 px-3">Демонтаж тг/м²</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800">
                <tr>
                  <td className="py-2 px-3">Асбест-цементный шифер</td>
                  <td className="py-2 px-3 text-stone-400">Кровли жилых и пром. зданий 1960–2005 гг.</td>
                  <td className="py-2 px-3 text-amber-300">I — связанный, при сломе → пыль</td>
                  <td className="py-2 px-3 text-stone-300">2 500 – 4 000</td>
                </tr>
                <tr>
                  <td className="py-2 px-3">Плоские АЦ-плиты</td>
                  <td className="py-2 px-3 text-stone-400">Фасады, перегородки, сантех. кабины</td>
                  <td className="py-2 px-3 text-amber-300">I — связанный</td>
                  <td className="py-2 px-3 text-stone-300">3 200 – 5 000</td>
                </tr>
                <tr>
                  <td className="py-2 px-3">Теплоизоляция труб ХВС/ГВС</td>
                  <td className="py-2 px-3 text-stone-400">Подвалы, чердаки, тепловые пункты</td>
                  <td className="py-2 px-3 text-rose-300">II — несвязанный, рыхлый</td>
                  <td className="py-2 px-3 text-stone-300">5 500 – 7 200</td>
                </tr>
                <tr>
                  <td className="py-2 px-3">Асбестовый картон / прокладки</td>
                  <td className="py-2 px-3 text-stone-400">Электрощитовые, котельные, печи</td>
                  <td className="py-2 px-3 text-rose-300">II — несвязанный</td>
                  <td className="py-2 px-3 text-stone-300">4 000 – 6 500</td>
                </tr>
                <tr>
                  <td className="py-2 px-3">Бронекабельная защита АСБ</td>
                  <td className="py-2 px-3 text-stone-400">Подземные силовые кабели до 10 кВ</td>
                  <td className="py-2 px-3 text-amber-300">I — связанный, в свинц. оболочке</td>
                  <td className="py-2 px-3 text-stone-300">6 000 – 8 500</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl bg-stone-900/40 border border-stone-800 p-6">
          <h2 className="text-xl font-semibold text-amber-200 mb-4">
            2. Этапы демонтажа АСМ — что входит в смету
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-stone-400 border-b border-stone-700">
                  <th className="text-left py-2 px-3">Этап</th>
                  <th className="text-left py-2 px-3">Содержание</th>
                  <th className="text-left py-2 px-3">Срок</th>
                  <th className="text-left py-2 px-3">Стоимость, тг</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800">
                <tr>
                  <td className="py-2 px-3">1. Лаб. заключение</td>
                  <td className="py-2 px-3 text-stone-400">Отбор проб + микроскопия в независ. аккред. лаб. (РСЭК, СЭС)</td>
                  <td className="py-2 px-3">3–7 дней</td>
                  <td className="py-2 px-3 text-amber-300">45 000 – 120 000</td>
                </tr>
                <tr>
                  <td className="py-2 px-3">2. ПОР (проект)</td>
                  <td className="py-2 px-3 text-stone-400">Проект организации работ с разделом ОТ + ООС, схема упаковки</td>
                  <td className="py-2 px-3">7–14 дней</td>
                  <td className="py-2 px-3 text-amber-300">180 000 – 450 000</td>
                </tr>
                <tr>
                  <td className="py-2 px-3">3. Согласование СЭС РК</td>
                  <td className="py-2 px-3 text-stone-400">Уведомление ДСЭК, акт-разрешение, госпошлина</td>
                  <td className="py-2 px-3">5–15 дней</td>
                  <td className="py-2 px-3 text-amber-300">60 000 – 150 000</td>
                </tr>
                <tr>
                  <td className="py-2 px-3">4. Демонтаж</td>
                  <td className="py-2 px-3 text-stone-400">Смачивание поверхности, ручная разборка, упаковка в ПЭ-мешки и big-bag</td>
                  <td className="py-2 px-3">по объёму</td>
                  <td className="py-2 px-3 text-amber-300">по расценке</td>
                </tr>
                <tr>
                  <td className="py-2 px-3">5. Утилизация</td>
                  <td className="py-2 px-3 text-stone-400">Транспортировка спецмашиной + захоронение на лиц. полигоне (Capital Waste, Алматы)</td>
                  <td className="py-2 px-3">1–3 дня</td>
                  <td className="py-2 px-3 text-amber-300">28 000 – 42 000 / м³</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl bg-stone-900/40 border border-stone-800 p-6">
          <h2 className="text-xl font-semibold text-amber-200 mb-6">
            3. Интерактивные упражнения
          </h2>

          {/* Упражнение 1 — категория опасности */}
          <div className="mb-8 rounded-xl bg-slate-900/60 border border-stone-700/60 p-5">
            <h3 className="font-semibold text-stone-200 mb-2">
              Упражнение 1. Категория опасности АСМ
            </h3>
            <p className="text-stone-400 text-sm mb-4 leading-relaxed">
              Подрядчик готовит снос частного дома 1990 г. постройки в Алматинской области.
              На кровле — асбест-цементный волнистый шифер ВО, площадь скатов 480 м². Какой
              режим производства работ требуется заложить в смету?
            </p>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Обычный демонтаж кровли по ЭСН Сб.46, материал — в ТБО" },
                { v: "b", t: "Демонтаж + стандартные СИЗ (рукавицы, очки), вывоз на стройсвалку" },
                { v: "c", t: "Полный проект организации работ + согласование с СЭС + лиц. полигон" },
                { v: "d", t: "Можно демонтировать своими силами, шифер не опасен пока целый" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${
                    a1 === opt.v
                      ? "border-amber-400/60 bg-amber-500/10"
                      : "border-stone-700/40 hover:border-stone-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex1"
                    value={opt.v}
                    checked={a1 === opt.v}
                    onChange={(e) => setA1(e.target.value)}
                    className="mt-1 accent-amber-400"
                  />
                  <span className="text-stone-300">
                    <span className="text-amber-300 font-mono mr-2">{opt.v})</span>
                    {opt.t}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setR1(checkChoice(a1, "c"))}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold text-sm transition-colors"
              >
                Проверить
              </button>
              <button
                onClick={() => setS1((v) => !v)}
                className="px-4 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-sm transition-colors"
              >
                {s1 ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {r1 && (
              <p className={`mt-3 text-sm ${r1.ok ? "text-emerald-300" : "text-rose-300"}`}>
                {r1.msg}
              </p>
            )}
            {s1 && (
              <div className="mt-4 p-4 rounded-lg bg-slate-950/70 border border-stone-700/60 text-sm text-stone-300 leading-relaxed">
                <p className="text-amber-300 font-semibold mb-2">Решение:</p>
                Шифер ВО производства 1990 г. содержит ≈ 10–14% хризотил-асбеста (ГОСТ 30340-95).
                По СанПиН РК и ГОСТ Р 56218 относится к АСМ I категории. При сломе/демонтаже
                выделяется респирабельная пыль с волокнами {"<"} 3 мкм. Юридически:
                <ul className="list-disc list-inside mt-2 space-y-1 text-stone-400">
                  <li>уведомление ДСЭК минимум за 14 дней</li>
                  <li>проект организации работ с разделом ОТ + ООС</li>
                  <li>лабораторное заключение об отсутствии амфибол</li>
                  <li>захоронение только на лицензированном полигоне (Capital Waste)</li>
                </ul>
                <p className="mt-2">
                  Правильный ответ — <span className="text-emerald-300 font-semibold">c</span>.
                </p>
              </div>
            )}
          </div>

          {/* Упражнение 2 — СИЗ */}
          <div className="mb-8 rounded-xl bg-slate-900/60 border border-stone-700/60 p-5">
            <h3 className="font-semibold text-stone-200 mb-2">
              Упражнение 2. Расчёт комплектов СИЗ
            </h3>
            <p className="text-stone-400 text-sm mb-4 leading-relaxed">
              Бригада 6 человек выполняет демонтаж шифера 480 м². По СанПиН — 1 одноразовый
              комплект СИЗ (комбинезон Tyvek + полумаска FFP3 + перчатки) на 1 человека на смену.
              Работы рассчитаны на 1 смену, но норма требует +30% запас на замену порванного и
              перерывы. Сколько комплектов закупить?
            </p>
            <input
              type="text"
              value={a2}
              onChange={(e) => setA2(e.target.value)}
              placeholder="Введите число комплектов"
              className="w-full md:w-72 px-4 py-2 rounded-lg bg-slate-950 border border-stone-700 text-stone-200 placeholder-stone-600 focus:border-amber-400 focus:outline-none text-sm"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setR2(checkNumeric(a2, 8, 0.25, "комплектов"))}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold text-sm transition-colors"
              >
                Проверить
              </button>
              <button
                onClick={() => setS2((v) => !v)}
                className="px-4 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-sm transition-colors"
              >
                {s2 ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {r2 && (
              <p className={`mt-3 text-sm ${r2.ok ? "text-emerald-300" : "text-rose-300"}`}>
                {r2.msg}
              </p>
            )}
            {s2 && (
              <div className="mt-4 p-4 rounded-lg bg-slate-950/70 border border-stone-700/60 text-sm text-stone-300 leading-relaxed">
                <p className="text-amber-300 font-semibold mb-2">Решение:</p>
                <ul className="list-disc list-inside space-y-1 text-stone-300">
                  <li>База: 6 чел × 1 комплект = 6 комплектов</li>
                  <li>Запас 30%: 6 × 0,30 = 1,8 ≈ 2 комплекта</li>
                  <li>Итого: 6 + 2 = <span className="text-amber-300 font-semibold">8 комплектов</span></li>
                </ul>
                <p className="mt-2 text-stone-400">
                  Tyvek 500 Xpert ≈ 4 200 тг/шт, FFP3 (3M 9332+) ≈ 1 800 тг/шт, нитрил перчатки
                  ≈ 250 тг. Стоимость комплекта ≈ 6 250 тг × 8 = 50 000 тг.
                </p>
              </div>
            )}
          </div>

          {/* Упражнение 3 — объём контейнеров */}
          <div className="mb-8 rounded-xl bg-slate-900/60 border border-stone-700/60 p-5">
            <h3 className="font-semibold text-stone-200 mb-2">
              Упражнение 3. Объём контейнеров под упаковку
            </h3>
            <p className="text-stone-400 text-sm mb-4 leading-relaxed">
              Шифер ВО, площадь 480 м², толщина листа 5,8 мм, насыпная плотность фрагментов
              в big-bag ≈ 1,7 т/м³. Нужно посчитать объём (м³) под упаковку и захоронение —
              именно по этому объёму считается тариф полигона.
            </p>
            <input
              type="text"
              value={a3}
              onChange={(e) => setA3(e.target.value)}
              placeholder="Объём, м³"
              className="w-full md:w-72 px-4 py-2 rounded-lg bg-slate-950 border border-stone-700 text-stone-200 placeholder-stone-600 focus:border-amber-400 focus:outline-none text-sm"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setR3(checkNumeric(a3, 4.7, 0.15, "м³"))}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold text-sm transition-colors"
              >
                Проверить
              </button>
              <button
                onClick={() => setS3((v) => !v)}
                className="px-4 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-sm transition-colors"
              >
                {s3 ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {r3 && (
              <p className={`mt-3 text-sm ${r3.ok ? "text-emerald-300" : "text-rose-300"}`}>
                {r3.msg}
              </p>
            )}
            {s3 && (
              <div className="mt-4 p-4 rounded-lg bg-slate-950/70 border border-stone-700/60 text-sm text-stone-300 leading-relaxed">
                <p className="text-amber-300 font-semibold mb-2">Решение:</p>
                <ul className="list-disc list-inside space-y-1 text-stone-300">
                  <li>Объём цельного шифера: 480 м² × 0,0058 м = 2,784 м³</li>
                  <li>Масса (плотность шифера 1,9 т/м³): 2,784 × 1,9 ≈ 5,29 т</li>
                  <li>Объём после фрагментации (плотн. 1,7 т/м³): 5,29 ÷ 1,7 ≈ 3,11 м³</li>
                  <li>Коэф. неплотной укладки в big-bag (1,5): 3,11 × 1,5 ≈ <span className="text-amber-300 font-semibold">4,7 м³</span></li>
                </ul>
                <p className="mt-2 text-stone-400">
                  В пересчёте на стандартный big-bag 1 м³ = 5 шт., либо 1 морской контейнер 20-фут
                  на 6–8 объектов такого размера.
                </p>
              </div>
            )}
          </div>

          {/* Упражнение 4 — комплексная стоимость */}
          <div className="rounded-xl bg-slate-900/60 border border-stone-700/60 p-5">
            <h3 className="font-semibold text-stone-200 mb-2">
              Упражнение 4. Комплексная смета демонтажа
            </h3>
            <p className="text-stone-400 text-sm mb-4 leading-relaxed">
              Сметчик собирает полную стоимость демонтажа 480 м² шифера: лаб. заключение +
              ПОР + согласование СЭС + СИЗ + работа бригады + контейнеры + утилизация на
              полигоне Capital Waste (Алматы). Какая цифра должна получиться (тг)?
            </p>
            <input
              type="text"
              value={a4}
              onChange={(e) => setA4(e.target.value)}
              placeholder="Сумма, тг"
              className="w-full md:w-72 px-4 py-2 rounded-lg bg-slate-950 border border-stone-700 text-stone-200 placeholder-stone-600 focus:border-amber-400 focus:outline-none text-sm"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setR4(checkNumeric(a4, 1850000, 0.15, "тг"))}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold text-sm transition-colors"
              >
                Проверить
              </button>
              <button
                onClick={() => setS4((v) => !v)}
                className="px-4 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-sm transition-colors"
              >
                {s4 ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {r4 && (
              <p className={`mt-3 text-sm ${r4.ok ? "text-emerald-300" : "text-rose-300"}`}>
                {r4.msg}
              </p>
            )}
            {s4 && (
              <div className="mt-4 p-4 rounded-lg bg-slate-950/70 border border-stone-700/60 text-sm text-stone-300 leading-relaxed">
                <p className="text-amber-300 font-semibold mb-2">Решение (укрупнённая калькуляция):</p>
                <table className="w-full text-xs mt-2">
                  <thead>
                    <tr className="text-stone-500">
                      <th className="text-left py-1">Статья</th>
                      <th className="text-right py-1">Сумма, тг</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800">
                    <tr>
                      <td className="py-1">Лаб. заключение (РСЭК)</td>
                      <td className="text-right">85 000</td>
                    </tr>
                    <tr>
                      <td className="py-1">ПОР + раздел ОТ/ООС</td>
                      <td className="text-right">280 000</td>
                    </tr>
                    <tr>
                      <td className="py-1">Согласование ДСЭК + госпошлина</td>
                      <td className="text-right">95 000</td>
                    </tr>
                    <tr>
                      <td className="py-1">СИЗ (8 комп. × 6 250 тг)</td>
                      <td className="text-right">50 000</td>
                    </tr>
                    <tr>
                      <td className="py-1">Демонтаж бригадой 480 м² × 2 600 тг (Сб.46-15)</td>
                      <td className="text-right">1 248 000</td>
                    </tr>
                    <tr>
                      <td className="py-1">Big-bag упаковка (24 шт × 1 800 тг)</td>
                      <td className="text-right">43 200</td>
                    </tr>
                    <tr>
                      <td className="py-1">Транспорт спецмашиной до полигона</td>
                      <td className="text-right">38 000</td>
                    </tr>
                    <tr>
                      <td className="py-1">Захоронение Capital Waste (4,7 м³ × 32 000 тг)</td>
                      <td className="text-right">150 400</td>
                    </tr>
                    <tr className="border-t border-stone-700">
                      <td className="py-2 font-semibold text-amber-300">ИТОГО</td>
                      <td className="text-right font-semibold text-amber-300">≈ 1 850 000</td>
                    </tr>
                  </tbody>
                </table>
                <p className="mt-2 text-stone-400">
                  В пересчёте на 1 м² ≈ 3 850 тг — попадает в рыночный диапазон 2 500 – 8 500 тг/м².
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl bg-stone-900/40 border border-stone-800 p-6">
          <h2 className="text-xl font-semibold text-amber-200 mb-4">
            4. Применяемые расценки ЭСН
          </h2>
          <ul className="text-sm text-stone-300 space-y-2 leading-relaxed">
            <li>
              <span className="text-amber-300 font-mono">Сб.46</span> — «Работы при реконструкции зданий и сооружений», базовый сборник
              на разборку конструкций.
            </li>
            <li>
              <span className="text-amber-300 font-mono">Сб.46-15</span> — специальная расценка для
              демонтажа конструкций из материалов с повышенной опасностью (АСМ, краски с свинцом,
              ртутьсодержащие лампы).
            </li>
            <li>
              <span className="text-amber-300 font-mono">Сб.46-04-001-01</span> — разборка кровельного
              покрытия из АЦ-листов с упаковкой в спец. тару.
            </li>
            <li>
              <span className="text-amber-300 font-mono">ТЕРр-69</span> — нормативы на работы по
              утилизации отходов III–IV класса опасности.
            </li>
            <li>
              <span className="text-amber-300 font-mono">ССЦ РК 2026</span> — индекс опасных работ
              К_оп = 1,35 к ФОТ + 1,18 к материалам (СИЗ, big-bag, спец. транспорт).
            </li>
          </ul>
        </section>

        <section className="rounded-2xl bg-gradient-to-br from-stone-900/70 to-amber-950/30 border border-amber-700/30 p-6">
          <h2 className="text-xl font-semibold text-amber-200 mb-4">
            ⚠️ Юридический факт-блок: лицензирование и штрафы
          </h2>
          <div className="text-sm text-stone-300 space-y-3 leading-relaxed">
            <p>
              Работы с асбестосодержащими материалами в РК подлежат <span className="text-amber-300">обязательному лицензированию</span>:
            </p>
            <ul className="list-disc list-inside space-y-1 text-stone-300">
              <li>
                лицензия Министерства экологии РК (МЭ РК) на обращение с опасными отходами
                III–IV класса;
              </li>
              <li>
                допуск Саморегулируемой организации (СРО) на демонтажные работы повышенной
                опасности;
              </li>
              <li>
                санитарно-эпидемиологическое заключение ДСЭК на каждый объект;
              </li>
              <li>
                квалификационные удостоверения рабочих по программе «Безопасное обращение с АСМ»
                (минимум 40 ак. часов).
              </li>
            </ul>
            <p className="text-stone-300">
              Производство работ <span className="text-rose-300">без лицензии и/или согласования</span> →
              административный штраф по КоАП РК ст. 425:
              <span className="text-amber-300 font-semibold"> 500 МРП</span> (≈ 1,97 млн тг
              в 2026 г.) для юр. лиц + <span className="text-amber-300">остановка строительства</span> до
              устранения нарушения. При выявлении вреда здоровью рабочих — уголовная
              ответственность по ст. 277 УК РК.
            </p>
            <p className="text-stone-400 italic">
              Совет сметчику: всегда выделяй в смете отдельной строкой стоимость лицензионного
              сопровождения (130–200 тыс. тг на проект) — заказчику дешевле заплатить заранее,
              чем 500 МРП штрафа и простой техники.
            </p>
          </div>
        </section>

        <footer className="border-t border-stone-800/60 pt-6 text-xs text-stone-500 text-center">
          Модуль AEVION Smeta Trainer · drawings-practice / asbestos-removal · 2026
        </footer>
      </main>
    </div>
  );
}
