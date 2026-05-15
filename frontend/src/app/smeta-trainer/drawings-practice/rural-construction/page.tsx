"use client";

import Link from "next/link";
import { useState } from "react";

export default function RuralConstructionPage() {
  const [ex1, setEx1] = useState<string | null>(null);
  const [ex1Res, setEx1Res] = useState<null | "ok" | "bad">(null);
  const [ex1Sol, setEx1Sol] = useState(false);

  const [ex2, setEx2] = useState("");
  const [ex2Res, setEx2Res] = useState<null | "ok" | "bad">(null);
  const [ex2Sol, setEx2Sol] = useState(false);

  const [ex3, setEx3] = useState<string | null>(null);
  const [ex3Res, setEx3Res] = useState<null | "ok" | "bad">(null);
  const [ex3Sol, setEx3Sol] = useState(false);

  const [ex4, setEx4] = useState<string | null>(null);
  const [ex4Res, setEx4Res] = useState<null | "ok" | "bad">(null);
  const [ex4Sol, setEx4Sol] = useState(false);

  const checkEx1 = () => setEx1Res(ex1 === "c" ? "ok" : "bad");
  const checkEx2 = () => {
    // 80 м² × 150 000 = 12 000 000 тг (бенчмарк сел. дома эконом)
    const v = parseFloat(ex2);
    if (!isFinite(v)) return setEx2Res("bad");
    setEx2Res(Math.abs(v - 12_000_000) <= 500_000 ? "ok" : "bad");
  };
  const checkEx3 = () => setEx3Res(ex3 === "b" ? "ok" : "bad");
  const checkEx4 = () => setEx4Res(ex4 === "d" ? "ok" : "bad");

  const types = [
    {
      name: "Сельский дом 1-этажный",
      area: "60-150 м²",
      mat: "Кирпич, газоблок Ytong, шлакоблок, саман (юг РК)",
      cost: "120-180 тыс. тг/м² эконом, 180-280 средний",
      time: "4-8 мес. с фундамента до ключа",
      notes: "Самый массовый сегмент — субсидии Жилстройсбербанка, Бизнес 2025",
    },
    {
      name: "Сельский дом 2-этажный",
      area: "150-250 м²",
      mat: "Каркасно-бруйечный или газоблок + утепление",
      cost: "150-250 тыс. тг/м²",
      time: "6-12 мес.",
      notes: "Чаще в пригородах областных центров",
    },
    {
      name: "Дача / летняя резиденция",
      area: "30-100 м²",
      mat: "Деревянный сруб, СИП-панели, лёгкие конструкции",
      cost: "80-150 тыс. тг/м² (упрощённая отделка)",
      time: "2-4 мес.",
      notes: "Не для постоянного проживания, без отопления или газа",
    },
    {
      name: "Гараж / хоз. постройка",
      area: "20-80 м²",
      mat: "Кирпич, металлокаркас, металлоконтейнер",
      cost: "60-120 тыс. тг/м²",
      time: "1-2 мес.",
      notes: "Часто без фундамента (на грунт или плитка)",
    },
    {
      name: "Баня / сауна",
      area: "15-50 м²",
      mat: "Дерево (бревно, брус) — традиционно, или газоблок",
      cost: "200-400 тыс. тг/м² (зависит от отделки)",
      time: "2-4 мес.",
      notes: "Нужна спец. вентиляция, печь, водоотвод — высокие требования",
    },
    {
      name: "Коровник / птичник",
      area: "100-1000 м²",
      mat: "Каркас металл. + сэндвич-панели, бетон. пол",
      cost: "80-150 тыс. тг/м² (без оборудования)",
      time: "3-6 мес.",
      notes: "Климат-системы, вентиляция, навозоудаление — отдельные позиции",
    },
  ];

  const simplifications = [
    {
      what: "Упрощённый порядок согласования",
      detail: "Для ИЖС &lt; 500 м² и 3 этажей — уведомительный порядок (не разрешительный) по ЗРК «Об архит. деят.» с 2020",
      law: "Ст. 50 ЗРК № 242 (поправки 2020)",
    },
    {
      what: "Без обязательной ГосЭкспертизы",
      detail: "Индивидуальный жилой дом до 500 м² на собств. участке — без экспертизы (если не на склоне &gt; 15° или в зоне ЧС)",
      law: "ПП РК № 1029 (Список объектов под экспертизу)",
    },
    {
      what: "Упрощённая смета",
      detail: "Для частника — допустимо в формате Excel с укрупнёнными показателями (м²×цена), без полного ССР",
      law: "ПП РК № 353 (Правила ввода) — упрощённый ввод",
    },
    {
      what: "Самостоятельное строительство",
      detail: "Без обязательной СМР-лицензии (если не для продажи / коммерческой эксплуатации)",
      law: "ЗРК «О лицензировании» — лицензия только для подрядчиков",
    },
    {
      what: "Льготная ипотека «Бакыт»",
      detail: "Жилстройсбербанк РК — кредит до 30 млн тг под 7-9% на сельское жильё",
      law: "ПП РК «О программе Бакыт»",
    },
    {
      what: "Субсидии на инж. сети",
      detail: "Подключение к газу/электр./воде — за счёт акимата для соц. жилья в сёлах",
      law: "Регионально, через акиматы СБП и Бакыт",
    },
  ];

  const components = [
    { item: "Фундамент", what: "Чаще всего ленточный мелкозаглубленный (МЗЛФ) или сваи ТИСЭ", cost: "12-25 тыс. тг/м.п. (МЗЛФ), 25-45 тыс. тг/шт. (свая)" },
    { item: "Стены газоблок", what: "Газоблок Ytong / Hebel 400 мм с утеплителем", cost: "15-22 тыс. тг/м² готовой стены" },
    { item: "Стены кирпич", what: "Полнотелый М125-150, утеплитель 100-150 мм", cost: "25-35 тыс. тг/м² с отделкой" },
    { item: "Перекрытие 1-2 эт.", what: "Деревянные балки или плиты ПК", cost: "20-35 тыс. тг/м² перекрытия" },
    { item: "Кровля", what: "Скатная с металлочерепицей или профнастилом", cost: "15-25 тыс. тг/м² кровли (включая обрешётку)" },
    { item: "Окна ПВХ", what: "Стандарт 1.3×1.5 м, 2-камерные стеклопакеты", cost: "70-150 тыс. тг/окно (с монтажом)" },
    { item: "Внешняя отделка", what: "Штукатурка + покраска или фасадные панели", cost: "8-15 тыс. тг/м² фасада" },
    { item: "Внутренняя отделка", what: "Минимум: штукатурка + покраска + ламинат", cost: "30-60 тыс. тг/м² внутр. отделки" },
    { item: "Инженерные сети", what: "Электричество + вода (скважина или сеть) + газ или электроотопление", cost: "1.5-3 млн тг на дом (без газа), +1-2 млн с газом" },
    { item: "Септик", what: "Локальная очистка (на даче без центр. канализации)", cost: "300-800 тыс. тг (Топас, Тверь, простой ж/б колодец)" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Сельское строительство</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🏡 Сельское и дачное строительство РК
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            Сельское и индивидуальное жилищное строительство (ИЖС) в РК —
            <strong className="text-green-300"> массовый сегмент</strong> с упрощёнными
            процедурами. По данным КАЗСТАТ, ежегодно вводится ~ 35-50 тыс. таких объектов
            (дома до 500 м²). Многие сметчики думают, что это «не серьёзная» работа —
            и зря. Спрос на грамотные сметы для частников и сельхозкооперативов растёт,
            а конкуренция мала. Премия за быстрое и качественное обслуживание этого
            рынка существенна.
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Объём рынка РК</div>
              <div className="text-slate-300">35-50 тыс. объектов ИЖС/год</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Упрощённый порядок</div>
              <div className="text-slate-300">До 500 м², 3 этажей — без экспертизы</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Программы РК</div>
              <div className="text-slate-300">Бакыт, СБП, 7-20-25, Нурлы Жер</div>
            </div>
          </div>
        </section>

        {/* Section 1: 6 типов */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🏠 Section 1. Шесть типов сельских объектов
          </h2>
          <div className="space-y-3">
            {types.map((t) => (
              <div key={t.name} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
                <div className="flex items-baseline justify-between gap-4 mb-2">
                  <h3 className="text-base font-semibold text-green-300">{t.name}</h3>
                  <span className="text-xs text-amber-300 italic shrink-0">{t.area}</span>
                </div>
                <dl className="text-sm grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Материал</dt>
                    <dd className="text-slate-300 text-xs">{t.mat}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Цена</dt>
                    <dd className="text-emerald-300 text-xs">{t.cost}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Срок стр-ва</dt>
                    <dd className="text-amber-300 text-xs">{t.time}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Особенности</dt>
                    <dd className="text-slate-400 text-xs italic">{t.notes}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Упрощения */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            ⚡ Section 2. Шесть упрощений для частников
          </h2>
          <div className="space-y-3">
            {simplifications.map((s) => (
              <div key={s.what} className="border border-green-800/40 bg-green-950/20 rounded-xl p-4">
                <h3 className="text-base font-semibold text-green-300 mb-2">{s.what}</h3>
                <dl className="text-sm space-y-1">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Что упрощено</dt>
                    <dd className="text-slate-300 text-xs">{s.detail}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Закон</dt>
                    <dd className="text-slate-400 text-xs italic">{s.law}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Состав сметы */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📋 Section 3. Типовой состав сметы сельского дома
          </h2>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-44">Позиция</th>
                  <th className="text-left px-4 py-3">Описание</th>
                  <th className="text-left px-4 py-3 w-56">Бенчмарк цены</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {components.map((c) => (
                  <tr key={c.item} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 text-green-300 font-medium text-xs">{c.item}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{c.what}</td>
                    <td className="px-4 py-3 text-emerald-300 text-xs font-mono">{c.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 4: Программы */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            💰 Section 4. Гос. программы поддержки ИЖС в РК
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="border border-green-800/40 bg-green-950/20 rounded-lg p-4 text-sm">
              <h3 className="font-semibold text-green-300 mb-1">«Бакыт» (Счастье)</h3>
              <p className="text-xs text-slate-300">Ипотека на сельское жильё. До 30 млн тг под 7-9% годовых. Через Жилстройсбербанк. Условия: 3 года накоплений + минимальная зарплата 200 МРП.</p>
            </div>
            <div className="border border-green-800/40 bg-green-950/20 rounded-lg p-4 text-sm">
              <h3 className="font-semibold text-green-300 mb-1">«7-20-25»</h3>
              <p className="text-xs text-slate-300">Ипотека: ставка 7%, ПВ 20%, срок 25 лет. До 25 млн тг (Алматы), до 15 (регионы). Через любой БВУ с гарантией Казахстанской ипотечной компании.</p>
            </div>
            <div className="border border-green-800/40 bg-green-950/20 rounded-lg p-4 text-sm">
              <h3 className="font-semibold text-green-300 mb-1">«Нурлы Жер»</h3>
              <p className="text-xs text-slate-300">Гос. программа жилищного стр-ва. Аренда с выкупом, льготная ипотека для молодых семей и многодетных. Расширена до 2025-2029.</p>
            </div>
            <div className="border border-green-800/40 bg-green-950/20 rounded-lg p-4 text-sm">
              <h3 className="font-semibold text-green-300 mb-1">СБП — «Сельский Бакыт Прогресс»</h3>
              <p className="text-xs text-slate-300">Льготы для жителей сельских акиматов: бесплатный участок 0.10 га, подключение к сетям за счёт акимата, кредит до 15 млн тг под 2.5%.</p>
            </div>
            <div className="border border-green-800/40 bg-green-950/20 rounded-lg p-4 text-sm">
              <h3 className="font-semibold text-green-300 mb-1">«Молодая семья» (Жас Жер)</h3>
              <p className="text-xs text-slate-300">Для семей до 35 лет + 2+ детей. Субсидия до 30% от стоимости жилья. Через акиматы областей.</p>
            </div>
            <div className="border border-green-800/40 bg-green-950/20 rounded-lg p-4 text-sm">
              <h3 className="font-semibold text-green-300 mb-1">«Дом за тенге»</h3>
              <p className="text-xs text-slate-300">Программа для социальных категорий — бесплатная передача жилья на сельской местности при условии работы 5+ лет в данном районе (врачи, учителя).</p>
            </div>
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Section 5. Упражнения</h2>

          {/* Упр.1 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Когда нужна ГосЭкспертиза
            </div>
            <div className="text-slate-200 mb-4">
              Семья строит индивидуальный жилой дом в сельской местности: <strong>S общ.
              = 200 м²</strong>, 2 этажа, обычный плоский участок, не в зоне ЧС.
              Нужна ли ГосЭкспертиза проекта?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Да — любое жилое строительство требует экспертизы" },
                { v: "b", t: "Да — для 2-этажного обязательно" },
                { v: "c", t: "Нет — ИЖС до 500 м² и до 3 этажей в обычных условиях освобождён от обязательной экспертизы (ПП РК № 1029)" },
                { v: "d", t: "Только если стоимость &gt; 50 млн тг" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1 === opt.v ? "border-green-600 bg-green-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-green-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex1Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — освобождён от экспертизы</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-green-300">Решение:</strong> ПП РК № 1029 (Перечень
                объектов гос. экспертизы) освобождает от обязательной экспертизы:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>ИЖС до <strong>500 м²</strong> общей площади</li>
                  <li>Высотой не более <strong>3 этажей</strong> (без подземных)</li>
                  <li>На участке без особых условий (не на склоне &gt; 15°, не в зоне ЧС, не
                  в зоне культурного наследия)</li>
                  <li>Только для собственных нужд (не на продажу)</li>
                </ul>
                Это огромное упрощение для частного строительства: не нужен дорогой
                экспертный проект (~ 2-4% от ССР), нет ожидания 30-60 дней, не нужно
                согласовывать смету в ГосЭкспертизе. Можно строить по упрощённой смете
                и обычным эскизам. Если же объект &gt; 500 м² или 4+ этажа — экспертиза
                обязательна, как для коммерч. зданий.
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Бенчмарк сельского дома
            </div>
            <div className="text-slate-200 mb-4">
              Заказчик планирует строить сельский дом <strong>80 м²</strong> эконом-класса
              (газоблок, простая отделка). Бенчмарк цены: <strong>150 тыс. тг/м²</strong>.
              Сколько примерно потребуется бюджет (без участка и подключения сетей)?
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Бюджет, тг</span>
              <input value={ex2} onChange={(e) => setEx2(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="12000000" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex2Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 12 млн тг</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-green-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Бюджет = S × Цена_бенчмарк
       = 80 м² × 150 000 тг/м²
       = 12 000 000 тг

Что входит (грубая разбивка):
• Фундамент МЗЛФ (12 пог.м): ~ 250 тыс. тг
• Стены газоблок 400 мм (60 м²): ~ 1.3 млн тг
• Перекрытие (80 м²): ~ 2.4 млн тг
• Кровля (90 м² с учётом уклона): ~ 1.8 млн тг
• Окна (5-6 шт.): ~ 700 тыс. тг
• Двери (4-5 шт.): ~ 250 тыс. тг
• Внешняя отделка (110 м²): ~ 1.2 млн тг
• Внутренняя отделка (80 м²): ~ 3.6 млн тг
• Полы (80 м²): ~ 800 тыс. тг
─────────────────────────────────────
ИТОГО грубо: ~ 12.3 млн тг

Дополнительно (не вошло в бенчмарк 150 тыс. тг/м²):
• Участок: 1-5 млн тг (зависит от региона)
• Подключение сетей: 1.5-3 млн тг
• Септик / канализация: 300-800 тыс. тг
• Скважина (если нет водопровода): 400 тыс. тг
─────────────────────────────────────
ПОЛНАЯ стоимость: 15-22 млн тг под ключ

Программа «Бакыт» — кредит до 30 млн тг под 7-9% покрывает
такой бюджет полностью. ПВ 20% = 3-4 млн тг.`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Уведомительный порядок
            </div>
            <div className="text-slate-200 mb-4">
              С 2020 года для ИЖС в РК ввели <strong>уведомительный</strong> порядок
              согласования (вместо разрешительного). Что это означает для частника?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Можно строить без всякого разрешения — никаких документов" },
                { v: "b", t: "Достаточно подать уведомление о начале строительства в МИО (акимат) с эскизами и схемой расположения. Если в течение 14 дней нет отказа — можно строить" },
                { v: "c", t: "Уведомление только для электричества и газа" },
                { v: "d", t: "Нужно полное разрешение, как раньше" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex3 === opt.v ? "border-green-600 bg-green-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex3" value={opt.v} checked={ex3 === opt.v} onChange={() => setEx3(opt.v)} className="accent-green-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — уведомление + 14 дней</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-green-300">Решение:</strong> ЗРК «Об архитектурной,
                градостроительной и строительной деятельности» (поправки 2020 г.) ввёл
                уведомительный порядок для ИЖС. Алгоритм:
                <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
                  <li>Подача уведомления в МИО (акимат района/города) — через egov.kz</li>
                  <li>Приложение: эскизный проект, схема расположения на участке,
                  правоустанавливающие документы на землю</li>
                  <li>Ожидание 14 дней — если МИО не отказал, строительство разрешено</li>
                  <li>МИО может отказать только при нарушении градостроит. норм или
                  правил землепользования</li>
                </ol>
                Это огромная либерализация. Ранее частник полгода собирал разрешения и
                согласования. Теперь — 2 недели. Главное: соблюдать правила:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Отступ от границ участка (мин. 3 м от соседа, 5 м от красной линии)</li>
                  <li>Высота не более 3 этажей (12 м)</li>
                  <li>Площадь не более 500 м²</li>
                </ul>
                Без соблюдения этих условий — самовольная постройка, риск принудит. сноса.
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Льготная ипотека
            </div>
            <div className="text-slate-200 mb-4">
              Молодая семья (муж 28 лет, жена 25, двое детей) живёт в Туркестанской области.
              Хотят построить сельский дом 100 м² (стоимость ~ 18 млн тг). Какие
              <strong> программы господдержки</strong> могут использовать одновременно?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Только «Бакыт» — выбрать одну программу" },
                { v: "b", t: "Только частный кредит коммерческого банка" },
                { v: "c", t: "Программу «Бакыт», но без других льгот" },
                { v: "d", t: "Комбинацию: «Бакыт» (ипотека) + «Молодая семья» (субсидия 30%) + СБП (бесплатный участок + подключение сетей за счёт акимата). Возможна экономия 5-8 млн тг" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex4 === opt.v ? "border-green-600 bg-green-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex4" value={opt.v} checked={ex4 === opt.v} onChange={() => setEx4(opt.v)} className="accent-green-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex4Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — комбинация программ</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-green-300">Решение:</strong> Несколько программ
                <strong>можно комбинировать</strong>, если семья соответствует критериям
                каждой. Для приведённой семьи:
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Стоимость дома: 18 000 000 тг
Дополнительно: участок + сети = 3-5 млн тг
ИТОГО НУЖНО: 21-23 млн тг

Льготы:
• «Молодая семья» (Жас Жер) — субсидия 30%
  = 18 млн × 30% = 5.4 млн тг (если применима)
• СБП — бесплатный участок (~ 2 млн экономии)
  + подключение сетей за счёт акимата (~ 2 млн)
• «Бакыт» — ипотека под 7-9% на 30 лет
  на оставшуюся сумму

Общая экономия: 9-10 млн тг (40% от стоимости)
Платёж по ипотеке (15 млн × 30 лет × 8%): ~ 110 тыс. тг/мес

Программы регулярно меняются — нужно сверяться:
- enbek.gov.kz/ru/programs/molodaya-semya
- atameken.kz/services/программы-жилья
- egov.kz по запросу акимата

Сметчик, знающий эти программы, востребован для
консультаций — отдельная ниша помимо классических смет.`}
                </pre>
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          ЗРК «Об архит., град. и стр. деятельности» от 16.07.2001 № 242 (с поправками
          2020). ПП РК № 1029 (Перечень объектов гос. экспертизы). ПП РК № 353 (Правила
          ввода в эксплуатацию). Программы: «Бакыт», «7-20-25», «Нурлы Жер», «Молодая
          семья», СБП. Жилстройсбербанк — hcsbk.kz, Казахстанская ипотечная компания —
          kic.kz, акимат-программы — egov.kz.
        </div>
      </main>
    </div>
  );
}
