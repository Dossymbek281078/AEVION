"use client";

import Link from "next/link";
import { useState } from "react";

export default function ConstructionWarrantyPage() {
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

  const checkEx1 = () => setEx1Res(ex1 === "b" ? "ok" : "bad");
  const checkEx2 = () => setEx2Res(ex2 === "c" ? "ok" : "bad");
  const checkEx3 = () => {
    // 500 млн × 10% = 50 млн удержание, возврат 50/50: 25 млн после ввода + 25 млн после 24 мес.
    const v = parseFloat(ex3);
    if (!isFinite(v)) return setEx3Res("bad");
    setEx3Res(Math.abs(v - 25_000_000) <= 500_000 ? "ok" : "bad");
  };
  const checkEx4 = () => setEx4Res(ex4 === "d" ? "ok" : "bad");

  const periods = [
    {
      type: "Общий гарантийный срок",
      duration: "2 года",
      base: "ГК РК ст. 723.3 (по умолчанию)",
      what: "Любые дефекты при нормальной эксплуатации",
      who: "Подрядчик устраняет за свой счёт",
      example: "Протечки кровли, отслоение плитки, неработающая розетка",
    },
    {
      type: "Скрытые недостатки",
      duration: "5 лет",
      base: "ГК РК ст. 723.5",
      what: "Дефекты, которые невозможно было обнаружить при приёмке",
      who: "Подрядчик при доказательстве причинной связи",
      example: "Трещина из-за неверной осадки, скрытая коррозия арматуры",
    },
    {
      type: "Несущие конструкции",
      duration: "10 лет",
      base: "ГК РК ст. 723 + договор (договор. срок)",
      what: "Серьёзные дефекты несущего каркаса",
      who: "Подрядчик + проектировщик солидарно",
      example: "Просадка фундамента, деформация перекрытий, наклон стен",
    },
    {
      type: "Договорный — расширенный",
      duration: "5-10 лет",
      base: "Договор подряда (по соглашению сторон)",
      what: "Расширенная гарантия по соглашению",
      who: "Подрядчик в рамках договора",
      example: "Для премиум-объектов, FIDIC-контрактов — часто 5 лет на всё",
    },
    {
      type: "FIDIC — Defects Notification Period (DNP)",
      duration: "12 месяцев (стандарт) / 24-36 (premium)",
      base: "FIDIC Sub-Clause 11",
      what: "Период уведомления о дефектах, после которого выдаётся Performance Certificate",
      who: "Подрядчик до DLP-окончания",
      example: "Стандартный FIDIC Red/Yellow Book — 365 дней",
    },
    {
      type: "Производитель материалов",
      duration: "От 1 до 50 лет (по сертификату)",
      base: "Сертификат + закон РК «О защите прав потребителей»",
      what: "Дефекты конкретного материала (фасадная плитка, окна, оборудование)",
      who: "Производитель / поставщик",
      example: "Knauf — 10 лет на ГКЛ, Schüco — 10 лет на окна, AEG — 5 лет на электрику",
    },
  ];

  const defects = [
    { type: "Видимые при приёмке", what: "Видны невооружённым глазом", deadline: "Фиксируются в Акте приёмки, устранение в указанный там срок (обычно 30 дней)", example: "Сколы плитки, царапины окон, неработающие розетки" },
    { type: "Явные эксплуатационные", what: "Появились в процессе нормальной эксплуатации", deadline: "В течение 2-летнего гарантийного срока", example: "Трещины в штукатурке, отслоение покраски, протечка крана" },
    { type: "Скрытые", what: "Не могли быть обнаружены при приёмке", deadline: "5 лет с момента передачи объекта (ст. 723.5)", example: "Коррозия арматуры внутри бетона, скрытая течь канализации, осадка фундамента" },
    { type: "Конструктивные", what: "Несущие элементы (фундамент, каркас, кровля)", deadline: "10 лет (часто прописывается в договоре)", example: "Просадка ленточного фундамента из-за неверного расчёта" },
    { type: "Технологические", what: "Возникающие из-за нарушения технологии работ", deadline: "5 лет как скрытые (если не выявлены сразу)", example: "Высолы на кирпичной кладке от нарушения замесов раствора" },
  ];

  const journal = [
    { col: "№ дефекта", what: "Уникальный номер для отслеживания" },
    { col: "Дата выявления", what: "Когда заметили / зафиксировали" },
    { col: "Локация", what: "Этаж, секция, помещение, точная привязка" },
    { col: "Описание дефекта", what: "Что именно произошло + фотофиксация" },
    { col: "Категория", what: "Скрытый / явный / конструктивный / эстетический" },
    { col: "Причина (предв.)", what: "Версия комиссии или экспертизы" },
    { col: "Ответственный", what: "Подрядчик / Субподрядчик / Производитель материала" },
    { col: "Срок устранения", what: "Согласован с подрядчиком (обычно 30-90 дней)" },
    { col: "Статус", what: "Открыт / Принят / Устранён / Спорный" },
    { col: "Стоимость", what: "Затраты на устранение (для регрессного иска)" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Гарантийное обслуживание</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🛠 Гарантийное обслуживание объекта
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            Стройка не заканчивается актом ввода — начинается <strong className="text-blue-300">
            гарантийный период</strong>, длиной от 2 до 10 лет. Подрядчик отвечает за все
            недостатки, возникшие из-за его работ. Гарантийное обслуживание — это отдельный
            бизнес-процесс: журнал дефектов, журнал устранения, удержания 5-10%, регрессы к
            субподрядчикам и производителям материалов. Регулируется ГК РК ст. 723 (Качество
            работ и сроки обнаружения недостатков).
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Норматив</div>
              <div className="text-slate-300">ГК РК ст. 723 + договор</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Базовый срок</div>
              <div className="text-slate-300">2 года (общий) / 5 лет (скрытые) / 10 лет (несущие)</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Гарант. удержание</div>
              <div className="text-slate-300">5-10% до окончания гарантии</div>
            </div>
          </div>
        </section>

        {/* Section 1: Периоды */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            ⏰ Section 1. Шесть видов гарантийных сроков
          </h2>
          <div className="space-y-3">
            {periods.map((p) => (
              <div key={p.type} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
                <div className="flex items-baseline justify-between gap-4 mb-2">
                  <h3 className="text-base font-semibold text-blue-300">{p.type}</h3>
                  <span className="text-xs text-amber-300 font-mono italic shrink-0">{p.duration}</span>
                </div>
                <dl className="text-sm grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Основание</dt>
                    <dd className="text-slate-400 text-xs">{p.base}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Что покрывает</dt>
                    <dd className="text-slate-300 text-xs">{p.what}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Кто исполняет</dt>
                    <dd className="text-slate-300 text-xs">{p.who}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Пример</dt>
                    <dd className="text-slate-400 text-xs italic">{p.example}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Типы дефектов */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🔍 Section 2. Классификация дефектов
          </h2>
          <div className="space-y-3">
            {defects.map((d) => (
              <div key={d.type} className="border border-blue-900/40 bg-blue-950/20 rounded-xl p-4">
                <h3 className="text-base font-semibold text-blue-300 mb-2">{d.type}</h3>
                <dl className="text-sm space-y-1.5">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Что это</dt>
                    <dd className="text-slate-300 text-xs">{d.what}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Срок предъявления</dt>
                    <dd className="text-amber-300 text-xs">{d.deadline}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Пример</dt>
                    <dd className="text-slate-400 text-xs italic">{d.example}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Журнал дефектов */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📓 Section 3. Журнал дефектов и устранения
          </h2>
          <p className="text-slate-400 text-sm max-w-4xl">
            Главный документ гарантийного периода — журнал, в котором фиксируется каждое
            обращение Заказчика, описание дефекта, причина, ответственный, срок и статус
            устранения. Ведётся службой эксплуатации или Заказчиком.
          </p>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-44">Колонка</th>
                  <th className="text-left px-4 py-3">Что хранит</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {journal.map((j) => (
                  <tr key={j.col} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 font-mono text-blue-300">{j.col}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{j.what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 4: Регрессы */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🔄 Section 4. Регрессы к субподрядчикам и производителям
          </h2>
          <div className="border border-blue-800/60 bg-blue-950/30 rounded-xl p-5">
            <h3 className="text-blue-300 font-semibold mb-3">Цепочка регрессов</h3>
            <pre className="text-xs whitespace-pre-wrap font-mono text-slate-300 bg-slate-950 p-3 rounded border border-slate-800">
{`Заказчик (предъявил претензию)
   ↓ (по ГК РК ст. 660.1 — ответственность ГП)
Генеральный подрядчик (устранил дефект за свой счёт)
   ↓ (регрессный иск, срок исковой давности 3 года)
Субподрядчик-кровельщик (виновник дефекта)
   ↓ (регрессный иск к производителю при браке материала)
Производитель кровельного материала (Tegola, Onduline)

Этапы регресса для ГП:
1. Получить претензию Заказчика, устранить дефект
2. Зафиксировать все затраты (документально):
   • Материалы (СФ + накладные)
   • Работа (табели + ОТ + ОТМ)
   • Техника (путевые листы + ГСМ)
   • Накладные (% от прямых)
3. Направить претензию субподрядчику с пакетом документов
4. 30 дней досудебного порядка
5. Иск в СМЭС — взыскание суммы устранения + морального
   вреда (если есть)
6. После выигрыша — исп. лист → ЧСИ → списание с р/с суба`}
            </pre>
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Section 5. Упражнения</h2>

          {/* Упр.1 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Гарантийный срок по умолчанию
            </div>
            <div className="text-slate-200 mb-4">
              В договоре подряда не указан гарантийный срок. Через 18 месяцев после ввода
              на стенах появились трещины (явный дефект кладки). Какой гарантийный срок
              применяется по ГК РК?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "1 год — стандарт по умолчанию" },
                { v: "b", t: "2 года (ГК РК ст. 723.3) — основной срок для подряда" },
                { v: "c", t: "5 лет для всех дефектов" },
                { v: "d", t: "Гарантия отсутствует, если не указано в договоре" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1 === opt.v ? "border-blue-600 bg-blue-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-blue-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex1Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 2 года</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-blue-300">Решение:</strong> ГК РК ст. 723.3
                устанавливает: «Если иное не предусмотрено законом или договором подряда,
                требования, связанные с недостатками работы, могут быть предъявлены в
                <strong> двухгодичный срок</strong>». Это императивная норма, действующая
                при отсутствии других условий в договоре. 18 месяцев &lt; 2 лет → дефект
                подпадает под гарантию. Подрядчик обязан устранить за свой счёт или
                компенсировать стоимость устранения. Для скрытых дефектов (ст. 723.5) —
                5-летний срок. Для несущих конструкций по сложившейся практике РК —
                10 лет (часто прописывают в договоре отдельным пунктом).
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Кто оплачивает устранение
            </div>
            <div className="text-slate-200 mb-4">
              Через 14 месяцев после ввода объекта в эксплуатацию обнаружена протечка
              кровли из-за брака гидроизоляционной плёнки. Кто оплачивает её устранение
              (новая плёнка + работа)?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Заказчик — он эксплуатирует объект" },
                { v: "b", t: "Эксплуатирующая организация" },
                { v: "c", t: "Генподрядчик устраняет за свой счёт (ст. 723 ГК РК), затем регрессирует к субу-кровельщику и/или к производителю плёнки" },
                { v: "d", t: "Страховая компания по полису КАСКО" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex2 === opt.v ? "border-blue-600 bg-blue-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex2" value={opt.v} checked={ex2 === opt.v} onChange={() => setEx2(opt.v)} className="accent-blue-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex2Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — ГП + регресс</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-blue-300">Решение:</strong> По ГК РК ст. 723 в
                течение гарантийного периода (2 года) Заказчик предъявляет претензию
                Подрядчику. Генподрядчик <strong>обязан</strong> устранить за свой счёт
                (по ст. 660.1 — отвечает за всю цепочку). Затем ГП имеет право регресса:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>К субподрядчику-кровельщику (он выполнял работы)</li>
                  <li>Или к производителю плёнки (если есть гарантия 5+ лет на материал)</li>
                  <li>Или к обоим солидарно</li>
                </ul>
                Заказчик не должен сам платить за устранение — это нарушение гарантии и
                основание для отдельного иска к Подрядчику. Эксплуатирующая организация
                фиксирует дефект и направляет претензию Заказчику или сразу Подрядчику
                (в зависимости от условий договора). Страховая КАСКО объекта применяется
                только при пожарах, кражах, стихийных бедствиях — не при гарантийных дефектах.
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Расчёт удержания
            </div>
            <div className="text-slate-200 mb-4">
              По договору с подрядчиком на <strong>500 000 000 тг</strong> предусмотрено
              гарантийное удержание <strong>10%</strong>, которое возвращается:
              50% после ввода объекта + 50% после окончания гарантийного срока
              (24 месяца). Сколько тенге будет возвращено подрядчику <strong>после
              окончания гарантии</strong> (второй транш)?
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">2-й транш, тг</span>
              <input value={ex3} onChange={(e) => setEx3(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="25000000" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 25 млн тг</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-blue-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Общее удержание = 500 000 000 × 10% = 50 000 000 тг

1-й транш (после ввода) = 50 000 000 × 50% = 25 000 000 тг
2-й транш (после гарантии) = 50 000 000 × 50% = 25 000 000 тг

2-й транш через 24 месяца после ввода: 25 000 000 тг

Альтернатива удержанию — банковская гарантия (БГ):
• Подрядчик предоставляет БГ на 50 млн тг (10% от договора)
• Удержание не делается → Подрядчик получает 100% оплат
• Стоимость БГ: 2-4% годовых от суммы = 1-2 млн тг/год
• За 2 года гарантии: ~ 3 млн тг — но Подрядчик получает
  все 500 млн авансом

Минус удержания для Подрядчика:
• Замороженные 50 млн тг в виде оборотных средств за 24 мес
• Утрата % дохода с этой суммы (если бы депозит 12% = 12 млн)
• Риск, что Заказчик найдёт «дефекты» и не вернёт

ПРАВИЛЬНАЯ ТАКТИКА — БГ вместо удержания (выгодно обеим
сторонам, но требует предварительной квалификации подрядчика
в банке).`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Регрессный срок исковой давности
            </div>
            <div className="text-slate-200 mb-4">
              ГП устранил дефект гарантийного характера за свой счёт. Хочет взыскать
              затраты с виновника-субподрядчика по регрессу. Какой срок исковой давности
              по ГК РК для регрессных требований?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "1 год" },
                { v: "b", t: "2 года" },
                { v: "c", t: "5 лет" },
                { v: "d", t: "3 года (общий срок по ст. 178 ГК РК), считается с момента когда ГП устранил дефект" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex4 === opt.v ? "border-blue-600 bg-blue-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex4" value={opt.v} checked={ex4 === opt.v} onChange={() => setEx4(opt.v)} className="accent-blue-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex4Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 3 года</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-blue-300">Решение:</strong> По ГК РК ст. 178 общий
                срок исковой давности по гражданско-правовым требованиям — <strong>3 года</strong>.
                Начало срока (ст. 180) — с момента, когда лицо узнало или должно было узнать
                о нарушении своего права. Для регрессного иска ГП к субподрядчику этот
                момент — день, когда ГП устранил дефект (заплатил субподрядчику-исполнителю
                за восстановление). С этого дня у ГП есть 3 года, чтобы подать иск.
                <br /><br />
                <strong>Практика:</strong> ГП должен:
                <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
                  <li>Сохранить все документы: СФ материалов, табели рабочих, акты выполнения</li>
                  <li>Направить претензию субу в течение 30 дней после устранения</li>
                  <li>30 дней ждать ответа (досудебный порядок)</li>
                  <li>Подать иск в СМЭС или МКАС (по арбитражной оговорке)</li>
                  <li>Привлечь экспертизу для подтверждения причинной связи дефект-субподряд</li>
                </ol>
                Часто субподрядчик пытается оспорить причинную связь — поэтому документация
                выполнения работ (АОСР, журнал работ, фото) критически важна.
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          ГК РК ст. 723 (Качество работ и сроки обнаружения недостатков), ст. 660.1
          (Ответственность ГП), ст. 178 (Срок исковой давности). FIDIC Sub-Clause 11
          (Defects Notification Period). Закон РК «О защите прав потребителей» от
          04.05.2010 № 274-IV.
        </div>
      </main>
    </div>
  );
}
