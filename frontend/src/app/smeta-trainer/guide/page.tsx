"use client";

import Link from "next/link";
import { LEVELS } from "../lib/levels";

/**
 * Руководство пользователя тренажёра — «Как пользоваться».
 * Постоянная справка (в отличие от одноразового OnboardingModal): маршрут учёбы,
 * уровни и зачёты, как составить ЛСР, AI-советник, экзамены, справочники,
 * прогресс, связь с курсом. Контент уровней берётся из levels.ts (single source).
 */

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-7 scroll-mt-16">
      <h2 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">{title}</h2>
      <div className="text-sm text-slate-700 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

const TOC = [
  ["start", "1. С чего начать"],
  ["levels", "2. Уровни и зачёты"],
  ["lsr", "3. Как составить ЛСР"],
  ["ai", "4. AI-советник и цвета"],
  ["exec", "5. Исполнительная документация"],
  ["exams", "6. Экзамены и практика"],
  ["refs", "7. Справочники"],
  ["progress", "8. Прогресс и повторение"],
  ["course", "9. Связь с курсом"],
] as const;

export default function GuidePage() {
  return (
    <main className="min-h-screen bg-slate-100">
      <header style={{ top: "var(--aevion-header-h, 0px)" }} className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/smeta-trainer" className="text-slate-300 hover:text-emerald-400 text-sm">← На главную</Link>
          <span className="text-slate-600">·</span>
          <h1 className="text-sm font-medium">❓ Как пользоваться тренажёром</h1>
        </div>
        <button
          onClick={() => { try { localStorage.removeItem("aevion-smeta-onboarding-v1"); } catch {} window.dispatchEvent(new CustomEvent("smeta-open-onboarding")); }}
          className="text-[11px] text-slate-300 hover:text-emerald-400 px-2 py-1 border border-slate-700 rounded"
        >
          ▶ Запустить онбординг заново
        </button>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Оглавление */}
        <nav className="mb-6 flex flex-wrap gap-2">
          {TOC.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="text-[11px] bg-white border border-slate-200 rounded-full px-3 py-1 text-slate-600 hover:border-emerald-400 hover:text-emerald-700">
              {label}
            </a>
          ))}
        </nav>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-500 mb-6 italic">
            Учебная платформа по сметному делу РК (НДЦС РК 8.01-08-2022). Сквозной кейс — капитальный
            ремонт школы №47, г. Алматы. Ниже — как пройти тренажёр от первого входа до сертификата.
          </p>

          <Section id="start" title="1. С чего начать">
            <p>Тренажёр построен как путь по 5 уровням — от чтения готовой сметы до экспертизы:</p>
            <p className="font-medium text-slate-800">📖 Читаю → ✍️ Составляю → 📋 Актирую → 📐 Проектирую комплект → 🔍 Провожу экспертизу.</p>
            <p>Если вы видите смету впервые — начинайте с <strong>Уровня 1</strong>. Уровни <strong>открыты все сразу</strong> (свободный режим): можно идти по порядку или сразу к нужной теме, но методически рекомендуется по очереди — каждый опирается на предыдущий.</p>
            <p>На главной странице карточки уровней — крупные сверху; ниже сгруппированы справочники и инструменты (см. раздел 7).</p>
          </Section>

          <Section id="levels" title="2. Уровни и зачёты">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="py-1.5 pr-2">Ур.</th>
                    <th className="py-1.5 pr-2">Роль</th>
                    <th className="py-1.5 pr-2">Цель обучения</th>
                    <th className="py-1.5 pr-2">Зачёт</th>
                    <th className="py-1.5 pr-2 whitespace-nowrap">Часы</th>
                  </tr>
                </thead>
                <tbody>
                  {LEVELS.map((l) => (
                    <tr key={l.num} className="border-b border-slate-100 align-top">
                      <td className="py-1.5 pr-2 font-bold">{l.icon} {l.num}</td>
                      <td className="py-1.5 pr-2 whitespace-nowrap">{l.role}<div className="text-slate-400">{l.title}</div></td>
                      <td className="py-1.5 pr-2 text-slate-600">{l.objective}</td>
                      <td className="py-1.5 pr-2 text-slate-600">{l.zachetCriteria}</td>
                      <td className="py-1.5 pr-2 text-slate-500">{l.timeHours} ч</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>Статус уровня: <span className="text-slate-500">«Не начат»</span> → <span className="text-amber-600">«В процессе»</span> → <span className="text-emerald-600">«Зачтён»</span>. Когда все 5 зачтены — на главной появляется <strong>🎓 Сертификат</strong>.</p>
            <p>Балл экзамена — 0–100: считается по доле верно учтённых позиций, коэффициентов и отсутствию AI-замечаний относительно эталона. Оценка: ≥85 отлично, ≥70 хорошо, ≥50 удовл.</p>
          </Section>

          <Section id="lsr" title="3. Как составить ЛСР (Уровень 2)">
            <ol className="list-decimal pl-5 space-y-1">
              <li><strong>Найдите расценку:</strong> кнопка «+ Добавить расценку» открывает боковую панель. Ищите по шифру (ЭСНСб…) или словам («штукатурка»), фильтруйте по категории.</li>
              <li><strong>Задайте объём</strong> в единицах нормы. Если норма на «100 м²», а площадь 2699 м² — объём = 26.99. В поле «формула» запишите подсчёт (для ВОР).</li>
              <li><strong>Коэффициенты условий:</strong> кнопка <strong>+К</strong> на строке. Для действующего здания — «действующий-объект» К=1.15. Коэффициент удорожает <strong>ФОТ и ЭМ</strong>, но не материалы (СН РК 8.02-05). Указывайте обоснование (ППР/приказ).</li>
              <li><strong>Индексы и метод</strong> — в шапке ЛСР (квартал/регион). Итоги (ПЗ, НР, СП, НДС) считаются автоматически и всегда видны снизу.</li>
              <li>Смета <strong>сохраняется в браузере</strong> автоматически; экспорт — кнопка «⬇ Экспорт» (CSV/PDF/JSON).</li>
            </ol>
          </Section>

          <Section id="ai" title="4. AI-советник и цвета">
            <p>Правая панель: вкладка <strong>«Замеч.»</strong> показывает найденные ошибки, вкладка <strong>«💬 Спросить AI»</strong> — чат, который видит вашу смету.</p>
            <p>Цвет = значение замечания:</p>
            <ul className="list-none pl-0 space-y-1">
              <li><span className="inline-block w-3 h-3 rounded-full bg-emerald-500 align-middle mr-2" />Зелёный — корректно / информация.</li>
              <li><span className="inline-block w-3 h-3 rounded-full bg-amber-400 align-middle mr-2" />Жёлтый — внимание (возможная неточность, проверьте).</li>
              <li><span className="inline-block w-3 h-3 rounded-full bg-red-500 align-middle mr-2" />Красный — ошибка (двойной счёт, забыта опалубка и т.п.).</li>
            </ul>
            <p>У каждого замечания есть «Как исправить» и ссылка на норматив. Кнопка 💬 на строке позиции открывает чат с готовым вопросом по этой позиции.</p>
          </Section>

          <Section id="exec" title="5. Исполнительная документация (Уровень 3)">
            <p>КС-2 (акт выполненных работ) за каждый месяц, КС-3 (справка о стоимости нарастающим итогом), дополнительные сметы по дефектным актам. Печатные формы — в разделе <Link href="/smeta-trainer/documents" className="text-emerald-700 underline">📄 Документы</Link>: ССР (Форма 1), ЛСР, КС-2, КС-3 → печать/PDF.</p>
          </Section>

          <Section id="exams" title="6. Экзамены и практика">
            <p><Link href="/smeta-trainer/exam" className="text-emerald-700 underline">🎓 Экзамены</Link> — 15 кейсов с типовой ошибкой: составьте/проверьте смету, система оценит. Журнал хранит все попытки. <Link href="/smeta-trainer/capstone" className="text-emerald-700 underline">Капстоун</Link> — итоговое комплексное задание. Уровень 5 — «найди 7 ошибок».</p>
          </Section>

          <Section id="refs" title="7. Справочники (когда нужны)">
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>ССЦ / Реальные расценки</strong> — текущие сметные цены ресурсов (Форма 4).</li>
              <li><strong>Индексы</strong> — коэффициенты пересчёта базис→текущий по кварталам.</li>
              <li><strong>Методика / Калькулятор</strong> — нормативы НР/СП, структура ССР, расчёт позиции.</li>
              <li><strong>Глоссарий / Шпаргалка</strong> — термины (ЛСР, ПЗ, ФОТ, НР…) и формулы на одной странице.</li>
              <li><strong>Труд + машины</strong> — тарифы по разрядам, стоимость машино-часа.</li>
            </ul>
          </Section>

          <Section id="progress" title="8. Прогресс и повторение">
            <p>Прогресс (зачёты, теория, streak 🔥) сохраняется в браузере. 🧠 Интервальное повторение возвращает слабые темы. <Link href="/smeta-trainer/dashboard" className="text-emerald-700 underline">Dashboard</Link> — сводка, лидерборд и достижения. Сброс прогресса — в настройках dashboard.</p>
          </Section>

          <Section id="course" title="9. Связь с курсом smeta-rk-kurs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <tbody>
                  {[
                    ["Урок 2.3 — объёмы", "Экзамен «отделка класса»: вычет проёмов + AI"],
                    ["Урок 2.4 — НР/СП", "Экзамен «категория раздела» + калькулятор нормативов"],
                    ["Урок 2.5 — индексы", "Раздел «Индексы»: применение и двойной учёт"],
                    ["Урок 2.6 — материалы/коэффициенты", "Печатные формы + сценарии ресурсной части"],
                  ].map(([a, b]) => (
                    <tr key={a} className="border-b border-slate-100 align-top">
                      <td className="py-1.5 pr-3 font-medium text-slate-800 whitespace-nowrap">{a}</td>
                      <td className="py-1.5 text-slate-600">{b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-slate-500">При входе из LMS по ссылке урока тренажёр открывает нужный режим и возвращает зачёт обратно в курс.</p>
          </Section>

          <p className="text-[11px] text-slate-400 italic border-t border-slate-200 pt-3 mt-4">
            Учебный тренажёр. Методика соответствует НДЦС РК 8.01-08-2022; числовые значения нормативов — учебные.
            Реальная экспертиза — ИСТ Эталон + госэкспертиза.
          </p>
        </div>
      </div>
    </main>
  );
}
