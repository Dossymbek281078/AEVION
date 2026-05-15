import type { Metadata } from "next";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AEVION Fintech Modules — 6 interlocking financial infrastructure layers",
  description: "VeilNetX settlement ledger, QMaskCard payment masking, QPayNet embedded wallets, QGood transparent charity, Z-Tide adaptive reputation, QChainGov on-chain governance.",
  alternates: { canonical: "https://aevion.app/fintech/modules" },
};

const MODULES = [
  {
    id: "veilnetx",
    code: "VNX",
    name: "VeilNetX",
    tagline: "Settlement ledger & privacy routing",
    color: "#8b5cf6",
    icon: "🔒",
    href: "/veilnetx",
    apiHealth: "/api/veilnetx/health",
    features: ["Settlement ledger (PoW-lite)", "Privacy routing", "Waitlist registry", "Multi-sig threshold"],
    usedBy: ["QPayNet", "QMaskCard"],
  },
  {
    id: "qmaskcard",
    code: "QMC",
    name: "QMaskCard",
    tagline: "Virtual card masking for transactions",
    color: "#0ea5e9",
    icon: "💳",
    href: "/qmaskcard",
    apiHealth: "/api/qmaskcard/health",
    features: ["Virtual card issuance", "Spend limits", "Merchant restrictions", "Auto-expire"],
    usedBy: ["AEVION Bank", "QPayNet"],
  },
  {
    id: "qpaynet",
    code: "QPN",
    name: "QPayNet",
    tagline: "Embedded payment wallets & merchant API",
    color: "#6366f1",
    icon: "💸",
    href: "/qpaynet",
    apiHealth: "/api/qpaynet/health",
    features: ["KZT wallets", "P2P transfers", "Merchant charge API", "Payment requests"],
    usedBy: ["QBuild", "QMedia", "AEVION Bank"],
  },
  {
    id: "qgood",
    code: "QGD",
    name: "QGood",
    tagline: "Transparent charity & impact funding",
    color: "#10b981",
    icon: "💚",
    href: "/qgood",
    apiHealth: "/api/qgood/health",
    features: ["Campaign management", "Donation tracking", "AEC cashback", "Impact metrics"],
    usedBy: ["Awards", "Planet"],
  },
  {
    id: "z-tide",
    code: "ZTD",
    name: "Z-Tide",
    tagline: "Adaptive reputation & contribution scoring",
    color: "#f59e0b",
    icon: "⚡",
    href: "/z-tide",
    apiHealth: "/api/ztide/health",
    features: ["Contribution scoring", "Rank system", "Leaderboard", "AEV multipliers"],
    usedBy: ["QBuild", "CyberChess", "QCoreAI"],
  },
  {
    id: "qchaingov",
    code: "QCG",
    name: "QChainGov",
    tagline: "On-chain governance & proposal voting",
    color: "#ef4444",
    icon: "🗳",
    href: "/qchaingov",
    apiHealth: "/api/qchaingov/health",
    features: ["Proposal creation", "AEV-weighted voting", "Quorum enforcement", "Execution hooks"],
    usedBy: ["Planet", "VeilNetX"],
  },
];

async function fetchHealth(path: string): Promise<"ok" | "degraded" | "down"> {
  try {
    const r = await fetch(`${getApiBase()}${path}`, { signal: AbortSignal.timeout(3000), cache: "no-store" });
    return r.ok ? "ok" : "degraded";
  } catch {
    return "down";
  }
}

const STATUS_DOT: Record<string, string> = {
  ok: "bg-emerald-500",
  degraded: "bg-amber-500",
  down: "bg-red-500",
};
const STATUS_LABEL: Record<string, string> = {
  ok: "Live",
  degraded: "Degraded",
  down: "Down",
};

export default async function FintechModulesPage() {
  const healths = await Promise.all(MODULES.map(m => fetchHealth(m.apiHealth)));

  return (
    <main className="min-h-screen bg-[#050810] text-slate-100">
      {/* Header */}
      <div
        className="px-6 py-12 text-center"
        style={{ background: "linear-gradient(135deg, #050810 0%, #0d1117 50%, #050810 100%)" }}
      >
        <Link href="/fintech" className="text-xs text-slate-500 hover:text-slate-300 mb-4 inline-block">← Fintech Hub</Link>
        <h1 className="text-3xl font-black text-white mb-3">6 Fintech Modules</h1>
        <p className="text-slate-400 text-sm max-w-xl mx-auto">
          Each module is an independent deployable service. They interlock through AEV token mechanics, shared audit logs, and the Planet compliance layer.
        </p>
      </div>

      {/* Module grid */}
      <div className="max-w-5xl mx-auto px-4 pb-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m, i) => {
            const health = healths[i];
            return (
              <Link
                key={m.id}
                href={m.href}
                className="group relative bg-slate-900/60 border border-slate-800 rounded-2xl p-5 hover:border-slate-600 transition-colors"
                style={{ borderTopColor: `${m.color}40` }}
              >
                {/* Status dot */}
                <div className="absolute top-4 right-4 flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${STATUS_DOT[health]} ${health === "ok" ? "animate-pulse" : ""}`} />
                  <span className="text-[10px] text-slate-500">{STATUS_LABEL[health]}</span>
                </div>

                {/* Icon + code */}
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                    style={{ background: `${m.color}20` }}
                  >
                    {m.icon}
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm">{m.name}</p>
                    <p className="text-[10px] font-mono" style={{ color: m.color }}>{m.code}</p>
                  </div>
                </div>

                <p className="text-xs text-slate-400 mb-3 leading-relaxed">{m.tagline}</p>

                <ul className="space-y-1 mb-4">
                  {m.features.map(f => (
                    <li key={f} className="text-xs text-slate-500 flex gap-1.5">
                      <span style={{ color: m.color }}>·</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap gap-1">
                  {m.usedBy.map(u => (
                    <span key={u} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">{u}</span>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Cross-module flows */}
        <div className="mt-10 bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">Cross-module flows</h2>
          <div className="space-y-3 text-xs text-slate-400">
            <div className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold shrink-0">Pay flow:</span>
              <span>QPayNet wallet → VeilNetX routing → QMaskCard virtual card → merchant settlement → AEV cashback via Z-Tide</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-violet-400 font-bold shrink-0">Govern flow:</span>
              <span>QChainGov proposal → Z-Tide weighted votes → Planet compliance check → on-chain execution → VeilNetX settlement</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-amber-400 font-bold shrink-0">Charity flow:</span>
              <span>QGood campaign → QPayNet donation → AEV mint (QGood multiplier) → Z-Tide impact score → Awards nomination</span>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link href="/fintech/status" className="text-xs text-slate-500 hover:text-slate-300 mr-4">Live status →</Link>
          <Link href="/fintech/compare" className="text-xs text-slate-500 hover:text-slate-300 mr-4">Compare tiers →</Link>
          <Link href="/developers/fintech" className="text-xs text-slate-500 hover:text-slate-300">API docs →</Link>
        </div>
      </div>
    </main>
  );
}
