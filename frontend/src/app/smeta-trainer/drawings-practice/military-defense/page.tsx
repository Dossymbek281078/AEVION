"use client";

import Link from "next/link";
import { useState } from "react";

type Result = { ok: boolean; msg: string } | null;

export default function MilitaryDefensePage() {
  const [a1, setA1] = useState<string>("");
  const [r1, setR1] = useState<Result>(null);
  const [s1, setS1] = useState(false);

  const [a2, setA2] = useState<string>("");
  const [r2, setR2] = useState<Result>(null);
  const [s2, setS2] = useState(false);

  const [a3, setA3] = useState<string>("");
  const [r3, setR3] = useState<Result>(null);
  const [s3, setS3] = useState(false);

  const [a4, setA4] = useState<string>("");
  const [r4, setR4] = useState<Result>(null);
  const [s4, setS4] = useState(false);

  const checkChoice = (
    val: string,
    correct: string,
    okMsg: string,
    failMsg: string
  ): Result => {
    if (!val) return { ok: false, msg: "Выберите вариант ответа." };
    return val === correct
      ? { ok: true, msg: okMsg }
      : { ok: false, msg: failMsg };
  };

  const checkNumeric = (
    val: string,
    target: number,
    tol: number,
    unit: string
  ): Result => {
    const n = parseFloat(val.replace(",", "."));
    if (isNaN(n)) return { ok: false, msg: "Введите число." };
    const diff = Math.abs(n - target) / target;
    return diff <= tol / target
      ? {
          ok: true,
          msg: `Верно (±${tol} ${unit}): эталон ${target} ${unit}.`,
        }
      : {
          ok: false,
          msg: `Неверно. Эталон ${target} ${unit} (допуск ±${tol} ${unit}).`,
        };
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-stone-800/60 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-stone-300 hover:text-amber-300 transition-colors text-sm"
          >
            ← К разделам
          </Link>
          <span className="text-xs text-stone-500 uppercase tracking-wider">
            AEVION Smeta Trainer · Спецобъекты
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-stone-200 mb-3">
            🪖 Военные и оборонные объекты
          </h1>
          <p className="text-stone-300 leading-relaxed">
            Строительство военных объектов в Республике Казахстан — особая сфера сметного дела.
            Она требует специального допуска персонала, применения закрытых нормативных сборников
            и строгого соблюдения режима секретности документооборота.
          </p>
        </section>

        {/* Section 1 */}
        <section className="rounded-2xl bg-stone-900/40 border border-stone-800 p-6">
          <h2 className="text-xl font-semibold text-stone-300 mb-4">
            1. Особенности военного строительства
          </h2>
          <ul className="text-sm text-stone-300 space-y-3 leading-relaxed">
            <li className="flex gap-2">
              <span className="text-amber-400 mt-0.5">▸</span>
              <span>
                <span className="text-stone-200 font-semibold">Режим секретности и допуск персонала:</span>{" "}
                все участники строительства — проектировщики, сметчики, подрядчики — обязаны иметь
                допуск к государственной тайне (форма №1 или №2). Документация оформляется
                под грифом «ДСП» или «Секретно».
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-400 mt-0.5">▸</span>
              <span>
                <span className="text-stone-200 font-semibold">Специальные нормы МО РК:</span>{" "}
                применяются закрытые сборники ЭСН Министерства обороны, недоступные в открытой базе
                ИСТ Эталон. Индексы пересчёта также ведутся отдельно через структуры МО.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-400 mt-0.5">▸</span>
              <span>
                <span className="text-stone-200 font-semibold">Усиленные конструкции:</span>{" "}
                большинство несущих конструкций проектируется с повышенными коэффициентами надёжности.
                Монолитный железобетон применяется значительно чаще, чем в гражданском строительстве.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-400 mt-0.5">▸</span>
              <span>
                <span className="text-stone-200 font-semibold">Антиядерная защита для командных пунктов:</span>{" "}
                КП оборудуются многослойной защитой от ударной волны, электромагнитного импульса (ЭМИ)
                и радиационного поражения. Толщина стен — от 1 до 2 м монолитного ж/б.
              </span>
            </li>
          </ul>
        </section>

        {/* Section 2 */}
        <section className="rounded-2xl bg-stone-900/40 border border-stone-800 p-6">
          <h2 className="text-xl font-semibold text-stone-300 mb-4">
            2. Типы военных объектов
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-stone-400 border-b border-stone-700">
                  <th className="text-left py-2 px-3">Тип объекта</th>
                  <th className="text-left py-2 px-3">Назначение</th>
                  <th className="text-left py-2 px-3">Особые требования</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800">
                <tr>
                  <td className="py-2 px-3 text-stone-200">Казарма</td>
                  <td className="py-2 px-3 text-stone-400">Постоянное/временное размещение личного состава</td>
                  <td className="py-2 px-3 text-stone-300">Норма 6–12 м²/чел, отдельные санузлы, кубрики</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-stone-200">Технические склады и парки техники</td>
                  <td className="py-2 px-3 text-stone-400">Хранение вооружения, боеприпасов, бронетехники</td>
                  <td className="py-2 px-3 text-stone-300">Огнестойкость, охранный периметр, молниезащита</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-stone-200">Командные пункты (КП)</td>
                  <td className="py-2 px-3 text-stone-400">Оперативное управление войсками</td>
                  <td className="py-2 px-3 text-stone-300">Заглубление, монолит 1–2 м, клетка Фарадея</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-stone-200">Взлётно-посадочные полосы (ВПП)</td>
                  <td className="py-2 px-3 text-stone-400">Аэродромы военной авиации</td>
                  <td className="py-2 px-3 text-stone-300">Усиленный аэродромный бетон, спец. маркировка</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-stone-200">Укреплённые позиции артиллерии</td>
                  <td className="py-2 px-3 text-stone-400">Огневые позиции, капониры, укрытия</td>
                  <td className="py-2 px-3 text-stone-300">Защита от прямого попадания снаряда</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-stone-200">Медицинские пункты</td>
                  <td className="py-2 px-3 text-stone-400">Полевые и стационарные МП воинских частей</td>
                  <td className="py-2 px-3 text-stone-300">Нормы МО + СанПиН, автономное энергоснабжение</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3 */}
        <section className="rounded-2xl bg-stone-900/40 border border-stone-800 p-6">
          <h2 className="text-xl font-semibold text-stone-300 mb-4">
            3. Специфика сметирования военных объектов
          </h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-xl bg-slate-950/60 border border-stone-700/60 p-4">
              <p className="text-amber-300 font-semibold mb-2">Режимная секретность</p>
              <p className="text-stone-300 leading-relaxed">
                Все сметные документы оформляются под грифом «ДСП» (для служебного пользования)
                или «Секретно». Электронные файлы хранятся только на сертифицированных носителях.
                Передача через обычную электронную почту — запрещена.
              </p>
            </div>
            <div className="rounded-xl bg-slate-950/60 border border-stone-700/60 p-4">
              <p className="text-amber-300 font-semibold mb-2">Допуск подрядчика (форма №2)</p>
              <p className="text-stone-300 leading-relaxed">
                Генеральный подрядчик обязан иметь специальную лицензию МО РК на производство
                строительно-монтажных работ на оборонных объектах. Ключевой персонал проходит
                проверку КНБ РК.
              </p>
            </div>
            <div className="rounded-xl bg-slate-950/60 border border-stone-700/60 p-4">
              <p className="text-amber-300 font-semibold mb-2">Особые коэффициенты МО</p>
              <p className="text-stone-300 leading-relaxed">
                К базовым расценкам ЭСН применяются закрытые коэффициенты Министерства обороны,
                учитывающие режимную надбавку, повышенные требования к конструкциям и охранные
                мероприятия на период строительства.
              </p>
            </div>
            <div className="rounded-xl bg-slate-950/60 border border-stone-700/60 p-4">
              <p className="text-amber-300 font-semibold mb-2">Закрытые тендеры</p>
              <p className="text-stone-300 leading-relaxed">
                Государственные закупки на оборонные объекты проводятся в закрытом режиме
                без публикации на портале госзакупок. Участники определяются МО РК по спискам
                допущенных поставщиков.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4 */}
        <section className="rounded-2xl bg-stone-900/40 border border-stone-800 p-6">
          <h2 className="text-xl font-semibold text-stone-300 mb-4">
            4. Нормативная база
          </h2>
          <ul className="text-sm text-stone-300 space-y-2 leading-relaxed">
            <li>
              <span className="text-amber-300 font-mono">Закон РК «Об обороне и Вооружённых Силах РК»</span>{" "}
              — основополагающий документ, определяющий структуру оборонного заказа.
            </li>
            <li>
              <span className="text-amber-300 font-mono">Строительные нормативы Генерального штаба МО РК</span>{" "}
              — закрытые нормативные документы для проектирования и строительства военных объектов.
            </li>
            <li>
              <span className="text-amber-300 font-mono">Специальные ТУ (технические условия)</span>{" "}
              — разрабатываются под каждый объект, учитывают требования конкретного рода войск
              и командования воинской части.
            </li>
            <li>
              <span className="text-amber-300 font-mono">СНИП РК (открытая часть)</span>{" "}
              — применяется как базовый документ там, где закрытые нормы МО не устанавливают
              иных требований.
            </li>
          </ul>
        </section>

        {/* Exercises */}
        <section className="rounded-2xl bg-stone-900/40 border border-stone-800 p-6">
          <h2 className="text-xl font-semibold text-stone-300 mb-6">
            Интерактивные упражнения
          </h2>

          {/* Exercise 1 */}
          <div className="mb-8 rounded-xl bg-slate-900/60 border border-stone-700/60 p-5">
            <h3 className="font-semibold text-stone-200 mb-2">
              Упражнение 1. Допуск подрядчика к военному объекту
            </h3>
            <p className="text-stone-400 text-sm mb-4 leading-relaxed">
              Подрядчик хочет участвовать в строительстве объекта Министерства обороны РК.
              Что обязательно для допуска к работам?
            </p>
            <div className="space-y-2 text-sm">
              {[
                {
                  v: "a",
                  t: "Достаточно стандартной строительной лицензии МАРХТ РК — военный объект ничем не отличается",
                },
                {
                  v: "b",
                  t: "Регистрация на портале госзакупок goszakup.gov.kz и подача заявки онлайн",
                },
                {
                  v: "c",
                  t: "Допуск формы №1 или №2 к государственной тайне, проверка КНБ РК + специальная СМР-лицензия для оборонных объектов",
                },
                {
                  v: "d",
                  t: "Членство в СРО строителей — и этого достаточно для любого госзаказа",
                },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${
                    a1 === opt.v
                      ? "border-amber-400/60 bg-amber-500/10"
                      : "border-stone-700/40 hover:border-stone-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex1"
                    value={opt.v}
                    checked={a1 === opt.v}
                    onChange={(e) => setA1(e.target.value)}
                    className="mt-1 accent-amber-400"
                  />
                  <span className="text-stone-300">
                    <span className="text-amber-300 font-mono mr-2">{opt.v})</span>
                    {opt.t}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() =>
                  setR1(
                    checkChoice(
                      a1,
                      "c",
                      "Верно: допуск формы №1 или №2 к государственной тайне, проверка КНБ РК + специальная СМР-лицензия для оборонных объектов.",
                      "Неверно. Военные объекты требуют специального допуска к гостайне и лицензии МО — стандартной строительной лицензии недостаточно."
                    )
                  )
                }
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold text-sm transition-colors"
              >
                Проверить
              </button>
              <button
                onClick={() => setS1((v) => !v)}
                className="px-4 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-sm transition-colors"
              >
                {s1 ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {r1 && (
              <p className={`mt-3 text-sm ${r1.ok ? "text-emerald-300" : "text-rose-300"}`}>
                {r1.msg}
              </p>
            )}
            {s1 && (
              <div className="mt-4 p-4 rounded-lg bg-slate-950/70 border border-stone-700/60 text-sm text-stone-300 leading-relaxed">
                <p className="text-amber-300 font-semibold mb-2">Решение:</p>
                <p>
                  Все участники оборонного строительства в РК обязаны пройти процедуру допуска
                  к государственной тайне в соответствии с Законом РК «О государственных секретах».
                  Форма №2 даёт доступ к сведениям с грифом «Секретно», форма №1 — «Совершенно секретно».
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-stone-400">
                  <li>Проверку проводит КНБ РК (Комитет национальной безопасности)</li>
                  <li>Дополнительно требуется лицензия МО РК на строительство оборонных объектов</li>
                  <li>Госзакупки проводятся в закрытом режиме — портал goszakup здесь не используется</li>
                </ul>
                <p className="mt-2">
                  Правильный ответ — <span className="text-emerald-300 font-semibold">c</span>.
                </p>
              </div>
            )}
          </div>

          {/* Exercise 2 */}
          <div className="mb-8 rounded-xl bg-slate-900/60 border border-stone-700/60 p-5">
            <h3 className="font-semibold text-stone-200 mb-2">
              Упражнение 2. Отличие сметы военного объекта от гражданского
            </h3>
            <p className="text-stone-400 text-sm mb-4 leading-relaxed">
              Чем принципиально отличается смета военного объекта от сметы обычного
              гражданского здания?
            </p>
            <div className="space-y-2 text-sm">
              {[
                {
                  v: "a",
                  t: "Только тем, что добавляется охрана территории в раздел «Прочие работы»",
                },
                {
                  v: "b",
                  t: "Применяются закрытые (секретные) сборники ЭСН и индексы МО + режимные коэффициенты + все документы только под грифом «ДСП» или «Секретно»",
                },
                {
                  v: "c",
                  t: "Военная смета не отличается — применяются те же открытые сборники ЭСН РК",
                },
                {
                  v: "d",
                  t: "Отличие только в том, что военный заказчик платит быстрее и без проверки КГД",
                },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${
                    a2 === opt.v
                      ? "border-amber-400/60 bg-amber-500/10"
                      : "border-stone-700/40 hover:border-stone-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex2"
                    value={opt.v}
                    checked={a2 === opt.v}
                    onChange={(e) => setA2(e.target.value)}
                    className="mt-1 accent-amber-400"
                  />
                  <span className="text-stone-300">
                    <span className="text-amber-300 font-mono mr-2">{opt.v})</span>
                    {opt.t}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() =>
                  setR2(
                    checkChoice(
                      a2,
                      "b",
                      "Верно: закрытые сборники ЭСН и индексы МО, режимные коэффициенты, гриф «ДСП»/«Секретно» на всех документах.",
                      "Неверно. Военная смета принципиально отличается: закрытые ЭСН-сборники, особые коэффициенты и режимный документооборот."
                    )
                  )
                }
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold text-sm transition-colors"
              >
                Проверить
              </button>
              <button
                onClick={() => setS2((v) => !v)}
                className="px-4 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-sm transition-colors"
              >
                {s2 ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {r2 && (
              <p className={`mt-3 text-sm ${r2.ok ? "text-emerald-300" : "text-rose-300"}`}>
                {r2.msg}
              </p>
            )}
            {s2 && (
              <div className="mt-4 p-4 rounded-lg bg-slate-950/70 border border-stone-700/60 text-sm text-stone-300 leading-relaxed">
                <p className="text-amber-300 font-semibold mb-2">Решение:</p>
                <ul className="list-disc list-inside space-y-1 text-stone-400">
                  <li>Используются закрытые ЭСН-сборники МО (не публикуются в открытом доступе)</li>
                  <li>Применяются закрытые индексы пересчёта МО РК (не квартальные индексы КС ЦЦС РК)</li>
                  <li>Режимные коэффициенты учитывают охрану, пропускной режим, спецматериалы</li>
                  <li>Все документы оформляются под грифом «ДСП» или «Секретно»</li>
                  <li>Гриф снимается только по специальному разрешению МО</li>
                </ul>
                <p className="mt-2">
                  Правильный ответ — <span className="text-emerald-300 font-semibold">b</span>.
                </p>
              </div>
            )}
          </div>

          {/* Exercise 3 */}
          <div className="mb-8 rounded-xl bg-slate-900/60 border border-stone-700/60 p-5">
            <h3 className="font-semibold text-stone-200 mb-2">
              Упражнение 3. Площадь казармы
            </h3>
            <p className="text-stone-400 text-sm mb-4 leading-relaxed">
              Проектируется казарма на <span className="text-stone-200 font-semibold">200 военнослужащих</span>.
              Норма площади жилого помещения — 6 м²/чел. С учётом санузлов, холлов, кладовых
              и служебных помещений общий коэффициент = 12 м²/чел.
              Рассчитайте общую площадь казармы (м²).
            </p>
            <p className="text-stone-500 text-xs mb-3">Формула: 200 чел × 12 м²/чел = ?</p>
            <input
              type="text"
              value={a3}
              onChange={(e) => setA3(e.target.value)}
              placeholder="Площадь, м²"
              className="w-full md:w-72 px-4 py-2 rounded-lg bg-slate-950 border border-stone-700 text-stone-200 placeholder-stone-600 focus:border-amber-400 focus:outline-none text-sm"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setR3(checkNumeric(a3, 2400, 100, "м²"))}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold text-sm transition-colors"
              >
                Проверить
              </button>
              <button
                onClick={() => setS3((v) => !v)}
                className="px-4 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-sm transition-colors"
              >
                {s3 ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {r3 && (
              <p className={`mt-3 text-sm ${r3.ok ? "text-emerald-300" : "text-rose-300"}`}>
                {r3.msg}
              </p>
            )}
            {s3 && (
              <div className="mt-4 p-4 rounded-lg bg-slate-950/70 border border-stone-700/60 text-sm text-stone-300 leading-relaxed">
                <p className="text-amber-300 font-semibold mb-2">Решение:</p>
                <ul className="list-disc list-inside space-y-1 text-stone-300">
                  <li>Жилая часть: 200 × 6 м² = 1 200 м²</li>
                  <li>Санузлы, холлы, кладовые, коридоры — увеличивают норму до 12 м²/чел</li>
                  <li>Итого: 200 × 12 = <span className="text-amber-300 font-semibold">2 400 м²</span></li>
                </ul>
                <p className="mt-2 text-stone-400">
                  В ценах 2026 г. строительство казармы обходится ≈ 350 000–480 000 тг/м²
                  (без специального оборудования охраны и связи).
                </p>
              </div>
            )}
          </div>

          {/* Exercise 4 */}
          <div className="rounded-xl bg-slate-900/60 border border-stone-700/60 p-5">
            <h3 className="font-semibold text-stone-200 mb-2">
              Упражнение 4. Конструктив командного пункта (КП)
            </h3>
            <p className="text-stone-400 text-sm mb-4 leading-relaxed">
              Командный пункт (КП) строится с обязательным применением специальных конструктивных
              решений. Какой набор является стандартным для КП в РК?
            </p>
            <div className="space-y-2 text-sm">
              {[
                {
                  v: "a",
                  t: "Стандартные кирпичные стены 510 мм + металлочерепица + обычная вентиляция",
                },
                {
                  v: "b",
                  t: "Сборные ж/б панели серии 1.020 + обычные стальные двери + централизованное электроснабжение",
                },
                {
                  v: "c",
                  t: "Монолитный ж/б 0,5 м + металлические ставни + резервный генератор 30 кВт",
                },
                {
                  v: "d",
                  t: "Усиленный ж/б монолит 1–2 м толщиной + специальные двери с защитой от ударной волны + автономные системы электроснабжения/ВК/вентиляции + электромагнитная защита (клетка Фарадея)",
                },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${
                    a4 === opt.v
                      ? "border-amber-400/60 bg-amber-500/10"
                      : "border-stone-700/40 hover:border-stone-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex4"
                    value={opt.v}
                    checked={a4 === opt.v}
                    onChange={(e) => setA4(e.target.value)}
                    className="mt-1 accent-amber-400"
                  />
                  <span className="text-stone-300">
                    <span className="text-amber-300 font-mono mr-2">{opt.v})</span>
                    {opt.t}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() =>
                  setR4(
                    checkChoice(
                      a4,
                      "d",
                      "Верно: монолит 1–2 м, спецдвери от ударной волны, автономные инженерные системы, клетка Фарадея от ЭМИ.",
                      "Неверно. КП требует полного комплекса защиты: усиленный монолит, герметичные двери, автономные системы и ЭМИ-защиту."
                    )
                  )
                }
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold text-sm transition-colors"
              >
                Проверить
              </button>
              <button
                onClick={() => setS4((v) => !v)}
                className="px-4 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-sm transition-colors"
              >
                {s4 ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {r4 && (
              <p className={`mt-3 text-sm ${r4.ok ? "text-emerald-300" : "text-rose-300"}`}>
                {r4.msg}
              </p>
            )}
            {s4 && (
              <div className="mt-4 p-4 rounded-lg bg-slate-950/70 border border-stone-700/60 text-sm text-stone-300 leading-relaxed">
                <p className="text-amber-300 font-semibold mb-2">Решение:</p>
                <ul className="list-disc list-inside space-y-1 text-stone-400">
                  <li>
                    <span className="text-stone-300">Монолитный ж/б 1–2 м</span> — защита от ударной волны
                    и проникающей радиации. Класс бетона B40–B50, арматура класса А500.
                  </li>
                  <li>
                    <span className="text-stone-300">Специальные двери</span> — герметичные, с волноотражающим
                    профилем, выдерживают избыточное давление взрыва 0,5–2,0 кгс/см².
                  </li>
                  <li>
                    <span className="text-stone-300">Автономные инженерные системы</span> — автономное
                    электроснабжение (ДГУ + ИБП), автономное водоснабжение, принудительная вентиляция
                    с фильтрами РХБЗ.
                  </li>
                  <li>
                    <span className="text-stone-300">Клетка Фарадея (ЭМИ-защита)</span> — сплошной
                    металлический экран по всем поверхностям, защита от электромагнитного импульса.
                  </li>
                </ul>
                <p className="mt-2">
                  Правильный ответ — <span className="text-emerald-300 font-semibold">d</span>.
                </p>
              </div>
            )}
          </div>
        </section>

        <footer className="border-t border-stone-800/60 pt-6 text-xs text-stone-500 text-center">
          Модуль AEVION Smeta Trainer · drawings-practice / military-defense · 2026
        </footer>
      </main>
    </div>
  );
}
