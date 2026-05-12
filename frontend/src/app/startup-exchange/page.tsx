"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

type Pitch = {
  id: string;
  name: string;
  category: string;
  categoryColor: string;
  raise: string;
  reputation: number;
  traction: string;
  qrightHash: string;
};

const PITCHES: Pitch[] = [
  {
    id: "dronefleet-kz",
    name: "DroneFleet KZ",
    category: "Logistics",
    categoryColor: "bg-sky-500/20 text-sky-300 border-sky-500/40",
    raise: "$2.0M",
    reputation: 82,
    traction: "3 LOIs · Almaty + Astana routes",
    qrightHash: "qr:0x7af2…dronefleet",
  },
  {
    id: "medscan-ai",
    name: "MedScanAI",
    category: "Medtech",
    categoryColor: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    raise: "$5.0M",
    reputation: 91,
    traction: "12 pilot clinics · 38k scans",
    qrightHash: "qr:0x9c14…medscan",
  },
  {
    id: "greenagro-bots",
    name: "GreenAgro Bots",
    category: "Agritech",
    categoryColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    raise: "$1.5M",
    reputation: 74,
    traction: "200 farms onboarded · 4 regions",
    qrightHash: "qr:0x3df8…greenagro",
  },
  {
    id: "finchain-wallet",
    name: "FinChain Wallet",
    category: "Fintech",
    categoryColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    raise: "$3.0M",
    reputation: 68,
    traction: "50K downloads · iOS+Android",
    qrightHash: "qr:0x8e21…finchain",
  },
  {
    id: "edukids-stream",
    name: "EduKids Stream",
    category: "Edtech",
    categoryColor: "bg-violet-500/20 text-violet-300 border-violet-500/40",
    raise: "$0.8M",
    reputation: 79,
    traction: "5K paid subs · 92% retention",
    qrightHash: "qr:0x1b07…edukids",
  },
  {
    id: "aquasan-iot",
    name: "AquaSan IoT",
    category: "Cleantech",
    categoryColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
    raise: "$2.5M",
    reputation: 86,
    traction: "2 city water contracts signed",
    qrightHash: "qr:0x5fa9…aquasan",
  },
];

const CATEGORIES = [
  "Logistics",
  "Medtech",
  "Agritech",
  "Fintech",
  "Edtech",
  "Cleantech",
  "AI/ML",
  "DeepTech",
  "Other",
];

