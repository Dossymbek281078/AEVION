"use client";

import Link from "next/link";
import { useState } from "react";

export default function ExportImportReportsPage() {
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

  const checkEx1 = () => setEx1Res(ex1 === "b" ? "ok" : "bad");
  const checkEx2 = () => setEx2Res(ex2 === "c" ? "ok" : "bad");
  const checkEx3 = () => setEx3Res(ex3 === "d" ? "ok" : "bad");
  const checkEx4 = () => setEx4Res(ex4 === "b" ? "ok" : "bad");

  const formats = [
    {
      ext: ".xlsx",
      name: "Microsoft Excel",
      who: "Универсальный — Заказчик, ГосЭкспертиза, банки, аудит",
      pros: "Открывается везде, можно править формулы, привычен всем",
      cons: "Большие сметы (10 000+ позиций) тормозят, нет защищённой структуры",
      use: "Базовый формат обмена. Локально-сетевой вариант для Drive/SharePoint",
    },
    {
      ext: ".pdf",
      name: "Portable Document Format",
      who: "Финальная версия для подписи Заказчиком, печать, архив",
      pros: "Нельзя редактировать, точная вёрстка, юридич. значимость с ЭЦП",
      cons: "Нельзя править — только полная пересборка",
      use: "Для подписания и архива. Каждая версия — отдельный файл с датой",
    },
    {
      ext: ".csv",
      name: "Comma-Separated Values",
      who: "Программисты, интеграция с 1С / БД / API",
      pros: "Текстовый, лёгкий, парсится любым языком",
      cons: "Нет форматирования, теряется структура многоуровневых смет",
      use: "Для миграции данных, ETL, импорта в Power BI / Tableau",
    },
    {
      ext: ".est",
      name: "АВС-4 / ИСТ Эталон родной",
      who: "Сметчики, использующие АВС-4 / ИСТ Эталон",
      pros: "Сохраняет всю структуру — расценки, индексы, коэффициенты",
      cons: "Открывается только в этих программах",
      use: "Передача между сметчиками одной программы",
    },
    {
      ext: ".sm",
      name: "Гранд-Смета (RU + адаптация РК)",
      who: "Российские интеграции, частично используется в РК",
      pros: "Богатый функционал, обмен с другими русск. ПО",
      cons: "Лицензия дорогая, есть АВС-4 как местный аналог",
      use: "Для проектов с российским участием",
    },
    {
      ext: ".xml / .ifc",
      name: "Стандарт BIM-обмена (ISO 16739)",
      who: "BIM-проекты, экспорт из Revit, передача в сметы 5D",
      pros: "Универсальный обмен 3D-моделями, привязка к ВОР",
      cons: "Сложная структура, требует BIM-координатора",
      use: "Для FIDIC-проектов и бюджетных > 2 млрд тг (с 2025)",
    },
    {
      ext: ".json",
      name: "JavaScript Object Notation",
      who: "Современные веб-приложения, API",
      pros: "Лёгкий, человекочитаемый, идеально для API",
      cons: "Нет встроенной защиты от изменений",
      use: "AEVION Smeta использует .json для корпуса (ssc-2025-*.json)",
    },
    {
      ext: ".rar / .zip",
      name: "Архив (контейнер)",
      who: "Передача комплекта документов на ГосЭкспертизу",
      pros: "Все файлы вместе, сжатие, целостность",
      cons: "Нужно распаковывать перед использованием",
      use: "ССЦ РК с НШ КСМ выкладывается в .rar по 92 файла",
    },
  ];

  const reports = [
    { name: "ЛСР — Локальный сметный расчёт", purpose: "Базовый документ сметы — позиции, объёмы, расценки, итог", format: ".xlsx / .pdf", who: "Сметчик → Экспертиза" },
    { name: "ВОР — Ведомость объёмов работ", purpose: "Только объёмы без цен, для тендера", format: ".xlsx / .csv", who: "Сметчик → Тендерный отдел" },
    { name: "ОСР — Объектная сметная расчёт", purpose: "Свод всех ЛСР на объект", format: ".xlsx / .pdf", who: "Сметчик → ССР" },
    { name: "ССР — Свод. сметный расчёт", purpose: "Полный финансовый план объекта (12 глав)", format: ".xlsx / .pdf", who: "Главный сметчик → Заказчик" },
    { name: "КС-2 — Акт выполненных работ", purpose: "Ежемесячная отчётность факта работ", format: ".xlsx (часто) / .pdf (подп.)", who: "Подрядчик → Заказчик" },
    { name: "КС-3 — Справка о стоимости", purpose: "Сумма к оплате на основе КС-2", format: ".xlsx / .pdf", who: "Подрядчик → Бухгалтерия Заказчика" },
    { name: "Ф-3 — Финансовая отчётность", purpose: "Свод финансовых показателей объекта", format: ".xlsx", who: "Финдиректор → Совет директоров" },
    { name: "АОСР — Акт скрытых работ", purpose: "Подтверждение качества скрытых работ", format: ".pdf (с подписями)", who: "Подрядчик + ТН + АН" },
  ];

  const examplesABS = [
    { feature: "Поэтапная локальная смета", abc4: "✅ Полная поддержка", smeta_rk: "✅ Полная поддержка", aevion: "⚠️ Только учебный режим" },
    { feature: "ССР с 12 главами", abc4: "✅", smeta_rk: "✅", aevion: "❌" },
    { feature: "Импорт из .xlsx", abc4: "✅ Гибкий", smeta_rk: "✅ С шаблонами", aevion: "❌ (планируется)" },
    { feature: "Экспорт в АВС-4 формат", abc4: "✅ Native", smeta_rk: "⚠️ Через .xlsx", aevion: "❌" },
    { feature: "ИНтеграция с BIM/Revit", abc4: "⚠️ Плагин", smeta_rk: "✅ С 2024", aevion: "❌" },
    { feature: "База ССЦ РК", abc4: "✅ Подписка", smeta_rk: "✅ Подписка", aevion: "✅ Бесплатно (ssc-2025)" },
    { feature: "AI-советник на ошибках", abc4: "❌", smeta_rk: "⚠️ Базовые проверки", aevion: "✅ QCoreAI" },
    { feature: "Стоимость", abc4: "180-500 тыс. тг/год", smeta_rk: "150-450 тыс. тг/год", aevion: "Бесплатно (учебный)" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Экспорт/Импорт</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            📤 Экспорт, импорт и отчётность
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            Смета — это не только расчёт, но и <strong className="text-pink-300">обмен
            данными</strong> между десятками сторон: Заказчик, Эксперт, Банк, Подрядчики,
            Бухгалтерия, Аудит. Каждая сторона работает с разными форматами и программами.
            Сметчик должен уметь экспортировать в нужный формат, импортировать чужие сметы,
            конвертировать между АВС-4 / Смета РК / Excel / PDF, и выпускать стандартные
            отчётные формы (ЛСР, ВОР, ОСР, ССР, КС-2, КС-3, Ф-3, АОСР).
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Базовый формат</div>
              <div className="text-slate-300">Excel (.xlsx) — универсальный</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Для подписи</div>
              <div className="text-slate-300">PDF + ЭЦП через egov.kz</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Программы РК</div>
              <div className="text-slate-300">АВС-4, ИСТ Эталон, Смета РК, Гранд-Смета</div>
            </div>
          </div>
        </section>

        {/* Section 1: Форматы */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🗂 Section 1. Восемь форматов файлов сметчика
          </h2>
          <div className="space-y-3">
            {formats.map((f) => (
              <div key={f.ext} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
                <div className="flex items-baseline justify-between gap-4 mb-2">
                  <h3 className="text-base font-semibold text-pink-300">
                    <code className="bg-slate-950 px-2 py-1 rounded text-pink-400 mr-2 text-sm">{f.ext}</code>
                    {f.name}
                  </h3>
                  <span className="text-xs text-amber-300 italic shrink-0 max-w-md text-right">{f.who}</span>
                </div>
                <dl className="text-sm grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Плюсы</dt>
                    <dd className="text-emerald-300 text-xs">+ {f.pros}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Минусы</dt>
                    <dd className="text-rose-300 text-xs">− {f.cons}</dd>
                  </div>
                  <div className="md:col-span-2">
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Применение</dt>
                    <dd className="text-slate-400 text-xs italic">{f.use}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Отчёты */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📋 Section 2. Восемь стандартных отчётов сметчика
          </h2>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Отчёт</th>
                  <th className="text-left px-4 py-3">Назначение</th>
                  <th className="text-left px-4 py-3 w-44">Формат</th>
                  <th className="text-left px-4 py-3">Кому</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {reports.map((r) => (
                  <tr key={r.name} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 text-pink-300 font-medium">{r.name}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{r.purpose}</td>
                    <td className="px-4 py-3 text-amber-300 text-xs">{r.format}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{r.who}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Сравнение программ */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🆚 Section 3. Сравнение программ сметчика
          </h2>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Функция</th>
                  <th className="text-left px-4 py-3">АВС-4</th>
                  <th className="text-left px-4 py-3">Смета РК</th>
                  <th className="text-left px-4 py-3">AEVION Smeta Trainer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {examplesABS.map((e) => (
                  <tr key={e.feature} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 text-slate-100 text-xs">{e.feature}</td>
                    <td className="px-4 py-3 text-xs">{e.abc4}</td>
                    <td className="px-4 py-3 text-xs">{e.smeta_rk}</td>
                    <td className="px-4 py-3 text-xs">{e.aevion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 4: Импорт */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📥 Section 4. Импорт чужих смет
          </h2>
          <div className="border border-pink-800/60 bg-pink-950/30 rounded-xl p-5">
            <h3 className="text-pink-300 font-semibold mb-3">Типовой сценарий импорта</h3>
            <pre className="text-xs whitespace-pre-wrap font-mono text-slate-300 bg-slate-950 p-3 rounded border border-slate-800">
{`Заказчик прислал смету в .xlsx (200 листов, 5000 строк).
Сметчик должен импортировать её, провести анализ и
выставить контр-предложение.

ШАГ 1. Анализ структуры файла
   - Открыть в Excel, изучить листы
   - Найти заголовки колонок, формулы
   - Проверить версию ССЦ/индексов

ШАГ 2. Скрипт импорта (Python pandas)
   import pandas as pd
   xl = pd.ExcelFile("smeta.xlsx")
   for sheet in xl.sheet_names:
       df = xl.parse(sheet, skiprows=5)  # пропуск шапки
       df.columns = ["code", "name", "unit", "qty", "price", "total"]
       df.to_csv(f"output/{sheet}.csv", encoding="utf-8-sig")

ШАГ 3. Валидация (Zod / pandera)
   - Все коды расценок существуют в ЭСН РК
   - Объёмы > 0, цены > 0
   - Сумма = qty × price (с округлением)

ШАГ 4. Сравнение с базой
   - Поиск дублей по fuzzy-match
   - Z-score аномалий по ценам
   - Сравнение с собственными базами ССЦ

ШАГ 5. Отчёт о расхождениях
   - В Excel-таблице: «Завышена арматура на 18%»,
     «Не учтены откосы окон», «Лишний коэффициент Кр»
   - Передача Заказчику для пересмотра`}
            </pre>
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Section 5. Упражнения</h2>

          {/* Упр.1 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Формат для подписи
            </div>
            <div className="text-slate-200 mb-4">
              Заказчик подписывает финальную смету ЭЦП через egov.kz и сдаёт в архив для
              аудита. Какой формат файла обязателен для юридически значимого подписания?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: ".xlsx — Excel" },
                { v: "b", t: ".pdf — Portable Document Format (с подписью ЭЦП)" },
                { v: "c", t: ".doc — Microsoft Word" },
                { v: "d", t: ".csv — текстовый формат" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1 === opt.v ? "border-pink-600 bg-pink-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-pink-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex1Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — PDF с ЭЦП</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-pink-300">Решение:</strong> PDF — единственный формат,
                поддерживающий ЭЦП РК через egov.kz и pki.gov.kz. ЭЦП встраивается в PDF
                (PAdES стандарт ISO 32000), и любое последующее изменение файла делает
                подпись недействительной. Excel-файл нельзя «защитить» от изменений
                криптографически — даже после блокировки листа любой может пересохранить файл.
                Word — слабая защита через макросы. Поэтому: для рабочих версий — Excel, для
                подписи — PDF. После подписания PDF становится «оригинальным» документом,
                Excel-источник остаётся как рабочий файл сметчика.
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Импорт из АВС-4
            </div>
            <div className="text-slate-200 mb-4">
              Подрядчик прислал смету в формате <strong>.avs</strong> (родной АВС-4). У сметчика
              нет лицензии АВС-4, только Excel. Как открыть смету?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Переименовать .avs в .xlsx — Excel откроет" },
                { v: "b", t: "Попросить друга с АВС-4 открыть и переслать" },
                { v: "c", t: "Установить trial-версию АВС-4 (бесплатно 30 дней), открыть, экспортировать в .xlsx" },
                { v: "d", t: "Невозможно — нужна полная лицензия АВС-4" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex2 === opt.v ? "border-pink-600 bg-pink-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex2" value={opt.v} checked={ex2 === opt.v} onChange={() => setEx2(opt.v)} className="accent-pink-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex2Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — trial + экспорт</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-pink-300">Решение:</strong> АВС-4 имеет trial-версию
                на 30 дней с полным функционалом, включая экспорт в .xlsx, .pdf, .est.
                Стратегия:
                <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
                  <li>Скачать АВС-4 trial с avs-4.kz</li>
                  <li>Установить, открыть .avs-файл</li>
                  <li>Меню Файл → Экспорт → выбрать .xlsx</li>
                  <li>Открыть в Excel, работать как обычно</li>
                  <li>Деинсталлировать после использования (или продлить trial через
                  смену email — не рекомендуется юридически)</li>
                </ol>
                Переименование расширения не сработает — .avs это бинарный формат с
                собственной структурой. Альтернатива: попросить отправителя экспортировать
                в .xlsx (5 минут работы) — это правильный «дипломатический» способ.
                Для постоянной работы сметчик должен иметь либо лицензию АВС-4, либо
                использовать AEVION Smeta Trainer / Смета РК / Гранд-Смета.
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Структура ССР
            </div>
            <div className="text-slate-200 mb-4">
              При составлении Сводного Сметного Расчёта (ССР) для бюджетного объекта в РК
              необходимо разделить затраты на главы. Сколько <strong>стандартных глав</strong>
              в ССР по СН РК 8.02-05?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "5 глав" },
                { v: "b", t: "8 глав" },
                { v: "c", t: "10 глав" },
                { v: "d", t: "12 глав (1-Подгот. + 2-9-Осн. ССМР + 10-Прочие + 11-Подгот. персонала + 12-ПИР)" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex3 === opt.v ? "border-pink-600 bg-pink-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex3" value={opt.v} checked={ex3 === opt.v} onChange={() => setEx3(opt.v)} className="accent-pink-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 12 глав</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-pink-300">Решение:</strong> ССР по СН РК 8.02-05
                включает 12 глав:
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Гл.1  — Подготовка территории (расчистка, снос, перенос сетей)
Гл.2  — Основные объекты строительства (здания, сооружения)
Гл.3  — Объекты подсобного и обслуж. назначения (трансформат., ИТП)
Гл.4  — Энерг. хозяйство (ЛЭП, КТП, котельные)
Гл.5  — Транспортное хозяйство (внутр. дороги, ж/д подъезды)
Гл.6  — Наружные сети ВК, тепло, газ, связь
Гл.7  — Благоустройство и озеленение
Гл.8  — Временные здания и сооружения на стройплощадке
Гл.9  — Прочие работы и затраты (природоохр., обмеры, экспертиза)
Гл.10 — Содержание дирекции (тех. надзор)
Гл.11 — Подготовка эксплуатац. кадров
Гл.12 — Проектно-изыскательские работы (ПИР) + ГосЭкспертиза

После 12 глав:
• Резерв на непредвиденные затраты (2-3% для объектов гос.,
  5-7% для коммерческих, до 10% для FIDIC)
• НДС 12%
• Итого ССР`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Конвертер форматов
            </div>
            <div className="text-slate-200 mb-4">
              Сметчик ведёт работу в AEVION Smeta Trainer (.json внутр. формат), но должен
              отдать смету Заказчику для подписи и в банк-кредитор для финансирования.
              Какая последовательность экспорта правильная?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "JSON → CSV → PDF" },
                { v: "b", t: "JSON → XLSX (для Заказчика и банка) → PDF (с ЭЦП для подписи)" },
                { v: "c", t: "JSON → DOCX → PDF" },
                { v: "d", t: "JSON → RAR-архив с JSON-файлами" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex4 === opt.v ? "border-pink-600 bg-pink-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex4" value={opt.v} checked={ex4 === opt.v} onChange={() => setEx4(opt.v)} className="accent-pink-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex4Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — JSON→XLSX+PDF</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-pink-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Правильная цепочка экспорта:

1. JSON (исходный формат AEVION Smeta Trainer)
        ↓
2. XLSX → передача Заказчику для проверки и комментариев
        ↓
3. (Заказчик возвращает с правками или утверждает)
        ↓
4. JSON-файл правится сметчиком
        ↓
5. XLSX (финальная версия) + PDF (с ЭЦП для подписания)
        ↓
6. PDF подписывается Заказчиком + ГП + проектировщиком
        ↓
7. PDF подаётся в банк-кредитор + ГосЭкспертизу + архив

CSV — для интеграции с 1С и BI-системами Заказчика, не для
обмена сметами целиком.
DOCX — устаревший формат, не используется для смет.
RAR — для архивирования комплекта документов, не для одной сметы.

В AEVION Smeta Trainer экспорт реализуется через библиотеку
ExcelJS (для xlsx) + jsPDF / pdfmake (для pdf). Подписание ЭЦП —
через интеграцию с egov.kz API (внешний сервис).`}
                </pre>
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          СН РК 8.02-05 (Состав ССР). АВС-4 — avs-4.kz. ИСТ Эталон — etalonsmeta.ru/kz.
          Гранд-Смета — grandsmeta.ru. ЭЦП РК — egov.kz / pki.gov.kz. Стандарт PAdES
          (PDF Advanced Electronic Signature) — ISO 32000. AEVION Smeta использует
          ExcelJS + jsPDF для экспорта.
        </div>
      </main>
    </div>
  );
}
