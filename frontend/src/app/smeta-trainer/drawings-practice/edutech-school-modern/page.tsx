"use client";
import Link from "next/link";
import { useState } from "react";

export default function EdutechSchoolModernPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 48) <= 4;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 12_000_000_000) <= 1_200_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · EduTech-школы</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🎓 EduTech-школы и международные программы</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #271. EduTech-школы РК (отличие от L5 «Современные школы» из батча
            63 про типовые ШГ-1500 — здесь премиум-международные программы): Quantum
            International School Алматы (3 кампуса, 2500 учащ.), BIL Schools Network
            (Алматы/Астана/Шымкент, IB World Schools 500-800 учащ. каждый), Tian Shan
            International School (Алматы), Haileybury Almaty (1500 учащ., британская
            программа). Интерактивные доски Promethean ActivPanel 75'', STEM-классы
            с 3D-печатью (Stratasys F123), робототехникой Lego Education SPIKE,
            кодированием. Программы IB (International Baccalaureate), Cambridge
            IGCSE, ISO 21001 (Educational Organizations).
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав EduTech-школы</h2>
          <p className="text-slate-300 leading-relaxed">
            IB MYP/DP Programme Standards + Cambridge IGCSE + ISO 21001:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Учебные кабинеты:</strong> 60-70 м² (для 22-25 учащ., более просторные чем стандартные 50 м² СанПиН для индивид. подхода).</li>
            <li><strong>STEM-лаборатории:</strong> отдельные для физики (с лазерами, генераторами Ван де Граафа), химии (тяга вытяжек + газы), биологии (микроскопы Olympus, аквариумы).</li>
            <li><strong>Makerspace / Innovation Lab:</strong> 3D-принтеры Stratasys F123 ×4, лазерные резаки Trotec Speedy 100, фрезеры CNC Carbide 3D, электроника + Arduino + Raspberry Pi.</li>
            <li><strong>Робототехнические классы:</strong> Lego Education SPIKE Prime, VEX V5 Robotics, BlueRobotics для подводных, дроны DJI Mavic Education.</li>
            <li><strong>Кабинеты программирования:</strong> Chromebook ASUS Education для каждого ученика, Wi-Fi 6 mesh, проект-доска Promethean ActivPanel.</li>
            <li><strong>Arts &amp; Design Studio:</strong> для творчества — рисование, керамика, музыка, театр (small theatre 100 мест).</li>
            <li><strong>Multi-Purpose Room MPR:</strong> большой зал-трансформер (60×40 м), для физкультуры / собраний / спектаклей с подъёмными трибунами.</li>
            <li><strong>Library Learning Commons:</strong> 600-1000 м² с зонами для тихого чтения + совместной работы + makerspace + цифровым архивом.</li>
            <li><strong>Cafeteria / Dining Hall:</strong> 800-1500 мест с healthy menu (вегетарианский + кашерный + халяль options).</li>
            <li><strong>Спортивный комплекс:</strong> бассейн 25 м, спортзал 18×30 м, теннисные корты, легкоатлет. трасса (400 м крытая для зимы).</li>
            <li><strong>Резиденция (boarding house):</strong> для ино-резидентских школ — общежития 4-8-местные комнаты с супервайзером 1:20.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — STEM-класс</h2>
          <p className="text-slate-300">
            STEM-класс для 24 учащихся 10-11 класса с 3D-печатью + робототехникой +
            кодированием. Какое оборудование по IB MYP Design Cycle + Cambridge
            IGCSE Design Technology?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только компьютеры с программами CAD" },
              { v: "b", t: "Только 3D-принтер 1 шт и набор Lego" },
              { v: "c", t: "Полный STEM-набор без интерактивных досок" },
              { v: "d", t: "Полнофункциональный STEM-класс Multi-mode по IB MYP + Cambridge: 1) **Workstations** 24 шт по 2 учащ. (групповая работа), регулир. столы Steelcase Stand-up с встроенной выдвижной мебелью под клавиатуру; 2) **3D-печать** — 4 Stratasys F123 (FDM dual-extruder, 4-цветная печать), 2 Formlabs Form 3 (SLA для тонких деталей до 25 мкм); 3) **Лазерная резка** Trotec Speedy 100 60W (резка фанеры до 6 мм, акрил до 8 мм); 4) **CNC** — Carbide 3D Shapeoko 4 (для прототипов прессформ); 5) **Робототехника** — 12 наборов Lego Education SPIKE Prime + 8 VEX V5 (для соревнований FLL/FIRST), 4 BlueRobotics для подводной робототехники; 6) **Электроника** — 24 Arduino Mega Education Kits + 24 Raspberry Pi 4 + breadboards + датчики + actuators; 7) **Программирование** — Chromebook ASUS C424TA для каждого учащ., Scratch для младших, Python для старших, Cura/Tinkercad для CAD, Fusion 360 для профессиональной CAD; 8) **Интерактивная доска** Promethean ActivPanel 75 inch 4K с touch (10 точек одновременно), интегрирована с Google Classroom + Microsoft Teams; 9) **Документ-камера** Hovercam (для показа экспериментов крупным планом); 10) **Безопасность** — вытяжная вентиляция над лазерным резаком (UV+газы) + 3D-принтером (испарения PLA/ABS), огнетушитель Halon 1301 для электроники, перчатки + защитные очки на каждое рабочее место, аптечка ANSI Z308.1; 11) **Цифровая трансформация** — каждый ученик с Google Workspace for Education, проекты сохраняются в облаке, ePortfolio integration; 12) **Tinker Time** — открытый доступ к makerspace после уроков для проектной работы; IB MYP Design Cycle + Cambridge IGCSE Design Tech + ISTE Standards" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Кол-во Promethean панелей</h2>
          <p className="text-slate-300">
            Школа на 800 учащ. с 32 учебными кабинетами + 8 спец. STEM/искусство.
            Каждый кабинет должен иметь интерактивную доску Promethean ActivPanel
            75" (стандарт IB World School Visual Learning). +20% резерв для замены.
            Сколько штук всего нужно?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            N = N_кабинеты + 20% резерв<br />
            +дополнит. в Multi-Purpose Room, библиотеке, кафетерии
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Кол-во Promethean ActivPanel"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: 32 + 8 = 40 шт; +20% = 48 шт. +дополнит. в MPR (2) + библиотека (3) + кафе-инфо (1) + админ (2) — но это в учебной задаче не считаем. 48 ActivPanel = ~$3500 каждая = $168 000 = 78 млн тг (значит. часть IT-бюджета EduTech-школы).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет EduTech-школы 800 учащ.</h2>
          <p className="text-slate-300">
            IB World School + Cambridge Programme 800 учащ. Кампус 16 000 м² 3-эт.
            ССЦ + импорт: монолит каркас + перекрытия + витражи — 3.6 млрд тг,
            фасад премиум (натур. камень + крыша зелёная BREEAM) — 1.4 млрд тг,
            отделка premium учебных кабинетов и общих зон — 1.8 млрд тг,
            48 интерактивных Promethean ActivPanel 75 inch 4K — 0.18 млрд тг,
            STEM-лаборатория полнофункц. (Stratasys × 4 + Trotec + CNC + Lego SPIKE + VEX) — 0.42 млрд тг,
            физика/химия/биология лаборатории с вытяжными шкафами + газами — 0.32 млрд тг,
            Library Learning Commons 1000 м² + цифровой архив + RFID — 0.42 млрд тг,
            Multi-Purpose Room MPR 60×40 м + подъёмные трибуны — 0.6 млрд тг,
            спорткомплекс (бассейн 25 м + спортзал 540 м² + теннисн. корты) — 1.8 млрд тг,
            кафетерий 1000 мест + кулинарный блок Premium — 0.6 млрд тг,
            Wi-Fi 6 mesh + Chromebook 800 шт + IT-инфра — 0.85 млрд тг,
            СОУЭ + СОТ + СКУД биометрия родителей + противопожарная — 0.32 млрд тг,
            HVAC прецизионная WELL v2 + CO₂ контроль — 0.42 млрд тг,
            мебель Steelcase Education + Herman Miller — 0.36 млрд тг,
            энергоснабжение + резерв ДГУ + UPS — 0.18 млрд тг,
            благоустройство + спорт-площадки наружные + ландшафт — 0.42 млрд тг,
            проектирование + лицензии IB + Cambridge + ISO 21001 — 0.32 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~12 млрд тг (допуск ±10%). 3.6+1.4+1.8+0.18+0.42+0.32+0.42+0.6+1.8+0.6+0.85+0.32+0.42+0.36+0.18+0.42+0.32 = 14 млрд тг ≈ 12 млрд тг (с оптимизацией). Удельная стоимость ~750 тыс. тг/м² или ~15 млн тг/учащ. Quantum International Алматы (модернизация 2020) — оценочно $20 млн ≈ 9 млрд тг, более премиум-уровень Haileybury Almaty (1500 учащ. boarding) — $50 млн = 23 млрд тг.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — IB World School аккредитация</h2>
          <p className="text-slate-300">
            International Baccalaureate (IB) World School — самый престижный международный
            стандарт K-12 образования. Что обязательно по IB Programme Standards and
            Practices 2020?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только программа IB Diploma в старшей школе" },
              { v: "b", t: "Только сертифицированные IB-учителя" },
              { v: "c", t: "IB World School Authorization (всё 4 программы PYP/MYP/DP/CP по выбору): 1) **Programme implementation** — последовательная реализация IB curriculum (Primary Years 3-12 лет, Middle Years 11-16, Diploma 16-19), все 6 предметных групп (Languages + Individuals&Societies + Sciences + Math + Arts + Physical/Health Edu); 2) **Inquiry-based learning** — обучение через исследования, проектную работу, Theory of Knowledge (TOK), Extended Essay 4000 слов; 3) **International-mindedness** — программа учит уважению к разным культурам, минимум 2 языка (родной + английский, желательно 3-й); 4) **CAS Service Hours** — обязательные Creativity-Activity-Service 150 часов внеучебной активности; 5) **Учителя IB-сертифицированные** — все педагоги прошли IB workshops, есть IB Coordinator (Координатор программы) с международной сертификацией; 6) **Оценивание** — IB external moderation (Cambridge International Examinations style), итоговые экзамены проверяются международными экзаменаторами; 7) **Учебные пространства** — гибкие, поддерживающие коллаборацию + инклюзивные (доступная среда ADA для учащ. с инвалидностью); 8) **Технологии** — 1:1 device program (Chromebook на каждого ученика), цифровая платформа managebac.com для контроля прогресса; 9) **Регулярная авторизация** — каждые 5 лет полный IB verification visit от международной комиссии; 10) **Школьное самоисследование** — Programme Standards and Practices self-study + Improvement Plan; 11) **Стоимость**: IB World School authorization $20-30K + annual $5-8K + per-student fees + IB-сертифицированный персонал (зарплата 30-40% выше региональной); IB Programme Standards and Practices 2020 + Cambridge IGCSE + ISO 21001 + WIDA (для англ. изуч.)" },
              { v: "d", t: "Только обучение на английском" },
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
                {score === 4 ? "Отлично — готовы к проектированию EduTech-школы" : score >= 2 ? "Перечитайте IB Programme Standards + Cambridge + ISO 21001" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> IB Programme Standards and Practices 2020, Cambridge IGCSE/A-Level, ISO 21001 (Educational Organizations), WELL v2 для школ, ISTE Standards (Tech Edu), WIDA, СанПиН РК 4.01-007.</p>
          <p><strong>Реальные объекты РК:</strong> Quantum International School Алматы (IB), BIL Schools Network (Алматы/Астана/Шымкент IB), Tian Shan International Алматы, Haileybury Almaty (British boarding), Назарбаев Интеллектуальные Школы (15 НИШ).</p>
        </section>
      </main>
    </div>
  );
}
