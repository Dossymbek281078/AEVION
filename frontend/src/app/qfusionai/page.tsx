"use client";

import Link from "next/link";

const PROVIDERS = [
  { name: "OpenAI", model: "gpt-4o-mini", cost: "$0.15/M", latency: "~1.2s", strength: "All-rounder" },
  { name: "Anthropic", model: "claude-haiku-4-5", cost: "$0.25/M", latency: "~1.5s", strength: "Reasoning" },
  { name: "Gemini", model: "gemini-2.5-flash", cost: "$0.10/M", latency: "~0.8s", strength: "Speed + multimodal" },
  { name: "DeepSeek", model: "deepseek-v3", cost: "$0.05/M", latency: "~1.8s", strength: "Best price" },
  { name: "Grok", model: "grok-3", cost: "$2.00/M", latency: "~2.0s", strength: "Real-time web" },
];

const ROUTING_RULES = [
  { trigger: "Coding task", picks: "Anthropic (reasoning)" },
  { trigger: "Bulk classification", picks: "DeepSeek (cheap)" },
  { trigger: "Fast UX (under 1s)", picks: "Gemini (latency)" },
  { trigger: "News / web data", picks: "Grok (real-time)" },
  { trigger: "Provider down", picks: "Auto-fallback to next-best" },
];

export default function QFusionAILanding() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "AEVION QFusionAI",
            applicationCategory: "DeveloperApplication",
            operatingSystem: "Web, Node.js, Python, Go",
            description:
              "Hybrid AI router: one API across OpenAI, Anthropic, Gemini, DeepSeek, Grok with automatic routing by cost/latency/quality + fallback chain + response cache.",
            url: "https://aevion.app/qfusionai",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            featureList: [
              "5 LLM providers in one API",
              "Auto-routing by cost / latency / quality",
              "Fallback chain on provider down",
              "Response cache (semantic match)",
              "Per-provider rate limits",
              "Cost analytics + budget caps",
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
            <span className="text-purple-400">Q</span>FusionAI
          </h1>
          <span className="text-[10px] bg-purple-900 text-purple-300 px-2 py-0.5 rounded-full">PLANNING</span>
        </div>
        <Link
          href="https://github.com/Dossymbek281078/AEVION"
          className="text-xs text-slate-400 hover:text-white"
        >
          GitHub →
        </Link>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-16 space-y-6">
        <div className="space-y-3">
          <div className="inline-block px-3 py-1 bg-purple-900/40 border border-purple-800 rounded-full text-xs text-purple-300 font-semibold uppercase tracking-wider">
            Hybrid AI Engine
          </div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight">
            One API.{" "}
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Five LLMs.
            </span>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl leading-relaxed">
            QFusionAI автоматически выбирает оптимального провайдера для каждого
            запроса — по цене, скорости, качеству или real-time данным. Падает один
            — переключается на следующий без переписывания кода.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 pt-4">
          <Link
            href="/qcoreai"
            className="px-5 py-2.5 bg-purple-700 hover:bg-purple-600 rounded-lg text-sm font-semibold"
          >
            Попробовать в QCoreAI →
          </Link>
          <Link
            href="https://api.aevion.app/api/aevion/openapi.json"
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold"
          >
            OpenAPI spec
          </Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-12 space-y-8">
        <h2 className="text-3xl font-black">5 провайдеров на борту</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {PROVIDERS.map(p => (
            <div key={p.name} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="text-lg font-bold mb-1">{p.name}</div>
              <div className="text-xs text-slate-500 font-mono mb-3">{p.model}</div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Cost</span>
                  <span className="font-mono text-emerald-400">{p.cost}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Latency</span>
                  <span className="font-mono">{p.latency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Best for</span>
                  <span className="text-slate-300">{p.strength}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-12 space-y-8 bg-slate-900/30 rounded-2xl">
        <h2 className="text-3xl font-black">Auto-routing rules</h2>
        <div className="space-y-2">
          {ROUTING_RULES.map(r => (
            <div
              key={r.trigger}
              className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl p-4"
            >
              <div className="text-sm text-slate-400">{r.trigger}</div>
              <div className="text-sm font-mono text-purple-300">→ {r.picks}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-16 space-y-6 text-center border-t border-slate-800">
        <h2 className="text-3xl font-black">Roadmap</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-left">
          {[
            { phase: "Phase 1", title: "Core router (Q2 2026)", items: ["5 providers", "Cost-based routing", "Health checks"] },
            { phase: "Phase 2", title: "Smart caching (Q3 2026)", items: ["Semantic cache", "Budget caps", "Per-key analytics"] },
            { phase: "Phase 3", title: "Fine-tuning (Q4 2026)", items: ["Custom adapters", "Multi-modal routing", "Streaming SDK"] },
          ].map(p => (
            <div key={p.phase} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="text-[10px] uppercase font-bold text-purple-400 mb-2">{p.phase}</div>
              <div className="text-base font-bold mb-3">{p.title}</div>
              <ul className="space-y-1.5 text-sm text-slate-400">
                {p.items.map(i => <li key={i}>· {i}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
