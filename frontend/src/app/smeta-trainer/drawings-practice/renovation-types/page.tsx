"use client";

import Link from "next/link";
import { useState } from "react";

export default function RenovationTypesPage() {
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

  const checkEx1 = () => setEx1Res(ex1 === "c" ? "ok" : "bad");
  const checkEx2 = () => {
    // 80 м² × 35 тыс. (евроремонт средний) + материалы 80 × 50 = 2.8 + 4 = 6.8 млн тг
    // или комплексно: 80 × 85 (евро под ключ) = 6.8 млн тг
    const v = parseFloat(ex2);
    if (!isFinite(v)) return setEx2Res("bad");
    setEx2Res(Math.abs(v - 6_800_000) <= 200_000 ? "ok" : "bad");
  };
  const checkEx3 = () => setEx3Res(ex3 === "b" ? "ok" : "bad");
  const checkEx4 = () => setEx4Res(ex4 === "d" ? "ok" : "bad");

  const types = [
    {
      level: 1,
      name: "Ямочный (точечный) ремонт",
      what: "Локальное устранение проблем без вмешательства в основные системы",
      where: "Одна комната, одна стена, одна труба",
      cost: "От 50-200 тыс. тг (зависит от объёма)",
      duration: "1-5 дней",
      example: "Заделка трещины, замена 1 крана, перетяжка одной обои",
      what_in: "Только локальная работа",
      what_no: "Без замены полов, окон, инж. систем",
    },
    {
      level: 2,
      name: "Косметический ремонт",
      what: "Обновление поверхностей без вскрытия конструкций",
      where: "Вся квартира/помещение",
      cost: "8-15 тыс. тг/м² (под ключ с материалами эконом)",
      duration: "2-4 недели",
      example: "Шпаклёвка + обои + покраска потолка + ламинат поверх стяжки",
      what_in: "Покраска, обои, ламинат, плинтуса, мелкая сантехника",
      what_no: "Без вскрытия стен, замены проводки, окон",
    },
    {
      level: 3,
      name: "Капитальный ремонт квартиры",
      what: "Вскрытие отделки до конструкций + полная переделка",
      where: "Вся квартира",
      cost: "30-60 тыс. тг/м² работы + 30-80 тыс. тг/м² материалы (зависит от класса)",
      duration: "2-5 месяцев",
      example: "Снос стяжки, штукатурки, замена проводки/труб, новая отделка",
      what_in: "Всё кроме несущих стен",
      what_no: "Без перепланировки требующей согласования",
    },
    {
      level: 4,
      name: "Капремонт с перепланировкой",
      what: "Капремонт + изменение конфигурации (снос ненесущих стен)",
      where: "Вся квартира с новой планировкой",
      cost: "+10-20% к обычному капремонту",
      duration: "3-7 месяцев (включая согласование)",
      example: "Объединение кухни и гостиной, перенос ванной, добавление гардеробной",
      what_in: "Снос ненесущих стен, новая планировка, согласование в МИО",
      what_no: "Несущие стены, мокрые зоны над/под сухими у соседей",
    },
    {
      level: 5,
      name: "Евроремонт (премиум-сегмент)",
      what: "Капремонт + дизайн-проект + дорогие материалы",
      where: "Вся квартира",
      cost: "85-150 тыс. тг/м² комплексно (под ключ)",
      duration: "4-8 месяцев",
      example: "Импортная плитка, паркет, тройные стеклопакеты, дизайнерская сантехника",
      what_in: "Всё + дизайн + наценка на материалы",
      what_no: "Без перепланировки требующей экспертизы",
    },
    {
      level: 6,
      name: "Дизайнерский ремонт",
      what: "Евроремонт + индивидуальный дизайн-проект + авторский надзор",
      where: "Вся квартира",
      cost: "150-300 тыс. тг/м² (премиум)",
      duration: "6-12 месяцев",
      example: "Уникальный дизайн от известного бюро, ручная работа, эксклюзивные материалы",
      what_in: "Авторский дизайн, шторы под заказ, мебель в стиль",
      what_no: "Стандартные шаблонные решения",
    },
    {
      level: 7,
      name: "VIP / Luxury ремонт",
      what: "Дизайнерский + smart-home + спецсистемы + индивидуальные элементы",
      where: "Премиум-апартаменты, дома знаменитостей",
      cost: "300-600+ тыс. тг/м²",
      duration: "8-18 месяцев",
      example: "Klimasysteme премиум, smart-home KNX, золотая сантехника, итал. кухни",
      what_in: "Всё что только можно представить",
      what_no: "Нет ограничений",
    },
    {
      level: 8,
      name: "Реконструкция помещения",
      what: "Изменение основных параметров (объём, назначение, несущие)",
      where: "С получением разрешения, ПД, согласованием",
      cost: "200-500 тыс. тг/м² + согласования 5-15%",
      duration: "12-24 месяца",
      example: "Объединение 2 квартир, выход на лоджию, ликвидация несущей стены",
      what_in: "Всё включая несущие конструкции",
      what_no: "Без разрешения и ПД — самовольная постройка",
    },
  ];

  const repair_cost = [
    { item: "Чёрные работы (вынос, демонтаж)", percent: "5-10%", note: "Подготовительные, до начала ремонта" },
    { item: "Сантехника (трубы, разводка)", percent: "8-12%", note: "Замена стояков, разводка по квартире" },
    { item: "Электрика (проводка, щиток)", percent: "8-12%", note: "Новая проводка, УЗО, розетки, выключатели" },
    { item: "Стены (штукатурка, шпаклёвка)", percent: "12-18%", note: "Подготовка под чистовую отделку" },
    { item: "Полы (стяжка, утепление)", percent: "8-12%", note: "Стяжка, гидроизоляция, утепление" },
    { item: "Чистовая отделка стен (обои, плитка)", percent: "15-20%", note: "Финальная отделка, окраска" },
    { item: "Чистовые полы (ламинат, керамогр.)", percent: "10-15%", note: "Финальные напольные покрытия" },
    { item: "Окна и двери", percent: "8-12%", note: "Замена + откосы + наличники" },
    { item: "Сантехнические приборы", percent: "8-12%", note: "Унитаз, ванна, смесители, бойлер" },
    { item: "Прочее (плинтуса, фурнитура, наладка)", percent: "5-10%", note: "Финал работ" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Виды ремонта помещений</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🪜 Восемь видов ремонта помещений
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            Ремонт помещений — это <strong className="text-rose-300">массовый сегмент</strong>
            строительного рынка РК. От ямочного ремонта (50 тыс. тг) до luxury-ремонта
            (300+ тыс. тг/м²) — это разные индустрии с разными подрядчиками, материалами,
            технологиями. Сметчик должен уметь оценивать все уровни и подбирать подходящий
            для бюджета заказчика. Регулируется СН РК 3.02-01 + ЗРК «О защите прав
            потребителей» (для частных клиентов).
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Уровней ремонта</div>
              <div className="text-slate-300">8 (от ямочного до VIP)</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Диапазон цен</div>
              <div className="text-slate-300">8-600 тыс. тг/м² (60× разница)</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Рынок в Алматы</div>
              <div className="text-slate-300">~ 500 млрд тг/год (вкл. квартиры)</div>
            </div>
          </div>
        </section>

        {/* Section 1: 8 levels */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🎚 Section 1. Восемь уровней — от ямочного до VIP
          </h2>
          <div className="space-y-3">
            {types.map((t) => (
              <div key={t.level} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
                <div className="flex items-baseline justify-between gap-4 mb-2">
                  <h3 className="text-base font-semibold text-rose-300">
                    <span className="font-mono text-rose-400 mr-2">L{t.level}</span>
                    {t.name}
                  </h3>
                  <span className="text-xs text-emerald-300 italic shrink-0">{t.cost}</span>
                </div>
                <dl className="text-sm grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Что это</dt>
                    <dd className="text-slate-300 text-xs">{t.what}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Срок</dt>
                    <dd className="text-amber-300 text-xs">{t.duration}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Что входит</dt>
                    <dd className="text-emerald-300 text-xs">+ {t.what_in}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Что НЕ входит</dt>
                    <dd className="text-rose-300 text-xs">− {t.what_no}</dd>
                  </div>
                  <div className="md:col-span-2">
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Пример</dt>
                    <dd className="text-slate-400 text-xs italic">{t.example}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Структура стоимости */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📊 Section 2. Структура стоимости капремонта квартиры
          </h2>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Категория работ</th>
                  <th className="text-left px-4 py-3 w-32">Доля</th>
                  <th className="text-left px-4 py-3">Комментарий</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {repair_cost.map((r) => (
                  <tr key={r.item} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 text-slate-100 text-xs">{r.item}</td>
                    <td className="px-4 py-3 text-rose-300 text-xs font-mono">{r.percent}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Особенности расценок */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📐 Section 3. Специфика смет на ремонт помещений
          </h2>
          <div className="border border-rose-800/60 bg-rose-950/30 rounded-xl p-5 text-sm space-y-3">
            <div>
              <strong className="text-rose-300">Отличия от смет на новое стр-во:</strong>
              <ul className="list-disc list-inside ml-4 mt-1 text-slate-300 text-xs space-y-1">
                <li>Расценки ЭСН Сб. 46 (Демонтаж) + Сб. 15 (Малярные) + Сб. 17 (Полы) — основные</li>
                <li>Применение коэф. К_МДС = 1.05-1.15 на стеснённость работ в эксплуат. помещении</li>
                <li>Учёт работ выходного дня (надбавка +30-50% за работу в неудобное время)</li>
                <li>Цены материалов чаще — розничные с наценкой 5-15%, не оптовые</li>
                <li>Меньшие объёмы → нет экономии масштаба</li>
                <li>Транспорт материалов в подъездах (лифт, ручная подача) — +1-3% к стоимости</li>
                <li>Гарантия 1-2 года (для подрядчиков ремонта) vs 2-5 лет для нового стр-ва</li>
              </ul>
            </div>
            <div>
              <strong className="text-rose-300">Подводные камни для сметчика:</strong>
              <ul className="list-disc list-inside ml-4 mt-1 text-slate-300 text-xs space-y-1">
                <li><strong>Скрытые дефекты</strong> — после демонтажа отделки могут найти плесень, трещины, неполадки в коммуникациях. Резерв 10-15% в смете обязательно</li>
                <li><strong>Изменения от клиента</strong> — после начала работ заказчик «хочет ещё». Каждое изменение → доп. соглашение</li>
                <li><strong>Закупка материалов</strong> — клиент часто хочет покупать сам. Тогда смета только на работы, без наценки на материалы</li>
                <li><strong>Согласования с соседями</strong> — шумные работы только 9:00-18:00 и не в выходные (по СанПину). Иначе жалобы и штрафы</li>
                <li><strong>Гражданские истцы</strong> — потоп у соседей снизу = +500 тыс. - 5 млн тг ущерба. Страхование строительных работ обязательно</li>
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
              Упражнение 1 / 4 — Какой уровень нужен
            </div>
            <div className="text-slate-200 mb-4">
              Молодая семья купила <strong>3-комн. квартиру 75 м²</strong> в новостройке с
              черновой отделкой. Бюджет — <strong>9-12 млн тг</strong> на ремонт. Хотят
              комфортный современный интерьер. Какой уровень ремонта оптимален?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Ямочный (50-200 тыс. тг) — слишком мало" },
                { v: "b", t: "Косметический (8-15 тыс. тг/м²) — нет, нужна полная отделка от черновой" },
                { v: "c", t: "Капремонт квартиры (60-90 тыс. тг/м² комплексно) или Евроремонт (85-150 тыс. тг/м²) — для 75 м² бюджет 9-12 млн тг попадает в верхний сегмент капремонта или базовый евроремонт" },
                { v: "d", t: "VIP — слишком дорого для семьи" },
              ].map((opt) => (
                <label key={opt.v} className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${ex1 === opt.v ? "border-rose-600 bg-rose-950/30" : "border-slate-800 hover:border-slate-700"}`}>
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-rose-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex1Sol ? "Скрыть решение" : "Показать решение"}</button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — капремонт/базовый евро</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-rose-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Анализ:
• Площадь: 75 м²
• Бюджет: 9-12 млн тг
• Удельная стоимость: 9 000 000 / 75 = 120 000 тг/м²
                    или 12 000 000 / 75 = 160 000 тг/м²

Соответствие уровням:
• Капремонт квартиры: 60-90 тыс. тг/м² — БЮДЖЕТ ПРЕВЫШАЕТ ВЕРХ
• Евроремонт (базовый): 85-120 тыс. тг/м² — ПОДХОДИТ
• Евроремонт (средний): 120-150 тыс. тг/м² — ПОДХОДИТ
• Дизайнерский: 150-300 тыс. тг/м² — НЕ ПОДХОДИТ

ВЫВОД: лучше всего — базовый-средний евроремонт.
Это позволит:
• Качественные импортные материалы (плитка, ламинат)
• Двух-камерные стеклопакеты
• Современную сантехнику среднего сегмента
• Базовый дизайн без авторского надзора (типовые решения)

Структура бюджета 10 млн тг для квартиры 75 м²:
• Работы (стяжка, штукатурка, отделка): ~ 4 млн тг (40%)
• Материалы основные (плитка, ламинат, обои): ~ 2.5 млн тг (25%)
• Сантехника + бытовая (ванна, унитаз, мойка): ~ 1.5 млн тг (15%)
• Окна (3 шт. + балконный блок): ~ 800 тыс. тг (8%)
• Двери (4 межкомн. + 1 входная): ~ 600 тыс. тг (6%)
• Электр./щиток/УЗО: ~ 400 тыс. тг (4%)
• Прочие (плинтуса, фурнитура): ~ 200 тыс. тг (2%)
─────────────────────────────────────────────
ИТОГО: 10 млн тг базовый евроремонт под ключ`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Бюджет евроремонта
            </div>
            <div className="text-slate-200 mb-4">
              Заказчик хочет евроремонт квартиры <strong>80 м²</strong>. Бенчмарк
              евроремонта (под ключ с материалами) — <strong>85 тыс. тг/м²</strong>.
              Какой полный бюджет в тенге?
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Бюджет, тг</span>
              <input value={ex2} onChange={(e) => setEx2(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="6800000" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex2Sol ? "Скрыть решение" : "Показать решение"}</button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 6.8 млн тг</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-rose-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Бюджет = S × Цена_м²
       = 80 × 85 000
       = 6 800 000 тг = 6.8 млн тг

Срок ремонта: 4-6 месяцев под ключ

Структура (для базового евроремонта 80 м²):
• Демонтаж и подготовка: 5% = 340 тыс. тг
• Сантехника (прокладка + приборы): 14% = 952 тыс. тг
• Электрика (новая проводка): 10% = 680 тыс. тг
• Штукатурка стен 250 м²: 12% = 816 тыс. тг
• Стяжка пола 80 м²: 8% = 544 тыс. тг
• Чистовая отделка стен (обои/плитка): 17% = 1 156 тыс. тг
• Чистовые полы (ламинат + керамогр.): 12% = 816 тыс. тг
• Двери (4 межкомн.): 7% = 476 тыс. тг
• Окна (ПВХ Алюпласт): 9% = 612 тыс. тг
• Потолки (натяжные): 4% = 272 тыс. тг
• Прочее (фурнитура, плинтуса): 2% = 136 тыс. тг

Резерв на форс-мажор: рекомендуется 10-15%:
6.8 × 1.13 = 7.68 млн тг — реальный бюджет с резервом

Сравнение по сегментам Алматы (2025):
• Эконом-косметика: 8-15 тыс. тг/м² → 80 × 12 = 0.96 млн тг
• Капремонт стандарт: 50-70 тыс. тг/м² → 80 × 60 = 4.8 млн тг
• Евроремонт базовый: 85-120 тыс. тг/м² → 80 × 100 = 8 млн тг
• Дизайн премиум: 150-250 тыс. тг/м² → 80 × 200 = 16 млн тг
• VIP/Luxury: 300+ тыс. тг/м² → 80 × 350 = 28+ млн тг`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Перепланировка
            </div>
            <div className="text-slate-200 mb-4">
              Заказчик хочет в квартире <strong>снести 1 ненесущую и 1 несущую стену</strong>
              + объединить туалет с ванной. Что нужно по закону РК?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Можно делать без согласований — главное результат" },
                { v: "b", t: "ОБЯЗАТЕЛЬНО: 1) Проект перепланировки с расчётом нагрузок (для несущей стены), 2) Заключение проектировщика об отсутствии угрозы, 3) Согласование в МИО (4-6 нед.), 4) После работ — переоформление техпаспорта НКА. Несущую стену сносить нельзя — только проёмы с усилением. Объединение санузлов — допускается с согласованием" },
                { v: "c", t: "Только устное согласие УК" },
                { v: "d", t: "Согласование от соседей в подъезде" },
              ].map((opt) => (
                <label key={opt.v} className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${ex3 === opt.v ? "border-rose-600 bg-rose-950/30" : "border-slate-800 hover:border-slate-700"}`}>
                  <input type="radio" name="ex3" value={opt.v} checked={ex3 === opt.v} onChange={() => setEx3(opt.v)} className="accent-rose-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex3Sol ? "Скрыть решение" : "Показать решение"}</button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — комплекс согласований</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-rose-300">Решение:</strong> Перепланировка
                квартиры в РК — серьёзная процедура. Этапы:
                <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
                  <li><strong>Подготовка проекта</strong> — проектная организация
                  делает расчёт нагрузок (особенно для несущих), показывает что
                  изменения не угрожают конструкции дома (стоимость 100-300 тыс. тг)</li>
                  <li><strong>Согласование с УК/КСК</strong> — собрание собственников
                  даёт согласие на работы в общедомовом имуществе (стояки, шахты)</li>
                  <li><strong>Согласование в МИО</strong> — акимат района через
                  egov.kz. Срок 4-6 недель. Госпошлина 5 МРП (~ 18 500 тг)</li>
                  <li><strong>Работы только после получения разрешения</strong> —
                  иначе самовольная перепланировка, штраф 5-20 МРП (КоАП ст. 461)
                  + предписание привести в исходное состояние</li>
                  <li><strong>Сдача в эксплуатацию</strong> — комиссия МИО проверяет
                  соответствие проекту</li>
                  <li><strong>Новый техпаспорт НКА</strong> — обновление кадастра</li>
                </ol>
                <strong>Несущая стена</strong> — НЕЛЬЗЯ полностью снести, можно
                только проём с усилением (стальной портал). Это требует
                согласования со специалистом по ж/б конструкциям. Особенно в
                сейсмических зонах (Алматы 9 баллов) — отдельная экспертиза.
                <br /><br />
                <strong>Объединение санузлов</strong> — допускается, но новый
                совмещённый санузел должен быть «над мокрым» соседей внизу (не над
                их кухней или жилой комнатой) по СН РК «Жилые здания».
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Подводные камни сметы
            </div>
            <div className="text-slate-200 mb-4">
              Сметчик готовит смету на капремонт квартиры. Заказчик настаивает на
              «фиксированной цене под ключ». Какие <strong>главные риски</strong>
              для сметчика?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Никаких — фикс цена выгодна заказчику" },
                { v: "b", t: "Только цены на материалы могут вырасти" },
                { v: "c", t: "Только риск некачественной работы" },
                { v: "d", t: "Комплекс рисков: 1) Скрытые дефекты после демонтажа (плесень, трещины) — резерв 10-15% обязательно, 2) Изменения от клиента в процессе («хочу другое») — нужно доп. соглашение по каждому, 3) Рост цен материалов 5-15% за квартал, 4) Шумы и жалобы соседей могут остановить работы, 5) Затопление соседей — страхование стройработ обязательно (50-150 тыс. тг страховка)" },
              ].map((opt) => (
                <label key={opt.v} className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${ex4 === opt.v ? "border-rose-600 bg-rose-950/30" : "border-slate-800 hover:border-slate-700"}`}>
                  <input type="radio" name="ex4" value={opt.v} checked={ex4 === opt.v} onChange={() => setEx4(opt.v)} className="accent-rose-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex4Sol ? "Скрыть решение" : "Показать решение"}</button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — комплекс рисков</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-rose-300">Решение:</strong> «Фиксированная цена
                под ключ» — самый рискованный для подрядчика тип контракта. Защита:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li><strong>Резерв на форс-мажор</strong> 10-15% в смете
                  (не показывать клиенту как «резерв», а распределить по позициям)</li>
                  <li><strong>Подробная спецификация материалов</strong> — клиент
                  должен видеть конкретные модели, бренды. Изменения = доп. соглашение</li>
                  <li><strong>Этапная оплата</strong> 30% аванс + 40% после демонтажа
                  и черновых + 30% по сдаче. Без этого подрядчик финансирует из своего</li>
                  <li><strong>Договор страхования стройработ</strong> 0.5-1% от стоимости
                  ремонта. Покрывает затопление соседей, кражи, повреждения третьим лицам</li>
                  <li><strong>Раздел контракта «Скрытые работы»</strong> — что делать,
                  если после демонтажа найдены проблемы (трещины, плесень, поломки):
                  всегда — доп. соглашение, без этого подрядчик не приступает</li>
                  <li><strong>Согласование шумных работ с соседями</strong> и
                  получение справок от УК, чтобы заявления соседей не остановили
                  работы (по СанПину можно только 9:00-18:00 и не в выходные)</li>
                  <li><strong>Фотофиксация каждого этапа</strong> — на случай споров
                  «что было до» и «что стало»</li>
                </ul>
                Без этих защит на ремонте 80 м² за 7 млн тг подрядчик может «уйти в минус»
                на 1-2 млн тг из-за непредвиденных. На объёмах 50+ квартир в год
                страхование и резервы обязательны для финансовой устойчивости.
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          СН РК 3.02-01 (Эксплуатация и ремонт). СН РК «Жилые здания». ЭСН Сб. 15
          (Малярные), Сб. 17 (Полы), Сб. 46 (Демонтаж). ЗРК «О защите прав
          потребителей» от 04.05.2010 № 274-IV. КоАП ст. 461 (Самовольная
          перепланировка). СанПин (шум, режим работ).
        </div>
      </main>
    </div>
  );
}
