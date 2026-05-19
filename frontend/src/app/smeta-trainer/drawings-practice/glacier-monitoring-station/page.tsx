"use client";
import Link from "next/link";
import { useState } from "react";

export default function GlacierMonitoringStationPage() {
  const [ex1, setEx1] = useState(""); const [ex2, setEx2] = useState(""); const [ex3, setEx3] = useState(""); const [ex4, setEx4] = useState(""); const [showResults, setShowResults] = useState(false);
  const e2 = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const e2OK = !isNaN(e2) && Math.abs(e2 - 0.8) <= 0.1;
  const e3 = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const e3OK = !isNaN(e3) && Math.abs(e3 - 3_500_000_000) <= 350_000_000;
  const ok = { ex1: ex1 === "d", ex2: e2OK, ex3: e3OK, ex4: ex4 === "c" };
  const score = Object.values(ok).filter(Boolean).length;
  const oc = (s: string, v: string, isok: boolean) => !showResults || s !== v ? (s === v ? "border-blue-500 bg-blue-500/20" : "border-slate-700 hover:border-slate-500") : isok ? "border-emerald-500 bg-emerald-500/20" : "border-rose-500 bg-rose-500/20";
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10"><div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between"><Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300">← К разделам</Link><div className="text-xs text-slate-500">Glacier Monitoring Station</div></div></header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section><h1 className="text-3xl md:text-4xl font-bold">🧊 Glacier Monitoring Station Tian Shan</h1>
          <p className="mt-3 text-slate-400 max-w-3xl">Модуль #322. Туюк-Су glacier observatory (Заилийский Алатау) — старейшая в Центральной Азии станция (с 1957 г), документирует -0.7-1.0 m/year mass balance loss climate change impact. Также Карабатан + Шумкара + Молодёжный glaciers. Reference: WGMS World Glacier Monitoring Service + GLIMS Global Land Ice Measurements from Space + USGS Benchmark Glaciers. Equipment: ablation stakes annual surveying + automated weather stations + GPS-RTK ice elevation + RADAR ice thickness + seismic monitoring. Critical for water resource planning Алматы — glaciers feed Малая Алматинка river system. WGMS + GLIMS + СН РК 3.02-04 + Закон РК О водных ресурсах.</p>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав glacier monitoring 5-glacier network</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Mass balance stakes — Geosense ALS automated stake 30 шт per glacier, depth measurement laser interferometer ±2 cm, daily upload via satellite;</li>
            <li>Ablation/accumulation measurement — annual + seasonal sampling по standard методике WGMS Glaciological method;</li>
            <li>Snow pits — manual digging every spring/autumn для density profile + snow water equivalent SWE;</li>
            <li>Automated Weather Stations AWS Vaisala MAWS-410 × 8 — temperature, precipitation, wind, humidity, radiation budget на различных altitudes 2500-4000 m;</li>
            <li>GPS-RTK survey monthly — Trimble R10 measures ice surface elevation ±2 cm + glacier flow velocity vectors;</li>
            <li>Ice penetrating radar IPR — Sensors&Software pulseEKKO PRO 50-100 MHz для measure ice thickness 50-500 m + bed topography;</li>
            <li>Seismic monitoring — Streckeisen STS-2 broadband × 3 stations для detect ice quakes + glacier movement;</li>
            <li>Camera observatory — Reconyx HyperFire 2 timelapse каждые 30 минут long-term visual archive;</li>
            <li>UAV drone DJI Matrice 300 RTK с RGB + multispectral camera + LiDAR + thermal — photogrammetry survey monthly + DEM generation;</li>
            <li>Satellite remote sensing — Sentinel-2 ESA + Landsat NASA + ICESat-2 altimetry NASA для wide-area monitoring;</li>
            <li>Field station — 60 м² insulated cabin н=3200 м для researchers seasonal occupation 3-5 days/visit;</li>
            <li>Communication — Iridium satellite + VHF radio + Starlink (recent addition 2023);</li>
            <li>Power — solar PV 2 kWp + LiFePO4 BESS 10 kWh + DG propane backup;</li>
            <li>Data centre — Almaty lab archive + processing GIS ArcGIS + analysis software RAGGS + iceflow Elmer/Ice models;</li>
            <li>International collaboration — data sharing WGMS Zurich + GLIMS NSIDC Boulder + UN ICIMOD Kathmandu + IPCC AR6 contributions.</li>
          </ul>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Glacier mass balance methods</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Просто посмотреть на ледник зрительно" },
            { v: "b", t: "Только satellite imagery без field" },
            { v: "c", t: "Только manual stake measurements" },
            { v: "d", t: "Multi-method approach per WGMS Glaciological method + Geodetic method + Hydrological method: (1) Glaciological method — direct mass balance stakes (ablation rod 4 m aluminum) installed end of accumulation period (May), re-measured end of ablation (September); records snow accumulation winter + ice loss summer; ±20% accuracy; (2) Geodetic method — DEM Digital Elevation Models compared multi-year (LiDAR airborne + UAV drone + ICESat-2 satellite altimetry) gives volumetric mass balance ±10% on big glaciers; (3) Hydrological method — discharge measurement at glacier outlet stream comparing input precipitation + storage change gives runoff contribution; (4) Geophysical IPR Ice Penetrating Radar 50-100 MHz reveals bed topography + ice thickness 50-500 m; (5) Seismic — Streckeisen broadband STS-2 records ice-quakes events indicate accelerating flow; (6) Critical climate data — Туюк-Су 1957-2024 records show -0.7 to -1.0 m/year mass balance loss, glacier retreating 25 m/year horizontal; -50% volume since 1900; (7) Future projection — IPCC RCP 8.5 scenario predicts -85% Tian Shan glacier mass by 2100 = catastrophic для Алматы water security; (8) International collaboration — WGMS Zurich + GLIMS NSIDC + ICIMOD Kathmandu network sharing data; WGMS Operational Manual + GLIMS Standards + IPCC AR6 Cryosphere Chapter 9" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex1, o.v, ok.ex1)}`}><input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Mass balance loss (m/year)</h2>
          <input type="text" value={ex2} onChange={(e) => setEx2(e.target.value)} placeholder="м/год" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p>Туюк-Су glacier 2010-2024 average mass balance ≈ <strong>-0.8 m/year</strong> ice equivalent. Glaciers Алатау losing -50% volume since 1900.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс 5-glacier network</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Mass balance stakes Geosense automated 30 шт × 5 glaciers = 0.45 млрд</li>
            <li>AWS Vaisala MAWS-410 × 8 + satellite uplink = 0.4 млрд</li>
            <li>GPS-RTK Trimble R10 + RADAR pulseEKKO + UAV Matrice 300 = 0.5 млрд</li>
            <li>Seismic Streckeisen STS-2 × 3 + cameras Reconyx = 0.3 млрд</li>
            <li>Field station 60 м² insulated H=3200 м + solar + BESS = 0.4 млрд</li>
            <li>Data centre Almaty + ArcGIS + Elmer/Ice software + servers = 0.5 млрд</li>
            <li>Helicopter access supply + safety equipment + проект 4% + 5-year ops = 0.95 млрд</li>
          </ul>
          <input type="text" value={ex3} onChange={(e) => setEx3(e.target.value)} placeholder="тг" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex3 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p><strong>~3.5 млрд тг (~$7.5M USD)</strong> на 5-glacier monitoring network + 5-year operation. Critical для water security planning Алматы.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Water security implications</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Никаких — glaciers не нужны воде" },
            { v: "b", t: "Только летняя вода исчезает" },
            { v: "c", t: "Существенная угроза для water security РК через peak meltwater concept + IPCC AR6: (1) Tian Shan glaciers feed Малая Алматинка + Шилик + Каскелен rivers — основной источник питьевой воды + орошения Алматинской обл; (2) glacier melt provides peak summer flow июль-август когда snowmelt уже finished but rainfall minimal; (3) currently +20-30% baseline river flow during peak meltwater period; (4) Peak Meltwater hypothesis — Tian Shan glaciers projected to peak melt 2030-2040 then decline rapidly; after peak, summer river flow drops -30-50%; (5) consequences: water shortage Алматы 2050+ requiring desalination Каспий water (1500 км pipeline) или reduced agriculture; (6) IPCC RCP 8.5 high emissions scenario — Tian Shan loses 75-85% glacier mass by 2100 = catastrophic; RCP 2.6 low emissions limits to 35% loss; (7) adaptation strategies: water recycling industrial 95%, drip irrigation agriculture, demand reduction urban, regional cooperation Kyrgyzstan-Kazakhstan, pumped storage during peak melt; (8) economic impact — Аральское море precedent (lost 90% volume 1960-2000) = $30B+ damages; (9) Mongolian + Pakistani + Indian Himalaya same problem, regional ICIMOD collaboration критически; IPCC AR6 Cryosphere + WMO GAW + Closing the Water Gap UN Water 2023" },
            { v: "d", t: "Можно купить воду в Каспии" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex4, o.v, ok.ex4)}`}><input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={() => setEx4(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <button onClick={() => setShowResults(true)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-semibold">Проверить ответы</button>
        {showResults && <section className={`p-6 rounded-xl border-2 ${score === 4 ? "border-emerald-500 bg-emerald-500/10" : score >= 2 ? "border-amber-500 bg-amber-500/10" : "border-rose-500 bg-rose-500/10"}`}><h2 className="text-2xl font-bold">Результат: {score} / 4</h2></section>}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3"><h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>WGMS World Glacier Monitoring Service Zurich</li>
            <li>GLIMS Global Land Ice Measurements from Space NSIDC</li>
            <li>IPCC AR6 Cryosphere Chapter 9</li>
            <li>ICIMOD International Centre for Integrated Mountain Development</li>
            <li>WMO Global Atmosphere Watch GAW</li>
            <li>UN Water Closing the Water Gap 2023</li>
            <li>СН РК 3.02-04 — Высокогорное проектирование</li>
            <li>Закон РК О водных ресурсах</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
