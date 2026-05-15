"use client";
import Link from "next/link";
import { useState } from "react";

export default function DamsHydrostructuresPage() {
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
    setEx3Result(Math.abs(v - 120_000_000_000) <= 10_000_000_000 ? "ok" : "fail");
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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Плотины и гидротехника</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🌊 Плотины и гидротехнические сооружения</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Плотины — крупнейшие инженерные сооружения, создающие водохранилища для энергетики,
            ирригации, водоснабжения и борьбы с паводками. Модуль охватывает грунтовые и бетонные
            плотины, водосбросы, водозаборы, затворы, расчёт устойчивости и контроль безопасности
            эксплуатации. Нормативная база — СН РК 3.04-13 «Плотины из грунтовых материалов»,
            СНиП РК 3.04-15 «Безопасность гидротехнических сооружений», ССЦ РК сборник 38 и ЭСН 36.
          </p>
        </section>

        {/* Section 1: Типы плотин */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-cyan-300 mb-4">1. Типы плотин по материалу и конструкции</h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <h3 className="font-semibold text-slate-100">Грунтовые — земляные</h3>
              <p className="text-slate-400 mt-1">Однородные или с грунтовым ядром. Самый массовый тип. Применяются на равнинных реках при наличии местных грунтов. Высота до 100 м.</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <h3 className="font-semibold text-slate-100">Каменно-земляные / каменно-набросные</h3>
              <p className="text-slate-400 mt-1">Упорные призмы из камня + противофильтрационный элемент (ядро/экран) из глины, бетона, асфальтобетона. Для горных рек, высота до 300 м.</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <h3 className="font-semibold text-slate-100">Бетонные — гравитационные</h3>
              <p className="text-slate-400 mt-1">Удерживают воду собственной массой. Треугольное сечение, ширина основания 0.6–0.85 H. Скальное основание обязательно. Бухтарма, Капчагайская ГЭС.</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <h3 className="font-semibold text-slate-100">Бетонные — арочные</h3>
              <p className="text-slate-400 mt-1">Передают нагрузку на скальные берега каньона. Тонкие (5–10 м у основания), экономичны по объёму бетона. Требуют узкого ущелья и прочных скал.</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <h3 className="font-semibold text-slate-100">Бетонные — контрфорсные</h3>
              <p className="text-slate-400 mt-1">Напорная плита/арки + контрфорсы со стороны нижнего бьефа. Экономия бетона 30–40% относительно гравитационных. Для средних высот 30–80 м.</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <h3 className="font-semibold text-slate-100">Деревянные и фильтрующие</h3>
              <p className="text-slate-400 mt-1">Деревянные — малые временные перемычки и плотины на горных ручьях. Фильтрующие — каменная наброска без противофильтрационного элемента (наносозадерживающие).</p>
            </div>
          </div>
        </section>

        {/* Section 2: Грунтовые плотины */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-cyan-300 mb-4">2. Грунтовые плотины — конструкция и параметры</h2>
          <p className="text-sm text-slate-400 leading-relaxed mb-4">
            Грунтовая плотина состоит из противофильтрационного элемента (ядро или экран),
            упорных призм, обратных фильтров и крепления откосов. Ядро устраивается из глины
            или суглинка с коэффициентом фильтрации k ≤ 10⁻⁷ м/с. Упорные призмы — песок,
            гравий, гравийно-галечниковая смесь, обеспечивающие устойчивость от сдвига.
          </p>
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
                <tr className="border-b border-slate-800/60"><td className="py-2 px-3">Откос верховой</td><td className="px-3">1:2.5 — 1:4</td><td className="px-3">Учёт волнового воздействия</td></tr>
                <tr className="border-b border-slate-800/60"><td className="py-2 px-3">Откос низовой</td><td className="px-3">1:1.5 — 1:2.5</td><td className="px-3">Расчёт по устойчивости</td></tr>
                <tr className="border-b border-slate-800/60"><td className="py-2 px-3">Ядро глинистое</td><td className="px-3">k ≤ 10⁻⁷ м/с</td><td className="px-3">Глина или тяжёлый суглинок</td></tr>
                <tr className="border-b border-slate-800/60"><td className="py-2 px-3">Превышение гребня</td><td className="px-3">H + 3–5 м от УВБ</td><td className="px-3">Запас на нагон, накат волны</td></tr>
                <tr className="border-b border-slate-800/60"><td className="py-2 px-3">Ширина гребня</td><td className="px-3">5–15 м</td><td className="px-3">+ дорога по гребню</td></tr>
                <tr><td className="py-2 px-3 text-emerald-400">Норма</td><td className="px-3 text-emerald-400">СН РК 3.04-13</td><td className="px-3">Плотины из грунтовых материалов</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Бетонные плотины */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-cyan-300 mb-4">3. Бетонные плотины — гравитационные, арочные, контрфорсные</h2>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <h3 className="font-semibold text-slate-100">Гравитационная</h3>
              <p className="text-slate-400 mt-1">Масса противодействует сдвигу. Ширина основания B = 0.6–0.85 H. Бетон B15–B25, объёмная масса 2400 кг/м³.</p>
              <div className="mt-2 font-mono text-amber-300 text-xs">B/H = 0.6–0.85</div>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <h3 className="font-semibold text-slate-100">Арочная</h3>
              <p className="text-slate-400 mt-1">Передаёт нагрузку на скальные берега. Толщина у основания 5–10 м (1/15–1/30 от высоты). Минимум бетона, максимум сложности расчёта.</p>
              <div className="mt-2 font-mono text-amber-300 text-xs">δ/H ≈ 1/20</div>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <h3 className="font-semibold text-slate-100">Контрфорсная</h3>
              <p className="text-slate-400 mt-1">Напорная плита/арки на отдельно стоящих контрфорсах с шагом 9–18 м. Экономия 30–40% бетона. Высота до 80 м (Заячья ГЭС, рубеж XX в).</p>
              <div className="mt-2 font-mono text-amber-300 text-xs">шаг 9–18 м</div>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-amber-700/40 bg-amber-950/20 p-3 text-xs text-slate-300">
            <span className="text-amber-300 font-semibold">Условие основания:</span> бетонные плотины требуют скального
            основания. Если скала глубоко — переход на грунтовую плотину или ж/б ростверк со сваями.
          </div>
        </section>

        {/* Section 4: Водосбросы */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-cyan-300 mb-4">4. Водосбросы — пропуск катастрофических паводков</h2>
          <p className="text-sm text-slate-400 leading-relaxed mb-4">
            Водосбросы рассчитываются на пропуск катастрофического расхода 1%-обеспеченности
            (для плотин I класса — 0.1%). Поверхностные снабжаются сегментными затворами Tainter,
            глубинные — плоскими или цилиндрическими. Гаситель энергии — водобойный колодец,
            трамплин или ступенчатый сброс.
          </p>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <h3 className="font-semibold text-slate-100">Поверхностные водосбросы</h3>
              <p className="text-slate-400 mt-1">Бетонная плотина-водослив с сегментными затворами на гребне. Расход до 10 000 м³/с (Бухтарма). Гидродинамические нагрузки на быки.</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <h3 className="font-semibold text-slate-100">Сифонные</h3>
              <p className="text-slate-400 mt-1">Автоматическое включение при превышении НПУ. Малые и средние объекты, экономия на затворах. Расход до 500 м³/с.</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <h3 className="font-semibold text-slate-100">Шахтные / туннельные</h3>
              <p className="text-slate-400 mt-1">Вертикальный шахтный водозабор + горизонтальный туннель в обход плотины. Грунтовые плотины в горах. Туннели Ø8–15 м.</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <h3 className="font-semibold text-slate-100">Трамплинного типа</h3>
              <p className="text-slate-400 mt-1">Носок-трамплин на выходном лотке — струя отбрасывается на 30–80 м от подошвы. Рассеивание энергии в воздухе. Для высоконапорных ГЭС.</p>
            </div>
          </div>
        </section>

        {/* Section 5: Водозаборы и водовыпуски */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-cyan-300 mb-4">5. Водозаборы, водовыпуски, рыбозащита</h2>
          <ul className="text-sm text-slate-400 space-y-2 list-disc list-inside">
            <li><span className="text-slate-200 font-medium">Донные водовыпуски</span> — стальные/железобетонные трубы Ø2–6 м в теле плотины с затворами на верховой и низовой стороне. Опорожнение вдхр., промывка наносов.</li>
            <li><span className="text-slate-200 font-medium">Береговые водозаборы</span> — на скальных или насыпных откосах с башней управления и рыбозащитной сеткой 5×5 мм. Орошение, водоснабжение городов.</li>
            <li><span className="text-slate-200 font-medium">Насосные водозаборы</span> — плавающие или стационарные на сваях. Когда уровень воды меняется &gt; 5 м или забор ниже горизонта самотёка.</li>
            <li><span className="text-slate-200 font-medium">Рыбозащитные сетки и решётки</span> — обязательны при заборе ≥ 1 м³/с (СНиП РК 3.04-15). Скорость подхода ≤ 0.5 м/с для молоди.</li>
            <li><span className="text-slate-200 font-medium">Шуго-ледозадерживающие</span> — донные пороги, наклонные сетки, тёплый сброс. Защита от шуги (ледяная каша) на северных вдхр. — Сергеевка, Иртыш.</li>
          </ul>
        </section>

        {/* Section 6: Затворы */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-cyan-300 mb-4">6. Затворы гидротехнических сооружений</h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <h3 className="font-semibold text-slate-100">Плоские (скользящие, колёсные)</h3>
              <p className="text-slate-400 mt-1">Плоская плита в направляющих пазах быков. Привод цепной/гидравлический. Высота до 15 м. Глубинные водовыпуски, шлюзы.</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <h3 className="font-semibold text-slate-100">Сегментные (Tainter gate)</h3>
              <p className="text-slate-400 mt-1">Изогнутая ферма с радиальным поворотом на цапфах. Малое усилие подъёма, удобен для больших расходов. Поверхностные водосбросы плотин ГЭС.</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <h3 className="font-semibold text-slate-100">Секторные</h3>
              <p className="text-slate-400 mt-1">Полый сектор, опускающийся в нишу дна. Не выступает над водой при открытии. Судоходные плотины, мелиоративные системы.</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <h3 className="font-semibold text-slate-100">Конусные / игольчатые</h3>
              <p className="text-slate-400 mt-1">Внутри напорного трубопровода — регулируют расход + гасят энергию. Игольчатый — для высоконапорных водовыпусков (H &gt; 50 м).</p>
            </div>
          </div>
          <div className="mt-4 text-xs text-slate-400">
            <span className="text-emerald-400 font-semibold">Привод:</span> гидравлический (плунжерные цилиндры) — основной для крупных
            затворов; электромеханический (червячный/винтовой) — для малых и средних; ручной аварийный — обязателен по нормам безопасности.
          </div>
        </section>

        {/* Section 7: Контроль безопасности (КИА) */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-cyan-300 mb-4">7. Контрольно-измерительная аппаратура (КИА)</h2>
          <p className="text-sm text-slate-400 leading-relaxed mb-4">
            По СНиП РК 3.04-15 каждая плотина I–III класса оснащается комплексом КИА для
            мониторинга безопасности в течение всего жизненного цикла. Данные передаются
            на диспетчерский пункт с автоматической регистрацией (АСУ ТП).
          </p>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <h3 className="font-semibold text-slate-100">Пьезометры</h3>
              <p className="text-slate-400 mt-1">Трубки в теле плотины и основании для замера фильтрационного давления. Шаг 25–50 м по длине, в 2–4 уровнях по высоте. Глубинные манометры или поверхностные мерные рейки.</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <h3 className="font-semibold text-slate-100">Марш-маркшейдерские реперы</h3>
              <p className="text-slate-400 mt-1">Геодезические реперы на гребне и откосах. Высокоточное нивелирование (II класс, ±1 мм/км) фиксирует осадки плотины 2–4 раза в год.</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <h3 className="font-semibold text-slate-100">Инклинометры</h3>
              <p className="text-slate-400 mt-1">Скважинные датчики наклона в теле плотины и берегах. Контроль горизонтальных смещений и поворотов. Точность ±0.001 рад.</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <h3 className="font-semibold text-slate-100">Сейсмодатчики и тензометры</h3>
              <p className="text-slate-400 mt-1">Акселерометры (для сейсмики 8–9 баллов в Алматинской/ВКО). Тензометры — деформации в бетоне арочных плотин. Передача данных в реальном времени.</p>
            </div>
          </div>
        </section>

        {/* Section 8: Расчёт устойчивости */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-cyan-300 mb-4">8. Расчёт устойчивости плотин</h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <div className="text-slate-500 text-xs">Сдвиг по основанию</div>
              <div className="font-mono text-amber-300 mt-1">K_сд = (G·tgφ + c·A) / E_w ≥ 1.3</div>
              <div className="text-slate-400 text-xs mt-1">G — вес, φ — трение, c — сцепление, E_w — горизонтальное давление воды</div>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <div className="text-slate-500 text-xs">Опрокидывание</div>
              <div className="font-mono text-amber-300 mt-1">K_оп = M_уд / M_опр ≥ 1.5</div>
              <div className="text-slate-400 text-xs mt-1">Момент удерживающих сил / момент опрокидывающих</div>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <div className="text-slate-500 text-xs">Фильтрационная прочность</div>
              <div className="font-mono text-amber-300 mt-1">J_расч ≤ J_доп = J_кр / K_н</div>
              <div className="text-slate-400 text-xs mt-1">По методу удлинённой контурной линии Ленке-Чугаева</div>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
              <div className="text-slate-500 text-xs">Сейсмика (горные районы РК)</div>
              <div className="font-mono text-amber-300 mt-1">8–9 баллов MSK-64</div>
              <div className="text-slate-400 text-xs mt-1">Динамический расчёт с акселерограммой, СН РК 2.03-30</div>
            </div>
          </div>
          <div className="mt-4 text-xs text-slate-400">
            <span className="text-emerald-400 font-semibold">Нормативы:</span> СН РК 3.04-13 (грунтовые),
            СНиП РК 3.04-15 (безопасность), СН РК 2.03-30 (сейсмика).
            Класс плотины (I–IV) определяет коэффициенты надёжности и обеспеченность расчётных паводков.
          </div>
        </section>

        {/* Section 9: Бенчмарки РК */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-cyan-300 mb-4">9. Бенчмарки Казахстана</h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-blue-700/40 bg-blue-950/20 p-4">
              <h3 className="font-semibold text-blue-300">Бухтарминское вдхр. (Иртыш, ВКО)</h3>
              <p className="text-slate-300 mt-1">Объём 49 км³ — крупнейшее в РК. Бетонная гравитационная плотина H = 90 м, длина 450 м. Сегментные затворы Tainter, 9 водосливных пролётов. ГЭС 675 МВт. Введено 1960 г.</p>
            </div>
            <div className="rounded-lg border border-blue-700/40 bg-blue-950/20 p-4">
              <h3 className="font-semibold text-blue-300">Капшагайское вдхр. (Или, Алматинская обл.)</h3>
              <p className="text-slate-300 mt-1">Объём 28 км³, H = 49 м. Грунтовая каменно-земляная плотина длиной 470 м с глинистым ядром. ГЭС 364 МВт. Орошение Прибалхашья. 1970 г.</p>
            </div>
            <div className="rounded-lg border border-blue-700/40 bg-blue-950/20 p-4">
              <h3 className="font-semibold text-blue-300">Шардаринское вдхр. (Сырдарья, ЮКО)</h3>
              <p className="text-slate-300 mt-1">Объём 5 км³, H = 29 м. Грунтовая земляная плотина длиной 6.3 км. Защитные дамбы 60 км вдоль реки. ГЭС 100 МВт. Ирригация Кызылординской и Туркестанской областей.</p>
            </div>
            <div className="rounded-lg border border-blue-700/40 bg-blue-950/20 p-4">
              <h3 className="font-semibold text-blue-300">Сергеевское вдхр. (Ишим, СКО)</h3>
              <p className="text-slate-300 mt-1">Объём 635 млн м³, H = 27 м. Грунтовая плотина длиной 3.1 км. Водоснабжение Петропавловска и сёл СКО. Шугозащитные сооружения на водозаборе.</p>
            </div>
          </div>
          <div className="mt-5 rounded-lg border border-emerald-700/40 bg-emerald-950/20 p-4 text-sm">
            <div className="text-emerald-300 font-semibold">Сметная стоимость крупных плотин РК (2026):</div>
            <ul className="mt-2 list-disc list-inside text-slate-300 space-y-1">
              <li>Грунтовая плотина H = 30 м, L = 1 км: 35–55 млрд тг</li>
              <li>Бетонная гравитационная H = 50 м: 80–150 млрд тг (среднее ~120 млрд)</li>
              <li>Каменно-набросная горная H = 100 м: 200–350 млрд тг</li>
              <li>Эксплуатация и КИА: 0.3–0.5% от капвложений в год</li>
            </ul>
          </div>
        </section>

        {/* Exercises */}
        <section className="rounded-2xl border border-amber-700/40 bg-amber-950/10 p-6 space-y-8">
          <h2 className="text-2xl font-bold text-amber-300">🎯 Практические задания</h2>

          {/* Ex1 */}
          <div>
            <div className="text-sm text-slate-300 mb-3"><span className="font-semibold text-amber-200">Задача 1.</span> Какая ширина основания B бетонной гравитационной плотины при высоте H = 60 м?</div>
            <div className="space-y-2">
              {[
                { v: "a", t: "0.3 H = 18 м" },
                { v: "b", t: "0.5 H = 30 м" },
                { v: "c", t: "0.6–0.85 H = 36–51 м" },
                { v: "d", t: "1.5 H = 90 м" },
              ].map(o => (
                <button key={o.v} onClick={() => ex1 === null && setEx1(o.v)} disabled={ex1 !== null}
                  className={`w-full text-left px-4 py-2 rounded-lg border transition text-sm ${optionClass(ex1, o.v, "c")}`}>
                  <span className="text-slate-400 mr-2">{o.v})</span>{o.t}
                </button>
              ))}
            </div>
            {ex1 !== null && (
              <div className={`mt-3 text-sm ${ex1 === "c" ? "text-emerald-300" : "text-rose-300"}`}>
                {ex1 === "c" ? "✓ Верно. Гравитационная бетонная плотина имеет треугольное сечение с шириной основания B = 0.6–0.85 H. Масса противодействует сдвигу и опрокидыванию." : "✗ Правильный ответ — (c). Меньшие соотношения не дают устойчивости, большие — избыточны и неэкономичны."}
              </div>
            )}
          </div>

          {/* Ex2 */}
          <div>
            <div className="text-sm text-slate-300 mb-3"><span className="font-semibold text-amber-200">Задача 2.</span> Что такое затвор Tainter gate (сегментный затвор)?</div>
            <div className="space-y-2">
              {[
                { v: "a", t: "Сифонный водосброс с автоматическим включением" },
                { v: "b", t: "Изогнутая ферма с радиальным поворотом на цапфах — удобен для больших расходов" },
                { v: "c", t: "Шахтный туннельный водосброс в обход плотины" },
                { v: "d", t: "Винтовой затвор с ручным механическим приводом" },
              ].map(o => (
                <button key={o.v} onClick={() => ex2 === null && setEx2(o.v)} disabled={ex2 !== null}
                  className={`w-full text-left px-4 py-2 rounded-lg border transition text-sm ${optionClass(ex2, o.v, "b")}`}>
                  <span className="text-slate-400 mr-2">{o.v})</span>{o.t}
                </button>
              ))}
            </div>
            {ex2 !== null && (
              <div className={`mt-3 text-sm ${ex2 === "b" ? "text-emerald-300" : "text-rose-300"}`}>
                {ex2 === "b" ? "✓ Верно. Сегментный затвор Tainter (имени инженера Tainter, США 1886 г.) — изогнутая стальная ферма, поворачивающаяся на цапфах. Малое подъёмное усилие, идеален для широких водосбросов плотин ГЭС." : "✗ Правильный ответ — (b). Сегментный затвор — основной тип на крупных гидроузлах, включая Бухтарму и Капчагай."}
              </div>
            )}
          </div>

          {/* Ex3 */}
          <div>
            <div className="text-sm text-slate-300 mb-3">
              <span className="font-semibold text-amber-200">Задача 3.</span> Бетонная гравитационная плотина H = 50 м по бенчмарку РК (среднее значение диапазона 80–150 млрд тг ≈ 120 млрд). Какая сметная стоимость в тенге?
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <input
                value={ex3}
                onChange={(e) => { setEx3(e.target.value); setEx3Result(null); }}
                placeholder="например, 120000000000"
                className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-sm w-64 focus:outline-none focus:border-amber-500"
              />
              <button onClick={checkEx3} className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold text-sm">Проверить</button>
            </div>
            {ex3Result === "ok" && <div className="mt-3 text-emerald-300 text-sm">✓ Верно. Среднее значение бенчмарка ≈ 120 000 000 000 тг (120 млрд тенге). Допуск ±10 млрд.</div>}
            {ex3Result === "fail" && <div className="mt-3 text-rose-300 text-sm">✗ Не совсем. Диапазон 80–150 млрд тг, среднее ≈ 120 млрд тг = 120 000 000 000 тенге.</div>}
          </div>

          {/* Ex4 */}
          <div>
            <div className="text-sm text-slate-300 mb-3"><span className="font-semibold text-amber-200">Задача 4.</span> Какой комплекс контрольно-измерительной аппаратуры (КИА) устанавливается на крупной плотине I класса?</div>
            <div className="space-y-2">
              {[
                { v: "a", t: "Только геодезические реперы на гребне" },
                { v: "b", t: "Только пьезометры в теле плотины" },
                { v: "c", t: "Только инклинометры в скважинах" },
                { v: "d", t: "Пьезометры (фильтрационное давление) + марш-маркшейдеры (осадки) + инклинометры (наклоны) + сейсмодатчики" },
              ].map(o => (
                <button key={o.v} onClick={() => ex4 === null && setEx4(o.v)} disabled={ex4 !== null}
                  className={`w-full text-left px-4 py-2 rounded-lg border transition text-sm ${optionClass(ex4, o.v, "d")}`}>
                  <span className="text-slate-400 mr-2">{o.v})</span>{o.t}
                </button>
              ))}
            </div>
            {ex4 !== null && (
              <div className={`mt-3 text-sm ${ex4 === "d" ? "text-emerald-300" : "text-rose-300"}`}>
                {ex4 === "d" ? "✓ Верно. По СНиП РК 3.04-15 плотина I класса оснащается полным комплексом КИА: пьезометры для фильтрационного давления, реперы для осадок, инклинометры для смещений, сейсмодатчики для динамики (особенно в горных районах РК с сейсмикой 8–9 баллов)." : "✗ Правильный ответ — (d). Один тип датчиков не даёт полной картины — необходим комплексный мониторинг."}
              </div>
            )}
          </div>
        </section>

        <footer className="text-center text-xs text-slate-600 pt-4">
          AEVION Smeta Trainer · Модуль #189 · Плотины и гидротехнические сооружения · СН РК 3.04-13, СНиП РК 3.04-15
        </footer>
      </main>
    </div>
  );
}
