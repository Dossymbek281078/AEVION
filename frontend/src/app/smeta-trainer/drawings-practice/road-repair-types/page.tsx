"use client";

import Link from "next/link";
import { useState } from "react";

export default function RoadRepairTypesPage() {
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
    // 5 км × 8000 м² × 8.5 тыс./м² = 340 млн тг для среднего ремонта (фрезеровка + новый слой)
    const v = parseFloat(ex2);
    if (!isFinite(v)) return setEx2Res("bad");
    setEx2Res(Math.abs(v - 340) <= 10 ? "ok" : "bad");
  };
  const checkEx3 = () => setEx3Res(ex3 === "b" ? "ok" : "bad");
  const checkEx4 = () => setEx4Res(ex4 === "d" ? "ok" : "bad");

  const types = [
    {
      name: "Содержание (зимнее/летнее)",
      what: "Уборка снега, ям, обочин, разметка, знаки",
      cost: "300-800 тыс. тг/км/год (городские), 100-300 тыс. тг (трасса)",
      frequency: "Ежегодно круглогодично",
      norm: "СН РК 3.03-09, технологические карты КазАвтоДор",
    },
    {
      name: "Ямочный ремонт",
      what: "Заполнение выбоин асфальтом на месте, на 1-3 м² одна яма",
      cost: "5-15 тыс. тг/м² (с подвозом материала)",
      frequency: "По заявкам, обычно весной и после дождей",
      norm: "СН РК 3.03-09, технологические карты",
    },
    {
      name: "Текущий ремонт (фрезеровка + слой)",
      what: "Снятие 4-6 см старого асфальта + новый слой ЩМА",
      cost: "6-10 тыс. тг/м² дороги",
      frequency: "Раз в 5-8 лет",
      norm: "СН РК 3.03-09 раздел 5",
    },
    {
      name: "Выборочный капремонт",
      what: "Частичный ремонт проблемных участков с заменой подосновы",
      cost: "12-20 тыс. тг/м²",
      frequency: "Раз в 10-15 лет",
      norm: "СН РК 3.03-09 раздел 7",
    },
    {
      name: "Полный капремонт",
      what: "Полная разборка одёжки (асфальт + щебень + основание) и устройство новой",
      cost: "30-60 тыс. тг/м² (зависит от категории дороги)",
      frequency: "Раз в 20-25 лет",
      norm: "СН РК 3.03-09 раздел 8",
    },
    {
      name: "Реконструкция дороги",
      what: "Изменение основных параметров: ширина, кол-во полос, обочины, развязки",
      cost: "60-200 тыс. тг/м² (зависит от категории)",
      frequency: "Раз в 30-50 лет, по необходимости (рост трафика)",
      norm: "СН РК 3.03-09 раздел 9 + СНиП 3.06.04",
    },
  ];

  const layers = [
    { layer: "Дорожная одежда — асфальтобетон", what: "Верхний слой 4-7 см ЩМА-15 + нижний 6-10 см а/б", cost_m2: "3-5 тыс. тг/м²" },
    { layer: "Щебёночное основание", what: "20-30 см щебня фр. 40-70, уплотнено катками", cost_m2: "2-4 тыс. тг/м²" },
    { layer: "Подстилающий слой", what: "Песок 20-30 см (дренаж), геотекстиль", cost_m2: "1-2 тыс. тг/м²" },
    { layer: "Грунт основания", what: "Уплотнение, выравнивание, удаление слабых грунтов", cost_m2: "0.5-1.5 тыс. тг/м²" },
    { layer: "Обочины + краевая полоса", what: "Гравий, расширение проезжей части", cost_m2: "1-3 тыс. тг/м² обочины" },
    { layer: "Бордюры", what: "Бетонные БР 100, БР 50 или гранитные", cost_pog: "8-25 тыс. тг/пог.м" },
    { layer: "Разметка термопластиком", what: "Горизонтальная разметка 1.1, 1.5, 1.6 и т.д.", cost_m: "500-1500 тг/м.п. (для термопласт.)" },
    { layer: "Знаки + светофоры + камеры", what: "Установка/замена ТСОДД", cost_unit: "100-500 тыс. тг/знак + ост." },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Виды ремонта дорог</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🛣 Виды ремонта дорог
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            <strong className="text-slate-300">Дорожный ремонт</strong> — массовый сегмент
            в РК. Сеть автодорог общего пользования — 96 тыс. км (республиканских +
            местных). КазАвтоДор отвечает за капремонт магистралей, акиматы — за местные.
            Бюджет РК на дороги — 800-1200 млрд тг/год. От правильной классификации
            работ (содержание / текущий / выборочный / полный капремонт / реконструкция)
            зависит источник финансирования и подрядчик.
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Сеть дорог РК</div>
              <div className="text-slate-300">96 тыс. км общего пользования</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Бюджет в год</div>
              <div className="text-slate-300">800-1200 млрд тг (Минтранс РК)</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Норматив</div>
              <div className="text-slate-300">СН РК 3.03-09 (Автодороги)</div>
            </div>
          </div>
        </section>

        {/* Section 1: 6 видов */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🚧 Section 1. Шесть видов работ на дороге
          </h2>
          <div className="space-y-3">
            {types.map((t) => (
              <div key={t.name} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
                <h3 className="text-base font-semibold text-slate-300 mb-2">{t.name}</h3>
                <dl className="text-sm space-y-1.5">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Состав работ</dt>
                    <dd className="text-slate-300 text-xs">{t.what}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Стоимость</dt>
                    <dd className="text-emerald-300 text-xs">{t.cost}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Периодичность</dt>
                    <dd className="text-amber-300 text-xs">{t.frequency}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Норматив</dt>
                    <dd className="text-slate-400 text-xs italic">{t.norm}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Структура дорожной одежды */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📏 Section 2. Структура дорожной одежды
          </h2>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Слой</th>
                  <th className="text-left px-4 py-3">Описание</th>
                  <th className="text-left px-4 py-3 w-44">Цена</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {layers.map((l) => (
                  <tr key={l.layer} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 text-slate-100 text-xs">{l.layer}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{l.what}</td>
                    <td className="px-4 py-3 text-emerald-300 text-xs font-mono">{l.cost_m2 || l.cost_pog || l.cost_m || l.cost_unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Категории дорог */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🚗 Section 3. Категории автодорог в РК
          </h2>
          <div className="border border-slate-800 bg-slate-900/40 rounded-xl p-5 text-sm space-y-3">
            <p className="text-slate-300">
              По СНиП 3.06-04 «Автомобильные дороги» в РК выделяют 6 категорий
              (от Iа до V). От категории зависят: ширина полосы, расчётная скорость,
              нагрузка, конструкция дорожной одежды и, соответственно, стоимость.
            </p>
            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-3 py-2 w-24">Кат.</th>
                    <th className="text-left px-3 py-2 w-32">Трафик авт/сут</th>
                    <th className="text-left px-3 py-2">Описание</th>
                    <th className="text-left px-3 py-2 w-32">Цена (км)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  <tr><td className="px-3 py-2 font-mono text-rose-300">Iа</td><td className="px-3 py-2 text-slate-300">&gt; 14 000</td><td className="px-3 py-2 text-xs text-slate-400">Автомагистраль (БАКАД, Нурлы Жол)</td><td className="px-3 py-2 text-emerald-300">2-5 млрд тг/км</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-rose-300">Iб</td><td className="px-3 py-2 text-slate-300">7-14 000</td><td className="px-3 py-2 text-xs text-slate-400">Скоростная (Алматы-Шымкент)</td><td className="px-3 py-2 text-emerald-300">1.5-3 млрд тг/км</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-amber-300">II</td><td className="px-3 py-2 text-slate-300">3-7 000</td><td className="px-3 py-2 text-xs text-slate-400">Магистральная (Алматы-Талдыкорган)</td><td className="px-3 py-2 text-emerald-300">800 млн - 2 млрд тг/км</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-amber-300">III</td><td className="px-3 py-2 text-slate-300">1-3 000</td><td className="px-3 py-2 text-xs text-slate-400">Областная (между райцентрами)</td><td className="px-3 py-2 text-emerald-300">400-800 млн тг/км</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-emerald-300">IV</td><td className="px-3 py-2 text-slate-300">100-1 000</td><td className="px-3 py-2 text-xs text-slate-400">Местная (между сёлами)</td><td className="px-3 py-2 text-emerald-300">200-500 млн тг/км</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-emerald-300">V</td><td className="px-3 py-2 text-slate-300">&lt; 100</td><td className="px-3 py-2 text-xs text-slate-400">Полевая (грунтовая, гравий)</td><td className="px-3 py-2 text-emerald-300">100-300 млн тг/км</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Section 4. Упражнения</h2>

          {/* Упр.1 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Тип работ на яме
            </div>
            <div className="text-slate-200 mb-4">
              На участке улицы Кабанбай Батыра в Алматы образовалась яма
              <strong> 2×3 м</strong> (~ 6 м²) глубиной 8 см. Машины повреждаются.
              Что нужно делать?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Перестроить всю улицу" },
                { v: "b", t: "Сделать выборочный капремонт всего перекрёстка" },
                { v: "c", t: "Ямочный ремонт — оперативное заполнение ямы асфальтом, в т.ч. с использованием установок «АСФАЛЬТОПРИЁМНИК». 6 м² × 12 тыс. тг = 72 тыс. тг работы. Срок 2-5 дней по заявке акимата" },
                { v: "d", t: "Закрыть дорогу" },
              ].map((opt) => (
                <label key={opt.v} className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${ex1 === opt.v ? "border-slate-600 bg-slate-800" : "border-slate-800 hover:border-slate-700"}`}>
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-slate-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex1Sol ? "Скрыть решение" : "Показать решение"}</button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — ямочный ремонт</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-slate-300">Решение:</strong> Локальная яма
                требует ямочного ремонта (по СН РК 3.03-09):
                <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
                  <li>Жители подают заявку через egov.kz или в акимат (109)</li>
                  <li>Дорожная служба выезжает в течение 2-5 рабочих дней</li>
                  <li>Очищают яму от пыли/воды</li>
                  <li>Заполняют асфальтовой смесью (горячей из АСФАЛЬТОПРИЁМНИКА)</li>
                  <li>Уплотняют виброплитой</li>
                  <li>Закрывают для движения 4-6 часов до остывания</li>
                </ol>
                Стоимость 6 м² × 12 тыс. = 72 тыс. тг включает: работу 2 рабочих
                (1 час), асфальт 0.3 т (50 тыс. тг), технику (10 тыс. тг),
                накладные + прибыль.
                <br /><br />
                Альтернатива при множестве ям рядом — текущий ремонт (фрезеровка +
                новый слой на участке 50-200 м). Это в 3-5 раз дороже за м², но
                держит дольше (5-8 лет vs 1-3 года ямочного).
                <br /><br />
                В РК около 30% бюджета на местные дороги тратится на ямочный ремонт.
                Это «лоскутный» подход, лучше делать профилактический текущий
                ремонт по графику.
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Бюджет текущего ремонта
            </div>
            <div className="text-slate-200 mb-4">
              Текущий ремонт <strong>5 км</strong> двухполосной дороги. Площадь
              одной полосы: 2 м (полу-полоса для удобства) × 5000 = 8000 м²
              (примем для двух полос). Стоимость текущего ремонта (фрезеровка
              4 см + новый слой ЩМА-15): <strong>8.5 тыс. тг/м²</strong>. Какой
              бюджет в МЛН тг?
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Бюджет, млн тг</span>
              <input value={ex2} onChange={(e) => setEx2(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="340" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex2Sol ? "Скрыть решение" : "Показать решение"}</button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 340 млн тг</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-slate-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Бюджет = Площадь × Цена/м²
       = 8 000 × 8 500
       = 68 000 000 тг = 68 млн тг (на 1 км)

На 5 км: 5 × 68 = 340 000 000 тг = 340 млн тг

Структура для 5 км текущего ремонта 2-х полосной:
• Фрезеровка 4 см старого а/б: ~ 1500 тг/м² × 40 000 = 60 млн тг
• Подвоз и укладка ЩМА-15 4 см: ~ 4500 тг/м² × 40 000 = 180 млн тг
• Розлив битумной эмульсии (грунт): 600 тг/м² × 40 000 = 24 млн тг
• Разметка дорожная: 60 000 м.п. × 800 тг = 48 млн тг
• Прочее (организация движения, знаки): 28 млн тг
─────────────────────────────────────────────────
ИТОГО: 340 млн тг

Сравнение с полным капремонтом 5 км:
• Полный капремонт 2-х полосной (категория III):
  60 тыс. тг/м² × 40 000 = 2 400 000 000 тг = 2.4 млрд тг
• То есть полный КР в 7 раз дороже текущего!

Поэтому стратегия: текущий ремонт раз в 5-8 лет — продлевает
жизнь дороги до полного КР на 25-30 лет. Это самый
экономически эффективный путь.

Бенчмарки городских улиц Алматы:
• Аль-Фараби (магистраль): 25-30 млн тг/км/год обслуж + ремонт
• Кабанбай Батыра (городская): 8-15 млн тг/км/год
• Дворовые проезды: 2-5 млн тг/км/год`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Полный vs выборочный
            </div>
            <div className="text-slate-200 mb-4">
              Дорога Алматы-Талдыкорган (категория II) после 20 лет эксплуатации.
              Состояние: 30% длины имеет серьёзные повреждения, остальные 70%
              в среднем состоянии. Что выбрать?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Полный капремонт 100% длины" },
                { v: "b", t: "Выборочный капремонт — ремонт ТОЛЬКО проблемных 30% длины с заменой подосновы. Стоимость в 2-3 раза ниже полного КР. Оставшиеся 70% можно усилить текущим ремонтом (фрезеровка + слой) — это дополнительные 5-10 лет жизни" },
                { v: "c", t: "Только ямочный ремонт" },
                { v: "d", t: "Закрыть дорогу" },
              ].map((opt) => (
                <label key={opt.v} className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${ex3 === opt.v ? "border-slate-600 bg-slate-800" : "border-slate-800 hover:border-slate-700"}`}>
                  <input type="radio" name="ex3" value={opt.v} checked={ex3 === opt.v} onChange={() => setEx3(opt.v)} className="accent-slate-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex3Sol ? "Скрыть решение" : "Показать решение"}</button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — выборочный</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-slate-300">Решение:</strong> Выборочный
                капремонт — оптимальная стратегия для частично деградированной
                дороги. Финансово выгоднее полного КР:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Полный КР 100 км дороги II категории: ~ 80-150 млрд тг</li>
                  <li>Выборочный КР 30 км: 25-50 млрд тг (на 50-70% меньше)</li>
                  <li>+ Текущий ремонт 70 км: ~ 6-10 млрд тг</li>
                  <li>ИТОГО: 31-60 млрд тг — экономия 50% к полному КР</li>
                </ul>
                Технология выборочного КР по СН РК 3.03-09:
                <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
                  <li>Лабораторное обследование каждого километра (динамическое
                  деформирование DDM, керны асфальта)</li>
                  <li>Карта дефектов с привязкой к километрам</li>
                  <li>Деление на участки по типу повреждений:
                  • Колейность &gt; 30 мм
                  • Сетки трещин на &gt; 30% площади
                  • Просадки и колеи &gt; 10 см
                  </li>
                  <li>Проект отдельно для каждого участка</li>
                  <li>Поэтапные работы (по 2-5 км в сезон, без полного закрытия)</li>
                </ol>
                Это позволяет: продлить ресурс на 10-15 лет за 50% затрат полного КР.
                Используется для большинства республиканских автодорог РК
                (программа «Нурлы Жол» 2025-2030).
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Реконструкция vs Капремонт
            </div>
            <div className="text-slate-200 mb-4">
              Старую 2-полосную дорогу Алматы-Шу хотят преобразовать в 4-полосную с
              разделительной полосой и развязками. Это какой вид работ?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Текущий ремонт" },
                { v: "b", t: "Полный капитальный ремонт" },
                { v: "c", t: "Выборочный капремонт" },
                { v: "d", t: "Реконструкция дороги (изменение основных параметров: количество полос, ширина, разделительная полоса, развязки). Применяется СН РК 3.03-09 раздел 9, обязательная ГосЭкспертиза, новый АГПЗ, разрешение на стр-во. Бюджет реконструкции в 3-5 раз выше полного КР" },
              ].map((opt) => (
                <label key={opt.v} className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${ex4 === opt.v ? "border-slate-600 bg-slate-800" : "border-slate-800 hover:border-slate-700"}`}>
                  <input type="radio" name="ex4" value={opt.v} checked={ex4 === opt.v} onChange={() => setEx4(opt.v)} className="accent-slate-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex4Sol ? "Скрыть решение" : "Показать решение"}</button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — реконструкция</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-slate-300">Решение:</strong> Это явная
                реконструкция дороги (см. модуль reconstruction-vs-modernization):
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Изменение количества полос (2 → 4)</li>
                  <li>Изменение ширины проезжей части</li>
                  <li>Добавление новых элементов (разделительная полоса, развязки)</li>
                  <li>Возможное изменение трассы (выравнивание кривых)</li>
                  <li>Повышение категории дороги (с II на I)</li>
                </ul>
                Бюджетная разница:
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Полный капремонт 2-полосной (категория II), 200 км:
200 × 1.5 млрд тг/км = 300 млрд тг

Реконструкция в 4-полосную (категория I), 200 км:
200 × 3-5 млрд тг/км = 600 млрд - 1 трлн тг

Удорожание реконструкции:
• Земляные работы (расширение): +30%
• Развязки и мосты: +25%
• Новая разделительная полоса: +10%
• Дренажные системы: +8%
• Освещение, знаки, разметка: +12%
• Сейсмика и геологические работы: +5%
• Согласования, экспертизы, отчуждение земель: +10%

Реальные примеры РК (программа «Нурлы Жол»):
• Реконструкция Алматы-Хоргос: 800 млн $ (~ 360 млрд тг)
• Реконструкция Астана-Боровое: 250 млрд тг
• БАКАД (новое строительство кольца): 750 млн $`}
                </pre>
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          СН РК 3.03-09 (Автодороги). СНиП 3.06-04 (Категории автодорог).
          ЕНиР Сб. 27 (Земляные работы при строительстве дорог).
          КазАвтоДор — kazavtodor.kz. Программа «Нурлы Жол».
          Гос. программа дорожного хозяйства РК на 2025-2030.
        </div>
      </main>
    </div>
  );
}
