"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

interface RecognitionRow {
  method: string;
  apply: string;
  pros: string;
  cons: string;
}

interface AccountRow {
  code: string;
  name: string;
  use: string;
  example: string;
}

interface DocStage {
  step: string;
  title: string;
  doc: string;
  who: string;
  result: string;
}

const RECOGNITION_METHODS: RecognitionRow[] = [
  {
    method: "По завершению объекта (Completed Contract)",
    apply: "Только для малых объектов до 12 мес. (МСФО/СБУ-7 РК)",
    pros: "Просто, нет риска переоценки выручки",
    cons: "Прибыль скачет: один год убыток (затраты), следующий — пик выручки",
  },
  {
    method: "По мере готовности (% completion, IFRS 15)",
    apply: "Крупные объекты &gt; 12 мес.: дороги, школы, комплексы",
    pros: "Равномерная выручка по периодам, реальная картина прибыльности",
    cons: "Требует точного учёта затрат и регулярных КС-2",
  },
  {
    method: "Авансовые платежи без передачи рисков",
    apply: "Когда заказчик платит вперёд, но право собственности не перешло",
    pros: "Деньги уже на счёте, кассовый разрыв минимизирован",
    cons: "В учёте — это обязательство (62-й счёт авансы), не выручка",
  },
];

const ACCOUNTS: AccountRow[] = [
  {
    code: "8010",
    name: "Производственные затраты (основные)",
    use: "Сборный счёт всех прямых затрат на конкретный объект",
    example: "На проекте «Школа №47» в марте: 12.5 млн (материалы + ФОТ + механизмы)",
  },
  {
    code: "8011",
    name: "ФОТ производственных рабочих",
    use: "Зарплата прорабов, бригадиров, рабочих, сметчика проекта + соц.отчисления",
    example: "Сметчик объекта «Школа №47»: 350 000 тг/мес → счёт 8011, объект «Школа №47»",
  },
  {
    code: "8012",
    name: "Материалы в производстве",
    use: "Списание материалов со склада на объект (форма М-29)",
    example: "Бетон В25: 50 м³ × 32 000 тг = 1.6 млн на объект «Школа №47»",
  },
  {
    code: "8013",
    name: "Машины и механизмы",
    use: "Аренда техники, амортизация собственной, ГСМ, услуги операторов",
    example: "Кран КС-55713: 8 смен × 95 000 тг = 760 000 тг на объект «Школа №47»",
  },
  {
    code: "8014",
    name: "Накладные расходы (НР)",
    use: "Косвенные расходы строительства: охрана объекта, временные сооружения, вахта",
    example: "Бытовка + охрана + связь на объекте: 420 000 тг/мес",
  },
  {
    code: "8021",
    name: "Брак в производстве",
    use: "Списание затрат на переделку, исправление дефектов, негодного материала",
    example: "Переделка стяжки 80 м² из-за нарушения уклона: 180 000 тг",
  },
];

const DOC_FLOW: DocStage[] = [
  {
    step: "1",
    title: "Договор подряда",
    doc: "Договор + смета + график СПР",
    who: "Заказчик ↔ Подрядчик",
    result: "Открывается аналитика по объекту, заводится в 1С/Колибри отдельный код",
  },
  {
    step: "2",
    title: "ППР (проект производства работ)",
    doc: "ППР, ТК, согласование",
    who: "Технический отдел подрядчика",
    result: "Утверждены технологии, ресурсы, бюджет затрат на объект",
  },
  {
    step: "3",
    title: "Закупка материалов и подряда",
    doc: "Договоры поставки, накладные, акты субподряда",
    who: "Снабжение + бухгалтерия",
    result: "Дт 1310 (материалы) Кт 3310 (поставщик); Дт 8012 Кт 1310 при списании на объект",
  },
  {
    step: "4",
    title: "Ежемесячный КС-2 + КС-3",
    doc: "Акт КС-2, справка КС-3, счёт-фактура",
    who: "Производство + бухгалтерия",
    result: "Дт 1210 (заказчик) Кт 6010 (выручка по объекту); Дт 7010 Кт 8010 (себестоимость)",
  },
  {
    step: "5",
    title: "Завершение объекта (форма КС-11)",
    doc: "КС-11, акт ввода, гарантийные обязательства",
    who: "Заказчик + Госкомиссия",
    result: "Закрываются счета 8000 по объекту, выводится финансовый результат, начало гарантии",
  },
];

