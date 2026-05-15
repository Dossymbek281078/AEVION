"use client";

import Link from "next/link";
import { useState } from "react";

export default function BridgeRepairPage() {
  const [ex1, setEx1] = useState<string | null>(null);
  const [ex1Res, setEx1Res] = useState<null | "ok" | "bad">(null);
  const [ex1Sol, setEx1Sol] = useState(false);

  const [ex2, setEx2] = useState<string | null>(null);
  const [ex2Res, setEx2Res] = useState<null | "ok" | "bad">(null);
  const [ex2Sol, setEx2Sol] = useState(false);

  const [ex3, setEx3] = useState("");
  const [ex3Res, setEx3Res] = useState<null | "ok" | "bad">(null);
  const [ex3Sol, setEx3Sol] = useState(false);

  const [ex4, setEx4] = useState<string | null>(null);
  const [ex4Res, setEx4Res] = useState<null | "ok" | "bad">(null);
  const [ex4Sol, setEx4Sol] = useState(false);

  const checkEx1 = () => setEx1Res(ex1 === "c" ? "ok" : "bad");
  const checkEx2 = () => setEx2Res(ex2 === "b" ? "ok" : "bad");
  const checkEx3 = () => {
    // 80 м × 8 м × 80 тыс. тг/м² = 51.2 млн тг капремонт средний
    const v = parseFloat(ex3);
    if (!isFinite(v)) return setEx3Res("bad");
    setEx3Res(Math.abs(v - 51) <= 2 ? "ok" : "bad");
  };
  const checkEx4 = () => setEx4Res(ex4 === "d" ? "ok" : "bad");

  const types = [
    {
      level: "Уровень 0",
      name: "Содержание и осмотр",
      what: "Периодические осмотры моста (1 раз/год минимум), чистка водоотводов, защита от коррозии",
      cost: "500 тыс. - 3 млн тг/мост/год",
      example: "Кварт. осмотры путепровода Аль-Фараби, ежегодная защитная окраска",
    },
    {
      level: "Уровень 1",
      name: "Текущий ремонт (косметика)",
      what: "Заделка трещин, ремонт деформационных швов, замена изоляции",
      cost: "5-20 млн тг/мост (зависит от длины)",
      example: "Замена покрытия проезжей части на путепроводе через ж/д",
    },
    {
      level: "Уровень 2",
      name: "Капитальный ремонт",
      what: "Усиление пролётов, замена несущих балок, гидроизоляция, ремонт опор",
      cost: "40-150 тыс. тг/м² моста",
      example: "Капремонт моста через Иртыш (Усть-Каменогорск, 2018-2020) — ~ 2 млрд тг",
    },
    {
      level: "Уровень 3",
      name: "Реконструкция (с расширением)",
      what: "Расширение моста, замена несущих конструкций, добавление полос",
      cost: "200-500 тыс. тг/м²",
      example: "Реконструкция моста через Урал в Атырау (2021-2023)",
    },
    {
      level: "Уровень 4",
      name: "Новое строительство",
      what: "Полная замена старого моста новым на том же месте",
      cost: "300-800 тыс. тг/м²",
      example: "Новый мост через Бухтарминское водохранилище (взамен старого 2024-2027)",
    },
    {
      level: "Уровень 5",
      name: "Демонтаж и закрытие",
      what: "Списание моста, демонтаж, утилизация. Альтернативный маршрут",
      cost: "30-100 тыс. тг/м² + утилизация",
      example: "Снос аварийного автомобильного моста после открытия параллельного",
    },
  ];

  const elements = [
    { part: "Пролётные строения", what: "Балки, плиты проезжей части, тротуары — основные несущие", lifecycle: "50-80 лет, КР раз в 20-25 лет", cost: "60-120 тыс. тг/м²" },
    { part: "Опоры (промежуточные, береговые)", what: "Колонны / стенки в воде или на берегу + подводная часть", lifecycle: "70-100 лет, ремонт раз в 25-30 лет", cost: "100-200 млн тг/опора" },
    { part: "Фундаменты опор", what: "Сваи / плита под опорой, под водой или на берегу", lifecycle: "100+ лет, обследование раз в 10 лет", cost: "200-500 млн тг/фундамент" },
    { part: "Деформационные швы", what: "Заполненные эластомером швы между пролётами для тепл. расширения", lifecycle: "10-15 лет (быстро изнашиваются)", cost: "300-800 тыс. тг/пог.м шва" },
    { part: "Гидроизоляция проезжей части", what: "Слой мембраны под асфальтобетоном — защита от воды", lifecycle: "15-25 лет, замена при капремонте", cost: "3-8 тыс. тг/м²" },
    { part: "Покрытие проезжей части", what: "Асфальтобетон ЩМА-15 4-7 см, как у дороги", lifecycle: "8-15 лет (с интенсивным трафиком)", cost: "3-5 тыс. тг/м²" },
    { part: "Перильные ограждения и тротуары", what: "Барьерные ограждения, тротуарные плиты, освещение", lifecycle: "20-30 лет", cost: "30-80 тыс. тг/пог.м" },
    { part: "Подходы к мосту", what: "Земляное полотно + дорожная одежда на подъездах", lifecycle: "20-25 лет", cost: "8-15 тыс. тг/м² подходов" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Ремонт мостов</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🌉 Ремонт мостов и путепроводов
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            <strong className="text-cyan-300">Мосты</strong> — критическая транспортная
            инфраструктура. В РК ~ 4 000 искусственных сооружений (мостов, путепроводов,
            виадуков) на дорогах общего пользования. ~ 30% находятся в неудовлетворительном
            состоянии и требуют капремонта/реконструкции. Регулируется СНиП РК 5.04-01
            «Мосты и трубы», ГОСТ 33178-2014 (классы автодорожных мостов), европейскими
            стандартами Eurocode 1991-2.
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Мостов в РК</div>
              <div className="text-slate-300">~ 4 000 (30% требуют КР)</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Норматив</div>
              <div className="text-slate-300">СНиП РК 5.04-01 + ГОСТ 33178</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Срок службы</div>
              <div className="text-slate-300">80-100 лет (с КР раз в 25 лет)</div>
            </div>
          </div>
        </section>

        {/* Section 1: 6 уровней работ */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🎚 Section 1. Шесть уровней работ на мосту
          </h2>
          <div className="space-y-3">
            {types.map((t) => (
              <div key={t.level} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
                <div className="flex items-baseline justify-between gap-4 mb-2">
                  <h3 className="text-base font-semibold text-cyan-300">
                    <span className="font-mono text-cyan-400 mr-2">{t.level}</span>
                    {t.name}
                  </h3>
                  <span className="text-xs text-emerald-300 italic shrink-0">{t.cost}</span>
                </div>
                <dl className="text-sm space-y-1">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Что включает</dt>
                    <dd className="text-slate-300 text-xs">{t.what}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Пример РК</dt>
                    <dd className="text-slate-400 text-xs italic">{t.example}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Элементы моста */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🔧 Section 2. Восемь основных элементов моста
          </h2>
          <div className="space-y-3">
            {elements.map((e) => (
              <div key={e.part} className="border border-cyan-800/40 bg-cyan-950/20 rounded-xl p-4">
                <h3 className="text-base font-semibold text-cyan-300 mb-2">{e.part}</h3>
                <dl className="text-sm grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Описание</dt>
                    <dd className="text-slate-300 text-xs">{e.what}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Срок жизни</dt>
                    <dd className="text-amber-300 text-xs">{e.lifecycle}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Стоимость ремонта</dt>
                    <dd className="text-emerald-300 text-xs font-mono">{e.cost}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Технические особенности */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            ⚙️ Section 3. Технические особенности
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="border border-cyan-800/40 bg-cyan-950/20 rounded-lg p-4 text-sm">
              <h3 className="font-semibold text-cyan-300 mb-1">Водолазные работы</h3>
              <p className="text-xs text-slate-300">Обследование и ремонт подводных опор. ЭСН Сб. 45. Надбавка 50-100% к ОТ. Требует лицензии водолазной службы. Стоимость 50-150 тыс. тг/час работы.</p>
            </div>
            <div className="border border-cyan-800/40 bg-cyan-950/20 rounded-lg p-4 text-sm">
              <h3 className="font-semibold text-cyan-300 mb-1">Кессонные работы</h3>
              <p className="text-xs text-slate-300">Для ремонта оснований опор без полного водоотлива. Спецоборудование (кессонные камеры). 80-200 тыс. тг/м² работы.</p>
            </div>
            <div className="border border-cyan-800/40 bg-cyan-950/20 rounded-lg p-4 text-sm">
              <h3 className="font-semibold text-cyan-300 mb-1">Усиление углеволокном</h3>
              <p className="text-xs text-slate-300">Технология FRP (Fiber Reinforced Polymer). Наклейка углеволоконной ленты на ж/б балки — увеличивает прочность 30-50%. 80-150 тыс. тг/м² усиления.</p>
            </div>
            <div className="border border-cyan-800/40 bg-cyan-950/20 rounded-lg p-4 text-sm">
              <h3 className="font-semibold text-cyan-300 mb-1">Замена опорных частей</h3>
              <p className="text-xs text-slate-300">Резиновые/стальные опорные части между пролётом и опорой. Изнашиваются за 30-40 лет. Замена с домкратами 1.5-3 млн тг/опора.</p>
            </div>
            <div className="border border-cyan-800/40 bg-cyan-950/20 rounded-lg p-4 text-sm">
              <h3 className="font-semibold text-cyan-300 mb-1">Защита от коррозии</h3>
              <p className="text-xs text-slate-300">Стальные мосты — катодная защита, цинкование, лакокрасочные покрытия. Перекраска каждые 7-12 лет. 8-20 тыс. тг/м² стальной поверхности.</p>
            </div>
            <div className="border border-cyan-800/40 bg-cyan-950/20 rounded-lg p-4 text-sm">
              <h3 className="font-semibold text-cyan-300 mb-1">Сейсмоусиление</h3>
              <p className="text-xs text-slate-300">Для мостов в зонах 8-9 баллов (Алматы, Тараз, Шымкент). Демпферы, сейсмоизоляторы под опорами, антисейсмические швы. +20-40% к стоимости.</p>
            </div>
          </div>
        </section>

        {/* Section 4: Финансирование */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            💰 Section 4. Финансирование ремонта мостов
          </h2>
          <div className="border border-cyan-800/60 bg-cyan-950/30 rounded-xl p-5 text-sm space-y-3">
            <ul className="list-disc list-inside space-y-2 text-slate-300 text-xs">
              <li><strong>Республиканский бюджет</strong> (Минтранс РК + Минфин) — основной источник для магистралей республиканского значения. Программа «Нурлы Жол» 2020-2025</li>
              <li><strong>Местные бюджеты</strong> (акиматы областей и районов) — для местных дорог и мостов</li>
              <li><strong>Платные мосты</strong> — концессионные (BAKAD-моста), окупаемость 15-25 лет</li>
              <li><strong>Международные банки</strong> — ЕБРР, АБР, Всемирный банк — для крупных проектов (мост через Иртыш, Бухтарминский)</li>
              <li><strong>Госкорпорации</strong> — КазМунайГаз, КТЖ финансируют свои мосты (нефтепроводные, ж/д)</li>
            </ul>
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Section 5. Упражнения</h2>

          {/* Упр.1 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Сначала обследовать
            </div>
            <div className="text-slate-200 mb-4">
              На мосту через реку (40 лет эксплуатации) обнаружены: трещины в балках,
              коррозия арматуры, разрушенные деформационные швы, износ покрытия.
              Что первое нужно сделать?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Сразу начать ремонт пробами" },
                { v: "b", t: "Закрыть мост и снести" },
                { v: "c", t: "Детальное обследование специализированной комиссией: ультразвуковая диагностика балок, лабораторный анализ бетона/арматуры, водолазное обследование опор, расчёт остаточной несущей способности. Только после этого — проект ремонта" },
                { v: "d", t: "Перекрасить и забыть" },
              ].map((opt) => (
                <label key={opt.v} className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${ex1 === opt.v ? "border-cyan-600 bg-cyan-950/30" : "border-slate-800 hover:border-slate-700"}`}>
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-cyan-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex1Sol ? "Скрыть решение" : "Показать решение"}</button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — обследование</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-cyan-300">Решение:</strong> Мост — критическая
                инженерная конструкция, ошибка в проекте ремонта может привести к
                обрушению с гибелью людей. Поэтому:
                <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
                  <li><strong>Детальное обследование</strong> — спец. комиссия из
                  инженеров-мостовиков, лабораторий, водолазов. Срок 1-3 мес.
                  Стоимость 5-30 млн тг для мостов длиной 100-300 м</li>
                  <li><strong>Расчёт остаточной несущей способности</strong> —
                  по СП РК «Расчёт мостов». Определяет, какие нагрузки выдержит</li>
                  <li><strong>Сравнение вариантов</strong>:
                  • Только косметика (если повреждения поверхностные)
                  • Капитальный ремонт (если несущие требуют усиления)
                  • Реконструкция (если нужно расширение / повышение категории)
                  • Демонтаж и новый (если экономически нецелесообразно)</li>
                  <li><strong>ТЭО / FEED</strong> — обоснование выбранного варианта
                  с расчётом стоимости и сроков</li>
                  <li><strong>Проект</strong> с детальной рабочей документацией</li>
                  <li><strong>ГосЭкспертиза</strong> — обязательно</li>
                  <li><strong>Только потом</strong> — тендер на подрядчика и работы</li>
                </ol>
                Безусловное обследование — это требование ГОСТ 33178-2014 и
                СНиП РК 5.04-01. Без него ремонт может быть классифицирован как
                самовольный с уголовной ответственностью при ЧС.
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Водолазные работы
            </div>
            <div className="text-slate-200 mb-4">
              Для обследования опор моста в воде нужны водолазные работы. Сметчик должен
              учесть в бюджете <strong>надбавку к оплате труда водолаза</strong>. По
              ЭСН Сб. 45 какая ставка?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Никакая — обычная зарплата рабочего" },
                { v: "b", t: "Надбавка +50-100% к стандартной ОТ (по ЭСН Сб. 45) + спец. лицензия водолазной службы + обязательное стр-ние жизни. Часовая стоимость работы водолаза в РК — 50-150 тыс. тг" },
                { v: "c", t: "Только +10%" },
                { v: "d", t: "+5%" },
              ].map((opt) => (
                <label key={opt.v} className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${ex2 === opt.v ? "border-cyan-600 bg-cyan-950/30" : "border-slate-800 hover:border-slate-700"}`}>
                  <input type="radio" name="ex2" value={opt.v} checked={ex2 === opt.v} onChange={() => setEx2(opt.v)} className="accent-cyan-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex2Sol ? "Скрыть решение" : "Показать решение"}</button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — +50-100%</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-cyan-300">Решение:</strong> Водолазные работы —
                это работы с повышенной опасностью. По ЭСН Сб. 45 «Подводно-технические
                работы»:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Базовая надбавка к ОТ +50% за работу в воде</li>
                  <li>+10-20% за глубину более 10 м</li>
                  <li>+10-30% за работу в зимний период (ледяная вода)</li>
                  <li>+30-50% за работу в стремительной воде или плохой видимости</li>
                  <li>+50-100% за работу с подводной сваркой</li>
                </ul>
                Дополнительные требования:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Лицензия водолазной службы (выдаётся МВД РК через лицензирование)</li>
                  <li>Сертификат водолаза I-IV класса (срок действия 2-3 года)</li>
                  <li>Обязательное страхование жизни (1-3 млн тг в год)</li>
                  <li>Декомпрессионная камера на берегу (стоимость аренды 50-100 тыс. тг/смена)</li>
                  <li>Бригада минимум 4 человека (водолаз + страхующий + руководитель + врач)</li>
                </ul>
                Реальные ставки водолазных работ в РК 2025:
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`• Обследование (без работ): 30-80 тыс. тг/час
• Лёгкие ремонты (сварка, заполнение): 60-120 тыс. тг/час
• Тяжёлые (бетонирование, демонтаж): 100-200 тыс. тг/час
• Аварийные работы (зимой, в шторм): до 300 тыс. тг/час`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Бюджет капремонта моста
            </div>
            <div className="text-slate-200 mb-4">
              Капремонт автомобильного моста: длина <strong>80 м</strong>, ширина
              <strong> 8 м</strong>, ставка капремонта <strong>80 тыс. тг/м²</strong>
              моста. Какой бюджет в <strong>МЛН тг</strong>?
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Бюджет, млн тг</span>
              <input value={ex3} onChange={(e) => setEx3(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="51" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex3Sol ? "Скрыть решение" : "Показать решение"}</button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 51 млн тг</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-cyan-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Бюджет = Длина × Ширина × Ставка
       = 80 м × 8 м × 80 000 тг/м²
       = 51 200 000 тг ≈ 51 млн тг

Структура капремонта моста 80×8 м (51 млн тг):
• Гидроизоляция + покрытие проезжей части: 18% = 9.2 млн тг
• Деформационные швы (4 шт × 8 м): 12% = 6.1 млн тг
• Ремонт опор (3 промежуточных + 2 береговые): 25% = 12.8 млн тг
• Усиление балок (углеволокно): 18% = 9.2 млн тг
• Замена опорных частей: 8% = 4.1 млн тг
• Перильные ограждения + тротуары: 10% = 5.1 млн тг
• Водолазные работы (обследование + локальные): 4% = 2 млн тг
• Прочие (организация движения, авт. надзор): 5% = 2.5 млн тг

Сравнение с новым мостом 80×8 м:
• Новое стр-во моста: 80 × 8 × 500 000 = 320 млн тг
• Капремонт: 51 млн тг
• Экономия: 269 млн тг (84%)

ВЫВОД: капремонт в 6 раз дешевле нового моста — стратегически
выгодно ремонтировать, а не строить новый. Это особенно
важно для бюджетных программ.

Если мост признан непригодным для ремонта (несущая
способность < 70% проектной) — придётся строить новый.
Это решает экспертиза в обследовании.`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Закрытие моста на ремонт
            </div>
            <div className="text-slate-200 mb-4">
              Капремонт моста требует <strong>полного закрытия движения</strong> на 6 мес.
              Через мост проходит интенсивный трафик (8000 авт/сут). Какие
              <strong>главные риски</strong> и меры для сметчика?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Никаких — закрыть и работать спокойно" },
                { v: "b", t: "Только пробки" },
                { v: "c", t: "Только жалобы граждан" },
                { v: "d", t: "Комплекс: 1) ОБЪЕЗДНОЙ путь (организация временного моста или переустройство дорог) — 100-500 млн тг, 2) Экономический ущерб для бизнеса региона, 3) Социальный протест, 4) Поэтапный ремонт ПО ПОЛОСАМ если возможно (вместо полного закрытия), 5) Ночные работы для минимизации простоя движения, 6) Согласование с акиматом и Минтранс РК" },
              ].map((opt) => (
                <label key={opt.v} className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${ex4 === opt.v ? "border-cyan-600 bg-cyan-950/30" : "border-slate-800 hover:border-slate-700"}`}>
                  <input type="radio" name="ex4" value={opt.v} checked={ex4 === opt.v} onChange={() => setEx4(opt.v)} className="accent-cyan-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex4Sol ? "Скрыть решение" : "Показать решение"}</button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — комплекс мер</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-cyan-300">Решение:</strong> Закрытие моста с
                интенсивным трафиком — серьёзная социально-экономическая операция.
                Сметчик должен учесть в бюджете:
                <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
                  <li><strong>Объездной путь</strong> — обычно &gt; 10 км обхода. Стоимость:
                  100-500 млн тг (если ремонтировать существующие дороги под трафик).
                  Или временный мост 50-200 млн тг</li>
                  <li><strong>Экономический ущерб</strong> — потеря времени и топлива.
                  8000 авт × 30 мин лишних × 6 мес = ~ 200 млн человеко-часов</li>
                  <li><strong>Социальный фактор</strong> — жалобы, протесты, обращения
                  в СМИ. Нужна разъяснительная кампания (5-10 млн тг)</li>
                </ol>
                Альтернативы полному закрытию:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li><strong>Поэтапный ремонт</strong> по полосам (одна сторона работает,
                  другая ремонтируется): удлиняет срок в 1.5-2 раза, удорожает на 20-30%,
                  но не парализует движение</li>
                  <li><strong>Ночные работы</strong> (22:00-6:00, открыто днём):
                  допустимы для покраски, локальной заделки, не для серьёзного
                  ремонта несущих</li>
                  <li><strong>Временный мост</strong> рядом — параллельная пешеходно-
                  автомобильная переправа на сваях. Применяется для мостов с
                  очень критическим трафиком</li>
                </ul>
                Согласования: акимат района/области, Минтранс РК, КазАвтоДор, ДВД (ГАИ).
                Срок согласования объезда 1-3 мес.
                <br /><br />
                Реальный пример РК: реконструкция моста через Иртыш в Усть-Каменогорске
                (2018-2020) — закрытие на 2 года, временный мост на сваях, ущерб
                для бизнеса города — миллиарды тг. Учитывалось в бюджете программы.
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          СНиП РК 5.04-01 (Мосты и трубы). ГОСТ 33178-2014 (Классы автодорожных
          мостов). ЭСН Сб. 30 (Мосты) + Сб. 45 (Подводно-технические работы).
          Eurocode 1991-2 (Нагрузки на мосты). СП РК «Расчёт мостов».
          КазАвтоДор, Минтранс РК, программа «Нурлы Жол».
        </div>
      </main>
    </div>
  );
}
