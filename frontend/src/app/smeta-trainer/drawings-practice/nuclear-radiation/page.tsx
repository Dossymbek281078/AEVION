"use client";
import Link from "next/link";
import { useState } from "react";

export default function NuclearRadiationPage() {
  const [ex1, setEx1] = useState<string | null>(null);
  const [ex2, setEx2] = useState<string | null>(null);
  const [ex3Input, setEx3Input] = useState<string>("");
  const [ex3Checked, setEx3Checked] = useState<boolean>(false);
  const [ex4, setEx4] = useState<string | null>(null);

  const ex1Correct = ex1 === "c";
  const ex2Correct = ex2 === "b";
  const ex3Value = parseFloat(ex3Input.replace(",", "."));
  const ex3Correct = !isNaN(ex3Value) && Math.abs(ex3Value - 144) <= 15;
  const ex4Correct = ex4 === "d";

  const optionClass = (selected: string | null, value: string, correct: string) => {
    if (selected === null) return "border-slate-700 bg-slate-900/40 hover:bg-slate-800/60";
    if (value === correct) return "border-emerald-500 bg-emerald-900/30 text-emerald-100";
    if (selected === value && value !== correct) return "border-rose-500 bg-rose-900/30 text-rose-100";
    return "border-slate-800 bg-slate-900/30 text-slate-400";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300 hover:text-blue-200 transition">← К разделам</Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Атомные и радиационные объекты</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">☢️ Атомные и радиационные объекты</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Объекты с источниками ионизирующего излучения — от исследовательских реакторов и будущей АЭС
            Балхаш-Үлкен до онкологических центров с линейными ускорителями и промышленных дефектоскопических
            установок. Сметы здесь — это особая дисциплина: тяжёлый бетон с баритом, свинцовая защита,
            гермозоны, лабиринты 90°, HEPA H14 и угольные фильтры под радиоактивный йод, а также строгие
            требования НРБ-99 РК, ОСПОРБ-99 РК и МАГАТЭ. Модуль #178 учит сметчика читать спецификации
            биозащиты, считать объёмы тяжелого бетона, понимать лицензионные процедуры КАЭН и
            ориентироваться в бенчмарках от БН-350 в Актау до Института ядерной физики в Алатау.
          </p>
        </section>

        {/* Section 1: Категории объектов */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">1. Категории объектов с источниками ИИИ</h2>
          <p className="text-slate-400 text-sm">Радиационные объекты в РК делятся на четыре класса по активности и потенциальной опасности.</p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-amber-700/50 bg-amber-950/20 p-5">
              <h3 className="font-semibold text-amber-200">Энергетические реакторы (АЭС)</h3>
              <p className="text-sm text-slate-300 mt-2">
                В РК пока нет действующих АЭС, но строительство АЭС Балхаш-Үлкен запланировано с ВВЭР-1200
                Росатом (2 блока, ~$10-15 млрд). Был БН-350 в Актау (выведен из эксплуатации в 1999, на стадии демонтажа).
              </p>
            </div>
            <div className="rounded-xl border border-purple-700/50 bg-purple-950/20 p-5">
              <h3 className="font-semibold text-purple-200">Исследовательские реакторы</h3>
              <p className="text-sm text-slate-300 mt-2">
                ВВР-К в посёлке Алатау (Институт ядерной физики НЯЦ РК) — водо-водяной реактор 6 МВт.
                ИВГ.1М и ИГР в Курчатове. Используются для производства изотопов и нейтронографии.
              </p>
            </div>
            <div className="rounded-xl border border-rose-700/50 bg-rose-950/20 p-5">
              <h3 className="font-semibold text-rose-200">Медицинские объекты</h3>
              <p className="text-sm text-slate-300 mt-2">
                Онкоцентры с LINAC (линейные ускорители Varian/Elekta 6-18 МэВ), гамма-ножи Leksell,
                кабинеты лучевой терапии Co-60, ПЭТ-КТ диагностика, радионуклидная терапия (I-131).
              </p>
            </div>
            <div className="rounded-xl border border-emerald-700/50 bg-emerald-950/20 p-5">
              <h3 className="font-semibold text-emerald-200">Промышленные источники</h3>
              <p className="text-sm text-slate-300 mt-2">
                γ-дефектоскопия (Ir-192, Se-75 для сварных швов нефтегазовых трубопроводов),
                плотномеры, уровнемеры, рентгенофлуоресцентные анализаторы, каротаж в скважинах.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: Биозащита */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">2. Биологическая защита: материалы и толщины</h2>
          <p className="text-slate-400 text-sm">Защита от ионизирующего излучения — основа стоимости любого радиационного объекта. Считается по половинному слою (HVL) и по 10-кратному ослаблению (TVL).</p>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/60 text-slate-300">
                <tr>
                  <th className="text-left px-4 py-3">Материал</th>
                  <th className="text-left px-4 py-3">Плотность</th>
                  <th className="text-left px-4 py-3">Толщина</th>
                  <th className="text-left px-4 py-3">Применение</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-100">Обычный железобетон</td>
                  <td className="px-4 py-3">2400 кг/м³</td>
                  <td className="px-4 py-3">800-1200 мм</td>
                  <td className="px-4 py-3">Гермозона реакторов, контейнмент АЭС</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-100">Тяжёлый бетон (барит)</td>
                  <td className="px-4 py-3">3400-3700 кг/м³</td>
                  <td className="px-4 py-3">600-900 мм</td>
                  <td className="px-4 py-3">Бункеры LINAC, лабиринты, биощиты</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-100">Сверхтяжёлый (магнетит)</td>
                  <td className="px-4 py-3">4000-4800 кг/м³</td>
                  <td className="px-4 py-3">400-600 мм</td>
                  <td className="px-4 py-3">Защита горячих камер, ядерной медицины</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-100">Свинец (Pb)</td>
                  <td className="px-4 py-3">11340 кг/м³</td>
                  <td className="px-4 py-3">50-200 мм</td>
                  <td className="px-4 py-3">Процедурные Co-60, рентгенкабинеты</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-100">Стальные плиты</td>
                  <td className="px-4 py-3">7850 кг/м³</td>
                  <td className="px-4 py-3">100-300 мм</td>
                  <td className="px-4 py-3">Двери процедурных, локальные экраны</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-100">Боросодержащий полиэтилен</td>
                  <td className="px-4 py-3">950-1050 кг/м³</td>
                  <td className="px-4 py-3">100-300 мм</td>
                  <td className="px-4 py-3">Защита от нейтронов</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Стандарты РК */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">3. Нормативная база Республики Казахстан</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
              <h3 className="font-semibold text-blue-300">НРБ-99 РК</h3>
              <p className="text-sm text-slate-300 mt-2">
                Нормы радиационной безопасности. Категория А (персонал) — 20 мЗв/год средняя за 5 лет (max 50 мЗв за год).
                Категория Б (персонал смежных профессий) — 5 мЗв/год. Население — 1 мЗв/год эффективная доза.
              </p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
              <h3 className="font-semibold text-blue-300">ОСПОРБ-99 РК</h3>
              <p className="text-sm text-slate-300 mt-2">
                Основные санитарные правила обеспечения радиационной безопасности. Регулирует проектирование
                помещений, зонирование (свободный/контролируемый доступ), сан-пропускники.
              </p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
              <h3 className="font-semibold text-blue-300">СН РК 2.04-29-2005</h3>
              <p className="text-sm text-slate-300 mt-2">
                Защита от ионизирующих излучений при проектировании зданий и сооружений.
                Расчёт толщин биозащиты, требования к материалам и конструкциям.
              </p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
              <h3 className="font-semibold text-blue-300">ЗРК «О радиационной безопасности населения»</h3>
              <p className="text-sm text-slate-300 mt-2">
                Закон №219-I от 23.04.1998. Устанавливает права граждан, обязанности эксплуатирующих
                организаций, систему лицензирования и государственного контроля.
              </p>
            </div>
            <div className="rounded-xl border border-amber-700/50 bg-amber-950/20 p-5 md:col-span-2">
              <h3 className="font-semibold text-amber-200">КАЭН — Комитет атомного и энергетического надзора и контроля МЭ РК</h3>
              <p className="text-sm text-slate-300 mt-2">
                Главный регулятор. Лицензии на: проектирование, строительство, эксплуатацию, обращение с РАО,
                транспортировку, физзащиту. Без лицензии КАЭН любые работы с ИИИ незаконны.
                Срок получения лицензии: 3-6 месяцев, иногда до 12 для категории 1.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4: МАГАТЭ */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">4. Международные стандарты МАГАТЭ (IAEA)</h2>
          <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-5 space-y-3">
            <p className="text-sm text-slate-300">
              МАГАТЭ публикует серию Safety Standards в трёх категориях:
            </p>
            <ul className="text-sm text-slate-300 space-y-2 list-disc list-inside ml-4">
              <li><span className="text-blue-300 font-medium">SF (Safety Fundamentals)</span> — фундаментальные принципы (10 принципов).</li>
              <li><span className="text-blue-300 font-medium">GSR / SSR (General/Specific Safety Requirements)</span> — обязательные требования (GSR Part 1-7, SSR-2, SSR-4 для топливного цикла).</li>
              <li><span className="text-blue-300 font-medium">GSG / SSG (Safety Guides)</span> — рекомендации по реализации (более 100 документов).</li>
            </ul>
            <p className="text-sm text-slate-300 mt-3">
              РК как член МАГАТЭ с 1994 года имплементирует эти стандарты через национальное законодательство.
              Дозовые пределы согласованы: персонал А — 20 мЗв/год, население — 1 мЗв/год.
            </p>
          </div>
        </section>

        {/* Section 5: Вентиляция */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">5. Спецвентиляция радиационных объектов</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-cyan-700/50 bg-cyan-950/20 p-5">
              <div className="text-xs text-cyan-300 uppercase tracking-wider">Каскад давлений</div>
              <h3 className="font-semibold text-cyan-100 mt-1">Отрицательное давление</h3>
              <p className="text-sm text-slate-300 mt-2">
                В горячих зонах −50 Па относительно соседних помещений, в санпропускнике −20 Па,
                «грязный коридор» −30 Па. Воздух всегда течёт от чистого к грязному.
              </p>
            </div>
            <div className="rounded-xl border border-cyan-700/50 bg-cyan-950/20 p-5">
              <div className="text-xs text-cyan-300 uppercase tracking-wider">Фильтрация выброса</div>
              <h3 className="font-semibold text-cyan-100 mt-1">HEPA H14 + угольные</h3>
              <p className="text-sm text-slate-300 mt-2">
                HEPA H14 — эффективность 99.995% по MPPS (частицы 0.1-0.3 мкм).
                Активированный уголь, импрегнированный KI, удерживает радиоактивный йод I-131.
              </p>
            </div>
            <div className="rounded-xl border border-cyan-700/50 bg-cyan-950/20 p-5">
              <div className="text-xs text-cyan-300 uppercase tracking-wider">Сметные сборники</div>
              <h3 className="font-semibold text-cyan-100 mt-1">ЭСН Сб.20 + спец</h3>
              <p className="text-sm text-slate-300 mt-2">
                Базовая вентиляция по Сб.20 (ОВ и КВ), но фильтр-боксы HEPA H14 — по
                индивидуальным сметам через спецсборники атомной отрасли (СБЦП АЭС).
              </p>
            </div>
          </div>
        </section>

        {/* Section 6: РАО */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">6. Обращение с РАО и дезактивация</h2>
          <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-5 space-y-3">
            <div className="grid md:grid-cols-3 gap-3">
              <div className="rounded-lg border border-rose-800 bg-rose-950/30 p-3">
                <div className="text-xs text-rose-300 uppercase">Категория 1</div>
                <div className="font-semibold text-rose-100">Высокоактивные</div>
                <div className="text-xs text-slate-400 mt-1">{`> 10^4 Бк/г, ОЯТ, остекловывание`}</div>
              </div>
              <div className="rounded-lg border border-amber-800 bg-amber-950/30 p-3">
                <div className="text-xs text-amber-300 uppercase">Категория 2</div>
                <div className="font-semibold text-amber-100">Среднеактивные</div>
                <div className="text-xs text-slate-400 mt-1">{`10^2 — 10^4 Бк/г, цементирование`}</div>
              </div>
              <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-3">
                <div className="text-xs text-emerald-300 uppercase">Категория 3</div>
                <div className="font-semibold text-emerald-100">Низкоактивные</div>
                <div className="text-xs text-slate-400 mt-1">{`< 10^2 Бк/г, ППЗРО приповерхностные`}</div>
              </div>
            </div>
            <p className="text-sm text-slate-300 mt-3">
              Объекты захоронения в РК: бывший Семипалатинский полигон (Курчатов, ПХРО НЯЦ),
              хранилища при ВВР-К Алатау, проектируемое национальное хранилище.
              Транспортные контейнеры — НЗО типов ТУК-19, ТУК-32, бетонные кубы для НАО.
            </p>
          </div>
        </section>

        {/* Section 7: Конструктив АЭС */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">7. Конструктив энергетического реактора (ВВЭР-1200)</h2>
          <div className="rounded-xl border border-purple-700/50 bg-purple-950/20 p-5 space-y-3">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold text-purple-200">Двойная защитная оболочка (контейнмент)</h3>
                <ul className="text-sm text-slate-300 mt-2 space-y-1 list-disc list-inside ml-2">
                  <li>Внутренняя — преднапряжённый ж/б 1.2 м с гермооблицовкой 6 мм стали.</li>
                  <li>Внешняя — обычный ж/б 1.5 м, защита от внешних воздействий (самолёт, взрыв).</li>
                  <li>Межоболочечное пространство с разрежением, контроль утечек.</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-purple-200">Фундамент и сейсмика</h3>
                <ul className="text-sm text-slate-300 mt-2 space-y-1 list-disc list-inside ml-2">
                  <li>Фундаментная плита 6-9 м толщиной (~10 000 м³ бетона на блок).</li>
                  <li>Расчёт на ПЗ (проектное землетрясение) и МРЗ (максимальное) — до 9 баллов МСК-64.</li>
                  <li>Демпферы, виброизоляция оборудования первого контура.</li>
                  <li>Для АЭС Балхаш-Үлкен — площадка с сейсмикой 7-8 баллов.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Section 8: LINAC */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">8. Бункеры линейных ускорителей (LINAC)</h2>
          <div className="rounded-xl border border-rose-700/50 bg-rose-950/20 p-5">
            <p className="text-sm text-slate-300">
              Линейные ускорители Varian TrueBeam, Elekta Versa HD (6-18 МэВ) — основа современной лучевой терапии.
              Бункер — самая дорогая часть онкоцентра, ~30-40% стоимости отделения.
            </p>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
                <h3 className="font-semibold text-rose-200">Стены и потолок</h3>
                <ul className="text-sm text-slate-300 mt-2 space-y-1 list-disc list-inside ml-2">
                  <li>Стены — тяжёлый бетон с баритом 3.0-3.5 м, ρ = 3600 кг/м³.</li>
                  <li>Первичная стена (primary barrier) — до 4 м (по направлению луча).</li>
                  <li>Потолок — 1.5-2 м тяжёлого бетона + расчёт на скайшайн.</li>
                  <li>Пол — 1.0-1.5 м (защита нижних этажей).</li>
                </ul>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
                <h3 className="font-semibold text-rose-200">Лабиринт 90°</h3>
                <ul className="text-sm text-slate-300 mt-2 space-y-1 list-disc list-inside ml-2">
                  <li>Изогнутый коридор-вход с одним-двумя поворотами 90°.</li>
                  <li>Поглощает рассеянное гамма-излучение без массивной свинцовой двери.</li>
                  <li>Каждое отражение от стены снижает дозу в 10-50 раз.</li>
                  <li>Длина лабиринта 6-10 м, ширина 1.5-2 м для каталки и техники.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Section 9: Бенчмарки РК */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">9. Бенчмарки и эталонные объекты РК</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/60 text-slate-300">
                <tr>
                  <th className="text-left px-4 py-3">Объект</th>
                  <th className="text-left px-4 py-3">Город</th>
                  <th className="text-left px-4 py-3">Стоимость / параметры</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                <tr>
                  <td className="px-4 py-3 font-medium">АЭС Балхаш-Үлкен (план)</td>
                  <td className="px-4 py-3">с. Үлкен, Алматинская обл.</td>
                  <td className="px-4 py-3">ВВЭР-1200, 2 блока × 1200 МВт, ~$10-15 млрд, ввод 2035-2036</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">БН-350 (выведен)</td>
                  <td className="px-4 py-3">Актау (Шевченко)</td>
                  <td className="px-4 py-3">На быстрых нейтронах, 1973-1999, демонтаж до 2050</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">ВВР-К Институт ядерной физики</td>
                  <td className="px-4 py-3">пос. Алатау, Алматы</td>
                  <td className="px-4 py-3">Исследовательский 6 МВт, работает с 1967</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">НЯЦ РК ИАЭ (ИВГ.1М, ИГР)</td>
                  <td className="px-4 py-3">Курчатов</td>
                  <td className="px-4 py-3">Импульсные исследовательские, бывший Семипалатинский полигон</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">Онкоцентр КазНИИОиР</td>
                  <td className="px-4 py-3">Алматы</td>
                  <td className="px-4 py-3">~5-8 млрд тг с 2-3 LINAC, бункеры, ПЭТ-КТ</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">Многопроф. онкоцентр</td>
                  <td className="px-4 py-3">Астана</td>
                  <td className="px-4 py-3">~8-12 млрд тг, 4 LINAC, гамма-нож, циклотрон ПЭТ</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Exercises */}
        <section className="space-y-6 pt-4 border-t border-slate-800">
          <h2 className="text-2xl font-semibold text-slate-100">Практика: 4 упражнения</h2>

          {/* Exercise 1 */}
          <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-6 space-y-4">
            <div className="text-xs text-slate-500 uppercase tracking-wider">Упражнение 1 · Свинцовая защита</div>
            <h3 className="text-lg font-semibold text-slate-100">
              Какая характерная толщина свинцовой защиты в стене процедурной с гамма-источником Co-60?
            </h3>
            <div className="grid md:grid-cols-2 gap-3">
              {[
                { k: "a", t: "5-10 мм" },
                { k: "b", t: "20-30 мм" },
                { k: "c", t: "50-200 мм" },
                { k: "d", t: "500-1000 мм" },
              ].map((opt) => (
                <button
                  key={opt.k}
                  onClick={() => setEx1(opt.k)}
                  disabled={ex1 !== null}
                  className={`text-left px-4 py-3 rounded-lg border transition ${optionClass(ex1, opt.k, "c")} disabled:cursor-not-allowed`}
                >
                  <span className="font-mono text-xs text-slate-400 mr-2">{opt.k})</span>
                  {opt.t}
                </button>
              ))}
            </div>
            {ex1 !== null && (
              <div className={`text-sm rounded-lg p-3 ${ex1Correct ? "bg-emerald-950/40 text-emerald-200 border border-emerald-800" : "bg-rose-950/40 text-rose-200 border border-rose-800"}`}>
                {ex1Correct ? "✓ Верно." : "✗ Неверно. Правильный ответ — c."}{" "}
                Co-60 имеет фотоны 1.17 и 1.33 МэВ — это жёсткое гамма-излучение.
                Слой половинного ослабления свинца для Co-60 около 12 мм, для практической защиты
                процедурной (ослабление в 1000-10000 раз) требуется 50-200 мм Pb.
              </div>
            )}
          </div>

          {/* Exercise 2 */}
          <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-6 space-y-4">
            <div className="text-xs text-slate-500 uppercase tracking-wider">Упражнение 2 · Лицензирование</div>
            <h3 className="text-lg font-semibold text-slate-100">
              Какой государственный орган РК выдаёт лицензию на строительство объекта с источником ионизирующего излучения?
            </h3>
            <div className="grid md:grid-cols-2 gap-3">
              {[
                { k: "a", t: "МЧС — Министерство по чрезвычайным ситуациям" },
                { k: "b", t: "КАЭН — Комитет атомного и энергетического надзора" },
                { k: "c", t: "МИИР — Министерство индустрии и инфраструктурного развития" },
                { k: "d", t: "МЗ — Министерство здравоохранения" },
              ].map((opt) => (
                <button
                  key={opt.k}
                  onClick={() => setEx2(opt.k)}
                  disabled={ex2 !== null}
                  className={`text-left px-4 py-3 rounded-lg border transition ${optionClass(ex2, opt.k, "b")} disabled:cursor-not-allowed`}
                >
                  <span className="font-mono text-xs text-slate-400 mr-2">{opt.k})</span>
                  {opt.t}
                </button>
              ))}
            </div>
            {ex2 !== null && (
              <div className={`text-sm rounded-lg p-3 ${ex2Correct ? "bg-emerald-950/40 text-emerald-200 border border-emerald-800" : "bg-rose-950/40 text-rose-200 border border-rose-800"}`}>
                {ex2Correct ? "✓ Верно." : "✗ Неверно. Правильный ответ — b."}{" "}
                Комитет атомного и энергетического надзора и контроля при Министерстве энергетики РК
                (КАЭН МЭ РК) — единственный регулятор, выдающий лицензии на все виды деятельности с ИИИ:
                проектирование, строительство, эксплуатация, обращение с РАО.
              </div>
            )}
          </div>

          {/* Exercise 3 */}
          <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-6 space-y-4">
            <div className="text-xs text-slate-500 uppercase tracking-wider">Упражнение 3 · Объём бетона бункера LINAC</div>
            <h3 className="text-lg font-semibold text-slate-100">
              Бункер LINAC. Упрощённая задача: периметр стен 24 м, толщина стен 3 м, высота 2 м.
              Какой объём тяжёлого бетона требуется на стены (без учёта пола и потолка)?
            </h3>
            <p className="text-sm text-slate-400">Введите число в м³. Допуск ±15 м³.</p>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={ex3Input}
                onChange={(e) => setEx3Input(e.target.value)}
                disabled={ex3Checked}
                placeholder="м³"
                className="px-4 py-3 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500 w-48"
              />
              <button
                onClick={() => setEx3Checked(true)}
                disabled={ex3Checked || ex3Input.trim() === ""}
                className="px-5 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition disabled:bg-slate-800 disabled:text-slate-500"
              >
                Проверить
              </button>
              {ex3Checked && (
                <button
                  onClick={() => { setEx3Checked(false); setEx3Input(""); }}
                  className="px-4 py-3 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition"
                >
                  Сбросить
                </button>
              )}
            </div>
            {ex3Checked && (
              <div className={`text-sm rounded-lg p-3 ${ex3Correct ? "bg-emerald-950/40 text-emerald-200 border border-emerald-800" : "bg-rose-950/40 text-rose-200 border border-rose-800"}`}>
                {ex3Correct ? "✓ Верно." : `✗ Близко, но не точно. Эталон ≈ 144 м³ (±15).`}{" "}
                Расчёт: V = периметр × толщина × высота = 24 × 3 × 2 = 144 м³.
                При ρ = 3600 кг/м³ масса бетона ≈ 518 тонн. Это только стены — добавьте пол (≈ 50-80 м³) и потолок (≈ 60-100 м³).
              </div>
            )}
          </div>

          {/* Exercise 4 */}
          <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-6 space-y-4">
            <div className="text-xs text-slate-500 uppercase tracking-wider">Упражнение 4 · Лабиринт 90°</div>
            <h3 className="text-lg font-semibold text-slate-100">
              Что такое «лабиринт 90°» в бункере LINAC?
            </h3>
            <div className="grid gap-3">
              {[
                { k: "a", t: "Декоративный архитектурный элемент входной зоны" },
                { k: "b", t: "Технологический коридор для обслуживания оборудования" },
                { k: "c", t: "Пожарный эвакуационный выход с поворотом" },
                { k: "d", t: "Защита от рассеянного излучения — изогнутый вход не даёт γ-квантам прямого выхода наружу" },
              ].map((opt) => (
                <button
                  key={opt.k}
                  onClick={() => setEx4(opt.k)}
                  disabled={ex4 !== null}
                  className={`text-left px-4 py-3 rounded-lg border transition ${optionClass(ex4, opt.k, "d")} disabled:cursor-not-allowed`}
                >
                  <span className="font-mono text-xs text-slate-400 mr-2">{opt.k})</span>
                  {opt.t}
                </button>
              ))}
            </div>
            {ex4 !== null && (
              <div className={`text-sm rounded-lg p-3 ${ex4Correct ? "bg-emerald-950/40 text-emerald-200 border border-emerald-800" : "bg-rose-950/40 text-rose-200 border border-rose-800"}`}>
                {ex4Correct ? "✓ Верно." : "✗ Неверно. Правильный ответ — d."}{" "}
                Лабиринт — это изогнутый вход с одним или двумя поворотами на 90°. Прямое
                гамма-излучение распространяется по прямой и блокируется стеной за первым поворотом.
                Только рассеянное излучение достигает выхода, причём каждое отражение от
                стен ослабляет дозу в 10-50 раз. Это позволяет обойтись лёгкой раздвижной дверью
                вместо массивной свинцовой плиты.
              </div>
            )}
          </div>
        </section>

        <footer className="pt-6 border-t border-slate-800 text-xs text-slate-500 flex items-center justify-between">
          <span>AEVION Smeta Trainer · Модуль #178 · Атомные и радиационные объекты</span>
          <Link href="/smeta-trainer/drawings-practice" className="text-blue-300 hover:text-blue-200 transition">← Назад к разделам</Link>
        </footer>
      </main>
    </div>
  );
}
