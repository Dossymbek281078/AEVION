"use client";

import Link from "next/link";
import { useState } from "react";

interface Objection {
  num: number;
  phrase: string;
  wrong: string;
  right: string;
  argument: string;
}

const OBJECTIONS: Objection[] = [
  {
    num: 1,
    phrase: "Слишком дорого",
    wrong: "Согласиться и снизить цену",
    right: "Запросить бюджет и показать структуру",
    argument:
      "«Понимаю Ваше беспокойство. Давайте разберём смету построчно — где конкретно дорого? ФОТ по ЭСН РК, материалы по прайсу с НДС, индекс утверждён приказом Минстроя. Готов показать обоснование каждой статьи.»",
  },
  {
    num: 2,
    phrase: "У конкурентов дешевле",
    wrong: "«Они демпингуют, мы лучшие»",
    right: "Попросить смету конкурента и разобрать",
    argument:
      "«Покажите, пожалуйста, их смету — разберём построчно. Часто экономия = занижение объёмов, отсутствие НР/СП, бросовые материалы без сертификатов или они работают без НДС. Через 3 месяца Вы доплатите в 2 раза больше.»",
  },
  {
    num: 3,
    phrase: "Откуда такая цена на материал",
    wrong: "«Так на рынке»",
    right: "Показать 3 прайса поставщиков",
    argument:
      "«Вот выписки от 3 поставщиков (АСТАНА-СТРОЙ, СтройМаркет КЗ, KazSnab) на дату составления сметы. Средняя цена — наша позиция. Прайсы с НДС, печатями, актуальны на месяц расчёта.»",
  },
  {
    num: 4,
    phrase: "Зачем НР и СП",
    wrong: "«Это нам на жизнь»",
    right: "Сослаться на МДС 81-33 и МДС 81-25",
    argument:
      "«Накладные расходы (НР) — это содержание ИТР, охрана труда, временные сооружения, зарплата прорабов. Сметная прибыль (СП) — модернизация фондов, налоги. Это не «маржа», это нормативные статьи по МДС РК. Без них компания не выживет до завершения объекта.»",
  },
  {
    num: 5,
    phrase: "Уберём индекс — это ваш заработок",
    wrong: "Уступить и убрать",
    right: "Показать приказ Минстроя РК",
    argument:
      "«Индекс перевода в текущие цены — это НЕ заработок подрядчика. Это коэффициент, утверждённый приказом Минстроя РК на квартал, который компенсирует инфляцию между базой 2001 года и сегодняшним днём. Уберём индекс — будем строить по ценам 2001 года, это нереально.»",
  },
  {
    num: 6,
    phrase: "У нас бюджет 15 млн, делайте за это",
    wrong: "Согласиться и резать качество",
    right: "Предложить оптимизацию объёма",
    argument:
      "«Понял Ваш бюджет. Давайте подумаем что можно оптимизировать: исключить какие-то работы из этапа 1, заменить премиум-материалы на средний сегмент с сертификатами, разбить на 2 этапа по году. Резать саму смету при тех же объёмах — это уход в минус и срыв.»",
  },
];

interface ChecklistItem {
  num: number;
  title: string;
  details: string;
}

const PREP_CHECKLIST: ChecklistItem[] = [
  {
    num: 1,
    title: "Обоснование расценок ЭСН",
    details:
      "Выписки из сборников ЭСН РК с шифрами расценок. Каждая позиция сметы — со ссылкой на конкретный сборник и пункт. ИСТ Эталон выписки если есть подписка.",
  },
  {
    num: 2,
    title: "Прайсы поставщиков (3+ источника)",
    details:
      "Минимум 3 коммерческих предложения от разных поставщиков на каждый ключевой материал. С печатями, НДС, датой действия. Это защита от обвинений в завышении.",
  },
  {
    num: 3,
    title: "Сертификаты на материалы",
    details:
      "СТ-РК / ГОСТ-сертификаты на бетон, арматуру, кабель, окна. Если заказчик торгуется — показать что мы НЕ ставим бросовый материал, отсюда цена.",
  },
  {
    num: 4,
    title: "Расчёт себестоимости с детализацией ФОТ/М/Э",
    details:
      "Прямые затраты разнесены: ФОТ (фонд оплаты труда), М (материалы), ЭМ (эксплуатация машин). Накладные и сметная прибыль — отдельной строкой со ссылкой на МДС.",
  },
  {
    num: 5,
    title: "Статистика по аналогичным объектам",
    details:
      "Кейсы 3-5 аналогичных объектов, выполненных нами. Стоимость кв.м, сроки, удовлетворённость заказчиков. Это снимает возражение «у конкурентов дешевле».",
  },
];

