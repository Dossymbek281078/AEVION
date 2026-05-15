"use client";

import Link from "next/link";
import { useState } from "react";

export default function ScopeChangeMgmtPage() {
  const [ex1, setEx1] = useState<string | null>(null);
  const [ex1Res, setEx1Res] = useState<null | "ok" | "bad">(null);
  const [ex1Sol, setEx1Sol] = useState(false);

  const [ex2, setEx2] = useState("");
  const [ex2Res, setEx2Res] = useState<null | "ok" | "bad">(null);
  const [ex2Sol, setEx2Sol] = useState(false);

  const [ex3, setEx3] = useState<string | null>(null);
  const [ex3Res, setEx3Res] = useState<null | "ok" | "bad">(null);
  const [ex3Sol, setEx3Sol] = useState(false);

  const [ex4, setEx4] = useState("");
  const [ex4Res, setEx4Res] = useState<null | "ok" | "bad">(null);
  const [ex4Sol, setEx4Sol] = useState(false);

  const checkEx1 = () => setEx1Res(ex1 === "b" ? "ok" : "bad");
  const checkEx2 = () => {
    // Δ% = (165 - 150) / 150 × 100 = 10% — пограничный случай 10% (ст. 718.4)
    const v = parseFloat(ex2);
    if (!isFinite(v)) return setEx2Res("bad");
    setEx2Res(Math.abs(v - 10) <= 0.3 ? "ok" : "bad");
  };
  const checkEx3 = () => setEx3Res(ex3 === "c" ? "ok" : "bad");
  const checkEx4 = () => {
    // 30 дней простоя × 0.1%/день × 500 млн = 15 млн тг претензия по простою
    const v = parseFloat(ex4);
    if (!isFinite(v)) return setEx4Res("bad");
    setEx4Res(Math.abs(v - 15_000_000) <= 200_000 ? "ok" : "bad");
  };

  const types = [
    {
      name: "Variation Order (VO)",
      what: "Изменение объёма работ по инициативе Заказчика",
      law: "ГК РК ст. 718, FIDIC Sub-Clause 13.1",
      who: "Заказчик / Инженер → Подрядчик",
      cause: "Поменялся проект, добавили этаж, изменили отделку",
      cost: "Дополнительная цена + продление срока, оформляется доп. соглашением",
    },
    {
      name: "Claim (Иск/Претензия)",
      what: "Финансовое требование Подрядчика на компенсацию",
      law: "ГК РК ст. 661 + договор",
      who: "Подрядчик → Заказчик",
      cause: "Простой из-за Заказчика, дополнительные риски, форс-мажор",
      cost: "Возмещение по фактическим затратам + упущенной выгоде",
    },
    {
      name: "EOT — Extension of Time",
      what: "Продление срока без штрафа Подрядчику",
      law: "ГК РК ст. 297 + договор; FIDIC Sub-Clause 8.5/20.1",
      who: "Подрядчик → Engineer/Заказчик",
      cause: "Задержка передачи площадки, изменения проекта, погода",
      cost: "Только продление, без доплаты (но с возможной компенсацией убытков)",
    },
    {
      name: "Disruption Claim",
      what: "Иск о компенсации производительности (без чёткого простоя)",
      law: "Договорная база, доказательство «Measured Mile»",
      who: "Подрядчик → Заказчик",
      cause: "Постоянные мелкие задержки, изменения, перепланировки",
      cost: "Расчёт сложный — сравнение с эталонным периодом",
    },
    {
      name: "Acceleration Claim",
      what: "Ускорение работ по просьбе Заказчика — компенсация",
      law: "Договорная база",
      who: "Подрядчик → Заказчик",
      cause: "Заказчик требует завершить раньше срока (открытие сезона, реклама)",
      cost: "Доплата за сверхурочные, дополнительные смены, технику",
    },
    {
      name: "Прекращение работ (Termination)",
      what: "Расторжение договора по инициативе одной из сторон",
      law: "ГК РК ст. 401-404",
      who: "Любая сторона",
      cause: "Существенное нарушение, банкротство, форс-мажор &gt; 3 мес",
      cost: "Оплата факт. выполненного + штрафы (обычно 5-10%)",
    },
  ];

  const procedure = [
    { n: 1, name: "Уведомление о намерении (Notice of Variation)", who: "Заказчик / Инженер", days: "За 14 дней до изменения", doc: "Письмо с описанием планируемой VO" },
    { n: 2, name: "Запрос подрядчика на оценку (Quotation)", who: "Подрядчик", days: "Подаёт в 21 день", doc: "Калькуляция: объём, цена, срок, риски" },
    { n: 3, name: "Согласование оценки", who: "Заказчик + Подрядчик", days: "До 28 дней", doc: "Протокол согласования или Engineer Determination" },
    { n: 4, name: "Доп. соглашение к договору", who: "Юристы обеих сторон", days: "Сразу после согласования", doc: "Дополнительное соглашение №N + новые приложения к смете" },
    { n: 5, name: "Изменение графика и сметы", who: "Сметчик + Прораб", days: "1-3 дня", doc: "Обновлённая ВОР, ССР, диаграмма Гантта" },
    { n: 6, name: "Уведомление субподрядчиков", who: "Генеральный подрядчик", days: "Параллельно с этапом 4", doc: "Каскадирование VO по цепочке субподряда" },
    { n: 7, name: "Реализация и контроль", who: "Прораб + ТН + Авт. надзор", days: "По графику", doc: "АОСР с пометкой «по VO №N»" },
    { n: 8, name: "Оплата по новой схеме", who: "Бухгалтерия Заказчика", days: "По срокам договора", doc: "КС-2/КС-3 с новыми суммами" },
  ];

  const risks = [
    { issue: "Изменение без письменного согласования", consequence: "Работы оплате не подлежат (ГК РК ст. 718.4)" },
    { issue: "Превышение порога 10% без обоснования", consequence: "Подрядчик может отказаться продолжать (ст. 718.4)" },
    { issue: "Просрочка уведомления о Claim (&gt; 28 дней FIDIC)", consequence: "Потеря права на компенсацию (Sub-Clause 20.1)" },
    { issue: "Отсутствие документации затрат", consequence: "Невозможность доказать сумму Claim — отказ суда" },
    { issue: "Несогласованное продление срока", consequence: "Штраф за просрочку 0.1%/день × сумма договора" },
    { issue: "Игнорирование уведомления EOT", consequence: "Потеря права на Time Extension даже при обоснованной причине" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Управление изменениями</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🔄 Управление изменениями объёма (VO + Claims)
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            Ни один строительный проект не идёт по плану. <strong className="text-orange-300">VO
            (Variation Orders)</strong> и <strong className="text-orange-300">Claims (Иски о
            компенсации)</strong> — это инструменты, которыми сметчик и менеджер проекта
            управляют отклонениями. На крупных проектах объём VO достигает 10-25% от
            первоначальной сметы, а на FIDIC-контрактах — до 30-40%. Регулируется ГК РК
            ст. 651-673 (особенно ст. 718), а для международных проектов — FIDIC Sub-Clause
            13 (Variations) и 20 (Claims).
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Норматив РК</div>
              <div className="text-slate-300">ГК РК ст. 718 (Изменение объёма)</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Порог</div>
              <div className="text-slate-300">+10% без согласия можно, &gt;10% — обязательно соглашение</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Доля VO в проекте</div>
              <div className="text-slate-300">10-25% от первонач. сметы (типично)</div>
            </div>
          </div>
        </section>

        {/* Section 1: Типы изменений */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📋 Section 1. Шесть типов изменений объёма
          </h2>
          <div className="space-y-3">
            {types.map((t) => (
              <div key={t.name} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
                <h3 className="text-base font-semibold text-orange-300 mb-2">{t.name}</h3>
                <dl className="text-sm grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Что это</dt>
                    <dd className="text-slate-300 text-xs">{t.what}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Норма</dt>
                    <dd className="text-slate-400 text-xs">{t.law}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Инициатор</dt>
                    <dd className="text-slate-300 text-xs">{t.who}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Причина</dt>
                    <dd className="text-slate-300 text-xs italic">{t.cause}</dd>
                  </div>
                  <div className="md:col-span-2">
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Финансовые последствия</dt>
                    <dd className="text-emerald-300 text-xs">{t.cost}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Процедура VO */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🪜 Section 2. Восемь шагов оформления Variation Order
          </h2>
          <div className="space-y-3">
            {procedure.map((s) => (
              <div key={s.n} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40 flex gap-4">
                <div className="text-3xl font-bold text-orange-400 w-12 text-center shrink-0">{s.n}</div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-slate-100 mb-1">{s.name}</h3>
                  <dl className="text-sm grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1">
                    <div>
                      <dt className="text-slate-500 text-xs uppercase tracking-wider">Кто</dt>
                      <dd className="text-slate-300 text-xs">{s.who}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 text-xs uppercase tracking-wider">Срок</dt>
                      <dd className="text-amber-300 text-xs">{s.days}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 text-xs uppercase tracking-wider">Документ</dt>
                      <dd className="text-slate-400 text-xs">{s.doc}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Риски */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            ⚠️ Section 3. Шесть критических рисков
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {risks.map((r, idx) => (
              <div key={r.issue} className="border border-rose-900/40 bg-rose-950/20 rounded-xl p-4">
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="text-rose-400 font-mono text-xs">#{idx + 1}</span>
                  <h3 className="text-sm font-semibold text-rose-300">{r.issue}</h3>
                </div>
                <p className="text-xs text-slate-300">→ {r.consequence}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: Калькуляция Claim */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            💰 Section 4. Структура расчёта Claim (Иска)
          </h2>
          <div className="border border-orange-800/60 bg-orange-950/30 rounded-xl p-5">
            <h3 className="text-orange-300 font-semibold mb-3">Базовая формула Claim</h3>
            <div className="text-orange-300 font-mono text-base mb-3 text-center">
              Claim = Прямые затраты + Косвенные + Накладные + Прибыль + Финансовые
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="border border-slate-800 rounded p-3 bg-slate-900/60">
                <div className="text-orange-300 font-mono mb-1 text-xs">Прямые затраты</div>
                <div className="text-slate-300 text-xs">ОТ простаивавших рабочих, аренда техники в простое, охрана, удерживаемый офис на стройплощадке</div>
              </div>
              <div className="border border-slate-800 rounded p-3 bg-slate-900/60">
                <div className="text-orange-300 font-mono mb-1 text-xs">Косвенные затраты</div>
                <div className="text-slate-300 text-xs">Хранение материалов на складе, страхование, банковские гарантии за период простоя</div>
              </div>
              <div className="border border-slate-800 rounded p-3 bg-slate-900/60">
                <div className="text-orange-300 font-mono mb-1 text-xs">Накладные (HO Overhead)</div>
                <div className="text-slate-300 text-xs">Доля головного офиса (бухгалтерия, директор) на этот объект. Обычно 4-7% от прямых</div>
              </div>
              <div className="border border-slate-800 rounded p-3 bg-slate-900/60">
                <div className="text-orange-300 font-mono mb-1 text-xs">Прибыль (Profit)</div>
                <div className="text-slate-300 text-xs">5-10% от прямых + косвенных. По FIDIC — упущенная выгода обоснована</div>
              </div>
              <div className="border border-slate-800 rounded p-3 bg-slate-900/60">
                <div className="text-orange-300 font-mono mb-1 text-xs">Финансовые</div>
                <div className="text-slate-300 text-xs">% по кредитам, привлечённым из-за задержки оплат Заказчика (по % BPS + 2%)</div>
              </div>
              <div className="border border-slate-800 rounded p-3 bg-slate-900/60">
                <div className="text-orange-300 font-mono mb-1 text-xs">Disruption (если есть)</div>
                <div className="text-slate-300 text-xs">Потеря производительности — обычно 10-30% от прямых при затяжных нарушениях</div>
              </div>
            </div>
          </div>

          <div className="bg-amber-950/30 border border-amber-800/60 rounded-lg p-4 text-sm text-amber-200">
            <strong>Контроль документации:</strong> успех Claim на 80% зависит от документации.
            Дневник работ, фотофиксация простоев, табели рабочих, журналы техники, переписка
            с Заказчиком — всё должно быть в идеальном порядке. Без этого даже обоснованный
            Claim в суде/арбитраже не пройдёт.
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Section 5. Упражнения</h2>

          {/* Упр.1 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Право Подрядчика отказаться
            </div>
            <div className="text-slate-200 mb-4">
              Заказчик требует выполнить дополнительные работы на сумму, превышающую
              <strong>15% от первоначальной сметы</strong>, но без письменного согласования
              новой цены и срока. Какое право у Подрядчика по ГК РК ст. 718?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Обязан выполнить — Заказчик всегда прав" },
                { v: "b", t: "Имеет право отказаться от продолжения работ до подписания доп. соглашения с новой ценой и сроком (ст. 718.4)" },
                { v: "c", t: "Может выполнить, но затем взыскать через суд" },
                { v: "d", t: "Должен пожаловаться в ГосАрхСтройКонтроль" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1 === opt.v ? "border-orange-600 bg-orange-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-orange-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex1Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — отказ до согласования</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-orange-300">Решение:</strong> ГК РК ст. 718.4 прямо
                устанавливает: «При <strong>увеличении сметной стоимости</strong> по
                требованию заказчика более чем <strong>на десять процентов</strong> подрядчик
                имеет право <strong>отказаться от договора</strong> и потребовать возмещения
                убытков, причинённых его прекращением». То есть Подрядчик может остановить
                работы и не нести ответственность за просрочку — пока Заказчик не подпишет
                доп. соглашение. На практике, чтобы не доводить до конфликта, Подрядчик
                направляет письменное уведомление о приостановке + проект доп. соглашения
                + расчёт новой цены и срока. Заказчик имеет 14 дней на ответ.
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Порог изменения
            </div>
            <div className="text-slate-200 mb-4">
              Первоначальная смета объекта: <strong>150 000 000 тг</strong>. После VO стоимость
              выросла до <strong>165 000 000 тг</strong>. На сколько % выросла стоимость?
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Рост, %</span>
              <input value={ex2} onChange={(e) => setEx2(e.target.value)} type="number" step="0.1" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="10" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex2Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 10% (пограничный)</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-orange-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Δ% = (Новая − Первонач.) / Первонач. × 100%
   = (165 − 150) / 150 × 100%
   = 15 / 150 × 100%
   = 10%

КРИТИЧНЫЙ ВЫВОД: 10% — это ПОГРАНИЧНОЕ значение по
ГК РК ст. 718.4. До 10% Заказчик может потребовать
выполнения без отдельного соглашения (но всё равно с
оплатой). 10% и выше — обязательно письменное
согласование.

Чёткая граница «10%» означает что:
• На 10.01% — Подрядчик ВПРАВЕ отказаться
• На 9.99% — НЕ вправе (теоретически)

На практике 10% — спорный пограничный случай. Лучшая
практика: всегда оформлять VO письменно, даже на 1-2%.
Это создаёт «бумажный след» и защищает обе стороны при
возможных спорах.

Если суммарно за проект VO накопились до 25%, можно
дополнительно ставить вопрос о пересмотре всех условий
договора (включая нормы накладных и сметной прибыли).`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Срок подачи Claim по FIDIC
            </div>
            <div className="text-slate-200 mb-4">
              По контракту FIDIC Red Book подрядчик столкнулся с дополнительными
              препятствиями (Заказчик не предоставил доступ к площадке на 2 недели). В какой
              срок подрядчик <strong>обязан</strong> подать Notice of Claim по Sub-Clause 20.1,
              чтобы сохранить право на компенсацию?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "7 дней" },
                { v: "b", t: "14 дней" },
                { v: "c", t: "28 дней с момента осведомлённости о препятствии" },
                { v: "d", t: "60 дней — общий срок исковой давности" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex3 === opt.v ? "border-orange-600 bg-orange-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex3" value={opt.v} checked={ex3 === opt.v} onChange={() => setEx3(opt.v)} className="accent-orange-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 28 дней</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-orange-300">Решение:</strong> FIDIC Sub-Clause 20.1
                (Contractor&apos;s Claims) устанавливает: «Если Подрядчик считает, что он имеет
                право на дополнительную оплату или продление срока, он <strong>должен подать
                Notice (уведомление) о Claim Инженеру в течение 28 дней</strong> после того,
                как Подрядчик узнал или должен был узнать о событии или обстоятельстве».
                <strong className="text-rose-300"> Условие пресекательное</strong> — если
                подрядчик опоздал с подачей уведомления, его право на Claim <strong>теряется</strong>,
                даже если Claim полностью обоснован. Это одно из самых жёстких правил FIDIC,
                которое часто нарушают начинающие в международных проектах. Полный Claim с
                расчётом и обоснованием подаётся в течение 42 дней (Sub-Clause 20.2).
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Расчёт Claim за простой
            </div>
            <div className="text-slate-200 mb-4">
              Подрядчик 30 дней простаивал из-за вины Заказчика (не передали площадку).
              Сумма договора <strong>500 000 000 тг</strong>. По договору неустойка за
              простой — <strong>0.1% в день</strong> от суммы договора. Какой Claim
              подрядчика на компенсацию простоя?
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Claim, тг</span>
              <input value={ex4} onChange={(e) => setEx4(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="15000000" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex4Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 15 млн тг</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-orange-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Claim_неустойка = Сумма_договора × % × Дни
                = 500 000 000 × 0.001 × 30
                = 15 000 000 тг

Это только базовая (договорная) неустойка. Полный Claim
подрядчика может включать:

• Договорная неустойка (15 млн тг)
• ОТ простаивавших рабочих (20 чел × 30 дней × 6000 тг
  ≈ 3.6 млн тг)
• Аренда техники в простое (5 ед. × 30 дн × 20 000 тг
  ≈ 3 млн тг)
• Накладные офиса на стройке (~ 500 тыс. тг/мес)
• Финансовые издержки (% по кредитам, банковские гарантии)
• Прибыль (10% от прямых затрат)
─────────────────────────────────────────
ИТОГО полный Claim: 20-25 млн тг

В договоре обычно прописана только неустойка по % —
остальные пункты подрядчик должен доказывать отдельно.
Поэтому ПРАВИЛО: в договор закладывать не только %,
но и пункт «возмещение факт. затрат при простое».`}
                </pre>
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          ГК РК ст. 651-673 (Подряд), ст. 718 (Изменение объёма работ). FIDIC Sub-Clauses
          13 (Variations), 8.5/20.1 (EOT/Claims). ЗРК «О медиации» от 28.01.2011 № 401-IV.
          Документация Claim: «Measured Mile», «Total Cost», «Modified Total Cost».
        </div>
      </main>
    </div>
  );
}
