"use client";
import Link from "next/link";
import { useState } from "react";

export default function TvRadioStudioPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 5) <= 1;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 14_500_000_000) <= 1_400_000_000;

  const correct = {
    ex1: ex1 === "d",
    ex2: ex2Correct,
    ex3: ex3Correct,
    ex4: ex4 === "c",
  };
  const score = Object.values(correct).filter(Boolean).length;

  const optClass = (state: string, value: string, ok: boolean) => {
    if (!showResults || state !== value) return state === value ? "border-blue-500 bg-blue-500/20" : "border-slate-700 hover:border-slate-500";
    return ok ? "border-emerald-500 bg-emerald-500/20" : "border-rose-500 bg-rose-500/20";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300 hover:text-blue-200 transition">← К разделам</Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Теле- и радиостудии</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">📺 Теле- и радиостудии</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #250. Теле- и радиостудии РК: «Хабар Агентство» Астана (главный
            новостной канал РК, 12 студий), «Казахстан-1» Алматы (Қазмедиа Орталығы
            85 000 м²), КТК, Astana TV, Atameken Business, «Радио-Тенгри», «Радио NS».
            Студии: плавающие полы Acoustix 200 мм гасители 65 дБ, изолированные стены
            3 слоя ГКЛ + минвата 100 мм + ВПЗ-плёнка, акустика RT60 0.4 с, освещение
            Arri SkyPanel S60-C + ETC Source Four LED, EBU TECH 3253 + EBU R128 + AES17 +
            СН РК 3.02-115.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Типы студий</h2>
          <p className="text-slate-300 leading-relaxed">
            EBU TECH 3253 (Studio Acoustic) + AES17:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Большая студия А (ТВ-программы 100-200 м²):</strong> для шоу с большой аудиторией, ВРС 6-8 м для подвески осветительного оборудования.</li>
            <li><strong>Студия Б (Новости 60-100 м²):</strong> декорация студии новостей с диктором, доп. камеры, телесуфлёр.</li>
            <li><strong>Студия В (Интервью 30-50 м²):</strong> для разговорного формата, 2-3 камеры на тележках.</li>
            <li><strong>Радиостудия (Speech Studio 12-25 м²):</strong> для дикторов и интервью, акустически «мёртвая» (RT60 ≤0.3 с).</li>
            <li><strong>Радиостудия для музыки (40-80 м²):</strong> с инструментами, иной акустический баланс (RT60 0.6-1.0 с).</li>
            <li><strong>Аппаратная (Control Room):</strong> рядом со студией, окно наблюдения с двойным стеклопак. изол. от звука.</li>
            <li><strong>Монтажные (Edit Room 15-25 м²):</strong> Avid Pro Tools / DaVinci Resolve.</li>
            <li><strong>Аппаратно-вычислительный комплекс АВК:</strong> серверная для трансляц. сигнала, видеосервера Avid ISIS.</li>
            <li><strong>МАСТЕР-аппаратная:</strong> финальная подготовка сигнала к эфиру (Master Control Room).</li>
            <li><strong>ОТС (Узел Технической Связи):</strong> распределение сигналов между студиями + резервная цепь.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Звукоизоляция стен</h2>
          <p className="text-slate-300">
            Студия А для ТВ-программ должна быть изолирована от внешних шумов (улица,
            соседние помещения) и от других студий. Какая стенная конструкция по
            EBU TECH 3253 (Rw ≥ 65 дБ воздушный шум)?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Кирпич 380 мм оштукатуренный — традиционно хорошо" },
              { v: "b", t: "Двойные стены ГКЛ 1×12.5 мм + минвата 50 мм" },
              { v: "c", t: "Газобетон 300 мм с дополнительной шпатлёвкой" },
              { v: "d", t: "Двойной независимый каркас по принципу «коробка в коробке» (Room-in-Room): 1) Наружная стена основная ж/б 200 мм или газобетон 300 мм + штукатурка; 2) Воздушный зазор 100-150 мм (с виброразвязкой Sylomer M25 в основании); 3) Внутренняя стена двойной каркас из мет. профилей ПС-100×2 (раздельные стойки, не соединённые между собой), шаг 600 мм; 4) Заполнение мин. ватой Acoustic Knauf или Rockwool ROCKACOUSTIC шумоизол. 100 мм + 100 мм с разносом; 5) Облицовка 3 слоя ГКЛ Knauf 12.5 мм + 12.5 мм + 12.5 мм с разнотолщинной отделкой (звуковые потери при разных частотах) с прокладкой ВПЗ-плёнки между слоями; 6) Виброподвесы Vibrofix или Mason DSR для всех креплений к капитальным стенам/перекрытиям; 7) Все стыки герметизированы Sika Sikaflex Acoustic; 8) Дверь акустическая Industrias Pino Studi (стальной 90 мм с порогом-опускающимся уплотнителем, Rw=50 дБ); 9) Окно в аппаратную с тройным стеклопакетом 8/16/8 мм с воздушным разрывом 250 мм между стёклами (Rw=55 дБ); 10) Декоративная акустич. отделка изнутри студии — Acoustix Sopra Akustikon (диффузия + поглощение в одном элементе); Итоговая Rw=65-70 дБ; EBU TECH 3253 + DIN 4109 + ASTM E90" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Кол-во электроосвещения</h2>
          <p className="text-slate-300">
            Студия А 150 м² (15×10 м), ВРС 7 м. Норма освещения для ТВ-съёмки
            EBU TECH 3253: 1500-2500 лк рабочее на сцене, цветовая температура 5600 K
            (дневной свет). Мощность одного прожектора Arri SkyPanel S60-C — 280 Вт,
            световой поток 25 000 лм. Какая мощность освещения нужна (кВт)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            E = Φ × N × η / S<br />
            где E — освещённость лк, Φ — лм на прибор, N — кол-во<br />
            η — коэф. использования (0.4-0.5 для подвес.)<br />
            S — освещаемая площадь
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="P, кВт"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: N = E × S / (Φ × η) = 2000 × 150 / (25 000 × 0.45) = 300 000 / 11 250 = 27 шт; P = 27 × 0.28 = 7.6 кВт. Но с учётом резерва, дополнительной заливочной + back-light + key-light + fill-light с интерактивной коррекцией DMX = ~18 прожекторов Arri S60-C × 0.28 = 5 кВт основного + резерв + контурные = ~5 кВт. (Большие шоу-студии используют до 100 кВт освещ. с диммерами).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет ТВ-студии</h2>
          <p className="text-slate-300">
            ТВ-студия А (новости + интервью + шоу) 150 м² с аппаратной + монтажной +
            АВК. ССЦ + импорт: ремонт «коробка в коробке» Room-in-Room — 1.4 млрд тг,
            акустич. отделка Acoustix Sopra Akustikon (поглощение + диффузия) — 0.3 млрд тг,
            плавающий пол Acoustix 200 мм гасители — 0.4 млрд тг,
            акустич. двери Industrias Pino + окна тройные — 0.2 млрд тг,
            HVAC бесшумная Munters / Trox Aurinox (≤25 NR) — 0.8 млрд тг,
            подвесная ферменная система для прожекторов 250 кг/м² — 0.4 млрд тг,
            освещение Arri SkyPanel S60-C × 18 шт. + диммеры DMX — 0.6 млрд тг,
            камеры Sony HDC-3500 × 6 шт. (4K HDR) + объективы Canon Cine Servo — 1.4 млрд тг,
            мобильные тележки Steadycam + краны JimmyJib — 0.6 млрд тг,
            video switcher Grass Valley K-Frame X + EVS XT-VIA — 1.2 млрд тг,
            аудио Lawo MC²36 + Sennheiser MKH 416 микрофоны — 0.8 млрд тг,
            монтажная Avid Pro Tools + DaVinci Resolve + 3× MacPro M3 Ultra — 0.4 млрд тг,
            АВК и серверная (Avid ISIS 60 ТБ + transcoders + Backup) — 1.2 млрд тг,
            трансляц. инфра: спутник. uplink BU 10 м, оптоволокно к телебашне — 1.8 млрд тг,
            СОУЭ + СОТ + СКУД + противопожарная — 0.4 млрд тг,
            благоустройство + парковка + проектирование — 1.4 млрд тг,
            обучение персонала EBU TECH 3253 + резерв на запуск — 1.0 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~14.5 млрд тг (допуск ±10%). 1.4+0.3+0.4+0.2+0.8+0.4+0.6+1.4+0.6+1.2+0.8+0.4+1.2+1.8+0.4+1.4+1.0 = 14.3 млрд тг ≈ 14.5 млрд тг. Хабар Astana Studio Complex полностью (с 12 студиями + AVK + спутник.) — оценочно $100 млн ≈ 46 млрд тг.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Бесшумная вентиляция</h2>
          <p className="text-slate-300">
            Вентиляция студии должна быть полностью бесшумной (NR ≤25 — это тише
            шёпота). Что обязательно по EBU TECH 3253 + ASHRAE 90.1?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Стандартные вентиляторы с обычными шумоглушителями" },
              { v: "b", t: "Только увеличить кратность воздухообмена до 12 крат/час" },
              { v: "c", t: "Специализированная бесшумная HVAC по EBU TECH 3253 + ASHRAE 90.1: 1) Вентиляторы Trox Aurinox CARAT (бесшумные, ≤NR 20, со встроенными glasswool-капотами); 2) Воздуховоды круглые гибкие Sonoflex SN 100-300 (с акустич. изоляцией и виброразвязкой 25 мм) от вентилятора до студии; 3) Скорость воздуха в воздуховодах ≤2-3 м/с (а не 6-8 как в обычных зданиях) для исключения свистов; 4) Минимум 5 м прямого участка перед концевой шумоглушительной камерой с пористой облицовкой Akusto Black; 5) Концевые шумоглушители «лабиринт» (multi-baffle silencers) Trox Aurinox длиной 1500-2000 мм перед раздачей в студию; 6) Раздача воздуха через крупноразмерные диффузоры Trox или Vital Air низкоскоростные (≤0.15 м/с в зоне дикторов) — distributor типа displacement ventilation; 7) Воздухозабор размещён вдали от шумных источников (улица, генератор), с фильтрами F7+F9; 8) Контроль температуры +21°C ±1°C, RH 45-55% (комфорт диктора + защита электроники); 9) NRC 25 в зрительной зоне диктора (по EBU TECH 3253), измерение Brüel & Kjær PULSE Sound Level Meter с весовой функцией A; 10) Backup-вентиляция на резерв N+1, бесперебойное питание UPS вентиляторов; 11) Регулярное обслуживание + калибровка датчиков шума каждые 6 мес; EBU TECH 3253 + ASHRAE 90.1 + ASHRAE 62.1 + ISO 1996-1" },
              { v: "d", t: "Кондиционер сплит-системы с дистанционным выносом блока" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex4, o.v, correct.ex4)}`}>
                <input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={() => setEx4(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-between bg-slate-900/60 border border-slate-700 rounded-xl p-6">
          <button
            onClick={() => setShowResults(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition"
          >
            Проверить ответы
          </button>
          {showResults && (
            <div className="text-right">
              <div className={`text-2xl font-bold ${score === 4 ? "text-emerald-400" : score >= 2 ? "text-amber-400" : "text-rose-400"}`}>
                {score} / 4
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {score === 4 ? "Отлично — готовы к проектированию ТВ-студии" : score >= 2 ? "Перечитайте EBU TECH 3253 + AES17 + ASHRAE 90.1" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> EBU TECH 3253 (Studio Acoustic), EBU R128 (Loudness), AES17 (Digital Audio), ASHRAE 90.1 + 62.1, ISO 1996-1 (Acoustics), DIN 4109, ASTM E90.</p>
          <p><strong>Реальные объекты РК:</strong> «Хабар Агентство» Астана (12 студий главн. новостн.), «Казахстан-1» Алматы (Қазмедиа Орталығы 85 000 м²), КТК, Astana TV, Atameken Business, «Радио-Тенгри» FM.</p>
        </section>
      </main>
    </div>
  );
}
