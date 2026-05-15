"use client";

import Link from "next/link";
import { useState } from "react";

export default function ContractorClaimsPage() {
  // Упражнение 1: multiple-choice (расхождение объёмов)
  const [q1, setQ1] = useState<string>("");
  const [show1, setShow1] = useState(false);

  // Упражнение 2: numeric (стоимость снятия)
  const [q2, setQ2] = useState<string>("");
  const [show2, setShow2] = useState(false);

  // Упражнение 3: multiple-choice (Кз зимний коэф.)
  const [q3, setQ3] = useState<string>("");
  const [show3, setShow3] = useState(false);

  // Упражнение 4: numeric (двойной счёт)
  const [q4, setQ4] = useState<string>("");
  const [show4, setShow4] = useState(false);

  const check2 = () => {
    const v = parseFloat(q2.replace(/\s/g, "").replace(",", "."));
    const target = 3287000;
    if (isNaN(v)) return null;
    return Math.abs(v - target) / target <= 0.1;
  };

  const check4 = () => {
    const v = parseFloat(q4.replace(/\s/g, "").replace(",", "."));
    const target = 1824000;
    if (isNaN(v)) return null;
    return Math.abs(v - target) / target <= 0.1;
  };

  const violations = [
    { num: 1, name: "Завышение объёмов кладки", desc: "Не вычтены оконные и дверные проёмы из общей площади стен", penalty: "До 15-25% от позиции" },
    { num: 2, name: "Задвоение позиций", desc: "Одна и та же работа учтена в двух расценках (например, штукатурка в Сб.15-1 и Сб.15-2)", penalty: "100% второй позиции" },
    { num: 3, name: "Неправильная серия расценок", desc: "Применён Сб.7 (бетонные конструкции) вместо Сб.6 (бетонные и ж/б монолитные)", penalty: "Разница между расценками" },
    { num: 4, name: "Неверный коэффициент", desc: "Применён Кз=1.20 (особо стеснённые) вместо 1.15 (стеснённые)", penalty: "Перерасчёт всей позиции" },
    { num: 5, name: "Завышение стоимости материалов", desc: "Цена материала без подтверждающих документов (счёт-фактур, накладных)", penalty: "Снятие до факт. цены" },
    { num: 6, name: 'Необоснованный "прочие материалы" 5%', desc: 'Включён лимит "прочие" без расшифровки и обоснования', penalty: "Полное снятие 5%" },
    { num: 7, name: "Несуществующие работы", desc: "Предъявлены работы, которые на объекте не выполнены (фотофиксация отсутствует)", penalty: "100% + штрафы" },
    { num: 8, name: "Материалы заказчика в смете", desc: "Материалы, поставленные заказчиком (давальческие), проходят по подрядной смете", penalty: "100% стоимости материала" },
  ];

  const checklist = [
    { step: 1, name: "Сверка с проектной сметой", detail: "Сопоставление позиций КС-2 с локальной сметой и ведомостью договорной цены. Любые расхождения &gt; 5% требуют письменного обоснования." },
    { step: 2, name: "Контрольный обмер на объекте", detail: "Выезд комиссии (заказчик + технадзор + представитель подрядчика), составление акта обмера с фотофиксацией." },
    { step: 3, name: "Проверка фактических цен материалов", detail: "Запрос счетов-фактур и накладных. Сверка с ССЦ РК (new-shop.ksm.kz) на месяц поставки." },
    { step: 4, name: "Сверка коэффициентов", detail: "Проверка обоснованности Кз (зима), Кр (район), Кс (стеснённость), Кв (высотность). Каждый коэф. требует ссылки на МДС 81-35.2004." },
    { step: 5, name: "Проверка индекса на месяц выполнения", detail: "Индекс СМР применяется на месяц фактического выполнения работ (по журналу КС-6а), а не на месяц подписания КС-2." },
  ];

  const claimLetters = [
    {
      title: "1. Претензия по завышению объёмов",
      body: 'По результатам контрольного обмера от __.__.20__ г. (Акт № __) установлено расхождение между предъявленными в КС-2 № __ объёмами кирпичной кладки (1850 м²) и фактически выполненными (1620 м²). Расхождение составляет 230 м² (14%). Требуем произвести перерасчёт КС-2 со снятием суммы 3 287 000 тг и предоставить корректирующий акт в течение 10 рабочих дней.',
    },
    {
      title: "2. Претензия по неправомерному применению Кз",
      body: 'В КС-2 № __ от __.__.20__ г. подрядчиком применён коэффициент зимнего удорожания Кз=1.20 на работы, выполненные в апреле 2026 г. в г. Алматы. Согласно МДС 81-35.2004 (Приложение 3) и СН РК 1.03-08, зимний коэффициент применяется только в период декабрь-март. Требуем исключить Кз из расчёта и произвести возврат суммы __ тг.',
    },
    {
      title: "3. Претензия по задвоению позиций",
      body: 'При проверке КС-2 № __ выявлено двойное предъявление работ по штукатурке стен в объёме 380 м² (позиции 14 — Сб.15-1 и позиция 27 — Сб.15-2). Согласно п. 4.5 МДС 81-25.2001, повторное предъявление одной и той же работы недопустимо. Сумма к возврату: 1 824 000 тг. Срок устранения — 5 рабочих дней.',
    },
    {
      title: "4. Претензия по материалам заказчика",
      body: 'В КС-2 № __ от __.__.20__ г. подрядчиком включена стоимость материалов (арматура А500С — 12.4 т), которые согласно условиям договора (п. __) поставляются заказчиком и являются давальческими. Требуем исключить стоимость давальческих материалов из КС-2 и предоставить корректирующий акт в срок до __.__.20__ г.',
    },
    {
      title: "5. Претензия по несуществующим работам",
      body: 'По результатам визуального осмотра от __.__.20__ г. установлено, что работы по устройству гидроизоляции фундаментов (КС-2 № __, позиция 8, объём 420 м²) фактически не выполнены. Фотоматериалы и акт осмотра прилагаются. Требуем исключить позицию из КС-2 в полном объёме. В случае неустранения — обращение в суд + начисление штрафа 0.1% за каждый день просрочки согласно п. __ договора.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-red-400 hover:text-red-300 transition"
          >
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Контроль</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        {/* Title */}
        <section>
          <h1 className="text-4xl font-bold mb-3 text-red-300">
            🔍 Проверка КС-2/КС-3 — претензии к подрядчику
          </h1>
          <p className="text-slate-400 text-lg">
            Приёмка работ заказчиком: проверка фактических объёмов, применённых расценок и обоснование снятия завышенных сумм.
          </p>
        </section>

        {/* Intro */}
        <section className="bg-gradient-to-br from-red-950/40 to-orange-950/30 border border-red-900/50 rounded-2xl p-6">
          <h2 className="text-2xl font-semibold mb-4 text-orange-300">📋 О чём этот модуль</h2>
          <div className="space-y-3 text-slate-300">
            <p>
              <strong className="text-red-300">КС-2</strong> (акт о приёмке выполненных работ) и{" "}
              <strong className="text-red-300">КС-3</strong> (справка о стоимости) — основные документы, по которым заказчик оплачивает подрядчику выполненные работы. Грамотная проверка экономит 5-15% бюджета объекта.
            </p>
            <p>
              <strong className="text-orange-300">Задача заказчика:</strong> проверить фактические объёмы по контрольному обмеру, применённые расценки, коэффициенты и индексы. Любое завышение оформляется официальной претензией.
            </p>
            <div className="mt-4 p-4 bg-slate-900/60 rounded-xl border border-slate-800">
              <div className="text-sm font-semibold text-slate-300 mb-2">Нормативная база:</div>
              <ul className="text-sm text-slate-400 space-y-1 list-disc pl-5">
                <li>МДС 81-25.2001 — Методические указания по определению величины сметной прибыли</li>
                <li>МДС 81-35.2004 — Методика определения стоимости строительной продукции</li>
                <li>СН РК 1.03-08-2017 — Правила определения сметной стоимости в РК</li>
                <li>Постановление Правительства РК № 392 от 26.04.2007 г. — о порядке оплаты СМР</li>
                <li>ГК РК (ст. 651-655) — срок ответа на претензию: 30 дней</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 1: 8 нарушений */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-red-300">
            ⚠️ Section 1. 8 типичных нарушений подрядчика в КС-2
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-300">
                <tr>
                  <th className="px-4 py-3 text-left w-12">№</th>
                  <th className="px-4 py-3 text-left">Нарушение</th>
                  <th className="px-4 py-3 text-left">Суть</th>
                  <th className="px-4 py-3 text-left w-48">Размер снятия</th>
                </tr>
              </thead>
              <tbody>
                {violations.map((v) => (
                  <tr
                    key={v.num}
                    className="border-t border-slate-800 hover:bg-slate-900/50 transition"
                  >
                    <td className="px-4 py-3 text-orange-400 font-bold">{v.num}</td>
                    <td className="px-4 py-3 font-semibold text-red-200">{v.name}</td>
                    <td className="px-4 py-3 text-slate-400">{v.desc}</td>
                    <td className="px-4 py-3 text-orange-300 text-xs font-mono">{v.penalty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2: Чек-лист */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-red-300">
            ✅ Section 2. Чек-лист проверки КС-2 (5 шагов)
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {checklist.map((c) => (
              <div
                key={c.step}
                className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 hover:border-orange-700/60 transition"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center font-bold text-white">
                    {c.step}
                  </div>
                  <div>
                    <h3 className="font-semibold text-orange-300 mb-1">{c.name}</h3>
                    <p
                      className="text-sm text-slate-400"
                      dangerouslySetInnerHTML={{ __html: c.detail }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Упражнения */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-red-300">
            🎯 Section 3. 4 интерактивных упражнения
          </h2>

          {/* Упражнение 1 */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 mb-5">
            <div className="text-sm text-orange-400 font-semibold mb-2">Упражнение 1 · Расхождение объёмов</div>
            <p className="text-slate-200 mb-4">
              Подрядчик предъявил в КС-2 кладку{" "}
              <strong className="text-red-300">1 850 м²</strong> при проектной смете{" "}
              <strong className="text-red-300">1 620 м²</strong> (расхождение 14%, что{" "}
              {">"} допустимых 5%). Ваши действия?
            </p>
            <div className="space-y-2 mb-4">
              {[
                { id: "a", text: "Подписать КС-2 как есть — подрядчик лучше знает" },
                { id: "b", text: "Назначить контрольный обмер с фотофиксацией" },
                { id: "c", text: "Снять разницу 230 м² без обсуждения с подрядчиком" },
                { id: "d", text: "Сразу обращаться в суд" },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    q1 === opt.id
                      ? "border-orange-500 bg-orange-950/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="q1"
                    value={opt.id}
                    checked={q1 === opt.id}
                    onChange={(e) => setQ1(e.target.value)}
                    className="accent-orange-500"
                  />
                  <span className="text-slate-300">
                    <span className="font-mono text-orange-400">{opt.id})</span> {opt.text}
                  </span>
                </label>
              ))}
            </div>
            {q1 && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  q1 === "b"
                    ? "bg-green-950/40 border border-green-800 text-green-300"
                    : "bg-red-950/40 border border-red-800 text-red-300"
                }`}
              >
                {q1 === "b"
                  ? "✓ Верно. Контрольный обмер — единственный законный способ установить факт."
                  : "✗ Неверно. Без контрольного обмера ни снимать, ни подписывать нельзя."}
              </div>
            )}
            <button
              onClick={() => setShow1(!show1)}
              className="mt-3 text-xs text-orange-400 hover:text-orange-300 underline"
            >
              {show1 ? "Скрыть решение" : "Показать решение"}
            </button>
            {show1 && (
              <div className="mt-3 p-4 bg-slate-950/60 rounded-lg border border-slate-800 text-sm text-slate-300">
                <strong className="text-orange-300">Решение:</strong> Правильный ответ — <strong>b</strong>. Согласно МДС 81-35.2004 и СН РК 1.03-08, при расхождении объёмов более 5% заказчик обязан назначить комиссионный контрольный обмер с участием представителя подрядчика, технадзора и фотофиксацией. По результатам составляется Акт обмера, который является основанием для перерасчёта КС-2.
              </div>
            )}
          </div>

          {/* Упражнение 2 */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 mb-5">
            <div className="text-sm text-orange-400 font-semibold mb-2">Упражнение 2 · Стоимость снятия</div>
            <p className="text-slate-200 mb-2">
              Рассчитайте сумму снятия по контрольному обмеру (расхождение 230 м²):
            </p>
            <div className="font-mono text-xs bg-slate-950/60 p-3 rounded border border-slate-800 mb-4 text-slate-300">
              230 м² × 8 500 тг/м² × 1.16 (Кр Алматы) × 1.45 (индекс СМР) = ?
            </div>
            <div className="flex gap-3 items-center mb-3">
              <input
                type="text"
                value={q2}
                onChange={(e) => setQ2(e.target.value)}
                placeholder="введите сумму в тг"
                className="flex-1 px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:border-orange-500 outline-none font-mono"
              />
              <span className="text-slate-500 text-sm">тг</span>
            </div>
            {check2() !== null && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  check2()
                    ? "bg-green-950/40 border border-green-800 text-green-300"
                    : "bg-red-950/40 border border-red-800 text-red-300"
                }`}
              >
                {check2()
                  ? "✓ Верно (±10%). Сумма снятия обоснована для претензии подрядчику."
                  : "✗ Неверно. Проверьте порядок умножения коэффициентов."}
              </div>
            )}
            <button
              onClick={() => setShow2(!show2)}
              className="mt-3 text-xs text-orange-400 hover:text-orange-300 underline"
            >
              {show2 ? "Скрыть решение" : "Показать решение"}
            </button>
            {show2 && (
              <div className="mt-3 p-4 bg-slate-950/60 rounded-lg border border-slate-800 text-sm text-slate-300 font-mono">
                230 × 8 500 = 1 955 000 тг (база)
                <br />
                1 955 000 × 1.16 = 2 267 800 тг (с Кр)
                <br />
                2 267 800 × 1.45 = <strong className="text-orange-300">3 288 310 тг</strong> ≈{" "}
                <strong className="text-green-300">3 287 000 тг</strong>
                <br />
                <span className="text-slate-400 text-xs">
                  (округление до тысяч в претензии — стандартная практика)
                </span>
              </div>
            )}
          </div>

          {/* Упражнение 3 */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 mb-5">
            <div className="text-sm text-orange-400 font-semibold mb-2">
              Упражнение 3 · Зимний коэффициент Кз
            </div>
            <p className="text-slate-200 mb-4">
              Подрядчик включил в КС-2 коэффициент зимнего удорожания{" "}
              <strong className="text-red-300">Кз=1.20</strong> для бетонирования, выполненного{" "}
              <strong className="text-red-300">в апреле в г. Алматы</strong>. Это правомерно?
            </p>
            <div className="space-y-2 mb-4">
              {[
                { id: "a", text: "Да, Кз можно применять круглый год" },
                { id: "b", text: "Нет, в апреле в Алматы зимний коэф. НЕ применяется" },
                { id: "c", text: "Зависит от среднесуточной температуры на объекте" },
                { id: "d", text: "Можно, но только если Кз ≤ 1.10" },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    q3 === opt.id
                      ? "border-orange-500 bg-orange-950/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="q3"
                    value={opt.id}
                    checked={q3 === opt.id}
                    onChange={(e) => setQ3(e.target.value)}
                    className="accent-orange-500"
                  />
                  <span className="text-slate-300">
                    <span className="font-mono text-orange-400">{opt.id})</span> {opt.text}
                  </span>
                </label>
              ))}
            </div>
            {q3 && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  q3 === "b"
                    ? "bg-green-950/40 border border-green-800 text-green-300"
                    : "bg-red-950/40 border border-red-800 text-red-300"
                }`}
              >
                {q3 === "b"
                  ? "✓ Верно. Кз применяется только в зимний период (декабрь-март по РК)."
                  : "✗ Неверно. Зимний коэф. ограничен по сезону, а не по факт. температуре."}
              </div>
            )}
            <button
              onClick={() => setShow3(!show3)}
              className="mt-3 text-xs text-orange-400 hover:text-orange-300 underline"
            >
              {show3 ? "Скрыть решение" : "Показать решение"}
            </button>
            {show3 && (
              <div className="mt-3 p-4 bg-slate-950/60 rounded-lg border border-slate-800 text-sm text-slate-300">
                <strong className="text-orange-300">Решение:</strong> Правильный ответ —{" "}
                <strong>b</strong>. Согласно МДС 81-35.2004 (Приложение 3) и СН РК 1.03-08, зимний коэффициент удорожания применяется{" "}
                <strong className="text-red-300">строго в период декабрь-март</strong> для I-IV температурных зон РК. Алматы относится ко II температурной зоне, апрель в неё не входит. Применение Кз в апреле — нарушение, сумма подлежит снятию полностью.
              </div>
            )}
          </div>

          {/* Упражнение 4 */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 mb-5">
            <div className="text-sm text-orange-400 font-semibold mb-2">
              Упражнение 4 · Двойной счёт (задвоение)
            </div>
            <p className="text-slate-200 mb-2">
              Подрядчик предъявил штукатурку стен{" "}
              <strong className="text-red-300">380 м²</strong> одновременно в двух позициях (Сб.15-1{" "}
              <em>и</em> Сб.15-2) по цене{" "}
              <strong className="text-red-300">4 800 тг/м²</strong>. Рассчитайте сумму возврата (одна из двух позиций — задвоение):
            </p>
            <div className="font-mono text-xs bg-slate-950/60 p-3 rounded border border-slate-800 mb-4 text-slate-300">
              380 м² × 4 800 тг/м² = ? (сумма задвоенной позиции = сумма возврата)
            </div>
            <div className="flex gap-3 items-center mb-3">
              <input
                type="text"
                value={q4}
                onChange={(e) => setQ4(e.target.value)}
                placeholder="введите сумму в тг"
                className="flex-1 px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:border-orange-500 outline-none font-mono"
              />
              <span className="text-slate-500 text-sm">тг</span>
            </div>
            {check4() !== null && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  check4()
                    ? "bg-green-950/40 border border-green-800 text-green-300"
                    : "bg-red-950/40 border border-red-800 text-red-300"
                }`}
              >
                {check4()
                  ? "✓ Верно (±10%). Подрядчик обязан вернуть всю сумму задвоенной позиции."
                  : "✗ Неверно. Проверьте умножение объёма на цену."}
              </div>
            )}
            <button
              onClick={() => setShow4(!show4)}
              className="mt-3 text-xs text-orange-400 hover:text-orange-300 underline"
            >
              {show4 ? "Скрыть решение" : "Показать решение"}
            </button>
            {show4 && (
              <div className="mt-3 p-4 bg-slate-950/60 rounded-lg border border-slate-800 text-sm text-slate-300 font-mono">
                380 × 4 800 = <strong className="text-orange-300">1 824 000 тг</strong>
                <br />
                <span className="text-slate-400 text-xs">
                  Согласно п. 4.5 МДС 81-25.2001, повторное предъявление одной работы недопустимо.
                  Заказчик имеет право требовать полный возврат суммы задвоенной позиции в течение
                  10 рабочих дней.
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Section 4: Скрипты претензий */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-red-300">
            ✉️ Section 4. 5 скриптов претензионных писем
          </h2>
          <div className="space-y-4">
            {claimLetters.map((l, i) => (
              <details
                key={i}
                className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden group"
              >
                <summary className="px-6 py-4 cursor-pointer hover:bg-slate-900 transition flex items-center justify-between">
                  <span className="font-semibold text-orange-300">{l.title}</span>
                  <span className="text-slate-500 text-xs group-open:rotate-180 transition">
                    ▼
                  </span>
                </summary>
                <div className="px-6 pb-5 pt-2 border-t border-slate-800">
                  <div className="text-sm text-slate-300 leading-relaxed italic bg-slate-950/40 p-4 rounded-lg border border-slate-800/60">
                    {l.body}
                  </div>
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* Расценки factoid */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-red-300">
            💰 Ключевые расценки и коэффициенты
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
              <div className="text-xs text-orange-400 font-semibold mb-2">Кр (район РК)</div>
              <div className="text-2xl font-bold text-slate-100 mb-1">1.16</div>
              <div className="text-xs text-slate-400">Алматинская обл. (по СН РК 1.03-08)</div>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
              <div className="text-xs text-orange-400 font-semibold mb-2">Индекс СМР Q2/2026</div>
              <div className="text-2xl font-bold text-slate-100 mb-1">1.45</div>
              <div className="text-xs text-slate-400">К ценам 2001 г. (КЦСР РК)</div>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
              <div className="text-xs text-orange-400 font-semibold mb-2">Допустимое расхождение</div>
              <div className="text-2xl font-bold text-slate-100 mb-1">±5%</div>
              <div className="text-xs text-slate-400">Между проектом и КС-2 (МДС 81-35.2004)</div>
            </div>
          </div>

          <div className="mt-6 bg-gradient-to-br from-red-950/60 to-red-900/30 border-2 border-red-700/60 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="text-4xl">⚖️</div>
              <div>
                <div className="text-sm text-red-300 font-bold uppercase tracking-wide mb-2">
                  Критический факт · ГК РК
                </div>
                <p className="text-slate-200 leading-relaxed">
                  Срок ответа подрядчика на письменную претензию заказчика —{" "}
                  <strong className="text-red-300">30 дней</strong> (ст. 651-655 ГК РК). При отсутствии мотивированного ответа в этот срок заказчик имеет право:
                </p>
                <ul className="mt-3 space-y-1 text-sm text-slate-300 list-disc pl-5">
                  <li>обратиться в суд с иском о взыскании необоснованно полученных сумм;</li>
                  <li>
                    начислить штраф{" "}
                    <strong className="text-orange-300">0.1% за каждый день просрочки</strong> (если предусмотрено договором);
                  </li>
                  <li>удержать спорную сумму из ближайшей оплаты КС-3;</li>
                  <li>
                    расторгнуть договор в одностороннем порядке с компенсацией затрат заказчика.
                  </li>
                </ul>
                <p className="mt-3 text-xs text-red-400">
                  ⚠️ Все претензии оформляются письменно с уведомлением о вручении или через
                  ЭДО — устные договорённости в суде не доказательство.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer back link */}
        <div className="pt-6 border-t border-slate-800">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="inline-flex items-center gap-2 text-red-400 hover:text-red-300 transition"
          >
            ← Вернуться к разделам drawings-practice
          </Link>
        </div>
      </main>
    </div>
  );
}
