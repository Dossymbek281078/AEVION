"use client";
import Link from "next/link";
import { useState } from "react";

export default function DentalClinicsPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 18) <= 2;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 720_000_000) <= 70_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Стоматологические клиники</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🦷 Стоматологические клиники премиум</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #251. Стоматологические клиники РК класса премиум: Damen Dental
            Алматы (8 кабинетов, КТ + 3D-сканер), Saulet Premium (4 кабинета,
            имплантология + ортодонтия + детская), Dental Estet Astana (12 кабинетов).
            Стоматологические установки A-dec 500 / Planmeca Compact i Touch, подвесные
            КТ (Computed Tomography) NewTom 5G + 3D Sirona Galileos Comfort, ламинарный
            поток ISO 8 для имплантологии, кислородный сепаратор Air Liquide, рентген
            ОПТГ Vatech, СанПиН РК 4.01-007 для лечебно-проф. учреждений, FDI
            стандарты, ISO 7405.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав стоматологической клиники</h2>
          <p className="text-slate-300 leading-relaxed">
            СанПиН РК 4.01-007 + FDI World Dental Federation Standards:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Стоматологический кабинет:</strong> 14-18 м² (минимум по СанПиН), потолок ≥2.6 м, естеств. освещение Ks≥0.5, искусств. ≥500 лк на рабочей зоне.</li>
            <li><strong>Стом. установка:</strong> A-dec 500 / Planmeca Compact i Touch / Sirona Sinius — кресло + блок врача + ассистентский + ножное управление + подсветка LED.</li>
            <li><strong>Рентгенкабинет с защитой:</strong> прицельный рентген + ОПТГ (Орто Пано Томо Граф) с защитой свинцом 2-3 мм по стенам/двери, экранированное окно.</li>
            <li><strong>КТ-кабинет (Cone Beam CT):</strong> NewTom 5G / Sirona Galileos для 3D-планир. имплантов, защитой 4-6 мм Pb-эквив.</li>
            <li><strong>Имплантологическая операционная:</strong> ISO 8 чистое помещение, ламинарный поток над креслом 0.36-0.45 м/с, антибакт. полы, шлюз с переодеванием.</li>
            <li><strong>Стерилизационная (ЦСО):</strong> автоклав классов B Tuttnauer / Mocom, ультразвук. ванна, упаковочная машина, отдельные «грязная»/«чистая» зоны.</li>
            <li><strong>Зуботехническая лаборатория:</strong> печь для керамики (Sintron VITA), фрезерный станок CAD/CAM (CEREC MC X / Roland DWX), 3D-принтер Formlabs.</li>
            <li><strong>Кабинеты приёма пациентов:</strong> ресепшен с менеджерами, зона ожидания, детская комната.</li>
            <li><strong>Технические:</strong> компрессорная (бесшумный Dürr Dental), вакуумная (Cattani Turbo Smart V), кислородный сепаратор Air Liquide, водоподготовка обратный осмос для стерилиз.</li>
            <li><strong>Помещения персонала:</strong> ординаторская + гардероб + санузлы для врачей.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Имплантологическая операционная</h2>
          <p className="text-slate-300">
            Имплантологический кабинет с установкой 5-10 имплантов в день. Какие
            требования по чистоте по СанПиН + FDI + ISO 14644-1?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Обычный стом. кабинет — стерилизация инструментов в автоклаве + одноразовые перчатки" },
              { v: "b", t: "Класс «А» по ГОСТ Р 52539 (ISO 5) — как операционная для кардиохирургии" },
              { v: "c", t: "Класс «Б» (ISO 7) — для серьёзной хирургии" },
              { v: "d", t: "Класс «В» по ГОСТ Р 52539 (ISO 8: ≤352 000 частиц 0.5 мкм/м³): 1) Ламинарный поток над рабочей зоной кресла 1.5×1.5 м (0.36-0.45 м/с однонаправл.); 2) HEPA H13 фильтрация приточного воздуха (99.95% эффективн.), пред-фильтры F7+F9 на АХУ; 3) Кратность воздухообмена 15-20 1/час (+8-10 1/час свежего); 4) Избыточное давление в операционной +5..+15 Па (защита от проникновения частиц из коридора); 5) Шлюз входа с переодеванием — отдельные халаты, шапочки, бахилы, маски FFP3 для персонала; 6) Антибакт. полы эпоксидные Mapei Ultratop Loft Wide (бесшовные, гладкие); 7) Стены сэндвич-панели с антибакт. покрытием Sika SikaFloor PurCem (легко моются, не накапливают пыль); 8) t°=22-24°C, RH=40-60%; 9) Освещение 1000 лк операционная + 5000 лк хирургический светильник Maquet Hanaulux (или dental светильник Faro Maia LED); 10) Ассистентский блок Cattani Turbo Smart V (медицинская вакуумная аспирация бесшумная); 11) Стерильное поле с одноразовыми чехлами на кресло, стол врача, светильник, КТ-устройство; 12) Регулярный микробиол. контроль (бакобследование рабочих поверхностей 1 раз/мес); СанПиН РК 4.01-007 + FDI Practice Guidelines + ISO 14644-1 + ГОСТ Р 52539" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Защита от рентген. излучения</h2>
          <p className="text-slate-300">
            Стоматологический рентген. кабинет с прицельным аппаратом Vatech VEGA
            (60 кВ, 7 мА) + ОПТГ. Стандарт защиты — переход дозы на смежные помещения
            ≤1 мЗв/год для общего населения (НРБ-99). Какой эквив. свинца на стены?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            δ_Pb эквив. = функция от напряжения, расстояния, занятости<br />
            Для 60 кВ при 1 м расстояния — 2 мм Pb<br />
            Для 100 кВ (более мощных КТ) — 4-6 мм Pb
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Защита стены, ×10 мм Pb"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: для прицельного 60-70 кВ — 2 мм Pb. Для ОПТГ 80-90 кВ — 2.5-3 мм Pb. Для КТ 100-120 кВ — 4-6 мм Pb. Для зала с несколькими аппаратами — расчёт по сумме экспозиций (typ. 1.8 мм Pb-эквив.). В учебной задаче — 1.8 мм Pb = 18 (×10).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет клиники 6 кабинетов</h2>
          <p className="text-slate-300">
            Стоматологич. клиника премиум 6 кабинетов + 1 имплантологич. + КТ +
            зуботехлаб. Площадь 350 м². ССЦ + импорт: ремонт «под ключ»
            бесшовные полы + сэндвич-панели стены + потолки антибакт. — 64 млн тг,
            6 стом. установок A-dec 500 — 96 млн тг,
            1 имплантологическая Planmeca Compact i Touch + ламин. поток — 38 млн тг,
            КТ NewTom 5G + защита кабинета Pb 4 мм — 110 млн тг,
            ОПТГ Vatech VEGA + Pb-защита кабинета — 28 млн тг,
            прицельные рентген × 6 с Pb-защитой — 18 млн тг,
            ЦСО (автоклав Tuttnauer + узкуч + упаковщик + 2 ламин. шкафа) — 22 млн тг,
            компрессорная Dürr Dental DK 50 + вакуумная Cattani — 24 млн тг,
            кислород. сепаратор Air Liquide + СГЗ — 12 млн тг,
            зуботехлаб. (печь VITA + CEREC MC X CAD/CAM + 3D-принтер Formlabs) — 65 млн тг,
            HVAC прецизионный с HEPA H13 + контроль точки росы — 45 млн тг,
            СОУЭ + СОТ + СКУД + противопожарная защ. — 16 млн тг,
            IT-инфра + СУ Клиники Practiceworks + R+ Backup — 18 млн тг,
            мебель кабинет + лобби + ресепшен Premium — 38 млн тг,
            энергоснабжение ТП + резерв ДГУ + UPS критических — 24 млн тг,
            проектирование + лицензии Минздрав + аудит ISO 7405 — 24 млн тг,
            обучение персонала FDI + резерв на запуск — 18 млн тг,
            благоустройство + парковка 30 м/мест — 36 млн тг,
            оборотные ср-ва первых 6 мес работы (зарплата + материалы) — 24 млн тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~720 млн тг (допуск ±10%). 64+96+38+110+28+18+22+24+12+65+45+16+18+38+24+24+18+36+24 = 720 млн тг. Удельная стоимость ~2 млн тг/м² — премиум-класс. Damen Dental Алматы (8 кабинетов + флагман) — оценочно ~1 млрд тг.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Утилизация мед. отходов</h2>
          <p className="text-slate-300">
            Стом. клиника производит 4 класса мед. отходов: А (бытовые), Б (эпидем.
            опасные — расходники), В (черв. отходы — ампутации), Г (токсичные —
            ртутные амальгамы, химия). Что обязательно по СанПиН РК 4.01-007 + ВОЗ?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Все отходы в общий мусоросборник" },
              { v: "b", t: "Только отдельный контейнер для острых предметов (иглы, скальпели)" },
              { v: "c", t: "Многоуровневая система медицинских отходов по СанПиН РК 4.01-007 + WHO Health-Care Waste Management: 1) Раздельный сбор у источника в 4 класса — Класс А (бытовые) в чёрные пакеты ПВД 90×50 мм 50 мкм, Класс Б (опасные — после процедуры с кровью/слюной) в жёлтые пакеты с маркир. «Опасные мед. отходы», Класс В (особо опасные — биообразцы, ампутации) в красные пакеты, Класс Г (токсичные — ртутная амальгама, рентген. фиксаж AgNO₃, химиотерапевт.) в чёрные пакеты с маркировкой «Токсичные»; 2) Контейнеры жёсткие непрокалываемые для острых (иглы, лезвия, скальпели) ECOSAFE или Bio Bin 5-10 л с замком; 3) Маркировка с указанием отделения/даты/массы; 4) Транспортировка по «грязным» путям (отдельные от «чистых» для пациентов) — лифт грузовой; 5) Класс А → обычный мусоровоз; Класс Б → промежуточная обработка (СВЧ-дезинфекция Steriflash или химич. Sterilox), затем как Класс А; Класс В → крематорий мед. отходов (Tabo SF120 при +1100°C) с газоочисткой; Класс Г → специализиров. полигон опасных отходов с гидроизол. HDPE + бентонит; 6) Ртутная амальгама — отдельный сбор в герметичные контейнеры под жидкостью (raphana), сдача в специализир. фирмы по уtilization Hg (например, в РК — «Эко-Ремонт» Алматы); 7) Контроль документации Журнал учёта мед. отходов; 8) Аккредитация специализир. оператора по утилизации (лицензия Минздрав); 9) Обучение персонала + регулярный контроль СанЭпид. службой; 10) Реестр отходов в ГБДД Минэкологии РК; СанПиН РК 4.01-007 + WHO Health-Care Waste Management Manual" },
              { v: "d", t: "Только сжигание всех мед. отходов в крематории" },
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
                {score === 4 ? "Отлично — готовы к проектированию стом. клиники" : score >= 2 ? "Перечитайте СанПиН РК 4.01-007 + FDI + ISO 14644-1" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СанПиН РК 4.01-007, FDI World Dental Federation Standards, ISO 7405 (Biological Evaluation), ISO 14644-1, ГОСТ Р 52539, НРБ-99, СП 2.6.1.799-99 ОСПОРБ.</p>
          <p><strong>Реальные объекты РК:</strong> Damen Dental Алматы (8 кабинетов, флагман премиум), Saulet Premium Алматы (4 каб.), Dental Estet Astana (12 каб.), Aesthetic Dental Almaty (имплантология), Magnit Dental Караганда.</p>
        </section>
      </main>
    </div>
  );
}
