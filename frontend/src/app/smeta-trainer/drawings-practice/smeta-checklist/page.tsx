"use client";

import Link from "next/link";
import { useState } from "react";

interface ChecklistItem {
  id: string;
  text: string;
  why: string;
}

const CHECKLIST_GROUPS: { title: string; icon: string; items: ChecklistItem[] }[] = [
  {
    title: "Объёмы работ (ВОР)",
    icon: "📐",
    items: [
      { id: "vor-1", text: "Вычтены проёмы окон и дверей из площади стен", why: "Самая частая ошибка. Завышение площади на 10-20%" },
      { id: "vor-2", text: "Проёмы &lt; 1 м² оставлены (не вычитаются по ЕНиР)", why: "Малые проёмы засчитываются в общей площади — ЕНиР Сб.8" },
      { id: "vor-3", text: "Кладка стен — высота × длина − проёмы, проверен расчёт", why: "Двойной счёт со столбами/пилястрами — частая ошибка" },
      { id: "vor-4", text: "Откосы окон/дверей посчитаны отдельно (м или м²)", why: "Откосы — отдельная позиция ЭСН, забывают часто" },
      { id: "vor-5", text: "Кровля посчитана по уклону (с коэффициентом ~1.05-1.20)", why: "Площадь в плане × Кн (коэффициент наклона), не путать с площадью основания" },
      { id: "vor-6", text: "Полы посчитаны с учётом порогов и вырезов под сантехнику", why: "Площадь чистового пола меньше по периметру + вырезы под унитазы" },
      { id: "vor-7", text: "Объёмы земляных работ с откосами (1:0.5 ÷ 1:1 по типу грунта)", why: "Без откосов завышение V до 30% или нереальная схема" },
      { id: "vor-8", text: "Ширина траншей с запасом 0.3-0.5 м с каждой стороны", why: "Нормативная ширина = диаметр трубы + 2 × запас (СНиП РК 4.01-43)" },
    ],
  },
  {
    title: "Расценки и нормативы",
    icon: "📋",
    items: [
      { id: "rate-1", text: "Расценки ЭСН взяты актуальной редакции (2024 или 2025)", why: "Старые расценки не принимаются ГосЭкспертизой" },
      { id: "rate-2", text: "Сборник ЭСН соответствует виду работ (Сб.6-бетон, Сб.7-сборные...)", why: "Неправильный Сборник = иная стоимость и состав работ" },
      { id: "rate-3", text: "Коэффициенты применены корректно (Кр для региона, Кз зимой)", why: "Кр и Кз нельзя одновременно занижать или применять не к тем позициям" },
      { id: "rate-4", text: "Индексы стоимости на квартал актуальны (по КазЦентрНОТ)", why: "Просроченные индексы могут быть основанием для пересмотра сметы" },
      { id: "rate-5", text: "Цены на материалы — из ССЦ РК или подтверждённые СФ", why: "Без обоснования цены ГосЭкспертиза не примет позицию" },
      { id: "rate-6", text: "Транспортные затраты учтены (не задвоены с уже включёнными в ЭСН)", why: "Часть транспорта уже в ЭСН — двойной счёт частая ошибка" },
      { id: "rate-7", text: "НР по МДС 81-33 (11-22% в зависимости от вида работ)", why: "Один НР для всего объекта вместо корректных по видам — ошибка" },
      { id: "rate-8", text: "СП 8% для жилых, 12% для коммерческих", why: "Применение неверного норматива СП влечёт пересчёт всей сметы" },
    ],
  },
  {
    title: "Структура сметы",
    icon: "📊",
    items: [
      { id: "str-1", text: "Шапка ЛСР заполнена (объект, заказчик, основание, версия)", why: "Без шапки невозможно идентифицировать смету в архиве" },
      { id: "str-2", text: "Сметы пронумерованы по проектным разделам (АР, КЖ, ОВ, ВК, ЭО)", why: "Соответствие разделам проекта — обязательно по СН РК 8.02-05" },
      { id: "str-3", text: "Итоги по разделам и общий итог совпадают", why: "Арифметические ошибки в Excel — частая причина пересчёта" },
      { id: "str-4", text: "ССР включает все 12 глав по СН РК 8.02-05", why: "Пропуск глав (особенно 9, 10, 11, 12) = недосчёт 5-15%" },
      { id: "str-5", text: "Резерв 2-7% заложен (зависит от типа объекта)", why: "Без резерва на непредвиденные — высокий риск перерасхода" },
      { id: "str-6", text: "НДС 12% начислен сверху на итог", why: "Иногда НДС забывают или начисляют дважды (на материалы и на итог)" },
      { id: "str-7", text: "Подписи: сметчик, главный сметчик, утверждение Заказчика", why: "Без подписей смета не имеет юридической силы" },
      { id: "str-8", text: "Дата составления и срок действия указаны", why: "Смета без даты не принимается в банк-кредитор и экспертизу" },
    ],
  },
  {
    title: "Документация и обоснование",
    icon: "📎",
    items: [
      { id: "doc-1", text: "Все цены материалов имеют обоснование (ССЦ или 3 СФ поставщиков)", why: "ГосЭкспертиза требует 3 предложения для нестандартных позиций" },
      { id: "doc-2", text: "Пояснительная записка с описанием конструктива и применённых нормативов", why: "Без ПЗ эксперт не понимает логику расчёта — пересчёт" },
      { id: "doc-3", text: "Расчёт коэффициентов Кр/Кз/индексы документально приложен", why: "Применение коэффициентов без обоснования — отклонение" },
      { id: "doc-4", text: "Карта зон работ (если стройка в нескольких регионах)", why: "Разные Кр для разных регионов — отдельный расчёт по зонам" },
      { id: "doc-5", text: "Спецификации оборудования с производителями и моделями", why: "Без спецификации эксперт не может проверить корректность цен" },
      { id: "doc-6", text: "Заверка работодателя (ТОО) с печатью на каждой странице", why: "Без печати ТОО смета считается неофициальной" },
    ],
  },
  {
    title: "Проверка ошибок",
    icon: "🔍",
    items: [
      { id: "err-1", text: "Сравнение Cost/m² с бенчмарком региона (±15%)", why: "Сильное отклонение от бенчмарка — повод проверить" },
      { id: "err-2", text: "Доля материалов 55-65% от ССР (для жилья)", why: "Если &gt; 70% — возможно завышение материалов или занижение работы" },
      { id: "err-3", text: "Проверены формулы Excel (ctrl+~ показывает формулы)", why: "Жёстко прописанные числа вместо формул — высокий риск ошибок" },
      { id: "err-4", text: "Нет дублирующих позиций (по коду и наименованию)", why: "Дубли часто появляются при копировании из других смет" },
      { id: "err-5", text: "Нет нулевых количеств с ненулевой стоимостью", why: "Артефакт после пересчёта — нужно убрать или объяснить" },
      { id: "err-6", text: "Округления единообразны (тыс. тг, до целых)", why: "Несогласованное округление создаёт неточности в итогах" },
      { id: "err-7", text: "Сверка с предыдущей версией сметы (если есть)", why: "Diff позволяет увидеть, что изменилось, без потерь" },
      { id: "err-8", text: "Контрольный просмотр коллегой («4 глаза»)", why: "Свежий взгляд видит то, что свой замыливается" },
    ],
  },
  {
    title: "Финальная подача",
    icon: "📤",
    items: [
      { id: "send-1", text: "Excel-файл сохранён с правильным именем (Проект_ЛСР_v2_2025-XX-XX.xlsx)", why: "Версионирование обязательно — не путать с черновиками" },
      { id: "send-2", text: "PDF создан со всеми листами и сквозной нумерацией", why: "Часть листов может потеряться при экспорте — проверить" },
      { id: "send-3", text: "PDF подписан ЭЦП через egov.kz", why: "Без подписи нет юридической силы документа" },
      { id: "send-4", text: "Сопроводительное письмо (cover letter) с указанием изменений", why: "Заказчик быстро понимает, что новое в этой версии" },
      { id: "send-5", text: "Передача через ценное письмо или защищённый канал (не WhatsApp)", why: "Юридически значимая передача = доказательство в спорах" },
      { id: "send-6", text: "Архивная копия (Excel + PDF + все документы) на диске компании", why: "В случае утери у Заказчика — есть подтверждение версии" },
    ],
  },
];

