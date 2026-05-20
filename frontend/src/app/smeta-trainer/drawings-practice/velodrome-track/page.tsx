"use client";
import Link from "next/link";
import { useState } from "react";

export default function VelodromeTrackPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 42) <= 4;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 22_000_000_000) <= 2_200_000_000;

  const correct = {
    ex1: ex1 === "c",
    ex2: ex2Correct,
    ex3: ex3Correct,
    ex4: ex4 === "d",
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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Велотреки крытые</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🚴 Крытые велотреки UCI</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #249. Крытые велотреки РК: Velodrome Astana «Сарыарка» (250-метровая
            овальная трасса, открыт 2011 г., 9 000 мест), Алматинский велотрек
            «Тулпар» (планируется на 2026-2027 гг.). Стандарт UCI Indoor Track:
            длина 250 м, прямые 60 м с банковкой 12°, виражи R=23 м с банковкой 42°,
            ширина дорожки 7-8 м, деревянный настил Балтийская сосна / Канадский
            клён, освещение 1500 лк UCI Tier 1, акустика, табло Daktronics. СН РК
            4.02-12, UCI Velodrome Standards 2024, FFC France Track Standards.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Геометрия трассы 250 м</h2>
          <p className="text-slate-300 leading-relaxed">
            UCI Velodrome Standards 2024 + FFC Pista Standards:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Длина по «измерительной линии» (Black Line):</strong> 250.0 м точно (для записи мировых рекордов UCI признаёт только треки 250 м и 333.33 м).</li>
            <li><strong>Прямые участки:</strong> длина 60-65 м, ширина 7-8 м, угол банковки α=12-15°.</li>
            <li><strong>Виражи (Curves):</strong> радиус 23-25 м, угол банковки α=42-45° (для V_max=70-80 км/ч и центробежной силы в комфорте).</li>
            <li><strong>Зоны разметки:</strong> Black Line (250 м), Sprint Line (90 см выше), Stayer Line (стайерская, 2.5 м выше), Blue Strip (синяя полоса — для откатки за стайером).</li>
            <li><strong>Боковые подъёмы (Apron):</strong> внутренний плоский круг для разминки + внешний край с зрит. трибуны.</li>
            <li><strong>Внутреннее поле (Infield):</strong> 80 × 60 м для других видов спорта (баскетбол, гандбол при перепрофилировании).</li>
            <li><strong>Стартовые ворота (Starting Gates):</strong> механизированные с электронным замком (для команд. гонок).</li>
            <li><strong>Хронометраж:</strong> Tissot или Omega с photofinish камерами + транспондеры на велосипедах (точность 1 мс).</li>
            <li><strong>Антидопинг-зона + Технич. ремонт (Wheel Pit + Mechanic Area):</strong> для замены колеса в гонке.</li>
            <li><strong>Освещение:</strong> 1500 лк UCI Tier 1 рабочее, 2500 лк для ТВ (LED Musco SportsCluster без мерцания для замедл. съёмки).</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Деревянный настил</h2>
          <p className="text-slate-300">
            Деревянный настил велотрека работает в условиях климата (для Астаны:
            t° от −40°C зимой до +40°C летом, отопление зала +18-22°C, RH 40-60%).
            Какая порода и конструкция настила по UCI?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Дешёвая сосна обычная без сушки" },
              { v: "b", t: "Дуб массив 50 мм — традиционно для интерьеров" },
              { v: "c", t: "Балтийская сосна на виражах + Канадский клён на прямых (Multilayer Maple System): 1) Опорная стальная решётчатая ферма из труб Ø60-100 мм с уплотнённым шагом 600×600 мм (на виражах с двойным усилением), фиксация к закладным анкерным узлам в ж/б основании; 2) Опорные балки сосна Pinus sylvestris (Балтийская, Финляндия / Россия) предв. камерной сушки до 8-10% влажности, сечение 60×120 мм с шагом 200 мм; 3) Промежут. слой кленовых ламелей Acer saccharum (Канадский клён, твёрдость по Janka 1450 lbf) толщ. 12 мм; 4) Финиш. слой кленовый shipboard 40 мм, шпунтованные доски ширина 95 мм длина 1.5-2 м, крепление потайными саморезами через 200 мм по краю + центру; 5) Влагозащитное покрытие 2 слоя матового полиуретанового лака Bona Traffic HD (10-15 г сухого остатка/м²) — антискольжение, защита от пота, обновляется каждые 3-5 лет; 6) Контроль микроклимата круглый год: t°=20-22°C ±1°C, RH=50% ±5% (защита от деформаций дерева ±0.5 мм/м); 7) Краска для разметки эпоксидно-полиуретановая Sherwin-Williams Athletic Track Paint (запуски/финиш чёрный, спринт — красный, стайер — синий по UCI правилам); 8) Сертификация UCI Pista Approval + FIBA Track Approval (если совмещается с баскетбольной); 9) Срок службы базового настила 30-40 лет, верхний слой — 5-10 лет; 10) Реальный пример: Velodrome Astana — Балтийская сосна, Lee Valley London — клён, Manchester — берёза с клёном" },
              { v: "d", t: "Композитные синтетические листы Mondotrack — современнее дерева" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Банковка виражей</h2>
          <p className="text-slate-300">
            Трасса 250 м UCI: виражи радиусом R=23 м, расчётная скорость V_max=75 км/ч
            (20.83 м/с). Какой минимальный угол банковки α нужен для безопасного
            прохождения виража без скольжения (коэф. трения дерево-резина μ=0.8)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            tan(α) = V²/(g × R)<br />
            (Идеальный угол: центробеж. сила полностью компенсируется компонентом веса)<br />
            +5° резерв для манёвров
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="α, градусов"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: tan(α) = 20.83² / (9.81 × 23) = 434 / 226 = 1.92; α = arctan(1.92) = 62.5°. Это идеальный угол для V=75 км/ч. Реальный угол UCI 42-45° — компромисс между комфортом гонщика, безопасностью при низких скоростях и удобством разминки. Для V=75 км/ч на 42° есть некоторая остаточная центроб. сила, гасящаяся трением.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет велотрека</h2>
          <p className="text-slate-300">
            Velodrome 9000 мест UCI Class 1. ССЦ + импорт: монолит каркас + ферменная
            крыша 35×120 м (4200 м² по покрытию) — 4.8 млрд тг,
            трибуны 9000 мест + кресла Daplast + узлы доступа — 2.4 млрд тг,
            каркас велотрека стальной с виражами R=23 м, банковка 42° — 3.6 млрд тг,
            деревянный настил Балтийская сосна + Канадский клён (1800 м²) — 1.4 млрд тг,
            покрытие лак Bona Traffic HD + разметка UCI — 0.3 млрд тг,
            хронометраж Omega + табло Daktronics + транспондеры — 1.4 млрд тг,
            освещение LED Musco 1500/2500 лк × 240 прожекторов — 1.6 млрд тг,
            ВРС зала отделка + раздевалки 8 шт + допинг — 1.8 млрд тг,
            HVAC прецизионный (t° 20-22°C ±1°C, RH 50%) для дерева — 2.8 млрд тг,
            СОУЭ + СОТ + СКУД + противопожарная — 0.8 млрд тг,
            АВ-инфра + студии трансляции UCI ТВ — 0.6 млрд тг,
            благоустройство + парковка + энергоснабж. ТП + ДГУ — 0.6 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~22 млрд тг (допуск ±10%). 4.8+2.4+3.6+1.4+0.3+1.4+1.6+1.8+2.8+0.8+0.6+0.6 = 22 млрд тг. Реальный Velodrome Astana «Сарыарка» (2011) — оценочно $50 млн ≈ 16 млрд тг (в ценах 2011). В ценах 2026 + UCI Class 1 уровень = ~22-25 млрд тг.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Микроклимат для дерева</h2>
          <p className="text-slate-300">
            Деревянный настил велотрека критически зависит от микроклимата зала.
            Какие требования UCI Indoor Track + AASHTO Wood Engineering?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Любые комфортные t° и влажность для зрителей" },
              { v: "b", t: "Только обогреватели на крыше для зимы" },
              { v: "c", t: "Только кондиционирование зала на стандартные +24°C" },
              { v: "d", t: "Прецизионный микроклимат-контроль 24/7/365 для защиты деревянного настила: 1) Температура +20-22°C ±1°C круглый год (стабильная, без перепадов более 3°C/сутки — иначе дерево деформируется); 2) Относительная влажность 50% ±5% (40-60% — диапазон стабильности дерева, ниже 40% — рассыхание и трещины, выше 60% — коробление и плесень); 3) Скорость движения воздуха над треком ≤0.2 м/с (нельзя «дуть» прямо на дерево — локальное иссушение); 4) Темп. изменения параметров ≤2°C/час и ≤5%/час относ. влажности; 5) Многоступенчатая HVAC система: чиллеры + центральные АХУ Munters с пароувлажнением (Steam Humidifier) + точечные осушители Munters для зон с конденсатом; 6) Датчики микроклимата HOBO MX2301 размещены каждые 25 м по площади трека + дополнительно на виражах (где конденсация выше); 7) AСУ-климат Honeywell Excel Smart 5000 с автоматич. коррекцией параметров по прогнозу погоды (anticipatory control); 8) Отопление через подпольные регистры на периметре зала (не вблизи трека); 9) Защита трека от прямого солнечного света — затемнённые окна или жалюзи (UV выцветает лак); 10) Регулярное обслуживание HVAC и калибровка датчиков каждые 6 мес; UCI Indoor Track Standards + AASHTO Wood Engineering + ASHRAE 55 (Thermal Comfort) + ASHRAE 62.1 (Indoor Air Quality)" },
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
                {score === 4 ? "Отлично — готовы к проектированию велотрека" : score >= 2 ? "Перечитайте UCI Velodrome Standards + ASHRAE 55/62.1" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> UCI Velodrome Standards 2024, FFC Pista Standards, ASHRAE 55 (Thermal Comfort), ASHRAE 62.1, AASHTO Wood Engineering, СН РК 4.02-12, ISO 7250.</p>
          <p><strong>Реальные объекты РК и мир:</strong> Velodrome Astana «Сарыарка» (250 м, 9000 мест, 2011), планируемый Алматы «Тулпар», Lee Valley London 2012, Manchester Velodrome (NCC UK), Apeldoorn Omnisport (NL).</p>
        </section>
      </main>
    </div>
  );
}
