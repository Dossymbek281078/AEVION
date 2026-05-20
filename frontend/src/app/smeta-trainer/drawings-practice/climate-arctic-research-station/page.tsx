"use client";
import Link from "next/link";
import { useState } from "react";

export default function ClimateArcticResearchStationPage() {
  const [ex1, setEx1] = useState(""); const [ex2, setEx2] = useState(""); const [ex3, setEx3] = useState(""); const [ex4, setEx4] = useState(""); const [showResults, setShowResults] = useState(false);
  const e2 = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const e2OK = !isNaN(e2) && Math.abs(e2 - 30) <= 3;
  const e3 = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const e3OK = !isNaN(e3) && Math.abs(e3 - 6_500_000_000) <= 650_000_000;
  const ok = { ex1: ex1 === "d", ex2: e2OK, ex3: e3OK, ex4: ex4 === "c" };
  const score = Object.values(ok).filter(Boolean).length;
  const oc = (s: string, v: string, isok: boolean) => !showResults || s !== v ? (s === v ? "border-blue-500 bg-blue-500/20" : "border-slate-700 hover:border-slate-500") : isok ? "border-emerald-500 bg-emerald-500/20" : "border-rose-500 bg-rose-500/20";
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10"><div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between"><Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300">← К разделам</Link><div className="text-xs text-slate-500">Climate Research Station</div></div></header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section><h1 className="text-3xl md:text-4xl font-bold">❄️ Climate Research Station — High-Altitude</h1>
          <p className="mt-3 text-slate-400 max-w-3xl">Модуль #320. Big Almaty Tian Shan Climate Station H=2750-3500 м — мониторинг ледников, atmospheric CO2/CH4, glacial melt, permafrost изменения. Reference: WMO Global Atmosphere Watch + Mauna Loa Hawaii + Jungfraujoch Switzerland + Zugspitze Germany. Equipment: Picarro CRDS CO2/CH4/N2O analyzer + LIDAR aerosol profiler + meteo Vaisala + glacier mass balance stakes + GPS-RTK survey. Off-grid solar + battery + insulated cabin Polar-Class buildings. WMO + IPCC + GAW Standards + СН РК 3.02-04.</p>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав climate station H=3500 м</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Cabin polar-class — Hytt 40 м² insulated R-40+ rockwool 300 mm + vapor barrier + triple-pane glass U=0.6 W/m²·K;</li>
            <li>Foundation — pile foundation through permafrost stable rock 5 m depth, thermosiphon refrigeration tubes prevent active layer warming;</li>
            <li>Cabin design — passive solar South-facing + small heated greenhouse vestibule + airlock entry;</li>
            <li>Heating — wood-stove jotul F100 + electric backup от battery, T-target 12-18 °C internal;</li>
            <li>Solar PV 5 kWp Tier-1 Tilt 50° South + LiFePO4 BESS 30 kWh = autonomy 7 days winter cloudy;</li>
            <li>Wind turbine 2 kW vertical-axis Quietrevolution QR5 (silent для acoustic measurements);</li>
            <li>Backup DG 5 kW propane (clean burn) + 1 ton propane tank;</li>
            <li>Atmospheric instruments — Picarro G2401 CRDS CO2+CH4+N2O+H2O analyser ±0.1 ppm CO2;</li>
            <li>Aerosol LIDAR — Leosphere Windcube atmospheric backscatter profiling 0-10 km;</li>
            <li>Meteo tower Vaisala WMT700 anemometer + Lufft pressure + RH + Sonic anemometer Gill HS-50;</li>
            <li>Radiation budget — CMP21 pyranometer + IR radiometer Kipp&Zonen CG4 + UV sensor;</li>
            <li>Glacier monitoring — automated stakes Geosense + GPS-RTK Trimble survey monthly;</li>
            <li>Permafrost — thermistor string Campbell CR1000 в boreholes 20 m depth × 5 sites;</li>
            <li>Communications — VSAT Iridium 256 kbps + 4G LTE backup, daily data uplink к WMO GAW Beijing centre;</li>
            <li>Researcher accommodation — 4 bunks + composting toilet + greywater wetland + small kitchen.</li>
          </ul>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Foundation для permafrost</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Обычный ж/б плитный fundament" },
            { v: "b", t: "Просто гравийная подушка" },
            { v: "c", t: "Только bored piles" },
            { v: "d", t: "Pile foundation through active permafrost layer + thermosiphon cooling per ASCE Cold Regions + WMO GAW: (1) site geotechnical investigation — permafrost depth + active layer thickness 0.5-3 m thawing every summer; (2) steel pile Ø250 mm × 5 m depth driven through active layer + 2 m anchorage в continuous permafrost below; (3) thermosiphon Hudson type — sealed CO2-pipe Ø50 mm filled liquid CO2, evaporates summer cools soil + condenses winter; passive operation no power; (4) cabin elevated 1.5 m above ground для air ventilation under, prevents heat transfer to permafrost; (5) building insulation R-40+ rockwool 300 mm + triple-pane glass U=0.6 W/m²·K minimises heat loss; (6) settlement monitoring — annual GPS survey + tilt sensors, action threshold 50 mm differential; (7) climate change adaptation — permafrost warming 0.1 °C/decade, expected -1 °C threshold reached 2050 в Алтай Тянь-Шань = active layer 0.3-0.5 m deeper; (8) lifecycle 30-50 years с monitoring + retrofit if needed; ASCE Cold Regions + IPCC AR6 Cryosphere + WMO GAW + Trans-Alaska Pipeline Lessons Learned" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex1, o.v, ok.ex1)}`}><input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — kWh/year power</h2>
          <input type="text" value={ex2} onChange={(e) => setEx2(e.target.value)} placeholder="МВт·ч/год" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p>Solar 5 kWp × 1500 kWh/kWp/year (high-altitude DNI) = 7500 kWh + Wind 2 kW × 1000 hr × 0.3 capacity = 600 kWh + DG backup = ~8-10 MWh ≈ <strong>30 MWh/year off-grid station</strong>.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс climate station</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Cabin polar-class 40 м² insulated + foundation thermosiphon = 1.5 млрд</li>
            <li>Solar PV 5 kWp + LiFePO4 BESS 30 kWh + wind 2 kW + DG propane = 0.5 млрд</li>
            <li>Picarro G2401 CO2/CH4/N2O analyser = 0.6 млрд</li>
            <li>LIDAR Leosphere Windcube + meteo Vaisala + radiation budget = 0.8 млрд</li>
            <li>Glacier + permafrost monitoring instruments + GPS RTK = 0.5 млрд</li>
            <li>VSAT + 4G + cabin furnishing + sample storage = 0.3 млрд</li>
            <li>Helicopter access support + supply + проектирование 5% + insurance + commissioning = 2.3 млрд</li>
          </ul>
          <input type="text" value={ex3} onChange={(e) => setEx3(e.target.value)} placeholder="тг" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex3 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p><strong>~6.5 млрд тг (~$14M USD)</strong>. Mauna Loa Observatory $50M+ scale historical, Jungfraujoch Sphinx $80M+.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Data integrity</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Просто record CSV files" },
            { v: "b", t: "Только manual measurements" },
            { v: "c", t: "WMO GAW data integrity protocols + IPCC publishing standards: (1) instrument calibration NIST-traceable annual — Picarro CO2 ±0.05 ppm vs NOAA Mauna Loa reference; (2) automated QC flags — out-of-range detection + spike removal + drift correction; (3) timestamp UTC GPS-synchronised ±100 ms; (4) data archival — DOI persistent identifier + DataCite Commons + NOAA NCEI mirror; (5) FAIR principles — Findable + Accessible + Interoperable + Reusable; (6) open-data — published к WMO GAW + Climate Data Online + Earth System Grid Federation ESGF; (7) peer review — annual technical report + data papers Nature Scientific Data; (8) audit trail — all data versions tracked Git, immutable blockchain timestamp for legal traceability; (9) station documentation Standard Operating Procedures SOPs annual update + visiting auditor; (10) community usage — IPCC Assessment Reports use GAW data, Климат-сценарии РК based on local stations + global ensemble; WMO GAW Strategic Plan + IPCC AR6 + FAIR + DataCite + NIST" },
            { v: "d", t: "Просто хранить на USB" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex4, o.v, ok.ex4)}`}><input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={() => setEx4(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <button onClick={() => setShowResults(true)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-semibold">Проверить ответы</button>
        {showResults && <section className={`p-6 rounded-xl border-2 ${score === 4 ? "border-emerald-500 bg-emerald-500/10" : score >= 2 ? "border-amber-500 bg-amber-500/10" : "border-rose-500 bg-rose-500/10"}`}><h2 className="text-2xl font-bold">Результат: {score} / 4</h2></section>}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3"><h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>WMO Global Atmosphere Watch GAW</li>
            <li>IPCC Assessment Reports AR6</li>
            <li>ASCE Cold Regions Engineering</li>
            <li>NIST Climate Standards</li>
            <li>DataCite Commons + FAIR Principles</li>
            <li>NOAA Mauna Loa Reference Standards</li>
            <li>ESGF Earth System Grid Federation</li>
            <li>СН РК 3.02-04 — Здания высокогорные</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
