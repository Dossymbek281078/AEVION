"use client";
import Link from "next/link";
import { useState } from "react";

export default function PowerPlantsPage() {
  const [a1, setA1] = useState<string | null>(null);
  const [a2, setA2] = useState<string | null>(null);
  const [a3, setA3] = useState<string>("");
  const [a4, setA4] = useState<string | null>(null);

  const correct1 = "c";
  const correct2 = "b";
  const correct3 = 33_000_000_000;
  const tol3 = 3_000_000_000;
  const correct4 = "d";

  const num3 = parseFloat(a3.replace(/\s+/g, "").replace(",", "."));
  const ok3 = !Number.isNaN(num3) && Math.abs(num3 - correct3) <= tol3;

  const optClass = (sel: string | null, val: string, correct: string) => {
    if (sel === null) return "border-slate-700 hover:border-blue-500 hover:bg-slate-800/60";
    if (val === correct) return "border-emerald-500 bg-emerald-500/10";
    if (sel === val) return "border-rose-500 bg-rose-500/10";
    return "border-slate-700 opacity-60";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300 hover:text-blue-200 transition">← К разделам</Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Электростанции</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">⚡ Электростанции (ТЭЦ, ГРЭС, ГЭС, ВЭС, СЭС)</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль для сметчиков объектов большой энергетики РК: угольные ТЭС/ГРЭС Экибастузского
            бассейна, парогазовые ТЭЦ, каскад ГЭС на Иртыше и Или, ветропарки и солнечные станции.
            Учимся читать схемы главных корпусов, ОРУ, систем охлаждения и считать стоимость по
            бенчмаркам генерации (тг/МВт установленной мощности).
          </p>
        </section>

        {/* Section 1: Типы ЭС РК */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h2 className="text-2xl font-semibold text-amber-300">1. Типы электростанций в РК</h2>
          <div className="mt-4 grid md:grid-cols-2 gap-4 text-sm text-slate-300">
            <div className="bg-slate-950/60 rounded-lg border border-slate-800 p-4">
              <div className="font-semibold text-amber-200">ТЭЦ (теплоэлектроцентрали)</div>
              <p className="mt-1 text-slate-400">Комбинированная выработка электроэнергии и тепла
                (горячая вода + пар на промышленность). КИТ до 80-85%. ТЭЦ-1/2/3 Алматы, ТЭЦ Астаны.</p>
            </div>
            <div className="bg-slate-950/60 rounded-lg border border-slate-800 p-4">
              <div className="font-semibold text-amber-200">ГРЭС/КЭС (конденсационные)</div>
              <p className="mt-1 text-slate-400">Крупные блоки 200-1200 МВт, только электроэнергия.
                Экибастузская ГРЭС-1 (8×500 МВт), ГРЭС-2 (2×500 МВт), Аксуская ЭС.</p>
            </div>
            <div className="bg-slate-950/60 rounded-lg border border-slate-800 p-4">
              <div className="font-semibold text-cyan-200">ТЭЦ с ПГУ (парогазовый цикл)</div>
              <p className="mt-1 text-slate-400">Газовая + паровая турбина, КПД 55-62%. Модернизация
                ТЭЦ-3 Астана, проектируемые ПГУ в Алматы, Кызылорде, Туркестане.</p>
            </div>
            <div className="bg-slate-950/60 rounded-lg border border-slate-800 p-4">
              <div className="font-semibold text-sky-200">ГЭС</div>
              <p className="mt-1 text-slate-400">Каскад Иртыша (Бухтарминская, Усть-Каменогорская,
                Шульбинская), Капшагайская, Мойнакская. Гибкий пиковый источник.</p>
            </div>
            <div className="bg-slate-950/60 rounded-lg border border-slate-800 p-4">
              <div className="font-semibold text-teal-200">ВЭС</div>
              <p className="mt-1 text-slate-400">Жанатас, Шокпар, Тарбагатай — по 100 МВт.
                Турбины 3.5-6 МВт, башни 120-150 м.</p>
            </div>
            <div className="bg-slate-950/60 rounded-lg border border-slate-800 p-4">
              <div className="font-semibold text-yellow-200">СЭС</div>
              <p className="mt-1 text-slate-400">Бурное 100 МВт, Хан Кызыл 100 МВт, Карагандыкент
                50 МВт. Фотогальваника + инверторы.</p>
            </div>
            <div className="bg-slate-950/60 rounded-lg border border-slate-800 p-4 md:col-span-2">
              <div className="font-semibold text-lime-200">БиоТЭС / когенерация на отходах</div>
              <p className="mt-1 text-slate-400">Пилотные проекты на лузге, биогазе со
                свалок и животноводческих комплексов. Малая распределённая генерация.</p>
            </div>
          </div>
        </section>

        {/* Section 2: ТЭС угольная */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h2 className="text-2xl font-semibold text-orange-300">2. Угольная ТЭС/ГРЭС — оборудование</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-300 list-disc list-inside">
            <li><b>Экибастузская ГРЭС-1</b> — 4000 МВт = 8 блоков × 500 МВт.</li>
            <li><b>Экибастузская ГРЭС-2</b> — 1000 МВт = 2 × 500 МВт (строятся блоки 3 и 4).</li>
            <li><b>Топливо</b> — уголь Экибастузского бассейна: зольность 38-42%, теплотворная
              способность 4200 ккал/кг, влажность 5-7%. Высокозольный — требует электрофильтров
              ОПФ и систем золоудаления.</li>
            <li><b>Котёл</b> — барабанный или прямоточный, паропроизводительность 1600-1650 т/ч,
              давление 25 МПа, температура острого пара 545 °C.</li>
            <li><b>Турбина</b> — ЛМЗ К-500-240 (конденсационная, 3000 об/мин).</li>
            <li><b>Генератор</b> — ТВВ-500-2У3 с водородным охлаждением, напряжение 20 кВ.</li>
            <li><b>КПД блока</b> — 32-40% (нетто, с учётом собственных нужд 8-10%).</li>
            <li><b>Дымовая труба</b> — H = 300-330 м (на ГРЭС-1 — 330 м, одна из самых высоких в мире).</li>
          </ul>
        </section>

        {/* Section 3: ПГУ */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h2 className="text-2xl font-semibold text-cyan-300">3. ПГУ — парогазовый цикл</h2>
          <p className="mt-3 text-slate-400 text-sm">
            Комбинированный цикл: газовая турбина → горячие выхлопные газы (~600 °C) → котёл-утилизатор
            → паровая турбина. Общий КПД <b>55-62%</b> против 35-40% у классической ТЭС.
          </p>
          <div className="mt-4 grid md:grid-cols-3 gap-4 text-sm text-slate-300">
            <div className="bg-slate-950/60 rounded-lg border border-slate-800 p-4">
              <div className="font-semibold text-cyan-200">Газовая турбина</div>
              <p className="mt-1 text-slate-400">Siemens SGT-800 (54 МВт), GE 7HA.02 (380 МВт),
                Mitsubishi M501J (470 МВт). Топливо: природный газ, иногда дизель резерв.</p>
            </div>
            <div className="bg-slate-950/60 rounded-lg border border-slate-800 p-4">
              <div className="font-semibold text-cyan-200">Котёл-утилизатор (HRSG)</div>
              <p className="mt-1 text-slate-400">Двух- или трёхконтурный, без сжигания топлива
                в нём (либо с дожиганием для пиков). Производит пар 2-3 давлений.</p>
            </div>
            <div className="bg-slate-950/60 rounded-lg border border-slate-800 p-4">
              <div className="font-semibold text-cyan-200">Паровая турбина</div>
              <p className="mt-1 text-slate-400">Конденсационная, ~1/3 мощности от газовой.
                Альстом/Сименс/Mitsubishi STG.</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-400">
            Примеры в РК: модернизация ТЭЦ-3 Астана (ПГУ ~250 МВт), проектируемые ПГУ Туркестан,
            Кызылорда, Алматы. Удельные капзатраты — 280-380 млн тг/МВт.
          </p>
        </section>

        {/* Section 4: ГЭС */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h2 className="text-2xl font-semibold text-sky-300">4. ГЭС Казахстана</h2>
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-sm">
              <thead className="text-slate-400 border-b border-slate-800">
                <tr><th className="text-left py-2">Станция</th><th className="text-right">Мощность, МВт</th><th className="text-left pl-4">Река</th><th className="text-left pl-4">Турбина</th></tr>
              </thead>
              <tbody className="text-slate-300">
                <tr className="border-b border-slate-800/50"><td className="py-2">Бухтарминская ГЭС</td><td className="text-right">675</td><td className="pl-4">Иртыш</td><td className="pl-4">Френсиса</td></tr>
                <tr className="border-b border-slate-800/50"><td className="py-2">Шульбинская ГЭС</td><td className="text-right">702</td><td className="pl-4">Иртыш</td><td className="pl-4">Френсиса</td></tr>
                <tr className="border-b border-slate-800/50"><td className="py-2">Усть-Каменогорская ГЭС</td><td className="text-right">331</td><td className="pl-4">Иртыш</td><td className="pl-4">Френсиса</td></tr>
                <tr className="border-b border-slate-800/50"><td className="py-2">Капшагайская ГЭС</td><td className="text-right">364</td><td className="pl-4">Или</td><td className="pl-4">Френсиса</td></tr>
                <tr><td className="py-2">Мойнакская ГЭС (2012)</td><td className="text-right">300</td><td className="pl-4">Чарын</td><td className="pl-4">Френсиса (высоконапорная)</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Генераторы — зонтичного типа, вертикальные, 12-32 полюса, 100-300 об/мин. На равнинных
            малонапорных реках применяются турбины Каплана; в РК преобладают Френсиса из-за средних
            напоров 40-180 м.
          </p>
        </section>

        {/* Section 5: ВЭС */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h2 className="text-2xl font-semibold text-teal-300">5. Ветроэнергетика (ВЭС)</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-300 list-disc list-inside">
            <li><b>Башня</b> — стальная или гибридная (бетон+сталь), высота ступицы 120-150 м.</li>
            <li><b>Турбина</b> — Vestas V162-6.2 МВт, Goldwind GW155-4.5 МВт, Siemens Gamesa SG 5.0-145, Nordex N163.</li>
            <li><b>Ротор</b> — диаметр 145-163 м, 3 лопасти из стеклопластика/углепластика.</li>
            <li><b>Гондола</b> — генератор (постоянных магнитов или DFIG), редуктор (или direct drive), система pitch+yaw.</li>
            <li><b>Фундамент</b> — гравитационный круглый ЖБ Ø18-22 м, заглубление 3.5 м, V≈600-900 м³ бетона B30 на 1 турбину.</li>
            <li><b>ВЭС РК</b> — Жанатас (Жамбылская обл.) 100 МВт, Шокпар 100 МВт, Тарбагатай 100 МВт, Ерейментау 45 МВт.</li>
            <li><b>Капзатраты</b> — 80-130 млрд тг на 100 МВт под ключ (без сетевых присоединений).</li>
          </ul>
        </section>

        {/* Section 6: СЭС */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h2 className="text-2xl font-semibold text-yellow-300">6. Солнечная электростанция (СЭС)</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-300 list-disc list-inside">
            <li><b>Панели</b> — моно-/поликристаллические Si: Trina Solar Vertex, Jinko Tiger Neo,
              Longi Hi-MO, JA Solar (мощность 1 модуля 400-580 Вт, КПД 20-22.5%).</li>
            <li><b>Конструкции</b> — фиксированные (наклон 28-35°) либо одноосные трекеры (выработка +18-25%).</li>
            <li><b>Инверторы</b> — Sungrow SG250HX, SMA Sunny Central, Huawei FusionSolar (string или central).</li>
            <li><b>Трансформаторные блоки</b> — 1000-2500 кВА, выход 35 кВ → ПС.</li>
            <li><b>СЭС РК</b> — Бурное (Алматинская обл.) 100 МВт, Хан Кызыл 100 МВт, Карагандыкент
              50 МВт, Кушата 50 МВт, Сарань 100 МВт.</li>
            <li><b>Удельная стоимость</b> — <b>280-380 млн тг / МВт</b> (средний бенчмарк 330 млн тг/МВт).</li>
            <li><b>Площадь</b> — 1.5-2.0 га / МВт при фиксированных конструкциях.</li>
          </ul>
        </section>

        {/* Section 7: ОРУ / КРУЭ */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h2 className="text-2xl font-semibold text-violet-300">7. ОРУ и распределительная часть</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-300 list-disc list-inside">
            <li><b>ОРУ 220/500 кВ</b> — открытое распредустройство со схемами «полтора выключателя
              на цепь», «четырёхугольник», «две системы шин с обходной».</li>
            <li><b>Выключатели</b> — элегазовые ABB LTB, Siemens 3AP, Mitsubishi 550-SFMT; ток
              отключения 40-63 кА.</li>
            <li><b>Разъединители</b> — пантографные или горизонтально-поворотные.</li>
            <li><b>Защита РЗА</b> — Siemens SIPROTEC 4/5, GE Multilin, ABB REL/REB, ЭКРА (РФ).</li>
            <li><b>КРУЭ</b> — комплектное элегазовое распредустройство, применяется для городских
              ПС и встроенных в главные корпуса ТЭЦ (компактность × 10).</li>
            <li><b>Главный повышающий трансформатор</b> — однофазная группа или трёхфазный 250-630
              МВА, ABB / Siemens / Электрозавод / KEMONT.</li>
          </ul>
        </section>

        {/* Section 8: Системы охлаждения */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h2 className="text-2xl font-semibold text-blue-300">8. Системы охлаждения ТЭС</h2>
          <div className="mt-3 grid md:grid-cols-3 gap-4 text-sm text-slate-300">
            <div className="bg-slate-950/60 rounded-lg border border-slate-800 p-4">
              <div className="font-semibold text-blue-200">Прямоточная</div>
              <p className="mt-1 text-slate-400">Вода берётся из крупного водоёма (Иртыш, Бухтарминское вдхр),
                циркуляц. насосы 50-100 тыс. м³/час, сбрасывается обратно подогретой.</p>
            </div>
            <div className="bg-slate-950/60 rounded-lg border border-slate-800 p-4">
              <div className="font-semibold text-blue-200">Градирни мокрые (плёночные/брызгальные)</div>
              <p className="mt-1 text-slate-400">Башенные ЖБ 90-150 м или вентиляторные секционные.
                Унос воды на испарение 1.5-2%, нужна подпитка.</p>
            </div>
            <div className="bg-slate-950/60 rounded-lg border border-slate-800 p-4">
              <div className="font-semibold text-blue-200">Сухие (воздушно-конденсационные)</div>
              <p className="mt-1 text-slate-400">Для аридных зон (юг и запад РК). КПД блока чуть
                ниже, зато расход воды близок к нулю.</p>
            </div>
          </div>
        </section>

        {/* Section 9: Бенчмарки */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h2 className="text-2xl font-semibold text-emerald-300">9. Бенчмарки крупной генерации РК</h2>
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-sm">
              <thead className="text-slate-400 border-b border-slate-800">
                <tr><th className="text-left py-2">Объект</th><th className="text-right">Мощность</th><th className="text-right pl-4">CAPEX / удельный</th></tr>
              </thead>
              <tbody className="text-slate-300">
                <tr className="border-b border-slate-800/50"><td className="py-2">Экибастузская ГРЭС-1</td><td className="text-right">4000 МВт</td><td className="text-right pl-4">~ 380-440 млн тг/МВт (с учётом модерниз.)</td></tr>
                <tr className="border-b border-slate-800/50"><td className="py-2">Экибастузская ГРЭС-2 (блоки 3-4, +1000 МВт)</td><td className="text-right">1000 МВт</td><td className="text-right pl-4">~ 700-800 млрд тг (FEED 2024)</td></tr>
                <tr className="border-b border-slate-800/50"><td className="py-2">Аксуская ЭС</td><td className="text-right">2450 МВт</td><td className="text-right pl-4">350-400 млн тг/МВт</td></tr>
                <tr className="border-b border-slate-800/50"><td className="py-2">ПГУ 500 МВт (typ.)</td><td className="text-right">500 МВт</td><td className="text-right pl-4">200-280 млрд тг (≈ 450-560 млн тг/МВт)</td></tr>
                <tr className="border-b border-slate-800/50"><td className="py-2">ВЭС 100 МВт (typ.)</td><td className="text-right">100 МВт</td><td className="text-right pl-4">80-130 млрд тг (≈ 800-1300 млн тг/МВт)</td></tr>
                <tr className="border-b border-slate-800/50"><td className="py-2">СЭС 100 МВт (typ.)</td><td className="text-right">100 МВт</td><td className="text-right pl-4">28-38 млрд тг (≈ 280-380 млн тг/МВт)</td></tr>
                <tr><td className="py-2">АЭС Балхаш-Үлкен (план)</td><td className="text-right">2×1200 МВт</td><td className="text-right pl-4">$10-12 млрд (≈ 2 трлн тг на блок)</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Удельная стоимость зависит от стадии — FEED, рабочей документации, фактического
            EPC-контракта. При сметном расчёте на этапе ТЭО берут верхнюю границу диапазона.
          </p>
        </section>

        {/* Exercises */}
        <section className="bg-gradient-to-br from-slate-900/70 to-slate-900/30 border border-slate-800 rounded-xl p-6">
          <h2 className="text-2xl font-semibold text-pink-300">Упражнения</h2>

          {/* ex1 */}
          <div className="mt-5">
            <p className="text-slate-200 font-medium">1. Какая установленная мощность Экибастузской ГРЭС-1?</p>
            <div className="mt-3 grid md:grid-cols-2 gap-2">
              {[
                ["a", "1000 МВт"],
                ["b", "2000 МВт"],
                ["c", "4000 МВт (8 × 500 МВт)"],
                ["d", "500 МВт"],
              ].map(([k, label]) => (
                <button key={k} onClick={() => setA1(k)}
                  className={`text-left px-4 py-3 rounded-lg border text-sm transition ${optClass(a1, k, correct1)}`}>
                  <span className="text-slate-500 mr-2">{k})</span>{label}
                </button>
              ))}
            </div>
            {a1 && <p className={`mt-2 text-sm ${a1 === correct1 ? "text-emerald-300" : "text-rose-300"}`}>
              {a1 === correct1 ? "Верно. 8 блоков по 500 МВт = 4000 МВт, крупнейшая угольная ТЭС РК." : "Неверно. Правильный ответ — c) 4000 МВт."}
            </p>}
          </div>

          {/* ex2 */}
          <div className="mt-7">
            <p className="text-slate-200 font-medium">2. Что такое ПГУ?</p>
            <div className="mt-3 grid gap-2">
              {[
                ["a", "Подземное газовое устройство"],
                ["b", "Парогазовая установка — комбинированный цикл (газ. турбина + котёл-утилизатор + паровая турбина), КПД 55-62%"],
                ["c", "Передвижная газораспределительная установка"],
                ["d", "Парная газоохладительная установка"],
              ].map(([k, label]) => (
                <button key={k} onClick={() => setA2(k)}
                  className={`text-left px-4 py-3 rounded-lg border text-sm transition ${optClass(a2, k, correct2)}`}>
                  <span className="text-slate-500 mr-2">{k})</span>{label}
                </button>
              ))}
            </div>
            {a2 && <p className={`mt-2 text-sm ${a2 === correct2 ? "text-emerald-300" : "text-rose-300"}`}>
              {a2 === correct2 ? "Верно. ПГУ — парогазовая установка, комбинированный цикл с КПД 55-62%." : "Неверно. Правильный ответ — b)."}
            </p>}
          </div>

          {/* ex3 numeric */}
          <div className="mt-7">
            <p className="text-slate-200 font-medium">
              3. Рассчитайте CAPEX строительства СЭС 100 МВт при бенчмарке 330 млн тг/МВт. Введите сумму в тенге.
            </p>
            <input
              value={a3}
              onChange={(e) => setA3(e.target.value)}
              placeholder="например: 33000000000"
              className="mt-3 w-full md:w-80 px-4 py-3 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-pink-500"
            />
            {a3.length > 0 && (
              <p className={`mt-2 text-sm ${ok3 ? "text-emerald-300" : "text-rose-300"}`}>
                {ok3
                  ? "Верно. 100 МВт × 330 000 000 тг = 33 000 000 000 тг ≈ 33 млрд тг."
                  : "Пока не сходится. Формула: 100 × 330 000 000 = 33 000 000 000 тг (допуск ±3 млрд)."}
              </p>
            )}
          </div>

          {/* ex4 */}
          <div className="mt-7">
            <p className="text-slate-200 font-medium">4. Какие типы гидротурбин применяются на ГЭС Казахстана?</p>
            <div className="mt-3 grid gap-2">
              {[
                ["a", "Только Френсиса"],
                ["b", "Только Каплана"],
                ["c", "Только Пельтона"],
                ["d", "В РК преобладают Френсиса (Бухтарминская/Шульбинская/Капшагай), а Каплана применяют на низконапорных равнинных схемах"],
              ].map(([k, label]) => (
                <button key={k} onClick={() => setA4(k)}
                  className={`text-left px-4 py-3 rounded-lg border text-sm transition ${optClass(a4, k, correct4)}`}>
                  <span className="text-slate-500 mr-2">{k})</span>{label}
                </button>
              ))}
            </div>
            {a4 && <p className={`mt-2 text-sm ${a4 === correct4 ? "text-emerald-300" : "text-rose-300"}`}>
              {a4 === correct4 ? "Верно. Френсиса доминируют (напоры 40-180 м), Каплана — для низконапорных равнинных рек." : "Неверно. Правильный ответ — d)."}
            </p>}
          </div>
        </section>

        <div className="pt-4 pb-12 text-center">
          <Link href="/smeta-trainer/drawings-practice"
            className="inline-block px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition">
            ← Вернуться к разделам
          </Link>
        </div>
      </main>
    </div>
  );
}
