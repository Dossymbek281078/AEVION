"use client";
import Link from "next/link";
import { useState } from "react";

function checkNum(input: string, expected: number, tol = 0.1): boolean {
  const v = parseFloat(input.replace(/\s/g, "").replace(",", "."));
  if (isNaN(v)) return false;
  return Math.abs((v - expected) / expected) <= tol;
}

interface DiffRow {
  aspect: string;
  an: string;
  tn: string;
}

interface JournalRow {
  name: string;
  form: string;
  who: string;
  purpose: string;
}

interface ChoiceOption {
  id: string;
  label: string;
}

const NORMS: { code: string; title: string }[] = [
  { code: "СН РК 1.04-26-2011", title: "Авторский надзор за строительством зданий и сооружений" },
  { code: "ГОСТ Р 21.1101-2013", title: "Основные требования к проектной и рабочей документации" },
  { code: "СП РК 1.04-101-2012", title: "Технический надзор заказчика на стройплощадке" },
  { code: "СНиП РК 1.03-05-2001", title: "Охрана труда и техника безопасности в строительстве" },
  { code: "ЭСН Сб. ОВН", title: "Сборник на организационно-вспомогательные расходы (АН/ТН)" },
];

const DIFF_ROWS: DiffRow[] = [
  {
    aspect: "Кто ведёт",
    an: "Автор проекта (проектная организация)",
    tn: "Заказчик (или нанятая им организация)",
  },
  {
    aspect: "Что контролирует",
    an: "Соответствие СМР проектным решениям",
    tn: "Качество работ, объёмы, материалы",
  },
  {
    aspect: "Полномочия",
    an: "Утверждает изменения проекта",
    tn: "Подписывает КС-2, КС-3, акты",
  },
  {
    aspect: "Периодичность",
    an: "Раз в неделю (плановые посещения)",
    tn: "Ежедневно (постоянное присутствие)",
  },
  {
    aspect: "Кто оплачивает",
    an: "Заказчик (по отдельному договору с проектировщиком)",
    tn: "Заказчик отдельно (своему сотруднику или подрядчику)",
  },
  {
    aspect: "Стоимость",
    an: "3-5% от стоимости проектирования",
    tn: "1-2% от стоимости СМР",
  },
];

const JOURNALS: JournalRow[] = [
  {
    name: "Журнал авторского надзора",
    form: "Форма КС-6 (приложение к СН РК 1.04-26)",
    who: "Ведёт автор проекта",
    purpose: "Фиксация замечаний АН и решений по проекту",
  },
  {
    name: "Общий журнал работ",
    form: "Форма КС-6а",
    who: "Ведёт подрядчик, проверяет ТН",
    purpose: "Ежедневная регистрация всех работ на площадке",
  },
  {
    name: "Журнал входного контроля материалов",
    form: "Форма по СП РК 1.04-101",
    who: "Ведёт прораб подрядчика, проверяет ТН",
    purpose: "Соответствие материалов сертификатам и проекту",
  },
  {
    name: "Журнал бетонирования",
    form: "Форма Ф-54 (СНиП РК 5.03-37)",
    who: "Ведёт прораб, контролирует ТН и АН",
    purpose: "Класс бетона, температура, погодные условия, дата заливки",
  },
  {
    name: "АОСР (акты освидетельствования скрытых работ)",
    form: "Приложение Г к СП РК 1.04-101",
    who: "Подписывают подрядчик + ТН + АН",
    purpose: "Фиксация работ, скрываемых последующими (арматура, гидроизоляция)",
  },
];

const CHECKLIST: string[] = [
  "Проверить наличие утверждённой проектной документации со штампом К производству работ",
  "Сверить выполненные работы с рабочими чертежами (РЧ)",
  "Проверить ведение общего журнала работ и журнала АН",
  "Проконтролировать наличие сертификатов на применяемые материалы",
  "Освидетельствовать скрытые работы перед закрытием (арматура, гидроизоляция)",
  "Проверить геометрические параметры конструкций (отклонения от проекта)",
  "Зафиксировать в журнале АН все выявленные отступления от проекта",
  "Дать предписания об устранении нарушений (с указанием срока)",
  "Согласовать или отклонить предложения подрядчика по изменению проекта",
  "Подписать акты освидетельствования и промежуточной приёмки этапов",
];

const Q3_OPTIONS: ChoiceOption[] = [
  { id: "a", label: "Ежедневно (постоянное присутствие на объекте)" },
  { id: "b", label: "1 раз в неделю (плановые посещения)" },
  { id: "c", label: "1 раз в месяц" },
  { id: "d", label: "Только по вызову заказчика" },
];

