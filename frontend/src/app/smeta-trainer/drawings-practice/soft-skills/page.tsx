"use client";

import Link from "next/link";
import { useState } from "react";

export default function SoftSkillsPage() {
  const [ex1, setEx1] = useState<string | null>(null);
  const [ex1Res, setEx1Res] = useState<null | "ok" | "bad">(null);
  const [ex1Sol, setEx1Sol] = useState(false);

  const [ex2, setEx2] = useState<string | null>(null);
  const [ex2Res, setEx2Res] = useState<null | "ok" | "bad">(null);
  const [ex2Sol, setEx2Sol] = useState(false);

  const [ex3, setEx3] = useState<string | null>(null);
  const [ex3Res, setEx3Res] = useState<null | "ok" | "bad">(null);
  const [ex3Sol, setEx3Sol] = useState(false);

  const [ex4, setEx4] = useState<string | null>(null);
  const [ex4Res, setEx4Res] = useState<null | "ok" | "bad">(null);
  const [ex4Sol, setEx4Sol] = useState(false);

  const checkEx1 = () => setEx1Res(ex1 === "c" ? "ok" : "bad");
  const checkEx2 = () => setEx2Res(ex2 === "b" ? "ok" : "bad");
  const checkEx3 = () => setEx3Res(ex3 === "d" ? "ok" : "bad");
  const checkEx4 = () => setEx4Res(ex4 === "b" ? "ok" : "bad");

  const skills = [
    {
      name: "Активное слушание",
      what: "Понимать, что именно беспокоит Заказчика, прежде чем оправдываться или защищаться",
      tech: "Метод STAR: Situation → Task → Action → Result. Перефразируй: «Правильно ли я понял, что вы беспокоитесь о...»",
      use: "Любая встреча с Заказчиком, особенно при конфликте",
    },
    {
      name: "Презентация бюджета",
      what: "Объяснять числа в смете языком ценности, не сухими цифрами",
      tech: "От общего к частному: сначала ССР, потом главы, потом позиции. Показать «что внутри» каждой большой суммы",
      use: "Защита сметы перед Заказчиком, банком, ГосЭкспертизой",
    },
    {
      name: "Управление ожиданиями",
      what: "Не обещать невозможное и не ругаться, когда что-то идёт не по плану",
      tech: "Под-обещание + пере-исполнение (under-promise, over-deliver). Заранее предупреждать о рисках",
      use: "Согласование сроков, обещания скидок, новых работ",
    },
    {
      name: "Конструктивная конфронтация",
      what: "Защищать свою позицию без агрессии и эскалации",
      tech: "DESC: Describe (опиши факт) → Express (вырази эмоции) → Specify (предложи решение) → Consequences (объясни последствия)",
      use: "При споре с прорабом, субподрядчиком, заказчиком о цене или объёме",
    },
    {
      name: "Письменная коммуникация",
      what: "Любая претензия и согласование — в письменном виде, чётко и без эмоций",
      tech: "BLUF (Bottom Line Up Front): главное в первом предложении. Никогда не использовать эмодзи или восклицания в претензиях",
      use: "Переписка по проекту, претензии, ответы на жалобы",
    },
    {
      name: "Тайм-менеджмент",
      what: "Сметчик одновременно работает с 3-5 проектами + срочные правки",
      tech: "Eisenhower Matrix (Срочное×Важное): A — делай, B — планируй, C — делегируй, D — игнорируй. Время-боксы в календаре",
      use: "Ежедневное планирование, реакция на срочные правки от Заказчика",
    },
    {
      name: "Эмоциональный интеллект",
      what: "Распознавать своё и чужое состояние, не реагировать на эмоции эмоциями",
      tech: "Пауза 6 секунд перед ответом на провокацию. Отделять личность от позиции (Hard on the issue, soft on the person)",
      use: "Кризисные совещания, давление сроками, нападки на качество расчётов",
    },
    {
      name: "Сетевые связи (нетворкинг)",
      what: "Сметчик — это люди, которых он знает. Знакомства решают больше, чем формальные процедуры",
      tech: "Регулярные встречи с поставщиками (раз в квартал), участие в конференциях НПП «Атамекен», профсообществ",
      use: "Поиск работы, тендеры, рекомендации, эксклюзивные цены",
    },
  ];

  const negotiation = [
    { step: "BATNA — лучшая альтернатива", what: "Что я буду делать, если переговоры провалятся? Без BATNA — невыгодная позиция", example: "Если Заказчик отказывается от расценки — есть ли другой Заказчик? Деньги на расчётном счёте на месяц?" },
    { step: "ZOPA — зона возможного соглашения", what: "Между моим минимумом и максимумом Заказчика — где зона компромисса?", example: "Я хочу 500 млн, согласен на 470. Заказчик предлагает 450, готов на 480. ZOPA = 470-480 млн" },
    { step: "Якорь (Anchor)", what: "Первая цифра, прозвучавшая в переговорах, психологически закрепляется — называй цифру первым", example: "Если знаю, что справедливо 500 млн, начну с 550 — Заказчик начнёт торговаться от моей цифры" },
    { step: "Win-Win поиск", what: "Часто можно дать что-то малоценное мне, но ценное Заказчику — взамен получить уступку", example: "Дать 30 дней отсрочки оплаты (для меня — 1% годовых) в обмен на +3% к смете (для меня — 15 млн)" },
    { step: "Не делать первый компромисс", what: "Если уступить сразу — Заказчик решит, что у меня большой запас. Защищать позицию аргументами", example: "Не говори «давайте обсудим скидку». Говори «давайте обсудим, как сократить затраты» — это другая операция" },
    { step: "Тишина — оружие", what: "Молчание после своего предложения. Кто первый его нарушит — обычно уступает", example: "После «510 млн — окончательная цена» сидеть в тишине 30 секунд. Заказчик часто говорит первым" },
  ];

  const conflicts = [
    {
      type: "С прорабом / СМР",
      cause: "Я считаю объём, прораб говорит «больше». Конфликт интересов: ему — больше КС-2, мне — точность",
      solution: "Контр-обмер вместе. Если расхождение &gt; 5% — независимая экспертиза. Документ + подпись обеих сторон",
    },
    {
      type: "С Заказчиком (цена)",
      cause: "Заказчик хочет дешевле, я хочу справедливо",
      solution: "Показать структуру сметы, объяснить риски снижения. Win-Win: уменьшить объём или класс материалов, но не цену работ",
    },
    {
      type: "С Заказчиком (срок сдачи)",
      cause: "Заказчик торопит, я не успеваю",
      solution: "Объяснить причины задержки документально. Предложить план катапульты (acceleration) с расчётом стоимости",
    },
    {
      type: "С Гос. Экспертизой",
      cause: "Эксперт исключает позицию или меняет коэффициент",
      solution: "Не спорить, а просить обоснование письменно. Подготовить контр-аргументы со ссылками на нормативы",
    },
    {
      type: "С коллегой-сметчиком",
      cause: "Разные подходы к расчётам, конкуренция в команде",
      solution: "Не выходить на личности. Обсудить в формате «как лучше для проекта». Согласовать общий стандарт",
    },
    {
      type: "С руководителем",
      cause: "Руководитель требует «нарисовать» цифры под бюджет",
      solution: "Документально зафиксировать риски. Не делать «как удобно», иначе потом отвечать. Готов уйти, чем компрометировать профессию",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Soft skills</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🤝 Soft skills сметчика
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            Технические навыки (TS — Technical Skills) дают сметчику первое место работы.
            <strong className="text-purple-300"> Soft skills</strong> (мягкие, надпрофессиональные)
            определяют карьеру. По опросам Harvard Business Review, 75% карьерных успехов
            зависят от soft skills, 25% — от технических. У сметчика особенно: его работа —
            убеждать Заказчика, защищать смету, гасить конфликты с прорабами, презентовать
            числа банку и финдиректору.
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Соотношение TS/SS</div>
              <div className="text-slate-300">25% Hard / 75% Soft — для роста до Главного</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Ключевые навыки</div>
              <div className="text-slate-300">Переговоры, презентации, конфликтология</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">ROI обучения</div>
              <div className="text-slate-300">+30-50% к зарплате за 2-3 года</div>
            </div>
          </div>
        </section>

        {/* Section 1: 8 skills */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🎯 Section 1. Восемь ключевых soft skills
          </h2>
          <div className="space-y-3">
            {skills.map((s) => (
              <div key={s.name} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
                <h3 className="text-base font-semibold text-purple-300 mb-2">{s.name}</h3>
                <dl className="text-sm space-y-1.5">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Что это</dt>
                    <dd className="text-slate-300 text-xs">{s.what}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Техника / методология</dt>
                    <dd className="text-emerald-300 text-xs">{s.tech}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Применение</dt>
                    <dd className="text-slate-400 text-xs italic">{s.use}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Переговоры */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            💼 Section 2. Шесть приёмов переговоров (Гарвардский метод)
          </h2>
          <div className="space-y-3">
            {negotiation.map((n) => (
              <div key={n.step} className="border border-purple-800/40 bg-purple-950/20 rounded-xl p-4">
                <h3 className="text-base font-semibold text-purple-300 mb-2">{n.step}</h3>
                <dl className="text-sm space-y-1.5">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Принцип</dt>
                    <dd className="text-slate-300 text-xs">{n.what}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Пример из жизни сметчика</dt>
                    <dd className="text-amber-300 text-xs italic">{n.example}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Конфликты */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            ⚔️ Section 3. Шесть типичных конфликтов сметчика
          </h2>
          <div className="space-y-3">
            {conflicts.map((c) => (
              <div key={c.type} className="border border-rose-900/40 bg-rose-950/20 rounded-xl p-4">
                <h3 className="text-base font-semibold text-rose-300 mb-2">Конфликт {c.type}</h3>
                <dl className="text-sm space-y-1.5">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Причина</dt>
                    <dd className="text-slate-300 text-xs">{c.cause}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Решение</dt>
                    <dd className="text-emerald-300 text-xs">{c.solution}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Section 4. Упражнения</h2>

          {/* Упр.1 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Активное слушание
            </div>
            <div className="text-slate-200 mb-4">
              Заказчик нервно говорит: «Ваша смета слишком дорогая, у нас бюджет в 2 раза
              меньше!» Какая <strong>лучшая реакция</strong> сметчика?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "«Это объективная цена, рынок диктует»" },
                { v: "b", t: "«Тогда работаем по вашему бюджету, скидка 50%»" },
                { v: "c", t: "«Правильно ли я понял, что вы беспокоитесь о превышении бюджета? Давайте разберём, что именно нас удивляет в этой цене и где можем найти оптимизацию»" },
                { v: "d", t: "«У вас неправильно сформирован бюджет»" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1 === opt.v ? "border-purple-600 bg-purple-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-purple-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex1Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — активное слушание + перефраз</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-purple-300">Решение:</strong> Ответ (c) — это
                классическое активное слушание с тремя элементами:
                <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
                  <li><strong>Перефразирование</strong> («Правильно ли я понял...») — снимает
                  эмоциональную остроту, показывает что ты слышишь Заказчика</li>
                  <li><strong>Эмпатия</strong> («вы беспокоитесь о...») — называние эмоции,
                  это успокаивает</li>
                  <li><strong>Совместная работа</strong> («давайте разберём... где можем
                  найти») — переход от противостояния к сотрудничеству</li>
                </ol>
                Альтернативы провальны: (a) — конфронтация, эскалация конфликта. (b) —
                капитуляция, потеря денег и уважения. (d) — обвинение, точно потеряете
                клиента. Активное слушание — основа продаж, переговоров, психологии.
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Anchor в переговорах
            </div>
            <div className="text-slate-200 mb-4">
              Сметчик и Заказчик начинают переговоры по цене. Кто, по Гарвардскому методу,
              должен <strong>первым</strong> назвать конкретную цифру?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Заказчик — он знает свой бюджет" },
                { v: "b", t: "Сметчик первым — это создаёт «якорь» (Anchor), от которого Заказчик начнёт торговаться" },
                { v: "c", t: "Никто — ждать встречного предложения" },
                { v: "d", t: "Зависит от настроения сторон" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex2 === opt.v ? "border-purple-600 bg-purple-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex2" value={opt.v} checked={ex2 === opt.v} onChange={() => setEx2(opt.v)} className="accent-purple-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex2Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — Anchor работает</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-purple-300">Решение:</strong> Эффект «якоря» (Anchoring
                Effect) — это когнитивное искажение, открытое Канеманом и Тверски (Нобелевская
                премия по экономике 2002 г.). Первая названная цифра психологически
                закрепляется, и все последующие сравниваются с ней. Если сметчик первым
                назвал 500 млн, Заказчик начнёт торговаться от этой цифры (450, 480, 470).
                Если бы Заказчик первым сказал «у нас 300 млн» — сметчик попал в зону 300-400.
                <br /><br />
                <strong>Контрприём для Заказчика</strong> — спрашивать: «Сколько вы планируете?»
                Если сметчик отвечает «зависит от объёма» — это правильно. Если называет
                цифру — становится якорем.
                <br /><br />
                <strong>На практике РК</strong>: тендеры устроены так, что предложение
                подаётся одновременно. Но в свободных переговорах побеждает тот, кто
                первый ставит якорь.
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Конфликт с прорабом
            </div>
            <div className="text-slate-200 mb-4">
              Прораб настаивает на завышении объёма бетона в КС-2 (показывает 120 м³ вместо
              реальных 100). Что должен сделать сметчик?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Согласиться — он прораб, ему виднее" },
                { v: "b", t: "Игнорировать — пусть Заказчик сам разбирается" },
                { v: "c", t: "Поднять скандал в офисе и пожаловаться директору" },
                { v: "d", t: "Предложить совместный контр-обмер с участием Тех. надзора. Если расхождение остаётся — независимая экспертиза. Документально зафиксировать свою позицию" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex3 === opt.v ? "border-purple-600 bg-purple-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex3" value={opt.v} checked={ex3 === opt.v} onChange={() => setEx3(opt.v)} className="accent-purple-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — контр-обмер + документация</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-purple-300">Решение:</strong> Это классический
                конструктивный подход (метод DESC):
                <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
                  <li><strong>Describe</strong> — описать факт: «Я вижу 100 м³ по обмеру,
                  ты — 120. Расхождение 20%»</li>
                  <li><strong>Express</strong> — выразить позицию: «Я не могу подписать
                  120 м³ без подтверждения, иначе несу ответственность за искажение»</li>
                  <li><strong>Specify</strong> — предложить решение: «Давай вместе с
                  Тех. надзором проведём контр-обмер»</li>
                  <li><strong>Consequences</strong> — последствия: «Если не договоримся —
                  привлечём независимую экспертизу. В любом случае моя подпись стоит
                  только под доказанными цифрами»</li>
                </ol>
                <strong>Что НЕ нужно делать:</strong> подписывать «как удобно» (нарушение
                ст. 152 УК РК — служебная подделка, до 5 лет лишения свободы), скандалить
                в офисе (теряете уважение), игнорировать (получаете соучастие). Сметчик
                должен ставить интересы профессии и Заказчика выше «дружбы» с прорабом.
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Письменная коммуникация
            </div>
            <div className="text-slate-200 mb-4">
              Заказчик прислал email: «Что у вас там по смете? Когда уже будет готово?!»
              Как сметчик должен <strong>письменно ответить</strong> в стиле BLUF (Bottom
              Line Up Front)?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "«Скоро будет, работаю над этим. Не волнуйтесь!» — короткий ответ" },
                { v: "b", t: "«Готовность ЛСР — 65%, окончание — пятница 14:00. Сейчас прорабатываю инж. сети. Если нужно ускорение — могу выделить выходные» — BLUF: сразу % готовности + срок + план + опция" },
                { v: "c", t: "Без письменного ответа — лучше позвонить" },
                { v: "d", t: "«У меня много работы, не торопите!» — честно" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex4 === opt.v ? "border-purple-600 bg-purple-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex4" value={opt.v} checked={ex4 === opt.v} onChange={() => setEx4(opt.v)} className="accent-purple-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex4Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — BLUF структура</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-purple-300">Решение:</strong> BLUF (Bottom Line Up
                Front) — это метод военной коммуникации США: главное сразу, детали потом.
                Заказчик хочет знать одно: «Когда?». Ответ (b) даёт это в первом
                предложении («окончание — пятница 14:00»), затем разбивает по фазам:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li><strong>Текущий статус</strong> (% готовности)</li>
                  <li><strong>Срок окончания</strong> (конкретная дата+время)</li>
                  <li><strong>Что сейчас делаю</strong> (детализация работы)</li>
                  <li><strong>Опция ускорения</strong> (даёт Заказчику контроль)</li>
                </ul>
                Это создаёт впечатление профессионализма и контроля над ситуацией.
                Альтернативы провальны: (a) — расплывчато, никакой конкретики. (c) —
                нет письменного следа, потом не докажешь. (d) — переход на эмоции.
                Письменные коммуникации с Заказчиком должны быть в стиле «Что? Когда? Сколько?»
                без эмоций, эмодзи и восклицаний.
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          Гарвардский метод переговоров — «Getting to Yes» (R. Fisher, W. Ury). DESC-модель
          (Bower & Bower, «Asserting Yourself»). Эффект якоря — D. Kahneman, «Thinking,
          Fast and Slow». Eisenhower Matrix. BLUF — US Army Field Manual FM 6-22.
          В РК: курсы «Бизнес-коммуникации» AlmaU, Нархоз, Бизнес-школа НПП «Атамекен».
        </div>
      </main>
    </div>
  );
}
