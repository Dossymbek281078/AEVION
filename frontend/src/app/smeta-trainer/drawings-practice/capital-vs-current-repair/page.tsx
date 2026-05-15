"use client";

import Link from "next/link";
import { useState } from "react";

export default function CapitalVsCurrentRepairPage() {
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
    // 1500 м² × 8 тыс. тг/м² (текущий ремонт МКД средний) = 12 млн тг
    const v = parseFloat(ex3);
    if (!isFinite(v)) return setEx3Res("bad");
    setEx3Res(Math.abs(v - 12_000_000) <= 500_000 ? "ok" : "bad");
  };
  const checkEx4 = () => setEx4Res(ex4 === "d" ? "ok" : "bad");

  const comparison = [
    { aspect: "Определение", current: "Поддержание объекта в эксплуатационном состоянии", capital: "Восстановление основных параметров объекта с заменой изношенных элементов" },
    { aspect: "Норматив РК", current: "СН РК 3.02-01 раздел 3 + Приказ Минстроя № 200", capital: "СН РК 3.02-01 раздел 4 + ПП РК № 1162" },
    { aspect: "Периодичность", current: "Ежегодно или 2-3 раза в год", capital: "Раз в 15-25 лет (по нормам износа)" },
    { aspect: "Объём работ", current: "10-30% от стоимости объекта", capital: "30-100% от стоимости объекта (новое строительство ≤ 70%)" },
    { aspect: "Основные элементы", current: "Не затрагивает несущие конструкции", capital: "Может затрагивать несущие (но не &gt; 50% замены)" },
    { aspect: "Экспертиза", current: "Не требуется", capital: "Требуется для бюджетных и сложных объектов" },
    { aspect: "Согласование", current: "Уведомление акимата", capital: "Разрешение + проектная документация" },
    { aspect: "Налоговый учёт", current: "Списывается в расходы периода", capital: "Капитализируется на стоимость ОС (амортизация)" },
    { aspect: "Финансирование", current: "Из эксплуатационного бюджета (МКД — собств.)", capital: "Из фонда капремонта (МКД), бюджета (соц. объекты)" },
    { aspect: "Гарантия работ", current: "1 год", capital: "2-5 лет (по ГК РК ст. 723)" },
  ];

  const current_examples = [
    { item: "Косметический ремонт подъезда", what: "Покраска стен, замена ламп, мелкий ремонт ступеней", cost: "30-80 тыс. тг/м² подъезда" },
    { item: "Замена окон в подъезде (отдельные)", what: "5-10 окон из 30, если разбиты или сгнили", cost: "70-150 тыс. тг/окно" },
    { item: "Замена сантехнических приборов", what: "Замена смесителей, унитазов, бачков в общедомовых санузлах", cost: "20-80 тыс. тг/прибор" },
    { item: "Ремонт ливневой канализации", what: "Прочистка, замена сегментов труб, ремонт колодцев", cost: "100-300 тыс. тг/участок" },
    { item: "Покраска фасада (без утепления)", what: "Очистка + грунт + 2 слоя краски, без штукатурки", cost: "2-5 тыс. тг/м² фасада" },
    { item: "Замена лампочек и светильников", what: "Замена части осветительных приборов (не вся система)", cost: "5-15 тыс. тг/светильник" },
    { item: "Замена напольного покрытия (точечно)", what: "Замена ламината/линолеума на 1-2 этажах (не всё здание)", cost: "5-15 тыс. тг/м² пола" },
    { item: "Ремонт кровли (заплатки)", what: "Локальное устранение протечек, без замены всего покрытия", cost: "5-20 тыс. тг/м² ремонтируемой площади" },
  ];

  const capital_examples = [
    { item: "Полная замена кровли", what: "Демонтаж старой + новая стропильная система (если нужно) + покрытие", cost: "15-35 тыс. тг/м² кровли (зависит от материала)" },
    { item: "Утепление фасада + штукатурка", what: "Минвата 150 мм + сетка + штукатурка + покраска", cost: "12-25 тыс. тг/м² фасада" },
    { item: "Замена всех окон в здании", what: "ПВХ на старые деревянные/металлические, с откосами", cost: "120-250 тыс. тг/окно (с монтажом)" },
    { item: "Замена лифтов в МКД", what: "Полный демонтаж + новый лифт + шахта", cost: "12-25 млн тг/лифт" },
    { item: "Замена инженерных сетей", what: "ВК, ОВ, ЭО полностью с заменой стояков и разводки", cost: "8-20 тыс. тг/м² здания" },
    { item: "Усиление несущих конструкций", what: "Углеволокно, стальные обоймы, набетонирование", cost: "30-80 тыс. тг/м² конструкций" },
    { item: "Капремонт балконов и лоджий", what: "Замена/усиление плиты, новое остекление, отделка", cost: "200-500 тыс. тг/балкон" },
    { item: "Замена системы отопления", what: "Новые радиаторы, стояки, ИТП, контроль расхода", cost: "15-30 тыс. тг/м² отапл. площади" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Виды ремонта</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🔧 Капитальный vs Текущий ремонт
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            <strong className="text-teal-300">Правильная классификация ремонта</strong> —
            это не просто формальность. От неё зависят: источник финансирования (текущий
            ремонт — из эксплуатации, капитальный — из спецфонда), налоговый учёт
            (расход vs капитализация), необходимость экспертизы, гарантийные сроки.
            Регулируется СН РК 3.02-01 «Эксплуатация и ремонт зданий и сооружений»,
            ПП РК № 1162 «О капитальном ремонте» + Налоговый кодекс РК ст. 90 (амортизация).
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Норматив</div>
              <div className="text-slate-300">СН РК 3.02-01 + ПП РК № 1162</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Текущий ремонт</div>
              <div className="text-slate-300">10-30% от стоимости, ежегодно</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Капремонт</div>
              <div className="text-slate-300">30-100% от стоимости, 15-25 лет</div>
            </div>
          </div>
        </section>

        {/* Section 1: Сравнительная таблица */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🆚 Section 1. Сравнение по 10 ключевым параметрам
          </h2>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-44">Параметр</th>
                  <th className="text-left px-4 py-3">Текущий ремонт</th>
                  <th className="text-left px-4 py-3">Капитальный ремонт</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {comparison.map((c) => (
                  <tr key={c.aspect} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 text-slate-100 text-xs font-medium">{c.aspect}</td>
                    <td className="px-4 py-3 text-emerald-300 text-xs">{c.current}</td>
                    <td className="px-4 py-3 text-amber-300 text-xs">{c.capital}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2: Примеры текущего */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🟢 Section 2. Примеры текущего ремонта (МКД)
          </h2>
          <div className="space-y-3">
            {current_examples.map((c) => (
              <div key={c.item} className="border border-emerald-800/40 bg-emerald-950/20 rounded-xl p-4">
                <div className="flex items-baseline justify-between gap-4 mb-2">
                  <h3 className="text-base font-semibold text-emerald-300">{c.item}</h3>
                  <span className="text-xs text-amber-300 italic shrink-0">{c.cost}</span>
                </div>
                <p className="text-sm text-slate-300">{c.what}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Примеры капитального */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🔴 Section 3. Примеры капитального ремонта (МКД)
          </h2>
          <div className="space-y-3">
            {capital_examples.map((c) => (
              <div key={c.item} className="border border-amber-800/40 bg-amber-950/20 rounded-xl p-4">
                <div className="flex items-baseline justify-between gap-4 mb-2">
                  <h3 className="text-base font-semibold text-amber-300">{c.item}</h3>
                  <span className="text-xs text-amber-300 italic shrink-0">{c.cost}</span>
                </div>
                <p className="text-sm text-slate-300">{c.what}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: Спорные случаи */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            ⚠️ Section 4. Спорные случаи и принцип разграничения
          </h2>
          <div className="border border-teal-800/60 bg-teal-950/30 rounded-xl p-5 text-sm space-y-3">
            <p className="text-slate-300">
              <strong className="text-teal-300">Главный критерий:</strong> объём вмешательства
              и затрагивание основных параметров (несущих конструкций, инж. систем).
            </p>
            <div>
              <strong className="text-teal-300">Спорные случаи:</strong>
              <ul className="list-disc list-inside mt-2 space-y-2 text-xs text-slate-300">
                <li><strong>«Замена окон в одном подъезде»</strong> — если плановая замена 100% окон подъезда → капремонт. Если 2-3 разбитых → текущий</li>
                <li><strong>«Покраска фасада»</strong> — без подготовки/штукатурки → текущий. С полной обработкой фасада, утеплением → капремонт</li>
                <li><strong>«Замена смесителей в квартирах»</strong> — текущий (это не общее имущество)</li>
                <li><strong>«Замена стояков ВК»</strong> — капремонт (общее имущество, серьёзное вмешательство)</li>
                <li><strong>«Ремонт крыши после града»</strong> — текущий (восстановление), но если &gt; 30% площади → капремонт</li>
                <li><strong>«Замена лифта»</strong> — всегда капремонт (несущий элемент)</li>
              </ul>
            </div>
            <p className="text-slate-300 text-xs italic">
              При спорах привлекается экспертиза независимая или ТН-комиссия акимата.
              Решение оформляется протоколом.
            </p>
          </div>
        </section>

        {/* Section 5: Налоговый учёт */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            💼 Section 5. Налоговый учёт ремонта
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-emerald-800/40 bg-emerald-950/20 rounded-xl p-4">
              <h3 className="text-base font-semibold text-emerald-300 mb-2">Текущий ремонт</h3>
              <ul className="text-sm space-y-1.5 text-slate-300 list-disc list-inside">
                <li>Списывается в расходы периода (Дт 7212 Кт 1310)</li>
                <li>Уменьшает налогооблагаемую базу сразу</li>
                <li>Не амортизируется</li>
                <li>Документы: акт КС-2/КС-3 + СФ материалов</li>
                <li>Юридически — расходы на эксплуатацию (НК РК ст. 100)</li>
              </ul>
            </div>
            <div className="border border-amber-800/40 bg-amber-950/20 rounded-xl p-4">
              <h3 className="text-base font-semibold text-amber-300 mb-2">Капитальный ремонт</h3>
              <ul className="text-sm space-y-1.5 text-slate-300 list-disc list-inside">
                <li>Капитализируется на стоимость ОС (Дт 2410 Кт 1310)</li>
                <li>Увеличивает балансовую стоимость объекта</li>
                <li>Амортизируется по сроку (НК РК ст. 90, обычно 1-2.5% в год)</li>
                <li>Документы: акт КС-2/КС-3 + проектная документация</li>
                <li>Юридически — улучшение имущества (НК РК ст. 122)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Section 6. Упражнения</h2>

          {/* Упр.1 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Классификация ремонта
            </div>
            <div className="text-slate-200 mb-4">
              В МКД заменили <strong>все окна на все этажах</strong> (130 шт. вместо
              старых деревянных). Утеплили фасад минватой 150 мм + штукатурка.
              Заменили все лифты. Это какой вид ремонта?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Текущий ремонт — окна и лифты часто меняют" },
                { v: "b", t: "Косметический ремонт" },
                { v: "c", t: "Капитальный ремонт — затрагивает общее имущество в крупном объёме (фасад, окна, лифты), требует ПД, экспертизы, фонда капремонта" },
                { v: "d", t: "Реконструкция" },
              ].map((opt) => (
                <label key={opt.v} className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${ex1 === opt.v ? "border-teal-600 bg-teal-950/30" : "border-slate-800 hover:border-slate-700"}`}>
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-teal-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex1Sol ? "Скрыть решение" : "Показать решение"}</button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — капремонт</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-teal-300">Решение:</strong> Это явный капитальный
                ремонт по СН РК 3.02-01:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Объём работ значительный (130 окон + весь фасад + лифты)</li>
                  <li>Затрагивает общее имущество всего МКД</li>
                  <li>Требует ПД и согласований</li>
                  <li>Финансируется из фонда капремонта (не из эксплуатационного)</li>
                  <li>Налоговый учёт — капитализация на стоимость МКД</li>
                  <li>Гарантия работ 2-5 лет</li>
                </ul>
                Не реконструкция — потому что не меняются основные параметры объекта
                (этажность, площадь, назначение). Если бы пристроили этаж или мансарду
                — была бы реконструкция. Не текущий — слишком масштабно и системно.
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Источник финансирования
            </div>
            <div className="text-slate-200 mb-4">
              В МКД нужно срочно отремонтировать <strong>протекающую крышу</strong> (точечно,
              на 50 м² из 1000 м²). Откуда финансировать?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Из фонда капремонта МКД" },
                { v: "b", t: "Из текущих платежей жильцов на эксплуатацию (это текущий ремонт — локальное устранение, не системная замена)" },
                { v: "c", t: "Из бюджета акимата" },
                { v: "d", t: "Из ЕНПФ" },
              ].map((opt) => (
                <label key={opt.v} className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${ex2 === opt.v ? "border-teal-600 bg-teal-950/30" : "border-slate-800 hover:border-slate-700"}`}>
                  <input type="radio" name="ex2" value={opt.v} checked={ex2 === opt.v} onChange={() => setEx2(opt.v)} className="accent-teal-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex2Sol ? "Скрыть решение" : "Показать решение"}</button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — текущие платежи</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-teal-300">Решение:</strong> Локальное устранение
                протечек на 5% площади крыши — текущий ремонт по СН РК 3.02-01.
                Финансируется из ежемесячных платежей жильцов на эксплуатацию (КСК/
                управляющая компания). Размер платежа: 20-50 тг/м² жилой площади
                в месяц на эксплуатационные нужды (включая текущий ремонт).
                <br /><br />
                Фонд капремонта используется только для масштабных работ
                (замена всей крыши, лифтов, фасада, инж. сетей). Размер взноса в фонд
                капремонта: 30-100 тг/м² жилой площади/мес (по решению собственников).
                В МКД 5000 м² при тарифе 50 тг = 250 тыс. тг/мес = 3 млн тг/год
                накопление. Через 10 лет — 30 млн тг хватит на капремонт.
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Бюджет текущего ремонта
            </div>
            <div className="text-slate-200 mb-4">
              МКД площадью <strong>1 500 м²</strong> (общая, включая подъезды). Ежегодный
              средний бюджет текущего ремонта — <strong>8 тыс. тг/м²</strong> (для
              эконом-сегмента). Какой годовой бюджет в тенге?
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Бюджет, тг</span>
              <input value={ex3} onChange={(e) => setEx3(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="12000000" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex3Sol ? "Скрыть решение" : "Показать решение"}</button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 12 млн тг</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-teal-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Бюджет = S × Цена/м²
       = 1 500 × 8 000
       = 12 000 000 тг/год

Структура текущего ремонта МКД 1500 м²:
• Косметический подъездов: 30% = 3.6 млн тг
• Сантехнические мелкие: 15% = 1.8 млн тг
• Электр. работы: 12% = 1.4 млн тг
• Ремонт кровли (точечный): 18% = 2.2 млн тг
• Замена ламп/светильников: 5% = 0.6 млн тг
• Работы по подвалу: 10% = 1.2 млн тг
• Прочие (благоустр., детская): 10% = 1.2 млн тг

Сравнение с капремонтом:
• Капремонт МКД 1500 м² раз в 20 лет: 80-150 тыс. тг/м²
  = 120-225 млн тг
• Накопление за 20 лет в фонде капремонта по 50 тг/м²/мес:
  1500 × 50 × 12 × 20 = 18 млн тг — НЕ ХВАТИТ!

Реалистичный взнос для накопления 150 млн тг за 20 лет:
150 млн / (1500 × 12 × 20) = 417 тг/м²/мес — слишком много
для большинства МКД. Поэтому в РК капремонт частично
субсидируется государством (программы акиматов 30-50% покрытия).`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Налоговый учёт
            </div>
            <div className="text-slate-200 mb-4">
              ТОО владеет производственным зданием стоимостью <strong>500 млн тг</strong>.
              В отчётном году провели:
              <ul className="list-disc list-inside mt-2 text-sm space-y-1">
                <li>Покраску фасада — <strong>3 млн тг</strong></li>
                <li>Замену кровли полностью — <strong>40 млн тг</strong></li>
                <li>Замену светильников (10% от всех) — <strong>500 тыс. тг</strong></li>
              </ul>
              <p className="mt-2">Как правильно отразить в налоговом учёте?</p>
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Всё списать в расходы периода (43.5 млн тг)" },
                { v: "b", t: "Всё капитализировать (увеличить ОС на 43.5 млн тг)" },
                { v: "c", t: "По половине каждого" },
                { v: "d", t: "Покраска (3 млн) + светильники (0.5 млн) — в расходы периода как текущий ремонт = 3.5 млн уменьшат КПН. Замена кровли (40 млн) — капитализировать как улучшение ОС, амортизация ~ 1 млн тг/год (40 лет срок здания)" },
              ].map((opt) => (
                <label key={opt.v} className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${ex4 === opt.v ? "border-teal-600 bg-teal-950/30" : "border-slate-800 hover:border-slate-700"}`}>
                  <input type="radio" name="ex4" value={opt.v} checked={ex4 === opt.v} onChange={() => setEx4(opt.v)} className="accent-teal-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex4Sol ? "Скрыть решение" : "Показать решение"}</button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — раздельный учёт</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-teal-300">Решение:</strong> В налоговом учёте РК
                (НК РК ст. 100 + ст. 122) ремонт классифицируется отдельно для каждой
                работы:
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`ТЕКУЩИЙ РЕМОНТ (расходы периода):
• Покраска фасада: 3 000 000 тг — Дт 7212 Кт 1310
• Замена светильников 10%: 500 000 тг — Дт 7212 Кт 1310
─────────────────────────────────────────────────────
ИТОГО в расходы периода: 3 500 000 тг
Снижение КПН: 3 500 000 × 20% = 700 000 тг

КАПИТАЛЬНЫЙ РЕМОНТ (капитализация):
• Замена кровли полностью: 40 000 000 тг — Дт 2410 Кт 1310
─────────────────────────────────────────────────────
Новая стоимость ОС: 500 + 40 = 540 млн тг
Амортизация в год (по НК РК ст. 90 для зданий, 2.5%):
540 × 2.5% = 13.5 млн тг/год (вместо 12.5 млн тг до)
Дополнительная амортизация: 1 млн тг/год
Снижение КПН в год: 1 млн × 20% = 200 тыс. тг/год
За 40 лет: 200 × 40 = 8 млн тг (общая выгода налоговая)

ВЫВОД: текущий ремонт даёт мгновенный налоговый эффект.
Капремонт «размазан» на годы. Поэтому компании иногда
оформляют масштабные работы как текущий — что
неправомерно и грозит штрафами при проверке НК.

Налоговая проверка может переквалифицировать неверно
оформленный ремонт с доначислением КПН + пени + штрафы.`}
                </pre>
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          СН РК 3.02-01 (Эксплуатация и ремонт зданий и сооружений). ПП РК № 1162
          (О капитальном ремонте). НК РК ст. 90 (Амортизация), ст. 100 (Расходы),
          ст. 122 (Улучшения ОС). Приказ Минстроя РК № 200 (О текущем ремонте).
          ГК РК ст. 723 (Гарантия работ).
        </div>
      </main>
    </div>
  );
}
