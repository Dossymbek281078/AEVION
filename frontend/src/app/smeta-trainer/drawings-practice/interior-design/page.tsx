"use client";
import Link from "next/link";
import { useState } from "react";

function checkNum(input: string, expected: number, tol = 0.05): boolean {
  const v = parseFloat(input.replace(",", ".").replace(/\s/g, ""));
  if (isNaN(v)) return false;
  return Math.abs((v - expected) / expected) <= tol;
}

const STAGES = [
  { n: 1, name: "Замеры и техзадание", desc: "Обмер помещений, фото-фиксация, бриф клиента, образ жизни", days: "3-7 дней", price: "200-500 тг/м²" },
  { n: 2, name: "Концепция (3 варианта)", desc: "Стилевое решение, мудборды, цветовые палитры, референсы", days: "10-14 дней", price: "500-1 500 тг/м²" },
  { n: 3, name: "Планировочные решения", desc: "Перепланировка, расстановка мебели, зонирование, эргономика", days: "7-10 дней", price: "400-1 200 тг/м²" },
  { n: 4, name: "Развёртки + 3D-визуализации", desc: "Развёртки стен, 3D-рендеры всех помещений, ракурсы", days: "14-21 день", price: "800-2 500 тг/м²" },
  { n: 5, name: "Рабочие чертежи + спецификация", desc: "Полы, потолки, электрика, сантехника, узлы, ведомости", days: "14-21 день", price: "600-1 800 тг/м²" },
  { n: 6, name: "Авторский надзор", desc: "Контроль выполнения проекта на объекте, корректировки", days: "Срок ремонта", price: "10% от стоимости проекта" },
];

const TIERS = [
  { name: "Эконом (отечественные)", margin: "0-15%", desc: "Казахстанские/российские бренды, серийная мебель IKEA, ламинат, стандартная керамика", budget: "до 50 000 тг/м²", color: "from-emerald-600 to-green-600" },
  { name: "Средний (импорт массовый)", margin: "15-25%", desc: "Польша, Китай, Турция: керамогранит, кварцвинил, фабричная корпусная мебель", budget: "50-120 тг/м²", color: "from-blue-600 to-cyan-600" },
  { name: "Премиум (брендовые европейские)", margin: "25-50%", desc: "Италия, Германия, Испания: массив, итальянская плитка, дизайнерский свет", budget: "120-300 тыс. тг/м²", color: "from-purple-600 to-fuchsia-600" },
  { name: "Люкс (эксклюзив + индив. заказ)", margin: "50-100%", desc: "Mr. Perswall, Boffi, Poliform — индивидуальные заказы, столярка под проект", budget: "300-700 тыс. тг/м²", color: "from-pink-600 to-rose-600" },
  { name: "Топ (антиквариат, дизайнерская мебель)", margin: "100-300%", desc: "Антиквариат, авторская мебель, лимитированные коллекции, art-объекты", budget: "от 700 тыс. тг/м²", color: "from-amber-500 to-orange-600" },
];

const FURNITURE = [
  { room: "Гостиная", items: ["Диван 3-местный", "Кресла (2 шт)", "Журнальный столик", "ТВ-тумба", "Стеллаж", "Ковёр", "Торшер + бра", "Шторы блэкаут", "Декор"], budget: "800 тыс. - 5 млн тг" },
  { room: "Кухня", items: ["Кухонный гарнитур (под заказ)", "Столешница (камень/кварц)", "Фартук", "Встроенная техника", "Обеденный стол + 4 стула", "Подвесные светильники", "Барные стулья"], budget: "1.5-8 млн тг" },
  { room: "Спальня", items: ["Кровать (с матрасом)", "2 прикроватные тумбы", "Шкаф-купе или гардеробная", "Туалетный столик", "Пуф/банкетка", "Бра/торшер", "Шторы + тюль"], budget: "600 тыс. - 3 млн тг" },
  { room: "Санузел", items: ["Унитаз подвесной + инсталляция", "Раковина с тумбой", "Ванна или душ. кабина", "Смесители (3 шт)", "Зеркало с подсветкой", "Полотенцесушитель", "Аксессуары"], budget: "500 тыс. - 2.5 млн тг" },
  { room: "Прихожая", items: ["Шкаф для верхней одежды", "Обувница", "Банкетка", "Зеркало", "Вешалка-крючки", "Коврик-грязезащита", "Освещение"], budget: "300 тыс. - 1.5 млн тг" },
  { room: "Балкон / лоджия", items: ["Утепление + остекление", "Отделка (вагонка/панели)", "Тёплый пол (опц.)", "Складная мебель", "Полки/стеллажи", "Жалюзи/римские шторы"], budget: "400 тыс. - 1.8 млн тг" },
];

