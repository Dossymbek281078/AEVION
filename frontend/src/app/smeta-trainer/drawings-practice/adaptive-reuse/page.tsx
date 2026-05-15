"use client";

import Link from "next/link";
import { useState } from "react";

export default function AdaptiveReusePage() {
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
    // Адаптация: 4500 м² × 220 тыс. тг = 990 млн тг (бенчмарк адаптивного 200-250 тыс. тг/м²)
    const v = parseFloat(ex3);
    if (!isFinite(v)) return setEx3Res("bad");
    setEx3Res(Math.abs(v - 990) <= 30 ? "ok" : "bad");
  };
  const checkEx4 = () => setEx4Res(ex4 === "d" ? "ok" : "bad");

  const cases = [
    {
      name: "Завод → Лофт-апартаменты",
      example: "Loft Almaty (бывший завод «Локомотив»), Бостандыкский район",
      original: "Промышленный цех 1950-х, ж/б каркас, кирпичные стены, металлокаркас",
      new_use: "Жилые лофты 50-150 м² с высокими потолками 4-5 м, открытыми коммуникациями",
      challenges: "Сейсмоусиление каркаса (Алматы 9 б.), новая инж. инфраструктура, противопожарная защита",
      cost: "200-300 тыс. тг/м² адаптации (vs 350-450 тыс. тг/м² нового премиум-стр-ва)",
    },
    {
      name: "Склад / Ангар → Торговый центр",
      example: "ТЦ «MEGA Silk Way» Астана (частично из бывших ангаров), Almaty Loft Mall",
      original: "Складские помещения с высокими потолками 6-12 м, металлокаркас",
      new_use: "Открытые торговые пространства, фуд-корты, шоу-румы, со-воркинг",
      challenges: "Утепление наружных стен, ОВ + кондиционирование, инженерные сети, эвакуационные пути",
      cost: "150-220 тыс. тг/м² адаптации",
    },
    {
      name: "Школа / Институт → Бизнес-центр",
      example: "БЦ «KazNet Media» (бывшая школа на Кабанбай Батыра), БЦ «Tau-Express» в Алматы",
      original: "3-4 этажа кирпичных зданий советского периода с типовой планировкой",
      new_use: "Офисы класса B/B+, гибкие планировки, бизнес-инкубаторы",
      challenges: "Сетевые ресурсы (мощность электр., вода, оптоволокно), парковка, престиж адреса",
      cost: "180-280 тыс. тг/м² адаптации (зависит от класса БЦ)",
    },
    {
      name: "Кинотеатр / Дом культуры → Жилой комплекс",
      example: "Бывший к/т «Целинный» в Алматы (трансформация в культурный кластер 2022-2024)",
      original: "Огромные пространства, высокие потолки, специализированные акустические зоны",
      new_use: "Многоквартирные жилые комплексы, креативные пространства, art-резиденции",
      challenges: "Радикальная перепланировка, изменение функционального зонирования, сохранение наследия",
      cost: "250-400 тыс. тг/м² (сильно зависит от глубины перестройки)",
    },
    {
      name: "Церковь / Мечеть → Культурное пространство",
      example: "Менее частая практика в РК (религиозный аспект). Чаще — реставрация",
      original: "Купольные здания, специальная акустика, культовые символы",
      new_use: "Концертные залы, выставочные пространства, библиотеки",
      challenges: "Согласование с религиозными общинами, культурное наследие, специальные зоны",
      cost: "300-500 тыс. тг/м² (премиум, мало кейсов)",
    },
    {
      name: "Гараж / Парковка → Микро-жильё",
      example: "В Европе и Японии — частая практика. В РК пилоты: Almaty Garage Lofts (2023)",
      original: "Капитальные многоэтажные гаражи 1970-1990-х",
      new_use: "Студии 18-30 м² для молодёжи, доступное жильё",
      challenges: "Низкие потолки (2.4 м), отсутствие окон в части помещений, инж. ресурсы",
      cost: "140-200 тыс. тг/м² (эконом-сегмент)",
    },
  ];

  const advantages = [
    { metric: "Стоимость", new_build: "100% (база)", adaptive: "60-80% (-20-40%)" },
    { metric: "Сроки", new_build: "100% (база)", adaptive: "50-70% (быстрее)" },
    { metric: "Экологический след", new_build: "100% (база)", adaptive: "30-50% (меньше CO₂)" },
    { metric: "Сохранение наследия", new_build: "0% (новое)", adaptive: "60-100% (зависит от глубины)" },
    { metric: "Архитектурная уникальность", new_build: "Низкая", adaptive: "Высокая (характер сохранён)" },
    { metric: "Юридические сложности", new_build: "Стандартные", adaptive: "Повышенные (смена назначения)" },
    { metric: "Сейсмика (для РК)", new_build: "Свежий расчёт", adaptive: "Усиление существующего ×1.5-2 от нового" },
    { metric: "Чистая прибыль девелопера", new_build: "10-20%", adaptive: "15-30% (выше за счёт меньших затрат)" },
  ];

  const steps = [
    { n: 1, name: "Историко-архитектурное исследование", what: "Изучение здания, его статуса (памятник или нет), технического состояния" },
    { n: 2, name: "Согласование смены функционального назначения", what: "Постановление акимата о переводе из категории «промышленное» в «жилое/коммерческое» (ст. 50 ЗРК «Об архит. деят.»)" },
    { n: 3, name: "Геотехническое обследование", what: "Состояние фундамента, грунтов, осадки — критично для старых зданий" },
    { n: 4, name: "Сейсморасчёт существующих конструкций", what: "По СП РК 2.03-30 для Алматы 9 баллов — часто требуется усиление" },
    { n: 5, name: "Проект адаптации с улучшениями", what: "Перепланировка, новая инж. инфраструктура, отделка, дизайн" },
    { n: 6, name: "Демонтаж ненесущих + сохранение характерных", what: "Что разрушаем (внутренние перегородки), что сохраняем (фасад, каркас, особенности)" },
    { n: 7, name: "Усиление конструкций + новые системы", what: "Балки, колонны, перекрытия + новая канализация, вентиляция, электр." },
    { n: 8, name: "Внутренняя отделка + дизайн", what: "Часто с акцентом на оригинальные элементы (открытые балки, кирпичная кладка)" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Адаптивное переисп.</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            ♻️ Адаптивное переиспользование зданий
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            <strong className="text-orange-300">Adaptive Reuse</strong> — это перевод
            существующего здания в новую функцию. Завод → лофт-апартаменты, склад → ТЦ,
            школа → бизнес-центр. По экологическим стандартам ESG это в 2-3 раза
            «зеленее» нового стр-ва (CO₂-след ниже на 50-70%). В РК с 2020 г. активно
            развивается: Loft Almaty, культурный кластер «Целинный», Astana креативные
            пространства. Регулируется ЗРК «Об архит., град. и стр. деятельности» +
            СНиП РК 1.04-25 (для памятников) + спец. постановления акиматов о смене
            функционального назначения.
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Экономия vs новое стр-во</div>
              <div className="text-slate-300">20-40% от стоимости + 30-50% сроков</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">ESG-преимущество</div>
              <div className="text-slate-300">CO₂-след в 2-3 раза ниже нового</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Прибыль девелопера</div>
              <div className="text-slate-300">15-30% (выше нового на 5-10 п.п.)</div>
            </div>
          </div>
        </section>

        {/* Section 1: 6 типов */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🏗 Section 1. Шесть типов адаптивного переиспользования
          </h2>
          <div className="space-y-3">
            {cases.map((c) => (
              <div key={c.name} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
                <h3 className="text-base font-semibold text-orange-300 mb-2">{c.name}</h3>
                <dl className="text-sm space-y-1.5">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Пример в РК</dt>
                    <dd className="text-slate-300 text-xs italic">{c.example}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Исходное здание</dt>
                    <dd className="text-slate-300 text-xs">{c.original}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Новая функция</dt>
                    <dd className="text-slate-300 text-xs">{c.new_use}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Вызовы</dt>
                    <dd className="text-rose-300 text-xs">{c.challenges}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Стоимость</dt>
                    <dd className="text-emerald-300 text-xs font-mono">{c.cost}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Сравнение */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🆚 Section 2. Новое стр-во vs Адаптивное переисп.
          </h2>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Параметр</th>
                  <th className="text-left px-4 py-3">Новое стр-во</th>
                  <th className="text-left px-4 py-3">Адаптивное</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {advantages.map((a) => (
                  <tr key={a.metric} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 text-slate-100 text-xs">{a.metric}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{a.new_build}</td>
                    <td className="px-4 py-3 text-orange-300 text-xs">{a.adaptive}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Этапы */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🪜 Section 3. Восемь этапов адаптации
          </h2>
          <div className="space-y-3">
            {steps.map((s) => (
              <div key={s.n} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40 flex gap-4">
                <div className="text-3xl font-bold text-orange-400 w-12 text-center shrink-0">{s.n}</div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-slate-100 mb-1">{s.name}</h3>
                  <p className="text-xs text-slate-300">{s.what}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: Особенности смет */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📋 Section 4. Особенности смет адаптации
          </h2>
          <div className="border border-orange-800/60 bg-orange-950/30 rounded-xl p-5 text-sm space-y-3">
            <div>
              <strong className="text-orange-300">Разбивка стоимости адаптации:</strong>
              <ul className="list-disc list-inside ml-4 mt-1 text-slate-300 text-xs space-y-1">
                <li>Демонтаж ненесущих элементов: 5-10%</li>
                <li>Сейсмоусиление каркаса (для РК): 15-25%</li>
                <li>Новые инж. сети (ВК, ОВ, ЭО): 25-30%</li>
                <li>Перепланировка и стены: 10-15%</li>
                <li>Отделка и дизайн: 25-35%</li>
                <li>Лифты, противопожарка, эвакуация: 5-10%</li>
              </ul>
            </div>
            <div>
              <strong className="text-orange-300">Ключевые риски сметчика:</strong>
              <ul className="list-disc list-inside ml-4 mt-1 text-slate-300 text-xs space-y-1">
                <li>Скрытые дефекты — обнаружение после демонтажа стен (трещины, коррозия)</li>
                <li>Усиление под новые нагрузки (промышленные перекрытия — на ходячих, в жилых — &lt;)</li>
                <li>Невидимые проблемы коммуникаций (старые трубы, не на чертежах)</li>
                <li>Согласования смены назначения — могут затянуться 6-12 мес.</li>
                <li>Резерв на риски не 5-7%, а 10-15% — необходим</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Section 5. Упражнения</h2>

          {/* Упр.1 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Что согласовывать
            </div>
            <div className="text-slate-200 mb-4">
              Девелопер покупает бывший завод в Алматы и хочет переоборудовать его в
              лофт-апартаменты. Какое <strong>обязательное согласование</strong> нужно
              получить от акимата перед началом работ?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Только разрешение на снос" },
                { v: "b", t: "Достаточно подать уведомление о начале работ" },
                { v: "c", t: "Постановление акимата о смене функционального назначения объекта (из «промышленное» в «жилое»). Без этого все работы будут признаны самовольными, а объект — несоответствующим назначению по ст. 244 ГК РК" },
                { v: "d", t: "Только лицензию на СМР" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1 === opt.v ? "border-orange-600 bg-orange-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-orange-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex1Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — смена назначения</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-orange-300">Решение:</strong> Перевод здания из
                одной функциональной категории в другую — ключевое согласование. Без
                него невозможно:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Получить разрешение СЭС на жилой объект (для промышленного — другие нормы)</li>
                  <li>Подключить квартиры к коммунальным сетям (тарифы для жилых ниже)</li>
                  <li>Регистрировать квартиры в Госкадастре (нужна категория «жильё»)</li>
                  <li>Продавать как жильё (банки не дадут ипотеку)</li>
                </ul>
                Процедура смены назначения (ст. 50 ЗРК «Об архит. деят.»):
                <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
                  <li>Подача заявки в МИО (акимат) с обоснованием</li>
                  <li>Согласование с архитектором города/района</li>
                  <li>Согласование с СЭС (для жилого — особые нормы)</li>
                  <li>Согласование с ЧС МВД (пожарная безопасность)</li>
                  <li>Согласование с балансодержателями сетей</li>
                  <li>Постановление акимата (срок 2-4 мес.)</li>
                </ol>
                Сроки 2-6 мес. — это нужно учесть в графике проекта.
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Сейсмоусиление
            </div>
            <div className="text-slate-200 mb-4">
              Промышленное здание 1970 г. в Алматы переоборудуется в офис.
              Расчёт сейсмостойкости показывает, что здание соответствует требованиям
              для промышленных нагрузок, но <strong>не выдержит</strong> 9-балльного
              землетрясения с новой жилой/офисной нагрузкой. Что делать?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Игнорировать — здание уже стоит 50 лет" },
                { v: "b", t: "Сейсмоусиление конструкций до соответствия СП РК 2.03-30 для жилых/офисных объектов: добавить пояса, усилить узлы, установить демпферы. Удорожание +15-25% к адаптации, но без этого — нельзя ввести в эксплуатацию" },
                { v: "c", t: "Полностью снести и построить заново" },
                { v: "d", t: "Использовать только нижние этажи" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex2 === opt.v ? "border-orange-600 bg-orange-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex2" value={opt.v} checked={ex2 === opt.v} onChange={() => setEx2(opt.v)} className="accent-orange-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex2Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — усиление обязательно</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-orange-300">Решение:</strong> Сейсмостойкость
                — ключевой риск адаптации в Алматы. По СП РК 2.03-30 промышленные и
                жилые/офисные здания имеют разные требования (К₀ — коэф. ответственности
                1.0 vs 1.2). Старое здание, спроектированное для промышленности, при смене
                назначения должно быть пересчитано и усилено.
                <br /><br />
                Типичные мероприятия усиления:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Антисейсмические пояса на каждом этаже (если не было)</li>
                  <li>Усиление узлов сопряжения (стены-перекрытия)</li>
                  <li>Установка стальных рам или X-связей в плоскости стен</li>
                  <li>Усиление колонн обоймами из углеволокна или стали</li>
                  <li>Иногда — демпферы (TMD) для гашения колебаний</li>
                </ul>
                Стоимость усиления: 30-80 тыс. тг/м² (зависит от глубины). При адаптации
                офисного здания 4000 м²: 120-320 млн тг только на сейсмоусиление. Это
                критично заложить в бюджет — иначе после демонтажа стен обнаружится,
                что усиление нужно, а денег нет.
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Бюджет адаптации завода
            </div>
            <div className="text-slate-200 mb-4">
              Заводское здание <strong>4 500 м²</strong> переоборудуется в лофт-апартаменты
              в Алматы. Бенчмарк адаптации лофтов — <strong>220 тыс. тг/м²</strong>.
              Какой <strong>общий бюджет</strong> в <strong>МЛН тг</strong>?
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Бюджет, млн тг</span>
              <input value={ex3} onChange={(e) => setEx3(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="990" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 990 млн тг</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-orange-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Бюджет = 4500 × 220 000 = 990 000 000 тг = 990 млн тг

Сравнение с новым стр-вом:
• Новое премиум-стр-во: 4500 × 380 000 = 1 710 млн тг
• Адаптация: 990 млн тг
• Экономия: 720 млн тг (42% от нового)

Структура 990 млн тг:
• Демонтаж: 7% = 69 млн тг
• Сейсмоусиление: 20% = 198 млн тг
• Инж. сети (вод/тепло/электр./слаботочка): 28% = 277 млн тг
• Перепланировка стен: 12% = 119 млн тг
• Отделка лофт-стиля: 28% = 277 млн тг
• Лифты, противопожарная: 5% = 50 млн тг

Доходность адаптации:
• Площадь продаваемая (за вычетом общих) ~ 3800 м² (85%)
• Цена продажи лофтов в Алматы: 750-950 тыс. тг/м²
• Доход: 3800 × 850 000 = 3 230 млн тг
• Маржа: 3230 − 990 = 2 240 млн тг (226% к затратам!)

Адаптивное переисп. — высокомаржинальный сегмент благодаря
уникальности продукта (лофты как класс новый для РК).`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — ESG-преимущество
            </div>
            <div className="text-slate-200 mb-4">
              Девелопер хочет получить кредит ЕБРР с льготной ставкой по «зелёным» проектам.
              Какое <strong>главное ESG-преимущество</strong> адаптивного переиспользования
              перед новым строительством?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Никакого — это всё ещё строительство" },
                { v: "b", t: "Только архитектурная уникальность" },
                { v: "c", t: "Только экономия денег" },
                { v: "d", t: "CO₂-след в 2-3 раза ниже нового стр-ва (сохраняем конструкции = экономим тонны бетона/стали = меньше выбросов). Дополнительно: сохранение городского наследия, использование заводских отходов после демонтажа, EDGE-сертификация — всё это даёт + к ESG-рейтингу и льготным условиям ЕБРР" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex4 === opt.v ? "border-orange-600 bg-orange-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex4" value={opt.v} checked={ex4 === opt.v} onChange={() => setEx4(opt.v)} className="accent-orange-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex4Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — CO₂ + сохранение</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-orange-300">Решение:</strong> Адаптивное
                переиспользование — флагман «Green Building» концепции. Статистика
                Всемирного совета по зелёному строительству (WGBC):
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Новое стр-во: ~ 500 кг CO₂ на 1 м² здания (выбросы при производстве
                  материалов)</li>
                  <li>Адаптивное: ~ 150-250 кг CO₂/м² (только дополнительные материалы)</li>
                  <li>Экономия CO₂: 50-70%</li>
                </ul>
                Для проекта 4500 м²: 1.1-1.5 тыс. тонн CO₂ — экологический эквивалент
                посадки 50 000-70 000 деревьев или 5-летнего парка автомобилей.
                <br /><br />
                <strong>Финансовая выгода ESG:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>ЕБРР даёт ставку -1-2% годовых на «зелёные» проекты</li>
                  <li>EDGE-сертификация снижает страховые ставки на 5-10%</li>
                  <li>Маркетинг: «зелёные» лофты продаются на 5-10% дороже</li>
                  <li>Госпрограммы преференций (НДС, налог на имущество)</li>
                </ul>
                В РК тренд набирает обороты — KazAtomProm, BI Group, ERG переходят на
                ESG-стратегии, открывая новый рынок для сметчиков с компетенциями
                «зелёного» строительства.
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          ЗРК «Об архит., град. и стр. деятельности» ст. 50 (смена назначения). СП РК
          2.03-30 (Сейсмостойкость). World Green Building Council (WGBC) — worldgbc.org.
          EDGE сертификация — edgebuildings.com. Loft Almaty — loftalmaty.kz, культурный
          кластер «Целинный» — almatycelin.kz.
        </div>
      </main>
    </div>
  );
}