interface Exercise {
  id: string;
  title: string;
  question: string;
  options: { key: string; text: string }[];
  correct: string;
  explanation: string;
}

const EXERCISES: Exercise[] = [
  {
    id: "ex1",
    title: "Возражение «уберите 20%»",
    question:
      "Заказчик говорит: «У конкурентов смета на 20% дешевле — уберите 20% и подпишем договор». Что делать?",
    options: [
      { key: "a", text: "Согласиться — клиент важнее" },
      { key: "b", text: "Уйти от обсуждения, сказать «подумаю»" },
      { key: "c", text: "Попросить смету конкурента и разобрать построчно" },
      { key: "d", text: "Дать символическую скидку 5% и закрыть тему" },
    ],
    correct: "c",
    explanation:
      "Правильно (c) — запросить смету конкурента. В 90% случаев там либо занижены объёмы, либо нет НР/СП, либо «бросовый» материал. Разбор построчно лишает заказчика аргумента. Скидка 20% без оптимизации = уход в минус.",
  },
  {
    id: "ex2",
    title: "Статья для обоснованной скидки",
    question:
      "Заказчик упёрся, нужна скидка 8-15%. На какой статье сметы это возможно ОБОСНОВАННО (без срыва качества)?",
    options: [
      { key: "a", text: "ФОТ — снизить тарифную сетку рабочих" },
      {
        key: "b",
        text: "Материалы по индивидуальным ценам через прямые контракты с заводами",
      },
      { key: "c", text: "Накладные расходы (НР)" },
      { key: "d", text: "ЭСН-расценки — пересчитать с понижающим коэффициентом" },
    ],
    correct: "b",
    explanation:
      "Правильно (b) — индивидуальные цены через прямые контракты с производителями (например, бетонный завод напрямую) дают 10-15% экономии без потери качества. Снижать ФОТ нельзя — рабочие уйдут. НР — нормативная статья. ЭСН-расценки нельзя «понижать» произвольно.",
  },
  {
    id: "ex3",
    title: "Минимальный СП по МДС 81-25",
    question:
      "Заказчик спрашивает: «Какая у вас сметная прибыль и почему?» Минимальный СП для общестроительных работ в РК по МДС 81-25 — это сколько % от ФОТ?",
    options: [
      { key: "a", text: "30%" },
      { key: "b", text: "50% от ФОТ для общестроя (для отделки — 65%)" },
      { key: "c", text: "65%" },
      { key: "d", text: "80%" },
    ],
    correct: "b",
    explanation:
      "Правильно (b) — по МДС 81-25 для общестроительных работ норматив СП = 50% от ФОТ, для отделочных = 65% от ФОТ. Это не «маржа подрядчика», а нормативная статья на модернизацию основных фондов и налоги. Документ — Методические указания по определению сметной прибыли в строительстве.",
  },
  {
    id: "ex4",
    title: "Защита индекса 1.45",
    question:
      "Заказчик торгуется: «Уберите индекс перевода 1.45 — это слишком много». Что показать как главный аргумент?",
    options: [
      {
        key: "a",
        text: "Выписку из ИСТ Эталон / приказ Минстроя РК с актуальными индексами на квартал",
      },
      { key: "b", text: "Сослаться на «так принято в отрасли»" },
      { key: "c", text: "Снизить индекс до 1.30 в качестве компромисса" },
      { key: "d", text: "Сказать «это норматив РК» без документального подтверждения" },
    ],
    correct: "a",
    explanation:
      "Правильно (a) — выписка из ИСТ Эталон или официальный приказ Минстроя РК с актуальными квартальными индексами. Это документ нормативного характера, который снимает торг полностью. Просто слова «это норматив» — слабый аргумент. Снижать индекс самовольно нельзя — это бюджетная экспертиза не пропустит.",
  },
];

interface Script {
  title: string;
  emoji: string;
  text: string[];
}

