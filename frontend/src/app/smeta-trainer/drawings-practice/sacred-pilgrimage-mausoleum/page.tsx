"use client";
import Link from "next/link";
import { useState } from "react";

export default function SacredPilgrimageMausoleumPage() {
  const [ex1, setEx1] = useState(""); const [ex2, setEx2] = useState(""); const [ex3, setEx3] = useState(""); const [ex4, setEx4] = useState(""); const [showResults, setShowResults] = useState(false);
  const e2 = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const e2OK = !isNaN(e2) && Math.abs(e2 - 1_000_000) <= 100_000;
  const e3 = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const e3OK = !isNaN(e3) && Math.abs(e3 - 25_000_000_000) <= 2_500_000_000;
  const ok = { ex1: ex1 === "d", ex2: e2OK, ex3: e3OK, ex4: ex4 === "c" };
  const score = Object.values(ok).filter(Boolean).length;
  const oc = (s: string, v: string, isok: boolean) => !showResults || s !== v ? (s === v ? "border-blue-500 bg-blue-500/20" : "border-slate-700 hover:border-slate-500") : isok ? "border-emerald-500 bg-emerald-500/20" : "border-rose-500 bg-rose-500/20";
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10"><div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between"><Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300">← К разделам</Link><div className="text-xs text-slate-500">Sacred Pilgrimage Site</div></div></header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section><h1 className="text-3xl md:text-4xl font-bold">🕌 Мавзолей Ходжа Ахмеда Ясави — Sacred Site</h1>
          <p className="mt-3 text-slate-400 max-w-3xl">Модуль #323. <strong>Финальный модуль #323</strong>. Мавзолей Ходжа Ахмеда Ясави (XIV век) Туркестан — UNESCO World Heritage Site 2003, святыня всего тюркского мира, ежегодно 1M+ pilgrims. Также сакральные сайты: мавзолей Айша-Биби Тараз, Бесшатыр царские курганы саков, Тамгалы петроглифы. Сохранение исторических зданий — заповедник «Азрет-Султан» — buffer zone protection + conservation Timurid architecture техникой Tepe-Style brick + лазурный мозаичный кашрин decoration. Туристическая инфраструктура — visitor centre + pilgrim hostel + heritage interpretation. UNESCO Operational Guidelines + ICOMOS Conservation + ICCROM + СН РК 1.04-25 (memorial buildings).</p>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав sacred complex management 1M pilgrims/year</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Mausoleum building XIV century — Tamerlane commissioned 1389-1405, Persian/Timurid architecture, кладка fired brick 25-40 mm thick + adhesive ganch (clay+gypsum);</li>
            <li>Dome — Ø17 m blue tile + main portal pisthak ribbed-vault, structural integrity verified FEM analysis ETABS quinquennial;</li>
            <li>Conservation cycle — каждые 5-7 лет comprehensive restoration с UNESCO World Heritage compliance: ICOMOS Burra Charter + Venice Charter 1964;</li>
            <li>Tile restoration — handcrafted faience Kashan-style tile reproduction by local artisans Туркестан Ремесленный Центр, no machine-made replicas;</li>
            <li>Foundation monitoring — settlement plates каждые 6 мес + GPS-RTK + crack monitors + Phorpres digital glass strain;</li>
            <li>Microclimate — внутренний climate 14-22 °C / RH 35-55% (humidity-controlled через silica gel + buffer materials) prevents tile efflorescence + salt crystallisation damage;</li>
            <li>Visitor management — timed-entry tickets 1000-2000 per hour, paths designated, no touching tile walls;</li>
            <li>Visitor centre 3000 м² — interpretation Kazakh Sufi tradition + Ясави history + Tamerlane patronage + Soviet preservation;</li>
            <li>Pilgrim hostel 500 beds — overnight stay для long-distance pilgrims, separate male/female accommodation per Islamic tradition;</li>
            <li>Prayer halls + ablution facilities + traditional kazaqui rooms;</li>
            <li>Outdoor amphitheatre 1000 seats для Sufi music + Nauryz celebrations + religious holidays Eid Кишы курбан;</li>
            <li>Restaurant traditional Turkic cuisine + tea house + chayhana;</li>
            <li>Parking 1000 cars + 50 buses + 24/7 security + ranger patrols;</li>
            <li>Conservation laboratory 200 м² для tile analysis (XRF + SEM + microsamples), ICCROM training centre regional;</li>
            <li>Endowment fund (Waqf) — sustainable financing through donations + government allocations + UNESCO grants.</li>
          </ul>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Conservation philosophy</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Снести и построить новое современное" },
            { v: "b", t: "Заменить все плитки новыми керамическими" },
            { v: "c", t: "Только косметический ремонт без анализа" },
            { v: "d", t: "Minimalist authentic restoration per UNESCO + ICOMOS Burra Charter + Venice Charter 1964 + ICCROM: (1) principles of minimal intervention + reversibility + authenticity; (2) all interventions documented в photographic + archaeological + drawn records preserved в archives; (3) original materials preferred — restored tiles handmade local artisans using XIV century Kashan technique (not machine-made copies); (4) materials compatibility — lime mortar matching original ganch (vs modern cement which damages historical masonry); (5) like-for-like replacement only when original beyond repair; (6) preventive conservation — controlled microclimate 14-22 °C + RH 35-55% silica gel buffering, prevent salt crystallisation efflorescence damage; (7) structural reinforcement hidden — internal stainless steel ties + epoxy-resin injection в cracks не видимы зрителю; (8) seismic retrofit — base isolation if needed for active fault zone (Тян-Шань seismic 7-9 баллов nearby); (9) community engagement — local artisans trained ICCROM continuing tradition skills; (10) UNESCO ICOMOS approval mandatory для major интервенции, periodic state-of-conservation reports; UNESCO Operational Guidelines + ICOMOS Burra Charter 1981 + Venice Charter 1964 + ICCROM + СН РК 1.04-25" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex1, o.v, ok.ex1)}`}><input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Pilgrims/year</h2>
          <input type="text" value={ex2} onChange={(e) => setEx2(e.target.value)} placeholder="чел" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p>Туркестан Mausoleum Ясави сейчас принимает ≈ <strong>1 млн pilgrims/year</strong> (Hajj + Eid + личное паломничество). 3-hadj effect — посещение Туркестан = маленький хадж по Sufi tradition.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс комплекса modernisation</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Mausoleum conservation — каждые 5-7 лет cycle, full restoration $5-10M USD = 2.5 млрд</li>
            <li>Visitor centre 3000 м² interpretation + exhibits + audio-visual = 4 млрд</li>
            <li>Pilgrim hostel 500 beds + prayer halls + ablution = 3.5 млрд</li>
            <li>Outdoor amphitheatre 1000 seats + landscape = 1.5 млрд</li>
            <li>Restaurant + chayhana + tea house = 1 млрд</li>
            <li>Parking 1000 cars + 50 buses + roads = 2.5 млрд</li>
            <li>Conservation laboratory 200 м² XRF + SEM = 1.5 млрд</li>
            <li>Microclimate control + foundation monitoring + structural retrofit = 2.5 млрд</li>
            <li>UNESCO compliance + проект 5% + ICOMOS audit + ICCROM training + endowment = 6 млрд</li>
          </ul>
          <input type="text" value={ex3} onChange={(e) => setEx3(e.target.value)} placeholder="тг" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex3 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p><strong>~25 млрд тг (~$53M USD)</strong> на full modernisation + conservation cycle. UNESCO contribution + government Almaty/Туркестан + Saudi/Turkish donations Sufi networks.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Site protection + Buffer zone</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Без буферной зоны" },
            { v: "b", t: "Только запрет new buildings" },
            { v: "c", t: "Multi-level protection per UNESCO Operational Guidelines paragraphs 99-119 + ICOMOS Heritage Impact Assessment HIA: (1) Core zone — мавзолей + immediate vicinity 5 ha protected absolute, no modern construction, controlled visitor management; (2) Buffer zone — 200 m radius surrounding, controlled development only contextual scale + materials (local brick + traditional roofs), height limit 6 m; (3) Transition zone — 500-1000 m radius, sympathetic but more flexible development; (4) Visitor management plan — timed entry tickets 1000-2000/hour, designated paths, no touching, audio guides; (5) Sustainable tourism — promote local artisans + Sufi music + traditional cuisine instead of global chains; (6) Conservation Management Plan — UNESCO мандаторне review every 6 years, periodic state-of-conservation reports; (7) Heritage Impact Assessment HIA для любого major project в core/buffer zone — analyze visual + structural + cultural impact; (8) Community participation — local Туркестан residents employed + benefit from tourism revenue 20%+; (9) Threat monitoring — encroachment + neglect + tourism pressure + natural disasters seismicity 7-9 баллов; (10) International cooperation — UNESCO World Heritage Committee + ICOMOS + ICCROM + Turkic World Cultural Heritage Foundation; UNESCO Operational Guidelines paragraphs 99-119 + ICOMOS HIA + Burra Charter + СН РК 1.04-25" },
            { v: "d", t: "Только табличка UNESCO" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex4, o.v, ok.ex4)}`}><input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={() => setEx4(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <button onClick={() => setShowResults(true)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-semibold">Проверить ответы</button>
        {showResults && <section className={`p-6 rounded-xl border-2 ${score === 4 ? "border-emerald-500 bg-emerald-500/10" : score >= 2 ? "border-amber-500 bg-amber-500/10" : "border-rose-500 bg-rose-500/10"}`}><h2 className="text-2xl font-bold">Результат: {score} / 4 🏆 ФИНАЛЬНЫЙ МОДУЛЬ #323</h2><p className="mt-2 text-slate-300">Это финальный модуль курса AEVION Smeta Trainer! Поздравляем с завершением.</p></section>}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3"><h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>UNESCO World Heritage Convention 1972</li>
            <li>UNESCO Operational Guidelines</li>
            <li>ICOMOS Burra Charter 1981 / Venice Charter 1964</li>
            <li>ICCROM Conservation Standards</li>
            <li>ICOMOS Heritage Impact Assessment HIA</li>
            <li>GSTC Cultural Tourism</li>
            <li>СН РК 1.04-25 — Memorial buildings + monuments</li>
            <li>Закон РК Об охране и использовании объектов историко-культурного наследия</li>
            <li>Turkic World Cultural Heritage Foundation</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
