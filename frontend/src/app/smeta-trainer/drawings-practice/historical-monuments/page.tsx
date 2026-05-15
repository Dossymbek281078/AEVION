"use client";

import Link from "next/link";
import { useState } from "react";

export default function HistoricalMonumentsPage() {
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
    // Расценка ЭСН × 1.5 (надбавка за памятник) × 1.3 (Кр ручной труд) × 1.2 (зимний)
    // 5000 × 1.5 × 1.3 × 1.2 = 11 700 тг/м²
    const v = parseFloat(ex3);
    if (!isFinite(v)) return setEx3Res("bad");
    setEx3Res(Math.abs(v - 11_700) <= 200 ? "ok" : "bad");
  };
  const checkEx4 = () => setEx4Res(ex4 === "d" ? "ok" : "bad");

  const monuments = [
    {
      name: "Мавзолей Ходжи Ахмеда Ясави (Туркестан)",
      year: "XIV в. (1389-1405), Тимур",
      status: "Памятник Всемирного наследия ЮНЕСКО (2003)",
      project: "Поэтапная реставрация 1995-2025, ~ 10 млн $ суммарно",
      challenges: "Сейсмостойкость (район 8 баллов), исходные технологии — глина, керамика",
      methods: "Сохранение оригинала + традиционные материалы (саман, глазурь) + реставрационные керамические плитки",
    },
    {
      name: "Городище Отрар (Туркестан)",
      year: "I в. до н.э. - XVIII в.",
      status: "Памятник истории и культуры РК республиканского значения",
      project: "Археологическая консервация + музеефикация, спорадически",
      challenges: "Эрозия, ветер, фрагменты сырцовых стен, открытое раскопочное поле",
      methods: "Защитные навесы, реконструкция фрагментов кирпичом-сырцом, химическая консервация",
    },
    {
      name: "Петроглифы Тамгалы (Алматинская область)",
      year: "II тыс. до н.э. - I тыс. до н.э.",
      status: "Памятник Всемирного наследия ЮНЕСКО (2004)",
      project: "Защита от вандализма + биологическая консервация, 2-5 млн $ ежегодно",
      challenges: "Открытое расположение, выветривание, лишайники на камне",
      methods: "Огораживание, тропы для туристов, удаление биообрастаний, видеомониторинг",
    },
    {
      name: "Мавзолей Айша-Биби (Тараз)",
      year: "XI-XII в.",
      status: "Памятник истории и культуры РК республиканского значения",
      project: "Реставрация 2010-2015, ~ 1.5 млн $",
      challenges: "Уникальная резная терракотовая облицовка, реставрация невозможна без оригинала",
      methods: "Аутентичная замена утраченных керамических плит по архивным фотографиям + анастилоз (восстановление из найденных фрагментов)",
    },
    {
      name: "Каркаралинская мечеть (Карагандинская область)",
      year: "XIX в.",
      status: "Памятник истории и культуры РК местного значения",
      project: "Реставрация 2018-2020, ~ 500 тыс. $",
      challenges: "Деревянные конструкции с резьбой, замена сгнивших элементов",
      methods: "Демонтаж + копирование оригинальной резьбы вручную мастерами + замена несущих элементов",
    },
    {
      name: "Здания Алматы конца XIX - начала XX в.",
      year: "1880-1917 (т.н. «Верненский период»)",
      status: "Около 200 объектов в реестре памятников Алматы",
      project: "Различные частные и государственные реставрации, 100 тыс. - 5 млн $/объект",
      challenges: "Деревянные и кирпичные купеческие дома, сейсмика 9 баллов, рост Алматы",
      methods: "Аутентичное восстановление фасадов, обновление инж. систем, сейсмоусиление с сохранением вида",
    },
  ];

  const stages = [
    { n: 1, name: "Историко-архивные исследования", what: "Изучение архивов, фотографий, чертежей, литературы", who: "Архитектор-историк, искусствовед" },
    { n: 2, name: "Натурные обследования", what: "Обмер, фотофиксация, шурфы, замеры влажности/наклонов", who: "Архитектор-реставратор + геодезист + геолог" },
    { n: 3, name: "Лабораторные анализы", what: "Состав раствора, керамики, дерева, металла. Радиоуглеродный анализ", who: "Реставрационная лаборатория (Институт археологии РК)" },
    { n: 4, name: "Проект реставрации", what: "Концепция: что сохраняем, что воссоздаём, что заменяем. Согласование Минкультуры РК", who: "Реставрационный проектировщик + Комитет по охране" },
    { n: 5, name: "ГосЭкспертиза + ЮНЕСКО (если объект)", what: "Двойная проверка: РК + ICOMOS (если ЮНЕСКО)", who: "Комитет по охране пам. + ICOMOS-эксперт" },
    { n: 6, name: "Реставрационные работы", what: "Ручной труд мастеров-реставраторов, минимум техники", who: "Реставрационные бригады по специализациям" },
    { n: 7, name: "Авторский надзор реставратора", what: "Постоянное присутствие реставратора-автора проекта", who: "Главный реставратор по объекту" },
    { n: 8, name: "Документация и мониторинг", what: "Подробная документация каждого этапа, фото до/после/в процессе. Долгосрочный мониторинг состояния", who: "Реставратор + музей" },
  ];

  const features = [
    { feat: "Ручной труд (минимум техники)", note: "Расценки ×1.5-3 от обычных, спец. квалификация мастеров" },
    { feat: "Аутентичные материалы", note: "Глина, саман, известь, спец. керамика — иногда производятся специально для проекта" },
    { feat: "Реставрационные коэффициенты", note: "К_рест = 1.3-2.0 к стандартным ЭСН по СНиП РК 1.04-25" },
    { feat: "Авторский надзор реставратора", note: "Обязательно: 1 реставратор на объект, ежедневно. ~ 10-15% от ССМР" },
    { feat: "Лабораторный анализ", note: "Каждый материал проходит экспертизу аутентичности. 200-500 тыс. тг на анализ" },
    { feat: "Документирование", note: "Фото-/видео-/3D-фиксация каждого этапа. Архив на 50+ лет" },
    { feat: "Согласования", note: "Минкультуры РК + ICOMOS (для ЮНЕСКО) + местный акимат. 60-180 дней" },
    { feat: "Лицензия СМР + спец.раздел", note: "Подрядчик должен иметь лицензию «Реставрация памятников», не любой СМР подойдёт" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Реставрация памятников</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🏛️ Реставрация памятников архитектуры
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            Реставрация — <strong className="text-amber-300">особая отрасль</strong>
            строительства, где главная задача не «построить дешевле», а «сохранить как
            можно больше оригинала». В РК ~ 11 000 памятников, из них 5 объектов
            Всемирного наследия ЮНЕСКО (Ясави, Тамгалы, Сары-Арка, Западный Тянь-Шань,
            Шёлковый путь). Регулируется ЗРК «Об охране и использовании историко-культурного
            наследия» от 2.07.1992 № 1488 + СНиП РК 1.04-25 + международная Венецианская
            хартия (1964).
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Памятников в РК</div>
              <div className="text-slate-300">~ 11 000 + 5 ЮНЕСКО + 200 в Алматы</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Норматив РК</div>
              <div className="text-slate-300">СНиП РК 1.04-25 (Реставрация)</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Стоимость</div>
              <div className="text-slate-300">×1.5-3 к обычной смете + 10-15% АН</div>
            </div>
          </div>
        </section>

        {/* Section 1: 6 памятников */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🏺 Section 1. Шесть знаковых объектов РК
          </h2>
          <div className="space-y-3">
            {monuments.map((m) => (
              <div key={m.name} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
                <div className="flex items-baseline justify-between gap-4 mb-2">
                  <h3 className="text-base font-semibold text-amber-300">{m.name}</h3>
                  <span className="text-xs text-amber-400 italic shrink-0">{m.year}</span>
                </div>
                <dl className="text-sm space-y-1.5">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Статус</dt>
                    <dd className="text-slate-300 text-xs">{m.status}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Проект</dt>
                    <dd className="text-slate-300 text-xs">{m.project}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Сложности</dt>
                    <dd className="text-rose-300 text-xs">{m.challenges}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Методы</dt>
                    <dd className="text-emerald-300 text-xs italic">{m.methods}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Этапы */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🪜 Section 2. Восемь этапов реставрации
          </h2>
          <div className="space-y-3">
            {stages.map((s) => (
              <div key={s.n} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40 flex gap-4">
                <div className="text-3xl font-bold text-amber-400 w-12 text-center shrink-0">{s.n}</div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-slate-100 mb-1">{s.name}</h3>
                  <dl className="text-sm space-y-1">
                    <div>
                      <dt className="text-slate-500 text-xs uppercase tracking-wider">Содержание</dt>
                      <dd className="text-slate-300 text-xs">{s.what}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 text-xs uppercase tracking-wider">Кто исполняет</dt>
                      <dd className="text-amber-300 text-xs italic">{s.who}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Особенности смет */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            💎 Section 3. Особенности сметы на реставрацию
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {features.map((f) => (
              <div key={f.feat} className="border border-amber-800/40 bg-amber-950/20 rounded-lg p-4">
                <h3 className="font-semibold text-amber-300 mb-2 text-sm">{f.feat}</h3>
                <p className="text-xs text-slate-300">{f.note}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: Принципы Венецианской хартии */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📜 Section 4. Принципы Венецианской хартии (1964)
          </h2>
          <div className="border border-amber-800/60 bg-amber-950/30 rounded-xl p-5">
            <h3 className="text-amber-300 font-semibold mb-3">Семь принципов реставрации (международный стандарт)</h3>
            <ol className="text-sm space-y-2 text-slate-300 list-decimal list-inside">
              <li><strong>Минимальное вмешательство</strong> — реставратор обязан сохранить максимум оригинала</li>
              <li><strong>Обратимость</strong> — все вмешательства должны быть обратимыми (новое можно снять без повреждения оригинала)</li>
              <li><strong>Различимость</strong> — новое не должно выдаваться за оригинал, должно быть отличимо при близком осмотре</li>
              <li><strong>Подлинность материалов</strong> — традиционные технологии и материалы предпочтительнее современных</li>
              <li><strong>Документация</strong> — каждое действие должно быть задокументировано для будущих поколений</li>
              <li><strong>Уважение к историческим напластованиям</strong> — добавления разных эпох имеют ценность, нельзя «вернуть» к одной эпохе</li>
              <li><strong>Профессионализм</strong> — только квалифицированные реставраторы с лицензиями</li>
            </ol>
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Section 5. Упражнения</h2>

          {/* Упр.1 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Лицензия для реставрации
            </div>
            <div className="text-slate-200 mb-4">
              ТОО планирует получить контракт на реставрацию мечети XIX в. в Алматы
              (памятник местного значения). Какая лицензия <strong>обязательна</strong>?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Обычная СМР-лицензия I-III категории — её достаточно" },
                { v: "b", t: "Никакой — это памятник, особый порядок" },
                { v: "c", t: "Специальная лицензия «Реставрация объектов историко-культурного наследия» от МИИР РК + СМР-лицензия" },
                { v: "d", t: "Только лицензия Минкультуры РК" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1 === opt.v ? "border-amber-600 bg-amber-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-amber-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex1Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — спец. лицензия + СМР</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-amber-300">Решение:</strong> Для работ на памятниках
                требуется специальная лицензия (Закон РК «О лицензировании», подкласс
                «Реставрация»). Получается через МИИР РК + Комитет по охране историко-
                культурного наследия Минкультуры РК. Требования:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Реставратор-руководитель проекта с дипломом и стажем ≥ 5 лет</li>
                  <li>Сертифицированные мастера-реставраторы по специализациям
                  (камень, дерево, керамика, металл)</li>
                  <li>Лабораторное оборудование или договор с реставрационной лабораторией</li>
                  <li>Архитектор-реставратор в штате</li>
                </ul>
                Стоимость лицензии — 50-150 тыс. тг (через elicense.kz). Срок действия —
                3 года. Без этой лицензии работы будут признаны незаконными, объект
                переходит в категорию «незащищённый» с возможным штрафом 100-1000 МРП
                и уголовным делом по ст. 200 УК РК (Умышленное уничтожение или повреждение
                памятников).
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Принцип обратимости
            </div>
            <div className="text-slate-200 mb-4">
              По Венецианской хартии (1964) — основному международному стандарту
              реставрации — что означает принцип <strong>обратимости</strong> вмешательств?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Реставрационные работы можно отменить через суд" },
                { v: "b", t: "Все добавленные элементы должны быть такими, чтобы их можно было удалить в будущем без повреждения оригинала" },
                { v: "c", t: "Реставрация должна быть быстрой и обратной во времени" },
                { v: "d", t: "Можно использовать только переработанные материалы" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex2 === opt.v ? "border-amber-600 bg-amber-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex2" value={opt.v} checked={ex2 === opt.v} onChange={() => setEx2(opt.v)} className="accent-amber-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex2Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — удаление без повреждения оригинала</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-amber-300">Решение:</strong> Принцип обратимости —
                ключевой в современной реставрации. Любые добавления, заполнения, усиления
                должны быть выполнены так, чтобы будущий реставратор (через 50-100 лет, с
                новыми технологиями) мог их удалить без повреждения исторического
                оригинала. Примеры:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Заполнение трещин — обратимым раствором (синтетическим), не цементом
                  (который нельзя удалить)</li>
                  <li>Дублирование живописи — на отдельной паусной бумаге, а не прямо на
                  оригинале</li>
                  <li>Усиление балки — съёмными скобами, не приклеиванием эпоксидной</li>
                  <li>Чистка фасада — реверсивными растворителями, не кислотами</li>
                </ul>
                Этот принцип отличает <strong>реставрацию</strong> от <strong>реконструкции</strong>
                и <strong>ремонта</strong>. Современные реставраторы говорят: «Лучше ничего
                не делать, чем сделать необратимое».
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Расценка с надбавками
            </div>
            <div className="text-slate-200 mb-4">
              Базовая расценка на кладку из кирпича: <strong>5 000 тг/м²</strong>. Объект
              — памятник, реставрация по СНиП РК 1.04-25. Применяются:
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li><strong>К_рест = 1.5</strong> — надбавка за реставрационный труд</li>
                <li><strong>К_р = 1.3</strong> — региональный коэф. на ручной труд</li>
                <li><strong>К_з = 1.2</strong> — зимняя надбавка</li>
              </ul>
              <p className="mt-2">Чему равна <strong>итоговая</strong> расценка в тенге за 1 м²?</p>
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Расценка, тг/м²</span>
              <input value={ex3} onChange={(e) => setEx3(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="11700" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 11 700 тг/м²</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-amber-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Расценка_итог = База × К_рест × К_р × К_з
              = 5 000 × 1.5 × 1.3 × 1.2
              = 5 000 × 2.34
              = 11 700 тг/м²

ОБОСНОВАНИЕ НАДБАВОК:

К_рест = 1.5 (СНиП РК 1.04-25)
  Реставрация в 2-3 раза медленнее обычной кладки:
  • Подбор кирпичей по цвету и фактуре
  • Аутентичная швовка извёсткой
  • Минимум техники, всё руками
  • Авторский надзор реставратора

К_р = 1.3 (ручной труд)
  Без бетоновозов, миксеров, краны — всё носят руками.
  Дополнительный труд = надбавка.

К_з = 1.2 (зимняя работа)
  Если работы ведутся в холодное время:
  • Прогрев растворов
  • Тепловые «времянки»
  • Снижение производительности

Удорожание относительно обычной кладки: 11 700 / 5 000 = 2.34×
Это типично для реставрации (2-3 раза дороже обычного строительства).

Итого 200 м² стен:
11 700 × 200 = 2 340 000 тг + НР 11% + СП 8% = ~ 2.85 млн тг`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — ЮНЕСКО-объект
            </div>
            <div className="text-slate-200 mb-4">
              На объекте Всемирного наследия ЮНЕСКО (например, Мавзолее Ходжи Ахмеда Ясави)
              нужно провести реставрационные работы. Какая <strong>дополнительная
              сертификация</strong> сверх национальной требуется?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Никакой — национальной экспертизы достаточно" },
                { v: "b", t: "Просто согласование с местным акиматом" },
                { v: "c", t: "Только согласие Минкультуры РК" },
                { v: "d", t: "Согласование с ICOMOS (Международный совет по сохранению памятников) — экспертиза проекта международным комитетом, ежегодные мониторинговые отчёты для ЮНЕСКО, риск исключения из Списка при нарушениях" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex4 === opt.v ? "border-amber-600 bg-amber-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex4" value={opt.v} checked={ex4 === opt.v} onChange={() => setEx4(opt.v)} className="accent-amber-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex4Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — ICOMOS + ЮНЕСКО</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-amber-300">Решение:</strong> Объекты Всемирного
                наследия ЮНЕСКО находятся под международным надзором. Любые
                реставрационные работы должны:
                <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
                  <li>Согласовываться с ICOMOS (International Council on Monuments and
                  Sites) — консультативный орган ЮНЕСКО</li>
                  <li>Проходить экспертизу международного комитета (3-5 экспертов из
                  разных стран)</li>
                  <li>Соответствовать «Управляющему плану объекта» (Management Plan),
                  утверждённому при включении в Список</li>
                  <li>Подавать ежегодные отчёты State of Conservation Report</li>
                  <li>Не нарушать «выдающуюся универсальную ценность» (OUV — Outstanding
                  Universal Value)</li>
                </ol>
                Прецеденты: в 2009 г. Дрезденская долина Эльбы исключена из ЮНЕСКО из-за
                строительства моста. Для Туркестана/Тамгалы это означает повышенные
                требования к каждому шагу. ICOMOS-эксперт стоит ~ 500-1500 € в день,
                поездки на объект 2-4 раза в год. Это удорожает реставрационный проект
                на 5-10% (но при этом сохраняет статус ЮНЕСКО — а это туристический поток
                на миллионы $ в год).
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          СНиП РК 1.04-25 (Реставрация памятников). ЗРК «Об охране и использовании
          историко-культурного наследия» от 2.07.1992 № 1488. Венецианская хартия
          (ICOMOS, 1964). Конвенция ЮНЕСКО об охране Всемирного культурного и природного
          наследия (1972). Институт археологии им. А.Х. Маргулана РК. ICOMOS Kazakhstan —
          icomos.kz.
        </div>
      </main>
    </div>
  );
}
