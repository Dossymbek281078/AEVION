"use client";
import Link from "next/link";
import { useState } from "react";

export default function PneumaticWasteCollectionPage() {
  const [ex1, setEx1] = useState(""); const [ex2, setEx2] = useState(""); const [ex3, setEx3] = useState(""); const [ex4, setEx4] = useState(""); const [showResults, setShowResults] = useState(false);
  const ex2N = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2OK = !isNaN(ex2N) && Math.abs(ex2N - 50) <= 5;
  const ex3N = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3OK = !isNaN(ex3N) && Math.abs(ex3N - 9_500_000_000) <= 950_000_000;
  const correct = { ex1: ex1 === "d", ex2: ex2OK, ex3: ex3OK, ex4: ex4 === "c" };
  const score = Object.values(correct).filter(Boolean).length;
  const oc = (s: string, v: string, ok: boolean) => !showResults || s !== v ? (s === v ? "border-blue-500 bg-blue-500/20" : "border-slate-700 hover:border-slate-500") : ok ? "border-emerald-500 bg-emerald-500/20" : "border-rose-500 bg-rose-500/20";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10"><div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between"><Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300">← К разделам</Link><div className="text-xs text-slate-500">Pneumatic Waste Collection</div></div></header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section><h1 className="text-3xl md:text-4xl font-bold">🚮 Pneumatic Waste Collection — Подземная пневмосистема</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">Модуль #305. Astana EXPO 2017 city + новый Astana Hub Almaty pilot — pneumatic waste collection AVAC Envac Sweden. Underground pneumatic tubes Ø500-700 мм vacuum 0.6 бар transport waste from street inlets к central collection station 2-5 км, no garbage trucks streets. Reference: Hammarby Sjöstad Stockholm 12 000 households 1992, Songdo South Korea, Disney World USA, Barcelona OlympicVillage 1992, Roosevelt Island NYC. Capacity 1-3 tonnes/hr collection, separation organic/recyclables/general waste. ISWA Sustainable Waste Management + СН РК 4.04-23 (городское ЖКХ).</p>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3"><h2 className="text-xl font-semibold text-emerald-300">1. Состав AVAC pneumatic system 5000 households</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Street inlets (waste chutes):</strong> 100-200 шт public stainless steel cabinet с 3 portals organic + paper/cardboard + general, RFID access + load cell 50 кг capacity, anti-vandal IP44 lock;</li>
            <li><strong>Storage hopper:</strong> каждый inlet 0.5-1.0 м³ buffer storage, level sensors trigger empty cycle при 80% full;</li>
            <li><strong>Underground tube network:</strong> stainless steel Ø500-700 мм welded sections, длиной 2-5 км total, slopes 1% к collection station, vacuum 0.6 бар (60 кПа under atmospheric);</li>
            <li><strong>Air supply system:</strong> blowers Howden Variax 200-400 кВт × 4 шт (3 рабочих + 1 резервный), generate vacuum 0.6 бар + transport airflow 100-150 м/с;</li>
            <li><strong>Cyclone separators:</strong> главный cyclone Donaldson 5 м H Ø2 м separates waste from air @ collection station, output dry waste container 30 м³;</li>
            <li><strong>Compactor:</strong> Marathon RJ-450 baler/compactor для general waste 4:1 reduction ratio, 200 кН ram, output bales 1200 кг каждый;</li>
            <li><strong>Containers:</strong> 30 м³ roll-off containers × 4 stream (organic + paper + plastic + general), automatic switching после full + truck pickup once daily;</li>
            <li><strong>Air filtration:</strong> bag filter Donaldson Torit + activated carbon 2 t/cycle, удаляет dust + odors before discharge atmosphere;</li>
            <li><strong>Odor management:</strong> closed system + N2 purge sluice valves + sometimes ozone treatment Wedeco for activated carbon regeneration;</li>
            <li><strong>SCADA + monitoring:</strong> Siemens TIA Portal + WinCC, real-time inlet status + flow + container fill levels + maintenance scheduling;</li>
            <li><strong>Maintenance access points:</strong> manholes every 100 м pipeline для inspection + sometimes pipe cleaning robot ROV;</li>
            <li><strong>Energy consumption:</strong> 80-120 кВт·ч/т waste collected (vs garbage trucks 70-100 кВт·ч + traffic costs);</li>
            <li><strong>Collection station building:</strong> 500-1000 м² above-ground для containers + compactor + control room, можно с green roof;</li>
            <li><strong>Tracking + billing:</strong> RFID per resident + per container weight, ESG smart-city integration;</li>
            <li><strong>Pilot demo:</strong> EXPO 2017 area used for 5-year demo, expansion plan Almaty Smart City 50 000 households by 2030.</li>
          </ul>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Pneumatic vs trucks</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Никаких преимуществ — старые системы" },
            { v: "b", t: "Только эстетика" },
            { v: "c", t: "Только для residential" },
            { v: "d", t: "Pneumatic waste collection vs garbage trucks для dense urban (>5000 households/km²): (1) zero traffic от waste trucks centre city, -30% noise, -40% CO2 emissions vs diesel trucks, (2) 24/7 disposal availability vs scheduled trucks twice/week, (3) automatic source separation organic/paper/general/plastic, (4) odor-free closed system vs open bins, (5) no rats/pests vs visible bins, (6) higher residential property value Songdo/Hammarby Sjöstad +5-10% premium, (7) underground use не conflict с surface land, (8) operational cost 30-50% less than trucks long-term, (9) initial capex 2-3x higher than trucks → break-even 10-15 лет. Disadvantages — frequent maintenance pipes (3-5%/year), inlet vandalism risk requires RFID/cameras. ISWA Sustainable Waste + Envac Best Practices" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex1, o.v, correct.ex1)}`}><input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Airflow velocity</h2>
          <p className="text-slate-300">Транспорт waste pneumatic vacuum 0.6 бар. Pipe Ø600 мм. Какая velocity (м/с)?</p>
          <input type="text" value={ex2} onChange={(e) => setEx2(e.target.value)} placeholder="м/с" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${correct.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p>Pneumatic waste transport velocity = <strong>~50 м/с</strong> minimum для suspended-flow transport (100-150 м/с peak slug-flow). Below 25 м/с — material drops out. Energy ~80-120 кВт·ч/т.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс 5000 households</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Street inlets 150 шт SS cabinet RFID = 1.5 млрд</li>
            <li>Underground tube network 5 km SS Ø600 + welding + sluice valves = 4.5 млрд</li>
            <li>Blowers Howden Variax 4× 300 кВт + vacuum system = 1.2 млрд</li>
            <li>Cyclones + bag filter + activated carbon + containers + compactor = 1.4 млрд</li>
            <li>SCADA Siemens TIA + RFID network + IT + monitoring = 0.5 млрд</li>
            <li>Collection station building + civil works + проект 5% + ESG audit + PNR = 0.4 млрд</li>
          </ul>
          <input type="text" value={ex3} onChange={(e) => setEx3(e.target.value)} placeholder="тг" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${correct.ex3 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p><strong>~9.5 млрд тг (~$20M USD)</strong> на 5000 households. Удельная — $4000/household installed. Хорошо подходит для high-end residential premier districts.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Maintenance challenges</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Просто чистить раз в год" },
            { v: "b", t: "Никакого maintenance" },
            { v: "c", t: "Multi-faceted maintenance per ISWA Best Practices: (1) routine inlet cleaning monthly с pressurised water + biocide, prevents biofilm + odor; (2) pipe cleaning robot ROV Envac PipeRunner annual для remove fat/grease accumulation, plastic films wedged in elbows; (3) sluice valve replacement 5-7 years (wear из abrasive waste), $5000/valve × 100 = $500K refresh budget; (4) blower bearing overhaul каждые 10 лет, $200K per blower; (5) cyclone wear caused by ash + glass = lining replacement каждые 7-10 лет; (6) RFID system + load cells calibration quarterly; (7) emergency response — pipe blockage = ROV inspection + steam clearing within 4 hours; (8) opex $100-150 per household/year covers maintenance + electricity + operator. Reference Envac maintenance manual + ISWA + СН РК 4.04-23" },
            { v: "d", t: "Замена всех труб каждые 5 лет" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex4, o.v, correct.ex4)}`}><input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={() => setEx4(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <button onClick={() => setShowResults(true)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-semibold">Проверить ответы</button>
        {showResults && <section className={`p-6 rounded-xl border-2 ${score === 4 ? "border-emerald-500 bg-emerald-500/10" : score >= 2 ? "border-amber-500 bg-amber-500/10" : "border-rose-500 bg-rose-500/10"}`}><h2 className="text-2xl font-bold">Результат: {score} / 4</h2></section>}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3"><h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li><strong>ISWA Sustainable Waste Management Standards</strong></li>
            <li><strong>EU Waste Framework Directive 2008/98/EC</strong></li>
            <li><strong>СН РК 4.04-23</strong> — Городское жилищно-коммунальное хозяйство</li>
            <li><strong>Envac AVAC Design Manual</strong></li>
            <li><strong>ISO 16559</strong> — Solid biofuels (для organic stream)</li>
            <li><strong>EU Smart City Indicators ISO 37120</strong></li>
            <li><strong>WHO Solid Waste Management Guide</strong></li>
            <li><strong>Закон РК «Об отходах»</strong> — Экологический кодекс</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
