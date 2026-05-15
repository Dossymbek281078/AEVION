"use client";
import Link from "next/link";
import { useState } from "react";

export default function RailwaysStationsPage() {
  const [ex1, setEx1] = useState<string | null>(null);
  const [ex2, setEx2] = useState<string | null>(null);
  const [ex3, setEx3] = useState<string>("");
  const [ex3Checked, setEx3Checked] = useState(false);
  const [ex4, setEx4] = useState<string | null>(null);

  const ex3Target = 9_600_000_000_000;
  const ex3Tolerance = 800_000_000_000;
  const ex3Value = parseFloat(ex3.replace(/[\s_]/g, ""));
  const ex3Correct =
    !Number.isNaN(ex3Value) && Math.abs(ex3Value - ex3Target) <= ex3Tolerance;

  const optionClass = (
    state: string | null,
    value: string,
    correct: string,
  ) => {
    if (state === null) {
      return "border-slate-700 bg-slate-900/40 hover:border-blue-500/60 hover:bg-slate-800/60";
    }
    if (value === correct) {
      return "border-emerald-500/80 bg-emerald-900/30 text-emerald-100";
    }
    if (state === value) {
      return "border-rose-500/80 bg-rose-900/30 text-rose-100";
    }
    return "border-slate-800 bg-slate-900/30 text-slate-500";
  };

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
          <div className="text-xs text-slate-500">
            AEVION Smeta Trainer · Железные дороги и вокзалы
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🚂 Железные дороги и вокзалы
          </h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Железнодорожная инфраструктура — стратегически важный класс
            объектов для РК: магистрали КТЖ (полигон 16 тыс. км), новые
            пограничные коридоры (Достык, Алтынколь, Хоргос), проектируемая
            ВСМ Алматы–Астана. Сметчик работает с СНиП РК «Железные дороги
            колеи 1520 мм», нормативами КТЖ, ГОСТ 9238-2013 (габариты),
            проектами «Казжелдорпроект». В этом модуле разберём колею,
            рельсы, шпалы, балласт, земляное полотно, ИССО, электрификацию,
            станции, вокзалы и бенчмарки по РК.
          </p>
        </section>

        {/* Section 1: Track gauges */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">
            1. Ширина колеи (Track Gauge)
          </h2>
          <p className="mt-3 text-slate-400 leading-relaxed">
            Расстояние между внутренними гранями головок рельсов. В мире
            существует около 11 основных стандартов; Казахстан и весь
            постсоветский регион используют{" "}
            <span className="text-slate-200">1520 мм</span> (исторически —
            5 футов).
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm border border-slate-700">
              <thead className="bg-slate-800/60 text-slate-200">
                <tr>
                  <th className="text-left p-2 border-b border-slate-700">
                    Колея
                  </th>
                  <th className="text-left p-2 border-b border-slate-700">
                    Регион применения
                  </th>
                </tr>
              </thead>
              <tbody className="text-slate-400">
                <tr>
                  <td className="p-2 border-b border-slate-800">
                    <span className="text-slate-200">1520 мм</span> («русская»)
                  </td>
                  <td className="p-2 border-b border-slate-800">
                    РК, РФ, СНГ, Финляндия, Монголия
                  </td>
                </tr>
                <tr>
                  <td className="p-2 border-b border-slate-800">
                    1435 мм (стандартная / Stephenson)
                  </td>
                  <td className="p-2 border-b border-slate-800">
                    EU, КНР, США, Турция (~60% мировой сети)
                  </td>
                </tr>
                <tr>
                  <td className="p-2 border-b border-slate-800">
                    1668 мм (Iberian)
                  </td>
                  <td className="p-2 border-b border-slate-800">
                    Испания, Португалия
                  </td>
                </tr>
                <tr>
                  <td className="p-2">1067 мм (Cape gauge)</td>
                  <td className="p-2">Япония, ЮАР, Индонезия</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4 rounded-lg border border-amber-700/50 bg-amber-950/20 p-4 text-sm">
            <div className="text-amber-200 font-medium mb-1">
              Стыки с КНР — Достык / Алтынколь
            </div>
            <p className="text-slate-300">
              На пограничных переходах с Китаем (Достык–Алашанькоу,
              Алтынколь–Хоргос) применяется{" "}
              <span className="text-amber-200">перестановка тележек</span>{" "}
              вагонов с 1520 мм на 1435 мм — операция занимает 2–3 часа на
              состав. Альтернатива — раздвижные колёсные пары (SUW-2000) или
              перегрузка контейнеров.
            </p>
          </div>
        </section>

        {/* Section 2: Rails */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">
            2. Рельсы
          </h2>
          <div className="mt-3 grid md:grid-cols-3 gap-4 text-sm">
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
              <div className="text-slate-200 font-medium mb-2">Р50</div>
              <ul className="space-y-1 text-slate-400">
                <li>Масса ~ 51.7 кг/м</li>
                <li>Станционные и подъездные пути</li>
                <li>Малодеятельные линии</li>
              </ul>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
              <div className="text-slate-200 font-medium mb-2">
                Р65 (основной)
              </div>
              <ul className="space-y-1 text-slate-400">
                <li>Масса 64.7 кг/м</li>
                <li>Магистральные ж/д РК</li>
                <li>Сталь М76 / М76Т (термоупроч.)</li>
              </ul>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
              <div className="text-slate-200 font-medium mb-2">Р75</div>
              <ul className="space-y-1 text-slate-400">
                <li>Масса 74.4 кг/м</li>
                <li>ВСМ, тяжёлый грузопоток</li>
                <li>Магистрали с осевой нагрузкой 25+ тс</li>
              </ul>
            </div>
          </div>
          <p className="mt-4 text-slate-400 text-sm">
            Современный путь — <span className="text-slate-200">бесстыковой</span>{" "}
            (рельсовые плети длиной до 800 м, свариваемые алюмотермитной
            сваркой). Снижает износ подвижного состава на 15–25% и шум — до
            5 дБ. Температурный диапазон укладки плетей: −30 °C ÷ +35 °C
            (РК — особенно жёсткие требования из-за резкого континентального
            климата).
          </p>
        </section>

        {/* Section 3: Sleepers */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">
            3. Шпалы
          </h2>
          <div className="mt-3 grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
              <div className="text-slate-200 font-medium mb-2">
                Железобетонные предварительно напряжённые
              </div>
              <ul className="space-y-1 text-slate-400">
                <li>
                  Марки <span className="text-slate-200">Ш1 / Ш2 / Ш3</span>{" "}
                  (по типу скрепления — КБ, ЖБР, АРС)
                </li>
                <li>Длина 2.7 м, масса ~ 265 кг</li>
                <li>Срок службы 40–50 лет</li>
                <li>Главный тип для магистральных путей РК</li>
              </ul>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
              <div className="text-slate-200 font-medium mb-2">
                Деревянные (сосна / лиственница)
              </div>
              <ul className="space-y-1 text-slate-400">
                <li>Пропитка креозотом или антисептиком</li>
                <li>Длина 2.75 м, ширина 18 см</li>
                <li>Срок службы 12–18 лет</li>
                <li>Применение — стрелочные переводы, запасные пути</li>
              </ul>
            </div>
          </div>
          <p className="mt-4 text-slate-400 text-sm">
            Эпюра шпал — <span className="text-slate-200">1840 шт/км</span> на
            прямых, <span className="text-slate-200">2000 шт/км</span> на
            кривых R &lt; 1200 м и стрелках. Стандарт КТЖ — 1840 ж/б шпал на
            км главного пути.
          </p>
        </section>

        {/* Section 4: Ballast */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">
            4. Балластная призма
          </h2>
          <p className="mt-3 text-slate-400 leading-relaxed">
            Воспринимает нагрузку от шпал и передаёт её на земляное полотно,
            гасит вибрации, обеспечивает водоотвод. Двухслойная конструкция:
          </p>
          <div className="mt-3 grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
              <div className="text-slate-200 font-medium mb-2">
                Щебёночный слой (верхний)
              </div>
              <ul className="space-y-1 text-slate-400">
                <li>
                  Фракция <span className="text-slate-200">25–60 мм</span>{" "}
                  (изверженные породы: гранит, базальт)
                </li>
                <li>Толщина под шпалой: 35–40 см (1 класс)</li>
                <li>Кривые R &lt; 1200 м — усиление до 45 см</li>
                <li>Уклон откоса 1:1.5</li>
              </ul>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
              <div className="text-slate-200 font-medium mb-2">
                Песчаная подушка (нижний)
              </div>
              <ul className="space-y-1 text-slate-400">
                <li>Толщина 20 см</li>
                <li>Песок крупно/среднезернистый, Кф ≥ 5 м/сут</li>
                <li>Защищает земполотно от загрязнения щебнем</li>
              </ul>
            </div>
          </div>
          <p className="mt-4 text-slate-400 text-sm">
            Норма расхода балласта на 1 км пути с ж/б шпалами:{" "}
            <span className="text-slate-200">1800–2200 м³</span> (щебень) +{" "}
            <span className="text-slate-200">900–1100 м³</span> (песок).
          </p>
        </section>

        {/* Section 5: Subgrade */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">
            5. Земляное полотно
          </h2>
          <p className="mt-3 text-slate-400 leading-relaxed">
            Земляное сооружение, на котором расположен верхний строение пути.
            Три типа: <span className="text-slate-200">насыпь</span> (грунт
            привозной/местный), <span className="text-slate-200">выемка</span>{" "}
            (срезка рельефа) и{" "}
            <span className="text-slate-200">полунасыпь-полувыемка</span> (на
            косогорах).
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm border border-slate-700">
              <thead className="bg-slate-800/60 text-slate-200">
                <tr>
                  <th className="text-left p-2 border-b border-slate-700">
                    Параметр
                  </th>
                  <th className="text-left p-2 border-b border-slate-700">
                    1 путь
                  </th>
                  <th className="text-left p-2 border-b border-slate-700">
                    2 пути
                  </th>
                </tr>
              </thead>
              <tbody className="text-slate-400">
                <tr>
                  <td className="p-2 border-b border-slate-800">
                    Ширина основной площадки
                  </td>
                  <td className="p-2 border-b border-slate-800">6.6 м</td>
                  <td className="p-2 border-b border-slate-800">11.7 м</td>
                </tr>
                <tr>
                  <td className="p-2 border-b border-slate-800">
                    Уклон откосов насыпи
                  </td>
                  <td className="p-2 border-b border-slate-800">1:1.5</td>
                  <td className="p-2 border-b border-slate-800">1:1.5 ÷ 1:2.0</td>
                </tr>
                <tr>
                  <td className="p-2">Поперечный уклон площадки</td>
                  <td className="p-2">0.04 (двускатный)</td>
                  <td className="p-2">0.02 (от оси к обочинам)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-slate-400 text-sm">
            Водоотвод: продольные канавы (трапециевидное сечение, ширина
            по дну 0.6 м, уклон 1:1.5), нагорные и забанкетные канавы в
            выемках. В РК — особое внимание противодеформационным
            мероприятиям на просадочных лёссовых грунтах юга и пучинистых
            глинах севера.
          </p>
        </section>

        {/* Section 6: ИССО */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">
            6. ИССО — Искусственные сооружения
          </h2>
          <ul className="mt-3 text-sm text-slate-400 space-y-2 list-disc list-inside">
            <li>
              <span className="text-slate-200">Мосты</span> — ж/б балочные
              разрезные (пролёты 16.5 / 23.6 / 33.6 м), металлические
              сквозные фермы (пролёты 33–110 м), арочные ж/б, вантовые (ВСМ)
            </li>
            <li>
              <span className="text-slate-200">Путепроводы</span> — над
              автодорогой или ж/д
            </li>
            <li>
              <span className="text-slate-200">Виадуки</span> — мосты через
              сухие овраги/глубокие долины
            </li>
            <li>
              <span className="text-slate-200">Тоннели</span> — горные (РК:
              Кокшетауские, перспективные на проекте ВСМ через хребет
              Чу-Илийских гор)
            </li>
            <li>
              <span className="text-slate-200">ВПТ — водопропускные трубы</span>{" "}
              ⌀ 1500 / 2000 / 3000 мм (ж/б круглые, прямоугольные)
            </li>
            <li>
              <span className="text-slate-200">Подпорные стенки</span> — в
              выемках на косогорах, габионные / монолитные ж/б
            </li>
          </ul>
          <p className="mt-4 text-slate-400 text-sm">
            Удельная доля ИССО в стоимости магистрали: 8–18% (равнинная
            трасса) до 35–50% (горная). На ВСМ — выше из-за плавности
            продольного профиля.
          </p>
        </section>

        {/* Section 7: Electrification */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">
            7. Электрификация
          </h2>
          <div className="mt-3 grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
              <div className="text-slate-200 font-medium mb-2">
                Переменный ток 25 кВ 50 Гц
              </div>
              <ul className="space-y-1 text-slate-400">
                <li>Основной стандарт КТЖ для магистралей</li>
                <li>Тяговые подстанции каждые 40–60 км</li>
                <li>Меньше потерь, тоньше провод, дешевле сеть</li>
                <li>Линии: Экибастуз–Тобол, Алматы–Шу, Шу–Туркестан</li>
              </ul>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
              <div className="text-slate-200 font-medium mb-2">
                Постоянный ток 3 кВ
              </div>
              <ul className="space-y-1 text-slate-400">
                <li>Исторические участки (Алматы пригороды)</li>
                <li>Подстанции каждые 15–25 км</li>
                <li>Дороже сеть, но проще тяговые ПС</li>
              </ul>
            </div>
          </div>
          <p className="mt-4 text-slate-400 text-sm">
            <span className="text-slate-200">Контактная сеть</span>:
            контактный провод <span className="text-slate-200">МФ-100</span>{" "}
            или <span className="text-slate-200">МФ-150</span> (медь
            фасонная) сечением 100/150 мм², несущий трос ПБСМ-95 (бронза).
            Высота контактного провода над УГР — 5.75 м (минимум 5.55 м под
            ИССО). Опоры: ж/б серии{" "}
            <span className="text-slate-200">СЦС-136 / СЦС-156</span>
            (центрифугированные стойки) длиной 13.6 / 15.6 м, шаг 65 м (на
            прямых) и 50 м (на кривых).
          </p>
        </section>

        {/* Section 8: Stations & terminals */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">
            8. Станции, платформы и вокзалы
          </h2>
          <p className="mt-3 text-slate-400 leading-relaxed">
            По назначению станции делятся на{" "}
            <span className="text-slate-200">пассажирские</span>,{" "}
            <span className="text-slate-200">грузовые</span>,{" "}
            <span className="text-slate-200">сортировочные</span> (с горкой),{" "}
            <span className="text-slate-200">участковые</span> и{" "}
            <span className="text-slate-200">промежуточные</span>.
          </p>
          <div className="mt-4 grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
              <div className="text-slate-200 font-medium mb-2">
                Пассажирские платформы
              </div>
              <ul className="space-y-1 text-slate-400">
                <li>Длина: 250–650 м (под состав 20–28 вагонов)</li>
                <li>
                  Высота над УГР: низкая 110 мм / средняя 200 мм / высокая
                  1100 мм (EN 13848, ВСМ)
                </li>
                <li>Ширина боковой 4 м, островной 6–10 м</li>
                <li>Перронный навес: облегчённый, металл + поликарбонат</li>
              </ul>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
              <div className="text-slate-200 font-medium mb-2">
                Вокзальные здания
              </div>
              <ul className="space-y-1 text-slate-400">
                <li>Категория I — &gt; 1500 пасс/ч (Алматы-1, Астана)</li>
                <li>Площадь: 5 000 – 30 000 м² (категории III–I)</li>
                <li>Зал ожидания: 1.8 м²/пасс. норматива</li>
                <li>Кассовый зал, камера хранения, медпункт, КПП ТБ</li>
                <li>Конкорсы над путями — для ТПУ (Астана NQZ+Нурлы Жол)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 9: KZ benchmarks */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">
            9. Бенчмарки по железным дорогам РК
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm border border-slate-700">
              <thead className="bg-slate-800/60 text-slate-200">
                <tr>
                  <th className="text-left p-2 border-b border-slate-700">
                    Объект
                  </th>
                  <th className="text-left p-2 border-b border-slate-700">
                    Параметр
                  </th>
                  <th className="text-left p-2 border-b border-slate-700">
                    Год
                  </th>
                  <th className="text-left p-2 border-b border-slate-700">
                    Стоимость
                  </th>
                </tr>
              </thead>
              <tbody className="text-slate-400">
                <tr>
                  <td className="p-2 border-b border-slate-800">
                    КТЖ магистраль (общая сеть)
                  </td>
                  <td className="p-2 border-b border-slate-800">
                    Полигон 16 тыс. км, эксплуатация
                  </td>
                  <td className="p-2 border-b border-slate-800">2026</td>
                  <td className="p-2 border-b border-slate-800">—</td>
                </tr>
                <tr>
                  <td className="p-2 border-b border-slate-800">
                    Жетыген – Хоргос
                  </td>
                  <td className="p-2 border-b border-slate-800">
                    Западный коридор 293 км, колея 1520
                  </td>
                  <td className="p-2 border-b border-slate-800">2012</td>
                  <td className="p-2 border-b border-slate-800">≈ $670 млн</td>
                </tr>
                <tr>
                  <td className="p-2 border-b border-slate-800">
                    Узень – Гызылгая (КЗ–ТМ)
                  </td>
                  <td className="p-2 border-b border-slate-800">
                    Транскаспийский коридор, 146 км в РК
                  </td>
                  <td className="p-2 border-b border-slate-800">2014</td>
                  <td className="p-2 border-b border-slate-800">≈ $1.1 млрд</td>
                </tr>
                <tr>
                  <td className="p-2 border-b border-slate-800">
                    Вокзал Нурлы Жол (Астана)
                  </td>
                  <td className="p-2 border-b border-slate-800">
                    ТПУ EXPO-2017, 138 тыс. м²
                  </td>
                  <td className="p-2 border-b border-slate-800">2017</td>
                  <td className="p-2 border-b border-slate-800">$200 млн</td>
                </tr>
                <tr>
                  <td className="p-2">
                    ВСМ Алматы – Астана (проект)
                  </td>
                  <td className="p-2">
                    1200 км, 350 км/ч, колея 1520
                  </td>
                  <td className="p-2">2026+</td>
                  <td className="p-2">~ 9.6 трлн ₸</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-slate-400 text-sm">
            Усреднённые удельные показатели по РК:{" "}
            <span className="text-slate-200">
              1.0–1.5 млрд тг/км
            </span>{" "}
            обычной магистрали (1520, 1 путь, неэлектрифицированная) и{" "}
            <span className="text-slate-200">6–10 млрд тг/км</span> ВСМ
            (бесстыковой путь, эстакады, ИССО, электрификация 25 кВ,
            сигнализация ETCS L2). Электрификация 25 кВ как отдельная
            программа — 250–400 млн тг/км.
          </p>
        </section>

        {/* Exercises */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-50">
            🎯 Практические задания
          </h2>

          {/* Exercise 1 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <div className="text-sm text-slate-500 mb-2">Задание 1 из 4</div>
            <h3 className="text-lg font-semibold text-slate-100">
              Какая ширина железнодорожной колеи используется в Казахстане?
            </h3>
            <div className="mt-4 space-y-2">
              {[
                { id: "a", text: "1435 мм (стандартная Stephenson, EU/КНР)" },
                {
                  id: "b",
                  text: "1520 мм (постсоветский стандарт, РК / РФ / СНГ)",
                },
                { id: "c", text: "1668 мм (Iberian, Испания/Португалия)" },
                { id: "d", text: "1067 мм (Cape gauge, Япония/ЮАР)" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setEx1(opt.id)}
                  disabled={ex1 !== null}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition text-sm ${optionClass(ex1, opt.id, "b")}`}
                >
                  <span className="font-mono text-slate-500 mr-2">{opt.id})</span>
                  {opt.text}
                </button>
              ))}
            </div>
            {ex1 !== null && (
              <div
                className={`mt-4 text-sm rounded-lg p-3 border ${ex1 === "b" ? "border-emerald-700/50 bg-emerald-950/30 text-emerald-200" : "border-rose-700/50 bg-rose-950/30 text-rose-200"}`}
              >
                {ex1 === "b"
                  ? "Верно! РК использует колею 1520 мм (как и весь полигон СНГ). На границе с КНР (Достык/Алтынколь) — перестановка тележек с 1520 на 1435."
                  : "Неверно. Правильный ответ: b) 1520 мм — стандарт КТЖ и всего постсоветского пространства."}
              </div>
            )}
          </div>

          {/* Exercise 2 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <div className="text-sm text-slate-500 mb-2">Задание 2 из 4</div>
            <h3 className="text-lg font-semibold text-slate-100">
              Какой тип рельсов используется на магистральных железных дорогах
              РК?
            </h3>
            <div className="mt-4 space-y-2">
              {[
                { id: "a", text: "Р50 (только станционные и подъездные пути)" },
                { id: "b", text: "Р43 (снят с производства)" },
                {
                  id: "c",
                  text: "Р65, масса 64.7 кг/м, сталь М76 / М76Т — основной стандарт КТЖ",
                },
                { id: "d", text: "Только Р75 (применяется лишь на ВСМ и тяжёлом грузопотоке)" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setEx2(opt.id)}
                  disabled={ex2 !== null}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition text-sm ${optionClass(ex2, opt.id, "c")}`}
                >
                  <span className="font-mono text-slate-500 mr-2">{opt.id})</span>
                  {opt.text}
                </button>
              ))}
            </div>
            {ex2 !== null && (
              <div
                className={`mt-4 text-sm rounded-lg p-3 border ${ex2 === "c" ? "border-emerald-700/50 bg-emerald-950/30 text-emerald-200" : "border-rose-700/50 bg-rose-950/30 text-rose-200"}`}
              >
                {ex2 === "c"
                  ? "Верно! Р65 (64.7 кг/м) — основной магистральный профиль КТЖ. Р50 — только станционные пути, Р75 — для тяжёлых ВСМ."
                  : "Неверно. Правильный ответ: c) Р65, масса 64.7 кг/м, сталь М76/М76Т."}
              </div>
            )}
          </div>

          {/* Exercise 3 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <div className="text-sm text-slate-500 mb-2">Задание 3 из 4</div>
            <h3 className="text-lg font-semibold text-slate-100">
              Рассчитайте ориентировочную стоимость проекта ВСМ Алматы–Астана
              протяжённостью{" "}
              <span className="text-blue-300">1 200 км</span> при бенчмарке{" "}
              <span className="text-blue-300">8 млрд ₸/км</span>.
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Введите ответ в тенге (без пробелов, допуск ±800 млрд).
            </p>
            <div className="mt-4 flex gap-3">
              <input
                type="text"
                inputMode="numeric"
                value={ex3}
                onChange={(e) => {
                  setEx3(e.target.value);
                  setEx3Checked(false);
                }}
                placeholder="например, 9600000000000"
                className="flex-1 px-4 py-2 rounded-lg bg-slate-950/60 border border-slate-700 text-slate-100 focus:border-blue-500 focus:outline-none text-sm"
              />
              <button
                onClick={() => setEx3Checked(true)}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition"
              >
                Проверить
              </button>
            </div>
            {ex3Checked && (
              <div
                className={`mt-4 text-sm rounded-lg p-3 border ${ex3Correct ? "border-emerald-700/50 bg-emerald-950/30 text-emerald-200" : "border-rose-700/50 bg-rose-950/30 text-rose-200"}`}
              >
                {ex3Correct ? (
                  <>
                    Верно! 1 200 × 8 000 000 000 ={" "}
                    <span className="font-mono">9 600 000 000 000 ₸</span> (≈
                    9.6 трлн тенге, ~ $21 млрд).
                  </>
                ) : (
                  <>
                    Неверно. Правильный ответ: 1 200 × 8 000 000 000 ={" "}
                    <span className="font-mono">9 600 000 000 000 ₸</span> (≈
                    9.6 трлн ₸ или ~ $21 млрд).
                  </>
                )}
              </div>
            )}
          </div>

          {/* Exercise 4 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <div className="text-sm text-slate-500 mb-2">Задание 4 из 4</div>
            <h3 className="text-lg font-semibold text-slate-100">
              Какое напряжение используется в контактной сети на магистральных
              ж/д РК?
            </h3>
            <div className="mt-4 space-y-2">
              {[
                { id: "a", text: "1.5 кВ постоянный ток (трамвайный стандарт)" },
                {
                  id: "b",
                  text: "3 кВ постоянный ток (исторические пригороды Алматы)",
                },
                { id: "c", text: "15 кВ переменный ток 16.7 Гц (DE/AT/CH)" },
                {
                  id: "d",
                  text: "25 кВ переменный 50 Гц — основной стандарт КТЖ для тяжёлого магистрального потока",
                },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setEx4(opt.id)}
                  disabled={ex4 !== null}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition text-sm ${optionClass(ex4, opt.id, "d")}`}
                >
                  <span className="font-mono text-slate-500 mr-2">{opt.id})</span>
                  {opt.text}
                </button>
              ))}
            </div>
            {ex4 !== null && (
              <div
                className={`mt-4 text-sm rounded-lg p-3 border ${ex4 === "d" ? "border-emerald-700/50 bg-emerald-950/30 text-emerald-200" : "border-rose-700/50 bg-rose-950/30 text-rose-200"}`}
              >
                {ex4 === "d"
                  ? "Верно! 25 кВ переменного тока 50 Гц — главный стандарт КТЖ. Тяговые подстанции каждые 40–60 км, меньше потерь, дешевле контактная сеть."
                  : "Неверно. Правильный ответ: d) 25 кВ переменный 50 Гц — стандарт магистралей КТЖ. 3 кВ — лишь на старых пригородных участках."}
              </div>
            )}
          </div>
        </section>

        <div className="pt-4 border-t border-slate-800">
          <Link
            href="/smeta-trainer/drawings-practice"
            className="inline-flex items-center text-sm text-blue-300 hover:text-blue-200 transition"
          >
            ← Вернуться к списку разделов
          </Link>
        </div>
      </main>
    </div>
  );
}
