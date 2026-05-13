"use client";

import Link from "next/link";
import { useState } from "react";

export default function ReconstructionVsModernizationPage() {
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

  const checkEx1 = () => setEx1Res(ex1 === "c" ? "ok" : "bad");
  const checkEx2 = () => setEx2Res(ex2 === "b" ? "ok" : "bad");
  const checkEx3 = () => {
    // 800 м² × 250 тыс. × 1.15 (Кр реконструкции) × 1.10 (Кз стесн. условия) = 253 млн тг
    // База: 800 × 250 000 = 200 млн
    // С коэф: 200 × 1.15 × 1.10 = 253 млн
    const v = parseFloat(ex3);
    if (!isFinite(v)) return setEx3Res("bad");
    setEx3Res(Math.abs(v - 253) <= 5 ? "ok" : "bad");
  };
  const checkEx4 = () => setEx4Res(ex4 === "d" ? "ok" : "bad");

  const comparison = [
    {
      aspect: "Цель",
      kapremont: "Восстановление исходных параметров",
      reconst: "Изменение основных параметров (этажность, площадь, назначение)",
      modern: "Замена морально устаревших систем на современные",
    },
    {
      aspect: "Несущие конструкции",
      kapremont: "До 50% замены допустимо",
      reconst: "Более 50% или добавление новых",
      modern: "Обычно не затрагиваются",
    },
    {
      aspect: "Изменение объёма",
      kapremont: "НЕТ — объём остаётся",
      reconst: "ДА — пристройка, надстройка, мансарда",
      modern: "Внутри существующего объёма",
    },
    {
      aspect: "Изменение назначения",
      kapremont: "НЕТ — то же назначение",
      reconst: "Возможно (склад → офис)",
      modern: "Нет — то же назначение, новые системы",
    },
    {
      aspect: "Норматив РК",
      kapremont: "СН РК 3.02-01 раздел 4",
      reconst: "СН РК 3.02-01 раздел 5 + СНиП 1.04-25 (памятники)",
      modern: "СН РК 3.02-01 раздел 6 + спец. нормативы",
    },
    {
      aspect: "Коэф. МДС-81-35",
      kapremont: "Без надбавки",
      reconst: "К=1.15 (на стеснённость), К=1.25 (если в зоне эксплуатации)",
      modern: "К=1.05-1.10 (умеренная надбавка)",
    },
    {
      aspect: "Разрешит. документ",
      kapremont: "Разрешение МИО",
      reconst: "Полное разрешение + новый АГПЗ (архит.-градостр. план)",
      modern: "Согласование в МИО + проект",
    },
    {
      aspect: "Экспертиза",
      kapremont: "Часто",
      reconst: "Всегда",
      modern: "При сложных объектах",
    },
    {
      aspect: "Срок гарантии",
      kapremont: "2-5 лет",
      reconst: "2-10 лет (как новое стр-во)",
      modern: "2-5 лет (на новое оборудование)",
    },
    {
      aspect: "Налог. учёт",
      kapremont: "Капитализация",
      reconst: "Капитализация (новое ОС или большая модернизация)",
      modern: "Капитализация",
    },
  ];

  const reconst_types = [
    { type: "Пристройка к существующему зданию", what: "Добавление нового объёма сбоку или сзади (например, расширение школы)", example: "Школа № 47 — пристройка нового учебного корпуса (наш сквозной кейс)" },
    { type: "Надстройка этажа", what: "Добавление одного или нескольких этажей сверху", example: "Реконструкция жилых хрущёвок Алматы с добавлением мансардного этажа" },
    { type: "Подземные этажи / Цокольная пристройка", what: "Углубление существующего фундамента + новые подземные этажи", example: "Реконструкция ЦУМа Алматы — новый подземный паркинг" },
    { type: "Перепланировка с изменением конфигурации", what: "Снос всех ненесущих стен + новая планировка", example: "Лофт-конверсия завода в Loft Almaty (см. модуль adaptive-reuse)" },
    { type: "Изменение функционального назначения", what: "Склад → ТЦ, кинотеатр → ЖК (требует смены категории)", example: "К/т «Целинный» → культурный кластер (см. adaptive-reuse)" },
    { type: "Сейсмоусиление + расширение", what: "Усиление несущих + увеличение нагрузок на этажи", example: "Реконструкция советских школ и больниц в Алматы под 9 баллов" },
  ];

  const modern_types = [
    { type: "Замена систем отопления", what: "Старая чугунная → биметаллические радиаторы + ИТП + погодное регулирование", cost: "15-30 тыс. тг/м² отапл. площади" },
    { type: "Замена электрики на современную", what: "Алюминиевые → медные кабели, новые щитовые, УЗО, smart-home готовность", cost: "8-20 тыс. тг/м²" },
    { type: "Установка системы вентиляции с рекуперацией", what: "Принудительная приточно-вытяжная вместо естественной", cost: "5-15 тыс. тг/м²" },
    { type: "Замена лифтов", what: "Старые на новые с частотным регулированием, smart-управлением", cost: "12-25 млн тг/лифт" },
    { type: "Подключение интернет/слаботочки", what: "Оптоволокно во все квартиры, СКС, IP-видеонаблюдение", cost: "3-8 тыс. тг/м²" },
    { type: "Утепление наружное", what: "СФТК (мокрый фасад) или НВФ — повышение энергоэффективности", cost: "12-25 тыс. тг/м² фасада" },
    { type: "Smart-системы (умный дом)", what: "Datчики, KNX, smart-счётчики, удалённое управление", cost: "10-30 тыс. тг/м²" },
    { type: "Замена окон на энергоэффективные", what: "Старые → тройные стеклопакеты, профиль 70-86 мм", cost: "120-250 тыс. тг/окно" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Реконст. vs Модерн.</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🔄 Реконструкция vs Модернизация
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            <strong className="text-purple-300">Реконструкция, модернизация и капремонт</strong>
            — три разных вида работ с разными правовыми, проектными и сметными последствиями.
            Реконструкция — это изменение основных параметров (этажность, объём, назначение).
            Модернизация — замена систем на современные без изменения параметров. Капремонт —
            восстановление до исходных параметров. От правильной классификации зависят:
            необходимость экспертизы, разрешения, объём ПД, налоговый учёт, коэффициенты
            МДС-81-35.
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Главный критерий</div>
              <div className="text-slate-300">Изменение объёма/назначения = реконст.</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Коэф. МДС реконст.</div>
              <div className="text-slate-300">К=1.15 (стеснённость) до 1.25 (с эксплуат.)</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Коэф. МДС модерн.</div>
              <div className="text-slate-300">К=1.05-1.10 (умеренная надбавка)</div>
            </div>
          </div>
        </section>

        {/* Section 1: Сравнение */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🆚 Section 1. Сравнение трёх видов работ
          </h2>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-40">Параметр</th>
                  <th className="text-left px-4 py-3">Капремонт</th>
                  <th className="text-left px-4 py-3">Реконструкция</th>
                  <th className="text-left px-4 py-3">Модернизация</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {comparison.map((c) => (
                  <tr key={c.aspect} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 text-slate-100 text-xs font-medium">{c.aspect}</td>
                    <td className="px-4 py-3 text-amber-300 text-xs">{c.kapremont}</td>
                    <td className="px-4 py-3 text-purple-300 text-xs">{c.reconst}</td>
                    <td className="px-4 py-3 text-cyan-300 text-xs">{c.modern}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2: Типы реконструкции */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🏗 Section 2. Шесть типов реконструкции
          </h2>
          <div className="space-y-3">
            {reconst_types.map((r) => (
              <div key={r.type} className="border border-purple-800/40 bg-purple-950/20 rounded-xl p-4">
                <h3 className="text-base font-semibold text-purple-300 mb-2">{r.type}</h3>
                <dl className="text-sm space-y-1">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Что делается</dt>
                    <dd className="text-slate-300 text-xs">{r.what}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Пример РК</dt>
                    <dd className="text-amber-300 text-xs italic">{r.example}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Типы модернизации */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🔧 Section 3. Восемь видов модернизации
          </h2>
          <div className="space-y-3">
            {modern_types.map((m) => (
              <div key={m.type} className="border border-cyan-800/40 bg-cyan-950/20 rounded-xl p-4">
                <div className="flex items-baseline justify-between gap-4 mb-2">
                  <h3 className="text-base font-semibold text-cyan-300">{m.type}</h3>
                  <span className="text-xs text-emerald-300 italic shrink-0 font-mono">{m.cost}</span>
                </div>
                <p className="text-sm text-slate-300">{m.what}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: Коэффициенты МДС */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📐 Section 4. Коэффициенты МДС-81-35 для реконструкции
          </h2>
          <div className="border border-purple-800/60 bg-purple-950/30 rounded-xl p-5 text-sm space-y-3">
            <p className="text-slate-300">
              <strong className="text-purple-300">МДС-81-35.2004</strong> — Методика
              определения стоимости работ, выполняемых в эксплуатируемых зданиях.
              Применяется при реконструкции и модернизации в РК.
            </p>
            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-3 py-2 w-44">Условия работ</th>
                    <th className="text-left px-3 py-2 w-32">Коэф. К_ОТ</th>
                    <th className="text-left px-3 py-2 w-32">Коэф. К_ЭМ</th>
                    <th className="text-left px-3 py-2">Примечание</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  <tr><td className="px-3 py-2 text-slate-200">Капитальный ремонт</td><td className="px-3 py-2 text-emerald-300">1.00</td><td className="px-3 py-2 text-emerald-300">1.00</td><td className="px-3 py-2 text-xs text-slate-400">Без надбавок</td></tr>
                  <tr><td className="px-3 py-2 text-slate-200">Реконструкция (общая)</td><td className="px-3 py-2 text-amber-300">1.15</td><td className="px-3 py-2 text-amber-300">1.25</td><td className="px-3 py-2 text-xs text-slate-400">Стесн. условия, сложность работ</td></tr>
                  <tr><td className="px-3 py-2 text-slate-200">Реконструкция в зоне эксплуатации</td><td className="px-3 py-2 text-rose-300">1.25</td><td className="px-3 py-2 text-rose-300">1.35</td><td className="px-3 py-2 text-xs text-slate-400">Здание работает, люди есть</td></tr>
                  <tr><td className="px-3 py-2 text-slate-200">Модернизация (без останова)</td><td className="px-3 py-2 text-amber-300">1.10</td><td className="px-3 py-2 text-amber-300">1.10</td><td className="px-3 py-2 text-xs text-slate-400">Только сетевые работы</td></tr>
                  <tr><td className="px-3 py-2 text-slate-200">Работы на действующем оборудовании</td><td className="px-3 py-2 text-rose-300">1.20</td><td className="px-3 py-2 text-rose-300">1.20</td><td className="px-3 py-2 text-xs text-slate-400">Промышл. объекты, нельзя остановить</td></tr>
                  <tr><td className="px-3 py-2 text-slate-200">Работы вблизи действ. линий передач</td><td className="px-3 py-2 text-rose-300">1.30</td><td className="px-3 py-2 text-rose-300">1.30</td><td className="px-3 py-2 text-xs text-slate-400">Опасные условия</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-400 italic">
              К_ОТ — коэффициент к оплате труда. К_ЭМ — к эксплуатации машин. Применяются
              к расценкам ЭСН РК и индексам стоимости.
            </p>
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Section 5. Упражнения</h2>

          {/* Упр.1 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Классификация работ
            </div>
            <div className="text-slate-200 mb-4">
              К существующей <strong>4-этажной школе</strong> пристраивают <strong>новый
              учебный корпус</strong> (3 этажа, 800 м²) с переходом. Это какой вид работ?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Текущий ремонт" },
                { v: "b", t: "Капитальный ремонт" },
                { v: "c", t: "Реконструкция (изменение основных параметров — объём, площадь, конфигурация). Применяются коэф. МДС 1.15-1.25, обязательная экспертиза, разрешение МИО и новый АГПЗ" },
                { v: "d", t: "Модернизация" },
              ].map((opt) => (
                <label key={opt.v} className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${ex1 === opt.v ? "border-purple-600 bg-purple-950/30" : "border-slate-800 hover:border-slate-700"}`}>
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-purple-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex1Sol ? "Скрыть решение" : "Показать решение"}</button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — реконструкция</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-purple-300">Решение:</strong> Это явная
                реконструкция по СН РК 3.02-01 раздел 5. Признаки:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Изменение объёма здания (добавление 800 м²)</li>
                  <li>Изменение конфигурации (от L-образной к T-образной)</li>
                  <li>Новые несущие конструкции (пристройка имеет свой каркас)</li>
                  <li>Возможно изменение этажности (если пристройка выше старой)</li>
                </ul>
                Следствия:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Обязательна ГосЭкспертиза (бюджетный соц. объект)</li>
                  <li>Новый АГПЗ от Архитектора района</li>
                  <li>Применение коэф. К_ОТ=1.25 К_ЭМ=1.35 (работы в зоне эксплуатации — школа работает!)</li>
                  <li>Учёт стеснённости (нельзя занимать школьный двор без согласования)</li>
                  <li>Учёт расписания школы (шумные работы — каникулы или после уроков)</li>
                </ul>
                Это сквозной кейс модуля case-school47 в нашем тренажёре!
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Модернизация vs Капремонт
            </div>
            <div className="text-slate-200 mb-4">
              В административном здании заменили <strong>всю систему отопления</strong>
              с чугунных радиаторов на биметаллические + установили ИТП с погодным
              регулированием + поквартирные счётчики. Это какой вид работ?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Текущий ремонт — обычная замена радиаторов" },
                { v: "b", t: "Модернизация — замена систем на современные (новый функционал — погодное регулирование, поквартирный учёт) без изменения объёма и назначения. К_МДС=1.05-1.10" },
                { v: "c", t: "Капитальный ремонт" },
                { v: "d", t: "Реконструкция" },
              ].map((opt) => (
                <label key={opt.v} className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${ex2 === opt.v ? "border-purple-600 bg-purple-950/30" : "border-slate-800 hover:border-slate-700"}`}>
                  <input type="radio" name="ex2" value={opt.v} checked={ex2 === opt.v} onChange={() => setEx2(opt.v)} className="accent-purple-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex2Sol ? "Скрыть решение" : "Показать решение"}</button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — модернизация</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-purple-300">Решение:</strong> Это модернизация
                по СН РК 3.02-01 раздел 6:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Замена на более современную технику (биметалл. вместо чугуна)</li>
                  <li>Добавление нового функционала (погодное регулирование, учёт)</li>
                  <li>Без изменения объёма здания</li>
                  <li>Без изменения назначения</li>
                </ul>
                Отличие от капремонта: при капремонте мы просто восстанавливаем
                (например, заменяем те же чугунные радиаторы на такие же чугунные).
                При модернизации — улучшаем (новое оборудование с новыми свойствами).
                <br /><br />
                Эффект модернизации:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Экономия тепла 15-25% (благодаря регулированию)</li>
                  <li>Срок службы биметалла 30+ лет (vs 50 лет чугуна — но новые)</li>
                  <li>Поквартирные счётчики — справедливая оплата</li>
                  <li>Удорожание +30-50% к простому капремонту</li>
                  <li>Окупаемость 5-8 лет за счёт экономии</li>
                </ul>
                В смете: К_ОТ=1.10 (работы без останова отопления — нельзя зимой!)
                К_ЭМ=1.10. На стоимость работ 10 млн тг — удорожание 1-2 млн тг.
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Расчёт стоимости реконструкции
            </div>
            <div className="text-slate-200 mb-4">
              Реконструкция офисного здания: <strong>800 м²</strong>, базовая стоимость
              работ <strong>250 тыс. тг/м²</strong>. Применяемые коэффициенты:
              <ul className="list-disc list-inside mt-2 text-sm space-y-1">
                <li>К_МДС реконструкции (стеснённость): <strong>1.15</strong></li>
                <li>К_зона эксплуатации (офис частично работает): <strong>1.10</strong></li>
              </ul>
              <p className="mt-2">Какая итоговая стоимость в МЛН тг?</p>
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Стоимость, млн тг</span>
              <input value={ex3} onChange={(e) => setEx3(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="253" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex3Sol ? "Скрыть решение" : "Показать решение"}</button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 253 млн тг</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-purple-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Стоимость_итог = S × Цена_база × К_МДС × К_зона
              = 800 × 250 000 × 1.15 × 1.10
              = 200 000 000 × 1.265
              = 253 000 000 тг = 253 млн тг

Сравнение с новым строительством:
• Новое стр-во офисного 800 м²: 800 × 300 000 = 240 млн тг
• Реконструкция: 253 млн тг

ВЫВОД: реконструкция получилась ДОРОЖЕ нового стр-ва на 13 млн тг!

Это типичная ситуация: реконструкция эффективна, когда:
1. Здание имеет архитектурную/историческую ценность
2. Расположение уникальное (центр города, нельзя строить новое)
3. Сохраняются основные конструкции (есть «бесплатная» база)
4. Памятник архитектуры (по закону нельзя сносить)

Если ни одно из условий — лучше снести и построить новое.
В РК часто реконструируют старые здания именно по причинам
№2 (центральные локации Алматы, Астаны).

Структура стоимости 253 млн тг:
• Демонтаж старого: 5% = 12.7 млн тг
• Усиление фундамента: 8% = 20.2 млн тг
• Перестройка несущих: 25% = 63.3 млн тг
• Новые инж. сети: 20% = 50.6 млн тг
• Отделка: 22% = 55.7 млн тг
• Лифты и системы безопасности: 8% = 20.2 млн тг
• Прочие, авт. надзор: 12% = 30.3 млн тг`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Капремонт vs Реконструкция
            </div>
            <div className="text-slate-200 mb-4">
              ТОО владеет складом 1500 м², который хочет переоборудовать в офис класса B.
              Требуется: смена назначения, полное обновление инж. систем, перепланировка
              с удалением 80% внутренних стен, замена оконных проёмов на более крупные.
              Здание получит лифты (раньше не было). Это какой вид работ <strong>и почему
              классификация важна</strong>?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Капремонт — классификация не важна" },
                { v: "b", t: "Текущий ремонт — оставить как есть" },
                { v: "c", t: "Модернизация — обновление систем" },
                { v: "d", t: "Реконструкция (смена назначения + значительные изменения конструкций) — критично важно правильно классифицировать, потому что: 1) Нужен новый АГПЗ и разрешение на стр-во, 2) Обязательна ГосЭкспертиза, 3) Применяются коэф. МДС 1.15-1.25, 4) Налоговый учёт — капитализация на новое ОС (не амортизация старого), 5) Гарантия как у нового стр-ва" },
              ].map((opt) => (
                <label key={opt.v} className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${ex4 === opt.v ? "border-purple-600 bg-purple-950/30" : "border-slate-800 hover:border-slate-700"}`}>
                  <input type="radio" name="ex4" value={opt.v} checked={ex4 === opt.v} onChange={() => setEx4(opt.v)} className="accent-purple-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex4Sol ? "Скрыть решение" : "Показать решение"}</button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — реконструкция</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-purple-300">Решение:</strong> Реконструкция —
                единственный правильный вариант. Признаки:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Смена функционального назначения (склад → офис)</li>
                  <li>Значительные изменения несущих (80% внутренних стен)</li>
                  <li>Изменение фасадных проёмов</li>
                  <li>Добавление новых конструкций (лифты с шахтой)</li>
                </ul>
                <strong>Почему правильная классификация критична:</strong>
                <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
                  <li><strong>Юридически</strong> — без разрешения на реконструкцию
                  работы будут признаны самовольными (ст. 244 ГК РК), штрафы до 1000 МРП
                  + риск сноса</li>
                  <li><strong>Налогово</strong> — нужно капитализировать (см. модуль
                  capital-vs-current-repair). Бухгалтер не сможет списать в расходы
                  периода 200+ млн тг</li>
                  <li><strong>Финансово</strong> — банк не даст кредит без правильно
                  оформленного проекта реконструкции (нужна ГосЭкспертиза для
                  привлечения)</li>
                  <li><strong>Технически</strong> — без сейсморасчёта новых нагрузок
                  здание может разрушиться при изменении схемы</li>
                  <li><strong>Сметно</strong> — без коэф. МДС подрядчик заложит обычные
                  расценки. На объёме 200 млн тг подрядчик «потеряет» 30+ млн тг и
                  откажется работать или потребует доп. соглашение</li>
                </ol>
                Поэтому первое, что должен сделать сметчик при изменении назначения —
                согласовать с архитектором и юристом КЛАССИФИКАЦИЮ работ. От этого
                зависит ВСЁ остальное.
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          СН РК 3.02-01 (Эксплуатация и ремонт). МДС-81-35.2004 (Методика стоимости
          в эксплуатируемых зданиях). ПП РК № 1162 (О капремонте). ПП РК «О порядке
          реконструкции». Налоговый кодекс РК ст. 90, 100, 122. ГК РК ст. 244
          (Самовольная постройка), ст. 723 (Гарантия работ).
        </div>
      </main>
    </div>
  );
}
