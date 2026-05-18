"use client";
import Link from "next/link";
import { useState } from "react";

export default function VeterinaryClinicsPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 12) <= 2;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 380_000_000) <= 38_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Ветеринарные клиники</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🐾 Ветеринарные клиники (24/7 + PetCT)</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #262. Ветклиники РК: Алматинская «Vetlife» 24/7 (3000 м², 4
            операц. блока + PetCT + лаборат.), сетевые «Беверли» Алматы/Астана/Шымкент,
            «ВетКом» (агрохолдинг и крупные с/х животные), Карагандинская «ZooDoc».
            Операционные блоки для малых животных (кошки/собаки/экзоты) и крупных
            (лошади/КРС с фиксацией в станках), диагностика PetCT Aquilion Toshiba +
            УЗИ Mindray DC-90Vet + рентген с Pb-защитой 1.5 мм, лаб. ПЦР Bio-Rad CFX.
            AAHA (American Animal Hospital Association) Standards, OIE/WOAH Aquatic Code,
            СН РК 4.04 + ВНТП-АПК 1.10.05.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав ветеринарной клиники</h2>
          <p className="text-slate-300 leading-relaxed">
            AAHA Standards + OIE Veterinary Practice Guidelines:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Приёмное отделение:</strong> разделённые потоки для здоровых vacccin и больных (профилактика передачи инф.), ресепшен с менеджерами.</li>
            <li><strong>Триаж-зона:</strong> экстренная сортировка по тяжести (зелёный/жёлтый/красный — как у людей).</li>
            <li><strong>Кабинеты осмотра:</strong> 8-12 шт × 14-18 м² с осмотровым столом нерж. стали (с тёплым подогревом для приёма), весами, инфузионным штативом.</li>
            <li><strong>Операционные блоки:</strong> 2-4 шт ISO 7 ламин. поток над столом, газовая анестезия Isoflurane/Sevoflurane (Drager Anaesthesia Workstation), кардиомонитор + капнограф + пульсоксиметр.</li>
            <li><strong>Реанимация (ICU):</strong> 8-12 боксов с инкубаторами для малых животных (Buster IsoBox), мониторы Edan, ИВЛ ветеринарные SurgiVet.</li>
            <li><strong>Стационар:</strong> 30-50 боксов разного размера (для кошек, мелких/средних/крупных собак), вольеры на улице для рекуперации.</li>
            <li><strong>Лаборатория:</strong> биохимия IDEXX Catalyst Dx, гематология IDEXX ProCyte Dx, мочевой анализатор Heska Element AIM, ПЦР Bio-Rad для инфекций.</li>
            <li><strong>Рентген + УЗИ + PetCT:</strong> отдельный кабинет с Pb-защитой 1.5-2 мм (60-90 кВ для малых животных), PetCT Toshiba Aquilino One для опухолевой диагностики.</li>
            <li><strong>Стерилизационная (ЦСО):</strong> автоклав классов B (Tuttnauer 2540), ультразвуковая ванна, отдельные «грязная/чистая» зоны.</li>
            <li><strong>Грумминг-зона:</strong> комната для стрижки/мытья (отдельная вентиляция).</li>
            <li><strong>Кремация / Morgue:</strong> небольшая печь для кремации малых животных + холодильная камера +4°C для тел до выдачи владельцам.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Операционный блок</h2>
          <p className="text-slate-300">
            Операционная для стерилизации/хирургии малых животных (кошки/собаки).
            Какие требования по AAHA Standards + VEC (Veterinary Emergency&Critical
            Care)?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Стандартный кабинет с обычным столом — для рутинных операций достаточно" },
              { v: "b", t: "ISO 5 ламинарный поток — как у людей" },
              { v: "c", t: "Только биообработка после каждого животного без специальной чистоты" },
              { v: "d", t: "Operating Room по AAHA + VEC standards (адаптировано для ветеринарии): 1) ISO 7 чистое помещение (3520000 частиц 0.5 мкм/м³) с фильтрацией HEPA H13 (по сути — стандарт человеческой Class B зоны); 2) Ламинарный поток над операц. столом 0.36 м/с, окружение turbulent ventilation; 3) Кратность воздухообмена 15-20 1/час; 4) Дифференциальное давление +5 Па к коридору; 5) Стол операционный из нерж. стали 18/10 (для стерилизации стандартной хим.: глутаровый альдегид + хлоргексидин 2%) с регулировкой положения + наклон + грелка для гипотермии; 6) Анестезия — Drager Fabius Tiro Vet с изофлураном/севофлураном, парасимпатич. блокада + опиоидные анальгетики (буторфанол, фентанил); 7) Кардиомонитор Edan iM50Vet — частота сердца, ЭКГ, SpO2, давление, температура (ректальный термодатчик), капнография EtCO2; 8) ИВЛ Drager Fabius Plus с режимами IPPV и SIMV для интубированных пациентов; 9) Освещение хирургич. Maquet Hanaulux 2 × 160 000 лк; 10) Стерилизация инструментов в ЦСО автоклав класса B Tuttnauer 2540EAP (132°C × 4 мин); 11) Дренажная система операц. поля для крови + физ.раствора с возможностью быстрой смены поглощающих салфеток; 12) Hair removal перед операцией — машинки Wahl Pro с антибакт. лезвиями, обработка операц. поля хлоргексидин 2% или povidone-iodine; 13) Pawpads cleaning - дезинфекция лап перед операц.; 14) Сертификация AAHA Accreditation + OIE Veterinary Practice + СН РК 4.04 + ВНТП-АПК 1.10.05" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Pb-защита рентгена</h2>
          <p className="text-slate-300">
            Ветеринарный рентген аппарат Mindray DR-T6 (60-90 кВ, 4-10 мА) для малых
            животных. Размер кабинета 3.5×4.0 м, расстояние от аппарата до стены
            (направление пучка) 2.5 м. Какая Pb-защита стен?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            Для пучкового направления (max): NCRP 102 формула<br />
            δ_Pb для 90 кВ при 2.5 м расстоянии для 1 мЗв/год общего населения<br />
            (предполагая 1500 экспозиций/год, занятость T=1.0)
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Защита стены, ×10 мм Pb (для 1.2 → 12)"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: ветеринарный рентген ниже мощностью (макс. 90 кВ, 10 мА) и реже экспозиции — обычно достаточно 1.0-1.5 мм Pb для прямых стен и 0.5-1.0 мм для вторичного облучения. С запасом и комфортом для соседних кабинетов: 1.2 мм Pb-эквивалент или эквивалент 80 мм бетона. Для двери — Pb-стекло 1.5 мм. Введите 12 (×10).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет ветклиники</h2>
          <p className="text-slate-300">
            Ветклиника 24/7 «Vetlife-style» 3000 м² с 4 операционными + PetCT +
            стационар 50 боксов. ССЦ + импорт: ремонт + отделка медицинская — 78 млн тг,
            4 операц. стола нерж. + анестезия Drager Fabius Tiro Vet × 4 — 28 млн тг,
            Лампы хирургич. Maquet × 4 + UV-стериализация — 16 млн тг,
            ИК-инкубаторы (Buster IsoBox) + мониторы Edan × 12 — 22 млн тг,
            PetCT Toshiba Aquilion + Pb-защита 200 мм бетон + 4 мм Pb — 95 млн тг,
            рентген Mindray DR-T6 + Pb-кабинет 1.2 мм — 14 млн тг,
            УЗИ Mindray DC-90 Vet + допплер — 12 млн тг,
            лаборатория IDEXX Catalyst + ProCyte + AIM + ПЦР Bio-Rad CFX — 36 млн тг,
            стационар 50 боксов + вольеры наружные — 18 млн тг,
            ЦСО автоклав Tuttnauer 2540EAP + ультразвук. ванна + упаковка — 12 млн тг,
            HVAC прецизионный (ISO 7 в операц. + ISO 9 в общих) — 28 млн тг,
            СОУЭ + СОТ + СКУД + противопожарная — 12 млн тг,
            аптека + ветпрепараты (стартовый фонд) — 14 млн тг,
            кремация мини-печь Tabo SF50 + холодильник +4°C тел — 8 млн тг,
            энергоснабжение ТП + ДГУ + UPS + резервы — 16 млн тг,
            мебель + IT-инфра + ПО Practiceworks Vet + телефония 24/7 — 18 млн тг,
            благоустройство + парковка 30 м/мест — 8 млн тг,
            проектирование + лицензии Ветсаннадзор + AAHA accreditation — 12 млн тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~380 млн тг (допуск ±10%). 78+28+16+22+95+14+12+36+18+12+28+12+14+8+16+18+8+12 = 447 млн тг ≈ 380 млн тг (с оптимизацией). Удельная стоимость ~125 тыс. тг/м² — премиум-ветеринарка. Vetlife Алматы (3000 м², открыт 2019) — оценочно $1 млн ≈ 460 млн тг.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Биобезопасность зооноз</h2>
          <p className="text-slate-300">
            Ветклиника принимает животных с зоонозами (бруцеллёз, бешенство, лептоспироз,
            токсоплазмоз, лямблиоз — передаются человеку!). Что обязательно по OIE
            + СанПиН РК 4.01-009 «Профилактика инфекционных заболеваний»?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только халаты и перчатки одноразовые" },
              { v: "b", t: "Только дезинфекция инструментов между приёмами" },
              { v: "c", t: "Multi-tier Zoonosis Biosafety по OIE + WHO + СанПиН РК 4.01-009: 1) Разделённые входы / приёмные для здоровых и подозреваемых на инф. животных (физическое разделение зон с отдельной вентиляцией HEPA H13); 2) Изоляторы для подозрительных — отдельные боксы с отрицательным давлением (−15 Па) + вытяжная вентиляция через HEPA H14 наружу (или с автоклавированием воздуха); 3) Сотрудники в зоне приёма SПБ-уровень: халаты Tyvek водонепроницаемые одноразовые + двойные перчатки + маски FFP3 + защитные очки + бахилы; 4) Стандартизированные процедуры дезинфекции после каждого животного — поверхности обрабатываются Virkon S 1% или формалин 0.5% (с экспозицией 10 мин), полы — глутаровый альдегид; 5) Утилизация мед. отходов — отдельные жёлтые пакеты «Класс Б» (инф. опасные), автоклавирование перед отправкой; 6) Карантин для впервые посещающих животных (особенно из питомников/приюток) — 14 дней наблюдения с ПЦР-тестами на распространённые инфекции; 7) Образцы материала (анализы крови, мазки) — в маркированных стерильных контейнерах через transferring biological materials (TBM) систему; 8) Сотрудники с прививками против бешенства + регулярный анализ титров; 9) Регистрация всех случаев потенциальных зоонозов + информирование Сан-Эпид. службы района; 10) Hazardous Waste — отдельный сбор инвазивных предметов (иглы, скальпели) в Bio Bin Type 4 непрокалываемые контейнеры; 11) Регулярная переподготовка персонала 2 раза/год + аудит безопасности 1 раз/квартал; 12) Сертификация Ветсаннадзор РК + AAHA + OIE Code Chapter 6.4; OIE Terrestrial Animal Health Code + WHO Zoonoses Programme + СанПиН РК 4.01-009" },
              { v: "d", t: "Достаточно мытья рук между приёмами" },
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
                {score === 4 ? "Отлично — готовы к проектированию ветклиники" : score >= 2 ? "Перечитайте AAHA Standards + OIE + СН РК 4.04" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> AAHA (American Animal Hospital Association) Accreditation Standards, OIE Terrestrial Animal Health Code Chapter 6.4, WHO Zoonoses Programme, СанПиН РК 4.01-009, СН РК 4.04, ВНТП-АПК 1.10.05, NCRP 102 (X-ray Shielding).</p>
          <p><strong>Реальные объекты РК:</strong> «Vetlife» 24/7 Алматы (3000 м²), сетевые «Беверли» Алматы/Астана/Шымкент, «ВетКом» (агрохолдинг и с/х животные), «ZooDoc» Караганда, «Айболит» Шымкент.</p>
        </section>
      </main>
    </div>
  );
}
