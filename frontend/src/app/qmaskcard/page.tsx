"use client";

import Link from "next/link";

export default function QMaskCardLanding() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "AEVION QMaskCard",
            applicationCategory: "FinanceApplication",
            description: "Disposable virtual cards for online purchases. Real card stays in your wallet.",
            url: "https://aevion.app/qmaskcard",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            featureList: [
              "Disposable virtual cards (single-use)",
              "Spending limit per card",
              "Auto-burn after first transaction",
              "Merchant-locked cards",
              "Real card hidden from merchants",
            ],
            publisher: { "@type": "Organization", name: "AEVION", url: "https://aevion.app" },
          }),
        }}
      />

      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-slate-400 hover:text-white text-sm">← AEVION</Link>
          <span className="text-slate-600">·</span>
          <h1 className="text-sm font-bold">
            <span className="text-amber-400">Q</span>MaskCard
          </h1>
          <span className="text-[10px] bg-amber-900 text-amber-300 px-2 py-0.5 rounded-full">IDEA</span>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-16 space-y-6">
        <div className="inline-block px-3 py-1 bg-amber-900/40 border border-amber-800 rounded-full text-xs text-amber-300 font-semibold uppercase tracking-wider">
          Disposable cards · Privacy
        </div>
        <h1 className="text-5xl md:text-6xl font-black tracking-tight">
          Real card{" "}
          <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
            never leaves
          </span>{" "}
          your wallet.
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl leading-relaxed">
          Каждую онлайн-покупку оплачивайте одноразовой виртуальной картой с
          фиксированным лимитом. Утекли данные? Карта уже сгорела.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-12 space-y-8">
        <h2 className="text-3xl font-black">Как работает</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { n: "1", t: "Создаёте", d: "Click — генерируется новый Visa/MC с лимитом ровно на сумму покупки." },
            { n: "2", t: "Платите", d: "Вводите данные карты на сайте магазина как обычно." },
            { n: "3", t: "Карта сгорает", d: "После первой транзакции карта блокируется автоматически." },
          ].map(s => (
            <div key={s.n} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="text-3xl font-black text-amber-400 mb-2">{s.n}</div>
              <div className="text-lg font-bold mb-2">{s.t}</div>
              <div className="text-sm text-slate-400">{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-16 space-y-4 text-center border-t border-slate-800">
        <p className="text-slate-500 text-sm">
          Запуск: после выпуска коммерческого banking-партнёрства AEVION (Q1 2027).
          Подпишитесь на updates в{" "}
          <Link href="/" className="text-amber-400 hover:underline">AEVION</Link>.
        </p>
      </section>
    </div>
  );
}
