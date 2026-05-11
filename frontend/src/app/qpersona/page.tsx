"use client";

import Link from "next/link";

export default function QPersonaLanding() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "AEVION QPersona",
            applicationCategory: "ProductivityApplication",
            description:
              "AI personality twin: trained on your texts, voice, and decision history. Delegate routine communications while preserving your style.",
            url: "https://aevion.app/qpersona",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            featureList: [
              "Text style cloning (1000+ messages)",
              "Voice cloning (ElevenLabs-grade)",
              "Decision-history replay",
              "Email auto-reply in your voice",
              "Calendar gatekeeper",
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
            <span className="text-pink-400">Q</span>Persona
          </h1>
          <span className="text-[10px] bg-pink-900 text-pink-300 px-2 py-0.5 rounded-full">IDEA</span>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-16 space-y-6">
        <div className="inline-block px-3 py-1 bg-pink-900/40 border border-pink-800 rounded-full text-xs text-pink-300 font-semibold uppercase tracking-wider">
          AI Personality Twin
        </div>
        <h1 className="text-5xl md:text-6xl font-black tracking-tight">
          Your{" "}
          <span className="bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text text-transparent">
            AI doppelganger.
          </span>
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl leading-relaxed">
          QPersona учится по вашим переписках, голосовым сообщениям, прошлым решениям.
          Отвечает на рутинные письма / сообщения в мессенджерах вашим стилем, пока вы
          заняты. Все спорные случаи — эскалирует к вам.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-12 space-y-8">
        <h2 className="text-3xl font-black">3 модальности</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { t: "📝 Текст", d: "Загрузите 1000+ ваших сообщений — модель копирует стиль, лексику, эмодзи." },
            { t: "🎙 Голос", d: "Запишите 5 минут речи — генерируем войс-клон для голосовых ответов." },
            { t: "🧠 Решения", d: "Логируем 100+ прошлых решений (купить/отказать/перенести) — учим when-to-escalate." },
          ].map(m => (
            <div key={m.t} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="text-lg font-bold mb-2">{m.t}</div>
              <div className="text-sm text-slate-400">{m.d}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-16 space-y-4 text-center border-t border-slate-800">
        <p className="text-slate-500 text-sm">
          Запуск планируется на Q3 2027 после ML-research-фазы. Зависит от QFusionAI v2.
        </p>
      </section>
    </div>
  );
}
