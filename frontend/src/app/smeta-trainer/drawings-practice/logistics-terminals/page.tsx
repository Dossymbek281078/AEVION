"use client";

import Link from "next/link";
import { useState } from "react";

export default function LogisticsTerminalsPage() {
  const [ex1, setEx1] = useState<string | null>(null);
  const [ex2, setEx2] = useState<string | null>(null);
  const [ex3, setEx3] = useState<string>("");
  const [ex3Submitted, setEx3Submitted] = useState(false);
  const [ex4, setEx4] = useState<string | null>(null);

  const ex3Target = 33_000_000;
  const ex3Tolerance = 2_000_000;
  const ex3Value = parseFloat(ex3.replace(/[\s_]/g, "").replace(",", "."));
  const ex3Correct = !Number.isNaN(ex3Value) && Math.abs(ex3Value - ex3Target) <= ex3Tolerance;

  const optionClass = (selected: string | null, value: string, correct: string) => {
    if (selected === null) return "bg-slate-800/60 hover:bg-slate-700/60 border-slate-700";
    if (value === correct) return "bg-emerald-900/40 border-emerald-600 text-emerald-100";
    if (selected === value) return "bg-rose-900/40 border-rose-600 text-rose-100";
    return "bg-slate-800/40 border-slate-700 text-slate-400";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300 hover:text-blue-200 transition">← К разделам</Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Логистические терминалы</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">📦 Логистические центры и терминалы</h1>
          <p className="mt-3 text-slate-400 leading-relaxed">
            Современный логистический комплекс — это не просто крытый склад, а высокотехнологичный
            объект класса A+/A с прецизионными полами, стеллажными системами на 10 000+ палетомест,
            доковыми группами, ESFR-спринклерами и WMS-управлением. В РК сегмент бурно растёт
            (Хоргос, СЭЗ Astana, Damu Logistics), сметчик должен уверенно считать каркас,
            спецоборудование, стеллажи и климатику. Модуль #173 разбирает ключевые узлы и нормативы.
          </p>
        </section>

        {/* Section 1 */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
          <h2 className="text-2xl font-semibold text-blue-200">1. Классификация складов (КП РК / Knight Frank)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="text-left py-2 px-2">Класс</th>
                  <th className="text-left py-2 px-2">Высота под балкой</th>
                  <th className="text-left py-2 px-2">Шаг колонн</th>
                  <th className="text-left py-2 px-2">Нагрузка на пол</th>
                  <th className="text-left py-2 px-2">Доки на 1000 м²</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                <tr className="border-b border-slate-800"><td className="py-2 px-2 font-semibold text-emerald-300">A+</td><td>≥ 13–14 м</td><td>12×24 м</td><td>≥ 6 т/м²</td><td>1 на 700 м²</td></tr>
                <tr className="border-b border-slate-800"><td className="py-2 px-2 font-semibold text-emerald-300">A</td><td>12 м</td><td>12×24 м</td><td>5 т/м²</td><td>1 на 1000 м²</td></tr>
                <tr className="border-b border-slate-800"><td className="py-2 px-2 font-semibold text-amber-300">B+</td><td>10 м</td><td>9×24 м</td><td>4 т/м²</td><td>1 на 1500 м²</td></tr>
                <tr className="border-b border-slate-800"><td className="py-2 px-2 font-semibold text-amber-300">B</td><td>8 м</td><td>9×18 м</td><td>3 т/м²</td><td>1 на 2000 м²</td></tr>
                <tr className="border-b border-slate-800"><td className="py-2 px-2 font-semibold text-rose-300">C</td><td>6 м</td><td>6×12 м</td><td>2 т/м²</td><td>пандус</td></tr>
                <tr><td className="py-2 px-2 font-semibold text-rose-300">D</td><td>&lt; 6 м</td><td>любой</td><td>1–1.5 т/м²</td><td>—</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2 */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
          <h2 className="text-2xl font-semibold text-blue-200">2. Конструктив каркаса и полы</h2>
          <ul className="list-disc pl-6 text-slate-300 space-y-1.5">
            <li>Сетка колонн A класса: <span className="text-emerald-300">12×24 м</span> (макс. свободные пролёты для стеллажей).</li>
            <li>Полы: бетон М400 толщ. <span className="text-emerald-300">200 мм</span> + топпинг кварц/корунд 5 кг/м², ровность <span className="text-emerald-300">FF≥35 / FL≥25</span> (DIN 18202 / ACI 117).</li>
            <li>Нагрузка от стеллажа узла: <span className="text-emerald-300">5–7 т/м²</span>, точечная под опору 6–8 т.</li>
            <li>Каркас — металлоконструкции пролёт 24 м, ограждение — сэндвич-панели 100–150 мм.</li>
            <li>Кровля — профлист + минвата 200 мм, уклон 1.5–3%, водосток внутренний.</li>
          </ul>
        </section>

        {/* Section 3 */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
          <h2 className="text-2xl font-semibold text-blue-200">3. Стеллажные системы</h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="bg-slate-800/40 rounded-lg p-4 border border-slate-700">
              <h3 className="font-semibold text-emerald-300">Фронтальные (selective)</h3>
              <p className="text-slate-300 mt-1">100% доступ к каждой палете. Бренды: Mecalux, SSI Schaefer, Polypal, Constructor. Цена в РК: <span className="text-emerald-300">35 000–55 000 тг/палетоместо</span>.</p>
            </div>
            <div className="bg-slate-800/40 rounded-lg p-4 border border-slate-700">
              <h3 className="font-semibold text-emerald-300">Drive-in (глубинные)</h3>
              <p className="text-slate-300 mt-1">Глубокая загрузка однотипными SKU, погрузчик заезжает внутрь. Плотность +60%, доступ LIFO. <span className="text-emerald-300">25 000–40 000 тг/п.м.</span></p>
            </div>
            <div className="bg-slate-800/40 rounded-lg p-4 border border-slate-700">
              <h3 className="font-semibold text-emerald-300">Мезонинные</h3>
              <p className="text-slate-300 mt-1">Многоярусные с настилом — мелкоштучный товар, e-commerce. 2–4 уровня.</p>
            </div>
            <div className="bg-slate-800/40 rounded-lg p-4 border border-slate-700">
              <h3 className="font-semibold text-emerald-300">Гравитационные / Push-back</h3>
              <p className="text-slate-300 mt-1">Ролики с уклоном (FIFO для гравитац., LIFO для push-back). Скоропорт, FMCG.</p>
            </div>
            <div className="bg-slate-800/40 rounded-lg p-4 border border-slate-700">
              <h3 className="font-semibold text-emerald-300">Мобильные (Movirack)</h3>
              <p className="text-slate-300 mt-1">На рельсах, плотность +80%, 1 проход. Для архивов и фарма.</p>
            </div>
            <div className="bg-slate-800/40 rounded-lg p-4 border border-slate-700">
              <h3 className="font-semibold text-emerald-300">Набивные / Pallet shuttle</h3>
              <p className="text-slate-300 mt-1">Автоматический челнок внутри глубинных каналов, +120% плотности. Премиум для A+.</p>
            </div>
          </div>
        </section>

        {/* Section 4 */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
          <h2 className="text-2xl font-semibold text-blue-200">4. Доковое оборудование (DOK)</h2>
          <ul className="list-disc pl-6 text-slate-300 space-y-1.5">
            <li><span className="text-emerald-300">Доклевеллер</span> (гидравлич. выравнивающая платформа) 2.0×2.5 м, г/п 6 т — компенсирует разницу высот.</li>
            <li><span className="text-emerald-300">Секционные ворота</span> 3×3 м (стандарт) или 3.5×3.5 м, утеплённые сэндвич-панели 40 мм.</li>
            <li><span className="text-emerald-300">Докшелтер</span> (герметик-уплотнитель) для холодных зон — снижает теплопотери в 5–7 раз.</li>
            <li><span className="text-emerald-300">Резиновые бамперы</span> + сигнальные лампы, упоры под колёса.</li>
            <li>Шаг доков: <span className="text-emerald-300">4–5 м между осями</span>; норматив — <span className="text-emerald-300">1 док на 1000–2000 м²</span> склада (1/700 для A+).</li>
            <li>Цена комплекта (док+ворота+левеллер+шелтер): <span className="text-emerald-300">2.8–4.2 млн тг</span>.</li>
          </ul>
        </section>

        {/* Section 5 */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
          <h2 className="text-2xl font-semibold text-blue-200">5. Пожаротушение ESFR</h2>
          <p className="text-slate-300">
            <span className="text-emerald-300 font-semibold">ESFR (Early Suppression Fast Response)</span> — спринклеры
            раннего обнаружения и быстрого подавления. Гасят пожар у источника без затопления всей площади,
            что критично для дорогих товаров.
          </p>
          <ul className="list-disc pl-6 text-slate-300 space-y-1.5">
            <li>Интенсивность подачи: <span className="text-emerald-300">12.2 л/м²·мин</span> (против 6 л у обычных).</li>
            <li>Расход: 12 спринклеров одновременно, нагрев колбы <span className="text-emerald-300">68–74 °C</span>.</li>
            <li>Насосная станция: <span className="text-emerald-300">2 рабочих + 1 резервный</span> насос Grundfos/Wilo.</li>
            <li>Резервуар запаса воды: <span className="text-emerald-300">≥ 600 м³</span> (60 мин работы).</li>
            <li>Норматив РК: <span className="text-emerald-300">СП РК 2.02-15-2015</span>, ТР ТС 043/2017.</li>
          </ul>
        </section>

        {/* Section 6 */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
          <h2 className="text-2xl font-semibold text-blue-200">6. Температурные режимы</h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="bg-slate-800/40 rounded-lg p-4 border border-slate-700">
              <h3 className="font-semibold text-amber-300">Сухой неотапливаемый</h3>
              <p className="text-slate-300 mt-1">+5..+25°C, стандарт промышленный. Сэндвич 100 мм.</p>
            </div>
            <div className="bg-slate-800/40 rounded-lg p-4 border border-slate-700">
              <h3 className="font-semibold text-amber-300">Отапливаемый (тёплый)</h3>
              <p className="text-slate-300 mt-1">+10..+18°C, газовые ИК-обогреватели Schwank/Roberts Gordon. Сэндвич 120–150 мм.</p>
            </div>
            <div className="bg-slate-800/40 rounded-lg p-4 border border-slate-700">
              <h3 className="font-semibold text-emerald-300">Охлаждаемый (chiller)</h3>
              <p className="text-slate-300 mt-1"><span className="text-emerald-300">+2..+8°C</span>, для фруктов/молочки. Сэндвич PIR <span className="text-emerald-300">150 мм</span>, холодильные машины аммиак/фреон.</p>
            </div>
            <div className="bg-slate-800/40 rounded-lg p-4 border border-slate-700">
              <h3 className="font-semibold text-blue-300">Морозильный (freezer)</h3>
              <p className="text-slate-300 mt-1"><span className="text-blue-300">−18..−25°C</span>, сэндвич PIR/PUR <span className="text-emerald-300">200 мм</span>, теплоизолированный пол с подогревом против грунтового вспучивания.</p>
            </div>
          </div>
        </section>

        {/* Section 7 */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
          <h2 className="text-2xl font-semibold text-blue-200">7. WMS и автоматизация</h2>
          <ul className="list-disc pl-6 text-slate-300 space-y-1.5">
            <li><span className="text-emerald-300">WMS (Warehouse Management System)</span>: Manhattan Active WM, Logistic Vision Suite, Solvo.WMS, 1C-WMS.</li>
            <li>Штрих-кодирование (1D/2D), терминалы сбора данных Honeywell/Zebra.</li>
            <li><span className="text-emerald-300">RFID</span>-метки для дорогих SKU, fashion, фармацевтики.</li>
            <li><span className="text-emerald-300">AS/RS</span> — Automated Storage/Retrieval System: краны-штабелёры до 40 м высотой, полностью автоматизированные «high-bay» склады.</li>
            <li>Конвейерные системы, сортеры (cross-belt, tilt-tray), Pick-to-Light / Voice picking.</li>
          </ul>
        </section>

        {/* Section 8 */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
          <h2 className="text-2xl font-semibold text-blue-200">8. Кросс-докинг (X-dock) и FMCG РК</h2>
          <p className="text-slate-300">
            Кросс-докинг — прямая перегрузка с приёмки на отгрузку без длительного хранения (&lt; 24 ч).
            В РК активно используют сети Magnum, Small, Galmart, Technodom, Sulpak: товар приходит
            фурой, тут же сортируется на машины развоза по магазинам.
          </p>
          <ul className="list-disc pl-6 text-slate-300 space-y-1.5">
            <li>Зоны: сухая, охлаждаемая (+2..+8°C), морозильная (−18°C) — <span className="text-emerald-300">мульти-температурный X-dock</span>.</li>
            <li>Длинный «I»-shape (доки приёма vs доки отгрузки), глубина 30–40 м.</li>
            <li>Соотношение приём/отгрузка доков: <span className="text-emerald-300">1:1</span>.</li>
          </ul>
        </section>

        {/* Section 9 */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
          <h2 className="text-2xl font-semibold text-blue-200">9. Бенчмарки РК и себестоимость</h2>
          <ul className="list-disc pl-6 text-slate-300 space-y-1.5">
            <li><span className="text-emerald-300">СЭЗ «Хоргос — Восточные ворота»</span> (Алматинская обл.) — крупнейший сухой порт, 130 га складов класса A.</li>
            <li><span className="text-emerald-300">Astana Tech Park / Damu Logistics</span> — пригород Астаны, А+ комплексы 50 000+ м² для e-commerce (Kaspi, Wildberries, Halyk Market).</li>
            <li><span className="text-emerald-300">Damu Logistics Almaty</span> (район ТЭЦ-2) — 60 000 м² мультитемпературный.</li>
            <li>Себестоимость склада <strong className="text-emerald-300">класса A</strong>: <span className="text-emerald-300">280 000–380 000 тг/м²</span> без учёта стеллажей.</li>
            <li>Класс A+ с авто-системами и AS/RS: <span className="text-emerald-300">500 000–700 000 тг/м²</span>.</li>
            <li>Аренда A класса (2026): <span className="text-emerald-300">2 800–4 200 тг/м²/мес</span> в Алматы, 2 400–3 600 тг — в Астане.</li>
          </ul>
        </section>

        {/* EXERCISES */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-amber-300">🎯 Интерактивные задания</h2>

          {/* ex1 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
            <h3 className="font-semibold text-slate-100">Задание 1. Минимальная высота склада класса А (под балкой)?</h3>
            <div className="grid sm:grid-cols-2 gap-2">
              {[
                { v: "a", t: "6 м" },
                { v: "b", t: "12 м" },
                { v: "c", t: "8 м" },
                { v: "d", t: "16 м" },
              ].map((o) => (
                <button
                  key={o.v}
                  onClick={() => setEx1(o.v)}
                  disabled={ex1 !== null}
                  className={`text-left rounded-lg border px-4 py-2.5 transition ${optionClass(ex1, o.v, "b")}`}
                >
                  <span className="text-slate-400 mr-2">{o.v})</span>{o.t}
                </button>
              ))}
            </div>
            {ex1 !== null && (
              <div className={`text-sm mt-2 ${ex1 === "b" ? "text-emerald-300" : "text-rose-300"}`}>
                {ex1 === "b"
                  ? "✓ Верно! Класс A: 12 м под балкой. A+ — уже 13–14 м."
                  : "✗ Правильный ответ: b) 12 м. Это базовый стандарт класса A (12×24 сетка, FF≥35)."}
              </div>
            )}
          </div>

          {/* ex2 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
            <h3 className="font-semibold text-slate-100">Задание 2. Какая стеллажная система для глубокой загрузки одинаковыми палетами?</h3>
            <div className="grid sm:grid-cols-2 gap-2">
              {[
                { v: "a", t: "фронтальные (selective)" },
                { v: "b", t: "гравитационные" },
                { v: "c", t: "drive-in (глубинные)" },
                { v: "d", t: "мезонинные" },
              ].map((o) => (
                <button
                  key={o.v}
                  onClick={() => setEx2(o.v)}
                  disabled={ex2 !== null}
                  className={`text-left rounded-lg border px-4 py-2.5 transition ${optionClass(ex2, o.v, "c")}`}
                >
                  <span className="text-slate-400 mr-2">{o.v})</span>{o.t}
                </button>
              ))}
            </div>
            {ex2 !== null && (
              <div className={`text-sm mt-2 ${ex2 === "c" ? "text-emerald-300" : "text-rose-300"}`}>
                {ex2 === "c"
                  ? "✓ Верно! Drive-in (глубинные) — погрузчик заезжает в канал, плотность +60%, доступ LIFO. Идеально для однотипных SKU."
                  : "✗ Правильный ответ: c) drive-in (глубинные). Фронтальные дают 100% доступ, но низкая плотность; гравитационные — FIFO, нужен уклон; мезонин — мелкоштучный."}
              </div>
            )}
          </div>

          {/* ex3 numeric */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
            <h3 className="font-semibold text-slate-100">Задание 3. Стоимость фронтальных стеллажей для склада 800 палетомест по 41 000 тг/п.м.?</h3>
            <p className="text-sm text-slate-400">Введите сумму в тенге (округлите до миллиона):</p>
            <div className="flex gap-2 items-center flex-wrap">
              <input
                type="text"
                value={ex3}
                onChange={(e) => setEx3(e.target.value)}
                disabled={ex3Submitted}
                placeholder="например 33000000"
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 w-64 disabled:opacity-60"
              />
              <button
                onClick={() => setEx3Submitted(true)}
                disabled={ex3Submitted || ex3.trim() === ""}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium disabled:opacity-50"
              >
                Проверить
              </button>
            </div>
            {ex3Submitted && (
              <div className={`text-sm mt-2 ${ex3Correct ? "text-emerald-300" : "text-rose-300"}`}>
                {ex3Correct
                  ? "✓ Верно! 800 × 41 000 = 32 800 000 ≈ 33 млн тг. Допуск ±2 млн на округления и доставку/монтаж."
                  : `✗ Точный расчёт: 800 п.м. × 41 000 тг = 32 800 000 тг. Округление до 33 млн. Допуск ±2 млн.`}
              </div>
            )}
          </div>

          {/* ex4 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
            <h3 className="font-semibold text-slate-100">Задание 4. Зачем нужен ESFR-спринклер для склада класса А?</h3>
            <div className="grid gap-2">
              {[
                { v: "a", t: "гасит пожар у источника без открытия большой площади спринклеров (раннее обнаружение, быстрое подавление)" },
                { v: "b", t: "дешевле обычного" },
                { v: "c", t: "проще монтаж" },
                { v: "d", t: "не нужен по нормам" },
              ].map((o) => (
                <button
                  key={o.v}
                  onClick={() => setEx4(o.v)}
                  disabled={ex4 !== null}
                  className={`text-left rounded-lg border px-4 py-2.5 transition ${optionClass(ex4, o.v, "a")}`}
                >
                  <span className="text-slate-400 mr-2">{o.v})</span>{o.t}
                </button>
              ))}
            </div>
            {ex4 !== null && (
              <div className={`text-sm mt-2 ${ex4 === "a" ? "text-emerald-300" : "text-rose-300"}`}>
                {ex4 === "a"
                  ? "✓ Верно! ESFR (Early Suppression Fast Response) подаёт 12.2 л/м²·мин и тушит у источника, минимизируя ущерб товару. Дороже обычного, но обязателен для A класса с высоким стеллажным хранением."
                  : "✗ Правильный ответ: a). ESFR дороже обычного, монтаж сложнее, но он обязателен для высотных складов A+/A — гасит очаг без затопления всей площади и спасает дорогой товар."}
              </div>
            )}
          </div>
        </section>

        <div className="pt-4 border-t border-slate-800 flex justify-between text-sm">
          <Link href="/smeta-trainer/drawings-practice" className="text-blue-300 hover:text-blue-200">← К разделам</Link>
          <span className="text-slate-500">Модуль #173 · Логистические терминалы</span>
        </div>
      </main>
    </div>
  );
}
