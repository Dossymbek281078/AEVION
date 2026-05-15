"use client";

import Link from "next/link";
import { useState } from "react";

export default function SubcontractorMgmtPage() {
  // Упр.1 — ответственность
  const [ex1, setEx1] = useState<string | null>(null);
  const [ex1Res, setEx1Res] = useState<null | "ok" | "bad">(null);
  const [ex1Sol, setEx1Sol] = useState(false);

  // Упр.2 — расчёт удержания
  const [ex2, setEx2] = useState("");
  const [ex2Res, setEx2Res] = useState<null | "ok" | "bad">(null);
  const [ex2Sol, setEx2Sol] = useState(false);

  // Упр.3 — допуск субподрядчика без СМР-разрешения
  const [ex3, setEx3] = useState<string | null>(null);
  const [ex3Res, setEx3Res] = useState<null | "ok" | "bad">(null);
  const [ex3Sol, setEx3Sol] = useState(false);

  // Упр.4 — наценка ген.подрядчика
  const [ex4, setEx4] = useState("");
  const [ex4Res, setEx4Res] = useState<null | "ok" | "bad">(null);
  const [ex4Sol, setEx4Sol] = useState(false);

  const checkEx1 = () => setEx1Res(ex1 === "c" ? "ok" : "bad");
  const checkEx2 = () => {
    // 10% удержание от 5 000 000 = 500 000 тг
    const v = parseFloat(ex2);
    if (!isFinite(v)) return setEx2Res("bad");
    setEx2Res(Math.abs(v - 500_000) <= 10_000 ? "ok" : "bad");
  };
  const checkEx3 = () => setEx3Res(ex3 === "d" ? "ok" : "bad");
  const checkEx4 = () => {
    // 8% наценка от 50 000 000 = 4 000 000 тг
    const v = parseFloat(ex4);
    if (!isFinite(v)) return setEx4Res("bad");
    setEx4Res(Math.abs(v - 4_000_000) <= 100_000 ? "ok" : "bad");
  };

  const chain = [
    {
      role: "Заказчик (Customer)",
      who: "Собственник земли / средств — частник, акимат, СПК, БВУ",
      contract: "Договор подряда на капстроительство (ст. 651-673 ГК РК)",
      pays: "Авансы 10-30%, поэтапная оплата по КС-2/КС-3, окончательный после ввода",
    },
    {
      role: "Генеральный подрядчик (General Contractor)",
      who: "Имеет СМР-лицензию I/II/III категории, организует процесс",
      contract: "Подписывает с Заказчиком, далее — субподряды (ст. 658 ГК РК)",
      pays: "Получает аванс от Заказчика, оплачивает субподрядчикам по своим срокам",
    },
    {
      role: "Субподрядчики 1-го уровня",
      who: "Специализированные орг. — фасад, кровля, инж. сети, отделка",
      contract: "Договор субподряда с ген.подрядчиком (ст. 660 ГК РК)",
      pays: "Получают от ГП с наценкой ГП ~5-15%, оплата 70/30 (за вычетом удержания)",
    },
    {
      role: "Субсубподрядчики (2-й уровень)",
      who: "Узкие исполнители — сварка, монтаж конкретного оборудования",
      contract: "Допускается только с письменного согласия Заказчика (ст. 660.3 ГК РК)",
      pays: "Через субподрядчика 1-го уровня, нет прямого выхода на ГП/Заказчика",
    },
  ];

  const risks = [
    { issue: "ГП ответственен ЗА ВСЁ перед Заказчиком", note: "Даже за ошибки субподрядчика. Регресс к субу — отдельный иск (ст. 660.1 ГК РК)" },
    { issue: "Субподрядчик без СМР-разрешения = ничтожный договор", note: "Заказчик может расторгнуть и взыскать убытки. Лицензия проверяется в Реестре МИИР РК (license.kz)" },
    { issue: "Бухгалтерская связка: ГП → Суб (через расчётный счёт)", note: "Наличные платежи свыше 1 000 МРП запрещены (Налог. кодекс РК ст. 264). Все — через банк" },
    { issue: "Удержания 5-10% до подписания КС-2", note: "Гарантийный фонд на устранение скрытых дефектов. Срок возврата — после гарантии (1-2 года)" },
    { issue: "Цепочка НДС: вычеты ГП от субподрядных СФ", note: "Без счёт-фактур субподрядчика ГП не примет НДС к вычету — налоговые потери до 12%" },
    { issue: "Скрытые работы — АОСР строго подрядчик-исполнитель", note: "Подписи: исполнитель (суб) + ТН (Заказчика) + АН (проектировщик). ГП — только ставит печать сопровождения" },
    { issue: "Просрочки субов — pass-through к ГП", note: "Штраф Заказчика 0.1% в день из договора → ГП взыскивает с суба по своему договору с такой же оговоркой" },
    { issue: "Прямые расчёты Заказчика с субом запрещены", note: "Кроме случая банкротства ГП — только через суд и решение арбитража" },
  ];

  const tools = [
    { name: "Реестр субподрядчиков", purpose: "ГП ведёт список всех подключённых субов с реквизитами, лицензиями, КВЭД", soft: "Excel / 1С Подрядчик / Adept / Construction-Sage" },
    { name: "Журнал отслеживания работ", purpose: "По каждому субу — план vs факт, % выполнения, проблемы", soft: "MS Project / Primavera / GanttPRO" },
    { name: "Платёжный календарь субам", purpose: "Когда и сколько ГП должен по каждому суб-договору", soft: "Excel + интеграция с банк-клиентом" },
    { name: "Контроль документов", purpose: "Все паспорта/АОСР/протоколы от субов — в общем хранилище", soft: "DropBox Business / Google Drive / Yandex Disk + структура по этажам/секциям" },
    { name: "Журнал претензий", purpose: "Замечания Заказчика → ГП → передача субу-исполнителю → срок", soft: "Excel или Asana / Trello / Worksection" },
    { name: "Бухгалтерское сопровождение", purpose: "СФ-вычеты, выставление СФ Заказчику, расчёт зачёта НДС", soft: "1С Бухгалтерия 8.3 КЗ / SAP B1 / БухКонсалт" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Управление субподрядом</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🔗 Управление субподрядом
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            На крупных проектах генподрядчик (ГП) выполняет напрямую <strong className="text-cyan-300">только
            10-30% работ</strong> (земля + бетон + общестрой), остальное — через цепочку
            субподрядчиков. Управление этой цепочкой — отдельный навык: договорная архитектура,
            бухгалтерия, контроль качества, единая ответственность. Регулируется ГК РК ст. 651-673,
            Налог. кодексом РК и ЗРК «Об архит., град. и стр. деятельности».
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Норматив</div>
              <div className="text-slate-300">ГК РК ст. 651-673 (Подряд) + ст. 660 (Субподряд)</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Типичная цепочка</div>
              <div className="text-slate-300">Заказчик → ГП → 5-20 субов → 0-5 субсубов</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Наценка ГП</div>
              <div className="text-slate-300">5-15% от стоимости субподряда</div>
            </div>
          </div>
        </section>

        {/* Section 1: Цепочка */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🔄 Section 1. Договорная цепочка
          </h2>
          <div className="space-y-3">
            {chain.map((c) => (
              <div key={c.role} className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
                <h3 className="text-base font-semibold text-cyan-300 mb-3">{c.role}</h3>
                <dl className="text-sm grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-2">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Кто</dt>
                    <dd className="text-slate-300">{c.who}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Договор</dt>
                    <dd className="text-slate-300 text-xs">{c.contract}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Расчёты</dt>
                    <dd className="text-slate-300 text-xs">{c.pays}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Риски */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            ⚠️ Section 2. Восемь ключевых рисков и правил
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {risks.map((r, idx) => (
              <div key={r.issue} className="border border-rose-900/40 bg-rose-950/20 rounded-xl p-4">
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="text-rose-400 font-mono text-xs">#{idx + 1}</span>
                  <h3 className="text-sm font-semibold text-rose-300">{r.issue}</h3>
                </div>
                <p className="text-xs text-slate-300">{r.note}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Инструменты */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🛠 Section 3. Инструменты управления субподрядом
          </h2>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Инструмент</th>
                  <th className="text-left px-4 py-3">Зачем</th>
                  <th className="text-left px-4 py-3 w-64">Программы</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {tools.map((t) => (
                  <tr key={t.name} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 text-slate-100">{t.name}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{t.purpose}</td>
                    <td className="px-4 py-3 text-cyan-300 text-xs">{t.soft}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 4: Финансовая структура */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            💰 Section 4. Финансовая структура (на примере)
          </h2>
          <div className="border border-cyan-800/60 bg-cyan-950/30 rounded-xl p-5">
            <p className="text-sm text-slate-300 mb-4">
              Заказчик заключает с ГП договор на 200 млн тг (S=1000 м², 200 тыс. тг/м²). ГП
              распределяет работы:
            </p>
            <div className="space-y-2 text-sm font-mono">
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-300">ГП собственными силами (земля + бетон + общестрой)</span>
                <span className="text-emerald-300">25% = 50 млн тг</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-300">Субподряд 1: фасад СФТК</span>
                <span className="text-cyan-300">15% = 30 млн тг</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-300">Субподряд 2: инж. сети (ВК + ОВ + ЭО)</span>
                <span className="text-cyan-300">22% = 44 млн тг</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-300">Субподряд 3: отделка (плитка + штукатурка + покраска)</span>
                <span className="text-cyan-300">12% = 24 млн тг</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-300">Субподряд 4: кровля</span>
                <span className="text-cyan-300">8% = 16 млн тг</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-300">Субподряд 5: окна и двери</span>
                <span className="text-cyan-300">6% = 12 млн тг</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-300">Субподряд 6: благоустройство</span>
                <span className="text-cyan-300">4% = 8 млн тг</span>
              </div>
              <div className="flex justify-between text-amber-300 pt-2">
                <span>Прибыль ГП (10% наценка на 150 млн субподряда + ССП на свои 50)</span>
                <span>≈ 15 + 7 = 22 млн тг</span>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-4 italic">
              При работе только своими силами ГП пришлось бы держать 60-100 рабочих
              разных профессий — экономически невыгодно. Субподряд снижает
              постоянные затраты ГП и повышает специализацию.
            </p>
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Section 5. Упражнения</h2>

          {/* Упр.1 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Ответственность перед Заказчиком
            </div>
            <div className="text-slate-200 mb-4">
              Субподрядчик-кровельщик протёк после первого дождя через 3 месяца после сдачи
              объекта. Заказчик требует возмещения убытков. К кому он предъявляет претензию по
              ГК РК?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Напрямую к субподрядчику-кровельщику" },
                { v: "b", t: "К Заказчику-инвестору (предыдущему собственнику)" },
                { v: "c", t: "К Генеральному подрядчику (ст. 660.1 ГК РК)" },
                { v: "d", t: "К проектировщику кровли" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1 === opt.v ? "border-cyan-600 bg-cyan-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-cyan-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex1Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — к ГП</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-cyan-300">Решение:</strong> По ст. 660.1 ГК РК
                Генеральный подрядчик несёт перед Заказчиком ответственность за последствия
                невыполнения или ненадлежащего выполнения работ субподрядчиками. Заказчик
                <strong>не имеет</strong> прямых договорных отношений с субом и не может
                предъявить ему иск напрямую (ст. 660.3 ГК РК). ГП после возмещения убытков
                Заказчику предъявляет регрессный иск к субподрядчику-кровельщику по своему
                договору субподряда (срок исковой давности 3 года, ст. 178 ГК РК).
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Гарантийное удержание
            </div>
            <div className="text-slate-200 mb-4">
              Субподрядчик-фасадчик завершил этап на сумму <strong>5 000 000 тг</strong> по
              КС-2. По договору субподряда установлено гарантийное удержание <strong>10%</strong>
              до окончания гарантийного срока. Сколько ГП фактически перечислит субподрядчику
              после этапа? Введите сумму удержания в тенге:
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Удержание, тг</span>
              <input value={ex2} onChange={(e) => setEx2(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="500000" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex2Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 500 000 тг удержано, к выплате 4 500 000</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь %</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-cyan-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Удержание = 5 000 000 × 10% = 500 000 тг
К выплате после этапа = 5 000 000 − 500 000 = 4 500 000 тг

Возврат удержания:
• 50% (250 000 тг) — после ввода объекта в эксплуатацию
• 50% (250 000 тг) — после окончания гарантийного срока (1-2 года)

Альтернативный вариант — банковская гарантия (БГ) от субподрядчика
на эти же 10% (по ст. 348 ГК РК), тогда удержание не делается,
средства поступают полностью. Стоимость БГ для суба: 2-4% годовых.

Юридический риск: если суб обанкротится в гарантийный период,
удержание становится единственным источником средств на устранение
скрытых дефектов. БГ в этом плане надёжнее.`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Допуск без СМР-разрешения
            </div>
            <div className="text-slate-200 mb-4">
              ГП хочет привлечь субподрядчика-монолитчика, но у того нет действующего разрешения
              МИИР РК на СМР (находится в стадии получения). Объём работ —
              5 млн тг. Что делать ГП?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Заключить договор — разрешение получит в процессе" },
                { v: "b", t: "Заключить договор, но оформить как «услуги» вместо подряда" },
                { v: "c", t: "Заключить через посредника — другую СМР-фирму" },
                { v: "d", t: "Отказаться — договор без СМР-разрешения ничтожен, риск штрафа ГП (ст. 463 КоАП РК)" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex3 === opt.v ? "border-cyan-600 bg-cyan-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex3" value={opt.v} checked={ex3 === opt.v} onChange={() => setEx3(opt.v)} className="accent-cyan-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-cyan-300">Решение:</strong> Договор подряда без
                действующего СМР-разрешения у одной из сторон — ничтожен по ст. 159.1 ГК РК
                (сделка с лицом, не имеющим лицензии на лицензируемую деятельность). Заказчик
                может расторгнуть весь договор подряда с ГП, узнав об этом. ГП штрафуется по
                ст. 463 КоАП РК (нарушение требований по лицензированию) — 100-300 МРП юрлицу.
                Кроме того, проверка license.kz занимает 5 минут — это обязательная процедура
                до подписания договора. Оформление «услуг» вместо подряда — налоговое
                нарушение (переквалификация при проверке + доначисления НДС).
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Наценка ГП
            </div>
            <div className="text-slate-200 mb-4">
              ГП планирует субподряд на инженерные сети объёмом <strong>50 000 000 тг</strong>{" "}
              (от субподрядчика). ГП накручивает на эту работу свою наценку <strong>8%</strong>
              (за организацию, контроль, риск, финансирование). Какую сумму ГП выставит
              Заказчику в смете строки «инженерные сети»? Введите сумму наценки в тенге:
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Наценка ГП, тг</span>
              <input value={ex4} onChange={(e) => setEx4(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="4000000" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex4Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 4 000 000 тг наценка</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь %</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-cyan-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Наценка ГП = 50 000 000 × 8% = 4 000 000 тг

Цена для Заказчика = 50 000 000 + 4 000 000 = 54 000 000 тг

Из наценки ГП покрывает:
• Содержание прораба, кладовщика, бухгалтера (общестроительные
  затраты ГП): ~ 30% = 1.2 млн тг
• Финансирование (авансы субу до получения денег от Заказчика):
  ~ 25% = 1.0 млн тг
• Риск (просрочки субов, простои техники): ~ 20% = 0.8 млн тг
• Прибыль ГП: ~ 25% = 1.0 млн тг

Типичные наценки ГП в РК:
• 5-8% — массовое жильё, конкурсное строительство
• 8-12% — коммерческие объекты средней сложности
• 12-20% — премиум-сегмент, объекты с сертификацией LEED/EDGE
• 15-30% — FIDIC-контракты с международным финансированием

Если ГП — головной подрядчик ЕБРР-проекта, наценка может быть
прописана как Overhead & Profit (OH&P) ~ 12-15% в Bill of Quantities.`}
                </pre>
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          ГК РК ст. 651-673 (Подряд) и ст. 660 (Субподряд). Налог. кодекс РК ст. 264 (запрет
          крупных наличных расчётов). КоАП РК ст. 463 (наруш. лицензирования). ЗРК «Об архит.,
          град. и стр. деятельности» от 16.07.2001 № 242. Реестр СМР-лицензий — license.kz.
        </div>
      </main>
    </div>
  );
}
