import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AEVION Fintech — Integrations",
  description: "Connect AEVION fintech modules to your stack: REST API, TypeScript SDK, webhooks, Stripe, QPayNet embedded widgets, and Z-Tide reputation hooks.",
  alternates: { canonical: "https://aevion.app/fintech/integrations" },
};

const INTEGRATIONS = [
  {
    category: "Payment processing",
    items: [
      { name: "Stripe", icon: "💳", desc: "Top-up QPayNet wallets via Stripe Checkout. Supports one-time payments and future subscriptions. Configure via STRIPE_SECRET_KEY.", status: "live", href: "/qpaynet/deposit" },
      { name: "QPayNet Embedded Widget", icon: "🔌", desc: "Drop-in wallet button for your web app. Single script tag, zero backend required for read-only balances.", status: "live", href: "/qpaynet/widget/WALLET_ID" },
      { name: "QMaskCard API", icon: "🪪", desc: "Issue virtual card masks programmatically. One REST call per card; expiry + spend limit configurable.", status: "live", href: "/developers/fintech" },
    ],
  },
  {
    category: "Identity & reputation",
    items: [
      { name: "Z-Tide Score Hook", icon: "⚡", desc: "Embed a reputation score badge anywhere. GET /api/ztide/users/:id returns a rank pill you can render inline.", status: "live", href: "/z-tide" },
      { name: "QChainGov Voting SDK", icon: "🗳", desc: "Allow your users to vote on AEVION governance proposals from your app. HMAC-signed, idempotent.", status: "beta", href: "/qchaingov" },
    ],
  },
  {
    category: "Developer tools",
    items: [
      { name: "TypeScript SDK", icon: "📦", desc: "@aevion/fintech-sdk — typed wrappers for all 6 modules, auto-retry, HMAC webhook validation.", status: "live", href: "/developers/fintech/sdk" },
      { name: "Webhooks", icon: "🔔", desc: "HMAC-signed delivery of payment, score, governance and charity events to your endpoint.", status: "live", href: "/developers/fintech/webhooks" },
      { name: "OpenAPI 3.1 spec", icon: "📄", desc: "Machine-readable spec at /api/openapi.json. Import into Postman, Insomnia, or generate client stubs.", status: "live", href: "/api/openapi.json" },
    ],
  },
  {
    category: "Monitoring & observability",
    items: [
      { name: "Health endpoints", icon: "❤️", desc: "GET /api/{module}/health returns {status, service, checks} — wire into your uptime monitor.", status: "live", href: "/fintech/status" },
      { name: "Prometheus metrics", icon: "📊", desc: "GET /api/metrics (Bearer token required) — standard Prometheus scrape format for all modules.", status: "live", href: "/developers/fintech" },
      { name: "Smoke script", icon: "🧪", desc: "node scripts/fintech-all-smoke.js — 13 read-only checks across all 6 modules. Run after deploys.", status: "live", href: "https://github.com/Dossymbek281078/AEVION/blob/main/aevion-globus-backend/scripts/fintech-all-smoke.js" },
    ],
  },
];

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  live:       { bg: "#10b98120", color: "#34d399" },
  beta:       { bg: "#f59e0b20", color: "#fbbf24" },
  coming_soon:{ bg: "#64748b20", color: "#94a3b8" },
};

export default function FintechIntegrationsPage() {
  return (
    <main className="min-h-screen bg-[#050810] text-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Link href="/fintech" className="text-slate-500 hover:text-slate-300 text-xs mb-4 inline-block">← Fintech Hub</Link>
        <h1 className="text-3xl font-black text-white mb-3">Integrations</h1>
        <p className="text-slate-400 text-sm max-w-2xl mb-10">
          Everything you need to embed AEVION fintech into your product — from payment widgets to governance SDKs.
        </p>

        <div className="space-y-10">
          {INTEGRATIONS.map(cat => (
            <div key={cat.category}>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">{cat.category}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {cat.items.map(item => {
                  const style = STATUS_STYLE[item.status] ?? STATUS_STYLE.live;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      target={item.href.startsWith("http") ? "_blank" : undefined}
                      rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
                      className="group block bg-slate-900/60 border border-slate-800 rounded-2xl p-5 hover:border-slate-600 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{item.icon}</span>
                          <span className="text-sm font-bold text-white">{item.name}</span>
                        </div>
                        <span
                          className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                          style={{ background: style.bg, color: style.color }}
                        >
                          {item.status.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 bg-slate-900/40 border border-slate-800 rounded-2xl p-6 text-center">
          <p className="text-sm font-bold text-white mb-2">Need a custom integration?</p>
          <p className="text-xs text-slate-400 mb-4">The AEVION fintech stack is open — every module exposes a stable REST API. Enterprise tier includes dedicated integration support.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/fintech/compare" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-bold transition-colors text-white">Compare tiers</Link>
            <Link href="/developers/fintech" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold transition-colors text-slate-200">API docs →</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
