"use client";
import Link from "next/link";
import { useState } from "react";

export default function AirportsTerminalsPage() {
  const [ex1, setEx1] = useState<string | null>(null);
  const [ex2, setEx2] = useState<string | null>(null);
  const [ex3, setEx3] = useState<string>("");
  const [ex3Checked, setEx3Checked] = useState(false);
  const [ex4, setEx4] = useState<string | null>(null);

  const ex3Target = 27_000_000_000;
  const ex3Tolerance = 2_500_000_000;
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
            AEVION Smeta Trainer · Аэропорты и терминалы
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            ✈️ Аэропорты и терминалы
          </h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Аэродромная инфраструктура — один из самых капиталоёмких и
            технически сложных классов объектов: ВПП, рулёжные дорожки, перрон,
            пассажирские и грузовые терминалы, башня УВД, светосигнальное
            оборудование и системы посадки. Сметчик работает с нормами ICAO,
            СНиП РК «Аэродромы» и проектами ТОО «Казаэропроект». В этом модуле
            разберём ключевые параметры объектов и бенчмарки по аэропортам РК
            (Алматы AAA, Астана NQZ, Шымкент CIT, Актау SCO, Атырау GUW).
          </p>
        </section>

        {/* Section 1: ICAO Annex 14 classification */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">
            1. Классификация аэродромов ICAO Annex 14
          </h2>
          <p className="mt-3 text-slate-400 leading-relaxed">
            Согласно <span className="text-slate-200">ICAO Annex 14</span>{" "}
            (приложение «Аэродромы»), каждая ВПП классифицируется двумя
            параметрами: код-цифра по длине ВПП и код-буква по размаху крыла и
            колее основного шасси.
          </p>
          <div className="mt-4 grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
              <div className="text-slate-200 font-medium mb-2">
                Код-цифра (длина ВПП)
              </div>
              <ul className="space-y-1 text-slate-400">
                <li>1 — менее 800 м</li>
                <li>2 — 800–1200 м</li>
                <li>3 — 1200–1800 м</li>
                <li>4 — 1800 м и более</li>
              </ul>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
              <div className="text-slate-200 font-medium mb-2">
                Код-буква (размах крыла)
              </div>
              <ul className="space-y-1 text-slate-400">
                <li>A — до 15 м (лёгкая авиация)</li>
                <li>B — 15–24 м</li>
                <li>C — 24–36 м (B737, A320)</li>
                <li>D — 36–52 м (B767, A310)</li>
                <li>E — 52–65 м (B777, A330/350)</li>
                <li>F — 65–80 м (A380, B747-8)</li>
              </ul>
            </div>
          </div>
          <p className="mt-4 text-slate-400 text-sm">
            ВПП <span className="text-slate-200">Code 4E</span> (Boeing 777,
            Airbus A330/350) — длина ≥ 1800 м, обычно 3000–3500 м, ширина 45 м.
            ВПП <span className="text-slate-200">Code 4F</span> (A380,
            B747-8) — длина ≥ 2300 м, чаще 3500–4500 м, ширина 60 м, обочины
            7.5 м, общая ширина 75 м.
          </p>
        </section>

        {/* Section 2: Runway */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">
            2. Взлётно-посадочная полоса (ВПП / Runway)
          </h2>
          <div className="mt-3 grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
              <div className="text-slate-200 font-medium mb-2">Геометрия</div>
              <ul className="space-y-1 text-slate-400">
                <li>Длина: 3000–4500 м (международные)</li>
                <li>Ширина: 45 м (Code E) или 60 м (Code F)</li>
                <li>Продольный уклон: не более 1.5%</li>
                <li>Поперечный уклон: 1–1.5% (водоотвод)</li>
                <li>Концевые полосы безопасности: 240 м</li>
              </ul>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
              <div className="text-slate-200 font-medium mb-2">Покрытие</div>
              <ul className="space-y-1 text-slate-400">
                <li>
                  Цементобетонные плиты{" "}
                  <span className="text-slate-200">ПАГ-25</span> (аэродромные)
                  6×7.5 м, толщ. 25–40 см
                </li>
                <li>
                  Или жёсткий АБ + усиление{" "}
                  <span className="text-slate-200">BSO</span> (binder stabilized
                  overlay)
                </li>
                <li>
                  Основание: ЦПС + ГБМ (грунт-бетонная масса) 25–30 см
                </li>
                <li>Дренаж: продольные дрены ⌀200 мм</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 3: Taxiways */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">
            3. Рулёжные дорожки (Taxiways)
          </h2>
          <p className="mt-3 text-slate-400 leading-relaxed">
            Соединяют ВПП с перроном. Ширина зависит от кода-буквы:{" "}
            <span className="text-slate-200">Code C — 18 м</span>,{" "}
            <span className="text-slate-200">Code E — 23 м</span>,{" "}
            <span className="text-slate-200">Code F — 25 м</span>. Магистральные
            РД идут параллельно ВПП, перпендикулярные — соединяют РД с ВПП и
            перроном.
          </p>
          <div className="mt-3 rounded-lg border border-blue-700/50 bg-blue-950/20 p-4 text-sm">
            <div className="text-blue-200 font-medium mb-1">
              RET — Rapid Exit Taxiway
            </div>
            <p className="text-slate-300">
              Скоростная рулёжная дорожка под углом{" "}
              <span className="text-blue-200">30°</span> к оси ВПП. Позволяет
              самолёту покидать ВПП на скорости 50–80 км/ч (вместо торможения до
              нуля). Увеличивает пропускную способность ВПП на 20–30%. Алматы
              AAA имеет 4 RET, Астана NQZ — 3 RET.
            </p>
          </div>
        </section>

        {/* Section 4: Apron */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">
            4. Перрон (Apron) — места стоянки воздушных судов
          </h2>
          <p className="mt-3 text-slate-400 leading-relaxed">
            Покрытие перрона — преимущественно{" "}
            <span className="text-slate-200">ПЦБ (предварительно
            напряжённый цементобетон)</span>{" "}
            толщиной 45–60 см на основании из ГБМ-цементогрунта 30 см. АБ-покрытия
            на перроне не рекомендуются из-за керосиновых проливов и точечных
            нагрузок от шасси.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm border border-slate-700">
              <thead className="bg-slate-800/60 text-slate-200">
                <tr>
                  <th className="text-left p-2 border-b border-slate-700">
                    Тип ВС
                  </th>
                  <th className="text-left p-2 border-b border-slate-700">
                    Размер стоянки
                  </th>
                  <th className="text-left p-2 border-b border-slate-700">
                    Площадь
                  </th>
                </tr>
              </thead>
              <tbody className="text-slate-400">
                <tr>
                  <td className="p-2 border-b border-slate-800">A380 (Code F)</td>
                  <td className="p-2 border-b border-slate-800">80 × 80 м</td>
                  <td className="p-2 border-b border-slate-800">6400 м²</td>
                </tr>
                <tr>
                  <td className="p-2 border-b border-slate-800">
                    B777 / A350 (Code E)
                  </td>
                  <td className="p-2 border-b border-slate-800">55 × 60 м</td>
                  <td className="p-2 border-b border-slate-800">3300 м²</td>
                </tr>
                <tr>
                  <td className="p-2 border-b border-slate-800">
                    B737 / A320 (Code C)
                  </td>
                  <td className="p-2 border-b border-slate-800">35 × 40 м</td>
                  <td className="p-2 border-b border-slate-800">1400 м²</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 5: Terminals */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">
            5. Пассажирские терминалы (T1 / T2 / T3)
          </h2>
          <p className="mt-3 text-slate-400 leading-relaxed">
            Пропускная способность задаётся в{" "}
            <span className="text-slate-200">млн пассажиров / год</span>.
            Типовой норматив — <span className="text-slate-200">25–45 тыс.
            м² на каждый млн пасс./год</span>. Терминал на 5 млн пасс. → 125–225
            тыс. м².
          </p>
          <div className="mt-4 grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
              <div className="text-slate-200 font-medium mb-2">
                Функциональные зоны
              </div>
              <ul className="space-y-1 text-slate-400">
                <li>Departure (вылет) — регистрация, security, gate hold</li>
                <li>Arrival (прилёт) — паспортный контроль, выдача багажа</li>
                <li>Транзитная зона (sterile area)</li>
                <li>Jet Bridge (телетрапы Adelte / JBT / ThyssenKrupp)</li>
                <li>Duty Free, F&B, lounges (бизнес-залы)</li>
              </ul>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
              <div className="text-slate-200 font-medium mb-2">Конструктив</div>
              <ul className="space-y-1 text-slate-400">
                <li>2–3 уровня (Departure сверху, Arrival снизу)</li>
                <li>Стальной каркас (фермы 60–120 м)</li>
                <li>Витражи (стоечно-ригельные системы)</li>
                <li>
                  Мембранные покрытия:{" "}
                  <span className="text-slate-200">PTFE / ETFE</span> (тефлон,
                  этилентетрафторэтилен)
                </li>
                <li>BHS (Baggage Handling System) — конвейеры 2–4 км</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 6: ATC Tower */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">
            6. Башня УВД (Air Traffic Control Tower)
          </h2>
          <p className="mt-3 text-slate-400 leading-relaxed">
            Высота над уровнем земли:{" "}
            <span className="text-slate-200">50–90 м</span>. Конструкция —
            монолитный железобетонный ствол диаметром 8–12 м с шахтами лифтов
            и лестниц внутри. Кабина диспетчеров (visual cab) — 1–2 уровня со
            стеклопакетами, наклонными внутрь 15° (исключение бликов), общая
            обзорность 360°. Над кабиной — RVR-датчики, метеостанция,
            антенны.
          </p>
        </section>

        {/* Section 7: Special equipment */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">
            7. Спецоборудование аэропорта
          </h2>
          <ul className="mt-3 text-sm text-slate-400 space-y-2 list-disc list-inside">
            <li>
              <span className="text-slate-200">Светосигнальное OCM</span>: ОВИ-1
              (малая), ОВИ-2 (средняя), ОВИ-3 (высокая интенсивность) —
              огни ВПП, РД, глиссады PAPI
            </li>
            <li>
              <span className="text-slate-200">ILS Cat I / II / III</span> —
              Instrument Landing System (курсо-глиссадная система посадки)
            </li>
            <li>
              <span className="text-slate-200">VOR / DME</span> — радиомаяк
              всенаправленный + дальномер
            </li>
            <li>
              <span className="text-slate-200">MetCenter</span> — аэродромная
              метеостанция (давление, ветер, видимость RVR)
            </li>
            <li>
              <span className="text-slate-200">ТЭЦ-резерв</span> —
              мини-электростанция 2–5 МВт (резервное питание ILS и
              светотехники)
            </li>
            <li>
              <span className="text-slate-200">SMGCS</span> — Surface Movement
              Guidance & Control System (управление движением по перрону)
            </li>
          </ul>
          <div className="mt-4 rounded-lg border border-amber-700/50 bg-amber-950/20 p-4 text-sm">
            <div className="text-amber-200 font-medium mb-1">
              ILS Cat III — подкатегории видимости
            </div>
            <ul className="text-slate-300 space-y-1">
              <li>
                Cat IIIA — высота принятия решения 0 м, видимость 200 м
                (Алматы AAA)
              </li>
              <li>Cat IIIB — видимость 50–200 м</li>
              <li>Cat IIIC — видимость 0 м (автоматическая посадка вслепую)</li>
            </ul>
          </div>
        </section>

        {/* Section 8: Cargo terminals */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">
            8. Грузовые терминалы (Cargo)
          </h2>
          <p className="mt-3 text-slate-400 leading-relaxed">
            Площадь грузовых терминалов в РК — обычно{" "}
            <span className="text-slate-200">8–15 тыс. м²</span>. Зонирование:
            холодная зона (общий груз), тёплая (+18°C — фарма, цветы),
            морозильная (-25°C — продукты). Внутри — ULD-стеллажи (Unit Load
            Devices, авиаконтейнеры AKE/AAY), накопители-конвейеры BHS,
            рентген-сканеры <span className="text-slate-200">ANCS</span>{" "}
            (Aviation Cargo Screening), стойки таможенного контроля.
          </p>
        </section>

        {/* Section 9: KZ benchmarks */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">
            9. Бенчмарки по аэропортам РК
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm border border-slate-700">
              <thead className="bg-slate-800/60 text-slate-200">
                <tr>
                  <th className="text-left p-2 border-b border-slate-700">
                    Аэропорт (IATA)
                  </th>
                  <th className="text-left p-2 border-b border-slate-700">
                    Терминал / событие
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
                  <td className="p-2 border-b border-slate-800">Алматы (AAA)</td>
                  <td className="p-2 border-b border-slate-800">
                    Новый T2 (TAV Airports)
                  </td>
                  <td className="p-2 border-b border-slate-800">2023</td>
                  <td className="p-2 border-b border-slate-800">~ $150 млн</td>
                </tr>
                <tr>
                  <td className="p-2 border-b border-slate-800">Астана (NQZ)</td>
                  <td className="p-2 border-b border-slate-800">
                    T1 Saryarka (Kisho Kurokawa)
                  </td>
                  <td className="p-2 border-b border-slate-800">2017</td>
                  <td className="p-2 border-b border-slate-800">$235 млн</td>
                </tr>
                <tr>
                  <td className="p-2 border-b border-slate-800">Шымкент (CIT)</td>
                  <td className="p-2 border-b border-slate-800">Новый терминал</td>
                  <td className="p-2 border-b border-slate-800">2024</td>
                  <td className="p-2 border-b border-slate-800">~ $120 млн</td>
                </tr>
                <tr>
                  <td className="p-2 border-b border-slate-800">Актау (SCO)</td>
                  <td className="p-2 border-b border-slate-800">Реконструкция T1</td>
                  <td className="p-2 border-b border-slate-800">2022</td>
                  <td className="p-2 border-b border-slate-800">~ $40 млн</td>
                </tr>
                <tr>
                  <td className="p-2">Атырау (GUW)</td>
                  <td className="p-2">Реконструкция ВПП + терминал</td>
                  <td className="p-2">2021</td>
                  <td className="p-2">~ $60 млн</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-slate-400 text-sm">
            Усреднённая себестоимость нового пассажирского терминала в РК:{" "}
            <span className="text-slate-200">600 тыс. – 1.2 млн тг/м²</span>{" "}
            (включая инженерные системы, BHS, телетрапы, отделку). Без
            спецоборудования (BHS, jet bridges) — 400–700 тыс. тг/м².
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
              Какой код ICAO Annex 14 у ВПП для приёма Airbus A380?
            </h3>
            <div className="mt-4 space-y-2">
              {[
                { id: "a", text: "3C" },
                { id: "b", text: "4D" },
                {
                  id: "c",
                  text: "4F (длина 2300+ м, ширина 60 м, размах крыла до 80 м)",
                },
                { id: "d", text: "2B" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setEx1(opt.id)}
                  disabled={ex1 !== null}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition text-sm ${optionClass(ex1, opt.id, "c")}`}
                >
                  <span className="font-mono text-slate-500 mr-2">{opt.id})</span>
                  {opt.text}
                </button>
              ))}
            </div>
            {ex1 !== null && (
              <div
                className={`mt-4 text-sm rounded-lg p-3 border ${ex1 === "c" ? "border-emerald-700/50 bg-emerald-950/30 text-emerald-200" : "border-rose-700/50 bg-rose-950/30 text-rose-200"}`}
              >
                {ex1 === "c"
                  ? "Верно! Code 4F — самый крупный класс ВПП, обязательный для A380 и B747-8."
                  : "Неверно. Правильный ответ: c) 4F. Цифра 4 = длина ≥ 1800 м, буква F = размах крыла 65–80 м (A380 = 79.75 м)."}
              </div>
            )}
          </div>

          {/* Exercise 2 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <div className="text-sm text-slate-500 mb-2">Задание 2 из 4</div>
            <h3 className="text-lg font-semibold text-slate-100">
              Что такое RET в аэропорту?
            </h3>
            <div className="mt-4 space-y-2">
              {[
                { id: "a", text: "Тип терминала" },
                {
                  id: "b",
                  text: "Скоростная рулёжная дорожка (Rapid Exit Taxiway) под углом 30° к ВПП — самолёт быстро покидает ВПП",
                },
                { id: "c", text: "Система навигации" },
                { id: "d", text: "Башня УВД" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setEx2(opt.id)}
                  disabled={ex2 !== null}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition text-sm ${optionClass(ex2, opt.id, "b")}`}
                >
                  <span className="font-mono text-slate-500 mr-2">{opt.id})</span>
                  {opt.text}
                </button>
              ))}
            </div>
            {ex2 !== null && (
              <div
                className={`mt-4 text-sm rounded-lg p-3 border ${ex2 === "b" ? "border-emerald-700/50 bg-emerald-950/30 text-emerald-200" : "border-rose-700/50 bg-rose-950/30 text-rose-200"}`}
              >
                {ex2 === "b"
                  ? "Верно! RET увеличивает пропускную способность ВПП на 20–30%."
                  : "Неверно. Правильный ответ: b) RET = Rapid Exit Taxiway, угол 30° к оси ВПП."}
              </div>
            )}
          </div>

          {/* Exercise 3 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <div className="text-sm text-slate-500 mb-2">Задание 3 из 4</div>
            <h3 className="text-lg font-semibold text-slate-100">
              Рассчитайте сметную стоимость нового терминала площадью{" "}
              <span className="text-blue-300">30 000 м²</span> при
              себестоимости <span className="text-blue-300">900 000 тг/м²</span>.
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Введите ответ в тенге (без пробелов, можно с допуском ±2.5 млрд).
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
                placeholder="например, 27000000000"
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
                    Верно! 30 000 × 900 000 ={" "}
                    <span className="font-mono">27 000 000 000 тг</span> (27
                    млрд тенге).
                  </>
                ) : (
                  <>
                    Неверно. Правильный ответ: 30 000 × 900 000 ={" "}
                    <span className="font-mono">27 000 000 000 тг</span>{" "}
                    (≈ 27 млрд ₸ или ~ $60 млн).
                  </>
                )}
              </div>
            )}
          </div>

          {/* Exercise 4 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <div className="text-sm text-slate-500 mb-2">Задание 4 из 4</div>
            <h3 className="text-lg font-semibold text-slate-100">
              Что такое ILS Cat III?
            </h3>
            <div className="mt-4 space-y-2">
              {[
                { id: "a", text: "Система оповещения" },
                { id: "b", text: "Грузовой терминал" },
                { id: "c", text: "Категория пожарной безопасности" },
                {
                  id: "d",
                  text: "Instrument Landing System категория III — посадка при видимости 0–200 м (Cat IIIA/B/C); Алматы AAA сертифицирован Cat IIIA",
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
                  ? "Верно! ILS Cat III позволяет посадку в условиях густого тумана. Алматы AAA = Cat IIIA, большинство аэропортов РК = Cat I."
                  : "Неверно. Правильный ответ: d) ILS Cat III — высшая категория курсо-глиссадной системы посадки."}
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