const SCRIPTS: Script[] = [
  {
    title: "Открытие встречи",
    emoji: "👋",
    text: [
      "«Добрый день, [Имя Отчество]. Спасибо что нашли время на встречу.»",
      "«Я подготовил подробное обоснование сметы с детализацией по каждой статье — 47 страниц с прайсами поставщиков, выписками ЭСН и расчётом себестоимости.»",
      "«Предлагаю пройтись по структуре: 15 минут — общая картина, 30 минут — Ваши вопросы по конкретным позициям, 15 минут — обсуждение оптимизации если потребуется.»",
      "«Перед тем как начнём — есть ли у Вас сейчас бюджетные ограничения, о которых я должен знать?»",
    ],
  },
  {
    title: "Ответ на «дорого»",
    emoji: "💬",
    text: [
      "«Понимаю Ваше беспокойство. Цена действительно ощутимая.»",
      "«Давайте разберёмся откуда она складывается. Прямые затраты — 67% (ФОТ по ЭСН РК + материалы по прайсам с сертификатами + эксплуатация машин).»",
      "«Накладные расходы — 14%, это нормативно по МДС 81-33. Сметная прибыль — 8%, нормативно по МДС 81-25. Налоги (НДС) — 11%.»",
      "«Если убирать что-то — это либо снижение объёмов, либо замена материалов на средний сегмент с сертификатами. На статьях ЭСН/НР/СП экономить нельзя — это нормативы.»",
      "«Что предложите: смотрим объёмы или класс материалов?»",
    ],
  },
  {
    title: "Закрытие сделки",
    emoji: "🤝",
    text: [
      "«Итак, мы согласовали: объём работ, классы материалов, сроки, график оплаты.»",
      "«Итоговая сумма — [X] млн тенге. Документ обоснования цены (ДОЦ) Вы получили — 47 страниц с приложениями.»",
      "«Предлагаю подписать договор и приложения сегодня. Аванс 30% — старт работ через 5 дней с момента поступления средств на счёт.»",
      "«Гарантия на работы — 24 месяца с даты подписания КС-11. На скрытые работы — акты КС-2 поэтапно.»",
      "«Что нужно дописать в договор с Вашей стороны?»",
    ],
  },
];

