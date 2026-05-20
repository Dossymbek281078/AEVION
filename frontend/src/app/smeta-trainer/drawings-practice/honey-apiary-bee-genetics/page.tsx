"use client";
import Link from "next/link";
import { useState } from "react";

export default function HoneyApiaryBeeGeneticsPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);
  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 80) <= 8;
  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 2_800_000_000) <= 280_000_000;
  const correct = { ex1: ex1 === "d", ex2: ex2Correct, ex3: ex3Correct, ex4: ex4 === "c" };
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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Пчеловодческие комплексы</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🐝 Пчеловодческие комплексы + генетика</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #292. Алтайский медовый комплекс ВКО (Восточно-Казахстанская
            обл, Катон-Карагай заповедник 75 000 га лип-разнотравье), 500-1500
            ульев, годовой выпуск 30-100 т мёда (Алтайский липовый +
            эспарцетовый + донниковый). Породы — Buckfast hybrid (Brother Adam
            Devon UK) + Carniolan + Анатолийская кавказская. Современное
            пчеловодство: магазинная улей Dadant-Blatt 12-frame, перчатка-комби
            с центробежной медогонкой Lega 36-frame, fume board feeders,
            wax foundation Premier; selectional breeding по гигиеническому
            behaviour + аккуратности + урожайности. FAO Bee Health + WHO
            Apicultural Standards + ISO 12824 (honey quality) + СН РК 3.02-115.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав 1000-ульевого пчеловодческого комплекса</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Зимовник (winter cellar):</strong> подземный ж/б бункер 25×15×4 м, T = +2 to +6 °C / RH 75-85% (для overwintering 1000 семей), вентиляция Pasive 2-tube system + emergency electric heating;</li>
            <li><strong>Пасечный участок (apiary yard):</strong> 5-10 га rotational, дистанция ульев 4-5 м, навес от солнца (южная экспозиция запрещена для overheating) + щит от ветра;</li>
            <li><strong>Ульи Dadant-Blatt 12-frame:</strong> 1000-1500 шт, материал — кедр Сибирский / ольха, объём 60 л (вертик. компоновка с надставками magazine 1-3);</li>
            <li><strong>Кочевая платформа (mobile platform):</strong> прицеп КамАЗ 100-200 ульев одновременно для transporting к разнотравью полям (rapeseed, sunflower, buckwheat), GPS-tracking;</li>
            <li><strong>Медогонка (extraction):</strong> Lega Italy 36-frame electric centrifuge 12 000 rpm + uncapping knife steam-heated + filter 0.5 мм mesh;</li>
            <li><strong>Восковой пресс (wax press):</strong> Lega electric с heating jacket для recovery 8-10 кг wax/100 кг honey, recycling в foundation sheets Premier-Wax;</li>
            <li><strong>Storage + dehumidification:</strong> tanks SS 304 1-5 т каждая × 10 шт (полугодовой запас), RH ≤55% (предотвращение fermentation), T ≤25 °C;</li>
            <li><strong>Lab QA + analytical:</strong> HPLC Agilent для diastase + invert sugar test (ISO 12824), refractometer Atago для влажность ≤20%, HMF (Hydroxy-Methyl-Furfural) ≤40 mg/kg;</li>
            <li><strong>Bee breeding facility:</strong> insemination station II Insem-Apparat (artificial insemination ВМЛБ) для controlled crosses, queen rearing с Jenter system, genetics tracking SNP-marker library;</li>
            <li><strong>Selectional traits:</strong> hygienic behaviour score &ge;95% (Pin-killing test), honey yield ≥30 кг/семья/год, gentle temperament (sting count test), winter survival ≥85%;</li>
            <li><strong>Veterinary unit:</strong> Varroa mite control (formic acid + oxalic acid drip), Nosema microsporidian + American Foulbrood AFB monitoring lab Agilent qPCR;</li>
            <li><strong>Hive scale telemetry:</strong> IoT Arnia / BeeHero — weight sensor 0.5 кг ± precision, T внутри улья, humidity, audio frequency (queenless detection 200-300 Hz);</li>
            <li><strong>Cleanroom packaging:</strong> ISO 14644 кл.8 (food grade) — 200 м², filling Mettler-Toledo 250 g / 500 g / 1 kg glass jars, hot-fill 40 °C + capping + labelling;</li>
            <li><strong>Cold storage propolis + royal jelly:</strong> separate −18 °C unit для royal jelly storage (10 кг/год) + propolis tincture extraction;</li>
            <li><strong>Education + agro-tourism:</strong> visitor centre + tasting room + bee-museum + courses pollination ecology (50-100 туристов/сут летом).</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Селекция пчёл</h2>
          <p className="text-slate-300">
            Алтайский медовый комплекс хочет улучшить yield + winter survival.
            Какая программа селекции по FAO Bee Health + ISBN 9251058679?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Случайный отбор без оценки признаков" },
              { v: "b", t: "Только импорт пчёл из Италии каждый год" },
              { v: "c", t: "Только marker-assisted selection без поведения" },
              { v: "d", t: "Комбинированная BLUP-селекция по 5 признакам: hygienic behaviour ≥95% (Pin-killing test + Mite-Non-Reproduction MNR), honey yield ≥35 кг/семья/год (weighted year-over-year), gentle temperament (sting score Schiermann), winter survival ≥85%, varroa-resistance + SNP-marker library queen genotyping ддя long-term genetic improvement Buckfast-Carniolan F2 hybrid линий" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Годовой выпуск мёда</h2>
          <p className="text-slate-300">
            1000 семей × средний yield 80 кг/семья/год (для Алтай селекциониров.
            Buckfast hybrid). Потери на winter 15% семей. Сколько т мёда/год?
          </p>
          <input type="text" value={ex2} onChange={(e) => setEx2(e.target.value)} placeholder="т/год" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:border-blue-500 focus:outline-none" />
          {showResults && (
            <div className={`p-4 rounded-lg ${correct.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}>
              <p className="text-slate-200">
                <strong>Ответ:</strong> 1000 × 0.85 × 80 кг = 68 000 кг ≈ <strong>80 т/год при 100 кг/семья</strong>
                (улучшенная селекция). Реально для Алтайского региона Catan-Karagay
                разнотравье — 50-70 т/1000 семей. Премиум-цена $25-40/кг
                (vs медианный $5-8/кг) для сертифициров. organic + GI Geographical Indication.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс 1000-ульевого комплекса</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Зимовник ж/б 25×15×4 м + insulation + emergency heating = 0.32 млрд тг</li>
            <li>Пасечный участок 10 га + ограждение + навесы + ландшафт = 0.18 млрд тг</li>
            <li>Ульи Dadant-Blatt 12-frame кедр × 1500 (×150 000 тг) + надставки = 0.32 млрд тг</li>
            <li>Кочевая платформа КамАЗ-прицеп × 2 + GPS tracking = 0.15 млрд тг</li>
            <li>Медогонка Lega Italy 36-frame + uncapping knife + filter = 0.18 млрд тг</li>
            <li>Wax press + foundation Premier-Wax + recycling = 0.08 млрд тг</li>
            <li>Storage tanks SS 304 × 10 × 1-5 т + dehumidification = 0.15 млрд тг</li>
            <li>Lab QA HPLC Agilent + refractometer + qPCR Varroa monitoring = 0.22 млрд тг</li>
            <li>Bee breeding facility II Insem + Jenter queen rearing + SNP library = 0.28 млрд тг</li>
            <li>Veterinary unit + formic/oxalic acid + AFB diagnostics = 0.12 млрд тг</li>
            <li>IoT Arnia / BeeHero hive scales × 200 (10% sample) + telemetry = 0.18 млрд тг</li>
            <li>Cleanroom packaging ISO 14644 кл.8 200 м² + Mettler filling + capping = 0.28 млрд тг</li>
            <li>Cold storage −18 °C royal jelly + propolis extraction = 0.05 млрд тг</li>
            <li>Visitor centre + tasting room + agro-tourism education = 0.15 млрд тг</li>
            <li>Дороги + ЛЭП + проектирование 4% + ПИР + НР + СП + сертификация organic+GI = 0.15 млрд тг</li>
          </ul>
          <p className="text-slate-300">Итого capex (тг, округл. до млрд):</p>
          <input type="text" value={ex3} onChange={(e) => setEx3(e.target.value)} placeholder="тг" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:border-blue-500 focus:outline-none" />
          {showResults && (
            <div className={`p-4 rounded-lg ${correct.ex3 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}>
              <p className="text-slate-200">
                <strong>Ответ:</strong> ~2.8 млрд тг (~$6M USD) на 1000-ульевой комплекс
                с lab + agro-tourism. Окупаемость 4-6 лет при premium organic GI honey
                $25-35/кг.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Varroa control</h2>
          <p className="text-slate-300">
            Varroa destructor mite — главная угроза пчеловодству (collapse 30-50%
            семей зимой без control). Что обязательно по OIE Terrestrial Code?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Никаких мер — пчёлы сами справляются" },
              { v: "b", t: "Только profilactic антибиотики" },
              { v: "c", t: "IPM Integrated Pest Management по OIE + FAO Bee Health: 1) Monitoring sticky board + alcohol wash sample 300 пчёл/семья quarterly, threshold action 3% infestation; 2) Organic acid treatments — Formic Acid 65% pad (MAQS Mite Away Quick Strips) summer + Oxalic Acid drip 4.2% в bee-free период late autumn (нет contamination мёда); 3) Drone brood removal — capping pattern manipulation, manual cutting of drone brood каждые 2-3 недели (Varroa preferentially инфицирует drone brood в 8-10× density); 4) Genetic — selection MNR Mite Non-Reproduction breed lines (USDA Russian + VSH Varroa Sensitive Hygiene Pol-line); 5) Synthetic acaricides Apivar (amitraz) только если organic не справляются + rotation для prevent resistance; 6) Quarantine — все imported queens 30-day apidiary с lab Inspection; 7) Reporting Varroa load → национальный ветеринарный реестр КАЭН РК ежеквартально; 8) Education — 40-hr beekeeper training course + annual refresher; 9) Apicultural standards GLOBAL G.A.P. для export market; 10) Honey residue testing — coumaphos / fluvalinate / amitraz <50 ppb FDA + Codex Alimentarius MRL; OIE Terrestrial Code Ch 4.14 + FAO Bee Health + ISO 12824 + Codex Alimentarius + EU 2018/848 Organic Regulation" },
              { v: "d", t: "Только пожар улья" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex4, o.v, correct.ex4)}`}>
                <input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={() => setEx4(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <button onClick={() => setShowResults(true)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-semibold transition">
          Проверить ответы
        </button>
        {showResults && (
          <section className={`p-6 rounded-xl border-2 ${score === 4 ? "border-emerald-500 bg-emerald-500/10" : score >= 2 ? "border-amber-500 bg-amber-500/10" : "border-rose-500 bg-rose-500/10"}`}>
            <h2 className="text-2xl font-bold text-slate-50">Результат: {score} / 4</h2>
          </section>
        )}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li><strong>OIE Terrestrial Animal Health Code Ch 4.14</strong> — Apiculture</li>
            <li><strong>FAO Bee Health Standards 2020</strong></li>
            <li><strong>ISO 12824</strong> — Honey — Quality requirements</li>
            <li><strong>Codex Alimentarius CXS 12-1981</strong> — Standard for Honey</li>
            <li><strong>EU 2018/848</strong> — Organic Production Regulation (для organic honey)</li>
            <li><strong>EU Council Directive 2001/110/EC</strong> — Honey labelling</li>
            <li><strong>GLOBAL G.A.P.</strong> — Good Agricultural Practices</li>
            <li><strong>WHO Apicultural Standards</strong></li>
            <li><strong>USDA-ARS Honey Bee Breeding</strong> — Russian + VSH lines</li>
            <li><strong>СН РК 3.02-115</strong> — Сельскохозяйственные здания</li>
            <li><strong>Закон РК «О пчеловодстве»</strong> — № 70-VI от 16.07.2011</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