const Q4_OPTIONS: ChoiceOption[] = [
  { id: "a", label: "При сильном дожде или непогоде" },
  { id: "b", label: "При существенном отступлении от проекта без согласования" },
  { id: "c", label: "При систематическом опоздании рабочих" },
  { id: "d", label: "При обнаружении материалов низкого качества" },
];

export default function AuthorSupervisionPage() {
  const [a1, setA1] = useState("");
  const [a2, setA2] = useState("");
  const [a3, setA3] = useState("");
  const [a4, setA4] = useState("");
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [show3, setShow3] = useState(false);
  const [show4, setShow4] = useState(false);

  const ok1 = checkNum(a1, 160000, 0.15);
  const ok2 = checkNum(a2, 1200000, 0.1);
  const ok3 = a3 === "b";
  const ok4 = a4 === "b";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 border-b border-teal-900/40 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link
            href="/smeta-trainer/drawings-practice"
            className="text-sm text-teal-300 hover:text-teal-200"
          >
            ← К разделам
          </Link>
          <span className="text-xs text-slate-400">Модуль · Надзор на стройке</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-4 py-8">
        <section>
          <h1 className="text-3xl font-bold text-teal-200">
            👁️ Авторский надзор и технадзор на стройке
          </h1>
          <p className="mt-3 text-slate-300">
            <b>Авторский надзор (АН)</b> ведёт проектировщик — он следит, чтобы стройка
            соответствовала его проекту. <b>Технический надзор (ТН)</b> ведёт заказчик —
            он контролирует качество работ, объёмы и расход материалов на стройплощадке.
            Это два разных вида надзора, которые дополняют друг друга и оба обязательны
            для бюджетных объектов и любого строительства категории сложности 2 и выше.
          </p>
          <div className="mt-4 grid gap-2 rounded-lg border border-teal-900/40 bg-teal-950/20 p-4 text-sm">
            <div className="font-semibold text-teal-300">Нормативная база РК:</div>
            {NORMS.map((n) => (
              <div key={n.code} className="flex gap-3">
                <span className="font-mono text-cyan-300">{n.code}</span>
                <span className="text-slate-300">{n.title}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-semibold text-teal-200">
            1. Различия АН и ТН
          </h2>
          <p className="mb-4 text-sm text-slate-400">
            Заказчик часто путает эти два надзора и пытается возложить функции одного на
            другого. На практике это разные специалисты с разными полномочиями и разными
            договорами.
          </p>
          <div className="overflow-x-auto rounded-lg border border-teal-900/40">
            <table className="w-full text-sm">
              <thead className="bg-teal-950/40 text-teal-200">
                <tr>
                  <th className="px-4 py-2 text-left">Аспект</th>
                  <th className="px-4 py-2 text-left">Авторский надзор (АН)</th>
                  <th className="px-4 py-2 text-left">Технический надзор (ТН)</th>
                </tr>
              </thead>
              <tbody>
                {DIFF_ROWS.map((r, i) => (
                  <tr
                    key={r.aspect}
                    className={i % 2 === 0 ? "bg-slate-900/40" : "bg-slate-900/20"}
                  >
                    <td className="px-4 py-2 font-semibold text-slate-200">{r.aspect}</td>
                    <td className="px-4 py-2 text-slate-300">{r.an}</td>
                    <td className="px-4 py-2 text-slate-300">{r.tn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-semibold text-teal-200">
            2. Журналы и документы надзора
          </h2>
          <p className="mb-4 text-sm text-slate-400">
            Любой надзор без бумаг — пустой звук. Все замечания и решения должны быть
            зафиксированы в установленных журналах с подписями ответственных лиц.
          </p>
          <div className="overflow-x-auto rounded-lg border border-teal-900/40">
            <table className="w-full text-sm">
              <thead className="bg-teal-950/40 text-teal-200">
                <tr>
                  <th className="px-4 py-2 text-left">Документ</th>
                  <th className="px-4 py-2 text-left">Форма</th>
                  <th className="px-4 py-2 text-left">Кто ведёт</th>
                  <th className="px-4 py-2 text-left">Назначение</th>
                </tr>
              </thead>
              <tbody>
                {JOURNALS.map((j, i) => (
                  <tr
                    key={j.name}
                    className={i % 2 === 0 ? "bg-slate-900/40" : "bg-slate-900/20"}
                  >
                    <td className="px-4 py-2 font-semibold text-slate-200">{j.name}</td>
                    <td className="px-4 py-2 font-mono text-xs text-cyan-300">{j.form}</td>
                    <td className="px-4 py-2 text-slate-300">{j.who}</td>
                    <td className="px-4 py-2 text-slate-300">{j.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-teal-200">
            3. Интерактивные упражнения
          </h2>

          <div className="rounded-lg border border-teal-900/40 bg-slate-900/40 p-5">
            <div className="mb-2 text-sm font-semibold text-teal-300">
              Упражнение 1 · Расчёт стоимости АН
            </div>
            <p className="text-sm text-slate-300">
              Стоимость проектирования объекта составляет <b>4 млн тг</b> (5% от СМР
              80 млн тг). Тариф авторского надзора — <b>4% от стоимости проектирования</b>.
              Сколько стоит АН на этом объекте?
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                value={a1}
                onChange={(e) => setA1(e.target.value)}
                placeholder="тенге"
                className="w-48 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              />
              <button
                onClick={() => setShow1(!show1)}
                className="rounded bg-teal-700/40 px-3 py-2 text-sm text-teal-200 hover:bg-teal-700/60"
              >
                {show1 ? "Скрыть" : "Показать"} решение
              </button>
              {a1 && (
                <span
                  className={
                    ok1
                      ? "text-sm font-semibold text-green-400"
                      : "text-sm font-semibold text-rose-400"
                  }
                >
                  {ok1 ? "✓ Верно" : "✗ Проверьте расчёт"}
                </span>
              )}
            </div>
            {show1 && (
              <div className="mt-3 rounded bg-slate-950/60 p-3 text-sm text-slate-300">
                <div>Решение:</div>
                <div className="mt-1 font-mono text-cyan-300">
                  4 000 000 тг × 4% = 160 000 тг
                </div>
                <div className="mt-1 text-slate-400">
                  Это базовая ставка. На сложных объектах (категория 3+) тариф может
                  доходить до 5-7% от стоимости проектирования.
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-teal-900/40 bg-slate-900/40 p-5">
            <div className="mb-2 text-sm font-semibold text-teal-300">
              Упражнение 2 · Расчёт стоимости ТН
            </div>
            <p className="text-sm text-slate-300">
              Объект СМР стоимостью <b>80 млн тг</b>, срок строительства <b>6 месяцев</b>,
              ставка технадзора — <b>1.5% от СМР</b>. Какова общая стоимость ТН?
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                value={a2}
                onChange={(e) => setA2(e.target.value)}
                placeholder="тенге"
                className="w-48 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              />
              <button
                onClick={() => setShow2(!show2)}
                className="rounded bg-teal-700/40 px-3 py-2 text-sm text-teal-200 hover:bg-teal-700/60"
              >
                {show2 ? "Скрыть" : "Показать"} решение
              </button>
              {a2 && (
                <span
                  className={
                    ok2
                      ? "text-sm font-semibold text-green-400"
                      : "text-sm font-semibold text-rose-400"
                  }
                >
                  {ok2 ? "✓ Верно" : "✗ Проверьте расчёт"}
                </span>
              )}
            </div>
            {show2 && (
              <div className="mt-3 rounded bg-slate-950/60 p-3 text-sm text-slate-300">
                <div>Решение:</div>
                <div className="mt-1 font-mono text-cyan-300">
                  80 000 000 тг × 1.5% = 1 200 000 тг (за весь срок)
                </div>
                <div className="mt-1 text-slate-400">
                  В пересчёте на месяц: 1 200 000 ÷ 6 = 200 000 тг/мес — типичная зарплата
                  одного инженера ТН на средний объект.
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-teal-900/40 bg-slate-900/40 p-5">
            <div className="mb-2 text-sm font-semibold text-teal-300">
              Упражнение 3 · Периодичность АН
            </div>
            <p className="text-sm text-slate-300">
              С какой периодичностью авторский надзор обязан посещать строительный
              объект согласно СН РК 1.04-26?
            </p>
            <div className="mt-3 space-y-2">
              {Q3_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className={
                    "flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm " +
                    (a3 === opt.id
                      ? "border-teal-500 bg-teal-900/30"
                      : "border-slate-700 hover:border-teal-700/60")
                  }
                >
                  <input
                    type="radio"
                    name="q3"
                    checked={a3 === opt.id}
                    onChange={() => setA3(opt.id)}
                    className="accent-teal-500"
                  />
                  <span className="text-slate-200">
                    <b className="text-cyan-300">{opt.id})</b> {opt.label}
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                onClick={() => setShow3(!show3)}
                className="rounded bg-teal-700/40 px-3 py-2 text-sm text-teal-200 hover:bg-teal-700/60"
              >
                {show3 ? "Скрыть" : "Показать"} решение
              </button>
              {a3 && (
                <span
                  className={
                    ok3
                      ? "text-sm font-semibold text-green-400"
                      : "text-sm font-semibold text-rose-400"
                  }
                >
                  {ok3 ? "✓ Верно" : "✗ Не верно"}
                </span>
              )}
            </div>
            {show3 && (
              <div className="mt-3 rounded bg-slate-950/60 p-3 text-sm text-slate-300">
                Правильный ответ: <b className="text-teal-300">b) 1 раз в неделю</b>.
                Периодичность плановых посещений АН — еженедельно. На скрытые работы и
                ответственные этапы (бетонирование, монтаж несущих конструкций) — по
                вызову подрядчика дополнительно.
              </div>
            )}
          </div>

          <div className="rounded-lg border border-teal-900/40 bg-slate-900/40 p-5">
            <div className="mb-2 text-sm font-semibold text-teal-300">
              Упражнение 4 · Полномочия АН по остановке работ
            </div>
            <p className="text-sm text-slate-300">
              В каком случае авторский надзор имеет право и обязан остановить работы на
              объекте?
            </p>
            <div className="mt-3 space-y-2">
              {Q4_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className={
                    "flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm " +
                    (a4 === opt.id
                      ? "border-teal-500 bg-teal-900/30"
                      : "border-slate-700 hover:border-teal-700/60")
                  }
                >
                  <input
                    type="radio"
                    name="q4"
                    checked={a4 === opt.id}
                    onChange={() => setA4(opt.id)}
                    className="accent-teal-500"
                  />
                  <span className="text-slate-200">
                    <b className="text-cyan-300">{opt.id})</b> {opt.label}
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                onClick={() => setShow4(!show4)}
                className="rounded bg-teal-700/40 px-3 py-2 text-sm text-teal-200 hover:bg-teal-700/60"
              >
                {show4 ? "Скрыть" : "Показать"} решение
              </button>
              {a4 && (
                <span
                  className={
                    ok4
                      ? "text-sm font-semibold text-green-400"
                      : "text-sm font-semibold text-rose-400"
                  }
                >
                  {ok4 ? "✓ Верно" : "✗ Не верно"}
                </span>
              )}
            </div>
            {show4 && (
              <div className="mt-3 rounded bg-slate-950/60 p-3 text-sm text-slate-300">
                Правильный ответ:{" "}
                <b className="text-teal-300">
                  b) При существенном отступлении от проекта без согласования
                </b>
                . Погода, опоздания и качество материалов — это компетенция ТН и
                подрядчика. АН отвечает только за соответствие проекту и его авторскую
                идею. Решение об остановке оформляется записью в журнале АН.
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-semibold text-teal-200">
            4. Чек-лист посещения объекта АН
          </h2>
          <p className="mb-3 text-sm text-slate-400">
            Стандартный обход объекта инженером авторского надзора занимает 2-4 часа и
            должен охватывать минимум 10 ключевых пунктов:
          </p>
          <ol className="space-y-2 rounded-lg border border-teal-900/40 bg-slate-900/30 p-5">
            {CHECKLIST.map((item, i) => (
              <li key={i} className="flex gap-3 text-sm text-slate-200">
                <span className="font-mono font-bold text-cyan-300">
                  {String(i + 1).padStart(2, "0")}.
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-lg border border-teal-700/40 bg-teal-950/30 p-5">
          <div className="mb-2 text-sm font-semibold text-teal-300">
            Расценки ЭСН Сб. ОВН (организационно-вспомогательные)
          </div>
          <ul className="space-y-1 text-sm text-slate-300">
            <li>
              <span className="font-mono text-cyan-300">ОВН-01-01</span> · Авторский
              надзор — 3-5% от стоимости проектирования
            </li>
            <li>
              <span className="font-mono text-cyan-300">ОВН-01-02</span> · Технический
              надзор заказчика — 1-2% от стоимости СМР
            </li>
            <li>
              <span className="font-mono text-cyan-300">ОВН-01-03</span> · Лабораторный
              контроль качества (входной) — 0.3-0.5% от СМР
            </li>
            <li>
              <span className="font-mono text-cyan-300">ОВН-02-01</span> · Геодезический
              надзор за разбивочными работами — 0.2-0.4% от СМР
            </li>
          </ul>
          <div className="mt-4 border-t border-teal-800/40 pt-3 text-sm text-teal-200">
            <b>Важно:</b> по СНиП РК авторский надзор <b>обязателен</b> для всех зданий
            выше 3 этажей и любых объектов категории сложности <b>2 и выше</b>
            (бюджетные стройки, школы, больницы, мосты, эстакады). Технический надзор
            заказчика обязателен для <b>всех бюджетных объектов</b> без исключений —
            независимо от этажности и сложности. Отсутствие записей АН/ТН в журналах при
            госприёмке — основание для отказа в вводе объекта в эксплуатацию.
          </div>
        </section>

        <div className="pt-6 text-center">
          <Link
            href="/smeta-trainer/drawings-practice"
            className="inline-block rounded-lg bg-teal-700/30 px-6 py-3 text-teal-200 hover:bg-teal-700/50"
          >
            ← Вернуться к разделам
          </Link>
        </div>
      </main>
    </div>
  );
}