export default function CustomerNegotiationsPage() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const handleAnswer = (exId: string, key: string) => {
    setAnswers((prev) => ({ ...prev, [exId]: key }));
  };

  const reveal = (exId: string) => {
    setRevealed((prev) => ({ ...prev, [exId]: true }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-violet-400 hover:text-violet-300 text-sm"
          >
            ← К разделам
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold mt-3 mb-2 bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
            🤝 Переговоры с заказчиком — защита сметы
          </h1>
          <p className="text-slate-400 text-sm">
            Защита итоговой суммы перед заказчиком, обоснование позиций, типичные
            возражения и контраргументы
          </p>
        </div>

        {/* Intro */}
        <section className="mb-10 p-6 bg-gradient-to-br from-violet-950/40 to-indigo-950/40 border border-violet-800/40 rounded-xl">
          <h2 className="text-xl font-semibold text-violet-300 mb-3">
            📋 О чём этот модуль
          </h2>
          <div className="text-slate-300 text-sm leading-relaxed space-y-2">
            <p>
              Защита сметы перед заказчиком — это финальный этап тендера/договора, где
              нужно отстоять КАЖДУЮ цифру. Заказчик всегда будет торговаться: это его
              работа.
            </p>
            <p>
              <strong className="text-violet-300">Ключевая идея:</strong> сметчик —
              не «продавец», который уступает. Сметчик — это{" "}
              <strong>эксперт-нормативист</strong>, который опирается на МДС, ЭСН,
              индексы Минстроя и сертифицированные прайсы поставщиков.
            </p>
            <p>
              Без подготовки переговоры превращаются в эмоциональный торг. С
              подготовкой — в обсуждение оптимизации объёма работ при сохранении
              маржи.
            </p>
          </div>
        </section>

        {/* Section 1: Objections */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-violet-300 mb-4">
            1. Типичные возражения и контраргументы
          </h2>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/80">
                <tr>
                  <th className="px-3 py-3 text-left text-violet-300">№</th>
                  <th className="px-3 py-3 text-left text-violet-300">
                    Фраза заказчика
                  </th>
                  <th className="px-3 py-3 text-left text-red-400">Неправильно</th>
                  <th className="px-3 py-3 text-left text-emerald-400">Правильно</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {OBJECTIONS.map((o) => (
                  <tr key={o.num} className="hover:bg-slate-900/40">
                    <td className="px-3 py-3 align-top text-slate-500 font-mono">
                      {o.num}
                    </td>
                    <td className="px-3 py-3 align-top text-slate-200 font-medium">
                      «{o.phrase}»
                    </td>
                    <td className="px-3 py-3 align-top text-red-300/80 text-xs">
                      {o.wrong}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="text-emerald-300 text-xs font-semibold mb-1">
                        {o.right}
                      </div>
                      <div className="text-slate-400 text-xs italic">
                        {o.argument}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2: Checklist */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-violet-300 mb-4">
            2. Чек-лист подготовки к встрече
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {PREP_CHECKLIST.map((item) => (
              <div
                key={item.num}
                className="p-5 bg-slate-900/60 border border-indigo-800/30 rounded-xl hover:border-indigo-600/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {item.num}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-indigo-300 font-semibold mb-2">
                      {item.title}
                    </h3>
                    <p className="text-slate-400 text-xs leading-relaxed">
                      {item.details}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Exercises */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-violet-300 mb-4">
            3. Интерактивные упражнения
          </h2>
          <div className="space-y-6">
            {EXERCISES.map((ex, idx) => {
              const userAnswer = answers[ex.id];
              const isRevealed = revealed[ex.id];
              const isCorrect = userAnswer === ex.correct;

              return (
                <div
                  key={ex.id}
                  className="p-6 bg-slate-900/60 border border-violet-800/30 rounded-xl"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-shrink-0 w-9 h-9 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
                      {idx + 1}
                    </div>
                    <h3 className="text-lg font-semibold text-violet-200">
                      {ex.title}
                    </h3>
                  </div>
                  <p className="text-slate-300 text-sm mb-4 pl-12">{ex.question}</p>

                  <div className="space-y-2 pl-12">
                    {ex.options.map((opt) => {
                      const selected = userAnswer === opt.key;
                      const showCorrect = isRevealed && opt.key === ex.correct;
                      const showWrong =
                        isRevealed && selected && opt.key !== ex.correct;

                      let cls =
                        "w-full text-left px-4 py-2.5 rounded-lg border transition-colors text-sm ";
                      if (showCorrect) {
                        cls +=
                          "bg-emerald-950/50 border-emerald-600 text-emerald-200";
                      } else if (showWrong) {
                        cls += "bg-red-950/50 border-red-600 text-red-200";
                      } else if (selected) {
                        cls +=
                          "bg-violet-950/50 border-violet-500 text-violet-100";
                      } else {
                        cls +=
                          "bg-slate-950/50 border-slate-700 text-slate-300 hover:border-violet-600";
                      }

                      return (
                        <button
                          key={opt.key}
                          onClick={() => handleAnswer(ex.id, opt.key)}
                          disabled={isRevealed}
                          className={cls}
                        >
                          <span className="font-mono text-xs text-slate-500 mr-2">
                            {opt.key})
                          </span>
                          {opt.text}
                        </button>
                      );
                    })}
                  </div>

                  <div className="pl-12 mt-4 flex items-center gap-3">
                    <button
                      onClick={() => reveal(ex.id)}
                      disabled={isRevealed}
                      className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      {isRevealed ? "Решение показано" : "Показать решение"}
                    </button>
                    {isRevealed && (
                      <span
                        className={
                          isCorrect
                            ? "text-emerald-400 text-sm font-semibold"
                            : "text-red-400 text-sm font-semibold"
                        }
                      >
                        {isCorrect ? "✓ Верно!" : "✗ Неверно"}
                      </span>
                    )}
                  </div>

                  {isRevealed && (
                    <div className="pl-12 mt-3 p-3 bg-indigo-950/40 border border-indigo-800/40 rounded-lg">
                      <p className="text-indigo-200 text-xs leading-relaxed">
                        <strong className="text-indigo-300">Пояснение:</strong>{" "}
                        {ex.explanation}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 4: Scripts */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-violet-300 mb-4">
            4. Готовые скрипты переговоров
          </h2>
          <div className="space-y-4">
            {SCRIPTS.map((script, idx) => (
              <div
                key={idx}
                className="p-6 bg-gradient-to-br from-slate-900/80 to-violet-950/30 border border-violet-800/40 rounded-xl"
              >
                <h3 className="text-lg font-semibold text-violet-200 mb-3 flex items-center gap-2">
                  <span className="text-2xl">{script.emoji}</span>
                  {script.title}
                </h3>
                <div className="space-y-2 pl-2 border-l-2 border-violet-600/50">
                  {script.text.map((line, i) => (
                    <p key={i} className="text-slate-300 text-sm pl-4 italic">
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Factoid */}
        <section className="mb-12">
          <div className="p-6 bg-gradient-to-br from-violet-900/40 to-indigo-900/40 border-2 border-violet-600/50 rounded-xl">
            <div className="flex items-start gap-4">
              <div className="text-4xl">📜</div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-violet-200 mb-2">
                  Factoid: ДОЦ — Документ Обоснования Цены
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed mb-3">
                  В Республике Казахстан для всех{" "}
                  <strong className="text-violet-300">бюджетных объектов</strong>{" "}
                  (госзакупки, госзаказ, объекты с государственным участием){" "}
                  <strong>обязателен ДОЦ</strong> — Документ Обоснования Цены.
                </p>
                <p className="text-slate-300 text-sm leading-relaxed mb-3">
                  ДОЦ — это пакет документов, который включает: расчёт стоимости с
                  детализацией ФОТ/М/ЭМ, прайсы поставщиков (3+ источника на каждый
                  материал), выписки ЭСН РК, сертификаты на материалы, обоснование
                  индексов перевода (приказ Минстроя), расчёт НР и СП со ссылкой на
                  МДС 81-33 и МДС 81-25.
                </p>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Без ДОЦ сметная экспертиза НЕ пропустит документацию. На частных
                  объектах ДОЦ не обязателен формально, но опытный сметчик готовит
                  его всегда — это лучшая защита на переговорах.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Rates / Tariffs */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-violet-300 mb-4">
            💰 Нормативные ставки (РК, актуально 2025)
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-5 bg-slate-900/60 border border-indigo-800/30 rounded-xl">
              <h3 className="text-indigo-300 font-semibold mb-3">
                Накладные расходы (НР) по МДС 81-33
              </h3>
              <ul className="text-slate-300 text-xs space-y-1.5">
                <li>• Общестроительные работы — 95% от ФОТ</li>
                <li>• Земляные работы — 92% от ФОТ</li>
                <li>• Отделочные работы — 105% от ФОТ</li>
                <li>• Монтаж металлоконструкций — 90% от ФОТ</li>
                <li>• Электромонтажные — 95% от ФОТ</li>
              </ul>
            </div>
            <div className="p-5 bg-slate-900/60 border border-indigo-800/30 rounded-xl">
              <h3 className="text-indigo-300 font-semibold mb-3">
                Сметная прибыль (СП) по МДС 81-25
              </h3>
              <ul className="text-slate-300 text-xs space-y-1.5">
                <li>
                  • Общестроительные работы — <strong>50% от ФОТ</strong>
                </li>
                <li>
                  • Отделочные работы — <strong>65% от ФОТ</strong>
                </li>
                <li>• Монтажные работы — 60% от ФОТ</li>
                <li>• Ремонтно-строительные — 50% от ФОТ</li>
                <li>• Капитальный ремонт — 50% от ФОТ</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Footer / Summary */}
        <section className="mb-8">
          <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-xl">
            <h2 className="text-xl font-bold text-violet-300 mb-3">
              🎯 Ключевые принципы защиты сметы
            </h2>
            <ul className="text-slate-300 text-sm space-y-2 list-disc pl-6">
              <li>
                <strong className="text-violet-300">Документ важнее слов.</strong>{" "}
                Каждая цифра — со ссылкой на ЭСН, МДС, прайс или приказ Минстроя.
              </li>
              <li>
                <strong className="text-violet-300">
                  Не уступать на нормативах.
                </strong>{" "}
                НР, СП, индексы — это закон, не предмет торга.
              </li>
              <li>
                <strong className="text-violet-300">
                  Оптимизация ≠ скидка.
                </strong>{" "}
                Снижать стоимость можно за счёт объёма работ или класса материалов,
                но не за счёт нормативных статей.
              </li>
              <li>
                <strong className="text-violet-300">Эмоции = проигрыш.</strong>{" "}
                Всегда возвращать разговор к цифрам и документам.
              </li>
              <li>
                <strong className="text-violet-300">ДОЦ — ваш щит.</strong> Готовый
                Документ Обоснования Цены снимает 80% возражений.
              </li>
            </ul>
          </div>
        </section>

        <div className="text-center text-slate-600 text-xs py-4">
          AEVION Smeta Trainer — Модуль: Переговоры с заказчиком (защита сметы)
        </div>
      </div>
    </div>
  );
}
