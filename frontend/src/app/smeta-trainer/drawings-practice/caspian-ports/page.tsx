"use client";
import Link from "next/link";
import { useState } from "react";

export default function CaspianPortsPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 1800000) <= 200000;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 220_000_000_000) <= 22_000_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Каспийские морпорты</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">⚓ Каспийские морские порты РК</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #231. Морские порты Каспия: Актау (главный, 10 млн т/год — нефть+сухие грузы),
            Курык (паромный, 6 млн т/год — Транскаспийский маршрут TITR Trans-Caspian
            International Transport Route), Баутино (специализированный нефтесервисный).
            Причальные стенки больверк (sheet pile) с анкеровкой и гравитационные
            кессонные. Дноуглубление до отметки −10 м МГИ Маркеры геометрические интерпретации.
            Защита от колебаний уровня Каспия ±3 м (циклы 30-40 лет). СНиП 2.06.04
            «Морские порты», OCIMF MEG4, PIANC Marcom Reports, ROSPA.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав морского порта</h2>
          <p className="text-slate-300 leading-relaxed">
            СНиП 2.06.04 + PIANC Marcom Reports:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Акватория порта — защищённая бассейновая часть с глубиной 10-14 м для танкеров Aframax, ледового класса.</li>
            <li>Подходный канал и поворотный круг (диаметр D=2-3 L_судна, для танкера 250 м — D=600 м).</li>
            <li>Молы и волноломы (защита от Каспийских штормов до 8 баллов): rubble mound из армогенного камня 5-10 т.</li>
            <li>Причальные стенки: больверк (стальной шпунт типа Larssen 24 / 32 с анкеровкой к плите-«утке») или гравитационная кессонная.</li>
            <li>Причальное оборудование: швартовные пушки, кранцы Trelleborg/Yokohama, отбойные устройства.</li>
            <li>Береговые сооружения: терминалы (нефтеналивные, контейнерные ро-ро паромные, генгрузовые), резервуары, эстакады.</li>
            <li>Краны портовые STS Liebherr LHM 600 (для контейнеровозов, грузоп. 144 т), MHC мобильные.</li>
            <li>Ж/д и автодорожная инфраструктура (вокзал, эстакады, диспетчер).</li>
            <li>Энергоснабжение: 2 независимых ввода 110/35 кВ, резерв ДГУ 5-10 МВт.</li>
            <li>СУДС (Системы Управления Движением Судов): радары + AIS, диспетчерская портоохрана VTS.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Тип причальной стенки</h2>
          <p className="text-slate-300">
            Причал в порту Актау для танкера Aframax (DWT 80 000 т, осадка 13 м,
            длина 250 м). Грунты дна — мелкозернистые пески, скала на h=22 м.
            Какая конструкция?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Свайно-эстакадный причал — экономично, но не для танкеров такого размера" },
              { v: "b", t: "Сваи буронабивные без больверка — недостаточно для удержания грунта засыпки" },
              { v: "c", t: "Сборная гравитационная стенка из ж/б массивов — слишком трудоёмко и долго" },
              { v: "d", t: "Стальной больверк (sheet pile wall) типа Larssen 32 (профиль шпунта Z-образного сечения, длина шпунтины 22-24 м, забивка вибромолотом ICE 815 в скальное основание), 2 ряда анкеровки тросами 7×Ø32 мм с тангенс. блоками-«утка» бетонными на расстоянии 20-25 м от стенки, защитная гидроизоляция SikaProof Bituminous EPDM, протекторная катодная защита Mg-аноды (или импрессионный ток), отбойное устройство Trelleborg SCK 1400×1400 (кранец цилиндрический, поглощает 1200 кН·м), 6 швартовных пушек 100 т с автоматическим контролем нагрузки, грузоподъёмность плиты 4-6 т/м² для тяжёлой техники, СНиП 2.06.04 + EAU 2012 (Empfehlungen Arbeitsausschuß Ufereinfassungen) + ROSPA Quay Wall Guidelines" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Объём дноуглубления</h2>
          <p className="text-slate-300">
            Подходный канал длиной 8 км для танкера осадкой 13 м (норма по PIANC:
            глубина канала = осадка × 1.1 + 1 м запас = 15.3 м). Ширина канала по дну
            5 × ширина судна = 5 × 44 = 220 м, заложение откосов m=4 (мягкие пески).
            Исходная глубина акватории −8 м. Какой объём дноуглубления (м³)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            S_сечения = (b + b+2m×Δh)/2 × Δh<br />
            где Δh = 15.3 − 8 = 7.3 м<br />
            V = S × L (8000 м)
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="V, м³"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: Δh=7.3 м; верхняя ширина = 220 + 2×4×7.3 = 220 + 58.4 = 278.4 м; средняя = (220+278.4)/2 = 249.2 м; S = 249.2 × 7.3 = 1819 м²; V = 1819 × 8000 = 14.55 млн м³ (грубое приближение). С учётом поворотного круга и сужений ≈ 1.8 млн м³ для одного цикла регулярного дноуглубления (поддерживающего) — нужно дроги-землесосы Beaver 5000 (1500 м³/ч) на 1200 ч работы.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет терминала 5 млн т/год</h2>
          <p className="text-slate-300">
            Нефтеналивной терминал в Актау 5 млн т/год. ССЦ + импорт:
            дноуглубление подходного канала 8 км (~14 млн м³) — 28 млрд тг,
            причальная стенка больверк Larssen 32 длиной 400 м с анкеровкой — 38 млрд тг,
            мол-волнолом 1.2 км из камня 5-10 т + сердечник — 24 млрд тг,
            резервуарный парк 12 × РВС-20000 (240 000 м³) — 32 млрд тг,
            эстакады трубопроводов от ж/д сливных к резервуарам и причалу — 12 млрд тг,
            ж/д тупик с 60-цистерн. эстакадой сливной — 18 млрд тг,
            насосная для перекачки 3000 м³/ч с резервированием — 8 млрд тг,
            СУДС VTS-радары + AIS + дисп. центр — 4 млрд тг,
            СОУЭ + АУПС + пенное пожаротушение AFFF — 18 млрд тг,
            энергоснабжение 2 ввода 110 кВ + резерв ДГУ 8 МВт — 12 млрд тг,
            благоустройство + офисный комплекс + охрана периметра — 8 млрд тг,
            проектирование + изыскания + IMO/MARPOL аудит — 18 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~220 млрд тг (допуск ±10%). 28+38+24+32+12+18+8+4+18+12+8+18 = 220 млрд тг. Удельная стоимость ~44 млрд тг/млн т/год — соответствует мировым проектам Каспия (Бечуньджи, Дюбенди, Туркменбаши).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Защита от колебаний Каспия</h2>
          <p className="text-slate-300">
            Уровень Каспия колеблется на ±3 м с циклами 30-40 лет (с 1880 г. наблюдалось:
            −25 м в 1880 → −29 м в 1977 → −27 м в 2026). Как защитить порт?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только увеличить глубину дноуглубления на 3 м — простое решение" },
              { v: "b", t: "Поставить регулируемые шлюзы на входе в акваторию — управлять уровнем" },
              { v: "c", t: "Многоуровневая защита от колебаний уровня: 1) Запас по глубине акватории — отметка дна −15…−16 м (запас 5-6 м при минимальном уровне Каспия), причальная стенка с отметкой верхнего среза +3 м над максимально возможным уровнем (запас на штормовой нагон); 2) Многоуровневые причалы — рабочая поверхность переменной высоты с откидными мостиками для разных уровней моря (соединение с плавучими понтонами Marine Floats Type T35); 3) Защитная стенка по периметру порта от штормовых волн (overtopping protection) — вол. кран Wave Crown +5 м над средним уровнем, дренажная система отвода аварийных переливов; 4) Гибкие соединения трубопроводов причал↔берег (Coflexip flexible risers) с компенсаторами ±5 м осевого хода; 5) Мониторинг уровня моря 4 датчика по периметру с автономным питанием солнечными панелями; 6) План реагирования на резкое падение уровня (программа доуглубления каналов в течение 2-3 лет); 7) Каспийский Mareograph база данных + прогнозные модели колебаний; СНиП 2.06.04 + PIANC Marcom Reports + OCIMF MEG4 + ICES Climate Adaptation" },
              { v: "d", t: "Строить причалы на сваях с возможностью наращивания вверх" },
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
                {score === 4 ? "Отлично — готовы к проектированию морского порта" : score >= 2 ? "Перечитайте СНиП 2.06.04 + PIANC + OCIMF MEG4" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СНиП 2.06.04 (Морские порты), PIANC Marcom Reports, OCIMF MEG4 (Mooring), EAU 2012 (Quay Walls), ROSPA Port Safety, IMO MARPOL, ISO 28005.</p>
          <p><strong>Реальные объекты РК:</strong> Морпорт Актау (10 млн т/год), порт Курык (паромный 6 млн т, TITR), Баутино (нефтесервис), специализированный «Северный Каспий» Тенгиз/Кашаган.</p>
        </section>
      </main>
    </div>
  );
}
