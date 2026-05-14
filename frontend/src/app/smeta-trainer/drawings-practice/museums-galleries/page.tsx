"use client";

import Link from "next/link";
import { useState } from "react";

export default function MuseumsGalleriesPage() {
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
  const checkEx2 = () => setEx2Res(ex2 === "d" ? "ok" : "bad");
  const checkEx3 = () => {
    const v = parseFloat(ex3);
    if (!isFinite(v)) return setEx3Res("bad");
    setEx3Res(Math.abs(v - 2750000000) <= 100000000 ? "ok" : "bad");
  };
  const checkEx4 = () => setEx4Res(ex4 === "b" ? "ok" : "bad");

  const climateParams = [
    { param: "Температура воздуха", value: "18–22°C ± 1°C", note: "Суточный перепад не более 2°C" },
    { param: "Относительная влажность", value: "45–55% RH", note: "Суточный перепад не более 5% RH" },
    { param: "Освещённость (экспонаты)", value: "50–200 люкс", note: "Живопись 19 в. — до 150 лк без фильтра" },
    { param: "УФ-излучение", value: "0 мкВт/лм", note: "Полный запрет — применяются LED без УФ/ИК" },
    { param: "Хранилище (депозитарий)", value: "14–18°C, 45–50% RH", note: "Более жёсткий режим, чем в залах" },
    { param: "Нормативная база", value: "ICOM 2021, СН РК 3.02-27", note: "ASHRAE Museum Guide, EN 15757" },
  ];

  const engineeringSystems = [
    { name: "Precision Cooling (точный климат)", desc: "Кондиционеры с точностью регулирования ±0.5°C и ±2% RH. Двухконтурная система с резервированием N+1. Канальная подача без прямых потоков на экспонаты." },
    { name: "Рекуперация тепла", desc: "Роторные или пластинчатые рекуператоры с КПД 80–85%. Задача: стабильная температура при смене наружных условий до ±1°C." },
    { name: "Специальное LED-освещение", desc: "Лампы без УФ (<0.01 мкВт/лм) и ИК (<50 мВт/лм). Цветовая температура 2700–3500K, CRI ≥ 95. Направляющие треки с диммированием по зонам." },
    { name: "Система безопасности", desc: "Видеонаблюдение 4K с AI-распознаванием, датчики движения PIR + микроволновые, сигнализация открытия витрин, периметральная охрана с временем реакции ≤ 3 мин." },
    { name: "Климат-контроль хранилища", desc: "Отдельная прецизионная система для депозитария 14–18°C. Аварийное питание от ИБП не менее 72 часов. Мониторинг 24/7 с оповещением." },
  ];

  const buildingNorms = [
    { topic: "Сейсмостойкость", detail: "СП РК 2.03-30 (9 баллов для Алматы). Специальные рамные конструкции витрин с антисейсмическими замками, демпферами. Отдельные антисейсмические фундаменты под тяжёлые скульптуры." },
    { topic: "Антивандальные покрытия", detail: "Полы из натурального камня или керамогранита (твёрдость ≥ 7 по Моосу). Стены — краска с антиграффити-пропиткой. Стекло витрин — закалённое ламинат P8A (EN 356)." },
    { topic: "Пожаротушение без воды", detail: "NOVEC 1230 (FK-5-1-12), IG-541 (Inergen), CO₂ — в залах с ценными экспонатами. Допустимый срок подачи ≤ 10 с. Концентрация NOVEC: 5.2–5.9% объёма. Не повреждает экспонаты, бумагу, электронику." },
    { topic: "Нагрузка на пол", detail: "Экспозиционные залы: 500–750 кг/м² (скульптуры, тяжёлые инсталляции). Хранилища (депозитарии): 750–1000 кг/м². Обычное обществ. здание: 200–400 кг/м²." },
    { topic: "Освещение путей эвакуации", detail: "Аварийное освещение ≥ 50 лк, автономное питание ≥ 60 мин. Маршруты эвакуации учитывают плотный поток посетителей без ориентиров в темноте (ценные экспонаты не помогают навигации)." },
  ];

  const examplesRK = [
    { name: "Центральный Государственный Музей РК", city: "Алматы", area: "≈ 22 000 м²", note: "Один из крупнейших в РК, коллекция 200 000+ экспонатов, климат-контроль реконструирован в 2012 г." },
    { name: "Музей EXPO «Нур Алем»", city: "Астана", area: "≈ 25 000 м² (8 этажей сфера)", note: "Сферическое здание Ø 80 м, спецсистема климата, прецизионное LED-освещение. Открыт 2017." },
    { name: "Национальный Музей РК", city: "Астана", area: "≈ 74 000 м²", note: "Крупнейший музей Центральной Азии. Открыт 2014, бюджет ≈ 40 млрд тг, стоимость строительства ≈ 540 тыс. тг/м²." },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Музеи и галереи</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🏛️ Музеи и художественные галереи
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            Музейное строительство — <strong className="text-amber-300">особо сложная категория</strong>{" "}
            общественных зданий. Главная задача — не архитектура, а{" "}
            <strong className="text-amber-300">стабильный микроклимат</strong> для сохранения экспонатов
            на сотни лет. Ошибка в климате — гибель культурных ценностей. Нормативы:
            ICOM (Международный совет музеев), ASHRAE Handbook for Museums, EN 15757, СН РК 3.02-27.
            Бенчмарк стоимости без экспонатов и оборудования — 400–700 тыс. тг/м².
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-amber-900/50 rounded-lg p-3 bg-amber-950/20">
              <div className="text-amber-500 uppercase tracking-wider mb-1">Температура</div>
              <div className="text-slate-300">18–22°C ± 1°C / ICOM</div>
            </div>
            <div className="border border-amber-900/50 rounded-lg p-3 bg-amber-950/20">
              <div className="text-amber-500 uppercase tracking-wider mb-1">Влажность</div>
              <div className="text-slate-300">45–55% RH / EN 15757</div>
            </div>
            <div className="border border-amber-900/50 rounded-lg p-3 bg-amber-950/20">
              <div className="text-amber-500 uppercase tracking-wider mb-1">Бенчмарк</div>
              <div className="text-slate-300">400–700 тыс. тг/м²</div>
            </div>
          </div>
        </section>

        {/* Section 1: Климат */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🌡️ Section 1. Специфика климата музея
          </h2>
          <p className="text-slate-400 text-sm max-w-3xl">
            Экспонаты разрушаются от колебаний температуры и влажности быстрее, чем от прямого воздействия.
            Суточный перепад температуры более 2°C или влажности более 5% RH уже вызывает деформацию
            деревянных рам, трещины в живописи, коррозию металлических артефактов.
          </p>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Параметр</th>
                  <th className="text-left px-4 py-3">Норма</th>
                  <th className="text-left px-4 py-3">Примечание</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {climateParams.map((row) => (
                  <tr key={row.param} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 text-amber-300 font-medium text-sm">{row.param}</td>
                    <td className="px-4 py-3 text-slate-100 font-mono text-xs">{row.value}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2: Инженерные системы */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            ⚙️ Section 2. Инженерные системы музея
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {engineeringSystems.map((s) => (
              <div key={s.name} className="border border-amber-800/40 bg-amber-950/20 rounded-lg p-4">
                <h3 className="font-semibold text-amber-300 mb-2 text-sm">{s.name}</h3>
                <p className="text-xs text-slate-300">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Строительные нормы */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📐 Section 3. Строительные нормы для музеев
          </h2>
          <div className="space-y-3">
            {buildingNorms.map((n) => (
              <div key={n.topic} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
                <h3 className="font-semibold text-amber-300 text-sm mb-1">{n.topic}</h3>
                <p className="text-xs text-slate-300">{n.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: Примеры РК */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🇰🇿 Section 4. Примеры музеев в Казахстане
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {examplesRK.map((ex) => (
              <div key={ex.name} className="border border-amber-800/40 bg-amber-950/20 rounded-xl p-4">
                <h3 className="font-semibold text-amber-300 text-sm mb-1">{ex.name}</h3>
                <div className="text-xs text-slate-400 mb-1">{ex.city} · {ex.area}</div>
                <p className="text-xs text-slate-300">{ex.note}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 5: Бенчмарк */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            💰 Section 5. Бенчмарк стоимости музейного строительства
          </h2>
          <div className="border border-amber-800/60 bg-amber-950/30 rounded-xl p-5 text-sm space-y-3">
            <p className="text-slate-300">
              Стоимость <strong className="text-amber-300">без учёта экспонатов и оборудования</strong>.
              Оборудование витрин, освещения, климата и безопасности —{" "}
              <strong className="text-amber-300">+30–60%</strong> к стоимости СМР.
            </p>
            <ul className="list-disc list-inside ml-4 text-xs text-slate-300 space-y-1">
              <li>Районный / городской музей (до 3 000 м²): 400–500 тыс. тг/м²</li>
              <li>Региональный музей (3 000–15 000 м²): 480–600 тыс. тг/м²</li>
              <li>Национальный / флагманский (15 000+ м²): 550–700 тыс. тыс. тг/м²</li>
              <li>Художественная галерея (спецосвещение, климат+): 600–800 тыс. тг/м²</li>
            </ul>
            <div className="mt-2 border-t border-amber-900/40 pt-3">
              <strong className="text-amber-300">Сравнение с офисом:</strong>
              <span className="text-slate-300 text-xs ml-2">
                Офис класса B — 180–280 тыс. тг/м². Музей дороже в 2–3 раза за счёт
                инженерии, сейсмостойких витрин, антивандала и систем безопасности.
              </span>
            </div>
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Упражнения</h2>

          {/* Упр.1 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Освещённость экспонатов
            </div>
            <div className="text-slate-200 mb-4">
              В зале с живописью XIX века проектируется система освещения. Какая оптимальная
              освещённость допустима для экспонатов без угрозы выгорания?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "500–1000 лк — как в офисном помещении" },
                { v: "b", t: "300–500 лк — как в торговом зале" },
                { v: "c", t: "50–150 лк (не более 200 лк без УФ/ИК-фильтра) — предотвращает фотохимическое выгорание красок и пожелтение лаков" },
                { v: "d", t: "Освещение не регламентируется — главное цветопередача" },
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
              {ex1Res === "ok" && <span className="px-3 py-2 bg-amber-900/40 text-amber-300 rounded text-sm">✅ Верно — 50–150 лк</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-amber-300">Решение:</strong> ICOM и EN 15757 устанавливают
                максимальную освещённость для чувствительных экспонатов (живопись, акварель, текстиль):
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Живопись маслом XIX в.: 150–200 лк, только LED без УФ/ИК</li>
                  <li>Акварель, гравюры, рисунки: 50–100 лк (очень чувствительны)</li>
                  <li>Скульптура из камня/металла: до 300 лк</li>
                  <li>Фотографии, текстиль: 50–100 лк</li>
                </ul>
                Ключевое правило: ежегодная доза освещения ≤ 150 000 лк·ч/год.
                Для выставки 8 ч/день × 250 дней = 2000 ч → максимум 75 лк среднегодовых.
                Поэтому часто делают диммирование при отсутствии посетителей до 0.
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Система пожаротушения
            </div>
            <div className="text-slate-200 mb-4">
              В зале с оригинальными картинами XVIII века необходимо запроектировать
              систему автоматического пожаротушения. Что выбрать?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Спринклерная водяная система — самая распространённая и дешёвая" },
                { v: "b", t: "Дренчерная водяная система — более равномерная подача воды" },
                { v: "c", t: "Аэрозольная система — экономичная альтернатива" },
                { v: "d", t: "Газовое пожаротушение (NOVEC 1230, CO₂, IG-541) — не повреждает экспонаты, бумагу и электронику в отличие от воды" },
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
              {ex2Res === "ok" && <span className="px-3 py-2 bg-amber-900/40 text-amber-300 rounded text-sm">✅ Верно — газовое пожаротушение</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-amber-300">Решение:</strong> Вода — главный враг музейных
                коллекций. Спринклер уничтожит экспонаты даже без пожара (ложное срабатывание).
                Применяются:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li><strong>NOVEC 1230 (FK-5-1-12)</strong> — фторкетон, испаряется без следа, не токсичен для людей при кратковременном воздействии, концентрация гашения 5.2–5.9%</li>
                  <li><strong>IG-541 (Inergen)</strong> — смесь N₂/Ar/CO₂, полностью инертен, используется там где NOVEC под запретом по экологии</li>
                  <li><strong>CO₂</strong> — только в хранилищах без персонала (смертельно опасен для людей)</li>
                </ul>
                Стоимость системы газ. пожаротушения: в 3–5 раз дороже спринклера.
                Это учитывается в бенчмарке 400–700 тыс. тг/м² для музеев.
                NOVEC 1230 — стандарт для Национального Музея РК и EXPO «Нур Алем».
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Бюджет музея
            </div>
            <div className="text-slate-200 mb-4">
              Планируется региональный музей площадью <strong>5 000 м²</strong>.
              Бенчмарк стоимости строительства (без экспонатов и оборудования) —
              <strong> 550 тыс. тг/м²</strong>. Рассчитайте ориентировочный бюджет
              строительства в <strong>тенге</strong>.
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Бюджет, тг</span>
              <input
                value={ex3}
                onChange={(e) => setEx3(e.target.value)}
                type="number"
                className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100"
                placeholder="2750000000"
              />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-amber-900/40 text-amber-300 rounded text-sm">✅ Верно — 2 750 000 000 тг</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-amber-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Бюджет = Площадь × Бенчмарк
       = 5 000 м² × 550 000 тг/м²
       = 2 750 000 000 тг (2.75 млрд тг)

Дополнительно к СМР:
• Инженерное оборудование (климат, безопасность):
  +30–40% → 825 млн – 1.1 млрд тг
• Витрины с антисейсмикой и освещением:
  +10–15% → 275–412 млн тг
• Авторский надзор + экспертиза:
  +5% → 138 млн тг

Полный бюджет с оснащением:
≈ 4 – 4.5 млрд тг

Сравнение: Национальный Музей РК (Астана, 74 000 м²)
→ бюджет ≈ 40 млрд тг → 540 тыс. тг/м² в ценах 2014 г.`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Антисейсмические витрины
            </div>
            <div className="text-slate-200 mb-4">
              Музей проектируется в Алматы (сейсмичность 9 баллов по MSK-64).
              Зачем необходимы специальные антисейсмические витрины?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Для улучшения внешнего вида и освещения экспонатов" },
                { v: "b", t: "Для защиты экспонатов при 9-балльном землетрясении — специальные замки, амортизирующие подложки и ударостойкое стекло предотвращают падение и разрушение артефактов" },
                { v: "c", t: "Для поддержания влажности внутри витрины" },
                { v: "d", t: "Антисейсмические витрины — не обязательны, достаточно общей сейсмостойкости здания" },
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
              {ex4Res === "ok" && <span className="px-3 py-2 bg-amber-900/40 text-amber-300 rounded text-sm">✅ Верно — антисейсмическая защита экспонатов</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-amber-300">Решение:</strong> Здание может выдержать
                землетрясение, но предметы внутри — нет. Специальные сейсмостойкие витрины:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li><strong>Замки с самоблокировкой</strong> при ускорении ≥ 0.1g — полки не открываются</li>
                  <li><strong>Амортизирующие подложки</strong> (силиконовые, музейный воск) — экспонат не скользит</li>
                  <li><strong>Ламинированное стекло P6B–P8A (EN 356)</strong> — при разрушении не разлетается осколками</li>
                  <li><strong>Болтовые крепления витрин</strong> к стенам и полу — сами витрины не падают</li>
                  <li><strong>Датчики ускорения</strong> — автоматическая сигнализация о сейсмическом событии</li>
                </ul>
                Производители: Goppion (Италия), Glasbau Hahn (Германия), японские MFG.
                Стоимость антисейсмической витрины: 500 тыс. – 3 млн тг/шт.
                Для Алматы с сейсмикой 9б. — это обязательное требование ГЭЭ.
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          ICOM Museum Climate Protocol 2021. EN 15757:2010 (Conservation of cultural property).
          ASHRAE Handbook — HVAC Applications, Chapter 24 (Museums, Galleries, Archives and Libraries).
          СН РК 3.02-27 (Общественные здания). СП РК 2.03-30 (Сейсмостойкость).
          Национальный Музей РК (Астана, 2014). EXPO «Нур Алем» (Астана, 2017).
          NOVEC 1230: 3M™ Novec™ 1230 Fire Protection Fluid Technical Bulletin.
        </div>
      </main>
    </div>
  );
}
