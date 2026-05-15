"use client";

import Link from "next/link";
import { useState } from "react";

export default function IndustrialFloorsPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex1Result, setEx1Result] = useState<"ok" | "bad" | null>(null);
  const [ex1Sol, setEx1Sol] = useState(false);

  const [ex2, setEx2] = useState<string>("");
  const [ex2Result, setEx2Result] = useState<"ok" | "bad" | null>(null);
  const [ex2Sol, setEx2Sol] = useState(false);

  const [ex3, setEx3] = useState<string>("");
  const [ex3Result, setEx3Result] = useState<"ok" | "bad" | null>(null);
  const [ex3Sol, setEx3Sol] = useState(false);

  const [ex4, setEx4] = useState<string>("");
  const [ex4Result, setEx4Result] = useState<"ok" | "bad" | null>(null);
  const [ex4Sol, setEx4Sol] = useState(false);

  const checkEx1 = () => setEx1Result(ex1 === "c" ? "ok" : "bad");
  const checkEx2 = () => setEx2Result(ex2 === "b" ? "ok" : "bad");
  const checkEx3 = () => {
    const v = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
    if (isNaN(v)) {
      setEx3Result("bad");
      return;
    }
    setEx3Result(Math.abs(v - 1800000) <= 150000 ? "ok" : "bad");
  };
  const checkEx4 = () => setEx4Result(ex4 === "d" ? "ok" : "bad");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300 hover:text-blue-200 transition">← К разделам</Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Промышленные полы</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🏭 Промышленные полы детально</h1>
          <p className="mt-3 text-slate-400 leading-relaxed">
            Промышленные полы — это специальные напольные покрытия для производственных,
            складских, торговых и инфраструктурных объектов с высокими нагрузками (5–50 т/м²),
            химической агрессией, температурными перепадами и износом от техники. Сметчик
            должен различать типы покрытий (бетонные топпинговые, эпоксидные, полиуретановые,
            ММА, наливные декоративные), правильно подбирать систему под условия эксплуатации
            и не путать стоимость материала с полным узлом «основание + грунт + покрытие + швы».
          </p>
        </section>

        {/* Section 1 — Classification */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-3">
          <h2 className="text-2xl font-semibold text-slate-50">1. Классификация по нагрузке</h2>
          <p className="text-slate-300 leading-relaxed">
            Подбор покрытия начинается с расчётной нагрузки на пол: точечной (колесо тележки,
            опора стеллажа) и распределённой (хранение паллет, оборудование).
          </p>
          <ul className="text-slate-300 space-y-2 list-disc list-inside">
            <li><span className="text-slate-100 font-medium">5–10 т/м²</span> — лёгкие склады, торговые залы, паркинги легковых.</li>
            <li><span className="text-slate-100 font-medium">10–20 т/м²</span> — склады класса B/A, цеха лёгкого машиностроения.</li>
            <li><span className="text-slate-100 font-medium">20–35 т/м²</span> — тяжёлые склады с ричтраками, металлургия, СТО.</li>
            <li><span className="text-slate-100 font-medium">35–50 т/м²</span> — портовые терминалы, тяжёлая промышленность, депо.</li>
          </ul>
          <p className="text-slate-400 text-sm">
            Чем выше нагрузка — тем толще плита (180–300 мм), выше марка бетона (B30–B40),
            больше слой топпинга и плотнее армирование (сталефибра 25–40 кг/м³ + сетка).
          </p>
        </section>

        {/* Section 2 — Concrete with topping */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-3">
          <h2 className="text-2xl font-semibold text-slate-50">2. Бетонные полы с упрочнителем-топпингом</h2>
          <p className="text-slate-300 leading-relaxed">
            Самый массовый тип для складов и цехов. Поверх свежеуложенного бетона (через 3–6 ч,
            когда «не вязнет след») втирается сухая упрочняющая смесь — топпинг.
          </p>
          <ul className="text-slate-300 space-y-2 list-disc list-inside">
            <li><span className="text-slate-100 font-medium">Корундовый</span> топпинг (Mastertop 100, Sikafloor-2 SynTop) — универсал, 5–7 кг/м².</li>
            <li><span className="text-slate-100 font-medium">Кварцевый</span> — экономный, 3–5 кг/м², для лёгких нагрузок.</li>
            <li><span className="text-slate-100 font-medium">Металлический</span> — экстремальные нагрузки, 6–8 кг/м², в 2–3 раза дороже.</li>
          </ul>
          <p className="text-slate-400 text-sm">
            Карты заливки — 6×6 м или 6×8 м, разрезаются нарезчиком на глубину 1/3 толщины
            плиты в первые 6–24 ч после укладки. Финишная затирка вертолётами в 2–3 прохода.
          </p>
          <div className="mt-3 bg-slate-950/60 border border-slate-800 rounded-lg p-4 text-sm text-slate-300">
            <span className="text-slate-100 font-medium">Цена «под ключ» в РК (2026):</span> 4 500 – 7 500 тг/м²
            для топпинга по бетону 180–200 мм, без основания.
          </div>
        </section>

        {/* Section 3 — Epoxy */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-3">
          <h2 className="text-2xl font-semibold text-slate-50">3. Полимерные эпоксидные покрытия</h2>
          <p className="text-slate-300 leading-relaxed">
            Двухкомпонентные эпоксидные системы толщиной 1–3 мм. Высокая химическая стойкость
            к кислотам, щелочам, маслам и нефтепродуктам. Жёсткие, не эластичные.
          </p>
          <ul className="text-slate-300 space-y-2 list-disc list-inside">
            <li>Цеха химии, фармы, гальваники, пищевые производства (молокозаводы, мясокомбинаты).</li>
            <li>Склады с риском пролива агрессивных жидкостей.</li>
            <li>Толщина 1,5–2 мм — стандарт; 3 мм — повышенная износостойкость.</li>
            <li>Не работают при температуре пола ниже +10 °C при укладке.</li>
          </ul>
          <div className="mt-3 bg-slate-950/60 border border-slate-800 rounded-lg p-4 text-sm text-slate-300">
            <span className="text-slate-100 font-medium">Цена в РК:</span> 3 500 – 6 000 тг/м² за систему 1,5–2 мм
            (грунт + базовый слой + финиш).
          </div>
        </section>

        {/* Section 4 — Polyurethane */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-3">
          <h2 className="text-2xl font-semibold text-slate-50">4. Полимерные полиуретановые покрытия</h2>
          <p className="text-slate-300 leading-relaxed">
            Эластичные системы, гасят микровибрации и удары, выдерживают резкие перепады
            температур и термоудар (пар, горячая вода). Цвет, как правило, серый/RAL.
          </p>
          <ul className="text-slate-300 space-y-2 list-disc list-inside">
            <li>Паркинги (стилобаты, подземные ТРЦ), морозильные склады, мясо- и рыбоперерабатывающие цеха.</li>
            <li>Диапазон эксплуатации: <span className="text-slate-100 font-medium">−40 °C … +120 °C</span> (для термостойких ПУ-цемент систем — до +150 °C).</li>
            <li>Лучше эпоксидки переносит низкие температуры и ударные нагрузки тележек.</li>
            <li>Толщина 2–5 мм; верхний слой — антискользящий, с кварцевой засыпкой.</li>
          </ul>
          <div className="mt-3 bg-slate-950/60 border border-slate-800 rounded-lg p-4 text-sm text-slate-300">
            <span className="text-slate-100 font-medium">Цена в РК:</span> 4 500 – 8 000 тг/м²
            (ПУ-цементные системы для пищёвки — до 12 000 тг/м²).
          </div>
        </section>

        {/* Section 5 — Decorative epoxy-quartz */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-3">
          <h2 className="text-2xl font-semibold text-slate-50">5. Наливные эпоксидно-кварцевые декоративные</h2>
          <p className="text-slate-300 leading-relaxed">
            Полы повышенной декоративности: цветной кварцевый песок втапливается в эпоксидную
            матрицу, сверху — прозрачный лак. Эстетичный вид + хорошая износостойкость.
          </p>
          <ul className="text-slate-300 space-y-2 list-disc list-inside">
            <li>Паркинги ТРЦ и БЦ, шоурумы автодилеров, чистые зоны производств, выставочные залы.</li>
            <li>Толщина 2–5 мм; цветовые комбинации задаются миксом гранул.</li>
            <li>Низкое пылеобразование, легко моется, ремонтопригоден локально.</li>
          </ul>
          <div className="mt-3 bg-slate-950/60 border border-slate-800 rounded-lg p-4 text-sm text-slate-300">
            <span className="text-slate-100 font-medium">Цена в РК:</span> 5 000 – 9 000 тг/м²
            в зависимости от слоя и сложности рисунка.
          </div>
        </section>

        {/* Section 6 — MMA */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-3">
          <h2 className="text-2xl font-semibold text-slate-50">6. Метилметакрилатные полы (ММА)</h2>
          <p className="text-slate-300 leading-relaxed">
            Реактивные акриловые системы с пероксидным отвердителем. Главное преимущество —
            скорость: набор прочности 1–2 ч, на следующий день можно эксплуатировать.
          </p>
          <ul className="text-slate-300 space-y-2 list-disc list-inside">
            <li>Пищевые производства (нельзя останавливать на 7 суток), фарма, операционные.</li>
            <li>Работают при отрицательных температурах (до −25 °C) — заправки, морозильники.</li>
            <li>Резкий запах при укладке (вентиляция обязательна), дорогая система.</li>
            <li>Толщина 3–6 мм; швы свариваются химически — монолитное покрытие.</li>
          </ul>
          <div className="mt-3 bg-slate-950/60 border border-slate-800 rounded-lg p-4 text-sm text-slate-300">
            <span className="text-slate-100 font-medium">Цена в РК:</span> 9 000 – 16 000 тг/м²,
            используется там, где простой производства дороже самого покрытия.
          </div>
        </section>

        {/* Section 7 — Substrate prep */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-3">
          <h2 className="text-2xl font-semibold text-slate-50">7. Подготовка основания (по ЭСН Сб.7)</h2>
          <p className="text-slate-300 leading-relaxed">
            Самая частая ошибка сметчика — забыть учесть подготовку. Адгезия полимера зависит
            от прочности и шероховатости поверхности.
          </p>
          <ul className="text-slate-300 space-y-2 list-disc list-inside">
            <li><span className="text-slate-100 font-medium">Фрезеровка</span> — снять «цементное молочко», старую краску. 800–1 500 тг/м².</li>
            <li><span className="text-slate-100 font-medium">Дробеструйная обработка</span> — открыть поры бетона. 600–1 200 тг/м².</li>
            <li><span className="text-slate-100 font-medium">Шлифовка алмазная</span> — финишное выравнивание. 500–900 тг/м².</li>
            <li><span className="text-slate-100 font-medium">Праймер эпоксидный/ПУ</span> — обязательно перед полимерным слоем. 350–600 тг/м².</li>
            <li><span className="text-slate-100 font-medium">Ремонт трещин и каверн</span> — расшивка + ремсостав Sika MonoTop / Mapei Mapegrout.</li>
          </ul>
        </section>

        {/* Section 8 — Joints */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-3">
          <h2 className="text-2xl font-semibold text-slate-50">8. Деформационные швы</h2>
          <p className="text-slate-300 leading-relaxed">
            Швы — ахиллесова пята промышленного пола. Через них уходит ресурс покрытия и
            попадает влага под плиту.
          </p>
          <ul className="text-slate-300 space-y-2 list-disc list-inside">
            <li><span className="text-slate-100 font-medium">Конструкционные</span> — между захватками заливки, армируются дюбелями скольжения.</li>
            <li><span className="text-slate-100 font-medium">Изоляционные</span> — у стен, колонн, фундаментов оборудования (компрессионная лента 10 мм).</li>
            <li><span className="text-slate-100 font-medium">Усадочные</span> — нарезаются картами 6×6 м на 1/3 толщины плиты.</li>
            <li>Заполнение: герметик Sikaflex PRO-3 / Sika-2C SL или эпоксидно-полиуретановый шнур.</li>
            <li>Расход герметика: шов 8×20 мм — 0,16 л/м.п.</li>
          </ul>
        </section>

        {/* Section 9 — Benchmarks RK */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-3">
          <h2 className="text-2xl font-semibold text-slate-50">9. Бенчмарки по РК (2026, «под ключ»)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-300">
              <thead className="text-xs uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-3 py-2">Объект</th>
                  <th className="px-3 py-2">Система</th>
                  <th className="px-3 py-2">Цена, тг/м²</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                <tr><td className="px-3 py-2">Склад класса А (стеллажи, ричтраки)</td><td className="px-3 py-2">Бетон 200 мм + топпинг 5–7 кг/м²</td><td className="px-3 py-2 text-slate-100">6 500 – 8 500</td></tr>
                <tr><td className="px-3 py-2">Автосервис, СТО</td><td className="px-3 py-2">Бетон + эпоксидное покрытие 1,5 мм</td><td className="px-3 py-2 text-slate-100">4 500 – 6 500</td></tr>
                <tr><td className="px-3 py-2">Подземный паркинг ТРЦ</td><td className="px-3 py-2">Эпоксидно-кварцевый наливной 3 мм</td><td className="px-3 py-2 text-slate-100">6 500 – 9 000</td></tr>
                <tr><td className="px-3 py-2">Морозильный склад</td><td className="px-3 py-2">Полиуретановое 3 мм</td><td className="px-3 py-2 text-slate-100">6 000 – 8 500</td></tr>
                <tr><td className="px-3 py-2">Пищевой цех</td><td className="px-3 py-2">ПУ-цемент 6 мм или ММА 4 мм</td><td className="px-3 py-2 text-slate-100">10 000 – 16 000</td></tr>
                <tr><td className="px-3 py-2">Шоурум, выставочный зал</td><td className="px-3 py-2">Эпоксидно-кварцевый декоративный</td><td className="px-3 py-2 text-slate-100">7 000 – 11 000</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Exercises */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-50">✏️ Упражнения</h2>

          {/* Ex1 */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="text-sm text-slate-400">Упражнение 1</div>
            <div className="text-slate-100 font-medium">
              Какой расход топпинга на бетонный пол склада класса А?
            </div>
            <div className="space-y-2 text-slate-300">
              {[
                { v: "a", t: "1–2 кг/м²" },
                { v: "b", t: "2–3 кг/м²" },
                { v: "c", t: "5–7 кг/м²" },
                { v: "d", t: "10–15 кг/м²" },
              ].map((opt) => (
                <label key={opt.v} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="ex1"
                    value={opt.v}
                    checked={ex1 === opt.v}
                    onChange={(e) => setEx1(e.target.value)}
                    className="accent-blue-500"
                  />
                  <span>{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={checkEx1} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">Проверить</button>
              <button onClick={() => setEx1Sol(!ex1Sol)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition">{ex1Sol ? "Скрыть решение" : "Показать решение"}</button>
            </div>
            {ex1Result === "ok" && <div className="text-emerald-400 text-sm">✓ Верно. Корундовый топпинг для класса А — 5–7 кг/м².</div>}
            {ex1Result === "bad" && <div className="text-rose-400 text-sm">✗ Неверно. Подсказка: класс А — это тяжёлые нагрузки.</div>}
            {ex1Sol && (
              <div className="mt-2 text-sm text-slate-400 bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                Правильный ответ: <span className="text-slate-100">c) 5–7 кг/м²</span>. Корундовый топпинг
                для тяжёлых складских нагрузок втирается из расчёта 5–7 кг/м²; кварцевый облегчённый — 3–5 кг/м²,
                металлический для экстремальных — 6–8 кг/м².
              </div>
            )}
          </div>

          {/* Ex2 */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="text-sm text-slate-400">Упражнение 2</div>
            <div className="text-slate-100 font-medium">
              Какое покрытие выбрать для морозильного склада, где ездят электротележки?
            </div>
            <div className="space-y-2 text-slate-300">
              {[
                { v: "a", t: "Эпоксидное" },
                { v: "b", t: "Полиуретановое" },
                { v: "c", t: "ММА" },
                { v: "d", t: "Линолеум коммерческий" },
              ].map((opt) => (
                <label key={opt.v} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="ex2"
                    value={opt.v}
                    checked={ex2 === opt.v}
                    onChange={(e) => setEx2(e.target.value)}
                    className="accent-blue-500"
                  />
                  <span>{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={checkEx2} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">Проверить</button>
              <button onClick={() => setEx2Sol(!ex2Sol)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition">{ex2Sol ? "Скрыть решение" : "Показать решение"}</button>
            </div>
            {ex2Result === "ok" && <div className="text-emerald-400 text-sm">✓ Верно. Полиуретановое работает при −40 °C и гасит удары тележек.</div>}
            {ex2Result === "bad" && <div className="text-rose-400 text-sm">✗ Неверно. Подумайте об эластичности и температурном диапазоне.</div>}
            {ex2Sol && (
              <div className="mt-2 text-sm text-slate-400 bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                Правильный ответ: <span className="text-slate-100">b) Полиуретановое</span>. Эпоксидка хрупкая на холоде
                и трескается от ударов тележек; ММА работает, но в 2–3 раза дороже без объективной
                необходимости; ПУ-системы держат −40 °C и эластичны.
              </div>
            )}
          </div>

          {/* Ex3 */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="text-sm text-slate-400">Упражнение 3 (расчёт)</div>
            <div className="text-slate-100 font-medium">
              Склад площадью 400 м². Полимерное эпоксидное покрытие 1,5 мм стоит 4 500 тг/м²
              «под ключ». Какова стоимость только полового покрытия (без основания)?
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={ex3}
                onChange={(e) => setEx3(e.target.value)}
                placeholder="введите сумму в тенге"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
              <span className="text-slate-500 text-sm">тг</span>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={checkEx3} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">Проверить</button>
              <button onClick={() => setEx3Sol(!ex3Sol)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition">{ex3Sol ? "Скрыть решение" : "Показать решение"}</button>
            </div>
            {ex3Result === "ok" && <div className="text-emerald-400 text-sm">✓ Верно. 400 × 4 500 = 1 800 000 тг.</div>}
            {ex3Result === "bad" && <div className="text-rose-400 text-sm">✗ Не сходится. Перемножьте площадь на цену.</div>}
            {ex3Sol && (
              <div className="mt-2 text-sm text-slate-400 bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                Решение: <span className="text-slate-100">400 м² × 4 500 тг/м² = 1 800 000 тг</span>.
                Помните, что в смете отдельно идут подготовка основания (фрезеровка/дробеструйка +
                праймер), деформационные швы и плинтус — это не входит в «цену покрытия за м²».
              </div>
            )}
          </div>

          {/* Ex4 */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="text-sm text-slate-400">Упражнение 4</div>
            <div className="text-slate-100 font-medium">
              Чем принципиально отличается ММА-пол от эпоксидного?
            </div>
            <div className="space-y-2 text-slate-300">
              {[
                { v: "a", t: "ММА дешевле в 1,5–2 раза" },
                { v: "b", t: "ММА экологичнее (без запаха при монтаже)" },
                { v: "c", t: "ММА просто дороже, других отличий нет" },
                { v: "d", t: "ММА отверждается за 1–2 ч — можно сразу эксплуатировать" },
              ].map((opt) => (
                <label key={opt.v} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="ex4"
                    value={opt.v}
                    checked={ex4 === opt.v}
                    onChange={(e) => setEx4(e.target.value)}
                    className="accent-blue-500"
                  />
                  <span>{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={checkEx4} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">Проверить</button>
              <button onClick={() => setEx4Sol(!ex4Sol)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition">{ex4Sol ? "Скрыть решение" : "Показать решение"}</button>
            </div>
            {ex4Result === "ok" && <div className="text-emerald-400 text-sm">✓ Верно. ММА набирает прочность за 1–2 ч.</div>}
            {ex4Result === "bad" && <div className="text-rose-400 text-sm">✗ Неверно. Главный плюс ММА — скорость, ради неё его и платят.</div>}
            {ex4Sol && (
              <div className="mt-2 text-sm text-slate-400 bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                Правильный ответ: <span className="text-slate-100">d) отверждается за 1–2 ч</span>.
                Эпоксидная система набирает рабочую прочность 5–7 суток. ММА позволяет не
                останавливать производство — поэтому используется в пищёвке, фарме и на АЗС,
                несмотря на цену 9 000–16 000 тг/м² и резкий запах при монтаже.
              </div>
            )}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-slate-50">🎯 Ключевые выводы</h2>
          <ul className="mt-3 space-y-2 text-slate-300 list-disc list-inside">
            <li>Тип покрытия выбирается по триаде: нагрузка / температура / агрессивная среда.</li>
            <li>Бетон + топпинг — массовый стандарт складов; полимеры — там, где есть химия/температура/гигиена.</li>
            <li>Эпоксидка жёсткая и боится холода; полиуретан эластичный и держит мороз; ММА быстрый и дорогой.</li>
            <li>Подготовка основания и швы — 20–35 % от стоимости пола, не забывайте их в смете.</li>
            <li>В бенчмарках 2026 года по РК: 4 500 – 9 000 тг/м² — рабочий коридор для большинства промобъектов.</li>
          </ul>
        </section>

        <div className="pt-4">
          <Link href="/smeta-trainer/drawings-practice" className="inline-flex items-center gap-2 text-blue-300 hover:text-blue-200 transition">
            ← Вернуться к разделам
          </Link>
        </div>
      </main>
    </div>
  );
}
