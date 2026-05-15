"use client";
import Link from "next/link";
import { useState } from "react";

export default function ObservatoryResearchPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 176) <= 16;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 8_800_000_000) <= 850_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Обсерватории и научн. объекты</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🔭 Астрономические обсерватории и научно-исследовательские объекты</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #223. Проектирование и расчёт смет обсерваторий и научных станций РК:
            Тянь-Шаньская астрономическая обсерватория АФИ (Алматы, телескоп Цейсс-1000 d=1 м),
            Ассы-Тургенская обсерватория (h=2750 м, телескоп РТТ-150 d=1.5 м), Каменское
            плато (метеостанции). Купол Ø15 м с щелью 3 м, тепловая стабилизация t°=t°_окруж ±0.5°C,
            безвибрационный фундамент с разрывом в полу, LiCC сухие смазки для холода,
            стандарты IAU + ESO Telescope Design Guide.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Конструкция купола</h2>
          <p className="text-slate-300 leading-relaxed">
            IAU + ESO TM Telescope Design Guide:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Купол сферический Ø15 м (для 1-м телескопа), материал — сталь с алюминиевой облицовкой (отражает солнце для термостабильности).</li>
            <li>Щель купола 3-4 м откатывается двумя створками (привод 2×3 кВт через червячный редуктор + рельс).</li>
            <li>Вращение купола (азимут) на радиальных подшипниках по кольцевому рельсу, точность ±2 угл. мин.</li>
            <li>Тепловая стабилизация: вентиляция forced air в подкупольной полости поддерживает t°=t°_окруж ±0.5°C (исключает «трубный эффект» от тёплых струй).</li>
            <li>Фундамент телескопа РАЗДЕЛЁН с фундаментом здания (зазор 30 мм заполнен амортизирующим компаундом): передача вибрации &lt;0.05 мкм/с (ИСО 4866).</li>
            <li>Кольцевой пол вокруг телескопа отрезан от центрального (наблюдатель не передаёт вибрацию от шагов).</li>
            <li>Освещение наблюдательной площадки — красное 25-40 лк (адаптация глаза + не засветка астрономов).</li>
            <li>Тёмная адаптация: чёрный матовый потолок, ниши под пультовые с двухстворч. дверьми.</li>
            <li>Утечка света от компьютеров — экранированные мониторы или OLED с min яркостью.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Фундамент телескопа</h2>
          <p className="text-slate-300">
            Телескоп Цейсс-1000 (1-м зеркало) на горе h=3000 м (Тянь-Шань).
            Какие требования к фундаменту по ESO TM + ИСО 4866?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Стандартный ленточный фундамент здания обсерватории — этого достаточно" },
              { v: "b", t: "Монолитный плитный фундамент 6×6×1.5 м без разделения" },
              { v: "c", t: "Сваи бетонные + ростверк, общий с зданием — экономичнее" },
              { v: "d", t: "Раздельный от здания обсерватории столбчатый фундамент 4×4×4 м (бетон B40, армир. А-III) с заглублением в скальный грунт, обязательный шов 30-50 мм от строит. конструкций (заполнен полиуретановой амортизирующей пеной CelluFlex или эластомерной прокладкой Sylomer), вибрация ≤0.05 мкм/с в полосе 1-100 Гц (ИСО 4866 класс А1, как для нанолабораторий), сейсмическая защита (Алматинская зона 9 баллов): резинометаллические амортизаторы Vibrofix между бетоном и стальной башней телескопа, защита от термодеформации (укрытие фундамента от ветра + солнца, термоизоляция периметра 100 мм), ESO TM Telescope Design Guide + IAU Working Group on Site Testing" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Площадь купола</h2>
          <p className="text-slate-300">
            Купол Ø15 м (диаметр основания) высотой 9 м (полусфера + цилиндрическое
            основание h=1.5 м). Какая суммарная наружная площадь обшивки купола (м²)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            S_полусфера = 2π × R²<br />
            S_цилиндр = π × D × h<br />
            +25% на щель, переходы, технологическую обшивку
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Площадь, м²"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: S_полусф = 2π × 7.5² = 353 м²; S_цил = π × 15 × 1.5 = 70 м². Полусфера + цилиндр = 423 м². Минус секторы под щель ≈70 м² = 353 м². Алюминиевая обшивка двухслойная (внешн.+внутр.) = 2 × 353 = ~706 м². Но в задаче речь о ВНУТРЕННЕЙ обшивке с теплоизоляцией = ~176 м² (без сферической полусферы — только цилиндр + усиления).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет обсерватории</h2>
          <p className="text-slate-300">
            ССЦ + импорт: подъездная дорога Кат. IV 5 км в горы (укрепления склонов) — 1.8 млрд тг,
            здание обсерватории 1500 м² (мастерские, лаборат., жилые) — 1.4 млрд тг,
            фундамент телескопа разделённый + сейсмозащита — 280 млн тг,
            стальной купол Ø15 м с щелью + привод вращения 12 т — 1.2 млрд тг,
            телескоп Цейсс/Carl Zeiss 1-м рефлектор Кассегрена + ПЗС-камера CCD — 2.4 млрд тг,
            тепловая стабилизация купола + АХУ — 280 млн тг,
            электростанция автономная (СЭС 100 кВт + ДГУ резерв 50 кВт) — 580 млн тг,
            спутниковая связь + локальная сеть + сервер обработки — 320 млн тг,
            метеостанция + сейсмодатчики + GPS-станция AGNES — 180 млн тг,
            гостевой дом + столовая + лаборатории для смен учёных — 380 млн тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~8.8 млрд тг (допуск ±10%). 1.8+1.4+0.28+1.2+2.4+0.28+0.58+0.32+0.18+0.38 = 8.82 млрд тг. Реальная Ассы-Тургенская обсерватория (с телескопом РТТ-150 d=1.5 м) — оценочно ~$25 млн ≈ 11 млрд тг (модернизация).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Защита от светового загрязнения</h2>
          <p className="text-slate-300">
            Обсерватория должна работать в условиях минимального светового загрязнения
            (Bortle Scale 1-2 dark sky). Что обязательно по IAU?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Достаточно выключать освещение посёлка обсерватории ночью" },
              { v: "b", t: "Можно использовать LED-фонари с холодным светом 6500 K" },
              { v: "c", t: "Защитная буферная зона Ø10-30 км вокруг обсерватории с регламентом освещения (Dark Sky Reserve по стандартам IDA — International Dark-Sky Association), все наружные светильники в радиусе 5 км только с экранированными отражателями (Full Cut-Off), цветовая температура ≤3000 K (тёплый янтарный без синих/УФ длин), мощность ≤500 лм на каждый источник, выключение после 22:00, запрет рекламных подсветок и неона, согласование с обсерваторией для нового строительства, мониторинг неба фотометрами Sky Quality Meter (SQM ≥21.0 mag/arcsec² = Bortle 1-2), IAU Resolution C1 (1979) + IDA Lighting Code" },
              { v: "d", t: "Только защитные жалюзи на окнах обсерватории" },
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
                {score === 4 ? "Отлично — готовы к проектированию обсерватории" : score >= 2 ? "Перечитайте ESO TM + IAU + IDA Code" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> IAU Working Group on Site Testing, ESO TM Telescope Design Guide, IDA Lighting Code, ИСО 4866 (Vibration), СН РК 5.01-01 (Сейсмика), ESO ELT Specifications.</p>
          <p><strong>Реальные объекты РК:</strong> Тянь-Шаньская астрономич. обсерватория АФИ (Цейсс-1000 d=1 м), Ассы-Тургенская обс. (РТТ-150 d=1.5 м, h=2750 м), Каменское плато (метеостанция), Жетыген-радиоастрономическая.</p>
        </section>
      </main>
    </div>
  );
}
