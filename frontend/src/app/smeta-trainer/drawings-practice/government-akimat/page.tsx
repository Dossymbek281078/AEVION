"use client";
import Link from "next/link";
import { useState } from "react";

export default function GovernmentAkimatPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 24000) <= 2200;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 56_000_000_000) <= 5_500_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Государственные здания</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🏛️ Парламент, Акиматы и государственные здания</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #235. Государственные здания РК: Парламент РК «Дом Парламента»
            (Астана, 1999, 56 000 м²), Акорда — Резиденция Президента (Астана, 2004,
            36 720 м²), здания Министерств левого берега Астаны, Акиматы городов и
            областей (Алматы, Шымкент, Атырау, Костанай). Категория Ф4.3 (учреждения),
            высокий уровень охраны, медный экран EMSEC TEMPEST для документов гос. тайны,
            конференц-залы пленарные, представительские зоны. СП РК 3.02-115, СН РК
            2.02-15, ASIS PCS, ICAO IATA Security для приёма ВИП-делегаций.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав здания Парламента/Акимата</h2>
          <p className="text-slate-300 leading-relaxed">
            СП РК 3.02-115 «Здания общественные» + специфика гос. зданий:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Пленарный зал — 1 этаж главного здания, амфитеатр на 154-300 мест (Парламент РК — 107 депут.).</li>
            <li>Рабочие кабинеты депутатов/министров — 60-80 м² премиум, на верхних этажах.</li>
            <li>Зал заседаний правительства/совета (Cabinet Room), круглый стол на 25-40 мест.</li>
            <li>Представительские помещения — Зал торжественных приёмов, столовая для ВИП.</li>
            <li>Залы пресс-конференций (130-250 мест) с прямой трансляцией.</li>
            <li>Залы переговоров с переводом 4-6 языков синхр. (Sennheiser Tour Guide).</li>
            <li>Защищённые зоны для документов гос. тайны (SCIF — Sensitive Compartmented Information Facility).</li>
            <li>Архивы с климат-контролем (как в музее) и противопожарной защитой.</li>
            <li>Подземная парковка ВИП с прямым лифтом в кабинеты (отдельные ВИП-входы).</li>
            <li>Зона безопасности по периметру 50-100 м, СКУД на входах, рамки металлоискатели.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Защита от прослушки SCIF</h2>
          <p className="text-slate-300">
            Кабинеты с обсуждением гос. тайны и зал заседаний правительства. Какая защита
            от прослушивания и утечек ЭМП по NSA TEMPEST (NSTISSAM TEMPEST/1-92)?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Достаточно толстых стен и тяжёлых занавесок" },
              { v: "b", t: "Только заземление всех розеток" },
              { v: "c", t: "Только подавители GSM-сигнала" },
              { v: "d", t: "Полноценная SCIF (Sensitive Compartmented Information Facility) по NSA TEMPEST: 1) Медный экран EMSEC TEMPEST (клетка Фарадея) — все 6 поверхностей (стены, пол, потолок) — медная фольга 0.1 мм или сетка 0.5-1 мм с заземлением через 4-6 пунктов R≤0.1 Ом, ослабление эл. поля 100 дБ в диапазоне 10 кГц-10 ГГц; 2) Подвес. потолок и пол на виброамортизаторах Sylomer — защита от структурного звука (микрофоны через стены); 3) Стены двойные с минватой 200 мм + ГВЛ 12.5 мм × 2 слоя — Rw≥60 дБ воздушный звук; 4) Окна (если есть) с тройным стеклопакетом low-E + плёнка PE (защита от лазерного микрофона) или окон вообще нет; 5) Электропитание через изоляц. трансформатор 1:1 с EMI/RFI фильтрами Schaffner FN2090, без выхода за пределы SCIF; 6) Сетевые кабели — оптоволокно с шифрованием и медиаконвертерами Type 1 (категории NSA); 7) HVAC через звукозащитные камеры с U-образными вытяжными каналами (длина >2 м); 8) Дверь массивная сталь H=80 мм с уплотнениями + биометрия (отпечатки + Iris Scan), 2-факторная аутентиф. + комиссия; 9) Запрет проноса мобильных через RF Scanner Spectrum Analyzer (только в защищ. шкафах Faraday Bag); 10) Регулярный аудит — TSCM Technical Surveillance Counter-Measures сканирование 1 раз в 6 мес; NSTISSAM TEMPEST/1-92 + DCI Directive 6/9 + ISO/IEC 27001" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Площадь акимата</h2>
          <p className="text-slate-300">
            Акимат города 1.5 млн человек (как Алматы). Штат 850 сотрудников + 35 ВИП
            (аким + заместители + начальники управлений). Норма по СП РК 3.02-115:
            5-6 м²/чел рядового + 25-40 м²/чел ВИП + 1.5 м²/чел общие зоны + 30% технические/проходы.
            Какая полезная площадь нужна (м²)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            S = S_рабочие + S_ВИП + S_общие + S_техн<br />
            S_общие = (S_рабоч + S_ВИП) × 0.5 (приёмы, конференц-залы, столовая)<br />
            +30% коридоры, лестницы, санузлы, вестибюли
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Площадь, м²"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: 850 × 5.5 = 4675 + 35 × 32 = 1120 = 5795 м² рабочих; +50% общие (приёмы/залы) = +2900 = 8695 м²; +30% коридоры = +2600 = 11 300 м². С учётом представительских залов и архивов в гос. зданиях ~24 000 м² типично (как реальные акиматы РК Алматы 22 000 м², Шымкент 18 000 м², Атырау 14 000 м²).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет здания акимата 24 000 м²</h2>
          <p className="text-slate-300">
            ССЦ + импорт + спец. защита: монолит каркас + перекрытия 24 000 м² бетон B40 — 10 млрд тг,
            фасад премиум (натур. камень травертин + стеклопак. low-E) — 6.8 млрд тг,
            отделка premium кабинетов + представит. залов + лобби — 8.4 млрд тг,
            пленарный/конференц-зал амфитеатр 250 мест + AV-инфра + 6-яз. перевод — 3.6 млрд тг,
            SCIF-комнаты × 12 шт. (TEMPEST экран + двойные стены + биом. СКУД) — 4.8 млрд тг,
            HVAC прецизионный + АХУ + климат-зоны для архивов — 4.2 млрд тг,
            СКУД биом. + СОТ HD + СОС + рамки металлодетектор. + рентген. конвейеры — 3.8 млрд тг,
            СОУЭ 5-го типа + спринклер + ECARO 25 газ для серверных и архивов — 3.2 млрд тг,
            IT-инфра + цифровой архив + библиотека + правительств. интранет — 2.6 млрд тг,
            подзем. парковка ВИП 200 м/мест + лифты Schindler с приоритетом — 2.4 млрд тг,
            благоустройство + охранный периметр + ТП + ДГУ резерв — 2.4 млрд тг,
            проектирование + изыскания + согласования с КНБ/УОО + страхование — 3.8 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~56 млрд тг (допуск ±10%). 10+6.8+8.4+3.6+4.8+4.2+3.8+3.2+2.6+2.4+2.4+3.8 = 56 млрд тг. Удельная стоимость ~2.3 млн тг/м² — в 2-3× выше офисов класса А из-за SCIF, охраны, премиум-отделки.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Периметровая защита</h2>
          <p className="text-slate-300">
            Здание Парламента/Акимата — объект высокого уровня угрозы террор-актов.
            Какая периметровая защита по ANSI/ASIS PCS + ISO 28000?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Достаточно ограждения и КПП с шлагбаумом" },
              { v: "b", t: "Только видеонаблюдение по периметру" },
              { v: "c", t: "Multi-layer Defense in Depth: 1) Стандартная защита периметра (rubber barrier) — Anti-Ram стационарные/выдвижные болларды Atlas T3 (выдерживают грузовик 6.8 т @ 80 км/ч ASTM F2656 M50/P1), цементобетонные с виброизол.; 2) Промежуточная зона — ров с антиподкопом 1.5×1 м + сетка периметр. с волоконно-оптическим датчиком натяжения Senstar OmniTrax (обнаружение 99% попыток); 3) Внутренняя зона — забор 4 м + СО (Средства Обнаружения) комплексные: радиолокационный микроволн. детектор Bosch RD8 + ИК-датчики + сейсмо; 4) КПП Vehicle Inspection Area с подъёмной плитой + рентген. сканер контейнеров (Smiths Detection HCV-Mobile), персонал. сканеры тела Rohde&Schwarz QPS200, металлодетектор Garrett PD6500i, обыск ручной кладью; 5) Антидрон-система — детектор RF + GPS-jammer + сетка против БПЛА Rohde&Schwarz ARDRONIS; 6) Камеры IP HD 4K с тепловизором FLIR ThermiCam2 (день/ночь) + аналитика поведения OpenCV/AI; 7) КЦП Центр охраны с круглосуточным мониторингом 4 операторами на смену + дублирование в КНБ; 8) Аварийные эвакуац. лифты + Safe Room (бункер для VIP) на нижних уровнях; 9) Сертификация ISO 28000 Security Management + аудит каждые 12 мес; 10) Тренировки персонала с симул. вторжения каждые 6 мес; ANSI/ASIS PCS-2024 + ISO 28000 + DHS NIPP + опыт Pentagon Force Protection Agency" },
              { v: "d", t: "Только биометрический СКУД на входах" },
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
                {score === 4 ? "Отлично — готовы к проектированию гос. зданий" : score >= 2 ? "Перечитайте СП РК 3.02-115 + NSTISSAM TEMPEST + ANSI/ASIS PCS" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СП РК 3.02-115 (Общественные), NSTISSAM TEMPEST/1-92 (SCIF), DCI Directive 6/9, ANSI/ASIS PCS-2024 (Physical Security), ISO 28000 (Security Mgmt), ASTM F2656 (Vehicle Barriers).</p>
          <p><strong>Реальные объекты РК:</strong> Парламент РК «Дом Парламента» Астана (56 000 м²), Акорда Резиденция Президента (36 720 м²), Министерские здания левого берега Астаны, Акиматы Алматы/Шымкент/Атырау.</p>
        </section>
      </main>
    </div>
  );
}
