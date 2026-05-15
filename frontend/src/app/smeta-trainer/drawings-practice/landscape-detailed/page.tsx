"use client";

import Link from "next/link";
import { useState } from "react";

export default function LandscapeDetailedPage() {
  // Упражнение 1: Норма посадки газона
  const [lawnAnswer, setLawnAnswer] = useState("");
  const [lawnResult, setLawnResult] = useState<null | boolean>(null);
  const [lawnShow, setLawnShow] = useState(false);
  const lawnCorrect = 20; // кг
  const checkLawn = () => {
    const v = parseFloat(lawnAnswer.replace(",", "."));
    if (Number.isNaN(v)) {
      setLawnResult(false);
      return;
    }
    const tol = lawnCorrect * 0.15;
    setLawnResult(Math.abs(v - lawnCorrect) <= tol);
  };

  // Упражнение 2: Подбор контроллера ирригации
  const [ctrlAnswer, setCtrlAnswer] = useState<string | null>(null);
  const [ctrlShow, setCtrlShow] = useState(false);
  const ctrlCorrect = "d";

  // Упражнение 3: Количество дождевателей
  const [sprAnswer, setSprAnswer] = useState("");
  const [sprResult, setSprResult] = useState<null | boolean>(null);
  const [sprShow, setSprShow] = useState(false);
  const sprCorrect = 12;
  const checkSpr = () => {
    const v = parseFloat(sprAnswer.replace(",", "."));
    if (Number.isNaN(v)) {
      setSprResult(false);
      return;
    }
    const tol = sprCorrect * 0.25;
    setSprResult(Math.abs(v - sprCorrect) <= tol);
  };

  // Упражнение 4: Стоимость ландшафтного оформления
  const [costAnswer, setCostAnswer] = useState("");
  const [costResult, setCostResult] = useState<null | boolean>(null);
  const [costShow, setCostShow] = useState(false);
  const costCorrect = 4_500_000;
  const checkCost = () => {
    const v = parseFloat(costAnswer.replace(/\s/g, "").replace(",", "."));
    if (Number.isNaN(v)) {
      setCostResult(false);
      return;
    }
    const tol = costCorrect * 0.15;
    setCostResult(Math.abs(v - costCorrect) <= tol);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-10">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/smeta-trainer/drawings-practice"
            className="text-emerald-400 hover:text-emerald-300 text-sm mb-4 inline-block"
          >
            ← К разделам
          </Link>
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
            🌳 Ландшафтный дизайн — растения, ирригация, освещение
          </h1>
          <p className="text-slate-400 text-lg">
            Подробный курс: подбор растений по климату РК, проектирование автополива
            Hunter/Rain Bird, LED-освещение участков, сметные расценки на озеленение и
            благоустройство.
          </p>
        </div>

        {/* Intro */}
        <div className="bg-slate-900/60 border border-green-800/40 rounded-xl p-6 mb-10">
          <h2 className="text-xl font-semibold text-green-300 mb-3">
            📘 О чём этот модуль
          </h2>
          <p className="text-slate-300 mb-3 leading-relaxed">
            Ландшафтный дизайн — это комплекс работ по преобразованию участка: от
            подготовки почвы и посева газона до установки автоматической ирригации и
            архитектурной подсветки. Сметчик должен знать нормы посадки, расход семян,
            расстояния между растениями и расценки на озеленение и благоустройство.
          </p>
          <ul className="text-sm text-slate-400 space-y-1 list-disc pl-5">
            <li>
              <span className="text-green-400 font-semibold">СН РК 3.07-01</span> —
              благоустройство и озеленение населённых пунктов
            </li>
            <li>
              <span className="text-green-400 font-semibold">ГОСТ 17.5.3.05</span> —
              рекультивация земель, общие требования к землеванию
            </li>
            <li>
              <span className="text-green-400 font-semibold">СНиП РК 3.07-01</span> —
              инженерная подготовка территории
            </li>
            <li>
              <span className="text-green-400 font-semibold">СТ РК 1383</span> —
              посадочный материал декоративных пород деревьев и кустарников
            </li>
          </ul>
          <div className="mt-4 p-3 bg-emerald-950/40 border border-emerald-700/40 rounded-lg">
            <p className="text-emerald-200 text-sm">
              💰 <span className="font-semibold">Стоимость:</span> от{" "}
              <span className="text-emerald-300 font-bold">4 500</span> до{" "}
              <span className="text-emerald-300 font-bold">25 000 тг/м²</span> участка —
              в зависимости от сложности, доли газона, количества деревьев и наличия
              ирригации/освещения.
            </p>
          </div>
        </div>

        {/* Section 1: Растения */}
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-green-300 mb-4">
            🌱 1. Шесть групп растений для ландшафта
          </h2>
          <div className="overflow-x-auto bg-slate-900/60 border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800/60 text-emerald-300 text-left">
                  <th className="px-4 py-3 font-semibold">Группа</th>
                  <th className="px-4 py-3 font-semibold">Виды / сорта</th>
                  <th className="px-4 py-3 font-semibold">Норма / шаг</th>
                  <th className="px-4 py-3 font-semibold">Цена</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                <tr className="border-t border-slate-800">
                  <td className="px-4 py-3 font-semibold text-green-200">
                    Газонная трава
                  </td>
                  <td className="px-4 py-3">
                    Мятлик луговой, полевица побегообразующая, овсяница красная (смеси)
                  </td>
                  <td className="px-4 py-3">25 г семян/м² (партерный — 35 г/м²)</td>
                  <td className="px-4 py-3 text-emerald-300">450-900 тг/м²</td>
                </tr>
                <tr className="border-t border-slate-800 bg-slate-900/40">
                  <td className="px-4 py-3 font-semibold text-green-200">
                    Деревья (8 видов)
                  </td>
                  <td className="px-4 py-3">
                    Берёза повислая, ель колючая голубая, сосна обыкновенная, каштан
                    конский, дуб черешчатый, клён остролистный, рябина, липа
                  </td>
                  <td className="px-4 py-3">шаг 4-6 м, ком 0,8×0,8 м</td>
                  <td className="px-4 py-3 text-emerald-300">
                    25 000-180 000 тг/шт
                  </td>
                </tr>
                <tr className="border-t border-slate-800">
                  <td className="px-4 py-3 font-semibold text-green-200">
                    Декоративные кустарники
                  </td>
                  <td className="px-4 py-3">
                    Можжевельник казацкий, гортензия метельчатая, самшит, спирея, барбарис
                    Тунберга
                  </td>
                  <td className="px-4 py-3">шаг 0,5-1,5 м, контейнер C5-C15</td>
                  <td className="px-4 py-3 text-emerald-300">
                    3 500-18 000 тг/шт
                  </td>
                </tr>
                <tr className="border-t border-slate-800 bg-slate-900/40">
                  <td className="px-4 py-3 font-semibold text-green-200">
                    Многолетники
                  </td>
                  <td className="px-4 py-3">
                    Ирис сибирский, хоста, лилейник, флокс метельчатый, эхинацея
                  </td>
                  <td className="px-4 py-3">9-12 шт/м² в группе</td>
                  <td className="px-4 py-3 text-emerald-300">
                    800-2 500 тг/шт
                  </td>
                </tr>
                <tr className="border-t border-slate-800">
                  <td className="px-4 py-3 font-semibold text-green-200">
                    Цветы однолетние
                  </td>
                  <td className="px-4 py-3">
                    Петунии каскадные, виолы, бегонии, бархатцы, львиный зев
                  </td>
                  <td className="px-4 py-3">25-36 шт/м² клумбы</td>
                  <td className="px-4 py-3 text-emerald-300">
                    250-700 тг/шт
                  </td>
                </tr>
                <tr className="border-t border-slate-800 bg-slate-900/40">
                  <td className="px-4 py-3 font-semibold text-green-200">
                    Топиарные формы
                  </td>
                  <td className="px-4 py-3">
                    Самшит-шар/куб, туя-спираль, ель-бонсай, тис стриженый — с готовой
                    кроной
                  </td>
                  <td className="px-4 py-3">соло-акценты, шаг 2-3 м</td>
                  <td className="px-4 py-3 text-emerald-300">
                    35 000-250 000 тг/шт
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            ⚠️ Для климата РК (зона USDA 4-5) выбирают морозостойкие сорта: ель колючая,
            сосна крымская, берёза, можжевельник казацкий, барбарис, гортензия метельчатая.
          </p>
        </div>

        {/* Section 2: Ирригация и освещение */}
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-green-300 mb-4">
            💧 2. Ирригация и освещение участка
          </h2>
          <div className="overflow-x-auto bg-slate-900/60 border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800/60 text-emerald-300 text-left">
                  <th className="px-4 py-3 font-semibold">Система</th>
                  <th className="px-4 py-3 font-semibold">Описание / оборудование</th>
                  <th className="px-4 py-3 font-semibold">Расход</th>
                  <th className="px-4 py-3 font-semibold">Цена</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                <tr className="border-t border-slate-800">
                  <td className="px-4 py-3 font-semibold text-emerald-200">
                    Автополив газонов
                  </td>
                  <td className="px-4 py-3">
                    Hunter PGP/I-25, Rain Bird 5004, контроллер X-Core 4/8/16, датчик
                    дождя
                  </td>
                  <td className="px-4 py-3">1 ротор на 50-65 м²</td>
                  <td className="px-4 py-3 text-emerald-300">
                    1 500-2 800 тг/м²
                  </td>
                </tr>
                <tr className="border-t border-slate-800 bg-slate-900/40">
                  <td className="px-4 py-3 font-semibold text-emerald-200">
                    Капельный полив клумб
                  </td>
                  <td className="px-4 py-3">
                    Лента Toro Drip, эмиттеры 2-4 л/ч, фильтр-регулятор давления
                  </td>
                  <td className="px-4 py-3">шаг капельниц 30 см</td>
                  <td className="px-4 py-3 text-emerald-300">
                    600-1 200 тг/п.м
                  </td>
                </tr>
                <tr className="border-t border-slate-800">
                  <td className="px-4 py-3 font-semibold text-emerald-200">
                    Прудовое оборудование
                  </td>
                  <td className="px-4 py-3">
                    Насос Oase Aquamax, фильтр BioSmart, УФ-стерилизатор, скиммер,
                    плёнка EPDM
                  </td>
                  <td className="px-4 py-3">оборот воды 1 раз/2 ч</td>
                  <td className="px-4 py-3 text-emerald-300">
                    180 000-950 000 тг
                  </td>
                </tr>
                <tr className="border-t border-slate-800 bg-slate-900/40">
                  <td className="px-4 py-3 font-semibold text-emerald-200">
                    LED-освещение дорожек
                  </td>
                  <td className="px-4 py-3">
                    Грунтовые споты IP67, линейная LED-лента в профиле, столбики 0,4-0,8
                    м
                  </td>
                  <td className="px-4 py-3">шаг 1,5-2,5 м</td>
                  <td className="px-4 py-3 text-emerald-300">
                    8 500-25 000 тг/шт
                  </td>
                </tr>
                <tr className="border-t border-slate-800">
                  <td className="px-4 py-3 font-semibold text-emerald-200">
                    Уличные опоры с автоматикой
                  </td>
                  <td className="px-4 py-3">
                    Парковые опоры 3-4 м, светильники LED 30-60 Вт, таймер/датчик
                    сумерек, кабель ВВГнг
                  </td>
                  <td className="px-4 py-3">шаг 12-18 м</td>
                  <td className="px-4 py-3 text-emerald-300">
                    65 000-180 000 тг/шт
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            ⚙️ Контроллеры ирригации подбирают по числу зон полива с запасом +30%:
            X-Core 4 → до 4 зон, X-Core 8 → до 8 зон, X-Core 16 → до 16 зон.
          </p>
        </div>

        {/* Section 3: Упражнения */}
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-green-300 mb-6">
            🎯 3. Интерактивные упражнения
          </h2>

          {/* Упражнение 1 */}
          <div className="bg-slate-900/60 border border-green-800/40 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-emerald-200 mb-2">
              Упражнение 1 — Норма посадки газона
            </h3>
            <p className="text-slate-300 mb-3">
              Рассчитайте, сколько килограммов семян мятлика лугового нужно для посева
              газона на участке <span className="text-green-300 font-semibold">800 м²</span>.
              Норма расхода — <span className="text-green-300">25 г семян/м²</span>.
              Ответ дайте в килограммах.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={lawnAnswer}
                onChange={(e) => setLawnAnswer(e.target.value)}
                placeholder="кг"
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 w-32 focus:border-emerald-500 focus:outline-none"
              />
              <button
                onClick={checkLawn}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-semibold"
              >
                Проверить
              </button>
              <button
                onClick={() => setLawnShow(!lawnShow)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-100"
              >
                {lawnShow ? "Скрыть" : "Показать"} решение
              </button>
            </div>
            {lawnResult !== null && (
              <p
                className={`mt-3 font-semibold ${
                  lawnResult ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {lawnResult
                  ? "✅ Верно! (допуск ±15%)"
                  : "❌ Неверно. Попробуйте ещё или посмотрите решение."}
              </p>
            )}
            {lawnShow && (
              <div className="mt-4 p-4 bg-emerald-950/40 border border-emerald-700/40 rounded-lg text-sm text-emerald-100">
                <p className="font-semibold mb-1">Решение:</p>
                <p>800 м² × 25 г/м² = 20 000 г = <b>20 кг</b> семян.</p>
                <p className="text-emerald-300 mt-1">
                  Для партерного газона потребовалось бы 800 × 35 = 28 кг.
                </p>
              </div>
            )}
          </div>

          {/* Упражнение 2 */}
          <div className="bg-slate-900/60 border border-green-800/40 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-emerald-200 mb-2">
              Упражнение 2 — Подбор контроллера ирригации
            </h3>
            <p className="text-slate-300 mb-3">
              Участок разделён на <span className="text-green-300 font-semibold">12 зон полива</span>.
              Какой контроллер Hunter X-Core следует выбрать с учётом запаса на расширение?
            </p>
            <div className="space-y-2">
              {[
                { id: "a", text: "Hunter X-Core 4 (до 4 зон)" },
                { id: "b", text: "Hunter X-Core 8 (до 8 зон)" },
                { id: "c", text: "Hunter X-Core 12 (ровно 12 зон)" },
                { id: "d", text: "Hunter X-Core 16 (до 16 зон, с запасом)" },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    ctrlAnswer === opt.id
                      ? "border-emerald-500 bg-emerald-950/30"
                      : "border-slate-700 bg-slate-800/40 hover:border-slate-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="ctrl"
                    checked={ctrlAnswer === opt.id}
                    onChange={() => setCtrlAnswer(opt.id)}
                    className="accent-emerald-500"
                  />
                  <span className="text-slate-200">{opt.text}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-4">
              <button
                onClick={() => setCtrlShow(!ctrlShow)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-100"
              >
                {ctrlShow ? "Скрыть" : "Показать"} решение
              </button>
              {ctrlAnswer && (
                <span
                  className={`font-semibold ${
                    ctrlAnswer === ctrlCorrect ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {ctrlAnswer === ctrlCorrect ? "✅ Верно!" : "❌ Неверно"}
                </span>
              )}
            </div>
            {ctrlShow && (
              <div className="mt-4 p-4 bg-emerald-950/40 border border-emerald-700/40 rounded-lg text-sm text-emerald-100">
                <p className="font-semibold mb-1">Правильный ответ: d) X-Core 16</p>
                <p>
                  Контроллер всегда подбирают с запасом +25-30% к числу зон. На 12 зон
                  лучше брать модель на 16 — это позволит позже добавить капельный
                  полив клумб или дополнительные секции газона без замены контроллера.
                </p>
              </div>
            )}
          </div>

          {/* Упражнение 3 */}
          <div className="bg-slate-900/60 border border-green-800/40 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-emerald-200 mb-2">
              Упражнение 3 — Количество роторных дождевателей
            </h3>
            <p className="text-slate-300 mb-3">
              Сколько роторных дождевателей Hunter PGP нужно для полива газона{" "}
              <span className="text-green-300 font-semibold">800 м²</span> при радиусе
              струи <span className="text-green-300">8 м</span> и перекрытии секторов{" "}
              <span className="text-green-300">30%</span>?
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={sprAnswer}
                onChange={(e) => setSprAnswer(e.target.value)}
                placeholder="штук"
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 w-32 focus:border-emerald-500 focus:outline-none"
              />
              <button
                onClick={checkSpr}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-semibold"
              >
                Проверить
              </button>
              <button
                onClick={() => setSprShow(!sprShow)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-100"
              >
                {sprShow ? "Скрыть" : "Показать"} решение
              </button>
            </div>
            {sprResult !== null && (
              <p
                className={`mt-3 font-semibold ${
                  sprResult ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {sprResult
                  ? "✅ Верно! (допуск ±25%)"
                  : "❌ Неверно. Попробуйте пересчитать."}
              </p>
            )}
            {sprShow && (
              <div className="mt-4 p-4 bg-emerald-950/40 border border-emerald-700/40 rounded-lg text-sm text-emerald-100">
                <p className="font-semibold mb-1">Решение:</p>
                <p>
                  Площадь полного круга 1 ротора: π × R² = 3,14 × 64 ≈ 201 м². При
                  квадратной схеме с перекрытием 30% эффективная площадь одного
                  ротора ≈ R² × 1,1 = 64 × 1,1 ≈ 70 м² (или ≈ R² для треугольной).
                </p>
                <p className="mt-1">800 м² ÷ 70 м² ≈ <b>12 штук</b>.</p>
                <p className="text-emerald-300 mt-1">
                  Реальный шаг сетки: 8 × 0,7 ≈ 5,6 м между роторами.
                </p>
              </div>
            )}
          </div>

          {/* Упражнение 4 */}
          <div className="bg-slate-900/60 border border-green-800/40 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-emerald-200 mb-2">
              Упражнение 4 — Стоимость ландшафтного оформления
            </h3>
            <p className="text-slate-300 mb-3">
              Рассчитайте полную стоимость ландшафтного оформления участка{" "}
              <span className="text-green-300 font-semibold">1000 м²</span>:
            </p>
            <ul className="text-sm text-slate-400 list-disc pl-5 mb-3 space-y-1">
              <li>Газон 600 м² × 700 тг/м² = 420 000 тг</li>
              <li>8 деревьев × 70 000 тг/шт = 560 000 тг</li>
              <li>30 кустарников × 8 000 тг/шт = 240 000 тг</li>
              <li>Автоматическая ирригация 600 м² × 2 200 тг/м² = 1 320 000 тг</li>
              <li>LED-освещение (12 светильников + опоры + кабель) ≈ 1 100 000 тг</li>
              <li>Подготовка почвы, плодородный грунт, мульча ≈ 480 000 тг</li>
              <li>Монтаж/работа озеленителей ≈ 380 000 тг</li>
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={costAnswer}
                onChange={(e) => setCostAnswer(e.target.value)}
                placeholder="тенге"
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 w-44 focus:border-emerald-500 focus:outline-none"
              />
              <button
                onClick={checkCost}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-semibold"
              >
                Проверить
              </button>
              <button
                onClick={() => setCostShow(!costShow)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-100"
              >
                {costShow ? "Скрыть" : "Показать"} решение
              </button>
            </div>
            {costResult !== null && (
              <p
                className={`mt-3 font-semibold ${
                  costResult ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {costResult
                  ? "✅ Верно! (допуск ±15%)"
                  : "❌ Неверно. Сложите все статьи ещё раз."}
              </p>
            )}
            {costShow && (
              <div className="mt-4 p-4 bg-emerald-950/40 border border-emerald-700/40 rounded-lg text-sm text-emerald-100">
                <p className="font-semibold mb-1">Решение:</p>
                <p>
                  420 000 + 560 000 + 240 000 + 1 320 000 + 1 100 000 + 480 000 + 380 000
                  = <b>4 500 000 тг</b>.
                </p>
                <p className="text-emerald-300 mt-1">
                  Удельная стоимость: 4 500 тг/м² участка — нижняя граница диапазона.
                  Если добавить пруд и топиарные формы — выйдет 12-18 тыс. тг/м².
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Section 4: Сезонные работы */}
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-green-300 mb-4">
            🍂 4. Сезонные работы — годовой цикл
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-slate-900/60 border border-emerald-800/40 rounded-xl p-5">
              <h3 className="text-emerald-300 font-semibold mb-2">
                🌷 Весна (март-май)
              </h3>
              <ul className="text-sm text-slate-300 list-disc pl-5 space-y-1">
                <li>Снятие зимних укрытий с роз и хвойных</li>
                <li>Аэрация и скарификация газона, подкормка азотом</li>
                <li>Посадка деревьев и кустарников с открытой корневой системой</li>
                <li>Запуск и тестирование ирригации</li>
              </ul>
            </div>
            <div className="bg-slate-900/60 border border-emerald-800/40 rounded-xl p-5">
              <h3 className="text-emerald-300 font-semibold mb-2">
                ☀️ Лето (июнь-август)
              </h3>
              <ul className="text-sm text-slate-300 list-disc pl-5 space-y-1">
                <li>Стрижка газона 1 раз/нед., высота 4-6 см</li>
                <li>Полив 25-35 л/м² за 2-3 раза в неделю</li>
                <li>Стрижка топиарных форм и живых изгородей</li>
                <li>Обработка от вредителей и борьба с сорняками</li>
              </ul>
            </div>
            <div className="bg-slate-900/60 border border-emerald-800/40 rounded-xl p-5">
              <h3 className="text-emerald-300 font-semibold mb-2">
                🍁 Осень (сентябрь-октябрь)
              </h3>
              <ul className="text-sm text-slate-300 list-disc pl-5 space-y-1">
                <li>Посадка деревьев с комом и контейнерных растений</li>
                <li>Подкормка газона калийно-фосфорными удобрениями</li>
                <li>Уборка листвы, мульчирование приствольных кругов</li>
                <li>Посев газона (до середины сентября)</li>
              </ul>
            </div>
            <div className="bg-slate-900/60 border border-emerald-800/40 rounded-xl p-5">
              <h3 className="text-emerald-300 font-semibold mb-2">
                ❄️ Зима (ноябрь-февраль)
              </h3>
              <ul className="text-sm text-slate-300 list-disc pl-5 space-y-1">
                <li>Консервация ирригации (продувка компрессором)</li>
                <li>Укрытие роз, рододендронов, молодых хвойных</li>
                <li>Стряхивание снега с веток, защита от грызунов</li>
                <li>Планирование посадок и закупки на следующий сезон</li>
              </ul>
            </div>
            <div className="bg-slate-900/60 border border-emerald-800/40 rounded-xl p-5 md:col-span-2">
              <h3 className="text-emerald-300 font-semibold mb-2">
                🔁 Постоянно — мониторинг и сервис
              </h3>
              <ul className="text-sm text-slate-300 list-disc pl-5 space-y-1">
                <li>Контроль работы контроллера ирригации и датчика дождя</li>
                <li>Проверка LED-освещения, замена ламп и датчиков сумерек</li>
                <li>
                  Ведение журнала ухода за участком — основа для актирования работ
                  Заказчику
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Section 5: Расценки + factoid */}
        <div className="mb-10 grid md:grid-cols-2 gap-6">
          <div className="bg-slate-900/60 border border-green-800/40 rounded-xl p-6">
            <h2 className="text-xl font-bold text-green-300 mb-3">
              📋 Сметные расценки ЭСН
            </h2>
            <ul className="text-sm text-slate-300 space-y-2">
              <li>
                <span className="text-emerald-300 font-semibold">Сб.47</span> —
                Благоустройство (планировка, дорожки, покрытия, малые архитектурные
                формы)
              </li>
              <li>
                <span className="text-emerald-300 font-semibold">Сб.27</span> —
                Озеленение (посадка деревьев, кустарников, посев газона, цветочное
                оформление)
              </li>
              <li>
                <span className="text-emerald-300 font-semibold">Сб.16</span> —
                Трубопроводы (для прокладки магистралей ирригации)
              </li>
              <li>
                <span className="text-emerald-300 font-semibold">Сб.8 / Сб.20</span> —
                Электромонтажные работы для уличного освещения
              </li>
              <li>
                <span className="text-emerald-300 font-semibold">Сб.1</span> — Земляные
                работы под траншеи ирригации и кабельные линии (глубина 0,4-0,7 м)
              </li>
            </ul>
          </div>
          <div className="bg-emerald-950/40 border border-emerald-700/40 rounded-xl p-6">
            <h2 className="text-xl font-bold text-emerald-300 mb-3">
              🌿 Зелёный факт
            </h2>
            <p className="text-emerald-100 text-sm leading-relaxed">
              По <span className="font-semibold">СТ РК 1383-2005</span> весь посадочный
              материал декоративных пород деревьев и кустарников должен иметь сертификат
              соответствия с указанием породы, возраста, размера кома и категории
              качества (I-III). Без сертификата сметчик не имеет права проводить
              расценку посадки в актах КС-2 — Заказчик и технадзор обязаны вернуть акт
              на доработку. Поэтому в смету закладывают{" "}
              <span className="font-semibold">+5-8% к стоимости саженцев</span> на
              сертификацию и фитосанитарный контроль карантинной службы.
            </p>
          </div>
        </div>

        {/* Footer nav */}
        <div className="mt-12 pt-6 border-t border-slate-800 flex justify-between text-sm">
          <Link
            href="/smeta-trainer/drawings-practice"
            className="text-emerald-400 hover:text-emerald-300"
          >
            ← Все модули практики
          </Link>
          <Link
            href="/smeta-trainer/drawings-practice/asphalt-detailed"
            className="text-emerald-400 hover:text-emerald-300"
          >
            Асфальт детально →
          </Link>
        </div>
      </div>
    </div>
  );
}
