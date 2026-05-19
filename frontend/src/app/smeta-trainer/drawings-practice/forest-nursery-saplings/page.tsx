"use client";
import Link from "next/link";
import { useState } from "react";

export default function ForestNurserySaplingsPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);
  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 5_000_000) <= 500_000;
  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 4_200_000_000) <= 420_000_000;
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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Лесопитомники + саженцы</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🌲 Лесопитомники саженцев (Forest Nursery)</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #293. План «Жасыл Қазақстан» (Зелёный Казахстан 2021-2025):
            посадить 2 млрд деревьев. РК — Алматинский лесной питомник «Жетысу»
            (3 млн саженцев/год), Аршалинский (Акмолинская обл, для steppe
            afforestation), Тубинский (горная зона ВКО). Питомник производит
            container-grown saplings: сосна обыкновенная, лиственница сибирская,
            берёза, ясень, дуб, саксаул (для пустынного юга). Container-grown
            (Plantek 81F + Hiko V93 plastic trays) дают 95% survival vs
            bare-root 60%. Технология StanFor MASTER / Bouldin Lawson +
            irrigation Netafim, sphagnum peat + perlite substrate, slow-release
            fertilizer Osmocote. FAO Forest Reproductive Material + ISO 6147 +
            СН РК 3.02-115 + СНиП 2.07.01 (озеленение городов).
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав лесопитомника 3 млн саженцев/год</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Посевной отдел (sowing department):</strong> 50-100 га открытый грунт для bare-root saplings + 5-10 га закрытый container production, разделение по culture rotation 4 года;</li>
            <li><strong>Теплицы для рассадника:</strong> Venlo glasshouse 8 секций × 1000 м² = 8000 м² для germination первых 6-8 недель T=22-26 °C + RH 80%; Priva climate Control;</li>
            <li><strong>Container-grown nursery:</strong> Plantek 81F (81 cells/tray × 100 ml) или Hiko V93 (93 cells × 60 ml) — выбор по виду; tray 35×21 см, 100 trays/м² на benches;</li>
            <li><strong>Substrate mixing:</strong> sphagnum peat 70% + perlite 20% + vermiculite 10% (для drainage + aeration), pH adjusted dolomite lime до 5.5-6.0, slow-release fertilizer Osmocote 18-6-12 (3-4 кг/м³ substrate);</li>
            <li><strong>Mechanized sowing:</strong> StanFor MASTER 50 cellular dibbler + vacuum seed dispenser, output 50 000-100 000 cells/hr; seed coating + pelleting Incotec для precise placement;</li>
            <li><strong>Irrigation:</strong> Netafim PCJ pressure-compensated drip 4 L/h + overhead spray Wobbler 360° × 8 m radius, fertigation injector Dosatron D14MZ, automatic schedule Hunter Pro-C;</li>
            <li><strong>Shade cloth + frost protection:</strong> Aluminet shade 50% для hot summer ({">"}30 °C — wilting) + frost protection blanket Polypropylene 17 g/m² при -5°C;</li>
            <li><strong>Hardening-off area:</strong> outdoor benches с 50% wind reduction net, для acclimatisation 2-4 weeks перед outplanting в forest;</li>
            <li><strong>Cold storage:</strong> +1 to +3 °C × 200-500 m² для overwintering container saplings (Q1-Q2 dormancy), охлаждение Carrier ChillMax 100 кВт;</li>
            <li><strong>Tree seed bank:</strong> dry seed storage at -10 °C × 50 m³ × 5 chambers (для long-term genetic preservation + dormancy break), ISTA Rules germination test annually;</li>
            <li><strong>Grading + packaging:</strong> caliper + height measurement table + grade labelling A/B/C, packaging в boxes 50-100 saplings + bareroot packing kraft paper + moisture retention;</li>
            <li><strong>Pathology lab:</strong> qPCR Agilent для Phytophthora ramorum + Fusarium oxysporum (root disease) + bark beetle Ips typographus monitoring; ISO 17025 accredited;</li>
            <li><strong>Mycorrhiza inoculation:</strong> Suillus / Rhizopogon spore suspension applied к conifer seedlings для +50% growth rate первые 2 years (особенно critical для arid выращивания на засушливом юге РК);</li>
            <li><strong>Mechanical lifting + transport:</strong> Egedal Lifter 4-row для bare-root, container trays на роликовых benches Quinn, refrigerated truck Carrier Vector −2 to +5 °C для дальняя доставка;</li>
            <li><strong>Office + lab + warehouse:</strong> 500-1000 м² адм. + 200 м² lab пакетировки + 1000 м² substrate storage + 500 м² готовая продукция; адм. персонал 20-50 чел + сезонные рабочие 100-300 чел.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Container vs bare-root</h2>
          <p className="text-slate-300">
            «Жетысу» питомник может производить container saplings или bare-root.
            Что выбрать для afforestation arid south РК по FAO Forest Reproductive?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только bare-root — дешевле, всё равно один результат" },
              { v: "b", t: "Только бесплодные участки без culture rotation" },
              { v: "c", t: "Полностью дикая сборка семян" },
              { v: "d", t: "Container-grown (Plantek 81F) с mycorrhiza inoculation для arid south РК по FAO Forest Reproductive Material + Cornell Forestry: 1) Survival rate — container 90-95% vs bare-root 50-70% (особенно critical для arid: dry summer вынудливает 30% bare-root к гибели до того, как root system established); 2) Plug volume 100 ml (Plantek 81F) — оптимально для conifer saplings 2-year-old, 7-15 см height; 3) Mycorrhiza Suillus / Rhizopogon spore suspension при потсаде в plug — увеличивает water/nutrient uptake +50% в первые 2 года; 4) Hardening-off outdoors 2-4 недели — closes stomata, lignifies stem, prepares для wind/cold stress; 5) Transplant shock minimisation — root system intact (vs bare-root где обрезается 50-70% roots → recovery 6-12 мес); 6) Mechanisation transplant — Egedal или Singletree transplanter может ставить 1000-2000 plants/hr (vs bare-root manual 200-500 plants/hr); 7) Cost premium — container saplings 1.5-2.5× дороже bare-root ($0.40 vs $0.20 для conifer), но total establishment cost cheaper (no replanting + faster growth = ROI 7-10 лет); 8) Genetic — only certified seed lots ISTA-tested + provenance-matched (например local Алматинская сосна для Алматинской зоны); 9) Storage — container plants могут храниться 6-12 weeks при +2 °C без re-watering (cold storage), bare-root only 2-3 weeks; 10) Жасыл Қазақстан 2025 goal 2 млрд деревьев — нужны container saplings для high survival rate в Aral / Кызылорда / Шымкент regions; FAO Forest Reproductive Material + ISO 6147 + Cornell Forestry Best Practices + USDA-FS Nursery Tech Manual + СН РК 3.02-115" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Площадь питомника</h2>
          <p className="text-slate-300">
            Цель: 5 млн саженцев/год для «Жасыл Қазақстан». Container Plantek 81F
            (81 cells/tray) → 100 trays/м² на bench. 60% area под containers, 40% под
            walkways/services. Сколько cells/м² total и сколько саженцев надо?
            Введи number of saplings:
          </p>
          <input type="text" value={ex2} onChange={(e) => setEx2(e.target.value)} placeholder="штук" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:border-blue-500 focus:outline-none" />
          {showResults && (
            <div className={`p-4 rounded-lg ${correct.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}>
              <p className="text-slate-200">
                <strong>Ответ:</strong> Density на bench: 100 trays/м² × 81 cells/tray = 8100 cells/m² bench.
                С 60% useable area: 4860 cells/m². 5 млн / 4860 ≈ 1030 м² benches.
                Сезон 2 batch/год ⇒ ~500 м² benches × 2 годовых cycle = <strong>5 млн саженцев</strong>.
                Реальная total nursery area ~10-20 га (с walkways, hardening-off,
                substrate prep, building) = 20× от bench area для full operation.
                FAO Forest Reproductive Material Quality.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс питомника 5 млн саженцев/год</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Земля 15 га + outdoor field preparation + дренаж = 0.18 млрд тг</li>
            <li>Venlo glasshouse 8000 м² × 220 000 тг/м² + climate Priva = 1.85 млрд тг</li>
            <li>Container nursery benches Quinn rollerized 1000 м² + irrigation Netafim PCJ = 0.42 млрд тг</li>
            <li>Plantek 81F trays + Hiko V93 (10 000 шт каждый) = 0.04 млрд тг</li>
            <li>Substrate mixing — peat 70% / perlite / vermiculite + slow-release Osmocote + bagging = 0.15 млрд тг</li>
            <li>StanFor MASTER sowing 50-cell + vacuum seed dispenser + Incotec coating = 0.18 млрд тг</li>
            <li>Irrigation Netafim PCJ + Wobbler overhead + Dosatron fertigation + Hunter scheduler = 0.18 млрд тг</li>
            <li>Shade cloth Aluminet 50% (15 000 м²) + frost blanket Polypro = 0.08 млрд тг</li>
            <li>Hardening-off area 1 га with wind reduction net + outdoor benches = 0.05 млрд тг</li>
            <li>Cold storage +1°C 500 м² × Carrier ChillMax 100 кВт = 0.32 млрд тг</li>
            <li>Tree seed bank −10 °C × 5 chambers (50 м³ каждая) для long-term preservation = 0.18 млрд тг</li>
            <li>Pathology lab qPCR Agilent + microscopes + ISO 17025 accreditation = 0.25 млрд тг</li>
            <li>Mycorrhiza inoculation chamber + Suillus / Rhizopogon culture = 0.05 млрд тг</li>
            <li>Mechanical lifting Egedal Lifter 4-row + refrigerated transport Carrier Vector × 4 = 0.18 млрд тг</li>
            <li>Адм. блок 800 м² + lab 200 м² + warehouse 1500 м² + рабочее жилье сезонное 100 чел = 0.32 млрд тг</li>
            <li>ТП + ЛЭП + водозабор + проектирование 4% + ПИР + НР + СП + сертификация ISTA + ISO 17025 = 0.18 млрд тг</li>
          </ul>
          <p className="text-slate-300">Итого capex (тг, округл. до млрд):</p>
          <input type="text" value={ex3} onChange={(e) => setEx3(e.target.value)} placeholder="тг" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:border-blue-500 focus:outline-none" />
          {showResults && (
            <div className={`p-4 rounded-lg ${correct.ex3 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}>
              <p className="text-slate-200">
                <strong>Ответ:</strong> ~4.2 млрд тг (~$9M USD) на 5 млн саженцев/год.
                Окупаемость не прямая (госконтракт Жасыл Қазақстан) — цена за
                container sapling $0.50-1.50 = годовая выручка $2.5-7.5M = безубыток
                3-5 лет.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Mycorrhiza inoculation</h2>
          <p className="text-slate-300">
            Conifer saplings (сосна Pinus sylvestris) для arid south РК.
            Что обязательно по FAO Forest Reproductive + IUFRO?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Никаких симбионтов — растения сами справляются" },
              { v: "b", t: "Только полив + удобрения" },
              { v: "c", t: "Mycorrhiza ectomycorrhizal inoculation Suillus / Rhizopogon / Pisolithus + organic acid drip по FAO Forest Reproductive Material + IUFRO + Cornell Forestry: 1) Ectomycorrhiza — symbiotic fungus вокруг root tip (forms Hartig net + mantle), increases root surface area 100-1000× → +50-200% water/nutrient uptake; 2) Suillus luteus для Pinus species (host-specific), Rhizopogon roseolus для Pinus / Picea, Pisolithus tinctorius для broad-spectrum conifers + hardwoods; 3) Inoculation timing — applied during substrate mixing (10⁶-10⁸ spores/L), или dipping bare-root в spore suspension перед planting; 4) Drought resistance — mycorrhizal saplings выживают -3.0 MPa soil water potential vs nonmycorrhizal at -1.5 MPa = выживание в arid south Кызылорда / Аральский регион; 5) Nutrient mining — fungus способен extract P + N из organic matter не-доступных для root system, +30% N uptake + 5× P uptake; 6) Heavy metal tolerance — для post-mining reclamation (terricones, tailings), Pisolithus особенно хорош для Cu/Zn/Pb soils; 7) Soil ecosystem — fungal mycelium contribues 30% soil organic carbon long-term, improves soil structure; 8) Production — INOQ Германия / Premier Tech inoculum 50-100 кг/га nursery commercial product; 9) Quality control — RT-qPCR sample каждые 3 месяца для confirm fungal colonisation (TaqMan probes Suillus-specific 18S rRNA); 10) Жасыл Қазақстан — все sapling lots для steppe afforestation должны быть mycorrhizal-inoculated per Forestry Code РК + Закон Об охране окруж. среды; FAO Forest Reproductive Material + IUFRO Tree Health + Cornell Forestry Best Practices + USDA-FS Nursery Tech Manual + EU Plant Reproductive Material" },
              { v: "d", t: "Только гидропоника без почвы" },
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
            <li><strong>FAO Forest Reproductive Material 2020</strong> — Quality requirements</li>
            <li><strong>ISO 6147</strong> — Forest tree seeds — Sampling</li>
            <li><strong>ISTA International Rules for Seed Testing 2024</strong></li>
            <li><strong>IUFRO Tree Health Standards</strong> — International Union of Forest Research Orgs</li>
            <li><strong>Cornell University Forestry Best Practices</strong></li>
            <li><strong>USDA-FS Nursery Manual</strong> — USDA Forest Service</li>
            <li><strong>EU Plant Reproductive Material Regulation 2016/2031</strong></li>
            <li><strong>СН РК 3.02-115</strong> — Сельскохозяйственные здания</li>
            <li><strong>СНиП 2.07.01-89*</strong> — Градостроительство (озеленение)</li>
            <li><strong>Лесной кодекс РК</strong> — № 477-IV от 06.04.2010</li>
            <li><strong>Закон РК «О защите растений»</strong> — № 331-II от 03.07.2002</li>
            <li><strong>Жасыл Қазақстан 2021-2025</strong> — программа МСХ РК + Минэкологии</li>
            <li><strong>GLOBAL G.A.P. Nursery Stock</strong> — Good Agricultural Practices</li>
            <li><strong>HACCP CAC/RCP 1-1969</strong> — для packaging hall</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
