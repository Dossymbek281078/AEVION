"use client";

import Link from "next/link";
import { useState } from "react";

export default function DigitalTwinIotPage() {
  // Упр.1 — что такое 5D
  const [ex1, setEx1] = useState<string | null>(null);
  const [ex1Res, setEx1Res] = useState<null | "ok" | "bad">(null);
  const [ex1Sol, setEx1Sol] = useState(false);

  // Упр.2 — расчёт окупаемости BIM
  const [ex2, setEx2] = useState("");
  const [ex2Res, setEx2Res] = useState<null | "ok" | "bad">(null);
  const [ex2Sol, setEx2Sol] = useState(false);

  // Упр.3 — какой датчик IoT
  const [ex3, setEx3] = useState<string | null>(null);
  const [ex3Res, setEx3Res] = useState<null | "ok" | "bad">(null);
  const [ex3Sol, setEx3Sol] = useState(false);

  // Упр.4 — расчёт стоимости мониторинга
  const [ex4, setEx4] = useState("");
  const [ex4Res, setEx4Res] = useState<null | "ok" | "bad">(null);
  const [ex4Sol, setEx4Sol] = useState(false);

  const checkEx1 = () => setEx1Res(ex1 === "c" ? "ok" : "bad");
  const checkEx2 = () => {
    // Экономия 8% от 500 млн = 40 млн, минус вложения BIM 5 млн → ROI = 35 млн / 5 млн = 7×
    const v = parseFloat(ex2);
    if (!isFinite(v)) return setEx2Res("bad");
    setEx2Res(Math.abs(v - 35_000_000) <= 1_000_000 ? "ok" : "bad");
  };
  const checkEx3 = () => setEx3Res(ex3 === "b" ? "ok" : "bad");
  const checkEx4 = () => {
    // 20 датчиков × 60 000 тг + шлюз 200 000 + ПО 50 000/мес × 12 = 1 400 000 + 600 000 = 2 000 000
    const v = parseFloat(ex4);
    if (!isFinite(v)) return setEx4Res("bad");
    setEx4Res(Math.abs(v - 2_000_000) <= 100_000 ? "ok" : "bad");
  };

  const dimensions = [
    { d: "3D", what: "Геометрия (стены, плиты, окна, инж. сети)", who: "Архитектор + Конструктор", soft: "Revit, ArchiCAD, Allplan, Tekla" },
    { d: "4D", what: "3D + время (календарный план, последовательность работ)", who: "Менеджер проекта + Прораб", soft: "Navisworks Timeliner, Synchro 4D, Bentley SYNCHRO" },
    { d: "5D", what: "4D + стоимость (привязка ВОР, ЭСН, цен к модели)", who: "Сметчик + BIM-координатор", soft: "Cubicost, RIB iTWO, CostX, Vico Office, Гранд-Смета BIM" },
    { d: "6D", what: "5D + эксплуатация (FM — управление зданием через всю жизнь)", who: "Эксплуатация + IoT-инженер", soft: "Autodesk Tandem, Bentley iTwin, IBM TRIRIGA" },
    { d: "7D", what: "6D + устойчивость (углеродный след, life-cycle assessment)", who: "LEED/BREEAM-консультант", soft: "One Click LCA, Tally, Athena Impact Estimator" },
  ];

  const sensors = [
    { kind: "Бетонозрелометры", measure: "Температура и зрелость бетона (модуль M, °C·ч)", price: "60-150 тыс. тг за датчик", apps: "Monoblock, COMAN, Bluetooth-передача на телефон прораба" },
    { kind: "Тензодатчики на арматуре", measure: "Деформации, напряжения в каркасе при заливке", price: "80-200 тыс. тг + регистратор", apps: "Vishay, HBM, для критичных узлов" },
    { kind: "Инклинометры на кранах", measure: "Угол наклона, перегрузка, обрыв строп", price: "150-400 тыс. тг (комплект)", apps: "Liebherr, Potain — встроенные. Для старых кранов — Crane Vision" },
    { kind: "Датчики осадки фундамента", measure: "Геодезическая нивелировка автоматически", price: "200-500 тыс. тг + ПО", apps: "Leica Nivel220, Sokkia, СОДИС для долгосрочного мониторинга" },
    { kind: "Расходомеры воды/электричества", measure: "Учёт ресурсов в режиме реального времени", price: "30-100 тыс. тг с GSM-модулем", apps: "Itron, Sensus, ЛЭМЗ — интеграция с биллингом" },
    { kind: "Датчики качества воздуха (CO₂, PM2.5)", measure: "Микроклимат на стройке и после ввода", price: "20-80 тыс. тг", apps: "Bosch BME680, AirVisual, Awair — для жилых проектов с EDGE" },
    { kind: "Камеры с AI-распознаванием", measure: "Подсчёт рабочих, СИЗ, выявление нарушений ТБ", price: "100-300 тыс. тг за камеру + ПО", apps: "Buildots, OpenSpace, Mobile Construction Lab" },
    { kind: "GPS-трекеры техники", measure: "Координаты, мото-часы, расход топлива", price: "30-80 тыс. тг + 5 000 тг/мес", apps: "Wialon, GLONASSSoft — расчёт КИВ и контроль воровства ГСМ" },
  ];

  const benefits = [
    { metric: "Снижение коллизий проекта", value: "60-90%", note: "На этапе проектирования через Clash Detection (Navisworks)" },
    { metric: "Сокращение сроков", value: "10-25%", note: "За счёт 4D-планирования и точной координации" },
    { metric: "Экономия материалов", value: "5-10%", note: "Точный подсчёт через 5D, минимум остатков" },
    { metric: "Снижение строит. ошибок", value: "30-50%", note: "Меньше переделок, ясная исп. документация" },
    { metric: "Скорость подсчёта ВОР", value: "5-10× быстрее", note: "Автоматическая выборка количеств из BIM-модели" },
    { metric: "Окупаемость BIM-внедрения", value: "1-3 года", note: "Для среднего и крупного девелопера" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Цифровая стройка</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🧬 Цифровой двойник + IoT на стройке
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            <strong className="text-violet-300">Цифровой двойник (Digital Twin)</strong> — это
            живая BIM-модель, в режиме реального времени синхронизированная с физическим объектом
            через сеть IoT-датчиков. Позволяет вести точную приёмку, мониторинг качества, расчёт
            стоимости через 5D-модель и эксплуатацию через 6D. В РК внедрение BIM обязательно с
            2025 г. для бюджетных объектов стоимостью свыше 2 млрд тг (Постановление МИИР РК
            № 132 от 16.05.2023).
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Норматив</div>
              <div className="text-slate-300">ПП МИИР РК № 132 + ISO 19650 + СН РК 1.02-04</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">BIM в РК с 2025</div>
              <div className="text-slate-300">Бюджетные объекты &gt; 2 млрд тг — обязательно</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Уровни Digital Twin</div>
              <div className="text-slate-300">3D → 4D → 5D → 6D → 7D</div>
            </div>
          </div>
        </section>

        {/* Section 1: Измерения BIM */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📐 Section 1. От 3D к 7D — измерения BIM-модели
          </h2>
          <div className="space-y-3">
            {dimensions.map((d) => (
              <div key={d.d} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40 flex gap-4">
                <div className="text-3xl font-bold text-violet-400 w-16 text-center shrink-0">{d.d}</div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-slate-100 mb-2">{d.what}</h3>
                  <div className="text-xs text-slate-400">
                    <span className="text-slate-500 uppercase tracking-wider mr-2">Кто работает:</span>
                    {d.who}
                  </div>
                  <div className="text-xs text-violet-300 mt-1">
                    <span className="text-slate-500 uppercase tracking-wider mr-2">ПО:</span>
                    {d.soft}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: IoT-датчики */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📡 Section 2. Восемь типов IoT-датчиков на стройке
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sensors.map((s) => (
              <div key={s.kind} className="border border-violet-800/40 bg-violet-950/20 rounded-xl p-4">
                <h3 className="text-base font-semibold text-violet-300 mb-2">{s.kind}</h3>
                <dl className="text-sm space-y-1.5">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Что измеряет</dt>
                    <dd className="text-slate-300 text-xs">{s.measure}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Цена</dt>
                    <dd className="text-amber-300 text-xs">{s.price}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Производители</dt>
                    <dd className="text-slate-400 text-xs italic">{s.apps}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Выгоды */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            💎 Section 3. Эффекты от внедрения BIM + IoT
          </h2>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Метрика</th>
                  <th className="text-left px-4 py-3 w-40">Эффект</th>
                  <th className="text-left px-4 py-3">Комментарий</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {benefits.map((b) => (
                  <tr key={b.metric} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 text-slate-100">{b.metric}</td>
                    <td className="px-4 py-3 text-violet-300 font-mono">{b.value}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{b.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 4: Архитектура решения */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🏗 Section 4. Архитектура цифрового двойника
          </h2>
          <div className="border border-violet-800/60 bg-violet-950/30 rounded-xl p-5">
            <pre className="text-xs whitespace-pre-wrap font-mono text-slate-300 overflow-x-auto">
{`┌─────────────────────────────────────────────────────────┐
│       BIM-модель (Revit / ArchiCAD / Tekla)             │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Геометрия + параметры (3D)                     │    │
│  │  + календарный план (4D)                        │    │
│  │  + сметные данные (5D)                          │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
              ↑ синхронизация в обе стороны
┌─────────────────────────────────────────────────────────┐
│   Цифровой двойник (Autodesk Tandem / Bentley iTwin)    │
│       ←── IoT-данные ───→  ←── ERP/Бухгалтерия ──→     │
└─────────────────────────────────────────────────────────┘
              ↑ MQTT / OPC-UA / REST-API
┌─────────────────────────────────────────────────────────┐
│           IoT-шлюз (LoRaWAN / NB-IoT / Wi-Fi)           │
│              ↑                                           │
│   ┌──────────┴──────────┐                               │
│   │                                                       │
│  Датчики на стройке                                      │
│  • Бетонозрелометры       • Камеры с AI-СИЗ            │
│  • Тензодатчики            • GPS-трекеры                 │
│  • Инклинометры кранов     • Расходомеры                │
│  • Датчики осадки          • Датчики воздуха            │
└─────────────────────────────────────────────────────────┘`}
            </pre>
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Section 5. Упражнения</h2>

          {/* Упр.1 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Что такое BIM 5D
            </div>
            <div className="text-slate-200 mb-4">
              Сметчик получает BIM-модель в Revit от проектировщика и хочет автоматически
              получить ВОР со стоимостью. Какое измерение модели ему нужно?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "3D — только геометрия здания" },
                { v: "b", t: "4D — геометрия + календарный план" },
                { v: "c", t: "5D — геометрия + время + стоимость (привязка ЭСН/ВОР)" },
                { v: "d", t: "6D — добавление данных эксплуатации" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1 === opt.v ? "border-violet-600 bg-violet-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-violet-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex1Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 5D</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-violet-300">Решение:</strong> 5D — это BIM с привязкой
                стоимости. Каждый элемент модели (стена, плита, окно) имеет параметры — материал,
                объём, цена за единицу. При выборе элементов программа (Cubicost, RIB iTWO,
                CostX, Vico Office) автоматически генерирует ВОР с расчётом стоимости по
                заданным ЭСН/ССЦ или RSMeans/NRM2. В РК 5D — обязательное требование для
                бюджетных объектов &gt; 2 млрд тг с 2025 г.
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Окупаемость BIM
            </div>
            <div className="text-slate-200 mb-4">
              Девелопер инвестирует в BIM-внедрение <strong>5 000 000 тг</strong> (ПО Revit
              на 3 раб. места, обучение, BIM-менеджер на 6 мес.). На проекте стоимостью
              <strong> 500 млн тг</strong> экономия от BIM составила <strong>8%</strong> от
              сметы. Какая чистая выгода (выгода минус вложения) в тенге?
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Чистая выгода, тг</span>
              <input value={ex2} onChange={(e) => setEx2(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="35000000" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex2Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 35 млн тг</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь расчёт</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-violet-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Шаг 1. Экономия:
       500 000 000 × 8% = 40 000 000 тг

Шаг 2. Чистая выгода:
       40 000 000 − 5 000 000 = 35 000 000 тг

Шаг 3. ROI (возврат на инвестиции):
       35 000 000 / 5 000 000 = 7× = 700%

За счёт чего экономия 8%:
• Снижение коллизий проекта (-2-4%) — меньше переделок
• Точный подсчёт ВОР (-1-2%) — нет лишних материалов
• Сокращение сроков (-2-3%) — меньше косвенных расходов
• Меньше ошибок исп. документации (-1%)

Расчёт справедлив для проектов от 200 млн тг. На малых
объектах (< 50 млн) BIM-внедрение часто не окупается —
проще остаться на классических AutoCAD + Excel-сметах.

Для крупных девелоперов (BI Group, Bazis Construction,
Highvill) BIM стал стандартом — окупаемость 1-2 года.`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Выбор IoT-датчика
            </div>
            <div className="text-slate-200 mb-4">
              Подрядчик хочет контролировать набор прочности бетона в монолитной плите перекрытия
              при минусовых температурах (зимний бетонирование). Какой IoT-датчик подойдёт?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Тензодатчик на арматуре (Vishay)" },
                { v: "b", t: "Бетонозрелометр с Bluetooth/GSM (COMAN, Monoblock)" },
                { v: "c", t: "Инклинометр на кране (Liebherr)" },
                { v: "d", t: "GPS-трекер на технике (Wialon)" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex3 === opt.v ? "border-violet-600 bg-violet-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex3" value={opt.v} checked={ex3 === opt.v} onChange={() => setEx3(opt.v)} className="accent-violet-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — бетонозрелометр</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-violet-300">Решение:</strong> Бетонозрелометр — это
                термопара, закладываемая в свежий бетон. Датчик каждые 30 мин передаёт
                температуру на смартфон прораба и рассчитывает модуль зрелости M (°C·ч), по
                которому определяется текущая прочность бетона. Это позволяет точно
                определить момент снятия опалубки и нагружения конструкции, что критично
                зимой, когда твердение замедляется в 2-5 раз. Снимает риск преждевременной
                нагрузки и связанных с этим трещин. Стоимость 60-150 тыс. тг за датчик
                окупается за один-два больших монолитных захватки.
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Стоимость IoT-мониторинга
            </div>
            <div className="text-slate-200 mb-4">
              На стройке 9-этажного жилого дома планируется развёртывание IoT:
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li><strong>20 датчиков</strong> (бетонозрелометры + расходомеры + ИК-камеры) ×
                <strong> 60 000 тг</strong> за единицу</li>
                <li><strong>1 IoT-шлюз</strong> LoRaWAN — <strong>200 000 тг</strong></li>
                <li><strong>SaaS-платформа</strong> для аналитики — <strong>50 000 тг/мес</strong> ×
                <strong> 12 мес. строительства</strong></li>
              </ul>
              <p className="mt-2">Какая полная стоимость в тенге?</p>
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Полная стоимость, тг</span>
              <input value={ex4} onChange={(e) => setEx4(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="2000000" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex4Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 2 000 000 тг</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь сложение</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-violet-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Датчики: 20 × 60 000 = 1 200 000 тг
Шлюз LoRaWAN: 200 000 тг
ПО (SaaS): 50 000 × 12 = 600 000 тг
─────────────────────────────────
ИТОГО: 2 000 000 тг

Доля в смете: 2 000 000 / (1500 м² × 200 тыс. тг/м²)
            = 2 000 000 / 300 000 000
            ≈ 0.67% от стоимости объекта

Эффекты:
• Точная приёмка скрытых работ (бетонозрелометры) — экономия
  на простоях кранов 2-5 млн тг
• Учёт ресурсов в реальном времени — снижение перерасхода
  материалов на 1-3% (= 3-9 млн тг на 300-млн объекте)
• Контроль безопасности (камеры с AI-СИЗ) — снижение штрафов
  и страховых случаев

Окупаемость IoT-мониторинга — 3-6 месяцев на крупных проектах.

В смету закладывается строкой «инженерно-технический мониторинг
строительства» или включается в накладные расходы ГП.`}
                </pre>
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          ПП МИИР РК № 132 от 16.05.2023 (BIM для бюджетных объектов). ISO 19650 —
          Information Management using BIM. СН РК 1.02-04 (Состав и содержание ПОС/ППР с
          BIM). Autodesk Tandem, Bentley iTwin, IBM TRIRIGA — платформы цифровых двойников.
          BIM-сообщество РК: BIM Cluster Kazakhstan (bim-cluster.kz).
        </div>
      </main>
    </div>
  );
}
