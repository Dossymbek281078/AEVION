"use client";

import Link from "next/link";
import { useState } from "react";

export default function SpecialtyConstructionPage() {
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
    // V плотины = 50 × 200 × 30 = 300 000 м³
    const v = parseFloat(ex3);
    if (!isFinite(v)) return setEx3Res("bad");
    setEx3Res(Math.abs(v - 300_000) <= 10_000 ? "ok" : "bad");
  };
  const checkEx4 = () => setEx4Res(ex4 === "d" ? "ok" : "bad");

  const branches = [
    {
      name: "Промышленное строительство",
      objects: "Заводы, цеха, склады, элеваторы, ТЭЦ, ГРЭС, металлургия",
      norms: "СП РК 5.04-23 (стальные констр.), СНиП РК 2.10-04 (промбезопасность)",
      features: "Большие пролёты (до 60 м), краны Q-100 т, стальные фермы, сэндвич-панели",
      esn: "ЭСН Сб.9 (стальные), Сб.10 (деревянные), Сб.36-41 (оборудование)",
      example: "ТЭЦ-3 Караганда, цементный завод Састобе, металлургия АрселорМиттал Темиртау",
      cost: "150-300 тыс. тг/м² (цех) до 500 тыс. тг/м² (с оборудованием)",
    },
    {
      name: "Гидротехническое строительство",
      objects: "Плотины, ГЭС, водохранилища, каналы, шлюзы, набережные, очистные",
      norms: "СНиП РК 3.04-01 (гидротехнич.), СП РК 4.01-43 (вод. сооружения)",
      features: "Гидроизоляция, бетон высокой марки (B30-B50), сваи в воде, водолазные работы",
      esn: "ЭСН Сб.42 (гидротехнич.), Сб.45 (водолазные), Сб.4 (сваи)",
      example: "Бухтарминская ГЭС, Капшагай ГЭС, Шардаринское водохранилище, БТО Туркестан",
      cost: "200-500 тыс. тг/м³ ж/б плотины (с гидроизоляцией)",
    },
    {
      name: "Аграрное / агропромышленное",
      objects: "Фермы, теплицы, элеваторы, силосы, овощехранилища, переработка",
      norms: "СНиП РК 2.10-05 (сельскохозяйственные)",
      features: "Антикоррозионная защита, климат-системы, спец. вентиляция, биобезопасность",
      esn: "ЭСН Сб.10 (деревянные), Сб.36 (вентиляция), Сб.43 (специальные)",
      example: "Молочные комплексы BI Group Agro, теплицы Greenhouses Kz, элеваторы Алибек",
      cost: "100-220 тыс. тг/м² (склад) до 400 тыс. тг/м² (с молочным оборудованием)",
    },
    {
      name: "Энергетическое строительство",
      objects: "Подстанции, ЛЭП, ВЭС, СЭС, ГТУ, ПС-500 кВ",
      norms: "СН РК 4.04-23, ПУЭ-7 (Правила электроустановок), ПОТ Энергонадзор",
      features: "Заземление, молниезащита, защита от КЗ, высоковольтное оборудование",
      esn: "ЭСН Сб.33-35 (электромонтажные), Сб.41 (силовое оборудование)",
      example: "ВЛ-500 кВ Экибастуз-Шу, СЭС «Самрук Энерго» 100 МВт, ВЭС Ерейментау 50 МВт",
      cost: "1 МВт СЭС ≈ 1.2-1.8 млн $ под ключ, 1 км ВЛ-500 кВ ≈ 300-500 млн тг",
    },
    {
      name: "Нефтегазовое строительство",
      objects: "Скважины, насосные станции, нефтепроводы, НПЗ, газовые компрессорные",
      norms: "СН РК 4.04-12 (нефтепроводы), ОТП Роснефть/КазМунайГаз",
      features: "Спец. сварка, рентген 100% швов, антикоррозия, взрывозащита",
      esn: "ЭСН Сб.24 (наружные сети), Сб.32 (нефтегаз.), Сб.41 (оборудование)",
      example: "Тенгиз FGP, Кашаган, нефтепровод КТК, газопровод Бейнеу-Бозой-Шымкент",
      cost: "1 км магистр. нефтепр. Ø1000 — 600 млн - 1.2 млрд тг (в зав. от условий)",
    },
    {
      name: "Транспортное (мосты, тоннели)",
      objects: "Мосты, путепроводы, тоннели, ж/д подъезды, метро",
      norms: "СНиП РК 5.04-01 (мосты), СНиП РК 5.05-01 (метро)",
      features: "Пилоны, ванты, специализир. бетон, ТБМ-щиты (для метро)",
      esn: "ЭСН Сб.30 (мосты), Сб.31 (метро), специализир. справочники КТЖ",
      example: "Мост через Иртыш (Усть-Каменогорск), путепроводы БАКАД, Алматинское метро",
      cost: "Мост через реку ~ 1-3 млрд тг/100 м, 1 км метро = 8-15 млрд тг",
    },
  ];

  const norms = [
    { code: "СНиП РК 2.10-04", title: "Промышленные здания", year: "2002* (актуализация 2018)" },
    { code: "СНиП РК 3.04-01", title: "Гидротехнические сооружения", year: "2002*" },
    { code: "СНиП РК 2.10-05", title: "Сельскохозяйственные здания", year: "2002" },
    { code: "СН РК 4.04-23", title: "Электроустановки и подстанции", year: "2015*" },
    { code: "СН РК 4.04-12", title: "Магистральные нефтепроводы", year: "2014" },
    { code: "СНиП РК 5.04-01", title: "Мосты и трубы", year: "2003*" },
    { code: "СНиП РК 5.05-01", title: "Метрополитены", year: "2003" },
    { code: "ПУЭ-7", title: "Правила устройства электроустановок", year: "2003 (ред. 2019)" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Спец. строительство</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🏭 Специализированное строительство
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            Кроме типового жилья и общественных зданий, сметчик может специализироваться
            в узких отраслях: <strong className="text-stone-300">промышленное, гидротехническое,
            аграрное, энергетическое, нефтегазовое, транспортное</strong>. Каждая отрасль
            имеет свои нормативы, расценки, специфику работ, требования к персоналу и
            особый порядок ценообразования. Сметчик специализированной отрасли получает
            +30-70% к зарплате относительно общего профиля.
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Отраслей в РК</div>
              <div className="text-slate-300">6 основных + смежные</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Премия за специализацию</div>
              <div className="text-slate-300">+30-70% к зарплате общего сметчика</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Срок переквалификации</div>
              <div className="text-slate-300">6-18 мес. (нормы + 1-2 проекта)</div>
            </div>
          </div>
        </section>

        {/* Section 1: 6 отраслей */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🏗 Section 1. Шесть специализированных отраслей
          </h2>
          <div className="space-y-3">
            {branches.map((b) => (
              <div key={b.name} className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
                <h3 className="text-lg font-semibold text-stone-300 mb-3">{b.name}</h3>
                <dl className="text-sm grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Объекты</dt>
                    <dd className="text-slate-300 text-xs">{b.objects}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Нормативы</dt>
                    <dd className="text-slate-300 text-xs">{b.norms}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Особенности</dt>
                    <dd className="text-slate-300 text-xs">{b.features}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Сборники ЭСН</dt>
                    <dd className="text-slate-400 text-xs">{b.esn}</dd>
                  </div>
                  <div className="md:col-span-2">
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Примеры РК</dt>
                    <dd className="text-amber-300 text-xs italic">{b.example}</dd>
                  </div>
                  <div className="md:col-span-2">
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Бенчмарк стоимости</dt>
                    <dd className="text-emerald-300 text-xs font-mono">{b.cost}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Нормативы */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📜 Section 2. Ключевые нормативы РК
          </h2>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-44">Код</th>
                  <th className="text-left px-4 py-3">Название</th>
                  <th className="text-left px-4 py-3 w-44">Год / Актуализация</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {norms.map((n) => (
                  <tr key={n.code} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 font-mono text-stone-300">{n.code}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{n.title}</td>
                    <td className="px-4 py-3 text-amber-300 text-xs">{n.year}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Особенности смет */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            ⚡ Section 3. Особенности смет в спец. отраслях
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-stone-800/60 bg-stone-950/30 rounded-xl p-4">
              <h3 className="text-base font-semibold text-stone-300 mb-2">📐 Большие пролёты (промбу.)</h3>
              <p className="text-sm text-slate-300">До 60 м без промежуточных опор. Требуют расчёта стальных ферм или предн. ж/б балок. Расценки ЭСН Сб.9 + спец. КМД (Конструкции металлические деталировочные).</p>
            </div>
            <div className="border border-stone-800/60 bg-stone-950/30 rounded-xl p-4">
              <h3 className="text-base font-semibold text-stone-300 mb-2">💧 Водолазные работы (гидро.)</h3>
              <p className="text-sm text-slate-300">ЭСН Сб.45 + надбавка 50-100% к ОТ. Требуется СО лицензия водолаза, штат водолазной службы, оборудование (декомпрессионные камеры).</p>
            </div>
            <div className="border border-stone-800/60 bg-stone-950/30 rounded-xl p-4">
              <h3 className="text-base font-semibold text-stone-300 mb-2">⚡ Высокое напряжение (энерг.)</h3>
              <p className="text-sm text-slate-300">Допуск 1-5 группа по электробезопасности. ПОТ Энергонадзор. Двойная проверка фаз и заземления. Учёт стоимости отключения сети.</p>
            </div>
            <div className="border border-stone-800/60 bg-stone-950/30 rounded-xl p-4">
              <h3 className="text-base font-semibold text-stone-300 mb-2">🔥 Сварка нефтегаз</h3>
              <p className="text-sm text-slate-300">Сварщики 5-6 разряда с НАКС-сертификатом. 100% рентген швов. Дороже обычной сварки в 3-5 раз. Учёт в смете отдельной строкой.</p>
            </div>
            <div className="border border-stone-800/60 bg-stone-950/30 rounded-xl p-4">
              <h3 className="text-base font-semibold text-stone-300 mb-2">🚇 ТБМ-щит (метро)</h3>
              <p className="text-sm text-slate-300">Тоннелепроходческий щит — оборудование на сотни миллионов $. В смете отдельно: аренда, амортизация, наладка, обслуживание, бригада операторов.</p>
            </div>
            <div className="border border-stone-800/60 bg-stone-950/30 rounded-xl p-4">
              <h3 className="text-base font-semibold text-stone-300 mb-2">🌾 Климат-системы (аграр.)</h3>
              <p className="text-sm text-slate-300">Микроклимат для коров, кур, теплиц. Спец. вентиляция с подогревом + поилки, кормораздатчики. ЭСН Сб.36 + смета на оборудование 30-50% от ССМР.</p>
            </div>
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Section 4. Упражнения</h2>

          {/* Упр.1 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Норматив для ТЭЦ
            </div>
            <div className="text-slate-200 mb-4">
              Сметчик готовит смету на строительство ТЭЦ в Караганде (промышленный объект
              с теплосиловым оборудованием). Какой <strong>основной</strong> нормативный
              документ применяется?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "СНиП РК 2.04-21 (Энергопотребление) — он касается зданий" },
                { v: "b", t: "СНиП РК 5.04-01 (Мосты и трубы)" },
                { v: "c", t: "СНиП РК 2.10-04 (Промышленные здания) + СН РК 4.04-23 (Электроустановки) + специальные нормативы Энергонадзора" },
                { v: "d", t: "Только нормативы Россатома" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1 === opt.v ? "border-stone-600 bg-stone-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-stone-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-stone-600 hover:bg-stone-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex1Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — комплекс нормативов</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-stone-300">Решение:</strong> ТЭЦ — комплексный
                объект, объединяющий промышленное здание + энергоустановки. Применяется:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>СНиП РК 2.10-04 — для конструктивной части (здание машзала, цехов)</li>
                  <li>СН РК 4.04-23 — для электрической части (КРУ, генераторы, ВЛ)</li>
                  <li>ПУЭ-7 — общие требования по электроустановкам</li>
                  <li>ПОТ Энергонадзор — спец. требования при работах на действ. сетях</li>
                  <li>Нормативы Минэнерго РК — отраслевые</li>
                </ul>
                Кроме того, для ТЭЦ требуется ОВОС (оценка воздействия на окружающую среду)
                по Эколог. кодексу РК ст. 53. Сметчик должен ориентироваться во всём этом
                комплексе нормативов — это и есть «премиум» специализация (+50-70% к ЗП).
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Сварщики нефтегаз
            </div>
            <div className="text-slate-200 mb-4">
              На строительство магистрального нефтепровода Ø1000 мм требуются сварщики.
              Какой <strong>обязательный</strong> сертификат должны иметь сварщики, чтобы
              их работа была принята?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Любой сертификат любого технического колледжа" },
                { v: "b", t: "Аттестация НАКС РК (Национальный агентство контроля сварки) для работ повышенной опасности" },
                { v: "c", t: "Только трудовая книжка с опытом 3+ года" },
                { v: "d", t: "Достаточно водительских прав и медкнижки" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex2 === opt.v ? "border-stone-600 bg-stone-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex2" value={opt.v} checked={ex2 === opt.v} onChange={() => setEx2(opt.v)} className="accent-stone-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-stone-600 hover:bg-stone-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex2Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — НАКС</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-stone-300">Решение:</strong> НАКС РК (Национальное
                агентство контроля сварки) — это аккредитованный орган, который аттестует
                сварщиков по различным типам сварки (РД, ПД, СД) и материалов (углеродистая,
                нержавеющая, цветные металлы). Для магистральных нефтепроводов требуется:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Уровень аттестации I-IV (для сварщиков-исполнителей)</li>
                  <li>Спец. отметка «магистральный трубопровод» (МП)</li>
                  <li>Допуск работы с конкретным диаметром (Ø500-1200)</li>
                  <li>Срок действия 2-3 года, потом переаттестация</li>
                </ul>
                В смете: ОТ сварщика-НАКС в 2-3 раза выше обычного. Также — 100% рентген швов
                (отдельная позиция, 8-12 тыс. тг/шов). Без НАКС сварщика подрядчик не сможет
                выйти на объект КазТрансОйл / КТК — это блокирующее требование.
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Объём плотины
            </div>
            <div className="text-slate-200 mb-4">
              Проектируется плотина: длина <strong>200 м</strong>, ширина основания
              <strong> 50 м</strong> (приведённая по трапеции), средняя высота
              <strong> 30 м</strong>. Какой объём бетона потребуется (приближенный
              расчёт, прямоугольное приближение)?
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">V бетона, м³</span>
              <input value={ex3} onChange={(e) => setEx3(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="300000" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-stone-600 hover:bg-stone-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 300 000 м³</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-stone-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`V = L × b_ср × h
  = 200 м × 50 м × 30 м
  = 300 000 м³ бетона

Стоимость (приближённо):
• Бетон B30 (для гидротехн. с водонепрониц.): 60 000 тг/м³
• 300 000 × 60 000 = 18 млрд тг — только бетон

С арматурой (140 кг/м³), опалубкой, гидроизоляцией,
работами:
≈ 200-300 тыс. тг/м³ → 60-90 млрд тг полная стоимость
тела плотины

Для сравнения:
• Бухтарминская ГЭС: V плотины ≈ 4.5 млн м³ = 90 раз больше
• Капшагай ГЭС: V плотины ≈ 1.8 млн м³

Гидроэнергетика — миллиардные суммы. Сметчик-гидротехник
работает с цифрами, которых в обычном строительстве не бывает.
Зарплата таких специалистов в 2-3 раза выше обычных.`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Выбор специализации
            </div>
            <div className="text-slate-200 mb-4">
              Молодой сметчик (3 года опыта) хочет специализироваться в наиболее
              <strong> перспективной</strong> отрасли РК на 2025-2030 гг. Что выбрать
              с учётом гос. программ и инвестиционных трендов?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Только жилое строительство — самый стабильный рынок" },
                { v: "b", t: "Аграрное — сельское хозяйство теряет популярность" },
                { v: "c", t: "Транспортное — мосты и дороги уже построены" },
                { v: "d", t: "Энергетика (ВИЭ — ВЭС/СЭС) + транспортное (БАКАД, метро) — программа развития «Зелёная экономика РК-2050» и инфраструктурные мегапроекты до 2030 г." },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex4 === opt.v ? "border-stone-600 bg-stone-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex4" value={opt.v} checked={ex4 === opt.v} onChange={() => setEx4(opt.v)} className="accent-stone-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-stone-600 hover:bg-stone-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex4Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — ВИЭ + инфраструктура</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-stone-300">Решение:</strong> На 2025-2030 в РК
                действует ряд гос. программ, создающих устойчивый спрос на спец. сметчиков:
                <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
                  <li><strong>«Зелёная экономика РК-2050»</strong> — цель 50% ВИЭ к 2050.
                  Бюджет на новые ВЭС/СЭС — 25 млрд $ до 2030</li>
                  <li><strong>«Транспортная инфраструктура 2030»</strong> — БАКАД (Большая
                  Алматинская кольцевая), метро Алматы расширение, мосты в Шымкенте, Ёскемене</li>
                  <li><strong>«Нурлы Жол»</strong> — продолжение модернизации автомагистралей</li>
                  <li><strong>Нефтегаз</strong> — Тенгиз FGP, расширение Кашагана, новые
                  газопроводы (Бейнеу-Бозой-Шымкент-2)</li>
                  <li><strong>Аграрный сектор</strong> — субсидии на молочные комплексы,
                  теплицы, элеваторы (программа «Агро 2030»)</li>
                </ol>
                Жилое строительство — стабильный, но с переизбытком сметчиков (5000+ в РК).
                Энергетика, транспорт, нефтегаз — дефицитные специальности (~ 300-500 чел.
                на всю страну), зарплаты в 1.5-3 раза выше.
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          СНиП РК 2.10-04, 3.04-01, 2.10-05, 5.04-01, 5.05-01. СН РК 4.04-23, 4.04-12.
          ПУЭ-7. НАКС РК. Госпрограммы: «Нурлы Жол» 2020-2025, «Зелёная экономика РК-2050»,
          «Транспортная инфраструктура 2030». Примеры — KazMunayGas, KEGOC, КТЖ, СК «Самрук-
          Энерго», BI Group Agro.
        </div>
      </main>
    </div>
  );
}
