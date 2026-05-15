"use client";

import Link from "next/link";
import { useState } from "react";

export default function MiningQuarryPage() {
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

  const checkEx1 = () => setEx1Res(ex1 === "b" ? "ok" : "bad");
  const checkEx2 = () => setEx2Res(ex2 === "c" ? "ok" : "bad");
  const checkEx3 = () => {
    const v = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
    if (!isFinite(v)) return setEx3Res("bad");
    setEx3Res(Math.abs(v - 12500000) <= 1000000 ? "ok" : "bad");
  };
  const checkEx4 = () => setEx4Res(ex4 === "d" ? "ok" : "bad");

  const miningTypes = [
    {
      type: "Открытая (карьер)",
      design: "Извлечение пород уступами сверху вниз, вскрыша + добыча",
      use: "Известняк, гранит, ЖРС, уголь Экибастуза, медная руда (глубина до 600 м)",
    },
    {
      type: "Подземная (шахта)",
      design: "Шахтные стволы, штреки, лавы; камерно-столбовая или длинными забоями",
      use: "Уголь Караганды, медь Жезказгана, золото Васильковское, хромиты Хромтау",
    },
    {
      type: "Скважинная (СГД)",
      design: "Бурение скважин, выщелачивание реагентом, откачка раствора",
      use: "Уран Степногорска и Кызылорды (РК — мировой лидер по добыче ISL-методом)",
    },
    {
      type: "Россыпная",
      design: "Драги, промывочные приборы по руслам рек и поймам",
      use: "Золото Калбы, Алтая; платина — небольшие месторождения",
    },
    {
      type: "Дражная намывная",
      design: "Гидромониторы размывают породу, пульпа поступает на промывку",
      use: "Россыпи драгоценных металлов, отработка хвостохранилищ",
    },
  ];

  const excavators = [
    { model: "ЭКГ-12 (Уралмаш)", bucket: "12 м³", weight: "660 т", note: "Базовая модель для средних карьеров РК" },
    { model: "ЭКГ-15", bucket: "15 м³", weight: "720 т", note: "ССГПО, Качарский карьер" },
    { model: "ЭКГ-20", bucket: "20 м³", weight: "1 100 т", note: "Богатырь Аксесс Комир (Экибастуз)" },
    { model: "Komatsu PC8000", bucket: "42 м³", weight: "770 т", note: "Импорт, КАЗ Минералс Бозшаколь" },
    { model: "Caterpillar 6060", bucket: "34 м³", weight: "600 т", note: "Альтернатива Komatsu" },
  ];

  const dumpTrucks = [
    { model: "БелАЗ 7530", capacity: "200 т", note: "Универсальный карьерный самосвал" },
    { model: "БелАЗ 7555", capacity: "55–60 т", note: "Средний класс, для малых карьеров" },
    { model: "БелАЗ 75710", capacity: "450 т", note: "Самый большой в мире, рекорд (Якутия, ССГПО тестировал)" },
    { model: "Komatsu 930E", capacity: "320 т", note: "Электромеханический привод" },
    { model: "Caterpillar 797F", capacity: "400 т", note: "Дизель-механическая трансмиссия" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/smeta-trainer/drawings-practice"
            className="text-sm text-blue-300 hover:text-blue-200 transition"
          >
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Горнодобывающие работы</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            ⛏️ Горнодобывающие работы (карьеры, разрезы)
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            Горнодобывающая отрасль — основа экономики РК (≈ <strong className="text-blue-300">14% ВВП</strong>{" "}
            и более половины экспорта). Сметчик в горно-капитальном строительстве работает с
            нестандартными объёмами: миллионы кубометров вскрыши, десятки километров
            технологических дорог, отвалы высотой 100–200 м, хвостохранилища площадью сотни
            гектаров. Главные нормативы РК — СНиП РК 3.06-12 (горно-капитальные работы),
            СН РК 3.04-15 (отвалы и хвостохранилища), Земельный кодекс ст. 107–108
            (рекультивация).
          </p>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-blue-900/40 rounded-lg p-3 bg-blue-950/20">
              <div className="text-blue-500 uppercase tracking-wider mb-1">Объёмы вскрыши</div>
              <div className="text-slate-300">Десятки млн м³/год на крупный карьер</div>
            </div>
            <div className="border border-blue-900/40 rounded-lg p-3 bg-blue-950/20">
              <div className="text-blue-500 uppercase tracking-wider mb-1">Самосвалы</div>
              <div className="text-slate-300">БелАЗ 130–450 т грузоподъёмность</div>
            </div>
            <div className="border border-blue-900/40 rounded-lg p-3 bg-blue-950/20">
              <div className="text-blue-500 uppercase tracking-wider mb-1">Нормативная база РК</div>
              <div className="text-slate-300">СНиП РК 3.06-12, СН РК 3.04-15, ЗК РК ст. 107–108</div>
            </div>
          </div>
        </section>

        {/* Раздел 1 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-blue-300">
            📊 Раздел 1. Открытая vs подземная разработка
          </h2>
          <p className="text-sm text-slate-400">
            Выбор способа добычи определяется глубиной залегания, мощностью пласта,
            горно-геологическими условиями и коэффициентом вскрыши (м³ пустой породы на
            тонну полезного ископаемого).
          </p>
          <div className="overflow-x-auto border border-blue-900/30 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-48">Способ разработки</th>
                  <th className="text-left px-4 py-3">Технология</th>
                  <th className="text-left px-4 py-3">Применение в РК</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {miningTypes.map((r) => (
                  <tr key={r.type} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 font-bold text-blue-300 text-sm whitespace-nowrap">
                      {r.type}
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{r.design}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{r.use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 2 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-blue-300">
            🏗 Раздел 2. Этапы разработки карьера
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                icon: "1️⃣",
                title: "Вскрыша (overburden removal)",
                desc: "Удаление пустых пород над пластом полезного ископаемого. Самая объёмная стадия — на крупных карьерах коэффициент вскрыши 3–8 м³/т. Снимается плодородный слой (хранится отдельно для рекультивации), затем вскрышные породы экскаваторами и самосвалами. СНиП РК 3.06-12 раздел 4.",
              },
              {
                icon: "2️⃣",
                title: "Добыча полезного ископаемого",
                desc: "Извлечение руды/угля уступами высотой 10–15 м. Буровзрывные работы (БВР) для крепких пород: ВВ типа граммонит, эмульсионные ВВ. Уступы и съезды формируются под углом естественного откоса с запасом устойчивости.",
              },
              {
                icon: "3️⃣",
                title: "Отвалообразование",
                desc: "Складирование вскрышных пород и хвостов обогащения. Площадные отвалы (равнина) или террасные (склон). Высота отвалов — 60–200 м. Обязателен контроль устойчивости откосов и обвалование от ливневых стоков (СН РК 3.04-15).",
              },
              {
                icon: "4️⃣",
                title: "Рекультивация",
                desc: "Восстановление земель после отработки. Техническая (планировка, формирование рельефа) + биологическая (нанесение плодородного слоя, посев трав и саженцев). Обязательна по ст. 107–108 ЗК РК. Проект рекультивации утверждается заранее.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="border border-blue-900/30 bg-blue-950/10 rounded-xl p-5"
              >
                <h3 className="text-base font-semibold text-blue-300 mb-2">
                  {f.icon} {f.title}
                </h3>
                <p className="text-sm text-slate-300">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Раздел 3 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-blue-300">
            ⚙️ Раздел 3. Карьерные экскаваторы
          </h2>
          <p className="text-sm text-slate-400">
            Основной инструмент добычи — мощные электрические экскаваторы (ЭКГ —
            «экскаватор карьерный гусеничный»). На крупных карьерах работают круглосуточно,
            подавая руду в самосвалы.
          </p>
          <div className="overflow-x-auto border border-blue-900/30 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-52">Модель</th>
                  <th className="text-left px-4 py-3 w-32">Ёмкость ковша</th>
                  <th className="text-left px-4 py-3 w-32">Масса</th>
                  <th className="text-left px-4 py-3">Применение в РК</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {excavators.map((r) => (
                  <tr key={r.model} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 font-bold text-blue-300 text-sm whitespace-nowrap">
                      {r.model}
                    </td>
                    <td className="px-4 py-3 text-emerald-300 font-mono text-xs">
                      {r.bucket}
                    </td>
                    <td className="px-4 py-3 text-amber-300 font-mono text-xs">
                      {r.weight}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 4 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-blue-300">
            🚛 Раздел 4. Карьерные самосвалы
          </h2>
          <p className="text-sm text-slate-400">
            Транспортировка горной массы — БелАЗ (Беларусь) исторически доминирует на
            карьерах РК и СНГ; Komatsu и Caterpillar — на новых проектах с иностранным
            капиталом (Бозшаколь, Актогай).
          </p>
          <div className="overflow-x-auto border border-blue-900/30 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-44">Модель</th>
                  <th className="text-left px-4 py-3 w-40">Грузоподъёмность</th>
                  <th className="text-left px-4 py-3">Особенности</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {dumpTrucks.map((r) => (
                  <tr key={r.model} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 font-bold text-blue-300 text-sm whitespace-nowrap">
                      {r.model}
                    </td>
                    <td className="px-4 py-3 text-emerald-300 font-mono text-sm">
                      {r.capacity}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 5 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-blue-300">
            💧 Раздел 5. Гидротранспорт и хвостохранилища
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-blue-900/30 bg-blue-950/10 rounded-xl p-5">
              <h3 className="text-base font-semibold text-blue-300 mb-3">
                Пульпопроводы и шламохранилища
              </h3>
              <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
                <li>
                  Пульпопроводы Ø 500–1200 мм — стальные трубы с износостойкой
                  футеровкой (полиуретан, базальт)
                </li>
                <li>
                  Транспортировка хвостов обогащения с фабрики на хвостохранилище —
                  расстояние до 10–15 км
                </li>
                <li>
                  Шламовые насосы (грунтовые): подача 1000–5000 м³/ч, рабочее давление
                  до 6 МПа
                </li>
                <li>
                  Шламохранилища — гидротехнические сооружения 1–2 класса опасности, проект
                  по СН РК 3.04-15
                </li>
              </ul>
            </div>
            <div className="border border-slate-800 bg-slate-900/30 rounded-xl p-5">
              <h3 className="text-base font-semibold text-slate-300 mb-3">
                Дамбы хвостохранилищ
              </h3>
              <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
                <li>
                  Тип дамб: намывные (из хвостов же) или насыпные (из вскрышных пород)
                </li>
                <li>
                  Высота 30–80 м; угол откоса 1:3–1:4; гребень — техническая дорога
                </li>
                <li>
                  Противофильтрационное ядро (глина или геомембрана HDPE 1.5–2 мм)
                </li>
                <li>
                  Дренажная пригрузка (банкет) у подошвы — стабилизация и сбор фильтрата
                </li>
                <li>
                  Контроль КИА: пьезометры, реперы, профилирование. Регулярные расчёты
                  устойчивости методом Бишопа
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Раздел 6 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-blue-300">
            ⛰ Раздел 6. Отвалы вскрышных пород
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                icon: "📐",
                title: "Площадные отвалы",
                desc: "Размещаются на ровной поверхности. Высота 60–120 м, многоярусные с разделительными бермами. Угол откоса 35–37° для скальных пород, 27–30° для глинистых. Контроль устойчивости методом Феллениуса/Бишопа.",
              },
              {
                icon: "🏔",
                title: "Террасные (склоновые) отвалы",
                desc: "Формируются на склонах балок и оврагов. Опасны при дождях — возможны оползни. Обязательны нагорные канавы для перехвата ливневых стоков, ярусное обвалование. СН РК 3.04-15.",
              },
              {
                icon: "🌊",
                title: "Обвалование и водоотвод",
                desc: "По периметру отвала — нагорные канавы шириной 1.5–3 м, глубиной 1–2 м. Назначение: перехват поверхностного стока, предотвращение размыва откосов. Уклон 3–5‰, сброс в искусственные водосборники.",
              },
              {
                icon: "⚠",
                title: "Контроль устойчивости",
                desc: "Геодезический мониторинг марками-реперами (2–4 раза в год). Пьезометрические наблюдения за УГВ внутри тела отвала. Расчётный коэффициент запаса устойчивости — не менее 1.3 (для долговременных отвалов).",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="border border-blue-900/30 bg-blue-950/10 rounded-xl p-5"
              >
                <h3 className="text-base font-semibold text-blue-300 mb-2">
                  {f.icon} {f.title}
                </h3>
                <p className="text-sm text-slate-300">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Раздел 7 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-blue-300">
            🌱 Раздел 7. Рекультивация земель
          </h2>
          <p className="text-sm text-slate-400">
            Обязательное завершение горных работ. Регулируется ст. 107–108 Земельного
            кодекса РК и СНиП РК 3.06-12 раздел 9. Без утверждённого проекта рекультивации
            недропользователь не получает лицензию на добычу.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-blue-900/30 bg-blue-950/10 rounded-xl p-5">
              <h3 className="text-base font-semibold text-blue-300 mb-3">
                Этап 1. Техническая рекультивация
              </h3>
              <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
                <li>Планировка поверхности (выполаживание уступов до 18–20°)</li>
                <li>Формирование инженерного рельефа: водоотводные канавы, террасы</li>
                <li>
                  Закрытие техногенных пустот, ликвидация выработок (для безопасности)
                </li>
                <li>
                  Стоимость: 500–1500 тыс. тг/га (зависит от объёма земляных работ)
                </li>
              </ul>
            </div>
            <div className="border border-blue-900/30 bg-blue-950/10 rounded-xl p-5">
              <h3 className="text-base font-semibold text-blue-300 mb-3">
                Этап 2. Биологическая рекультивация
              </h3>
              <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
                <li>
                  Нанесение плодородного слоя — толщина <strong>0.3–0.5 м</strong>{" "}
                  (заранее снятого и складированного)
                </li>
                <li>Внесение минеральных и органических удобрений</li>
                <li>Посев многолетних трав, посадка кустарников/саженцев</li>
                <li>3–5 лет агротехнического ухода после посева</li>
                <li>
                  Стоимость: 300–1000 тыс. тг/га (бóльшая часть — плодородный грунт)
                </li>
              </ul>
            </div>
          </div>
          <div className="border border-blue-900/20 bg-blue-950/10 rounded-xl p-4 text-sm">
            <strong className="text-blue-300">Сводная стоимость рекультивации в РК (2024–2025):</strong>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
              {[
                ["Только техническая", "500–1 500 тыс. тг/га", "Карьеры с малым объёмом нарушений"],
                ["Только биологическая", "300–1 000 тыс. тг/га", "Если рельеф уже сформирован"],
                ["Комплексная (тех. + био.)", "800–2 500 тыс. тг/га", "Стандарт для крупных карьеров и разрезов"],
              ].map(([type, price, note]) => (
                <div
                  key={type}
                  className="border border-blue-900/30 rounded-lg p-3 bg-slate-900/40"
                >
                  <div className="text-blue-300 font-semibold text-xs mb-1">{type}</div>
                  <div className="font-mono text-emerald-300 text-sm">{price}</div>
                  <div className="text-xs text-slate-500 mt-1 italic">{note}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Раздел 8 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-blue-300">
            🇰🇿 Раздел 8. Бенчмарки горнодобычи в РК
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                icon: "⛏",
                title: "ССГПО (Соколовско-Сарбайское)",
                desc: "Костанайская обл., Рудный. Крупнейший в РК производитель ЖРС (железорудный концентрат). Карьеры: Сарбайский, Качарский, Соколовский — глубина до 500 м. Экскаваторы ЭКГ-12/15, БелАЗ 130–220 т.",
              },
              {
                icon: "🔥",
                title: "Богатырь Аксесс Комир (Экибастуз)",
                desc: "Крупнейший угольный разрез СНГ. Добыча 40+ млн т угля/год. Уникальная техника: роторные экскаваторы, конвейерные системы, БелАЗ-7530. Угол откоса бортов 35–40°, глубина 270 м.",
              },
              {
                icon: "🟢",
                title: "Казахмыс / КАЗ Минералс",
                desc: "Жезказган (медь, подземная), Бозшаколь и Актогай (медь, открытый способ). Бозшаколь — современный проект 2015 года, Komatsu PC8000 + Komatsu 930E, мощность 30 млн т руды/год.",
              },
              {
                icon: "💰",
                title: "Бенчмарки себестоимости",
                desc: "Вскрыша: 250–450 тг/м³ (зависит от расстояния транспортировки). Добыча угля открытым способом: 800–1500 тг/т. Добыча медной руды: 1500–3000 тг/т. БВР: 80–250 тг/м³ горной массы.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="border border-blue-900/30 bg-blue-950/10 rounded-xl p-5"
              >
                <h3 className="text-base font-semibold text-blue-300 mb-2">
                  {f.icon} {f.title}
                </h3>
                <p className="text-sm text-slate-300">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Упражнения</h2>

          {/* Упр. 1 */}
          <div className="border border-blue-900/30 rounded-xl p-5 bg-blue-950/10">
            <div className="text-xs text-blue-600 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Грузоподъёмность БелАЗ
            </div>
            <div className="text-slate-200 mb-4">
              Какая грузоподъёмность у карьерного самосвала БелАЗ 75710 (мировой рекорд)?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "130 т — базовая модель для средних карьеров" },
                { v: "b", t: "450 т — самый большой серийный самосвал в мире" },
                { v: "c", t: "220 т — стандарт для разрезов угля" },
                { v: "d", t: "800 т — рекорд для специальных проектов" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-start gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1 === opt.v
                      ? "border-blue-600 bg-blue-950/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex1"
                    value={opt.v}
                    checked={ex1 === opt.v}
                    onChange={() => setEx1(opt.v)}
                    className="accent-blue-500 mt-0.5"
                  />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={checkEx1}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded transition text-sm"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx1Sol((v) => !v)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm"
              >
                {ex1Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex1Res === "ok" && (
                <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">
                  ✅ Верно!
                </span>
              )}
              {ex1Res === "bad" && (
                <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">
                  ❌ Неверно — см. раздел 4
                </span>
              )}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-blue-300">Решение:</strong> Правильный ответ —{" "}
                <strong>б</strong>. БелАЗ 75710 — 450 т.
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>
                    Презентован в 2013 году, занесён в Книгу рекордов Гиннеса как
                    самый большой серийный самосвал
                  </li>
                  <li>
                    Двухмоторная схема: 2 дизеля по 2 300 л.с., электромеханическая
                    трансмиссия
                  </li>
                  <li>
                    Размеры: длина 20.6 м, ширина 9.87 м, высота 8.16 м; собственная масса 360 т
                  </li>
                  <li>
                    Стоимость новой машины: ≈ 6–8 млн USD; работает на ССГПО и в Якутии
                  </li>
                  <li>
                    Для сравнения: БелАЗ 7530 — 200 т (наиболее распространён в РК),
                    Komatsu 930E — 320 т
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Упр. 2 */}
          <div className="border border-blue-900/30 rounded-xl p-5 bg-blue-950/10">
            <div className="text-xs text-blue-600 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Что такое вскрыша
            </div>
            <div className="text-slate-200 mb-4">
              Что в горном деле называется «вскрышей» (overburden)?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Добыча полезного ископаемого — извлечение руды или угля из карьера" },
                { v: "b", t: "Отгрузка готовой продукции потребителю по железной дороге" },
                {
                  v: "c",
                  t: "Удаление пустых пород, лежащих над пластом полезного ископаемого, для обеспечения доступа к нему",
                },
                { v: "d", t: "Геологоразведка — бурение разведочных скважин для оценки запасов" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-start gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex2 === opt.v
                      ? "border-blue-600 bg-blue-950/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex2"
                    value={opt.v}
                    checked={ex2 === opt.v}
                    onChange={() => setEx2(opt.v)}
                    className="accent-blue-500 mt-0.5"
                  />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={checkEx2}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded transition text-sm"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx2Sol((v) => !v)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm"
              >
                {ex2Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex2Res === "ok" && (
                <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">
                  ✅ Верно!
                </span>
              )}
              {ex2Res === "bad" && (
                <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">
                  ❌ Неверно
                </span>
              )}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-blue-300">Решение:</strong> Правильный ответ —{" "}
                <strong>в</strong>. Вскрыша — это удаление пустых пород.
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>
                    Коэффициент вскрыши — м³ пустой породы на тонну полезного ископаемого;
                    для угля Экибастуза 3–5 м³/т, для меди Бозшаколь 6–8 м³/т
                  </li>
                  <li>
                    Вскрыша — самая объёмная стадия: на крупный карьер до 50–80 млн м³/год
                  </li>
                  <li>
                    Перед вскрышей снимается и складируется плодородный слой (для будущей
                    биологической рекультивации)
                  </li>
                  <li>
                    Себестоимость вскрыши в РК: 250–450 тг/м³ (зависит от расстояния
                    транспортировки во внешний/внутренний отвал)
                  </li>
                  <li>
                    Регулируется СНиП РК 3.06-12 раздел 4 «Горно-капитальные работы»
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Упр. 3 */}
          <div className="border border-blue-900/30 rounded-xl p-5 bg-blue-950/10">
            <div className="text-xs text-blue-600 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Стоимость рекультивации карьера
            </div>
            <div className="text-slate-200 mb-4">
              По проекту рекультивации необходимо восстановить отработанный карьер площадью{" "}
              <strong>5 га</strong>. Применяется комплексная рекультивация
              (техническая + биологическая) по бенчмарку РК <strong>2 500 тыс. тг/га</strong>.
              Рассчитайте стоимость работ в тенге.
            </div>
            <div className="text-xs text-slate-400 italic mb-3">
              💡 Стоимость = площадь (га) × удельная цена (тг/га)
            </div>
            <div className="flex gap-3 items-center flex-wrap">
              <input
                type="text"
                value={ex3}
                onChange={(e) => setEx3(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && checkEx3()}
                placeholder="Введите число (тг)..."
                className="flex-1 min-w-[200px] border border-slate-700 rounded px-3 py-2 text-sm font-mono bg-slate-900 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={checkEx3}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded transition text-sm"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx3Sol((v) => !v)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm"
              >
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {ex3Res === "ok" && (
              <p className="mt-3 text-emerald-300 text-sm">✅ Верно!</p>
            )}
            {ex3Res === "bad" && (
              <p className="mt-3 text-red-300 text-sm">❌ Неверно. Проверьте расчёт.</p>
            )}
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-blue-300">Решение:</strong> 5 га × 2 500 000 тг/га ={" "}
                <strong className="text-emerald-300">12 500 000 тг</strong> (12,5 млн тг).
                <p className="text-xs mt-2 text-slate-400">
                  Допуск ±1 000 000 тг. Бенчмарк 800–2500 тыс. тг/га — для комплексной
                  рекультивации (техническая планировка + нанесение плодородного слоя
                  0.3–0.5 м + посев трав + 3–5 лет агротехнического ухода). Верхний предел
                  применяется когда требуется большое количество завозного плодородного
                  грунта или сложный рельеф (террасные отвалы). На практике крупные
                  недропользователи РК (ССГПО, Богатырь, Казахмыс) формируют резервный
                  фонд рекультивации заранее — часть платежей за недропользование идёт в
                  целевой фонд.
                </p>
              </div>
            )}
          </div>

          {/* Упр. 4 */}
          <div className="border border-blue-900/30 rounded-xl p-5 bg-blue-950/10">
            <div className="text-xs text-blue-600 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Нормативная база рекультивации
            </div>
            <div className="text-slate-200 mb-4">
              Какой документ регламентирует рекультивацию карьера в Республике Казахстан?
            </div>
            <div className="space-y-2 text-sm">
              {[
                {
                  v: "a",
                  t: "Только СНиП РК 3.06-12 «Горно-капитальные работы» — определяет технические нормы",
                },
                {
                  v: "b",
                  t: "Только Земельный кодекс РК (ст. 107–108) — устанавливает обязанность рекультивации",
                },
                {
                  v: "c",
                  t: "Только утверждённый проект разработки месторождения — рекультивация в составе проекта",
                },
                {
                  v: "d",
                  t: "Комплекс документов: СНиП РК 3.06-12 + ЗК РК ст. 107–108 + утверждённый проект рекультивации, согласованный с уполномоченным органом",
                },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-start gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex4 === opt.v
                      ? "border-blue-600 bg-blue-950/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex4"
                    value={opt.v}
                    checked={ex4 === opt.v}
                    onChange={() => setEx4(opt.v)}
                    className="accent-blue-500 mt-0.5"
                  />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={checkEx4}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded transition text-sm"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx4Sol((v) => !v)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm"
              >
                {ex4Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex4Res === "ok" && (
                <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">
                  ✅ Верно!
                </span>
              )}
              {ex4Res === "bad" && (
                <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">
                  ❌ Неверно
                </span>
              )}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-blue-300">Решение:</strong> Правильный ответ —{" "}
                <strong>г</strong>. Регулирование комплексное.
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>
                    <strong>СНиП РК 3.06-12</strong> «Горно-капитальные работы» — раздел 9
                    устанавливает технические требования к рекультивации (этапы, толщина
                    плодородного слоя, углы откосов)
                  </li>
                  <li>
                    <strong>ЗК РК ст. 107–108</strong> — обязанность недропользователя
                    провести рекультивацию земель в исходное или согласованное состояние;
                    штрафы за нарушение
                  </li>
                  <li>
                    <strong>Проект рекультивации</strong> — обязательная часть проекта
                    разработки месторождения, утверждается одновременно с лицензией; без
                    него недропользователь не может начать добычу
                  </li>
                  <li>
                    Согласующие органы: Министерство экологии РК, акимат района
                    (землепользование), Министерство индустрии (горный надзор)
                  </li>
                  <li>
                    Контроль исполнения: ежегодные отчёты о выполнении этапов
                    рекультивации; финансовое обеспечение — банковская гарантия или
                    резервный фонд
                  </li>
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* Нормативная база */}
        <section className="border border-blue-900/20 bg-blue-950/10 rounded-xl p-5 space-y-2">
          <h2 className="text-base font-bold text-blue-300">
            📑 Расценки ЭСН РК (горнодобывающие работы)
          </h2>
          <ul className="text-xs text-slate-400 space-y-1.5">
            <li>
              <strong className="text-blue-300">ЭСН Сб.1 «Земляные работы»</strong> —
              разработка грунта экскаваторами карьерного класса, перевозка автосамосвалами
            </li>
            <li>
              <strong className="text-blue-300">ЭСН Сб.3 «Буровые работы»</strong> —
              бурение взрывных скважин, заряжание ВВ, взрывание
            </li>
            <li>
              <strong className="text-blue-300">ЭСН Сб.35 «Горнопроходческие работы»</strong>{" "}
              — проходка штреков, вскрытие месторождений
            </li>
            <li>
              <strong className="text-blue-300">СНиП РК 3.06-12 «Горно-капитальные работы»</strong>{" "}
              — нормы проектирования, технические требования к вскрыше, добыче, рекультивации
            </li>
            <li>
              <strong className="text-blue-300">СН РК 3.04-15</strong> — отвалы и хвостохранилища
              как гидротехнические сооружения
            </li>
            <li>
              <strong className="text-blue-300">Земельный кодекс РК ст. 107–108</strong> —
              обязанность рекультивации нарушенных земель
            </li>
          </ul>
        </section>

        {/* Факт сметчика */}
        <section className="bg-slate-900 border border-slate-700 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h3 className="text-sm font-bold mb-1 text-blue-300">Факт сметчика</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                В смете горно-капитального строительства самая массивная статья —{" "}
                <strong className="text-blue-300">транспортировка вскрыши</strong>. На
                крупном карьере (50 млн м³ вскрыши/год при бенчмарке 350 тг/м³) — это{" "}
                <strong>17,5 млрд тг/год</strong> только на самосвалах и топливе. Главная
                ошибка студента-сметчика — забыть про рекультивацию: статья «небольшая»
                (2–5% от стоимости разработки), но без неё проект не пройдёт экологическую
                экспертизу. ССГПО, например, формирует резервный фонд рекультивации с
                первого года добычи — это требование Минэкологии РК.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
