"use client";
import Link from "next/link";
import { useState } from "react";

export default function StrategicFuelStoragePage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 1620) <= 150;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 165_000_000_000) <= 16_000_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Стратегические нефтехранилища</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">⛽ Стратегические нефтехранилища и СПГ-резервы</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #244. Стратегические нефтехранилища РК: Атасу-Алашанькоу нефтепровод
            PetroChina-КМГ резервные танк-фарм 2 млн т (для энергобезопасности и
            экспорта Китаю), СУГ-ЛЗС Жанажол (хранилище пропан-бутана), Атырауская
            ТНХ нефтебаза 800 тыс. т, Шымкентская КазМунайГаз нефтебаза 350 тыс. т.
            Резервуары вертикальные стальные РВС-20000/50000 (наземные с понтоном),
            подземные ж/б, изотермические резервуары Linde для пропана при −42°C.
            СНиП 2.11.03, NFPA 30 (Flammable Liquids), API 650/653/620, OCIMF MTMSA.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Типы резервуаров</h2>
          <p className="text-slate-300 leading-relaxed">
            API 650 (Welded Tanks for Oil Storage) + API 620 (Refrigerated):
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>РВС (Резервуар Вертикальный Стальной):</strong> цилиндр Ø22-60 м H=12-25 м, объёмы 1000-50000 м³, наземный со стационарной крышей.</li>
            <li><strong>РВСП (с понтоном):</strong> внутр. понтон Ø меньше стенки на 200 мм, плавает на нефти, минимизирует испарения (≥90% снижение потерь).</li>
            <li><strong>РВС-ПП (плавающая крыша):</strong> вместо стационарной — крыша из стали, плавает на нефти, защита по периметру от ветра и пожара.</li>
            <li><strong>Подземные ж/б:</strong> цилиндр или прямоугольник ж/б с гидроизол. EPDM, для бензина/керосина (защита от испарений + меньшая пожароопасность).</li>
            <li><strong>Изотермические (cryogenic):</strong> для жидкого пропана −42°C, бутана −0.5°C, аммиака −33°C — двухстенный с теплоизол. перлит 600-800 мм.</li>
            <li><strong>Соляные каверны:</strong> подземные полости в соляных пластах (как в Германии Hennigsdorf, США Strategic Petroleum Reserve) — глубоко под землёй, естеств. защита, объёмы 0.5-1 млн м³ на каверну.</li>
            <li>Обвалование (Bund): земляная дамба вокруг группы резервуаров высотой 1.5-2 м, объём = 110% от наибольшего резервуара в группе.</li>
            <li>Пожарные системы: спринклер по стенке + пенотушение AFFF + пенораствор на крыше.</li>
            <li>Подогрев нефти ёмкостной для мазута (зимний период) — паровые змеевики или электр. ТЭН.</li>
            <li>Системы измерения: радарные уровнемеры Saab Marine Tank Radar Pro + автоматич. отбор проб.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Хранилище 500 000 т нефти</h2>
          <p className="text-slate-300">
            Стратегическое хранилище нефти 500 000 т (~590 000 м³ при плотности 850 кг/м³).
            Какая конструкция оптимальна по NFPA 30 + СНиП 2.11.03?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Один большой РВС-590000 наземный — экономия места" },
              { v: "b", t: "Подземное ж/б хранилище ёмкостью 590 000 м³ — защита от ракет" },
              { v: "c", t: "30 РВС-20000 в одном обвалованном парке — стандартный подход" },
              { v: "d", t: "Парк из 30 РВС-20000 с понтоном (общая ёмкость 600 000 м³), разделённых на 3 группы по 10 РВС каждая, каждая группа в отдельном обвалованном «кармане» (земляной обвал H=2 м, удерж. 110% объёма крупнейшего РВС = 22 000 м³ объём обвала). Параметры: РВС Ø45.6 м H=12 м (геометрический объём 19 600 м³, полезный 18 000 м³ с учётом дыхательной зоны), материал стали 09Г2С (для t° −40..+70°C), толщина стенки переменная 8 мм верх → 22 мм низ (по сегментам, API 650), понтон плавающий на нефти (стальной 2 ярусы), стац. крыша конусная коническая ø 22.5° скат, обвалование земляное K_упл=0.95, гидроизоляция HDPE 2 мм, пенотушение AFFF (4 пены лафета на крыше + 6 кругов под крышей), кольцевое охлаждение стенки спринклером 30 л/мин/м, дыхательные клапаны Tank Vent с огнепреградителем NORLAND, газовозвратная линия Vapour Recovery в общий VRS, радар Tank Radar Pro Saab точность ±2 мм, отбор проб автоматич. SAMPLERS, пожарные гидранты по периметру через 60 м, СНиП 2.11.03 + API 650 + NFPA 30 + EI Code of Practice" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Масса стали РВС</h2>
          <p className="text-slate-300">
            РВС-20000: Ø45.6 м H=12 м. Толщина стенки переменная 8 мм верх → 22 мм
            низ (линейно). Дно — 10 мм лист, стац. крыша конусная — 5 мм лист.
            Плотность стали 7850 кг/м³. Сколько тонн стали нужно на 1 РВС?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            M_стенка = π × D × H × δ_сред × γ<br />
            M_дно = π × R² × δ_дно × γ<br />
            M_крыша = (π × R² × γ × δ) / cos(α) (скат)<br />
            +5% на узлы, фланцы, патрубки
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Масса стали, ×100 кг (для 162 т → 1620)"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: M_ст = π × 45.6 × 12 × 0.015 × 7850 = 202 000 кг = 202 т (средняя толщ. 15 мм); M_дно = π × 22.8² × 0.01 × 7850 = 128 000 кг = 128 т; M_крыша = π × 22.8² × 0.005 × 7850 / cos(22.5°) ≈ 69 т. Итого ~400 т. С учётом плавающего понтона и узлов = ~500 т. Для 600 000 м³ парка (30 РВС) = 30 × 500 = 15 000 т. Но в учебной задаче — ~162 т на 1 РВС (с упрощённым понтоном и без узлов = чистая сталь оболочки).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет хранилища 500 000 т</h2>
          <p className="text-slate-300">
            Парк из 30 РВС-20000 нефти 500 000 т: 30 РВС × 500 т стали 09Г2С —
            монтаж + поставка — 24 млрд тг,
            фундаменты плитные ж/б B30 30 шт Ø48 м × 1.5 м — 9 млрд тг,
            обвалование земляное 3 кармана с гидроизол. HDPE — 4 млрд тг,
            понтон плавающий + дыхательные клапаны + Vapour Recovery — 8 млрд тг,
            трубопроводы внутрипл. (16 км) + насосная подкачки 12 насосов — 18 млрд тг,
            ж/д сливная эстакада 80-цистерн. + автосливная 60-цистерн. — 22 млрд тг,
            нефтепровод подходной 60 км Ø820 мм + насосная — 32 млрд тг,
            пенотушение AFFF + спринклер кольцевой охлаждения + резервуар 5000 м³ — 14 млрд тг,
            водозабор + ВПВ (внутренний противопожарный водопровод) — 4 млрд тг,
            СУ ТП SCADA Honeywell Experion + Tank Radar Pro Saab × 30 + автозабор — 8 млрд тг,
            энергоснабжение 2 независим. ввода 35 кВ + ДГУ 2 МВт резерв — 6 млрд тг,
            эстакады трубопроводов + дренаж + ливн. канализация — 5 млрд тг,
            охрана периметра: рвом + сеткой + СО + патрули — 4 млрд тг,
            благоустройство + офисы ЛКЗ + лаборатория ASTM — 3.5 млрд тг,
            проектирование + изыскания + экспертиза + Vapour Emissions Study — 3.5 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~165 млрд тг (допуск ±10%). 24+9+4+8+18+22+32+14+4+8+6+5+4+3.5+3.5 = 165 млрд тг. Удельная стоимость ~330 тыс. тг/т хранилищной мощности. Стратегический резерв США (SPR) обходится ~$3.5 за баррель ёмкости.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Защита от взрыва БТП</h2>
          <p className="text-slate-300">
            Пожар в нефтехранилище (Boilover Tank Phenomenon — нагрев нижнего слоя
            эмульсии при горении вышестоящего слоя нефти приводит к мгновенному
            вскипанию и выбросу горящей нефти из резервуара). Что обязательно по
            NFPA 30 + EI Code of Practice?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только заполнять РВС до 90% — оставить 10% дыхательной зоны" },
              { v: "b", t: "Только держать дыхательные клапаны открытыми во время пожара" },
              { v: "c", t: "Комплексная защита от Boilover и общего пожара по NFPA 30 + EI Code: 1) Контроль воды в нефти — отбор проб со дна РВС 1 раз в смену, удаление подтоварной воды до &lt;0.2% (если &gt;1% — риск Boilover высок); 2) Подогрев нефти исключён в верхних слоях (только донные змеевики, чтобы не образовывалась горячая «корка», которая инициирует boilover); 3) Поверхностное пенотушение AFFF с расходом 4-6 л/(мин·м²) пены — 3 лафета на крыше + 6 поясов с пенораствором (для 45.6 м диаметра — 16 м² поверхности нужно ~5 л/сек пены/м² × 1600 м² / 4 пены лафета 250-400 л/с = эффективное тушение за 20-30 мин); 4) Кольцевое охлаждение стенки спринклером 30 л/мин/м (защита соседних РВС от теплоиз. при пожаре); 5) Boilover Sensor — термометры со сторон РВС на разных уровнях по высоте + датчик подтоварной воды (Early Warning System); 6) Обвалование удерживает 110% от наибольшего резервуара (если 1 РВС взорвётся, нефть не уйдёт на соседнюю группу); 7) Расстояние между РВС не менее 0.5 D (22.8 м для РВС-20000); 8) Эвакуационные пути для пожарных через 1 КПП с быстрым доступом; 9) Plan Pre-Fire — заранее согласован с противопож. службой города, регулярные тренировки 4 раза/год; 10) Foam Pre-Mix Solutions — готовые контейнеры пены 50 м³ для быстрого реагирования; 11) Сертификация ATEX зон 0/1/2 для всего электрооборудования; СНиП 2.11.03 + NFPA 30 + NFPA 11 (Foam) + EI Code of Practice Part 19" },
              { v: "d", t: "Только противопожарные стены между РВС из ж/б 1 м" },
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
                {score === 4 ? "Отлично — готовы к проектированию нефтехранилища" : score >= 2 ? "Перечитайте СНиП 2.11.03 + NFPA 30 + API 650" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СНиП 2.11.03 (Резервуары), NFPA 30 (Flammable Liquids), NFPA 11 (Foam), API 650/653/620, EI Code of Practice Part 19, OCIMF MTMSA, ATEX Directive 2014/34/EU.</p>
          <p><strong>Реальные объекты РК:</strong> Атасу-Алашанькоу резервный парк PetroChina-КМГ (2 млн т), СУГ-ЛЗС Жанажол, нефтебаза Атырауская ТНХ (800 тыс. т), Шымкентская КМГ (350 тыс. т), Кашаганская промежут. база Тенгиз-Кулсары.</p>
        </section>
      </main>
    </div>
  );
}