function NumericExercise({
  question,
  hint,
  answer,
  unit,
  tolerance,
  solution,
}: {
  question: string;
  hint?: string;
  answer: number;
  unit: string;
  tolerance: number;
  solution: string;
}) {
  const [val, setVal] = useState("");
  const [showSol, setShowSol] = useState(false);
  const status = useMemo(() => {
    const num = parseFloat(val.replace(/\s/g, "").replace(",", "."));
    if (!val || Number.isNaN(num)) return "idle" as const;
    const diff = Math.abs(num - answer) / answer;
    return diff <= tolerance ? ("ok" as const) : ("err" as const);
  }, [val, answer, tolerance]);

  return (
    <div className="rounded-lg border border-blue-700/40 bg-slate-900/60 p-4">
      <p className="mb-2 text-sm text-slate-200">{question}</p>
      {hint && <p className="mb-3 text-xs text-slate-400">Подсказка: {hint}</p>}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="Ваш ответ"
          className="w-40 rounded-md border border-blue-700/40 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
        />
        <span className="text-xs text-slate-400">{unit}</span>
        {status === "ok" && (
          <span className="rounded bg-emerald-700/30 px-2 py-1 text-xs text-emerald-300">
            Верно (±{Math.round(tolerance * 100)}%)
          </span>
        )}
        {status === "err" && (
          <span className="rounded bg-rose-700/30 px-2 py-1 text-xs text-rose-300">
            Неточно — попробуйте ещё
          </span>
        )}
      </div>
      <button
        onClick={() => setShowSol((s) => !s)}
        className="mt-3 text-xs text-cyan-400 hover:text-cyan-300"
      >
        {showSol ? "Скрыть решение" : "Показать решение"}
      </button>
      {showSol && (
        <div className="mt-2 rounded-md border border-cyan-800/40 bg-slate-950/70 p-3 text-xs text-cyan-200">
          {solution}
          <div className="mt-2 text-cyan-100">
            Правильный ответ: <b>{answer.toLocaleString("ru-RU")}</b> {unit}
          </div>
        </div>
      )}
    </div>
  );
}

