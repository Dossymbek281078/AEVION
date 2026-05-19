"use client";
import Link from "next/link";
import { useState } from "react";

export default function AlpineMountainResortPage() {
  const [ex1, setEx1] = useState(""); const [ex2, setEx2] = useState(""); const [ex3, setEx3] = useState(""); const [ex4, setEx4] = useState(""); const [showResults, setShowResults] = useState(false);
  const e2 = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const e2OK = !isNaN(e2) && Math.abs(e2 - 50) <= 5;
  const e3 = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const e3OK = !isNaN(e3) && Math.abs(e3 - 65_000_000_000) <= 6_500_000_000;
  const ok = { ex1: ex1 === "d", ex2: e2OK, ex3: e3OK, ex4: ex4 === "c" };
  const score = Object.values(ok).filter(Boolean).length;
  const oc = (s: string, v: string, isok: boolean) => !showResults || s !== v ? (s === v ? "border-blue-500 bg-blue-500/20" : "border-slate-700 hover:border-slate-500") : isok ? "border-emerald-500 bg-emerald-500/20" : "border-rose-500 bg-rose-500/20";
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10"><div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between"><Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300">← К разделам</Link><div className="text-xs text-slate-500">Alpine Mountain Resort</div></div></header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section><h1 className="text-3xl md:text-4xl font-bold">⛷️ Alpine Mountain Resort (Шымбулак / Ак-Булак)</h1>
          <p className="mt-3 text-slate-400 max-w-3xl">Модуль #315. Шымбулак (Алматы), Ак-Булак (Туюк-Су), план Кок-Жайляу — горнолыжный курорт high-altitude alpine. Reference: Zermatt Switzerland 360 km slopes, Whistler Canada 200 km, Niseko Japan. Includes ski lifts (gondola Doppelmayr), cable cars, snow-making system (TechnoAlpin SnowFactory), heated bases lodge, ski-school, ski rental, helipad emergency. High-altitude challenges 2000-3500 m: low O2, UV intensity, snow stability, avalanche control. FIS + ANSI B77.1 (Aerial Ropeway Safety) + СН РК 3.02-08.</p>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав alpine resort 50 km ski slopes</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Lift system — Doppelmayr 8-seat gondola Falcon + 4-seat detachable chair Galaxy + magic carpets для beginners;</li>
            <li>Lift capacity 3000-5000 PPH (passengers per hour), 4 main lifts + 6 surface tows;</li>
            <li>Ski slopes 50 km с groomed by PistenBully 600 grooming machines × 6 шт ночью;</li>
            <li>Snow-making system TechnoAlpin SnowFactory 200 fan guns + 50 lances, 1000 L/sec water capacity, pumping station + reservoir 50 000 м³;</li>
            <li>Snow-water system — compressed air 6 bar + chilled water 2 °C для optimal crystallisation;</li>
            <li>Base lodge — 5000 m², 3 ресторана + cafeteria + 200 rentals shop + après-ski terrace + ski school office;</li>
            <li>Hotel 5★ Ritz-Carlton-style 200 rooms + indoor pool + thermal spa + fine dining;</li>
            <li>Avalanche control — Gazex compressed gas explosion towers 30 unit + RACS Remote Avalanche Control + meteo station Vaisala;</li>
            <li>Helipad emergency MedEvac H225 helicopter + onsite ski patrol;</li>
            <li>Glamping eco-luxury 50 yurts на склоне для high-end clientele;</li>
            <li>Cable car к summit 3000 m H — Doppelmayr Gemini tri-cable 4-min vertical 1500 m;</li>
            <li>Snowboard halfpipe + slopestyle course FIS certified;</li>
            <li>Ice rink natural outdoor 50×30 m + Zamboni ice resurfacer;</li>
            <li>Mountain biking summer trails 80 km marked + bike rental + lift access;</li>
            <li>EHS — avalanche risk map + slope stability assessment + IFMGA-certified guides + emergency response plan.</li>
          </ul>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Lift sizing</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Только rope tow для всех" },
            { v: "b", t: "Только funitel narrow gauge" },
            { v: "c", t: "Только helicopter лучше" },
            { v: "d", t: "Mixed lifts portfolio per FIS + ANSI B77.1 + Doppelmayr Best Practices: (1) высокоскоростные detachable D-Line Doppelmayr 8-seat gondola или 6-CLD chair lift 30 km/h, capacity 3000-4000 PPH, ride time 7-12 min; (2) bottom-station detachable mechanism reduces stress on cable + smoother loading; (3) tri-cable gondola Doppelmayr 3S или Funitel — large 30-person cabin 6 m/s, capacity 5000-6000 PPH, для main artery resort; (4) magic carpets / fixed surface tows для beginner zones, simpler operation; (5) capacity calc — 60 000 skiers/day × 5 lift rides each = 300 000 PPH demand → 6-8 lifts; (6) avalanche/wind shutdown — каждый lift имеет windspeed sensor automatic stop at 60 km/h; (7) emergency evacuation rope/harness system + practice drills annual; (8) Doppelmayr Connect IoT monitoring real-time lift performance + predictive maintenance; FIS + ANSI B77.1 Aerial Ropeway Safety + ISO 12100 Machine Safety + EN 12929 + Doppelmayr Design Manual" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex1, o.v, ok.ex1)}`}><input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Slope length (km)</h2>
          <input type="text" value={ex2} onChange={(e) => setEx2(e.target.value)} placeholder="km" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p>Шымбулак Premium 50 km × difficulty mix 30% green / 40% blue / 25% red / 5% black FIS classification.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс alpine resort</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Lift system 4 detachable + 6 surface + Doppelmayr 3S cable car = 25 млрд</li>
            <li>Snow-making TechnoAlpin 200 fan guns + 50 lances + reservoir = 8 млрд</li>
            <li>PistenBully grooming × 6 + maintenance shop = 2 млрд</li>
            <li>Avalanche control Gazex 30 + RACS + meteo = 3.5 млрд</li>
            <li>Base lodge + hotel 5★ 200 rooms + spa = 18 млрд</li>
            <li>Slope construction earthworks + drainage 50 km = 4.5 млрд</li>
            <li>Bike trails summer + ice rink + helipad + EHS + проектирование 5% + страхование = 4 млрд</li>
          </ul>
          <input type="text" value={ex3} onChange={(e) => setEx3(e.target.value)} placeholder="тг" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex3 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p><strong>~65 млрд тг (~$140M USD)</strong>. Whistler $1B+, Niseko $500M for similar scale.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Avalanche control</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Никаких мер, природа сама" },
            { v: "b", t: "Только знаки опасности" },
            { v: "c", t: "Multi-tier avalanche control per IFMGA + SLF Swiss + FIS: (1) terrain assessment — slope angle 30-45° highest risk, mapping сильных авалоны зоны; (2) snow stability tests — daily ski-cut + compression test + extended column test by certified ski patrol; (3) Gazex compressed gas towers 30 unit с remote ignition — preventive avalanche release при new snow >30 cm overnight, цена 5-15 кг гриб-explosive; (4) RACS Remote Avalanche Control System Wyssen + Lacroix Daisy bell helicopter-deployable; (5) meteo monitoring Vaisala continuous wind/snow/temperature for forecasting; (6) avalanche bulletin issued daily by Кыргыз-Авиа-Геофизика equivalent + 5-level scale ICAR; (7) closed-areas signage + ranger patrols enforcement; (8) emergency response — buried victim rescue drill quarterly, dogs Avalanche Rescue Dogs + transceivers; (9) infrastructure protection — deflection berms + snow sheds над key roads + retention dams; (10) Шымбулак lessons learned 2012 incident — 30 cm fresh snow + warming = wet slab avalanche, killed skier; protocol updated avoid post-storm 24-hr suspect. IFMGA + ICAR + SLF Swiss + FIS + СНиП 33-01" },
            { v: "d", t: "Только запретить катание" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex4, o.v, ok.ex4)}`}><input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={() => setEx4(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <button onClick={() => setShowResults(true)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-semibold">Проверить ответы</button>
        {showResults && <section className={`p-6 rounded-xl border-2 ${score === 4 ? "border-emerald-500 bg-emerald-500/10" : score >= 2 ? "border-amber-500 bg-amber-500/10" : "border-rose-500 bg-rose-500/10"}`}><h2 className="text-2xl font-bold">Результат: {score} / 4</h2></section>}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3"><h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>FIS International Ski Federation</li>
            <li>ANSI B77.1 — Aerial Ropeway Safety</li>
            <li>EN 12929 — Ropeway Safety Regulations</li>
            <li>ISO 12100 — Machine Safety</li>
            <li>ICAR International Commission Alpine Rescue</li>
            <li>SLF Swiss Institute for Snow + Avalanche Research</li>
            <li>IFMGA International Federation Mountain Guides</li>
            <li>СН РК 3.02-08 — Гостиницы и курорты</li>
            <li>СНиП 33-01 — Гидротехнические в горной местности</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