export default function SmetaChecklistPage() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
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

  const total = CHECKLIST_GROUPS.reduce((acc, g) => acc + g.items.length, 0);
  const completed = Object.values(checked).filter(Boolean).length;
  const progress = Math.round((completed / total) * 100);

  const toggle = (id: string) => setChecked((p) => ({ ...p, [id]: !p[id] }));
  const toggleWhy = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const checkEx1 = () => setEx1Res(ex1 === "c" ? "ok" : "bad");
  const checkEx2 = () => setEx2Res(ex2 === "b" ? "ok" : "bad");
  const checkEx3 = () => setEx3Res(ex3 === "d" ? "ok" : "bad");
  const checkEx4 = () => setEx4Res(ex4 === "a" ? "ok" : "bad");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Финальный чек-лист</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            ✅ Финальный чек-лист сметчика
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            Перед сдачей сметы Заказчику или в ГосЭкспертизу — пройти этот чек-лист.
            <strong className="text-lime-300"> 44 пункта</strong> в 6 группах: объёмы,
            расценки, структура, документация, проверка ошибок, финальная подача. Каждый
            пункт основан на типовых ошибках, которые встречаются в реальных сметах РК и
            ведут к пересчётам, отклонениям, спорам и штрафам. Используйте как
            интерактивный чек-лист — отмечайте выполненные пункты.
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Пунктов</div>
              <div className="text-slate-300">{total} в 6 группах</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Выполнено</div>
              <div className="text-emerald-300 font-mono">{completed} / {total} ({progress}%)</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Готово к сдаче</div>
              <div className={progress === 100 ? "text-emerald-300 font-bold" : "text-amber-300"}>{progress === 100 ? "✅ Да!" : "⏳ Ещё работа"}</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 w-full bg-slate-800 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${progress === 100 ? "bg-emerald-500" : progress >= 70 ? "bg-amber-500" : "bg-rose-500"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </section>

        {/* Чек-лист */}
        {CHECKLIST_GROUPS.map((g) => {
          const groupCompleted = g.items.filter((i) => checked[i.id]).length;
          return (
            <section key={g.title} className="space-y-3">
              <h2 className="text-xl font-semibold text-slate-100 flex items-center gap-3">
                <span className="text-2xl">{g.icon}</span>
                {g.title}
                <span className="text-xs text-slate-500 font-mono ml-auto">{groupCompleted}/{g.items.length}</span>
              </h2>
              <div className="space-y-2">
                {g.items.map((item) => (
                  <div
                    key={item.id}
                    className={`border rounded-lg p-3 transition ${
                      checked[item.id]
                        ? "border-emerald-800/60 bg-emerald-950/20"
                        : "border-slate-800 bg-slate-900/40"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={!!checked[item.id]}
                        onChange={() => toggle(item.id)}
                        className="mt-1 w-5 h-5 accent-emerald-500 cursor-pointer shrink-0"
                      />
                      <div className="flex-1">
                        <div className={`text-sm ${checked[item.id] ? "text-emerald-300 line-through" : "text-slate-200"}`} dangerouslySetInnerHTML={{ __html: item.text }} />
                        <button
                          onClick={() => toggleWhy(item.id)}
                          className="text-xs text-sky-400 hover:text-sky-300 mt-1"
                        >
                          {expanded[item.id] ? "Скрыть пояснение" : "Зачем это?"}
                        </button>
                        {expanded[item.id] && (
                          <p className="text-xs text-slate-400 mt-2 italic">{item.why}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {/* Упражнения */}
        <section className="space-y-6 pt-8 border-t border-slate-800">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Упражнения на ошибки</h2>

          {/* Упр.1 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Самая частая ошибка
            </div>
            <div className="text-slate-200 mb-4">
              Какая ошибка в смете <strong>встречается чаще всего</strong> и даёт завышение
              5-15% от итоговой суммы?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Неправильная формула в Excel" },
                { v: "b", t: "Использование старых расценок (прошлогодних)" },
                { v: "c", t: "Не вычтены проёмы окон и дверей из площади стен (завышение площади кладки/штукатурки)" },
                { v: "d", t: "Забытый НДС 12%" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1 === opt.v ? "border-lime-600 bg-lime-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-lime-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-lime-600 hover:bg-lime-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex1Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — проёмы</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-lime-300">Решение:</strong> По данным ГосЭкспертизы
                РК (статистика отклонённых смет 2020-2024), <strong>не вычитание проёмов</strong>
                — на первом месте по частоте: ~ 35% смет имеют эту ошибку. Завышение
                площади стен на 10-25% приводит к завышению объёмов кладки, штукатурки,
                покраски — всё это перемножается на расценки и даёт серьёзное удорожание.
                <br /><br />
                Правило по ЕНиР Сб.8: проёмы &gt; 1 м² <strong>вычитаются</strong>, проёмы
                &lt; 1 м² — нет (они входят в норматив). Окно обычное 1.5×1.5 = 2.25 м² →
                вычитается. Окно туалетное 0.5×0.5 = 0.25 м² → нет.
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Найди двойной счёт
            </div>
            <div className="text-slate-200 mb-4">
              Сметчик включил в смету: <strong>(1)</strong> расценку ЭСН на бетонирование
              фундамента (включает доставку бетона миксером в радиусе 5 км) +
              <strong> (2)</strong> отдельную позицию «доставка бетона автомиксером
              50 тг/т·км × 10 км». Что не так?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Всё правильно — две разные позиции" },
                { v: "b", t: "Двойной счёт по доставке: расценка ЭСН уже включает доставку в 5 км. Добавить можно ТОЛЬКО разницу 5 км сверх норматива" },
                { v: "c", t: "Нужно убрать расценку ЭСН и оставить только отдельную доставку" },
                { v: "d", t: "Нужно объединить в одну позицию" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex2 === opt.v ? "border-lime-600 bg-lime-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex2" value={opt.v} checked={ex2 === opt.v} onChange={() => setEx2(opt.v)} className="accent-lime-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-lime-600 hover:bg-lime-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex2Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — двойной счёт</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-lime-300">Решение:</strong> Многие расценки ЭСН РК
                <strong>уже включают</strong> нормативный транспорт в составе. Например,
                бетонирование фундамента — ЭСН включает доставку миксером в радиусе 5 км
                (это «нормативный плечо»). Дополнительная позиция «доставка 10 км» приводит
                к двойному счёту первых 5 км.
                <br /><br />
                <strong>Правильно:</strong> если фактическое плечо &gt; 5 км — добавить
                ТОЛЬКО разницу (10 − 5 = 5 км × 50 тг/т·км × Q тонн). Это часто упускают,
                и ГосЭкспертиза вычитает эти суммы. Чтение пояснений к ЭСН Сб.6
                обязательно — там написано, что включено в норматив.
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Подача в ГосЭкспертизу
            </div>
            <div className="text-slate-200 mb-4">
              Перед подачей сметы в ГосЭкспертизу для бюджетного объекта какой
              <strong> ОДИН ключевой пункт</strong> точно нельзя забыть?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Красивое оформление в Word" },
                { v: "b", t: "Презентация PowerPoint на 50 слайдов" },
                { v: "c", t: "Личный визит к эксперту" },
                { v: "d", t: "Полный пакет обоснований: расценки ЭСН с пометками, цены ССЦ + 3 СФ поставщиков на нестандартные позиции, пояснительная записка, индексы по кварталу, чертежи проекта — без этого экспертиза возвращает на доработку" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex3 === opt.v ? "border-lime-600 bg-lime-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex3" value={opt.v} checked={ex3 === opt.v} onChange={() => setEx3(opt.v)} className="accent-lime-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-lime-600 hover:bg-lime-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — полный пакет обоснований</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-lime-300">Решение:</strong> ГосЭкспертиза в РК
                — это не «эстетическая» проверка, а проверка обоснованности. Эксперт
                смотрит:
                <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
                  <li>Корректность применения расценок ЭСН (соответствует ли работа сборнику)</li>
                  <li>Объёмы — проверка по чертежам</li>
                  <li>Обоснование цен материалов (ССЦ или 3 СФ поставщиков)</li>
                  <li>Применение коэффициентов (Кр для региона, Кз сезонного)</li>
                  <li>Индексы квартала (актуальные на момент составления)</li>
                  <li>НР и СП по нормативу (МДС 81-33)</li>
                </ol>
                Без полного пакета смета возвращается — потеря 30-60 дней времени.
                Подготовка занимает 2-5 рабочих дней даже для опытного сметчика.
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Самоконтроль качества
            </div>
            <div className="text-slate-200 mb-4">
              Финальный (самый важный) шаг перед сдачей сметы — что должен сделать
              профессиональный сметчик?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Дать смету коллеге на «4 глаза» — свежий взгляд видит то, что свои замыливаются на" },
                { v: "b", t: "Отправить сразу, не проверять — всё равно эксперт пересчитает" },
                { v: "c", t: "Подождать до завтра и подать" },
                { v: "d", t: "Спросить у друзей в WhatsApp" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex4 === opt.v ? "border-lime-600 bg-lime-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex4" value={opt.v} checked={ex4 === opt.v} onChange={() => setEx4(opt.v)} className="accent-lime-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-lime-600 hover:bg-lime-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex4Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — «4 глаза»</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-lime-300">Решение:</strong> Принцип «4 глаза»
                (Four Eyes Principle) — стандарт в финансах, аудите, банковских процессах.
                Когда сметчик работает с одним документом несколько дней, его глаз
                «замыливается» — он перестаёт видеть очевидные ошибки. Коллега-сметчик
                за 30 минут просмотра найдёт 2-5 ошибок, которые могли стоить миллионы
                рублей пересчёта.
                <br /><br />
                <strong>На крупных проектах</strong>: смета проходит:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Самопроверка по чек-листу (этот документ)</li>
                  <li>«4 глаза» — проверка коллегой</li>
                  <li>Главный сметчик — финальное согласование</li>
                  <li>Независимая проверка (для крупных проектов 10+ млрд тг)</li>
                  <li>ГосЭкспертиза — внешняя проверка</li>
                </ul>
                Каждый этап ловит 10-30% оставшихся ошибок. Профессиональная подача = 0
                ошибок в финале.
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          СН РК 8.02-05 (ССР). МДС 81-33 (НР). ЕНиР Сб.8 (правило проёмов). Профстандарт
          МТСЗН РК «Сметчик». ГосЭкспертиза РК — экспертиза.kz. Шаблоны проверочных
          листов — внутренние методики крупных строительных компаний РК (BI Group,
          Bazis, Almaty Construction).
        </div>
      </main>
    </div>
  );
}