export default function StartupExchangePage() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [target, setTarget] = useState("");
  const [tagline, setTagline] = useState("");
  const [deck, setDeck] = useState("");
  const [traction, setTraction] = useState("");
  const [toasts, setToasts] = useState<string[]>([]);

  const taglineLeft = useMemo(() => 200 - tagline.length, [tagline]);

  function pushToast(msg: string, ttlMs: number) {
    setToasts((t) => [...t, msg]);
    setTimeout(() => {
      setToasts((t) => t.filter((m) => m !== msg));
    }, ttlMs);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const m1 = "1/3 Generating QRight authorship…";
    const m2 = "2/3 Drafting Smart-NDA via QContract…";
    const m3 = "3/3 Pitch listed (status: draft). Investors must sign NDA to view.";
    setTimeout(() => pushToast(m1, 2600), 0);
    setTimeout(() => pushToast(m2, 2400), 900);
    setTimeout(() => pushToast(m3, 3000), 900 + 1100);
    setTimeout(() => {
      setTitle("");
      setTarget("");
      setTagline("");
      setDeck("");
      setTraction("");
    }, 900 + 1100 + 1500);
  }

  const ldJson = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "AEVION StartupX",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "Pitch marketplace with QRight authorship and Smart-NDA via QContract before disclosure.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b0716] via-[#120a26] to-[#0b0716] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }}
      />

      {/* Sticky header */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-violet-900/70 border-b border-violet-500/30">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between text-sm">
          <Link href="/" className="font-medium hover:text-violet-200 transition">
            ← AEVION · StartupX · MVP
          </Link>
          <div className="hidden sm:flex gap-4 text-xs text-violet-200">
            <Link href="/qright" className="hover:text-white">QRight</Link>
            <Link href="/qcontract" className="hover:text-white">QContract</Link>
            <Link href="/qpaynet" className="hover:text-white">QPayNet</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-5 pt-14 pb-10 text-center">
        <div className="inline-block px-3 py-1 rounded-full bg-violet-500/20 border border-violet-400/40 text-xs text-violet-200 mb-5">
          Marketplace · Startups · IP-protected
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          Pitch first. <span className="text-violet-300">Protect first.</span>
        </h1>
        <p className="mt-5 max-w-2xl mx-auto text-violet-100/80 text-base sm:text-lg">
          Биржа стартапов с авторством через QRight и Smart-NDA через QContract.
          Инвесторы видят полный pitch только после подписи. Никаких анонимов.
        </p>
      </section>

      {/* Pitch grid */}
      <section className="max-w-6xl mx-auto px-5 pb-14">
        <h2 className="text-xl font-semibold mb-5">Активные питчи</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PITCHES.map((p) => (
            <article
              key={p.id}
              className="rounded-2xl bg-white/[0.04] border border-white/10 p-5 hover:border-violet-400/40 hover:bg-white/[0.06] transition"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-lg">{p.name}</h3>
                <span className={`text-[10px] px-2 py-1 rounded-full border ${p.categoryColor}`}>
                  {p.category}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-white/60">Target raise</span>
                <span className="font-semibold text-emerald-300">{p.raise}</span>
              </div>

              <div className="mt-3">
                <div className="flex justify-between text-xs text-white/60 mb-1">
                  <span>Founder reputation</span>
                  <span className="text-white/80">{p.reputation}/100</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-400 to-fuchsia-400"
                    style={{ width: `${p.reputation}%` }}
                  />
                </div>
              </div>

              <p className="mt-3 text-sm text-white/80">{p.traction}</p>

              <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full bg-violet-500/10 border border-violet-400/30 text-violet-200 font-mono">
                {p.qrightHash}
              </div>

              <button
                type="button"
                className="mt-4 w-full text-sm px-3 py-2 rounded-xl bg-violet-500/90 hover:bg-violet-500 text-white font-medium transition"
                onClick={() => pushToast(`NDA request sent for ${p.name}. Awaiting founder approval.`, 2600)}
              >
                🔒 Apply for NDA → see full pitch
              </button>
            </article>
          ))}
        </div>
      </section>

      {/* Submit pitch */}
      <section className="max-w-3xl mx-auto px-5 pb-14">
        <h2 className="text-xl font-semibold mb-5">Submit your pitch</h2>
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-white/[0.04] border border-white/10 p-5 space-y-4"
        >
          <div>
            <label className="block text-xs text-white/60 mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm focus:border-violet-400/60 outline-none"
              placeholder="e.g. NeuroSign Onboarding"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/60 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm focus:border-violet-400/60 outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} className="bg-[#1a0f33]">
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Target raise ($)</label>
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                inputMode="numeric"
                className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm focus:border-violet-400/60 outline-none"
                placeholder="2000000"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs text-white/60">Tagline (200 chars)</label>
              <span className={`text-[11px] ${taglineLeft < 0 ? "text-rose-400" : "text-white/40"}`}>
                {taglineLeft} left
              </span>
            </div>
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value.slice(0, 200))}
              maxLength={200}
              className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm focus:border-violet-400/60 outline-none"
              placeholder="One-line hook investors will see first."
            />
          </div>

          <div>
            <label className="block text-xs text-white/60 mb-1">Full deck (text)</label>
            <textarea
              value={deck}
              onChange={(e) => setDeck(e.target.value)}
              rows={5}
              className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm focus:border-violet-400/60 outline-none font-mono"
              placeholder="Problem · Solution · Market · Traction · Team · Ask…"
            />
          </div>

          <div>
            <label className="block text-xs text-white/60 mb-1">Key traction</label>
            <input
              value={traction}
              onChange={(e) => setTraction(e.target.value)}
              className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm focus:border-violet-400/60 outline-none"
              placeholder="e.g. 3 LOIs, $40k MRR, 12 pilot clinics"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:opacity-95 font-semibold text-sm"
          >
            🚀 Publish pitch (with QRight + Smart-NDA)
          </button>
          <p className="text-[11px] text-white/40 text-center">
            On submit: QRight authorship is minted, then Smart-NDA template is drafted via QContract, then pitch is listed in draft mode.
          </p>
        </form>
      </section>

      {/* Investor reputation explainer */}
      <section className="max-w-3xl mx-auto px-5 pb-14">
        <div className="rounded-2xl bg-violet-500/10 border border-violet-400/30 p-5">
          <h3 className="font-semibold text-lg mb-2">👀 Why no anonymous investors</h3>
          <p className="text-sm text-violet-100/85">
            Каждый инвестор на StartupX проходит KYC и получает публичный профиль с историей раундов,
            рейтингом основателей и соблюдением NDA. Анонимность убивает доверие — мы строим репутационный
            слой, где плохое поведение становится дороже денег. Founders видят счёт инвестора до того,
            как раскрывают цифры.
          </p>
        </div>
      </section>

      {/* Cross-links */}
      <section className="max-w-6xl mx-auto px-5 pb-20">
        <h3 className="text-sm uppercase tracking-wider text-white/50 mb-4">Built on AEVION</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            href="/qright"
            className="rounded-xl bg-white/[0.04] border border-white/10 p-4 hover:border-violet-400/40 transition"
          >
            <div className="font-medium">QRight →</div>
            <div className="text-xs text-white/60 mt-1">Авторство pitch'а фиксируется автоматически.</div>
          </Link>
          <Link
            href="/qcontract"
            className="rounded-xl bg-white/[0.04] border border-white/10 p-4 hover:border-violet-400/40 transition"
          >
            <div className="font-medium">QContract →</div>
            <div className="text-xs text-white/60 mt-1">Smart-NDA с self-destruct до раскрытия деталей.</div>
          </Link>
          <Link
            href="/qpaynet"
            className="rounded-xl bg-white/[0.04] border border-white/10 p-4 hover:border-violet-400/40 transition"
          >
            <div className="font-medium">QPayNet →</div>
            <div className="text-xs text-white/60 mt-1">Эскроу-платежи и роялти поверх QPayNet.</div>
          </Link>
        </div>
      </section>

      {/* Toasts */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((t, i) => (
          <div
            key={`${t}-${i}`}
            className="rounded-xl bg-violet-600/95 border border-violet-300/40 px-4 py-3 text-sm shadow-xl shadow-violet-900/40 animate-[fadeIn_0.2s_ease-out]"
          >
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}
