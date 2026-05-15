"use client";

import Link from "next/link";
import { useState } from "react";

export default function MkdKapremontPage() {
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
    // 5000 м² × 50 тг/м² × 12 мес × 20 лет = 60 000 000 тг = 60 млн тг
    const v = parseFloat(ex2);
    if (!isFinite(v)) return setEx2Res("bad");
    setEx2Res(Math.abs(v - 60) <= 2 ? "ok" : "bad");
  };
  const checkEx3 = () => setEx3Res(ex3 === "b" ? "ok" : "bad");
  const checkEx4 = () => setEx4Res(ex4 === "d" ? "ok" : "bad");

  const works = [
    {
      name: "Кровля (плоская или скатная)",
      what: "Полная замена покрытия + утеплитель + парогидроизоляция + воронки/водостоки",
      cost: "15-35 тыс. тг/м² кровли",
      lifecycle: "Замена раз в 20-30 лет (зависит от материала)",
      example: "5000 м² кровли × 25 000 тг = 125 млн тг",
    },
    {
      name: "Фасад (СФТК — мокрый или НВФ)",
      what: "Очистка/демонтаж старого + утеплитель 100-150 мм + штукатурка/панели + покраска",
      cost: "12-25 тыс. тг/м² (СФТК), 18-35 (НВФ алюминий)",
      lifecycle: "Раз в 25-40 лет",
      example: "3000 м² фасада × 18 000 тг = 54 млн тг",
    },
    {
      name: "Лифты (полная замена)",
      what: "Демонтаж старых + установка новых с частотным регулированием",
      cost: "12-25 млн тг/лифт (зависит от грузоподъёмности)",
      lifecycle: "Раз в 25 лет (по техническому регламенту лифтов)",
      example: "4 лифта × 18 млн тг = 72 млн тг на МКД 100 квартир",
    },
    {
      name: "Окна и двери в подъездах",
      what: "Замена деревянных/металлич. на ПВХ + утеплённые входные двери с домофоном",
      cost: "120-200 тыс. тг/окно, 200-400 тыс. тг/входная дверь",
      lifecycle: "Раз в 20-30 лет",
      example: "30 окон × 150 тыс. + 4 двери × 300 тыс. = 5.7 млн тг",
    },
    {
      name: "Инж. сети — отопление (стояки + радиаторы)",
      what: "Замена стояков и разводки + новые радиаторы + ИТП",
      cost: "15-30 тыс. тг/м² отапл. площади",
      lifecycle: "Раз в 25-30 лет",
      example: "5000 м² × 20 000 тг = 100 млн тг",
    },
    {
      name: "Инж. сети — водоснабжение и канализация",
      what: "Замена стояков + горизонтальная разводка по квартирам + врезка в этажные краны",
      cost: "8-15 тыс. тг/м² (ВК), 6-12 тыс. тг/м² (К)",
      lifecycle: "Раз в 25-30 лет",
      example: "5000 м² × 12 000 тг = 60 млн тг (только ВК)",
    },
    {
      name: "Инж. сети — электр. и слаботочка",
      what: "Новые щитовые + проводка стояков + общедомовая система противопожарной",
      cost: "5-10 тыс. тг/м²",
      lifecycle: "Раз в 30-40 лет",
      example: "5000 м² × 7 000 тг = 35 млн тг",
    },
    {
      name: "Подвалы и тех. этажи",
      what: "Гидроизоляция, замена коммуникаций, освещение, проветривание",
      cost: "8-20 тыс. тг/м² подвала",
      lifecycle: "Раз в 20-30 лет",
      example: "500 м² подвала × 12 000 тг = 6 млн тг",
    },
    {
      name: "Балконы и лоджии",
      what: "Замена/усиление плиты, новые ограждения, остекление, отделка",
      cost: "200-500 тыс. тг/балкон",
      lifecycle: "Раз в 25-30 лет",
      example: "100 балконов × 300 тыс. = 30 млн тг",
    },
    {
      name: "Подъезды (косметика)",
      what: "Покраска стен, замена полов и ламп, ремонт мусоропроводов",
      cost: "30-80 тыс. тг/м² подъезда",
      lifecycle: "Раз в 10-15 лет (это уже текущий ремонт по объёму)",
      example: "200 м² подъездов × 50 000 тг = 10 млн тг",
    },
  ];

  const fund_structure = [
    { what: "Капремонт кровли", periodicity: "20-30 лет", priority: "Высокий (предотвращает протечки)" },
    { what: "Замена лифтов", periodicity: "25 лет", priority: "Очень высокий (безопасность)" },
    { what: "Капремонт инж. сетей (ВК/ОВ)", periodicity: "25-30 лет", priority: "Высокий (потери воды/тепла)" },
    { what: "Утепление фасада", periodicity: "25-40 лет", priority: "Средний (энергоэф.)" },
    { what: "Капремонт балконов", periodicity: "25-30 лет", priority: "Средний (но безопасность!)" },
    { what: "Замена окон в подъездах", periodicity: "20-30 лет", priority: "Средний" },
    { what: "Капремонт подвала", periodicity: "20-30 лет", priority: "Средний" },
    { what: "Электр. и слаботочка", periodicity: "30-40 лет", priority: "Низкий (пока работает)" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Капремонт МКД</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🏢 Капитальный ремонт МКД
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            <strong className="text-amber-300">Капремонт многоквартирных домов</strong>
            (МКД) — массовый сегмент в РК. Дома советского периода (1960-1990-х) массово
            достигают возраста 30-50 лет — критический возраст для капремонта. Государство
            запустило программы поддержки. Регулируется ПП РК № 1162 «О капитальном
            ремонте», Жилищным кодексом РК, ПП РК «О Жилстройсбербанке»,
            СН РК 3.02-01. В РК ~ 100 000 МКД требуют капремонта в ближайшие 10 лет.
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">МКД в РК</div>
              <div className="text-slate-300">~ 100 000 нуждаются в капремонте</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Полный капремонт</div>
              <div className="text-slate-300">80-150 тыс. тг/м² жилой площади</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Госфинансирование</div>
              <div className="text-slate-300">30-50% субсидия (программа акимата)</div>
            </div>
          </div>
        </section>

        {/* Section 1: 10 видов работ */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🔨 Section 1. Десять видов работ в капремонте МКД
          </h2>
          <div className="space-y-3">
            {works.map((w) => (
              <div key={w.name} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
                <h3 className="text-base font-semibold text-amber-300 mb-2">{w.name}</h3>
                <dl className="text-sm space-y-1">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Состав</dt>
                    <dd className="text-slate-300 text-xs">{w.what}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Стоимость</dt>
                    <dd className="text-emerald-300 text-xs">{w.cost}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Срок жизни</dt>
                    <dd className="text-amber-300 text-xs">{w.lifecycle}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Пример расчёта</dt>
                    <dd className="text-slate-400 text-xs italic">{w.example}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Приоритеты фонда */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            ⏰ Section 2. Приоритеты работ из фонда капремонта
          </h2>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Вид работ</th>
                  <th className="text-left px-4 py-3 w-32">Периодичность</th>
                  <th className="text-left px-4 py-3">Приоритет</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {fund_structure.map((f) => (
                  <tr key={f.what} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 text-slate-100 text-xs">{f.what}</td>
                    <td className="px-4 py-3 text-amber-300 text-xs">{f.periodicity}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{f.priority}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Финансирование */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            💰 Section 3. Финансирование капремонта МКД
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-amber-800/40 bg-amber-950/20 rounded-xl p-4">
              <h3 className="text-base font-semibold text-amber-300 mb-2">Фонд капремонта собственников</h3>
              <p className="text-sm text-slate-300">Ежемесячные взносы от собственников квартир. Тариф устанавливается общим собранием — обычно 30-100 тг/м² жилой/мес. Накапливается на спецсчёте, не может тратиться на текущий ремонт.</p>
            </div>
            <div className="border border-amber-800/40 bg-amber-950/20 rounded-xl p-4">
              <h3 className="text-base font-semibold text-amber-300 mb-2">Программа акимата (субсидия)</h3>
              <p className="text-sm text-slate-300">До 30-50% стоимости капремонта может субсидироваться местным бюджетом. Очерёдность определяется списком акимата (по возрасту дома, износу, готовности собственников).</p>
            </div>
            <div className="border border-amber-800/40 bg-amber-950/20 rounded-xl p-4">
              <h3 className="text-base font-semibold text-amber-300 mb-2">Кредит Жилстройсбербанка</h3>
              <p className="text-sm text-slate-300">Целевые кредиты на капремонт МКД под 5-8% годовых на 5-15 лет. Под гарантии акимата или КСК. Финансирование начинается до полного накопления в фонде.</p>
            </div>
            <div className="border border-amber-800/40 bg-amber-950/20 rounded-xl p-4">
              <h3 className="text-base font-semibold text-amber-300 mb-2">Программа «Нурлы Жер»</h3>
              <p className="text-sm text-slate-300">Гос. программа жилищного строительства, расширенная на капремонт МКД 2025+. Льготные условия для соц. категорий (многодетные, инвалиды, пожилые).</p>
            </div>
            <div className="border border-amber-800/40 bg-amber-950/20 rounded-xl p-4">
              <h3 className="text-base font-semibold text-amber-300 mb-2">Целевое финансирование на лифты</h3>
              <p className="text-sm text-slate-300">Замена лифтов — отдельная программа. Лифты являются критически важной системой, государство финансирует до 70% стоимости замены просроченных лифтов.</p>
            </div>
            <div className="border border-amber-800/40 bg-amber-950/20 rounded-xl p-4">
              <h3 className="text-base font-semibold text-amber-300 mb-2">Программа энергоэффективности</h3>
              <p className="text-sm text-slate-300">ЕБРР + KazEnergy финансируют утепление фасадов и ИТП. Возвратность за счёт экономии тепла. Эконом эффект 25-40%.</p>
            </div>
          </div>
        </section>

        {/* Section 4: Этапы реализации */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🪜 Section 4. Этапы организации капремонта МКД
          </h2>
          <div className="border border-amber-800/60 bg-amber-950/30 rounded-xl p-5 text-sm space-y-3">
            <ol className="list-decimal list-inside space-y-2 text-slate-300 text-xs">
              <li><strong>Решение собственников</strong> (общее собрание КСК / ОСМД) — не менее 2/3 голосов «за» по Жилищному кодексу РК</li>
              <li><strong>Техническое обследование МКД</strong> — независимая комиссия определяет необходимый объём (50-300 тыс. тг услуга)</li>
              <li><strong>Проект капремонта</strong> — проектная организация разрабатывает рабочую документацию (3-10 млн тг для МКД 100 квартир)</li>
              <li><strong>ГосЭкспертиза</strong> — для бюджетных и значительных капремонтов (1-3 млн тг)</li>
              <li><strong>Финансирование</strong> — комбинация: фонд + субсидия + кредит. Утверждается источниками</li>
              <li><strong>Тендер на подрядчика</strong> — через КСК или акимат (для гос. субсидии — обязательно по ЗРК «О госзакупках»)</li>
              <li><strong>Заключение договора</strong> — с пошаговой оплатой (аванс 20-30%, КС-2 ежемесячно, удержание 5-10% до гарантии)</li>
              <li><strong>СМР с проживанием</strong> — работы ведутся часто без выселения. Уведомление жильцов 14 дней до начала</li>
              <li><strong>Тех. надзор</strong> — назначается КСК или акиматом (2-3% от ССМР)</li>
              <li><strong>Сдача в эксплуатацию</strong> — комиссия КСК + МИО + подрядчик + проектировщик</li>
              <li><strong>Гарантийный период 2-5 лет</strong> — устранение дефектов за счёт подрядчика</li>
            </ol>
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Section 5. Упражнения</h2>

          {/* Упр.1 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Приоритет работ
            </div>
            <div className="text-slate-200 mb-4">
              В МКД 1985 г. постройки (40 лет) первый раз проводят капремонт. Бюджет
              ограничен. Что нужно сделать <strong>в первую очередь</strong>?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Косметика подъездов (видно жителям)" },
                { v: "b", t: "Покраска фасада" },
                { v: "c", t: "Лифты (если просрочены) + Кровля (если протекает) + Стояки ВК (если ржавые) — это критические системы безопасности и предотвращения дальнейшего разрушения" },
                { v: "d", t: "Замена лампочек в подъездах" },
              ].map((opt) => (
                <label key={opt.v} className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${ex1 === opt.v ? "border-amber-600 bg-amber-950/30" : "border-slate-800 hover:border-slate-700"}`}>
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-amber-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex1Sol ? "Скрыть решение" : "Показать решение"}</button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — критические системы</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-amber-300">Решение:</strong> При ограниченном
                бюджете капремонт делается по приоритетам:
                <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
                  <li><strong>Безопасность людей</strong> — лифты (просроченные могут
                  упасть), балконы (могут обрушиться), несущие конструкции</li>
                  <li><strong>Защита здания от разрушения</strong> — кровля (протечки
                  ведут к плесени, разрушению перекрытий), фундамент</li>
                  <li><strong>Жизнеобеспечение</strong> — стояки ВК (ржавые могут
                  затопить весь дом), отопление (без него зимой невозможно жить)</li>
                  <li><strong>Энергоэффективность</strong> — фасад, окна (экономит
                  деньги на годы)</li>
                  <li><strong>Эстетика и комфорт</strong> — подъезды, лампы (последнее)</li>
                </ol>
                Косметика подъездов и покраска фасада могут подождать. А вот
                просроченный лифт = риск жизни. Протекающая кровля = разрушение
                перекрытий 5-7 этажа через 2-3 года. Ржавые стояки = риск массового
                затопления.
                <br /><br />
                Расстановка приоритетов — главная задача КСК и проектировщика на
                стадии техобследования. Сметчик помогает разнести бюджет по
                категориям приоритета.
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Накопление в фонде
            </div>
            <div className="text-slate-200 mb-4">
              МКД площадью <strong>5 000 м²</strong> (жилой). Тариф взноса в фонд
              капремонта — <strong>50 тг/м²/мес</strong>. За сколько лет накопится
              <strong>60 млн тг</strong> для капремонта? Введите в МЛН тг (что накопится
              за 20 лет).
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Накопления за 20 лет, млн тг</span>
              <input value={ex2} onChange={(e) => setEx2(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="60" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex2Sol ? "Скрыть решение" : "Показать решение"}</button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 60 млн тг</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-amber-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Накопления_20_лет = S × Тариф × 12 мес × 20 лет
                  = 5 000 × 50 × 12 × 20
                  = 60 000 000 тг = 60 млн тг

ВЫВОД: за 20 лет накопится 60 млн тг.

Бюджет полного капремонта МКД 5000 м²:
• Капремонт минимум (только кровля + стояки): 50-80 млн тг
• Капремонт средний (+ лифты, балконы): 200-300 млн тг
• Капремонт полный (+ фасад, окна, всё): 400-700 млн тг

60 млн тг хватит ТОЛЬКО на минимум! Поэтому в РК капремонт
финансируется:
• Из фонда: 30-50%
• Госсубсидия (акимат): 30-50%
• Кредит Жилстройсбербанк: 20-30%
• Дополнительный взнос собственников (по решению собр.): 10-15%

Для накопления 200 млн тг за 20 лет тариф должен быть:
Тариф = 200 000 000 / (5 000 × 12 × 20) = 167 тг/м²/мес

Это в 3+ раза выше типового 50 тг. Большинство КСК не
устанавливают такие тарифы из-за протестов жильцов. Поэтому
капремонт через 20-30 лет всегда требует госпомощи или
кредита Жилстройсбербанка.

В Алматы и Астане тарифы постепенно повышаются —
с 30-50 тг (2020) до 70-100 тг (2025). Тренд — рост.`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Согласие собственников
            </div>
            <div className="text-slate-200 mb-4">
              По Жилищному кодексу РК для начала капремонта МКД нужно согласие
              <strong> сколько процентов</strong> собственников квартир (от общего числа
              голосов на собрании)?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "50% + 1 голос — простое большинство" },
                { v: "b", t: "2/3 (67%) — квалифицированное большинство по Жилищному кодексу РК ст. 31" },
                { v: "c", t: "75% — три четверти" },
                { v: "d", t: "100% — единогласно" },
              ].map((opt) => (
                <label key={opt.v} className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${ex3 === opt.v ? "border-amber-600 bg-amber-950/30" : "border-slate-800 hover:border-slate-700"}`}>
                  <input type="radio" name="ex3" value={opt.v} checked={ex3 === opt.v} onChange={() => setEx3(opt.v)} className="accent-amber-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex3Sol ? "Скрыть решение" : "Показать решение"}</button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 2/3 голосов</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-amber-300">Решение:</strong> По Жилищному
                кодексу РК (ст. 31, 42) для проведения капитального ремонта МКД
                требуется согласие не менее <strong>2/3 (67%)</strong> от общего
                количества голосов собственников на общем собрании.
                <br /><br />
                Голоса считаются пропорционально площади квартиры. То есть:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Квартира 30 м² = 30 голосов</li>
                  <li>Квартира 80 м² = 80 голосов</li>
                  <li>Квартира 150 м² = 150 голосов</li>
                </ul>
                Если в доме 100 квартир со средней площадью 60 м² = 6 000 голосов.
                Нужно собрать минимум 4 000 голосов «за». Это значит, что владельцы
                крупных квартир имеют больше веса в голосовании.
                <br /><br />
                Сложности:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Если 30% жильцов категорически против — капремонт не пройдёт</li>
                  <li>«Тихое большинство» часто не приходит на собрание — нужно
                  агитировать каждого</li>
                  <li>Малоимущие/пожилые часто против из-за роста квартплаты</li>
                  <li>Сдающие в аренду — против (расходы их, доходы тоже их)</li>
                </ul>
                Поэтому акиматы РК запустили программу «Капремонт МКД» с
                субсидированием — это снижает финансовое бремя на собственников
                и облегчает достижение 2/3 согласия.
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Капремонт без выселения
            </div>
            <div className="text-slate-200 mb-4">
              При капремонте МКД (стояки + фасад + лифты) жильцы продолжают жить в
              квартирах. Какие <strong>главные особенности</strong> такой схемы для
              сметы и графика работ?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Никаких — обычный капремонт" },
                { v: "b", t: "Только удлинение сроков на 50%" },
                { v: "c", t: "Только повышение цены на 5-10%" },
                { v: "d", t: "Комплекс: 1) Коэф. МДС К=1.25 за работы в зоне эксплуатации, 2) График по этажам/подъездам (не сразу весь дом), 3) Шумные работы 9-18, не в выходные, 4) Временные системы отопл./ВК на время работ, 5) Уборка строит. мусора ежедневно, 6) Доп. охрана подъездов (вход рабочих по списку), 7) Резерв на скрытые дефекты 15-20% (vs 10% при свободном доступе)" },
              ].map((opt) => (
                <label key={opt.v} className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${ex4 === opt.v ? "border-amber-600 bg-amber-950/30" : "border-slate-800 hover:border-slate-700"}`}>
                  <input type="radio" name="ex4" value={opt.v} checked={ex4 === opt.v} onChange={() => setEx4(opt.v)} className="accent-amber-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex4Sol ? "Скрыть решение" : "Показать решение"}</button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — комплекс особенностей</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-amber-300">Решение:</strong> Капремонт МКД
                с проживанием жильцов — самый сложный вид капитальных работ.
                Требует тщательного планирования сметчиком и менеджером проекта.
                <br /><br />
                Бюджетные надбавки:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>К_МДС = 1.25 (работы в зоне эксплуатации, СН РК 3.02-01)
                  = +25% к ОТ и эксплуат. машин</li>
                  <li>Удлинение сроков в 1.5-2 раза vs пустого здания</li>
                  <li>Доп. расходы: временные системы (отопление на лифт. шахту,
                  переносные туалеты для рабочих) — 5-8% от ССМР</li>
                  <li>Уборка ежедневно + охрана (вход рабочих по списку): 2-3%</li>
                  <li>Страхование от ущерба третьим лицам: 0.5-1.5% (затопление,
                  падение материалов на машины во дворе)</li>
                </ul>
                График работ:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>По одному подъезду/этажу за раз</li>
                  <li>Шумные работы только 9:00-18:00 (по СанПину)</li>
                  <li>Не в выходные и праздники</li>
                  <li>Не во время сна (с 22:00 до 7:00)</li>
                  <li>Уведомление жильцов 14 дней до начала каждой стадии</li>
                </ul>
                Резерв сметчика — 15-20% (vs 10% при пустом здании) из-за высокой
                вероятности дополнительных работ и задержек.
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          ПП РК № 1162 (О капитальном ремонте). Жилищный кодекс РК. ПП РК
          «О Жилстройсбербанке». СН РК 3.02-01. Программы «Нурлы Жер»,
          «Капремонт МКД». Жилстройсбербанк — hcsbk.kz.
        </div>
      </main>
    </div>
  );
}
