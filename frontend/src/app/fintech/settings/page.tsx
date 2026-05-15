import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AEVION Fintech — Settings",
  description: "Manage your AEVION fintech API keys, webhook endpoints, notification preferences, and billing.",
  alternates: { canonical: "https://aevion.app/fintech/settings" },
};

const SECTIONS = [
  {
    title: "API Keys",
    icon: "🔑",
    desc: "Create, view, and revoke your AEVION platform API keys. Keys are used to authenticate requests to all fintech module endpoints.",
    href: "/keys",
    cta: "Manage API keys",
    color: "#6366f1",
    items: [
      "Up to 3 active keys (Developer tier)",
      "Format: aev_test_… / aev_live_…",
      "SHA-256 hashed — raw key shown once",
      "Per-key monthly call counter",
    ],
  },
  {
    title: "Webhooks",
    icon: "🔔",
    desc: "Subscribe to real-time events from QPayNet, Z-Tide, QChainGov, QGood, and VeilNetX. Delivered with HMAC-SHA256 signatures.",
    href: "/qpaynet/settings/webhooks",
    cta: "Configure webhooks",
    color: "#06b6d4",
    items: [
      "HMAC-signed delivery (X-Aevion-Signature)",
      "5 retry attempts with exponential backoff",
      "Per-event type filtering",
      "Delivery log & manual retry",
    ],
  },
  {
    title: "Notification Preferences",
    icon: "📬",
    desc: "Choose which events trigger email or in-app notifications across all fintech modules.",
    href: "/qpaynet/notifications/preferences",
    cta: "Set preferences",
    color: "#8b5cf6",
    items: [
      "Transfer confirmations",
      "Governance proposal outcomes",
      "Reputation rank changes",
      "Charity campaign milestones",
    ],
  },
  {
    title: "Billing & Tier",
    icon: "💎",
    desc: "View your current API tier (Developer/Build/Scale/Enterprise), usage this month, and upgrade options.",
    href: "/fintech/compare",
    cta: "View tiers",
    color: "#f59e0b",
    items: [
      "Current tier and monthly call usage",
      "Upgrade path to unlock higher limits",
      "Invoice history (Enterprise)",
      "Cost breakdown per module",
    ],
  },
  {
    title: "Security",
    icon: "🛡",
    desc: "Review recent API activity, suspicious requests, and rotate credentials if needed.",
    href: "/qcoreai/audit",
    cta: "View audit log",
    color: "#10b981",
    items: [
      "Per-key request history",
      "Failed auth attempts",
      "IP allowlist (Scale+ tier)",
      "Key rotation workflow",
    ],
  },
];

export default function FintechSettingsPage() {
  return (
    <main className="min-h-screen bg-[#050810] text-slate-100">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/fintech" className="text-slate-500 hover:text-slate-300 text-xs mb-4 inline-block">← Fintech Hub</Link>
        <h1 className="text-2xl font-black text-white mb-2">Settings</h1>
        <p className="text-slate-400 text-sm mb-8">
          Manage API keys, webhooks, notifications, and billing for all AEVION fintech modules.
        </p>

        <div className="space-y-4">
          {SECTIONS.map(s => (
            <div
              key={s.title}
              className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6"
              style={{ borderLeftColor: s.color, borderLeftWidth: 3 }}
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{s.icon}</span>
                  <h2 className="text-base font-bold text-white">{s.title}</h2>
                </div>
                <Link
                  href={s.href}
                  className="shrink-0 px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors"
                  style={{ background: `${s.color}20`, color: s.color, border: `1px solid ${s.color}40` }}
                >
                  {s.cta} →
                </Link>
              </div>
              <p className="text-sm text-slate-400 mb-3 leading-relaxed">{s.desc}</p>
              <ul className="grid grid-cols-2 gap-1">
                {s.items.map(item => (
                  <li key={item} className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span style={{ color: s.color }}>·</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-4 text-xs text-slate-500 pt-4 border-t border-slate-800">
          <Link href="/fintech/compare" className="hover:text-slate-300">Upgrade tier →</Link>
          <Link href="/developers/fintech" className="hover:text-slate-300">API docs →</Link>
          <Link href="/fintech/status" className="hover:text-slate-300">Live status →</Link>
          <Link href="/developers/fintech/webhooks" className="hover:text-slate-300">Webhook guide →</Link>
        </div>
      </div>
    </main>
  );
}
