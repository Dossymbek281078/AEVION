"use client";
import Link from "next/link";
import { useState } from "react";

export default function KazakhYurtaMuseumComplexPage() {
  const [ex1, setEx1] = useState(""); const [ex2, setEx2] = useState(""); const [ex3, setEx3] = useState(""); const [ex4, setEx4] = useState(""); const [showResults, setShowResults] = useState(false);
  const e2 = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const e2OK = !isNaN(e2) && Math.abs(e2 - 8) <= 1;
  const e3 = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const e3OK = !isNaN(e3) && Math.abs(e3 - 12_000_000_000) <= 1_200_000_000;
  const ok = { ex1: ex1 === "d", ex2: e2OK, ex3: e3OK, ex4: ex4 === "c" };
  const score = Object.values(ok).filter(Boolean).length;
  const oc = (s: string, v: string, isok: boolean) => !showResults || s !== v ? (s === v ? "border-blue-500 bg-blue-500/20" : "border-slate-700 hover:border-slate-500") : isok ? "border-emerald-500 bg-emerald-500/20" : "border-rose-500 bg-rose-500/20";
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10"><div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between"><Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300">← К разделам</Link><div className="text-xs text-slate-500">Kazakh Yurta Museum Complex</div></div></header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section><h1 className="text-3xl md:text-4xl font-bold">🛖 Этно-комплекс «Юрта Великой Степи»</h1>
          <p className="mt-3 text-slate-400 max-w-3xl">Модуль #321. Этнокомплекс Хан-Шатыр / Нур-Алем (Астана) / Алтын Эмель — традиционная юрта казахов UNESCO Intangible Cultural Heritage 2014. Юрта kiiz (felt) Ø8 м H=4 м, kerege (lattice wall) deciduous wood frame, uyk (roof poles), shanyrak (apex crown), tundyk (smoke hole). Восстановленные юрты музейного качества + visitor centre + outdoor amphitheatre для traditional music + ремесленные мастерские (felt-making + jewelry + saddle leather). UNESCO Operational Guidelines + ICOMOS + СН РК 1.04-25 (memorial buildings).</p>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав yurta-комплекса 8 юрт</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Юрта Ø8 м (полноразмерная family) × 4 шт + Ø6 м (small) × 4 шт = 8 yurts arrangement радиально вокруг central plaza;</li>
            <li>Каркас kerege — willow / talnik 2-3 cm Ø latticed walls 4-6 secciones × 1.5 м height, foldable mongolian-style;</li>
            <li>Uyk roof poles 30-40 шт длиной 3.5 м pine / willow, slot in shanyrak hub;</li>
            <li>Shanyrak — central wooden hub Ø1.5 м, sun-symbol national emblem;</li>
            <li>Tundyk — circular smoke hole Ø60 cm with adjustable felt cover;</li>
            <li>Kiiz felt 5-8 mm thickness handmade local sheep wool, multi-layer for winter insulation;</li>
            <li>Decorative — traditional Tuskies wall hangings + tekemet floor felt + chiyrak embroidered cushions;</li>
            <li>Furniture — chest jukai + cradle besik + saddle stand + dombra storage;</li>
            <li>Modern adaptations — concealed solar PV + LED lighting + emergency electric heating + insulated foundation pad для year-round use;</li>
            <li>Visitor centre — 500 м² brick + traditional decor, exhibits archaeological + ethnographic + Kazakh history Tirsek-Khan золотой период;</li>
            <li>Outdoor amphitheatre 500 seats для traditional music концерты — dombra + kobyz + sybyzgy + жыр-жыр performance;</li>
            <li>Ремесленные мастерские 5 — felt-making (киз), jewelry серебро (sherten + bilezik), saddle leather + bow-arrow + дастархан plates;</li>
            <li>Restaurant traditional kazakh cuisine — beshbarmak + kuyrdak + plov + кумыс + chai;</li>
            <li>Visitor parking 100 cars + bus turn-around + accessibility ramps + tour guide pavilion;</li>
            <li>Conservation — climate-controlled storage для historical artifacts (T 18-22 °C / RH 50%), display cases low-UV light pre-conservation by ICCROM standards.</li>
          </ul>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Authenticity vs modern</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Только аутентичные методы, без современного" },
            { v: "b", t: "Только современные материалы" },
            { v: "c", t: "Только tourist attractions" },
            { v: "d", t: "Hybrid traditional + modern conservation per UNESCO + ICOMOS Living Heritage: (1) traditional kiiz felt-making by local masters from local sheep wool maintains intangible cultural heritage UNESCO 2014; (2) authentic frame willow + pine wood as historically used; (3) discreet modern additions — concealed solar PV под felt cover, LED candle-flicker lighting, fire-suppression sprinkler hidden, foundation pad with thermal break for year-round occupancy without permafrost damage; (4) climate adaptation — extra felt layers + insulated pad allow visitors in winter -30 °C (vs traditional nomads only summer use); (5) electronic interpretation tablets + AR augmented reality showcasing historic interior арматура when juicy gone; (6) safety modernisation — emergency exits + fire ESFR + EN 1838 emergency lighting (still hidden); (7) accessibility — wheelchair ramps to one yurt + braille + audio guides; (8) sustainability — recycled / locally sourced materials only, no concrete foundations, gravel pads; (9) cultural protocol — visiting hours respect prayer + meal traditions of local Kazakh community; (10) UNESCO listing требует balance authenticity + visitor experience + economic sustainability. UNESCO Operational Guidelines + ICOMOS Living Heritage + ICCROM Conservation Standards + СН РК 1.04-25" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex1, o.v, ok.ex1)}`}><input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Yurts count</h2>
          <input type="text" value={ex2} onChange={(e) => setEx2(e.target.value)} placeholder="шт" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p><strong>8 yurts</strong> radial arrangement central plaza — symbolic 8-directions of Kazakh cosmology, also practical для visitor flow + accommodation overnight options.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс этно-комплекс</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>8 yurts authentic handmade by masters + frame + felt = 1 млрд</li>
            <li>Visitor centre 500 м² brick + traditional decor + exhibits = 2.5 млрд</li>
            <li>Outdoor amphitheatre 500 seats stone + landscape = 1.5 млрд</li>
            <li>5 ремесленные мастерские + tools + раritisanal materials = 1 млрд</li>
            <li>Restaurant + kitchen + outdoor seating + plov tannur = 1 млрд</li>
            <li>Parking + accessibility + landscape + tour pavilion = 1.5 млрд</li>
            <li>Conservation storage climate-controlled + display cases + cataloging = 1.2 млрд</li>
            <li>UNESCO certification + проект 5% + insurance + heritage audit + open ceremony = 2.3 млрд</li>
          </ul>
          <input type="text" value={ex3} onChange={(e) => setEx3(e.target.value)} placeholder="тг" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex3 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p><strong>~12 млрд тг (~$25M USD)</strong> на этнокомплекс. Туристический revenue $5-15/visitor + сувениры + restaurant.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Cultural protocol</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Никаких правил, открыть для всех" },
            { v: "b", t: "Только турфирмы могут водить" },
            { v: "c", t: "Cultural protocol per UNESCO + ICOMOS Living Heritage + Kazakh community elders: (1) consultation Kazakh community elders Aksakal-Биы при дизайне + content + activities; (2) traditional ceremonies — entry shoes-off + felt-stepping ritual + Bismillah blessing для overnight stays; (3) respect prayer times — namaz 5x daily, no entertainment during; (4) traditional dress optional for visitors via rental — chapan + saukele; (5) skill transfer programme — apprenticeship для local youth learn felt-making + jewelry + dombra musical instrument; (6) revenue sharing — 10-20% to local community development fund; (7) language — Kazakh primary + Russian + English signage, audio guides; (8) intangible heritage promotion — UNESCO 2014 list inclusion celebrated, ongoing study + transmission; (9) seasonality — special events Nauryz March 21, Қазан October, Қыс December celebrations; (10) ethical tourism — no exploitation cultural appropriation, all gifts authentic local-made (no «Made in China»). UNESCO Operational Guidelines + ICOMOS Living Heritage + ICCROM + GSTC Cultural Tourism + Kazakh Heritage Law" },
            { v: "d", t: "Только для иностранцев" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex4, o.v, ok.ex4)}`}><input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={() => setEx4(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <button onClick={() => setShowResults(true)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-semibold">Проверить ответы</button>
        {showResults && <section className={`p-6 rounded-xl border-2 ${score === 4 ? "border-emerald-500 bg-emerald-500/10" : score >= 2 ? "border-amber-500 bg-amber-500/10" : "border-rose-500 bg-rose-500/10"}`}><h2 className="text-2xl font-bold">Результат: {score} / 4</h2></section>}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3"><h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>UNESCO Intangible Cultural Heritage 2003</li>
            <li>UNESCO Yurta Inclusion 2014</li>
            <li>ICOMOS Living Heritage Charter</li>
            <li>ICCROM Conservation Standards</li>
            <li>GSTC Cultural Tourism</li>
            <li>Kazakh Heritage Law 2010</li>
            <li>СН РК 1.04-25 — Memorial buildings + monuments</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
