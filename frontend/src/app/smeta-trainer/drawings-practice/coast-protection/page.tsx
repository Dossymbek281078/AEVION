"use client";
import Link from "next/link";
import { useState } from "react";

export default function CoastProtectionPage() {
  const [ex1, setEx1] = useState<string | null>(null);
  const [ex2, setEx2] = useState<string | null>(null);
  const [ex3, setEx3] = useState<string>("");
  const [ex3Result, setEx3Result] = useState<null | "ok" | "fail">(null);
  const [ex4, setEx4] = useState<string | null>(null);

  const checkEx3 = () => {
    const v = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
    if (isNaN(v)) {
      setEx3Result("fail");
      return;
    }
    setEx3Result(Math.abs(v - 36_000_000) <= 3_000_000 ? "ok" : "fail");
  };

  const optionClass = (selected: string | null, value: string, correct: string) => {
    if (selected === null) return "border-slate-700 bg-slate-900/60 hover:border-cyan-600";
    if (value === correct) return "border-emerald-500 bg-emerald-950/40";
    if (selected === value) return "border-rose-500 bg-rose-950/40";
    return "border-slate-800 bg-slate-900/40 opacity-60";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300 hover:text-blue-200 transition">← К разделам</Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Берегоукрепление</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🌊 Берегоукрепительные и намывные работы</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Защита берегов морей, водохранилищ и рек от размыва, абразии и волнового воздействия,
            а также создание новых территорий путём намыва грунта. Модуль охватывает каменную
            наброску, тетраподы, габионы, шпунтовые стены, землесосный намыв и берегозащитные
            сооружения. Нормативная база — СНиП РК 5.04-29 «Гидротехнические сооружения»,
            ССЦ РК сборник 38 «Каменные конструкции» и ЭСН 36-04 «Берегоукрепительные работы».
          </p>
        </section>

        {/* Section 1: Типы берегоукрепления */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-cyan-300 mb-4">1. Типы берегоукрепительных конструкций</h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <h3 className="font-semibold text-slate-100">Каменная наброска (рип-рап)</h3>
              <p className="text-slate-400 mt-1">Несортированный или фракционированный камень, отсыпаемый по откосу. Самое распространённое и недорогое решение для рек и водохранилищ.</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <h3 className="font-semibold text-slate-100">Тетраподы (бетонные блоки)</h3>
              <p className="text-slate-400 mt-1">Серийные ж/б фигурные блоки 5–25 т, укладываемые внавал на морских берегах с высокими волнами. Каспий, Чёрное море.</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <h3 className="font-semibold text-slate-100">Габионы Maccaferri</h3>
              <p className="text-slate-400 mt-1">Коробчатые сетчатые конструкции из оцинкованной проволоки, заполняемые камнем. Гибкие, устойчивы к подмыву.</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <h3 className="font-semibold text-slate-100">Шпунтовые стены</h3>
              <p className="text-slate-400 mt-1">Стальные (Larssen, AZ) или ж/б шпунты на причальных стенках, набережных, защите фундаментов от подмыва.</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <h3 className="font-semibold text-slate-100">Ряжи</h3>
              <p className="text-slate-400 mt-1">Деревянные срубы из брёвен, заполняемые камнем. Историческая технология для горных рек и небольших объектов.</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <h3 className="font-semibold text-slate-100">Бетонные плиты по откосу</h3>
              <p className="text-slate-400 mt-1">Сборные ж/б плиты ПК 4×2 м толщиной 15–20 см по геотекстильной подготовке. Водохранилища, каналы.</p>
            </div>
          </div>
        </section>

        {/* Section 2: Каменная наброска */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-cyan-300 mb-4">2. Каменная наброска — параметры и стоимость</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-300 border-b border-slate-700">
                <tr>
                  <th className="text-left py-2 px-3">Параметр</th>
                  <th className="text-left py-2 px-3">Значение</th>
                  <th className="text-left py-2 px-3">Примечание</th>
                </tr>
              </thead>
              <tbody className="text-slate-400">
                <tr className="border-b border-slate-800/60"><td className="py-2 px-3">Фракции камня</td><td className="px-3">0.5–1.0 / 1.0–3.0 / 3.0–7.0 т</td><td className="px-3">Подбор по h₁%</td></tr>
                <tr className="border-b border-slate-800/60"><td className="py-2 px-3">Угол откоса</td><td className="px-3">1:1.5 — 1:2.5</td><td className="px-3">Положе — устойчивее</td></tr>
                <tr className="border-b border-slate-800/60"><td className="py-2 px-3">Ширина бермы</td><td className="px-3">3–5 м</td><td className="px-3">На уровне НПУ</td></tr>
                <tr className="border-b border-slate-800/60"><td className="py-2 px-3">Толщина слоя</td><td className="px-3">1.0–2.5 м</td><td className="px-3">≥2 диаметров камня</td></tr>
                <tr className="border-b border-slate-800/60"><td className="py-2 px-3">Подготовка</td><td className="px-3">Щебень + геотекстиль 350 г/м²</td><td className="px-3">Обратный фильтр</td></tr>
                <tr><td className="py-2 px-3 text-emerald-400">Цена с доставкой</td><td className="px-3 text-emerald-400">12 000 – 25 000 тг/т</td><td className="px-3">Зависит от карьера</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Тетраподы */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-cyan-300 mb-4">3. Тетраподы — производство и укладка</h2>
          <p className="text-sm text-slate-400 leading-relaxed mb-4">
            Тетрапод — четырёхногий ж/б блок симметричной формы, разработан во Франции в 1950 г.
            Лапы расходятся под углом 109.5°, что обеспечивает зацепление блоков между собой и
            гашение энергии волн через турбулентность в пустотах. Отливаются на стройплощадке в
            разборных стальных формах. Бетон класса B30 (M400), морозостойкость F300, водонепроницаемость W8.
          </p>
          <div className="grid md:grid-cols-4 gap-3 text-xs">
            <div className="rounded border border-slate-700 bg-slate-950/50 p-3">
              <div className="text-slate-500">Серия 2 т</div>
              <div className="text-slate-100 font-semibold mt-1">h₁% ≤ 1.5 м</div>
              <div className="text-emerald-400 mt-1">~18 000 тг/т</div>
            </div>
            <div className="rounded border border-slate-700 bg-slate-950/50 p-3">
              <div className="text-slate-500">Серия 5 т</div>
              <div className="text-slate-100 font-semibold mt-1">h₁% ≤ 3.0 м</div>
              <div className="text-emerald-400 mt-1">~21 000 тг/т</div>
            </div>
            <div className="rounded border border-slate-700 bg-slate-950/50 p-3">
              <div className="text-slate-500">Серия 10 т</div>
              <div className="text-slate-100 font-semibold mt-1">h₁% ≤ 4.5 м</div>
              <div className="text-emerald-400 mt-1">~24 000 тг/т</div>
            </div>
            <div className="rounded border border-slate-700 bg-slate-950/50 p-3">
              <div className="text-slate-500">Серия 25 т</div>
              <div className="text-slate-100 font-semibold mt-1">h₁% ≤ 7.0 м</div>
              <div className="text-emerald-400 mt-1">~28 000 тг/т</div>
            </div>
          </div>
        </section>

        {/* Section 4: Габионы */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-cyan-300 mb-4">4. Габионы Maccaferri</h2>
          <div className="grid md:grid-cols-2 gap-6 text-sm">
            <div>
              <h3 className="font-semibold text-slate-100 mb-2">Типы изделий</h3>
              <ul className="list-disc list-inside text-slate-400 space-y-1">
                <li>Коробчатые: 2×1×1 м, 3×1×1 м, 4×1×1 м</li>
                <li>Матрасы Рено: 6×2×0.3 м или 6×2×0.5 м (защита дна)</li>
                <li>Цилиндрические мешки Ø0.65–0.95 м (подводный монтаж)</li>
                <li>Сетка двойного кручения 8×10 см, проволока Ø2.7 мм</li>
                <li>Покрытие Galfan (GAW) или Galfan + PVC (агрессивные среды)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 mb-2">Технология монтажа</h3>
              <ul className="list-disc list-inside text-slate-400 space-y-1">
                <li>Подготовка основания: геотекстиль 200–400 г/м²</li>
                <li>Сборка коробок и фиксация спиралями/скобами SPENAX</li>
                <li>Заполнение камнем фракции 80–250 мм (≥1.5 размера ячейки)</li>
                <li>Крышка габиона зашнуровывается проволокой</li>
                <li>Уступы (ступенчатый монтаж) на склоне</li>
              </ul>
              <div className="mt-3 text-emerald-400 font-semibold">Цена с заполнением: 28 000 – 45 000 тг/м³</div>
            </div>
          </div>
        </section>

        {/* Section 5: Намыв грунта */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-cyan-300 mb-4">5. Намыв грунта землесосными снарядами</h2>
          <p className="text-sm text-slate-400 leading-relaxed mb-4">
            Гидромеханизированная разработка грунта со дна водоёма или карьера, транспортировка
            пульпы по трубопроводу и укладка её в карты намыва с обвалованием. Применяется для
            создания пляжей, расширения территорий портов, повышения отметок строительных площадок.
          </p>
          <div className="grid md:grid-cols-3 gap-3 text-xs">
            <div className="rounded border border-slate-700 bg-slate-950/50 p-3">
              <div className="text-slate-500">Землесос</div>
              <div className="text-slate-100 font-semibold mt-1">«Иртыш» 260 м³/ч</div>
              <div className="text-slate-400 mt-1">Дальность 1.5–3 км, ЛОР-300</div>
            </div>
            <div className="rounded border border-slate-700 bg-slate-950/50 p-3">
              <div className="text-slate-500">Пульпопровод</div>
              <div className="text-slate-100 font-semibold mt-1">Ø500–800 мм</div>
              <div className="text-slate-400 mt-1">Сталь, плавучие секции на понтонах</div>
            </div>
            <div className="rounded border border-slate-700 bg-slate-950/50 p-3">
              <div className="text-slate-500">Карта намыва</div>
              <div className="text-slate-100 font-semibold mt-1">100–500 м</div>
              <div className="text-slate-400 mt-1">Обваловка ±1.5 м, водосбросы</div>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-emerald-700/40 bg-emerald-950/20 p-3 text-sm">
            <span className="text-emerald-400 font-semibold">Цена намыва:</span>
            <span className="text-slate-300"> 800 – 1 500 тг/м³ грунта (в зависимости от дальности транспортировки пульпы и фракционного состава).</span>
          </div>
        </section>

        {/* Section 6: Берегозащитные сооружения */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-cyan-300 mb-4">6. Берегозащитные сооружения активного типа</h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <h3 className="font-semibold text-slate-100">Буны (поперечные шпоры)</h3>
              <p className="text-slate-400 mt-1">Перпендикулярные берегу сооружения 30–150 м, задерживают наносы, формируют искусственные пляжи. Шаг 1.5–2 длины буны.</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <h3 className="font-semibold text-slate-100">Волноломы</h3>
              <p className="text-slate-400 mt-1">Параллельные берегу сооружения в 50–200 м от уреза. Гасят волну до подхода к берегу. Каменно-набросные или из тетраподов.</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <h3 className="font-semibold text-slate-100">Подводные рифы</h3>
              <p className="text-slate-400 mt-1">Низовые конструкции из камня/бетона на глубине 2–5 м, инициирующие обрушение волн до берега. Современная экотехнология.</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <h3 className="font-semibold text-slate-100">Искусственные пляжи</h3>
              <p className="text-slate-400 mt-1">Намыв песка/гравия с периодической подсыпкой. Защита берега + рекреация. Курорты Каспия, побережье Алакольской зоны.</p>
            </div>
          </div>
        </section>

        {/* Section 7: Регулирующие сооружения */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-cyan-300 mb-4">7. Регулирующие речные сооружения</h2>
          <ul className="text-sm text-slate-400 space-y-2 list-disc list-inside">
            <li><span className="text-slate-200 font-medium">Защитные дамбы (Iz)</span> — продольные ограждения вдоль реки от паводка, грунтовые ядра с глинистым экраном и каменной отсыпкой откосов.</li>
            <li><span className="text-slate-200 font-medium">Водосбросы и водозаборы</span> — бетонные сооружения с затворами для контроля уровня и сброса избыточной воды.</li>
            <li><span className="text-slate-200 font-medium">Рыбоходы</span> — ступенчатые каналы или лотки для прохода рыбы через перекрытия (требуется по СНиП РК 5.04-29).</li>
            <li><span className="text-slate-200 font-medium">Селезащитные сооружения</span> — для горных районов (Алматинская область): селеуловители, селепропуски, селехранилища.</li>
          </ul>
        </section>

        {/* Section 8: Расчёт волн */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-cyan-300 mb-4">8. Расчёт волнового воздействия</h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <div className="text-slate-500 text-xs">Высота волны 1% обеспеченности</div>
              <div className="font-mono text-amber-300 mt-1">h₁% = f(V, D, d)</div>
              <div className="text-slate-400 text-xs mt-1">V — скорость ветра, D — длина разгона, d — глубина</div>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <div className="text-slate-500 text-xs">Глубина обрушения</div>
              <div className="font-mono text-amber-300 mt-1">d_кр ≈ 1.3 · h₁%</div>
              <div className="text-slate-400 text-xs mt-1">Критическая глубина для волны</div>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <div className="text-slate-500 text-xs">Накат волны на откос</div>
              <div className="font-mono text-amber-300 mt-1">R = k · h₁% · √(L/h)</div>
              <div className="text-slate-400 text-xs mt-1">Формула Шахина-Лопатина, СП РК 5.04-29</div>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <div className="text-slate-500 text-xs">Масса камня</div>
              <div className="font-mono text-amber-300 mt-1">W = γк·h³ / [Kд·(γк/γв − 1)³·ctg³α]</div>
              <div className="text-slate-400 text-xs mt-1">Формула Гудрича-Хадсона для рип-рапа</div>
            </div>
          </div>
        </section>

        {/* Section 9: Бенчмарки РК */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-cyan-300 mb-4">9. Бенчмарки Казахстана</h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-blue-700/40 bg-blue-950/20 p-4">
              <h3 className="font-semibold text-blue-300">Каспий — Актау, Атырау</h3>
              <p className="text-slate-300 mt-1">Уровень моря поднялся на 2–3 м с 1977 г. Береговая защита г. Атырау — каменная наброска + тетраподы 5–10 т. Курортная зона Актау: волноломы + искусственные пляжи.</p>
            </div>
            <div className="rounded-lg border border-blue-700/40 bg-blue-950/20 p-4">
              <h3 className="font-semibold text-blue-300">Озеро Балхаш</h3>
              <p className="text-slate-300 mt-1">Берегоукрепление в районе г. Балхаш, Приозёрск. Каменная наброска фракции 1–3 т. Защита от штормовых нагонов с озера.</p>
            </div>
            <div className="rounded-lg border border-blue-700/40 bg-blue-950/20 p-4">
              <h3 className="font-semibold text-blue-300">Капшагайское / Шардаринское вдхр.</h3>
              <p className="text-slate-300 mt-1">Сборные ж/б плиты по откосу плотин. Капшагай — длина плотины 470 м, высота 50 м. Шардара — на р. Сырдарье, защитные дамбы 60 км.</p>
            </div>
            <div className="rounded-lg border border-blue-700/40 bg-blue-950/20 p-4">
              <h3 className="font-semibold text-blue-300">Сергеевское вдхр., Иртыш</h3>
              <p className="text-slate-300 mt-1">Берегоукрепление набережной Усть-Каменогорска, намыв пляжной зоны г. Семей. Габионы Maccaferri на склонах под автодорогами.</p>
            </div>
          </div>
        </section>

        {/* Exercises */}
        <section className="rounded-2xl border border-amber-700/40 bg-amber-950/10 p-6 space-y-8">
          <h2 className="text-2xl font-bold text-amber-300">🎯 Практические задания</h2>

          {/* Ex1 */}
          <div>
            <div className="text-sm text-slate-300 mb-3"><span className="font-semibold text-amber-200">Задача 1.</span> Что такое тетрапод в берегоукреплении?</div>
            <div className="space-y-2">
              {[
                { v: "a", t: "Деревянный сруб, заполненный камнем" },
                { v: "b", t: "Габионная коробка из оцинкованной сетки" },
                { v: "c", t: "Ж/б фигурный блок 2–25 т с 4 «лапами» — гасит энергию волн" },
                { v: "d", t: "Шпунтовая стальная свая Larssen" },
              ].map(o => (
                <button key={o.v} onClick={() => ex1 === null && setEx1(o.v)} disabled={ex1 !== null}
                  className={`w-full text-left px-4 py-2 rounded-lg border transition text-sm ${optionClass(ex1, o.v, "c")}`}>
                  <span className="text-slate-400 mr-2">{o.v})</span>{o.t}
                </button>
              ))}
            </div>
            {ex1 !== null && (
              <div className={`mt-3 text-sm ${ex1 === "c" ? "text-emerald-300" : "text-rose-300"}`}>
                {ex1 === "c" ? "✓ Верно. Форма с 4 расходящимися «ногами» под 109.5° даёт сцепление блоков и турбулентное гашение волн." : "✗ Правильный ответ — (c). Тетрапод — ж/б фигурный блок с четырьмя «лапами»."}
              </div>
            )}
          </div>

          {/* Ex2 */}
          <div>
            <div className="text-sm text-slate-300 mb-3"><span className="font-semibold text-amber-200">Задача 2.</span> Какая фракция каменной наброски нужна для морского берегоукрепления при расчётной волне h₁% = 3 м?</div>
            <div className="space-y-2">
              {[
                { v: "a", t: "0.1 – 0.3 т" },
                { v: "b", t: "1.0 – 3.0 т" },
                { v: "c", t: "5 – 10 кг (мелкий щебень)" },
                { v: "d", t: "50 – 100 кг" },
              ].map(o => (
                <button key={o.v} onClick={() => ex2 === null && setEx2(o.v)} disabled={ex2 !== null}
                  className={`w-full text-left px-4 py-2 rounded-lg border transition text-sm ${optionClass(ex2, o.v, "b")}`}>
                  <span className="text-slate-400 mr-2">{o.v})</span>{o.t}
                </button>
              ))}
            </div>
            {ex2 !== null && (
              <div className={`mt-3 text-sm ${ex2 === "b" ? "text-emerald-300" : "text-rose-300"}`}>
                {ex2 === "b" ? "✓ Верно. По формуле Гудрича-Хадсона при h₁%≈3 м требуется камень массой 1–3 т (примерно Ø0.7–1.0 м)." : "✗ Правильный ответ — (b). Мелкие фракции вымоет первой же штормовой волной."}
              </div>
            )}
          </div>

          {/* Ex3 */}
          <div>
            <div className="text-sm text-slate-300 mb-3">
              <span className="font-semibold text-amber-200">Задача 3.</span> Габионная подпорная стенка объёмом 1 200 м³ при цене 30 000 тг/м³ с заполнением — рассчитайте стоимость материала, тенге:
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <input
                value={ex3}
                onChange={(e) => { setEx3(e.target.value); setEx3Result(null); }}
                placeholder="например, 36000000"
                className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-sm w-64 focus:outline-none focus:border-amber-500"
              />
              <button onClick={checkEx3} className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold text-sm">Проверить</button>
            </div>
            {ex3Result === "ok" && <div className="mt-3 text-emerald-300 text-sm">✓ Верно. 1 200 × 30 000 = 36 000 000 тг (36 млн тенге).</div>}
            {ex3Result === "fail" && <div className="mt-3 text-rose-300 text-sm">✗ Не совсем. Объём × цена м³ = 1 200 × 30 000 = 36 000 000 тг.</div>}
          </div>

          {/* Ex4 */}
          <div>
            <div className="text-sm text-slate-300 mb-3"><span className="font-semibold text-amber-200">Задача 4.</span> Какая техника подходит для намыва берегоукрепления на Каспии?</div>
            <div className="space-y-2">
              {[
                { v: "a", t: "Грейферный кран с понтона" },
                { v: "b", t: "Экскаватор-драглайн с берега" },
                { v: "c", t: "Бульдозер по обвалованию" },
                { v: "d", t: "Землесосный снаряд (100–300 м³/ч) с пульпопроводом" },
              ].map(o => (
                <button key={o.v} onClick={() => ex4 === null && setEx4(o.v)} disabled={ex4 !== null}
                  className={`w-full text-left px-4 py-2 rounded-lg border transition text-sm ${optionClass(ex4, o.v, "d")}`}>
                  <span className="text-slate-400 mr-2">{o.v})</span>{o.t}
                </button>
              ))}
            </div>
            {ex4 !== null && (
              <div className={`mt-3 text-sm ${ex4 === "d" ? "text-emerald-300" : "text-rose-300"}`}>
                {ex4 === "d" ? "✓ Верно. Землесос забирает грунт со дна, гидротранспортирует пульпу на 1.5–3 км до карты намыва — единственный экономичный способ для крупных объёмов." : "✗ Правильный ответ — (d). Грейфер, драглайн и бульдозер не справятся с подводной разработкой грунта в больших объёмах."}
              </div>
            )}
          </div>
        </section>

        <footer className="text-center text-xs text-slate-600 pt-4">
          AEVION Smeta Trainer · Модуль #179 · Берегоукрепительные и намывные работы · СНиП РК 5.04-29
        </footer>
      </main>
    </div>
  );
}
