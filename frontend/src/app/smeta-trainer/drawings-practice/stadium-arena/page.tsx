"use client";

import Link from "next/link";
import { useState } from "react";

export default function StadiumArenaPage() {
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
    // Категория 4 — 30 000 мест × 800 тыс. тг/место = 24 млрд тг базовый бенчмарк
    const v = parseFloat(ex3);
    if (!isFinite(v)) return setEx3Res("bad");
    setEx3Res(Math.abs(v - 24) <= 1 ? "ok" : "bad");
  };
  const checkEx4 = () => setEx4Res(ex4 === "d" ? "ok" : "bad");

  const venues = [
    {
      name: "Футбольный стадион FIFA Cat. 4 (международный)",
      capacity: "30 000-60 000+ мест",
      norms: "FIFA Stadium Guidelines, UEFA Stadium Infrastructure Regulations (5 категорий)",
      params: "Поле 105×68 м, VIP-ложи 5%, билетные кассы, медиа-центры, эвакуация &lt; 8 мин",
      cost: "600 тыс. - 1.5 млн тг/место (зависит от категории)",
      example: "Astana Arena (30 000 мест, открыт 2009), стадион Almaty Central (новый проект 2024-2027)",
    },
    {
      name: "Хоккейная арена IIHF (международный)",
      capacity: "10 000-20 000 мест",
      norms: "IIHF Arena Manual, ледовая поле 60×30 м с обогревом скамеек",
      params: "Холодильные установки -5°C на льду, точное освещение, скайбоксы, медиа-зона",
      cost: "500 тыс. - 1.2 млн тг/место",
      example: "Astana Arena Hockey (12 000), Baluan Sholak (Алматы, 5 000)",
    },
    {
      name: "Универсальная баскетбольная арена FIBA",
      capacity: "5 000-18 000 мест",
      norms: "FIBA Arena Manual, поле 28×15 м, выдвижные трибуны",
      params: "Многофункциональное (баскет, волей, концерты), LED-освещение 1500 лк",
      cost: "450 тыс. - 1 млн тг/место",
      example: "Saryarka Velodrome (Астана), Almaty Arena (бывший Балуан Шолак нов.)",
    },
    {
      name: "Плавательный комплекс FINA",
      capacity: "3 000-10 000 мест зрителей",
      norms: "FINA Facilities Rules — 50-м бассейн 8 дорожек, прыжковая башня, тренировочный",
      params: "Хлорирование/озон, теплоснабжение бассейна +28°C, влажность 60-65%, акустика",
      cost: "300-700 тыс. тг/место (плюс инфраструктура бассейна)",
      example: "Бассейн «Достар» Туркестан, плавательные центры Алматы и Астаны",
    },
    {
      name: "Велотрек / Атлетический манеж",
      capacity: "5 000-15 000 мест",
      norms: "UCI (велоспорт), World Athletics (лёгкая атлетика)",
      params: "Велотрек 250 м деревянный, манеж 200 м синтетика, климат-контроль круглый год",
      cost: "400-800 тыс. тг/место",
      example: "Saryarka Velodrome — основной велотрек РК",
    },
    {
      name: "Боксёрский / Многофункц. дворец",
      capacity: "3 000-12 000 мест",
      norms: "AIBA (бокс), смешанные единоборства, концерты",
      params: "Ринг 6×6 м, выдвижные трибуны, прокат для концертов и шоу",
      cost: "350-700 тыс. тг/место",
      example: "Алматы Арена, Балуан Шолак (Алматы), Дворец спорта Кашаган (Атырау)",
    },
  ];

  const fifa_categories = [
    { cat: "Cat. 1", what: "Локальные матчи (нац. чемпионат низших дивизионов)", capacity: "≥ 200", lighting: "≥ 200 лк", media: "Минимум" },
    { cat: "Cat. 2", what: "Премьер-лига национальная", capacity: "≥ 1 500", lighting: "≥ 800 лк", media: "Базовый" },
    { cat: "Cat. 3", what: "Континентальные клубные турниры (Лига чемпионов отбор)", capacity: "≥ 4 500", lighting: "≥ 1 200 лк", media: "Расширенный" },
    { cat: "Cat. 4", what: "Финальные матчи евротурниров, ЧЕ/ЧМ группы", capacity: "≥ 8 000", lighting: "≥ 1 400 лк", media: "Премиум, 8K-вещание" },
    { cat: "FIFA Final", what: "Финал ЧМ FIFA (только для топ-стран)", capacity: "≥ 60 000", lighting: "≥ 2 000 лк", media: "Уровень Олимпиад" },
  ];

  const systems = [
    { name: "Поле и игровое покрытие", what: "Натуральная трава с подогревом + дренаж, или гибридный (Tarkett SportsPro)" },
    { name: "Покрытие (купол/крыша)", what: "Открытая, частичная, полностью закрытая (Дубайский Etihad). Зимой РК — нужна закрывающаяся" },
    { name: "Трибуны", what: "Кресла индивидуальные с подогревом (для VIP), скайбоксы 30-100 ложей, выдвижные трибуны (мульти-формат)" },
    { name: "Освещение", what: "LED-прожекторы 1400-2000 лк (FIFA Cat. 4), без теней, цветовая температура 5500K, HDR-вещание" },
    { name: "Звук и медиа", what: "Стадионная аудиосистема 100+ дБ, гигантские LED-экраны 100-300 м² по углам поля" },
    { name: "Безопасность", what: "Турникеты с биометрией, рамки металлоискатели, видеонаблюдение каждое сиденье, эвакуация &lt; 8 мин" },
    { name: "Климат-контроль", what: "Для крытых — кондиционеры, для открытых в РК — обогреватели трибун, поля" },
    { name: "Гостеприимство", what: "Парковки 50-80% от мест, рестораны, VIP-зоны, медиа-центры, раздевалки судей" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Стадионы и арены</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🏟 Стадионы и спортивные арены
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            Спортивная инфраструктура — <strong className="text-emerald-300">особая ниша</strong>
            строительной отрасли. Стадион 50 000 мест — это инженерный шедевр стоимостью
            300-1500 млн $ с уникальными требованиями: FIFA/UEFA/IIHF/FINA нормативы,
            акустика, освещение для 8K-вещания, эвакуация тысяч людей за 8 минут. В РК:
            Astana Arena, Almaty Arena, Saryarka Velodrome — флагманы. Готовятся
            новые проекты к ЧМ 2030 и Азиатским играм. Регулируется ЗРК «О физической
            культуре и спорте» + международные стандарты ФИФА, УЕФА, МОК.
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Стандарты</div>
              <div className="text-slate-300">FIFA Cat. 1-4 + Final, UEFA, IIHF, FIBA, FINA</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Бенчмарк стоимости</div>
              <div className="text-slate-300">400-1500 тыс. тг/место (зависит от категории)</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Срок строительства</div>
              <div className="text-slate-300">3-6 лет (FEED + проект + стр-во)</div>
            </div>
          </div>
        </section>

        {/* Section 1: 6 типов */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🏗 Section 1. Шесть типов спортивных сооружений
          </h2>
          <div className="space-y-3">
            {venues.map((v) => (
              <div key={v.name} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
                <div className="flex items-baseline justify-between gap-4 mb-2">
                  <h3 className="text-base font-semibold text-emerald-300">{v.name}</h3>
                  <span className="text-xs text-amber-300 italic shrink-0">{v.capacity}</span>
                </div>
                <dl className="text-sm space-y-1.5">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Стандарты</dt>
                    <dd className="text-slate-300 text-xs">{v.norms}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Параметры</dt>
                    <dd className="text-slate-300 text-xs">{v.params}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Бенчмарк</dt>
                    <dd className="text-emerald-300 text-xs font-mono">{v.cost}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Пример РК</dt>
                    <dd className="text-slate-400 text-xs italic">{v.example}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: FIFA Categories */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            ⚽ Section 2. Категории FIFA для футбольных стадионов
          </h2>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-32">Категория</th>
                  <th className="text-left px-4 py-3">Применение</th>
                  <th className="text-left px-4 py-3 w-32">Вместимость</th>
                  <th className="text-left px-4 py-3 w-32">Освещение</th>
                  <th className="text-left px-4 py-3">Медиа</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {fifa_categories.map((c) => (
                  <tr key={c.cat} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 font-mono text-emerald-300 font-bold">{c.cat}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{c.what}</td>
                    <td className="px-4 py-3 text-amber-300 text-xs">{c.capacity}</td>
                    <td className="px-4 py-3 text-emerald-300 text-xs">{c.lighting}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{c.media}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Системы */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            ⚙️ Section 3. Восемь ключевых систем стадиона
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {systems.map((s) => (
              <div key={s.name} className="border border-emerald-800/40 bg-emerald-950/20 rounded-lg p-4">
                <h3 className="font-semibold text-emerald-300 mb-2 text-sm">{s.name}</h3>
                <p className="text-xs text-slate-300">{s.what}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: Структура смет */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📋 Section 4. Структура сметы стадиона
          </h2>
          <div className="border border-emerald-800/60 bg-emerald-950/30 rounded-xl p-5 text-sm space-y-3">
            <div>
              <strong className="text-emerald-300">Разбивка стоимости (типовая, для FIFA Cat. 4):</strong>
              <ul className="list-disc list-inside ml-4 mt-1 text-slate-300 text-xs space-y-1">
                <li>Земляные работы + фундаменты (массивные): 8-12%</li>
                <li>Конструкции трибун (ж/б, металлокаркас): 25-35%</li>
                <li>Крыша (купол/мембрана/металл): 10-20%</li>
                <li>Поле и подогрев: 3-5%</li>
                <li>Освещение и LED-экраны: 5-8%</li>
                <li>Системы безопасности (камеры, турникеты): 4-7%</li>
                <li>ОВ + кондиционирование (для крытых): 8-15%</li>
                <li>Звук и медиа-инфраструктура: 3-5%</li>
                <li>Отделка трибун и общественных зон: 6-10%</li>
                <li>Парковки, дороги, благоустройство: 5-10%</li>
                <li>Прочие (ПНР, ввод, авт. надзор): 5-8%</li>
              </ul>
            </div>
            <div>
              <strong className="text-emerald-300">Особенности стадиона vs обычное стр-во:</strong>
              <ul className="list-disc list-inside ml-4 mt-1 text-slate-300 text-xs space-y-1">
                <li>Большие пролёты крыши (60-200 м) — спецрасчёт и спецконструкции</li>
                <li>Высокие требования к акустике — расчёты в Odeon/CATT</li>
                <li>Сейсмика (особенно Алматы 9б.) — усложнение каркаса</li>
                <li>Пожарная эвакуация &lt; 8 мин — много выходов, лестниц, эскалаторов</li>
                <li>Доступность для маломобильных (≥ 5% мест) — отдельные зоны</li>
                <li>VIP-инфраструктура (ложи, рестораны) — премиум-сегмент сметы</li>
                <li>Спорт-специфичные системы (лёд для хоккея, бассейн, татами)</li>
                <li>Тестовый период перед открытием (3-6 мес.) — отдельная статья</li>
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
              Упражнение 1 / 4 — FIFA категория
            </div>
            <div className="text-slate-200 mb-4">
              РК планирует подать заявку на проведение группового этапа ЧМ FIFA 2030.
              Для основных матчей требуются стадионы определённой категории FIFA. Какая
              минимальная категория необходима?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Cat. 1 (≥ 200 мест)" },
                { v: "b", t: "Cat. 2 (≥ 1 500 мест)" },
                { v: "c", t: "Cat. 4 (≥ 8 000 мест, освещение ≥ 1400 лк, премиум медиа, поле подогревом) — это минимум для матчей ЧМ FIFA, для финала нужен ещё более высокий уровень (≥ 60 000 мест)" },
                { v: "d", t: "Не имеет значения" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1 === opt.v ? "border-emerald-600 bg-emerald-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-emerald-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex1Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — Cat. 4</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-emerald-300">Решение:</strong> FIFA Cat. 4 — минимум
                для матчей Чемпионатов Мира и Континентов. Требования включают:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Вместимость ≥ 8 000 (на практике для ЧМ — 30-40 тыс. мест)</li>
                  <li>Освещение ≥ 1400 лк, цветовая температура 5500K, без теней</li>
                  <li>Подогрев поля (электр. или горячая вода) — обязательно</li>
                  <li>Премиум медиа-инфраструктура: 8K-вещание, 50+ ракурсов камер</li>
                  <li>VIP-ложи 5-10% от мест</li>
                  <li>Системы безопасности (биометрия турникетов, AI-видеонаблюдение)</li>
                  <li>Доступность для маломобильных ≥ 5% мест</li>
                </ul>
                В РК: Astana Arena уже Cat. 4 (получен в 2019 после модернизации).
                Для проведения матчей ЧМ FIFA понадобится 4-6 стадионов Cat. 4. План:
                Алматы, Астана, Шымкент, Туркестан, Караганда. Бюджет:
                4-5 млрд $ суммарно для новых стадионов и модернизации существующих.
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Время эвакуации
            </div>
            <div className="text-slate-200 mb-4">
              При проектировании стадиона на 30 000 мест по нормам FIFA / UEFA / СНиП РК
              4.02-05 (пожарная безопасность) какое <strong>максимальное время эвакуации</strong>
              должно быть обеспечено?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "15 минут — стандарт для общественных зданий" },
                { v: "b", t: "8 минут (480 секунд) — норма FIFA/UEFA для крупных стадионов в чрезвычайной ситуации. Это требует широких выходов, эскалаторов вниз, нескольких уровней пандусов" },
                { v: "c", t: "30 минут" },
                { v: "d", t: "Не регламентировано" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex2 === opt.v ? "border-emerald-600 bg-emerald-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex2" value={opt.v} checked={ex2 === opt.v} onChange={() => setEx2(opt.v)} className="accent-emerald-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex2Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 8 мин (480 с)</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-emerald-300">Решение:</strong> 8 минут — это
                «золотое правило» FIFA/UEFA Stadium Regulations. Расчёт основан на
                катастрофах прошлого (Хейзельская трагедия 1985, давка в Hillsborough
                1989, Heysel — 39 погибших):
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Толпа из 30 000 в панике двигается со скоростью 1-2 м/с</li>
                  <li>Узкие выходы создают «пробки» с давлением до 4 кН/м² (опасно для жизни)</li>
                  <li>Стандарт CIBSE: ≥ 1 м ширины выхода на 60-100 человек</li>
                  <li>На 30 000 мест нужно ≥ 300-500 м суммарной ширины выходов</li>
                </ul>
                Это влияет на проект:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Минимум 8-16 эвакуационных выходов разных уровней</li>
                  <li>Широкие лестницы (3-6 м) без узких мест</li>
                  <li>Эскалаторы только «вниз» (вверх — для подъёма зрителей)</li>
                  <li>Освещённость путей эвакуации ≥ 50 лк автономным питанием 30+ мин</li>
                  <li>Голосовое оповещение (СОУЭ) на нескольких языках</li>
                </ul>
                Несоблюдение — стадион не сертифицируется FIFA/UEFA. На практике все
                новые стадионы РК (Astana Arena, Almaty Arena) — соответствуют 8-мин
                норме, доказано симуляциями в Pathfinder / FDS.
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Бюджет стадиона
            </div>
            <div className="text-slate-200 mb-4">
              Планируется новый футбольный стадион в Алматы вместимостью <strong>30 000
              мест</strong>, категория FIFA Cat. 4. Бенчмарк стоимости —
              <strong> 800 тыс. тг/место</strong> (среднее для Cat. 4 в РК с учётом сейсмики
              9 баллов). Какой ориентировочный бюджет в <strong>МЛРД тг</strong>?
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Бюджет, млрд тг</span>
              <input value={ex3} onChange={(e) => setEx3(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="24" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 24 млрд тг</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-emerald-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Бюджет = N_мест × Цена_место
       = 30 000 × 800 000
       = 24 000 000 000 тг = 24 млрд тг

В долларах: ~ 53 млн $

Сравнение с реальными РК-проектами:
• Astana Arena (30 000 мест, 2009): ~ 200 млн $ (≈ 91 млрд тг
  в ценах 2024 г.) — премиум, открытая+убирающаяся крыша
• Almaty Arena (12 000 мест, 2017): ~ 100 млн $ (≈ 45 млрд тг)
• Saryarka Velodrome (8 000 мест): ~ 60 млн $ (≈ 27 млрд тг)

Бенчмарк 800 тыс. тг/место — это базовый Cat. 4 в РК (без
крыши, на грунте). Премиум (с крышей, VIP-ложами, медиа Cat. 1):
~ 1.5-2 млн тг/место.

Расчёт детальнее:
• Конструктив (трибуны+каркас): 24 × 30% = 7.2 млрд тг
• Крыша (если открытая - 0, если закрытая +20%): 0-4.8 млрд тг
• Системы (свет, медиа, безоп.): 24 × 25% = 6 млрд тг
• Поле + ОВ + климат: 24 × 8% = 1.9 млрд тг
• Отделка трибун и обществ.: 24 × 12% = 2.9 млрд тг
• Парковки и благоустр.: 24 × 10% = 2.4 млрд тг
• Прочие (ПНР, авт. надзор): 24 × 5% = 1.2 млрд тг
─────────────────────────────────────────────────────
ИТОГО: 24 млрд тг + резерв 10% = 26-27 млрд тг полный бюджет

При финансировании через ЕБРР / частное-государственное
партнёрство ставка может быть 5-7% годовых.`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Сейсмика стадиона
            </div>
            <div className="text-slate-200 mb-4">
              Стадион 30 000 мест проектируется в Алматы (сейсмика 9 баллов). Какие
              <strong> главные конструктивные решения</strong> применяются для
              обеспечения сейсмостойкости такого крупного объекта?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Только увеличение арматуры в фундаменте" },
                { v: "b", t: "Простой ж/б каркас как у обычного здания" },
                { v: "c", t: "Усиленный газобетон" },
                { v: "d", t: "Комплекс: 1) Стальной каркас на сейсмоизоляторах (резинометаллические опоры), 2) Демпферы (TMD — Tuned Mass Damper), 3) X-связи в плоскости стен, 4) Большие пролёты крыши решаются вантами/арочными конструкциями с расчётом на горизонтальные ускорения 0.4g, 5) Антисейсмические швы между секциями трибун" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex4 === opt.v ? "border-emerald-600 bg-emerald-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex4" value={opt.v} checked={ex4 === opt.v} onChange={() => setEx4(opt.v)} className="accent-emerald-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex4Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — комплекс решений</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-emerald-300">Решение:</strong> Крупные стадионы
                в 9-балльных зонах — серьёзный инженерный вызов. Применяются:
                <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
                  <li><strong>Сейсмоизоляция основания</strong> — резинометаллические
                  опоры (Bridgestone, FIP Industriale) под колоннами. Снижают сейсм.
                  нагрузки в 3-5 раз. Стоимость: 5-15% от стоимости каркаса</li>
                  <li><strong>Демпферы TMD</strong> — массы 100-500 тонн на верху
                  здания, синхронно гасят колебания (как в Тайбэй 101). Применяется на
                  больших куполах и крышах</li>
                  <li><strong>Стальной каркас вместо ж/б</strong> — выше предел текучести,
                  лучшее поведение в землетрясении (пластичные деформации)</li>
                  <li><strong>X-связи</strong> в плоскости стен — диагональные стержни
                  передают горизонтальные нагрузки</li>
                  <li><strong>Антисейсмические швы</strong> — большой стадион делится
                  на 4-8 независимо колеблющихся секций со швами 100-200 мм между ними</li>
                  <li><strong>Расчёт</strong> в ЛИРА-САПР или ETABS на сейсмические нагрузки
                  ускорения 0.4g (Алматы 9 баллов), с проверкой PGA и спектрального
                  отклика</li>
                </ol>
                Удорожание от сейсмики для стадиона: +20-30% к каркасной части
                (4-6 млрд тг к бюджету 24 млрд тг). Astana Arena построена с
                сейсмоизоляторами Bridgestone — выдержит землетрясение 9 баллов.
                Almaty Arena (9 баллов) — построена со всеми перечисленными решениями
                в 2017 г.
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          FIFA Stadium Guidelines 2022. UEFA Stadium Infrastructure Regulations 2024.
          IIHF Arena Manual. FIBA Arena Manual. FINA Facilities Rules. СНиП РК 4.02-05
          (Пожарная безопасность). СП РК 2.03-30 (Сейсмостойкость). Astana Arena,
          Almaty Arena, Saryarka Velodrome — флагманы РК. ЗРК «О физической культуре
          и спорте» от 03.07.2014 № 228-V.
        </div>
      </main>
    </div>
  );
}
