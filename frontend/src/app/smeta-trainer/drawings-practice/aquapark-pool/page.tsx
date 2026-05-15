"use client";

import Link from "next/link";
import { useState } from "react";

export default function AquaparkPoolPage() {
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
  const checkEx2 = () => setEx2Res(ex2 === "b" ? "ok" : "bad");
  const checkEx3 = () => {
    const v = parseFloat(ex3);
    if (!isFinite(v)) return setEx3Res("bad");
    setEx3Res(Math.abs(v - 2500) <= 100 ? "ok" : "bad");
  };
  const checkEx4 = () => setEx4Res(ex4 === "d" ? "ok" : "bad");

  const objectTypes = [
    {
      type: "Открытый аквапарк",
      season: "Сезонный (май–сентябрь в РК)",
      area: "3–15 га",
      cost: "2–6 млрд тг",
      note: "Горки, ленивая река, детские зоны. Сезонность снижает окупаемость.",
    },
    {
      type: "Крытый аквапарк",
      season: "Круглогодичный",
      area: "5 000–25 000 м² крытой площади",
      cost: "4–12 млрд тг",
      note: "Кровля над основными аттракционами. Параметры климата: +28–32°C, 65–75% RH.",
    },
    {
      type: "50-метровый бассейн (FINA)",
      season: "Круглогодичный",
      area: "≈ 3 000–8 000 м² (с трибунами)",
      cost: "1.5–3 млрд тг",
      note: "Олимпийский стандарт: 50 × 25 м, 8–10 дорожек, глубина 2 м, t° воды 25–28°C.",
    },
    {
      type: "Учебный бассейн 25 м",
      season: "Круглогодичный",
      area: "≈ 1 000–3 000 м²",
      cost: "800 млн – 1.5 млрд тг",
      note: "Школьные секции, ДЮСШ. 6–8 дорожек, глубина 1.2–1.8 м (переменная). СН РК 2.09-01.",
    },
    {
      type: "Термальный комплекс / СПА",
      season: "Круглогодичный",
      area: "500–5 000 м²",
      cost: "500 млн – 4 млрд тг",
      note: "Бассейны с термальной водой 36–42°C, хаммам, финская/инфракрасная сауна. Особые требования к составу воды.",
    },
  ];

  const constructivFeatures = [
    {
      topic: "Гидроизоляция чаши",
      detail: "Три основных типа: 1) Мозаика (стеклянная/керамическая) — долговечна 30+ лет, эстетична, дорого; 2) ПВХ-мембрана (лайнер) — монтируется поверх бетона, срок 10–15 лет, дешевле; 3) Жидкая полимочевина / битумный гидростоп — нанесение на бетон, срок 15–25 лет. Бетон без гидроизоляции — всегда течёт (пористая структура).",
    },
    {
      topic: "Нагрузка на борт и дно",
      detail: "Борт бассейна: ≥ 500 кг/м.п. (стойки для тренеров, зрители у бортика). Дно на опорах: гидростатическое давление грунтовых вод — при высоком УГВ чаша должна быть заякорена (анкеры или утяжелители). Пустая чаша может «всплыть».",
    },
    {
      topic: "Обходные дорожки",
      detail: "Ширина ≥ 2 м (FINA — ≥ 3 м на стартовой стороне). Покрытие: рифлёный керамогранит или резиновые противоскользящие маты. Уклон 1–2% от воды. Освещение ≥ 200 лк.",
    },
    {
      topic: "Антропогенная нагрузка воды",
      detail: "Чем больше посетителей — тем выше загрязнённость: мочевина, аммиак, органика. Нормы проектирования: 1 посетитель на 3–5 м² зеркала воды. Система очистки рассчитывается на пиковую нагрузку по числу купающихся.",
    },
  ];

  const engineeringSystems = [
    {
      name: "Рециркуляция воды",
      desc: "Полный цикл очистки: фильтрация (кварцевый песок / диатомовая земля / картриджные фильтры) → хлорирование (NaClO) или озонирование + UV → нагрев до +26–30°C → возврат в чашу. Кратность рециркуляции: 4–8 раз/сутки для бассейна, 12–24 для детских ванн.",
    },
    {
      name: "Хлорирование / озонирование / UV",
      desc: "Хлор (остаточный 0.3–0.6 мг/л) — базовый метод. Побочный эффект: хлорамины (при реакции с мочевиной) — запах, раздражение глаз. Озон + UV — нейтрализует хлорамины, снижает расход хлора в 3–5 раз. Комбинированная система: норма для аквапарков РК.",
    },
    {
      name: "Приточная вентиляция",
      desc: "Кратность воздухообмена: 8–12 крат/ч для закрытого бассейна, до 16 крат/ч для аквапарка (борьба с хлораминами). Приточный воздух подаётся снизу (обходные дорожки), вытяжка — над поверхностью воды. Оборудование: нержавеющая сталь или полипропилен (хлорная коррозия).",
    },
    {
      name: "Теплообмен и нагрев воды",
      desc: "Теплообменники пластинчатые: вода бассейна нагревается через теплоноситель (горячая вода 70°C). Источники: газовый котёл, ТЭЦ, тепловой насос (вода-вода или грунт-вода). Тепловые насосы: КПД = 4–6 (1 кВт эл-ва → 4–6 кВт тепла). Для СПА-термальных: прямой нагрев до 42°C.",
    },
    {
      name: "Деаэрация и химия воды",
      desc: "pH воды: 7.2–7.6. Жёсткость: 150–300 мг/л (CaCO₃). Мониторинг автоматический (проточные pH/ORP-датчики, каждые 30 мин). Дозирующие насосы подают реагенты автоматически по сигналу датчиков.",
    },
  ];

  const normsBenchmarks = [
    { type: "50-м олимп. бассейн FINA", cost: "1.5–3 млрд тг", note: "Без трибун ≈ 1 млрд, с трибунами 5 000 мест → 2.5–3 млрд" },
    { type: "Крытый аквапарк (20 000 м²)", cost: "6–12 млрд тг", note: "Горки + ленивая река + волновой бассейн + крытое пространство" },
    { type: "Открытый аквапарк (3–8 га)", cost: "2–5 млрд тг", note: "Сезонный, меньше инженерии крытой части" },
    { type: "Крытый 25-м бассейн", cost: "800 млн – 1.5 млрд тг", note: "Стандартный муниципальный / спортшкольный" },
    { type: "Термальный СПА-комплекс", cost: "500 млн – 4 млрд тг", note: "Зависит от числа бассейнов, класса отделки, термального источника" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Аквапарки и бассейны</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🏊 Аквапарки и плавательные комплексы
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            Водные объекты — <strong className="text-cyan-300">высококапиталоёмкое</strong>{" "}
            направление специального строительства. Специфика: гидроизоляция чаш, интенсивная
            инженерия очистки воды, агрессивная хлорная среда (коррозия оборудования),
            высокие требования к вентиляции и теплоснабжению. Нормативы:{" "}
            <strong className="text-cyan-300">FINA</strong> (олимпийские бассейны),
            СН РК 2.09-01 (физкультурные объекты). В РК — дефицит водных объектов:
            1 бассейн на 150 000+ жителей vs норма 1 на 30 000.
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-cyan-900/50 rounded-lg p-3 bg-cyan-950/20">
              <div className="text-cyan-400 uppercase tracking-wider mb-1">Температура воды</div>
              <div className="text-slate-300">+26–30°C (бассейн) / +36–42°C (термальный)</div>
            </div>
            <div className="border border-cyan-900/50 rounded-lg p-3 bg-cyan-950/20">
              <div className="text-cyan-400 uppercase tracking-wider mb-1">Вентиляция</div>
              <div className="text-slate-300">8–16 крат/ч (хлорамины)</div>
            </div>
            <div className="border border-cyan-900/50 rounded-lg p-3 bg-cyan-950/20">
              <div className="text-cyan-400 uppercase tracking-wider mb-1">50-м бассейн</div>
              <div className="text-slate-300">1.5–3 млрд тг / FINA</div>
            </div>
          </div>
        </section>

        {/* Section 1: Типы объектов */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🏗 Section 1. Типы водных объектов
          </h2>
          <div className="space-y-3">
            {objectTypes.map((obj) => (
              <div key={obj.type} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
                <div className="flex items-baseline justify-between gap-4 mb-2">
                  <h3 className="text-base font-semibold text-cyan-300">{obj.type}</h3>
                  <span className="text-xs text-slate-400 italic shrink-0">{obj.season}</span>
                </div>
                <dl className="text-sm space-y-1">
                  <div className="flex gap-4 text-xs">
                    <dt className="text-slate-500 shrink-0">Площадь:</dt>
                    <dd className="text-slate-300">{obj.area}</dd>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <dt className="text-slate-500 shrink-0">Стоимость:</dt>
                    <dd className="text-cyan-300 font-mono">{obj.cost}</dd>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <dt className="text-slate-500 shrink-0">Особенности:</dt>
                    <dd className="text-slate-300">{obj.note}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Конструктив */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🧱 Section 2. Специфика конструктива
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {constructivFeatures.map((f) => (
              <div key={f.topic} className="border border-cyan-800/40 bg-cyan-950/20 rounded-lg p-4">
                <h3 className="font-semibold text-cyan-300 mb-2 text-sm">{f.topic}</h3>
                <p className="text-xs text-slate-300">{f.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Инженерные системы */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            ⚙️ Section 3. Инженерные системы
          </h2>
          <div className="space-y-3">
            {engineeringSystems.map((s) => (
              <div key={s.name} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
                <h3 className="font-semibold text-cyan-300 text-sm mb-1">{s.name}</h3>
                <p className="text-xs text-slate-300">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: Нормативы */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📋 Section 4. Нормативы (FINA и СН РК 2.09-01)
          </h2>
          <div className="border border-cyan-800/60 bg-cyan-950/30 rounded-xl p-5 text-sm space-y-3">
            <div>
              <strong className="text-cyan-300">FINA — олимпийский 50-м бассейн:</strong>
              <ul className="list-disc list-inside ml-4 mt-1 text-slate-300 text-xs space-y-1">
                <li>Длина: 50.00 м ± 0.03 м (измерение при t° 27°C)</li>
                <li>Ширина: 25.00 м (минимум 8 дорожек по 2.5 м + бортовые по 0.5 м)</li>
                <li>Глубина: ≥ 2.00 м по всей длине</li>
                <li>Температура воды: 25–28°C</li>
                <li>Освещение: ≥ 1500 лк на поверхности воды (для ТВ-трансляций)</li>
                <li>Хронометраж: автоматический (сенсорные панели Omega/Daktronics)</li>
                <li>Стартовые тумбы: высота 0.50–0.75 м, плитка зацепа под ногу</li>
              </ul>
            </div>
            <div>
              <strong className="text-cyan-300">СН РК 2.09-01 (физкультурно-оздоровительные объекты):</strong>
              <ul className="list-disc list-inside ml-4 mt-1 text-slate-300 text-xs space-y-1">
                <li>Норматив обеспечённости: 1 дорожка бассейна на 10 000 жителей</li>
                <li>Расчёт числа купающихся: 1 чел. на 3–5 м² зеркала воды</li>
                <li>Обязательные раздевалки: 1 место на 1 дорожку × 2</li>
                <li>Доступность для МГН: пандусы, лифты, специальные подъёмники в воду</li>
                <li>Пожарная безопасность: СП РК 4.02-05, эвакуация из мокрых зон — усложнена</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 5: Бенчмарки */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            💰 Section 5. Бенчмарки стоимости в РК
          </h2>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Тип объекта</th>
                  <th className="text-left px-4 py-3 w-40">Стоимость</th>
                  <th className="text-left px-4 py-3">Примечание</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {normsBenchmarks.map((row) => (
                  <tr key={row.type} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 text-cyan-300 text-sm">{row.type}</td>
                    <td className="px-4 py-3 text-slate-100 font-mono text-xs">{row.cost}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Упражнения</h2>

          {/* Упр.1 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Параметры олимпийского бассейна FINA
            </div>
            <div className="text-slate-200 mb-4">
              Планируется строительство олимпийского плавательного центра. Проектировщик
              должен знать точные параметры бассейна по нормативам FINA.
              Какие из приведённых данных соответствуют стандарту?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "50 м × 21 м × 1.8 м глубина, 6 дорожек — экономичный вариант для аттестации FINA" },
                { v: "b", t: "50 м × 25 м × 2 м глубина, 8–10 дорожек, температура воды 25–28°C — стандарт FINA для олимпийских соревнований" },
                { v: "c", t: "50 м × 30 м × 3 м глубина — «олимпийский плюс» для прыжков в воду" },
                { v: "d", t: "Размеры FINA не регламентированы жёстко — главное длина 50 м" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1 === opt.v ? "border-cyan-600 bg-cyan-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-cyan-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex1Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-cyan-900/40 text-cyan-300 rounded text-sm">✅ Верно — FINA: 50×25×2 м</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-cyan-300">Решение:</strong> FINA (World Aquatics) строго
                регламентирует параметры олимпийского бассейна:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li><strong>Длина:</strong> 50.000 м ± 0.030 м при t° 27°C (тепловое расширение учитывается)</li>
                  <li><strong>Ширина:</strong> минимум 21 м (8 дорожек × 2.5 м + 2 × 0.5 м борт), обычно 25 м</li>
                  <li><strong>Глубина:</strong> ≥ 2.00 м (меньше — отражённые волны от дна замедляют пловцов)</li>
                  <li><strong>Дорожки:</strong> 8–10, ширина 2.5 м, ограничительные дорожки из поплавков</li>
                  <li><strong>Температура воды:</strong> 25–28°C (ниже 25 — риск спазма мышц)</li>
                  <li><strong>Освещение:</strong> ≥ 1500 лк для трансляций (вертикально к воде, без бликов)</li>
                </ul>
                Для прыжков в воду — отдельный бассейн (прыжковый): 25 × 25 м, глубина 5–6 м.
                Их обычно проектируют рядом (один инженерный комплекс).
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Гидроизоляция чаши ПВХ-мембраной
            </div>
            <div className="text-slate-200 mb-4">
              Подрядчик предлагает устроить чашу бассейна из монолитного бетона
              без дополнительной гидроизоляции — «бетон сам держит воду».
              Правильно ли это технически?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Правильно — марка бетона W8 достаточно водонепроницаема" },
                { v: "b", t: "Неправильно — бетон сам по себе пористый и не герметичен: ПВХ-мембрана (или мозаика, или жидкая гидроизоляция) обязательна, иначе фильтрация воды через стены чаши приведёт к разрушению конструкций и грунта" },
                { v: "c", t: "Это зависит от толщины бетонной стенки" },
                { v: "d", t: "Достаточно краски на основе хлорорезины" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex2 === opt.v ? "border-cyan-600 bg-cyan-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex2" value={opt.v} checked={ex2 === opt.v} onChange={() => setEx2(opt.v)} className="accent-cyan-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex2Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-cyan-900/40 text-cyan-300 rounded text-sm">✅ Верно — бетон не герметичен без гидроизоляции</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-cyan-300">Решение:</strong> Бетон — пористый материал.
                Даже марка W12 (водонепроницаемость 12 атм) имеет капиллярную фильтрацию. Для бассейна:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li><strong>ПВХ-мембрана (лайнер)</strong> — полимерная плёнка 0.5–1.5 мм, приваривается горячим воздухом, срок службы 10–15 лет. Замена: 3–5% от стоимости чаши. Подходит для бассейнов среднего класса.</li>
                  <li><strong>Стеклянная / керамическая мозаика</strong> — укладывается на эпоксидный клей и затирку, срок 25–40 лет. Дорого (от 15 000 тг/м²), но эстетично и долговечно. Стандарт для олимпийских бассейнов.</li>
                  <li><strong>Жидкая полимочевина / Kryton</strong> — проникающая гидроизоляция в бетон, кристаллизует поры. Срок 20–30 лет. Применяют при реконструкции старых чаш.</li>
                </ul>
                Без гидроизоляции: потери воды 5–15 м³/сутки → разрушение грунта → просадка конструкций.
                Это дефект, который делает эксплуатацию объекта невозможной.
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Объём воды в чаше
            </div>
            <div className="text-slate-200 mb-4">
              Проектируется олимпийский 50-метровый бассейн FINA. Размеры чаши:
              длина <strong>50 м</strong>, ширина <strong>25 м</strong>, глубина <strong>2 м</strong>.
              Рассчитайте объём воды в чаше в <strong>кубических метрах</strong>.
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Объём воды, м³</span>
              <input
                value={ex3}
                onChange={(e) => setEx3(e.target.value)}
                type="number"
                className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100"
                placeholder="2500"
              />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-cyan-900/40 text-cyan-300 rounded text-sm">✅ Верно — 2 500 м³</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-cyan-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Объём = длина × ширина × глубина
      = 50 × 25 × 2 = 2 500 м³

1 м³ воды = 1 000 кг = 1 тонна
→ 2 500 м³ = 2 500 000 кг = 2 500 тонн воды

Практические следствия для проектирования:
• Нагрев воды с 15°C до 28°C (Δ13°C):
  Q = m × c × ΔT = 2 500 000 × 4 186 × 13 ≈ 136 000 МДж
  → в кВт·ч: 136 000 МДж / 3.6 = ≈ 37 800 кВт·ч

• Для нагрева котлом 1000 кВт — время нагрева:
  37 800 кВт·ч / 1 000 кВт = ≈ 38 часов

• Стоимость первоначального нагрева (газ 80 тг/м³, теплота 10 кВт·ч/м³):
  37 800 кВт·ч / 10 × 80 = ≈ 302 400 тг

• Ежедневные потери тепла (через стены, испарение, вентиляция):
  ≈ 5–15% от объёма тепла = 1 890–5 670 кВт·ч/сутки

• Система рециркуляции обязана обработать 2 500 м³
  за 4–8 часов → мощность насосов и фильтров
  рассчитывается под Q = 312–625 м³/ч`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Вентиляция аквапарка
            </div>
            <div className="text-slate-200 mb-4">
              При проектировании системы вентиляции крытого аквапарка инженер
              отмечает, что требования к вентиляции здесь принципиально отличаются
              от обычного здания. Что является главной специфической задачей?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Поддержание температуры воздуха +28°C — основная задача вентиляции" },
                { v: "b", t: "Борьба с конденсатом на витражах — из-за разницы температур" },
                { v: "c", t: "Равномерное распределение воздуха по большим пролётам" },
                { v: "d", t: "Удаление хлораминов (от реакции хлора с мочевиной купающихся): требует 8–16-кратного воздухообмена и специального коррозиестойкого оборудования из нержавеющей стали или полипропилена" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex4 === opt.v ? "border-cyan-600 bg-cyan-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex4" value={opt.v} checked={ex4 === opt.v} onChange={() => setEx4(opt.v)} className="accent-cyan-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex4Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-cyan-900/40 text-cyan-300 rounded text-sm">✅ Верно — борьба с хлораминами</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-cyan-300">Решение:</strong> Главная специфика —
                хлорамины (трихлорамин NCl₃):
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Образуются при реакции хлора (дезинфектант) с мочевиной и аммиаком от купающихся</li>
                  <li>Концентрация NCl₃ в воздухе бассейна: 0.1–0.5 мг/м³ (при норме ≤ 0.5 мг/м³ по ВОЗ)</li>
                  <li>Запах «хлора» в бассейне — это хлорамины, не сам хлор</li>
                  <li>Вызывают: раздражение слизистых, бронхоспазм, профессиональные болезни у инструкторов</li>
                </ul>
                <strong className="text-cyan-200">Инженерные решения:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Кратность воздухообмена: 8–12 крат/ч (норм. здание: 2–4 крат/ч)</li>
                  <li>Приток снизу (у обходных дорожек), вытяжка над поверхностью воды — «накрываем» слой хлораминов</li>
                  <li>Воздуховоды, вентиляторы, теплообменники — нержавеющая сталь 316L или полипропилен (хлорная коррозия за 3–5 лет разрушает обычную оцинковку)</li>
                  <li>Деаэрация воды (удаление хлораминов из воды через вакуумные дегазаторы)</li>
                  <li>Рекуперация: в аквапарке теплопотери с вытяжкой огромны — роторные рекуператоры с КПД 75–85% обязательны</li>
                </ul>
                Стоимость систем вентиляции аквапарка: 15–25% от бюджета СМР.
                Экономить на этом нельзя: ГСЭ и Роспотребнадзор/СЭС РК закроют объект при превышении ПДК хлораминов.
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          FINA Facilities Rules 2017–2021 (World Aquatics). СН РК 2.09-01 (Физкультурно-спортивные сооружения).
          ВОЗ «Guidelines for safe recreational water environments» Vol. 2 (Swimming pools and similar environments, 2006).
          EN 15288-1:2018 (Swimming pools — Safety requirements for design).
          СП РК 4.02-05 (Системы вентиляции и кондиционирования воздуха). Kryton International (проникающая гидроизоляция).
        </div>
      </main>
    </div>
  );
}
