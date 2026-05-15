import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AEVION Fintech — Compare API Tiers",
  description: "Developer/Build/Scale/Enterprise tiers for AEVION fintech APIs: QPayNet, VeilNetX, QMaskCard, QGood, Z-Tide, QChainGov.",
  alternates: { canonical: "https://aevion.app/fintech/compare" },
};

const TIERS = [
  {
    id: "developer",
    name: "Developer",
    price: "Free",
    color: "#64748b",
    callsPerMonth: "10K",
    rateLimit: "100/min",
    sla: null,
    support: "Community",
    features: {
      qpaynet: "Sandbox only",
      veilnetx: "Waitlist read",
      qmaskcard: "1 virtual card",
      qgood: "View campaigns",
      ztide: "Read scores",
      qchaingov: "View proposals",
      settlement: false,
      webhooks: false,
      multiSig: false,
    },
  },
  {
    id: "build",
    name: "Build",
    price: "$49/mo",
    color: "#6366f1",
    callsPerMonth: "100K",
    rateLimit: "500/min",
    sla: "99.0%",
    support: "Email 48h",
    features: {
      qpaynet: "Live KZT wallets",
      veilnetx: "Ledger reads",
      qmaskcard: "10 virtual cards",
      qgood: "Create + donate",
      ztide: "Score + rank",
      qchaingov: "Vote + propose",
      settlement: true,
      webhooks: true,
      multiSig: false,
    },
  },
  {
    id: "scale",
    name: "Scale",
    price: "$199/mo",
    color: "#8b5cf6",
    callsPerMonth: "1M",
    rateLimit: "2K/min",
    sla: "99.5%",
    support: "Email 24h",
    recommended: true,
    features: {
      qpaynet: "Full + bulk",
      veilnetx: "Full ledger",
      qmaskcard: "Unlimited",
      qgood: "Charity API",
      ztide: "Custom weights",
      qchaingov: "Governance hooks",
      settlement: true,
      webhooks: true,
      multiSig: true,
    },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    color: "#f59e0b",
    callsPerMonth: "Unlimited",
    rateLimit: "Dedicated",
    sla: "99.9%",
    support: "Dedicated SRE",
    features: {
      qpaynet: "Full + SLA",
      veilnetx: "Private node",
      qmaskcard: "White-label",
      qgood: "Custom charity",
      ztide: "Private scoring",
      qchaingov: "Custom governance",
      settlement: true,
      webhooks: true,
      multiSig: true,
    },
  },
];

const ROWS: { key: keyof typeof TIERS[0]["features"]; label: string }[] = [
  { key: "qpaynet", label: "QPayNet" },
  { key: "veilnetx", label: "VeilNetX" },
  { key: "qmaskcard", label: "QMaskCard" },
  { key: "qgood", label: "QGood" },
  { key: "ztide", label: "Z-Tide" },
  { key: "qchaingov", label: "QChainGov" },
  { key: "settlement", label: "Real settlement" },
  { key: "webhooks", label: "Webhooks" },
  { key: "multiSig", label: "Multi-sig" },
];

export default function FintechComparePage() {
  return (
    <main className="min-h-screen bg-[#050810] text-slate-100">
      <div className="px-6 py-12 text-center">
        <Link href="/fintech" className="text-xs text-slate-500 hover:text-slate-300 mb-4 inline-block">← Fintech Hub</Link>
        <h1 className="text-3xl font-black text-white mb-3">Compare API Tiers</h1>
        <p className="text-slate-400 text-sm max-w-lg mx-auto">
          All tiers share the same infrastructure. Higher tiers unlock live settlement, higher rate limits, and dedicated support.
        </p>
      </div>

      <div className="max-w-5xl mx-auto px-4 pb-16 overflow-x-auto">
        <table className="w-full border-collapse">
          {/* Tier headers */}
          <thead>
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-40">Feature</th>
              {TIERS.map(t => (
                <th key={t.id} className="px-4 py-3 text-center">
                  <div className="relative">
                    {t.recommended && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: t.color, color: "#000" }}>
                        Popular
                      </div>
                    )}
                    <p className="text-sm font-bold text-white">{t.name}</p>
                    <p className="text-lg font-black mt-0.5" style={{ color: t.color }}>{t.price}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{t.callsPerMonth} calls/mo</p>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Rate limit row */}
            <tr className="border-t border-slate-800">
              <td className="px-4 py-3 text-xs text-slate-400">Rate limit</td>
              {TIERS.map(t => <td key={t.id} className="px-4 py-3 text-center text-xs text-slate-300">{t.rateLimit}</td>)}
            </tr>
            <tr className="border-t border-slate-800">
              <td className="px-4 py-3 text-xs text-slate-400">SLA uptime</td>
              {TIERS.map(t => <td key={t.id} className="px-4 py-3 text-center text-xs text-slate-300">{t.sla ?? "—"}</td>)}
            </tr>
            <tr className="border-t border-slate-800 bg-slate-900/20">
              <td className="px-4 py-3 text-xs text-slate-400">Support</td>
              {TIERS.map(t => <td key={t.id} className="px-4 py-3 text-center text-xs text-slate-300">{t.support}</td>)}
            </tr>

            {/* Module rows */}
            {ROWS.map((row, i) => (
              <tr key={row.key} className={`border-t border-slate-800 ${i % 2 === 0 ? "" : "bg-slate-900/20"}`}>
                <td className="px-4 py-3 text-xs text-slate-400 font-medium">{row.label}</td>
                {TIERS.map(t => {
                  const val = t.features[row.key];
                  return (
                    <td key={t.id} className="px-4 py-3 text-center">
                      {typeof val === "boolean" ? (
                        <span className={val ? "text-emerald-400 text-base" : "text-slate-700 text-base"}>
                          {val ? "✓" : "✗"}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">{val}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          {/* CTA row */}
          <tfoot>
            <tr className="border-t border-slate-800">
              <td className="px-4 py-4" />
              {TIERS.map(t => (
                <td key={t.id} className="px-4 py-4 text-center">
                  <Link
                    href={t.id === "enterprise" ? "/contact" : `/pricing/api-pricing#${t.id}`}
                    className="inline-block px-4 py-2 rounded-xl text-xs font-bold transition-colors"
                    style={{ background: `${t.color}25`, color: t.color, border: `1px solid ${t.color}50` }}
                  >
                    {t.id === "enterprise" ? "Contact us" : `Get ${t.name}`}
                  </Link>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>

        <div className="mt-8 flex flex-wrap justify-center gap-4 text-xs text-slate-500">
          <Link href="/fintech/modules" className="hover:text-slate-300">All modules →</Link>
          <Link href="/fintech/status" className="hover:text-slate-300">Live status →</Link>
          <Link href="/developers/fintech" className="hover:text-slate-300">API docs →</Link>
          <Link href="/keys" className="hover:text-slate-300">Get API key →</Link>
        </div>
      </div>
    </main>
  );
}
