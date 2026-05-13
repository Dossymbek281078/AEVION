"use client";

import Link from "next/link";
import { useState } from "react";

export default function ConstructionDisputesPage() {
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

  const checkEx1 = () => setEx1Res(ex1 === "b" ? "ok" : "bad");
  const checkEx2 = () => {
    // Сумма 20 млн тг × 1% (за подачу иска по экон. спору) + пошлина за апелляцию 50% = 300 000 тг
    // Минимум — 3% от иска для физлиц, 1% для юрлиц (ст. 535 НК РК), макс 10 000 МРП
    // Для 20 млн × 1% = 200 000 тг (для юрлиц, но не менее 10 МРП ≈ 37 000)
    const v = parseFloat(ex2);
    if (!isFinite(v)) return setEx2Res("bad");
    setEx2Res(Math.abs(v - 200_000) <= 20_000 ? "ok" : "bad");
  };
  const checkEx3 = () => setEx3Res(ex3 === "c" ? "ok" : "bad");
  const checkEx4 = () => setEx4Res(ex4 === "d" ? "ok" : "bad");

  const stages = [
    {
      n: 1,
      name: "Претензионный порядок (досудебный)",
      who: "Сторона-инициатор → Контрагент",
      doc: "Претензия с конкретным требованием, расчётом суммы и сроком",
      time: "30 дней на ответ по ГК РК ст. 706 (для подряда) — без этого иск не принимают",
      cost: "Только почтовые расходы 1-3 тыс. тг (заказное письмо с уведомлением)",
    },
    {
      n: 2,
      name: "Переговоры и медиация",
      who: "Стороны + медиатор (нейтр. лицо или адвокат-посредник)",
      doc: "Соглашение об урегулировании (или протокол разногласий)",
      time: "10-30 дней",
      cost: "Медиатор: 50-300 тыс. тг в зависимости от стажа",
    },
    {
      n: 3,
      name: "СМЭС — Специализир. межрайонный экон. суд",
      who: "Только для юрлиц/ИП. Один судья. Алматы, Астана, обл. центры",
      doc: "Исковое заявление + копии договора, КС-2/КС-3, претензии, доказательства",
      time: "2 мес. рассмотрение + апелляция 30 дней + кассация 30 дней",
      cost: "Гос. пошлина: 1% от иска (физ. — 3%) + адвокат 200-1000 тыс. тг",
    },
    {
      n: 4,
      name: "МКАС при НПП «Атамекен» (Международный коммерч. арбитраж)",
      who: "По соглашению сторон (арбитражная оговорка). 1-3 арбитра",
      doc: "Иск + договор с арбитражной оговоркой",
      time: "Обычно 3-6 мес., решение окончательное",
      cost: "Регистр. сбор + гонорар арбитра — суммарно 1-5% от иска",
    },
    {
      n: 5,
      name: "Международный арбитраж (LCIA London, ICC Paris, SIAC Singapore)",
      who: "Только если в договоре есть арбитражная оговорка",
      doc: "Request for Arbitration по правилам выбранного арбитража",
      time: "1-2 года",
      cost: "Стоимость от 50-200 тыс. $, обычно для контрактов > 10 млн $",
    },
    {
      n: 6,
      name: "Исполнительное производство",
      who: "ЧСИ (частный судебный исполнитель) — после вступления решения в силу",
      doc: "Исполнительный лист от суда",
      time: "До 2 мес. на добровольное исполнение, потом принуд.",
      cost: "5% от взысканной суммы — комиссия ЧСИ",
    },
  ];

  const disputes = [
    {
      kind: "Задержка оплаты Заказчиком после КС-2",
      cause: "Заказчик не оплачивает в срок, аргументирует претензией к качеству",
      law: "ГК РК ст. 716 — заказчик обязан принять и оплатить в срок",
      tip: "Обязательное подписание КС-2 фиксирует приёмку. Без замечаний в КС-2 — основание для иска",
    },
    {
      kind: "Не подписан КС-2 при готовности работ",
      cause: "Заказчик уклоняется от приёмки — затягивает оплату",
      law: "ГК РК ст. 716.4 — при уклонении подрядчик подписывает КС-2 в одностороннем порядке через нотариуса",
      tip: "Уведомление о готовности → ожидание 5 раб. дней → односторонний акт → иск с приложением",
    },
    {
      kind: "Скрытые недостатки после ввода",
      cause: "Через 6-18 мес. появились дефекты (протечки, осадки, плесень)",
      law: "ГК РК ст. 723 — гарантия 2 года на работы. При выявлении тайных дефектов — 5 лет",
      tip: "Заказчик: фотофиксация + независимая экспертиза до подачи претензии",
    },
    {
      kind: "Изменение объёма работ без допсоглашения",
      cause: "Подрядчик выполнил больше, чем по договору, требует доплату",
      law: "ГК РК ст. 718 — при увеличении объёма более 10% нужно письменное согласование",
      tip: "Без письменного согласия Заказчика дополнительные работы оплате не подлежат",
    },
    {
      kind: "Просрочка ввода объекта",
      cause: "Подрядчик нарушил срок сдачи. Заказчик требует штраф",
      law: "ГК РК ст. 297 + договорная неустойка (обычно 0.1% за день, не более 10%)",
      tip: "Обоснование форс-мажором (карантин, война, погода) снимает ответственность",
    },
    {
      kind: "Споры по объёмам в КС-2",
      cause: "Заказчик считает, что подрядчик завысил объёмы, требует пересчёта",
      law: "ГК РК ст. 716 — приёмка с замечаниями + контрольный обмер с участием обеих сторон",
      tip: "Привлечение независимого инженера или СЭ для контрольного обмера",
    },
    {
      kind: "Невозврат гарантийных удержаний (10%)",
      cause: "Заказчик удерживает 5-10% по договору, но не возвращает после ввода",
      law: "ГК РК ст. 716 — оплата всех сумм по договору, кроме обоснованных удержаний",
      tip: "В договоре чётко прописать условия и сроки возврата удержания",
    },
    {
      kind: "Качество материалов / переделки",
      cause: "Заказчик требует переделать работу из-за некачественных материалов",
      law: "ГК РК ст. 706, 719 — подрядчик несёт ответственность за качество",
      tip: "Все материалы — с паспортами + СФ + протоколами испытаний. Без них — суд почти всегда не на стороне ПД",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Строительные споры</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            ⚖️ Строительные споры и претензии
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            Стройка — <strong className="text-red-300">конфликтная отрасль</strong>. По
            статистике СВА РК (Союз воспомогательных адвокатов), ~ 30% подрядных договоров
            заканчиваются претензией или иском. Сметчик должен знать, как готовить и
            защищать обоснование стоимости в споре, какие документы критичны и как работает
            досудебный + судебный + арбитражный порядок. Регулируется ГК РК ст. 651-673
            (подряд) и ГПК РК (процесс).
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Норматив</div>
              <div className="text-slate-300">ГК РК ст. 651-673 + ГПК РК + ЗРК «О медиации»</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Срок давности</div>
              <div className="text-slate-300">3 года по подрядным спорам (ст. 178 ГК РК)</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Гос. пошлина юрлицам</div>
              <div className="text-slate-300">1% от суммы иска (ст. 535 НК РК)</div>
            </div>
          </div>
        </section>

        {/* Section 1: Этапы спора */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🪜 Section 1. Шесть этапов разрешения спора
          </h2>
          <div className="space-y-3">
            {stages.map((s) => (
              <div key={s.n} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40 flex gap-4">
                <div className="text-3xl font-bold text-red-400 w-12 text-center shrink-0">{s.n}</div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-slate-100 mb-2">{s.name}</h3>
                  <dl className="text-sm grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                    <div>
                      <dt className="text-slate-500 text-xs uppercase tracking-wider">Кто</dt>
                      <dd className="text-slate-300 text-xs">{s.who}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 text-xs uppercase tracking-wider">Документ</dt>
                      <dd className="text-slate-300 text-xs">{s.doc}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 text-xs uppercase tracking-wider">Срок</dt>
                      <dd className="text-amber-300 text-xs">{s.time}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 text-xs uppercase tracking-wider">Стоимость</dt>
                      <dd className="text-emerald-300 text-xs">{s.cost}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Типы споров */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            ⚔️ Section 2. Восемь типов строительных споров
          </h2>
          <div className="space-y-3">
            {disputes.map((d) => (
              <div key={d.kind} className="border border-red-900/40 bg-red-950/20 rounded-xl p-4">
                <h3 className="text-base font-semibold text-red-300 mb-2">{d.kind}</h3>
                <dl className="text-sm space-y-1.5">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Причина</dt>
                    <dd className="text-slate-300 text-xs">{d.cause}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Норма права</dt>
                    <dd className="text-slate-400 text-xs">{d.law}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Практ. совет</dt>
                    <dd className="text-emerald-300 text-xs italic">{d.tip}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Арбитражная оговорка */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📜 Section 3. Арбитражная оговорка в договоре подряда
          </h2>
          <div className="border border-red-800/60 bg-red-950/30 rounded-xl p-5">
            <h3 className="text-red-300 font-semibold mb-3">Типовая оговорка (рекомендуется НПП «Атамекен»)</h3>
            <div className="text-xs text-slate-300 italic border-l-2 border-red-500 pl-4 mb-4">
              «Все споры, разногласия и требования, возникающие из настоящего договора или в связи с
              ним, в том числе касающиеся его действительности, исполнения, нарушения, расторжения
              или прекращения, подлежат разрешению Международным коммерческим арбитражным судом при
              Национальной палате предпринимателей Республики Казахстан «Атамекен» в г. Астана в
              соответствии с его регламентом. Применимое право — материальное право Республики
              Казахстан. Язык арбитража — русский. Состав арбитража — единоличный арбитр (для
              споров до 50 млн тг) или коллегия из трёх арбитров. Решение арбитража является
              окончательным и обязательным для сторон.»
            </div>
            <div className="text-xs text-slate-400">
              <strong className="text-red-300">Преимущества арбитража перед СМЭС:</strong>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>Решение окончательное (нет апелляций, кассации) — экономия времени</li>
                <li>Можно выбрать арбитра-эксперта в строительстве</li>
                <li>Конфиденциальность (СМЭС — публичный процесс)</li>
                <li>Для FIDIC-контрактов почти всегда обязательно</li>
              </ul>
              <strong className="text-red-300 block mt-2">Недостатки:</strong>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>Регистрационный сбор + гонорар арбитра — может быть в 2-3 раза выше госпошлины</li>
                <li>Принуд. исполнение через ЧСИ (если ответчик добровольно не заплатит)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Section 4. Упражнения</h2>

          {/* Упр.1 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Обязательный досудебный порядок
            </div>
            <div className="text-slate-200 mb-4">
              Заказчик задержал оплату КС-2 на 60 дней. Подрядчик готов подать иск в СМЭС.
              Что обязательно нужно сделать перед подачей иска?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Сразу подавать иск — досудебный порядок необязателен" },
                { v: "b", t: "Направить претензию заказным письмом с уведомлением + ждать 30 дней ответа" },
                { v: "c", t: "Только устно созвониться с Заказчиком" },
                { v: "d", t: "Обратиться в МКАС НПП «Атамекен» напрямую" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1 === opt.v ? "border-red-600 bg-red-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-red-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex1Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — претензия 30 дней</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-red-300">Решение:</strong> По ГК РК ст. 706 (для подряда)
                и ст. 7 ГПК РК — обязательный досудебный порядок. Без претензии и истечения
                30-дневного срока СМЭС возвращает иск без рассмотрения. Претензия должна
                содержать: ссылку на договор, КС-2 (что приняли), сумму долга (с расчётом),
                расчёт неустойки (если предусмотрена в договоре), банковские реквизиты для
                оплаты, срок ответа. Отправка — только заказным письмом с уведомлением (или
                нарочно с отметкой принятия). Электронная переписка как доказательство —
                принимается с осторожностью.
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Размер гос. пошлины
            </div>
            <div className="text-slate-200 mb-4">
              Подрядчик (юрлицо ТОО) подаёт иск в СМЭС на сумму <strong>20 000 000 тг</strong>
              (взыскание долга по КС-2 + неустойка). Какая гос. пошлина по ст. 535 НК РК?
              (Юрлица — 1% от иска.) Введите сумму в тенге:
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Гос. пошлина, тг</span>
              <input value={ex2} onChange={(e) => setEx2(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="200000" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex2Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 200 000 тг</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь %</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-red-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Гос. пошлина = Сумма иска × 1%
            = 20 000 000 × 0.01
            = 200 000 тг

При выигрыше иска эта пошлина взыскивается с ответчика
в пользу истца (ст. 109 ГПК РК).

Сравнение со ставками для физлиц:
• Физлица — 3% от иска: 20 млн × 3% = 600 000 тг (втрое дороже)

Дополнительные расходы:
• Адвокат: 250 000-1 000 000 тг (одно дело, 2-3 заседания)
• Экспертиза (если назначат): 200-800 тыс. тг
• Свидетели, нотариус: 50-100 тыс. тг

Альтернатива — МКАС НПП «Атамекен»:
• Регистрационный сбор: 50-100 тыс. тг
• Арбитражный сбор: 1.5-3% от иска (для 20 млн ~ 300-600 тыс.)
• Дороже, но окончательное решение без апелляций.

Апелляция: 50% от первоначальной пошлины = 100 000 тг.`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Скрытые недостатки
            </div>
            <div className="text-slate-200 mb-4">
              Через <strong>18 месяцев</strong> после ввода в эксплуатацию торгового центра в
              стене образовалась сквозная трещина из-за неправильно рассчитанной осадки
              фундамента. Срок гарантии в договоре подряда не прописан. Какой срок ответственности
              подрядчика по ГК РК?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "1 год — общий гарантийный срок" },
                { v: "b", t: "2 года — стандартный гарантийный срок по подряду" },
                { v: "c", t: "5 лет — для скрытых недостатков (ГК РК ст. 723.5)" },
                { v: "d", t: "Без срока — пока существует объект" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex3 === opt.v ? "border-red-600 bg-red-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex3" value={opt.v} checked={ex3 === opt.v} onChange={() => setEx3(opt.v)} className="accent-red-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 5 лет</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-red-300">Решение:</strong> ГК РК ст. 723.5: «требования
                в связи со скрытыми недостатками, не выявленными в момент приёмки результата
                работы», могут быть предъявлены в <strong>пятилетний</strong> срок со дня
                фактической передачи результата работы заказчику. Для обычных недостатков (не
                скрытых) — 2-летний гарантийный срок. Сквозная трещина из-за неверного
                расчёта осадки — типичный скрытый недостаток (на этапе приёмки её ещё не было,
                и обнаружить было невозможно). Заказчик имеет право требовать: устранения за
                счёт подрядчика, или возмещения стоимости устранения, или соразмерного
                уменьшения цены работы (ст. 720 ГК РК).
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Уклонение от приёмки
            </div>
            <div className="text-slate-200 mb-4">
              Подрядчик завершил очередной этап работ и направил Заказчику уведомление о
              готовности с просьбой подписать КС-2. Заказчик уклоняется от приёмки уже более
              месяца, не выходя на контакт. Что делать подрядчику по ГК РК?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Терпеливо ждать — обязанность Заказчика подписать рано или поздно" },
                { v: "b", t: "Подать иск о принуждении к подписанию КС-2 в СМЭС" },
                { v: "c", t: "Остановить работы до подписания КС-2" },
                { v: "d", t: "Через 5 раб. дней после уведомления составить КС-2 в одностороннем порядке через нотариальную фиксацию (ст. 716.4 ГК РК), направить ценным письмом и считать действительным до судебного оспаривания" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex4 === opt.v ? "border-red-600 bg-red-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex4" value={opt.v} checked={ex4 === opt.v} onChange={() => setEx4(opt.v)} className="accent-red-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex4Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — односторонний акт</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-red-300">Решение:</strong> Ст. 716.4 ГК РК прямо
                предусматривает: «при уклонении одной из сторон от подписания акта <strong>в
                нём делается отметка об этом и акт подписывается другой стороной</strong>.
                Односторонний акт сдачи или приёмки результата работы может быть признан
                судом недействительным лишь в случае, если мотивы отказа от подписания акта
                признаны им обоснованными». То есть процедура:
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`1. Направить уведомление о готовности (ценным письмом)
2. Ждать 5 рабочих дней
3. Составить КС-2 с отметкой «Заказчик уклонился от приёмки»
4. Заверить у нотариуса факт уклонения + подписание
5. Направить копию Заказчику ценным письмом
6. Через 30 дней — иск о взыскании по этому КС-2

Бремя доказывания, что были обоснованные причины отказа,
лежит на Заказчике. Без таких причин (= письменных замечаний
к качеству или объёмам) суд почти всегда признаёт
односторонний акт действительным.`}
                </pre>
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          ГК РК ст. 651-673 (Подряд), 706 (Качество), 716 (Приёмка), 720 (Послед. недостатков),
          723 (Гарантии). ГПК РК (Процесс в СМЭС). НК РК ст. 535 (Пошлина). ЗРК «О медиации»
          от 28.01.2011 № 401-IV. МКАС НПП «Атамекен» — atameken.kz/services/arbitration.
        </div>
      </main>
    </div>
  );
}
