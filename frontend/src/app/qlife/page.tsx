"use client";

import Link from "next/link";

const PILLARS = [
  { t: "💰 Finance", d: "Wallet + tax + investments", link: "/qpaynet" },
  { t: "🩺 Health", d: "Daily log + triage + plan", link: "/healthai" },
  { t: "🗓 Schedule", d: "Calendar + focus mode + delegations", link: "/qpersona" },
  { t: "🤝 Relations", d: "CRM for personal life (birthdays, follow-ups)", link: null },
  { t: "🎯 Goals", d: "OKR-style yearly/quarterly tracker", link: null },
  { t: "🛡 Privacy", d: "Single point of identity (QRight + QShield)", link: "/qright" },
];

export default function QLifeLanding() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "AEVION QLife",
            applicationCategory: "LifestyleApplication",
            description:
              "Personal Operating System: finance, health, schedule, relationships, goals in one AI-agent-driven dashboard.",
            url: "https://aevion.app/qlife",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            featureList: PILLARS.map(p => p.t),
            publisher: { "@type": "Organization", name: "AEVION", url: "https://aevion.app" },
          }),
        }}
      />

      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-slate-400 hover:text-white text-sm">← AEVION</Link>
          <span className="text-slate-600">·</span>
          <h1 className="text-sm font-bold">
            <span className="text-emerald-400">Q</span>Life
          </h1>
          <span className="text-[10px] bg-emerald-900 text-emerald-300 px-2 py-0.5 rounded-full">IDEA</span>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-16 space-y-6">
        <div className="inline-block px-3 py-1 bg-emerald-900/40 border border-emerald-800 rounded-full text-xs text-emerald-300 font-semibold uppercase tracking-wider">
          Personal Operating System
        </div>
        <h1 className="text-5xl md:text-6xl font-black tracking-tight">
          Your{" "}
          <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
            entire life
          </span>{" "}
          in one OS.
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl leading-relaxed">
          QLife связывает 6 модулей AEVION в единый pulse-dashboard. AI-агент знает
          ваши финансы, здоровье, расписание, цели — и спрашивает заранее, прежде
          чем планировать. Вы решаете, агент исполняет.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-12 space-y-8">
        <h2 className="text-3xl font-black">6 столпов</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {PILLARS.map(p => {
            const card = (
              <div className="bg-slate-900 border border-slate-800 hover:border-emerald-700 rounded-xl p-5 transition-colors">
                <div className="text-lg font-bold mb-2">{p.t}</div>
                <div className="text-sm text-slate-400">{p.d}</div>
                {p.link && (
                  <div className="text-xs text-emerald-400 mt-2">→ Уже работает</div>
                )}
              </div>
            );
            return p.link ? (
              <Link key={p.t} href={p.link}>{card}</Link>
            ) : (
              <div key={p.t}>{card}</div>
            );
          })}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-16 space-y-4 text-center border-t border-slate-800">
        <p className="text-slate-500 text-sm">
          QLife = композитный продукт. 4 из 6 столпов уже работают как отдельные
          модули AEVION. Композиция → Q4 2026 после QPersona alpha.
        </p>
      </section>
    </div>
  );
}