export default function InteriorDesignPage() {
  // Ex 1: Дизайн-проект 90 м² × 3500 = 315 000
  const [a1, setA1] = useState("");
  const [s1, setS1] = useState(false);
  const [r1, setR1] = useState<null | boolean>(null);

  // Ex 2: Авторский надзор: 10% от (90 × 5000) = 10% × 450 000 = 45 000
  const [a2, setA2] = useState("");
  const [s2, setS2] = useState(false);
  const [r2, setR2] = useState<null | boolean>(null);

  // Ex 3: Премиум-отделка гостиной 25 м² ⇒ 4 500 000 тг (180 000 тг/м²)
  const [a3, setA3] = useState("");
  const [s3, setS3] = useState(false);
  const [r3, setR3] = useState<null | boolean>(null);

  // Ex 4: 25 000 тг/м² ⇒ премиум (c)
  const [a4, setA4] = useState<string | null>(null);
  const [s4, setS4] = useState(false);
  const [r4, setR4] = useState<null | boolean>(null);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-purple-400 hover:text-purple-300">
            &larr; К разделам
          </Link>
          <span className="text-xs text-slate-500">AEVION Smeta Trainer / Дизайн интерьера</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 space-y-10">
        {/* Title + intro */}
        <section>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
            🎨 Дизайн интерьера — расчёт стоимости
          </h1>
          <p className="mt-3 text-slate-400 max-w-3xl">
            Полный цикл услуги дизайнера интерьера: дизайн-проект &rarr; рабочая документация &rarr; спецификация
            мебели/материалов &rarr; закупка &rarr; авторский надзор. Стоимость самого дизайна (без отделочных
            работ и материалов) в РК — от <span className="text-purple-300 font-semibold">2 500 до 25 000 тг/м²</span>.
          </p>
          <div className="mt-4 grid md:grid-cols-3 gap-3">
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
              <div className="text-xs text-slate-500">Нормативы</div>
              <div className="text-sm text-slate-200 mt-1">СТ РК ИСО 13153 &mdash; эргономика помещений</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
              <div className="text-xs text-slate-500">СН РК</div>
              <div className="text-sm text-slate-200 mt-1">3.02-01 &mdash; жилые здания</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
              <div className="text-xs text-slate-500">Целевая аудитория</div>
              <div className="text-sm text-slate-200 mt-1">Частные клиенты, застройщики, отделочные бригады</div>
            </div>
          </div>
        </section>

        {/* Section 1: Этапы */}
        <section>
          <h2 className="text-2xl font-bold text-purple-300 mb-4">1. Этапы дизайн-проекта</h2>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-300">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">№</th>
                  <th className="text-left px-3 py-2 font-semibold">Этап</th>
                  <th className="text-left px-3 py-2 font-semibold">Содержание</th>
                  <th className="text-left px-3 py-2 font-semibold">Срок</th>
                  <th className="text-left px-3 py-2 font-semibold">Стоимость</th>
                </tr>
              </thead>
              <tbody>
                {STAGES.map((s) => (
                  <tr key={s.n} className="border-t border-slate-800 hover:bg-slate-900/40">
                    <td className="px-3 py-2 text-purple-400 font-mono">{s.n}</td>
                    <td className="px-3 py-2 text-slate-100 font-medium">{s.name}</td>
                    <td className="px-3 py-2 text-slate-400">{s.desc}</td>
                    <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{s.days}</td>
                    <td className="px-3 py-2 text-pink-300 whitespace-nowrap">{s.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Сумма по всем этапам формирует тариф 2 500&ndash;25 000 тг/м². Разброс зависит от класса
            интерьера, сложности перепланировки, количества помещений и опыта дизайнера.
          </p>
        </section>

        {/* Section 2: Категории и наценка */}
        <section>
          <h2 className="text-2xl font-bold text-purple-300 mb-4">2. Категории материалов и наценка дизайнера</h2>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-300">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Категория</th>
                  <th className="text-left px-3 py-2 font-semibold">Наценка</th>
                  <th className="text-left px-3 py-2 font-semibold">Что входит</th>
                  <th className="text-left px-3 py-2 font-semibold">Бюджет</th>
                </tr>
              </thead>
              <tbody>
                {TIERS.map((t) => (
                  <tr key={t.name} className="border-t border-slate-800 hover:bg-slate-900/40">
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-semibold bg-gradient-to-r ${t.color} text-white`}>
                        {t.name}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-pink-300 font-mono whitespace-nowrap">{t.margin}</td>
                    <td className="px-3 py-2 text-slate-400">{t.desc}</td>
                    <td className="px-3 py-2 text-slate-200 whitespace-nowrap">{t.budget}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Наценка дизайнера &mdash; это вознаграждение за подбор, заказ и логистику материалов. Часть
            дизайнеров берёт фиксированный гонорар без наценки, часть &mdash; работает только за %.
          </p>
        </section>

        {/* Section 3: Упражнения */}
        <section>
          <h2 className="text-2xl font-bold text-purple-300 mb-4">3. Упражнения</h2>

          {/* Ex 1 */}
          <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/30 p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-pink-300">Упражнение 1. Стоимость дизайн-проекта</h3>
              <span className="text-xs text-slate-500">numeric &plusmn;5%</span>
            </div>
            <p className="text-slate-300 text-sm mb-3">
              Рассчитайте стоимость дизайн-проекта квартиры площадью <b>90 м²</b> по эконом-тарифу
              <b> 3 500 тг/м²</b>. Результат укажите в тенге.
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="text"
                value={a1}
                onChange={(e) => setA1(e.target.value)}
                placeholder="Например: 315000"
                className="px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100 text-sm w-48 focus:border-purple-500 outline-none"
              />
              <span className="text-slate-400 text-sm">тг</span>
              <button
                onClick={() => setR1(checkNum(a1, 315000, 0.05))}
                className="px-3 py-2 rounded bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium"
              >
                Проверить
              </button>
              <button
                onClick={() => setS1(!s1)}
                className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm"
              >
                {s1 ? "Скрыть" : "Показать"} решение
              </button>
              {r1 !== null && (
                <span className={`text-sm font-semibold ${r1 ? "text-emerald-400" : "text-rose-400"}`}>
                  {r1 ? "Верно!" : "Неверно, попробуйте ещё"}
                </span>
              )}
            </div>
            {s1 && (
              <div className="mt-3 p-3 rounded bg-slate-950/60 border border-purple-900/40 text-sm text-slate-300">
                <div>S &times; тариф = 90 м² &times; 3 500 тг/м² = <b className="text-purple-300">315 000 тг</b></div>
                <div className="text-xs text-slate-500 mt-1">
                  Это нижний сегмент: студенту-дизайнеру или начинающему специалисту. Опытные берут 6 000&ndash;8 000 тг/м².
                </div>
              </div>
            )}
          </div>

          {/* Ex 2 */}
          <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/30 p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-pink-300">Упражнение 2. Авторский надзор</h3>
              <span className="text-xs text-slate-500">numeric &plusmn;10%</span>
            </div>
            <p className="text-slate-300 text-sm mb-3">
              Норма авторского надзора &mdash; <b>10% от стоимости дизайн-проекта</b>. Тариф дизайна
              <b> 5 000 тг/м²</b>, площадь <b>90 м²</b>, срок ремонта 6 месяцев. Какова стоимость
              авторского надзора (в тенге, на весь срок)?
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="text"
                value={a2}
                onChange={(e) => setA2(e.target.value)}
                placeholder="Например: 45000"
                className="px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100 text-sm w-48 focus:border-purple-500 outline-none"
              />
              <span className="text-slate-400 text-sm">тг</span>
              <button
                onClick={() => setR2(checkNum(a2, 45000, 0.10))}
                className="px-3 py-2 rounded bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium"
              >
                Проверить
              </button>
              <button
                onClick={() => setS2(!s2)}
                className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm"
              >
                {s2 ? "Скрыть" : "Показать"} решение
              </button>
              {r2 !== null && (
                <span className={`text-sm font-semibold ${r2 ? "text-emerald-400" : "text-rose-400"}`}>
                  {r2 ? "Верно!" : "Неверно, попробуйте ещё"}
                </span>
              )}
            </div>
            {s2 && (
              <div className="mt-3 p-3 rounded bg-slate-950/60 border border-purple-900/40 text-sm text-slate-300">
                <div>Стоимость дизайн-проекта = 90 &times; 5 000 = 450 000 тг</div>
                <div>Авторский надзор = 10% &times; 450 000 = <b className="text-purple-300">45 000 тг</b></div>
                <div className="text-xs text-slate-500 mt-1">
                  В реальности 45 000 тг на 6 месяцев &mdash; это символический гонорар. Поэтому большинство
                  дизайнеров считают надзор по часам/выездам: 5 000&ndash;15 000 тг/выезд + 2&ndash;4 выезда в месяц.
                </div>
              </div>
            )}
          </div>

          {/* Ex 3 */}
          <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/30 p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-pink-300">Упражнение 3. Бюджет премиум-гостиной</h3>
              <span className="text-xs text-slate-500">numeric &plusmn;20%</span>
            </div>
            <p className="text-slate-300 text-sm mb-3">
              Гостиная <b>25 м²</b>, премиум-класс. Бюджет на материалы и обстановку (без отделочных
              работ): плитка/паркет, обои, штукатурка, потолок, освещение, мебель, декор. Ориентир по
              таблице категорий: премиум &mdash; 120&ndash;300 тыс. тг/м². Возьмите среднее ~180 тыс. тг/м².
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="text"
                value={a3}
                onChange={(e) => setA3(e.target.value)}
                placeholder="Например: 4500000"
                className="px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100 text-sm w-48 focus:border-purple-500 outline-none"
              />
              <span className="text-slate-400 text-sm">тг</span>
              <button
                onClick={() => setR3(checkNum(a3, 4500000, 0.20))}
                className="px-3 py-2 rounded bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium"
              >
                Проверить
              </button>
              <button
                onClick={() => setS3(!s3)}
                className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm"
              >
                {s3 ? "Скрыть" : "Показать"} решение
              </button>
              {r3 !== null && (
                <span className={`text-sm font-semibold ${r3 ? "text-emerald-400" : "text-rose-400"}`}>
                  {r3 ? "Верно!" : "Неверно, попробуйте ещё"}
                </span>
              )}
            </div>
            {s3 && (
              <div className="mt-3 p-3 rounded bg-slate-950/60 border border-purple-900/40 text-sm text-slate-300">
                <div>S &times; средняя ставка премиум = 25 м² &times; 180 000 тг/м² = <b className="text-purple-300">4 500 000 тг</b></div>
                <div className="text-xs text-slate-500 mt-1">
                  Структура бюджета (примерно): чистовая отделка ~30%, мебель ~40%, освещение ~10%,
                  декор/текстиль ~10%, инженерия и электроника ~10%.
                </div>
              </div>
            )}
          </div>

          {/* Ex 4 */}
          <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/30 p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-pink-300">Упражнение 4. Категория клиента</h3>
              <span className="text-xs text-slate-500">multiple-choice</span>
            </div>
            <p className="text-slate-300 text-sm mb-3">
              Клиент готов платить <b>25 000 тг/м²</b> только за дизайн-проект (без материалов и работ).
              К какой категории он относится?
            </p>
            <div className="space-y-2">
              {[
                { id: "a", label: "Эконом-класс (отечественные материалы)" },
                { id: "b", label: "Средний класс (импорт массовый)" },
                { id: "c", label: "Премиум-класс (брендовые европейские)" },
                { id: "d", label: "Люкс-класс (эксклюзив, индивидуальный заказ)" },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition ${
                    a4 === opt.id
                      ? "border-purple-500 bg-purple-950/30"
                      : "border-slate-800 bg-slate-900/30 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex4"
                    value={opt.id}
                    checked={a4 === opt.id}
                    onChange={() => setA4(opt.id)}
                    className="mt-1 accent-purple-500"
                  />
                  <span className="text-sm text-slate-200">
                    <b className="text-purple-300 font-mono">{opt.id})</b> {opt.label}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 items-center mt-3">
              <button
                onClick={() => setR4(a4 === "c")}
                className="px-3 py-2 rounded bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium"
              >
                Проверить
              </button>
              <button
                onClick={() => setS4(!s4)}
                className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm"
              >
                {s4 ? "Скрыть" : "Показать"} решение
              </button>
              {r4 !== null && (
                <span className={`text-sm font-semibold ${r4 ? "text-emerald-400" : "text-rose-400"}`}>
                  {r4 ? "Верно!" : "Неверно, попробуйте ещё"}
                </span>
              )}
            </div>
            {s4 && (
              <div className="mt-3 p-3 rounded bg-slate-950/60 border border-purple-900/40 text-sm text-slate-300">
                <div>
                  Правильный ответ: <b className="text-purple-300">в) Премиум-класс</b>. Тариф 25 000 тг/м²
                  &mdash; верхняя граница рыночной ставки за дизайн (без материалов). Это уровень
                  опытных дизайнеров с портфолио, авторов публикаций и членов Союза дизайнеров РК.
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Люкс-клиент чаще платит фиксированный гонорар за проект (10&ndash;30 млн тг за квартиру 200 м²),
                  а не &laquo;за квадрат&raquo;.
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Section 4: Спецификация мебели */}
        <section>
          <h2 className="text-2xl font-bold text-purple-300 mb-4">4. Спецификация мебели и оборудования по помещениям</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {FURNITURE.map((f) => (
              <div key={f.room} className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-pink-300">{f.room}</h3>
                  <span className="text-xs text-purple-300 font-mono">{f.budget}</span>
                </div>
                <ul className="text-sm text-slate-300 space-y-1">
                  {f.items.map((it, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-purple-500 mt-0.5">&bull;</span>
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Спецификация мебели &mdash; это итоговая ведомость с артикулами, размерами, поставщиками и ценами.
            Дизайнер составляет её для согласования бюджета и для бригады закупки.
          </p>
        </section>

        {/* Расценки */}
        <section>
          <h2 className="text-2xl font-bold text-purple-300 mb-4">5. Расценки на услуги дизайнера в РК (2026)</h2>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-300">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Услуга</th>
                  <th className="text-left px-3 py-2 font-semibold">Эконом</th>
                  <th className="text-left px-3 py-2 font-semibold">Средний</th>
                  <th className="text-left px-3 py-2 font-semibold">Премиум / Люкс</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                <tr className="border-t border-slate-800">
                  <td className="px-3 py-2 font-medium">Полный дизайн-проект, тг/м²</td>
                  <td className="px-3 py-2">2 500 &ndash; 5 000</td>
                  <td className="px-3 py-2">5 000 &ndash; 10 000</td>
                  <td className="px-3 py-2">10 000 &ndash; 25 000</td>
                </tr>
                <tr className="border-t border-slate-800">
                  <td className="px-3 py-2 font-medium">Только концепция, тг/м²</td>
                  <td className="px-3 py-2">800 &ndash; 1 500</td>
                  <td className="px-3 py-2">1 500 &ndash; 3 000</td>
                  <td className="px-3 py-2">3 000 &ndash; 7 000</td>
                </tr>
                <tr className="border-t border-slate-800">
                  <td className="px-3 py-2 font-medium">3D-визуализация, тг/ракурс</td>
                  <td className="px-3 py-2">15 000 &ndash; 25 000</td>
                  <td className="px-3 py-2">25 000 &ndash; 50 000</td>
                  <td className="px-3 py-2">50 000 &ndash; 150 000</td>
                </tr>
                <tr className="border-t border-slate-800">
                  <td className="px-3 py-2 font-medium">Авторский надзор, тг/выезд</td>
                  <td className="px-3 py-2">5 000 &ndash; 10 000</td>
                  <td className="px-3 py-2">10 000 &ndash; 25 000</td>
                  <td className="px-3 py-2">25 000 &ndash; 75 000</td>
                </tr>
                <tr className="border-t border-slate-800">
                  <td className="px-3 py-2 font-medium">Перепланировка с согласованием</td>
                  <td className="px-3 py-2">от 150 000 тг</td>
                  <td className="px-3 py-2">от 300 000 тг</td>
                  <td className="px-3 py-2">от 800 000 тг</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Purple factoid */}
        <section className="rounded-xl border border-purple-800/40 bg-gradient-to-br from-purple-950/40 to-fuchsia-950/30 p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h3 className="text-lg font-semibold text-purple-200 mb-2">
                Лицензирование дизайнера-архитектора в РК
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                По Закону РК &laquo;Об архитектурной, градостроительной и строительной деятельности&raquo;
                (от 16.07.2001 № 242-II) <b>дизайн интерьера НЕ относится к лицензируемым видам</b> &mdash; в
                отличие от архитектурного проектирования. Дизайнер может работать как ИП на упрощёнке (3% ОПР)
                без специальных разрешений.
              </p>
              <p className="text-sm text-slate-300 leading-relaxed mt-2">
                Однако, если проект включает <b>перепланировку с переносом мокрых зон, демонтаж несущих
                конструкций, изменение фасада или инженерных систем</b> &mdash; нужен архитектор с лицензией I или
                II категории (для согласования в акимате через ЦОН и ГАСК). Такие работы оформляются
                отдельным договором с лицензированным проектировщиком.
              </p>
              <p className="text-xs text-purple-300/80 mt-3">
                Союз дизайнеров Казахстана (СДК) &mdash; добровольное объединение, членство даёт статус, но не
                является обязательным для практики.
              </p>
            </div>
          </div>
        </section>

        <div className="pt-6 border-t border-slate-800 text-center text-xs text-slate-600">
          AEVION Smeta Trainer &middot; Модуль &laquo;Дизайн интерьера&raquo; &middot; Учебные материалы по нормам РК
        </div>
      </main>
    </div>
  );
}