function ChoiceExercise({
  question,
  options,
  correctIdx,
  solution,
}: {
  question: string;
  options: string[];
  correctIdx: number;
  solution: string;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [showSol, setShowSol] = useState(false);

  return (
    <div className="rounded-lg border border-blue-700/40 bg-slate-900/60 p-4">
      <p className="mb-3 text-sm text-slate-200">{question}</p>
      <div className="space-y-2">
        {options.map((opt, idx) => {
          const isPicked = picked === idx;
          const isCorrect = picked !== null && idx === correctIdx;
          const isWrong = isPicked && idx !== correctIdx;
          return (
            <button
              key={idx}
              onClick={() => setPicked(idx)}
              className={`block w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                isCorrect
                  ? "border-emerald-500 bg-emerald-700/20 text-emerald-100"
                  : isWrong
                  ? "border-rose-500 bg-rose-700/20 text-rose-100"
                  : isPicked
                  ? "border-cyan-500 bg-cyan-700/10 text-cyan-100"
                  : "border-blue-700/40 bg-slate-950 text-slate-200 hover:border-cyan-500"
              }`}
            >
              <span className="mr-2 font-mono text-xs text-slate-400">
                {String.fromCharCode(97 + idx)})
              </span>
              {opt}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <p className="mt-3 text-xs">
          {picked === correctIdx ? (
            <span className="text-emerald-300">Верно</span>
          ) : (
            <span className="text-rose-300">Неверно — попробуйте другой вариант</span>
          )}
        </p>
      )}
      <button
        onClick={() => setShowSol((s) => !s)}
        className="mt-3 text-xs text-cyan-400 hover:text-cyan-300"
      >
        {showSol ? "Скрыть решение" : "Показать решение"}
      </button>
      {showSol && (
        <div className="mt-2 rounded-md border border-cyan-800/40 bg-slate-950/70 p-3 text-xs text-cyan-200">
          {solution}
        </div>
      )}
    </div>
  );
}

export default function AccountingProjectsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-blue-900/40 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/smeta-trainer/drawings-practice"
            className="text-sm text-cyan-400 hover:text-cyan-300"
          >
            ← К разделам
          </Link>
          <span className="text-xs text-slate-500">AEVION Smeta Trainer · Бухучёт</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="mb-3 text-3xl font-bold text-cyan-300">
          📊 Бухучёт по объектам — поэтапная готовность
        </h1>
        <p className="mb-2 text-slate-300">
          Подрядчик ведёт учёт затрат и выручки по{" "}
          <b className="text-cyan-300">каждому объекту строительства отдельно</b>. Это позволяет
          корректно признавать выручку по проценту завершения работ (% completion), даже если
          объект сдаётся через 2-3 года.
        </p>
        <p className="mb-6 text-sm text-slate-400">
          Нормативы: <b>МСФО IAS 11</b> (заменён на <b>IFRS 15</b> «Выручка по договорам с
          покупателями»), <b>ПБУ 2/2008</b> (российский аналог), <b>СБУ-7 РК</b> «Учёт договоров
          подряда», <b>План счётов 8000</b> для подрядчиков (раздел «Производственные затраты»).
        </p>

        <section className="mb-10">
          <h2 className="mb-4 text-2xl font-semibold text-blue-300">
            1. Метод признания выручки
          </h2>
          <div className="overflow-x-auto rounded-lg border border-blue-800/40">
            <table className="w-full text-sm">
              <thead className="bg-blue-950/40 text-cyan-200">
                <tr>
                  <th className="px-3 py-2 text-left">Метод</th>
                  <th className="px-3 py-2 text-left">Когда применять</th>
                  <th className="px-3 py-2 text-left">Плюсы</th>
                  <th className="px-3 py-2 text-left">Минусы</th>
                </tr>
              </thead>
              <tbody>
                {RECOGNITION_METHODS.map((row, idx) => (
                  <tr
                    key={idx}
                    className="border-t border-blue-900/30 odd:bg-slate-900/40 even:bg-slate-950/40"
                  >
                    <td className="px-3 py-2 font-medium text-slate-100">{row.method}</td>
                    <td
                      className="px-3 py-2 text-slate-300"
                      dangerouslySetInnerHTML={{ __html: row.apply }}
                    />
                    <td className="px-3 py-2 text-emerald-300">{row.pros}</td>
                    <td className="px-3 py-2 text-rose-300">{row.cons}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            В РК большинство строительных подрядчиков применяют <b>% completion</b>: стоимость
            КС-2 за период / общая сметная стоимость × 100% = % готовности; выручка периода =
            % готовности × контрактная цена − ранее признанная выручка.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="mb-4 text-2xl font-semibold text-blue-300">
            2. Счета учёта затрат (раздел 8000)
          </h2>
          <div className="overflow-x-auto rounded-lg border border-blue-800/40">
            <table className="w-full text-sm">
              <thead className="bg-blue-950/40 text-cyan-200">
                <tr>
                  <th className="px-3 py-2 text-left">Счёт</th>
                  <th className="px-3 py-2 text-left">Название</th>
                  <th className="px-3 py-2 text-left">Что учитывает</th>
                  <th className="px-3 py-2 text-left">Пример</th>
                </tr>
              </thead>
              <tbody>
                {ACCOUNTS.map((row) => (
                  <tr
                    key={row.code}
                    className="border-t border-blue-900/30 odd:bg-slate-900/40 even:bg-slate-950/40"
                  >
                    <td className="px-3 py-2 font-mono text-cyan-300">{row.code}</td>
                    <td className="px-3 py-2 font-medium text-slate-100">{row.name}</td>
                    <td className="px-3 py-2 text-slate-300">{row.use}</td>
                    <td className="px-3 py-2 text-xs text-slate-400">{row.example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Все эти счета в конце месяца собираются на 8010 «Основное производство» с
            аналитикой по объекту. Затем при подписании КС-2: <span className="font-mono">Дт
            7010 Кт 8010</span> на сумму себестоимости признанных работ.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="mb-4 text-2xl font-semibold text-blue-300">
            3. Интерактивные упражнения
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <NumericExercise
              question="Объект на 50 млн тг, выполнено работ за квартал на 12 млн тг (по подписанному КС-2). На какой % готовности признаётся выручка?"
              hint="% готовности = стоимость выполненных работ / общая сметная стоимость × 100%"
              answer={24}
              unit="%"
              tolerance={0.05}
              solution="12 000 000 / 50 000 000 × 100% = 24%. Это % готовности по методу «по доле выполненных работ» (output method, IFRS 15). Альтернативно используют «input method» — по доле фактич. затрат от плановых (cost-to-cost), но он чувствителен к перерасходам."
            />
            <NumericExercise
              question="Выручка к признанию за квартал по %-методу при контракте 50 млн тг и выполнении 24% (КС-2 на 12 млн тг). Сколько тг признать в Кт 6010?"
              hint="Выручка = % готовности × контрактная цена. Если КС-2 уже на 12 млн с НДС/маржой — берём её как реализацию."
              answer={12000000}
              unit="тг"
              tolerance={0.05}
              solution="При методе % completion и наличии подписанного КС-2 на 12 млн тг — именно эта сумма признаётся выручкой за период (Дт 1210 Кт 6010 = 12 000 000). Параллельно списывается себестоимость выполненных работ с 8010 в Дт 7010. Маржа 15% уже заложена в контрактной цене 50 млн (себестоимость ≈ 42.5 млн на весь объект, прибыль ≈ 7.5 млн)."
            />
            <ChoiceExercise
              question="На какой счёт списывается ФОТ сметчика, который работает на конкретном объекте?"
              options={[
                "8010 — общие производственные затраты, без аналитики",
                "8011 — ФОТ производственных рабочих с аналитикой по объекту",
                "8014 — накладные расходы строительства",
                "7110 — расходы по реализации (АУП офиса)",
              ]}
              correctIdx={1}
              solution="Сметчик объекта — это производственный персонал по конкретному договору, его зарплата прямая (не косвенная) для этого объекта. Счёт 8011 с аналитикой «Объект: Школа №47». Если бы сметчик работал на 5 объектов одновременно — его ФОТ распределяется пропорционально (база: норматив часов или сметная стоимость)."
            />
            <ChoiceExercise
              question="Когда возникает «незавершённое производство» (НЗП) в учёте подрядчика?"
              options={[
                "В начале объекта при подписании договора",
                "В конце месяца, если есть фактич. затраты, но КС-2 за этот объём ещё не подписан",
                "Всегда, пока объект не сдан полностью (КС-11)",
                "Никогда — у подрядчиков нет НЗП, только у производственников",
              ]}
              correctIdx={1}
              solution="НЗП = сальдо счёта 8010 на конец периода = затраты понесли, но реализацию не оформили. Например: в марте уложили бетон на 5 млн, но КС-2 будет в апреле (заказчик не успел приехать на приёмку). На 31 марта на 8010 висит 5 млн — это НЗП. В балансе попадёт в строку «Запасы / незавершённое производство»."
            />
          </div>
        </section>

        <section className="mb-10">
          <h2 className="mb-4 text-2xl font-semibold text-blue-300">
            4. Документооборот объекта (5 этапов)
          </h2>
          <div className="space-y-3">
            {DOC_FLOW.map((stage) => (
              <div
                key={stage.step}
                className="flex gap-4 rounded-lg border border-blue-800/40 bg-slate-900/40 p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-700/30 font-bold text-cyan-200">
                  {stage.step}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-100">{stage.title}</h3>
                  <p className="mt-1 text-xs text-slate-400">
                    <b>Документы:</b> {stage.doc}
                  </p>
                  <p className="text-xs text-slate-400">
                    <b>Кто отвечает:</b> {stage.who}
                  </p>
                  <p className="mt-1 text-sm text-cyan-200">
                    <b>Учётный результат:</b> {stage.result}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Между этапами возможны: дополнительные соглашения (изменение цены/объёмов),
            претензии, акты скрытых работ, исполнительная документация. Каждое движение —
            отдельная проводка с привязкой к объекту.
          </p>
        </section>

        <section className="mb-10 rounded-lg border border-cyan-700/50 bg-cyan-950/20 p-5">
          <h2 className="mb-3 text-lg font-semibold text-cyan-300">
            💡 Расценки и сертифицированные программы для РК
          </h2>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>
              <b className="text-cyan-200">1С:Бухгалтерия 8 для Казахстана</b> — стандарт
              отрасли, сертифицирована Минфином РК, поддерживает СБУ и план счётов 8000 «из
              коробки». Стоимость: ~150 000 тг базовая лицензия + ~50 000 тг/мес ИТС.
              Расширения: «1С:Подрядчик строительства» (отдельная конфигурация для учёта по
              объектам, ~250 000 тг).
            </li>
            <li>
              <b className="text-cyan-200">Колибри.НЕТ</b> — казахстанская SaaS-альтернатива,
              онлайн, ~12 000-25 000 тг/мес. Поддерживает разделение по проектам/объектам,
              автоматическую сдачу ФНО 100 / 700 / 870. Минус: меньше гибкости в аналитике
              по сравнению с 1С.
            </li>
            <li>
              <b className="text-cyan-200">Сертификация обязательна</b> для бюджетных
              объектов (тендеры портал «Госзакупки»). 1С и Колибри — в реестре допущенных
              средств бухучёта при Минфине РК.
            </li>
          </ul>
        </section>

        <section className="mb-10 rounded-lg border border-blue-700/50 bg-blue-950/20 p-5">
          <h2 className="mb-3 text-lg font-semibold text-blue-300">
            🔑 Ключевые проводки для подрядчика
          </h2>
          <div className="overflow-x-auto rounded-md border border-blue-900/40 bg-slate-950/40">
            <table className="w-full text-xs">
              <thead className="bg-blue-950/60 text-cyan-200">
                <tr>
                  <th className="px-3 py-2 text-left">Хоз. операция</th>
                  <th className="px-3 py-2 text-left">Дт</th>
                  <th className="px-3 py-2 text-left">Кт</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                <tr className="border-t border-blue-900/30">
                  <td className="px-3 py-2">Поступил аванс от заказчика</td>
                  <td className="px-3 py-2 font-mono">1030 (банк)</td>
                  <td className="px-3 py-2 font-mono">3510 (авансы получ.)</td>
                </tr>
                <tr className="border-t border-blue-900/30 bg-slate-900/40">
                  <td className="px-3 py-2">Списаны материалы на объект</td>
                  <td className="px-3 py-2 font-mono">8012 (мат. в произв.)</td>
                  <td className="px-3 py-2 font-mono">1310 (склад)</td>
                </tr>
                <tr className="border-t border-blue-900/30">
                  <td className="px-3 py-2">Начислена ЗП производств. персоналу</td>
                  <td className="px-3 py-2 font-mono">8011 (ФОТ произв.)</td>
                  <td className="px-3 py-2 font-mono">3350 (расч. с персоналом)</td>
                </tr>
                <tr className="border-t border-blue-900/30 bg-slate-900/40">
                  <td className="px-3 py-2">Свод затрат периода на объект</td>
                  <td className="px-3 py-2 font-mono">8010 (осн. произв.)</td>
                  <td className="px-3 py-2 font-mono">8011, 8012, 8013, 8014</td>
                </tr>
                <tr className="border-t border-blue-900/30">
                  <td className="px-3 py-2">Подписан КС-2: признана выручка</td>
                  <td className="px-3 py-2 font-mono">1210 (расч. с заказч.)</td>
                  <td className="px-3 py-2 font-mono">6010 (выручка)</td>
                </tr>
                <tr className="border-t border-blue-900/30 bg-slate-900/40">
                  <td className="px-3 py-2">Зачёт аванса при КС-3</td>
                  <td className="px-3 py-2 font-mono">3510 (авансы)</td>
                  <td className="px-3 py-2 font-mono">1210 (расч. с заказч.)</td>
                </tr>
                <tr className="border-t border-blue-900/30">
                  <td className="px-3 py-2">Списана себестоимость признанных работ</td>
                  <td className="px-3 py-2 font-mono">7010 (с/с реализ.)</td>
                  <td className="px-3 py-2 font-mono">8010 (осн. произв.)</td>
                </tr>
                <tr className="border-t border-blue-900/30 bg-slate-900/40">
                  <td className="px-3 py-2">Закрытие счёта НДС с аванса</td>
                  <td className="px-3 py-2 font-mono">3130 (НДС к зачёту)</td>
                  <td className="px-3 py-2 font-mono">3520 (НДС с аванса)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Все суммы по 8010 ведутся с обязательной аналитикой «Объект» — иначе невозможно
            рассчитать % готовности и финрезультат по каждому проекту отдельно. В 1С это
            субконто «Объекты строительства».
          </p>
        </section>

        <footer className="mt-12 border-t border-blue-900/40 pt-6 text-xs text-slate-500">
          <p>
            AEVION Smeta Trainer · Модуль: бухучёт по объектам · Метод поэтапной готовности
            (% completion). Нормативы: IFRS 15, СБУ-7 РК, План счётов 8000.
          </p>
        </footer>
      </main>
    </div>
  );
}
