"use client";
import Link from "next/link";
import { useState } from "react";

export default function EcoResortGlampingPage() {
  const [ex1, setEx1] = useState(""); const [ex2, setEx2] = useState(""); const [ex3, setEx3] = useState(""); const [ex4, setEx4] = useState(""); const [showResults, setShowResults] = useState(false);
  const e2 = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const e2OK = !isNaN(e2) && Math.abs(e2 - 50) <= 5;
  const e3 = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const e3OK = !isNaN(e3) && Math.abs(e3 - 4_200_000_000) <= 420_000_000;
  const ok = { ex1: ex1 === "d", ex2: e2OK, ex3: e3OK, ex4: ex4 === "c" };
  const score = Object.values(ok).filter(Boolean).length;
  const oc = (s: string, v: string, isok: boolean) => !showResults || s !== v ? (s === v ? "border-blue-500 bg-blue-500/20" : "border-slate-700 hover:border-slate-500") : isok ? "border-emerald-500 bg-emerald-500/20" : "border-rose-500 bg-rose-500/20";
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10"><div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between"><Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300">← К разделам</Link><div className="text-xs text-slate-500">Eco Resort Glamping</div></div></header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section><h1 className="text-3xl md:text-4xl font-bold">🏕️ Эко-курорт Glamping (Glamorous Camping)</h1>
          <p className="mt-3 text-slate-400 max-w-3xl">Модуль #316. Eco-glamping resort Чарын каньон / Алакольские степи / Боровое национальные парки. Reference: Andbeyond Sandibe Botswana, Singita Kruger South Africa, Amangiri Utah USA. Glamping — luxury "tent" experience с full hotel amenities в природе: safari tents Canvas Wall + ensuite bath + king bed + kitchen + WiFi. Off-grid solar + battery + composting toilets + greywater treatment. LEED Platinum + GSTC Sustainable Tourism Standards + СН РК 3.02-08.</p>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав glamping resort 50 tents</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Safari tents Canvas Wall 24-30 m² × 50 units, raised wooden platform deck, ensuite bath + king bed + kitchenette;</li>
            <li>Tent material — heavy canvas Sunforger waterproof + UV-resistant flame-retardant; some models geodesic dome или yurt-style;</li>
            <li>Off-grid power — solar PV 200 kWp Tier-1 panels + LiFePO4 BESS 500 kWh + emergency DG 100 kW backup;</li>
            <li>Water — rainwater harvesting from common roof + well groundwater + filtration UV-RO для potable;</li>
            <li>Greywater treatment — engineered wetlands constructed (5 m² per tent), output for irrigation;</li>
            <li>Composting toilets Sun-Mar или Phoenix, zero blackwater discharge;</li>
            <li>Common building — restaurant + spa + lounge + library + observatory deck + reception, eco-built straw bale / rammed earth + green roof;</li>
            <li>Roads + pathways — permeable gravel paths, no asphalt, minimise habitat disruption;</li>
            <li>Activities — guided wildlife tours + horseback + kayaking + stargazing observatory + photography hides;</li>
            <li>Wildlife protection — site selection respects migration corridors + buffer zones; bee hotels + bird feeders;</li>
            <li>Heating — wood-stove + radiant floor heating от geothermal heat pump (ground-source);</li>
            <li>Cooling — passive cooling (deep eaves + cross-ventilation + thermal mass), no AC;</li>
            <li>Connectivity — Starlink satellite WiFi (no cell tower needed remote);</li>
            <li>Sustainability — LEED Platinum certified + GSTC Sustainable Tourism + carbon-neutral operations;</li>
            <li>Community engagement — local hire 80% + supply chain local artisans + visitor education program.</li>
          </ul>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Net-zero design</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Обычные гостиницы с grid power" },
            { v: "b", t: "Только electricity from generator" },
            { v: "c", t: "Только sewage to septic tank без обработки" },
            { v: "d", t: "Full net-zero off-grid eco-resort per LEED Platinum + GSTC: (1) solar PV 4 kWp per tent × 50 = 200 kWp Tier-1 monocrystalline, faces south at 35° tilt; (2) LiFePO4 BESS 500 kWh для evening + cloudy days, 6000+ cycle life; (3) wood gasification stove + heat pump ground-source для heating + DHW Domestic Hot Water; (4) rainwater harvesting 200 m² roof × 600 mm/year = 120 m³ + cistern storage 100 m³; (5) constructed wetlands greywater treatment Subsurface Flow SSF + Free Water Surface FWS, output to irrigation; (6) composting toilets — no blackwater, output compost 1 year curing + landscape fertilizer; (7) building materials — straw bale R-30+ + rammed earth thermal mass + reclaimed wood + locally sourced; (8) waste minimisation — recycling all + composting organic + compostable amenities only (bamboo toothbrush, no plastic bottles); (9) carbon-neutral certification — offset travel emissions через local reforestation; (10) community impact — 80% local hire, 50% revenue stays in community, education programs for visitors. LEED Platinum + GSTC Sustainable Tourism Standards + Living Building Challenge" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex1, o.v, ok.ex1)}`}><input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Tents</h2>
          <input type="text" value={ex2} onChange={(e) => setEx2(e.target.value)} placeholder="штук" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p><strong>50 tents</strong> typical glamping resort scale.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс glamping</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>50 safari tents 24-30 м² Canvas Wall + deck + interior = 1.5 млрд</li>
            <li>Solar PV 200 kWp + LiFePO4 BESS 500 kWh + inverters = 0.7 млрд</li>
            <li>Water system — well + filtration UV-RO + rainwater + treatment = 0.4 млрд</li>
            <li>Composting toilets + wetlands greywater + EnviroLoo = 0.35 млрд</li>
            <li>Common building 800 м² straw bale + green roof + spa + restaurant = 0.5 млрд</li>
            <li>Heating ground-source heat pump + wood stove + radiant floor = 0.25 млрд</li>
            <li>Roads + landscaping + observatory deck + LEED audit + GSTC + проект 5% + insurance = 0.5 млрд</li>
          </ul>
          <input type="text" value={ex3} onChange={(e) => setEx3(e.target.value)} placeholder="тг" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex3 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p><strong>~4.2 млрд тг (~$9M USD)</strong> на 50 tents glamping. Окупаемость 5-7 лет at $300-500/night premium pricing.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Wildlife protection</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Никакого внимания к wildlife" },
            { v: "b", t: "Только кормление туристам показать" },
            { v: "c", t: "Best practices GSTC + IUCN + Birdlife: (1) Environmental Impact Assessment EIA pre-construction identifies habitat critical species; (2) site selection respects migration corridors с min 1 km buffer + seasonal closure during breeding; (3) tent placement minimises tree cutting + earthworks, raised platforms minimise ground disturbance; (4) Dark-Sky Reserve certification (IDA International Dark Sky Association) — no light pollution, motion-sensor LED only when needed amber wavelength; (5) zero plastic bottles + biodegradable toiletries + bee hotels + bird feeders; (6) guided wildlife viewing only — no off-trail access, distance 100 m from wildlife per IUCN; (7) ranger training local — anti-poaching surveillance + community education; (8) revenue sharing 5-10% to local conservation NGO; (9) bushmeat policy — zero hunting + non-consumptive only; (10) climate-adapted species reintroduction (Caspian deer, etc) с support local government. GSTC Sustainable Tourism + IUCN + Birdlife International + IDA Dark Sky" },
            { v: "d", t: "Только запрет фото" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex4, o.v, ok.ex4)}`}><input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={() => setEx4(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <button onClick={() => setShowResults(true)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-semibold">Проверить ответы</button>
        {showResults && <section className={`p-6 rounded-xl border-2 ${score === 4 ? "border-emerald-500 bg-emerald-500/10" : score >= 2 ? "border-amber-500 bg-amber-500/10" : "border-rose-500 bg-rose-500/10"}`}><h2 className="text-2xl font-bold">Результат: {score} / 4</h2></section>}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3"><h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>GSTC Global Sustainable Tourism Council</li>
            <li>LEED Platinum BD+C</li>
            <li>Living Building Challenge</li>
            <li>IDA International Dark Sky</li>
            <li>IUCN Protected Areas</li>
            <li>СН РК 3.02-08 — Гостиницы и курорты</li>
            <li>Birdlife International Guidelines</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
