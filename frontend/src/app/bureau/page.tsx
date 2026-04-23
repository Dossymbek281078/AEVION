"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

/* ──────────────────────────────────────────────────────────────
   Types
   ────────────────────────────────────────────────────────────── */
type Certificate = {
  id: string;
  title: string;
  kind: string;
  author: string;
  location?: string | null;
  contentHash: string;
  algorithm: string;
  protectedAt: string;
  verifiedCount: number;
  verifyUrl: string;
};

type BureauStats = {
  totals: {
    certificates: number;
    verifications: number;
    authorsApprox: number;
    countriesApprox: number;
    lastProtectedAt: string | null;
  };
  byKind: Array<{ kind: string; count: number; verifications: number }>;
  byCountry: Array<{ country: string; count: number }>;
  growth30d: Array<{ day: string; count: number }>;
  latest: Array<{
    id: string;
    title: string;
    kind: string;
    author: string;
    location: string | null;
    contentHash: string;
    protectedAt: string;
    verifiedCount: number;
  }>;
  generatedAt: string;
};

type SortMode = "recent" | "popular" | "az";
type KindKey = "" | "music" | "code" | "design" | "text" | "video" | "idea" | "other";

/* ──────────────────────────────────────────────────────────────
   Constants
   ────────────────────────────────────────────────────────────── */
const KIND_ICONS: Record<string, string> = {
  music: "🎵", code: "💻", design: "🎨", text: "📝", video: "🎬", idea: "💡", other: "📦",
};

const KIND_LABELS: Record<string, string> = {
  music: "Music / Audio",
  code: "Code / Software",
  design: "Design / Visual",
  text: "Text / Article",
  video: "Video / Film",
  idea: "Idea / Concept",
  other: "Other",
};

const KIND_COLORS: Record<string, string> = {
  music: "#ec4899",
  code: "#0ea5e9",
  design: "#a855f7",
  text: "#0d9488",
  video: "#f59e0b",
  idea: "#eab308",
  other: "#64748b",
};

const LEGAL_FRAMEWORKS = [
  { name: "Berne Convention", desc: "Automatic copyright protection in 181 member states — no registration required", scope: "181 countries", color: "#0d9488", article: "Art. 5(2)" },
  { name: "WIPO Copyright Treaty", desc: "Extends protection to digital works: software, databases, digital content", scope: "International", color: "#3b82f6", article: "WCT 1996" },
  { name: "TRIPS Agreement (WTO)", desc: "Minimum IP protection standards across 164 WTO member states", scope: "164 countries", color: "#8b5cf6", article: "WTO TRIPS" },
  { name: "eIDAS Regulation", desc: "Electronic signatures have legal effect equivalent to handwritten", scope: "European Union", color: "#0ea5e9", article: "No. 910/2014" },
  { name: "ESIGN Act", desc: "Electronic signatures carry same legal standing as handwritten", scope: "United States", color: "#6366f1", article: "15 U.S.C. §7001" },
  { name: "KZ Digital Signature Law", desc: "Electronic digital signatures are legally equivalent to handwritten", scope: "Kazakhstan", color: "#f59e0b", article: "No. 370-II" },
];

/* Debounce helper (tiny inline) */
function useDebounced<T>(value: T, delay = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/* ──────────────────────────────────────────────────────────────
   Sparkline SVG
   ────────────────────────────────────────────────────────────── */
function Sparkline({ points, height = 44, stroke = "#0d9488", fill = "rgba(13,148,136,0.15)" }: { points: number[]; height?: number; stroke?: string; fill?: string }) {
  const w = 140;
  const h = height;
  if (!points.length) return <svg width={w} height={h} />;
  const max = Math.max(1, ...points);
  const step = w / Math.max(1, points.length - 1);
  const coords = points.map((p, i) => [i * step, h - (p / max) * (h - 6) - 3] as const);
  const linePath = coords.map(([x, y], i) => (i === 0 ? `M${x.toFixed(1)},${y.toFixed(1)}` : `L${x.toFixed(1)},${y.toFixed(1)}`)).join(" ");
  const fillPath = `${linePath} L${w},${h} L0,${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <path d={fillPath} fill={fill} />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* Count-up animation */
function useCountUp(target: number, durationMs = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setV(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return v;
}

/* ──────────────────────────────────────────────────────────────
   Page
   ────────────────────────────────────────────────────────────── */
export default function BureauPage() {
  const { showToast } = useToast();

  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [stats, setStats] = useState<BureauStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const [q, setQ] = useState("");
  const [kind, setKind] = useState<KindKey>("");
  const [sort, setSort] = useState<SortMode>("recent");
  const debouncedQ = useDebounced(q, 220);

  /* Load stats once */
  useEffect(() => {
    (async () => {
      try {
        setLoadingStats(true);
        const res = await fetch(apiUrl("/api/pipeline/bureau/stats"));
        if (res.ok) setStats(await res.json());
      } catch {}
      finally { setLoadingStats(false); }
    })();
  }, []);

  /* Load certificates whenever query changes */
  useEffect(() => {
    (async () => {
      try {
        setLoadingList(true);
        const params = new URLSearchParams();
        if (debouncedQ) params.set("q", debouncedQ);
        if (kind) params.set("kind", kind);
        if (sort) params.set("sort", sort);
        params.set("limit", "60");
        const res = await fetch(apiUrl(`/api/pipeline/certificates?${params.toString()}`));
        if (res.ok) {
          const data = await res.json();
          setCertificates(data.certificates || []);
        } else {
          setCertificates([]);
        }
      } catch { setCertificates([]); }
      finally { setLoadingList(false); }
    })();
  }, [debouncedQ, kind, sort]);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => showToast(`${label} copied!`, "success"),
      () => showToast("Copy failed", "error")
    );
  };

  /* Derived metrics */
  const totals = stats?.totals;
  const growthSeries = stats?.growth30d || [];
  const kindTotal = useMemo(() => (stats?.byKind || []).reduce((s, r) => s + r.count, 0), [stats]);
  const topCountries = stats?.byCountry || [];
  const maxCountry = Math.max(1, ...topCountries.map((c) => c.count));

  /* Animated counts (fallback to 0 when no stats yet) */
  const animCerts = useCountUp(totals?.certificates || 0);
  const animVerif = useCountUp(totals?.verifications || 0);
  const animAuthors = useCountUp(totals?.authorsApprox || 0);
  const animCountries = useCountUp(totals?.countriesApprox || 0);

  return (
    <main>
      <ProductPageShell maxWidth={1080}>
        <Wave1Nav />

        {/* ── Hero ── */}
        <section style={{
          position: "relative",
          borderRadius: 22,
          overflow: "hidden",
          marginBottom: 22,
          background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #312e81 100%)",
        }}>
          {/* decorative rings */}
          <div aria-hidden style={{ position: "absolute", top: -120, right: -80, width: 360, height: 360, borderRadius: "50%", background: "radial-gradient(closest-side, rgba(13,148,136,0.35), rgba(13,148,136,0))", filter: "blur(12px)" }} />
          <div aria-hidden style={{ position: "absolute", bottom: -140, left: -80, width: 420, height: 420, borderRadius: "50%", background: "radial-gradient(closest-side, rgba(99,102,241,0.3), rgba(99,102,241,0))", filter: "blur(14px)" }} />

          <div style={{ position: "relative", padding: "36px 32px 30px", color: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
              <div style={{ width: 58, height: 58, borderRadius: 16, background: "linear-gradient(135deg, #0d9488, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, boxShadow: "0 10px 30px rgba(6,182,212,0.35)" }}>⚖️</div>
              <div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 999, background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.35)", fontSize: 10, fontWeight: 800, color: "#5eead4", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
                  Bureau v2 · Live
                </div>
                <h1 style={{ fontSize: 30, fontWeight: 900, margin: "6px 0 0", letterSpacing: "-0.025em" }}>AEVION Digital IP Bureau</h1>
                <p style={{ margin: "2px 0 0", fontSize: 13, opacity: 0.78 }}>Cryptographic Proof of Authorship & Prior Art · 181 countries · 3-layer protection</p>
              </div>
            </div>

            <p style={{ margin: "0 0 18px", fontSize: 14.5, opacity: 0.85, lineHeight: 1.65, maxWidth: 720 }}>
              The world&apos;s first fully digital patent bureau. Register, sign, and certify your intellectual property with military-grade cryptography — backed by the Berne Convention, WIPO Copyright Treaty, TRIPS, eIDAS, ESIGN and national digital-signature laws.
            </p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
              <Link href="/qright" style={{ padding: "11px 22px", borderRadius: 12, background: "linear-gradient(135deg, #0d9488, #06b6d4)", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: 14, display: "inline-flex", alignItems: "center", gap: 6, boxShadow: "0 8px 24px rgba(6,182,212,0.35)" }}>
                🛡️ Protect Your Work
              </Link>
              <Link href="/quantum-shield" style={{ padding: "11px 22px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 13 }}>
                Quantum Shield
              </Link>
              <a href="#registry" style={{ padding: "11px 22px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.14)", background: "transparent", color: "#e2e8f0", textDecoration: "none", fontWeight: 600, fontSize: 13 }}>
                Browse Registry ↓
              </a>
            </div>

            {/* trust bar */}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11, color: "#94a3b8" }}>
              {["SHA-256", "HMAC-SHA256", "Ed25519 (RFC 8032)", "Shamir 2-of-3", "Berne · WIPO · TRIPS", "eIDAS · ESIGN"].map((t) => (
                <span key={t} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}>{t}</span>
              ))}
            </div>
          </div>
        </section>

        {/* ── KPI grid with animated counts + sparkline ── */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 22 }}>
          {[
            { label: "Certificates Issued", value: animCerts, color: "#0d9488", sub: totals?.lastProtectedAt ? `last: ${new Date(totals.lastProtectedAt).toLocaleDateString()}` : "—", icon: "📜" },
            { label: "Total Verifications", value: animVerif, color: "#3b82f6", sub: "public lookups", icon: "🔍" },
            { label: "Authors Protected", value: animAuthors, color: "#8b5cf6", sub: "worldwide", icon: "✍️" },
            { label: "Countries", value: animCountries, color: "#f59e0b", sub: "represented", icon: "🌍" },
          ].map((k) => (
            <div key={k.label} style={{ padding: "16px 16px 14px", borderRadius: 16, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", position: "relative", overflow: "hidden" }}>
              <div aria-hidden style={{ position: "absolute", top: -10, right: -10, width: 60, height: 60, borderRadius: "50%", background: k.color, opacity: 0.08 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <span>{k.icon}</span>
                <span>{k.label}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: k.color, marginTop: 6, fontVariantNumeric: "tabular-nums" }}>
                {loadingStats ? "—" : k.value.toLocaleString()}
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{k.sub}</div>
            </div>
          ))}
        </section>

        {/* ── Charts row: growth + kind distribution + top countries ── */}
        <section style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr", gap: 12, marginBottom: 26 }}>
          {/* 30-day growth */}
          <div style={{ padding: "14px 16px 16px", borderRadius: 16, border: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>Registry growth</div>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>Last 30 days</div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#0d9488", background: "rgba(13,148,136,0.08)", padding: "3px 8px", borderRadius: 6 }}>
                +{growthSeries.reduce((s, r) => s + r.count, 0)}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Sparkline points={growthSeries.map((p) => p.count)} height={64} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#94a3b8", marginTop: 6 }}>
              <span>{growthSeries[0]?.day || "—"}</span>
              <span>{growthSeries[growthSeries.length - 1]?.day || "—"}</span>
            </div>
          </div>

          {/* Kind distribution */}
          <div style={{ padding: "14px 16px 16px", borderRadius: 16, border: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>By type</div>
            {loadingStats ? (
              <div style={{ fontSize: 11, color: "#94a3b8" }}>Loading…</div>
            ) : (stats?.byKind || []).length === 0 ? (
              <div style={{ fontSize: 11, color: "#94a3b8" }}>No data yet</div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {(stats?.byKind || []).slice(0, 5).map((r) => {
                  const pct = kindTotal > 0 ? Math.round((r.count / kindTotal) * 100) : 0;
                  const color = KIND_COLORS[r.kind] || "#64748b";
                  return (
                    <div key={r.kind}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#64748b", marginBottom: 2 }}>
                        <span style={{ fontWeight: 700, color: "#334155" }}>{KIND_ICONS[r.kind] || "📦"} {KIND_LABELS[r.kind] || r.kind}</span>
                        <span style={{ fontVariantNumeric: "tabular-nums" }}>{r.count} · {pct}%</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 999, background: "rgba(15,23,42,0.06)", overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 999, transition: "width .4s ease" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top countries */}
          <div style={{ padding: "14px 16px 16px", borderRadius: 16, border: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>Top countries</div>
            {loadingStats ? (
              <div style={{ fontSize: 11, color: "#94a3b8" }}>Loading…</div>
            ) : topCountries.length === 0 ? (
              <div style={{ fontSize: 11, color: "#94a3b8" }}>No data yet</div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {topCountries.slice(0, 5).map((c) => {
                  const pct = Math.round((c.count / maxCountry) * 100);
                  return (
                    <div key={c.country}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#64748b", marginBottom: 2 }}>
                        <span style={{ fontWeight: 700, color: "#334155" }}>🌐 {c.country}</span>
                        <span style={{ fontVariantNumeric: "tabular-nums" }}>{c.count}</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 999, background: "rgba(15,23,42,0.06)", overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, #0d9488, #06b6d4)", borderRadius: 999 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ── How it works ── */}
        <section style={{ marginBottom: 26 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", marginBottom: 12, letterSpacing: "-0.01em" }}>How AEVION IP Bureau works</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              { n: "1", title: "Register", desc: "Describe your work — we generate a SHA-256 content hash", icon: "📋", color: "#0d9488" },
              { n: "2", title: "Sign", desc: "HMAC-SHA256 cryptographic signature proves integrity", icon: "🔏", color: "#3b82f6" },
              { n: "3", title: "Shield", desc: "Ed25519 + Shamir's Secret Sharing (2-of-3) for quantum-grade protection", icon: "🛡️", color: "#8b5cf6" },
              { n: "4", title: "Certify", desc: "IP Certificate with legal basis — publicly verifiable via QR", icon: "📜", color: "#f59e0b" },
            ].map((s) => (
              <div key={s.n} style={{ padding: "16px 16px 14px", borderRadius: 16, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", position: "relative" }}>
                <div style={{ position: "absolute", top: 12, right: 12, fontSize: 22 }}>{s.icon}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: s.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900 }}>{s.n}</div>
                </div>
                <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a", marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 11.5, color: "#64748b", lineHeight: 1.55 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Registry with search/filter/sort ── */}
        <section id="registry" style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.01em" }}>Public Certificate Registry</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                {loadingList ? "Loading…" : `${certificates.length} of ${totals?.certificates ?? 0} certificates · verifiable by anyone`}
              </div>
            </div>
            <Link href="/qright" style={{ padding: "9px 16px", borderRadius: 10, background: "#0f172a", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 12 }}>+ New Certificate</Link>
          </div>

          {/* filter bar */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, marginBottom: 14 }}>
            <div style={{ position: "relative" }}>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by title, author, country, city…"
                style={{ width: "100%", padding: "10px 12px 10px 34px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.12)", background: "#fff", fontSize: 13, color: "#0f172a", outline: "none", boxSizing: "border-box" }}
              />
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#94a3b8" }}>🔍</span>
              {q && (
                <button
                  onClick={() => setQ("")}
                  style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", cursor: "pointer", color: "#94a3b8", fontSize: 12, fontWeight: 700 }}
                  aria-label="Clear"
                >✕</button>
              )}
            </div>

            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as KindKey)}
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.12)", background: "#fff", fontSize: 13, color: "#0f172a", fontWeight: 600, cursor: "pointer" }}
            >
              <option value="">All types</option>
              {Object.keys(KIND_LABELS).map((k) => (
                <option key={k} value={k}>{KIND_ICONS[k]} {KIND_LABELS[k]}</option>
              ))}
            </select>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.12)", background: "#fff", fontSize: 13, color: "#0f172a", fontWeight: 600, cursor: "pointer" }}
            >
              <option value="recent">Newest first</option>
              <option value="popular">Most verified</option>
              <option value="az">A → Z</option>
            </select>
          </div>

          {/* cards */}
          {loadingList ? (
            <div style={{ display: "grid", gap: 10 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ height: 128, borderRadius: 14, background: "linear-gradient(90deg, rgba(15,23,42,0.04), rgba(15,23,42,0.08), rgba(15,23,42,0.04))", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
              ))}
              <style jsx>{`
                @keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
              `}</style>
            </div>
          ) : certificates.length === 0 ? (
            <div style={{ textAlign: "center", padding: "56px 20px", borderRadius: 16, border: "1px dashed rgba(15,23,42,0.15)", background: "#fff" }}>
              <div style={{ fontSize: 52, marginBottom: 10 }}>📜</div>
              <div style={{ fontWeight: 800, fontSize: 17, color: "#0f172a", marginBottom: 6 }}>
                {q || kind ? "No certificates match your filters" : "No certificates yet"}
              </div>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 18 }}>
                {q || kind ? "Try broadening your search." : "Be the first to register your work on AEVION."}
              </div>
              {(q || kind) ? (
                <button onClick={() => { setQ(""); setKind(""); }} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.12)", background: "#fff", fontWeight: 700, cursor: "pointer", color: "#0f172a", fontSize: 13 }}>
                  Clear filters
                </button>
              ) : (
                <Link href="/qright" style={{ display: "inline-block", padding: "12px 24px", borderRadius: 12, background: "linear-gradient(135deg, #0d9488, #06b6d4)", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: 14 }}>
                  🛡️ Protect your first work
                </Link>
              )}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {certificates.map((cert) => {
                const kindColor = KIND_COLORS[cert.kind] || "#64748b";
                return (
                  <div key={cert.id} style={{ border: "1px solid rgba(15,23,42,0.08)", borderRadius: 14, padding: 16, background: "#fff", transition: "transform .15s ease, box-shadow .15s ease" }}
                       onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(15,23,42,0.08)"; }}
                       onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 16 }}>{KIND_ICONS[cert.kind] || "📦"}</span>
                          <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 800, background: `${kindColor}20`, color: kindColor, textTransform: "uppercase" }}>{KIND_LABELS[cert.kind] || cert.kind}</span>
                          <span style={{ fontSize: 11, color: "#94a3b8" }}>{new Date(cert.protectedAt).toLocaleDateString()}</span>
                        </div>
                        <div style={{ fontWeight: 800, fontSize: 17, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cert.title}</div>
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>by {cert.author}{cert.location ? ` · ${cert.location}` : ""}</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                        <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 10, fontWeight: 800, background: "rgba(16,185,129,0.1)", color: "#059669", whiteSpace: "nowrap" }}>✓ CERTIFIED</span>
                        {cert.verifiedCount > 0 && <span style={{ fontSize: 10, color: "#94a3b8" }}>Verified {cert.verifiedCount}×</span>}
                      </div>
                    </div>

                    <div style={{ padding: "8px 10px", borderRadius: 8, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.06)", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>SHA-256 Content Hash</div>
                        <div style={{ fontSize: 11, fontFamily: "ui-monospace, Menlo, monospace", color: "#334155", wordBreak: "break-all" }}>{cert.contentHash}</div>
                      </div>
                      <button onClick={() => copy(cert.contentHash, "Hash")} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(15,23,42,0.12)", background: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer", color: "#475569", flexShrink: 0 }}>Copy</button>
                    </div>

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <Link href={`/verify/${cert.id}`} style={{ padding: "7px 14px", borderRadius: 8, background: "#0d9488", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>✓ Verify</Link>
                      <a
                        href={apiUrl(`/api/pipeline/certificate/${cert.id}/pdf`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ padding: "7px 14px", borderRadius: 8, background: "#0f172a", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
                      >
                        📄 PDF
                      </a>
                      <button onClick={() => copy(cert.verifyUrl, "Verify URL")} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", background: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", color: "#475569" }}>Copy Link</button>
                      <button onClick={() => copy(cert.id, "Certificate ID")} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", background: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", color: "#475569" }}>Copy ID</button>
                      <button
                        onClick={() => copy(`<a href="${cert.verifyUrl}"><img src="${apiUrl(`/api/pipeline/badge/${cert.id}`)}" alt="Protected by AEVION" /></a>`, "Embed snippet")}
                        style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", background: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", color: "#475569" }}
                      >Embed badge</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Legal Framework ── */}
        <section style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", marginBottom: 6, letterSpacing: "-0.01em" }}>Legal Framework</div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14, lineHeight: 1.6, maxWidth: 760 }}>
            AEVION IP Bureau operates under established international copyright and digital-signature laws. Our certificates serve as cryptographic proof of prior art — admissible evidence in IP disputes worldwide.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {LEGAL_FRAMEWORKS.map((l) => (
              <div key={l.name} style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: l.color, flexShrink: 0 }} />
                  <div style={{ fontWeight: 800, fontSize: 13, color: "#0f172a" }}>{l.name}</div>
                </div>
                <div style={{ fontSize: 11.5, color: "#64748b", lineHeight: 1.55, marginBottom: 8 }}>{l.desc}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: l.color }}>{l.scope}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", fontFamily: "ui-monospace, Menlo, monospace" }}>{l.article}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Why this matters (investor thesis) ── */}
        <section style={{
          marginBottom: 28,
          borderRadius: 18,
          overflow: "hidden",
          border: "1px solid rgba(15,23,42,0.08)",
          background: "linear-gradient(135deg, #fafafa 0%, #f1f5f9 100%)",
        }}>
          <div style={{ padding: "22px 24px 8px" }}>
            <div style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, background: "rgba(13,148,136,0.1)", color: "#0d9488", fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>For investors</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.015em", marginBottom: 6 }}>A $100B IP protection market — built for the digital century</div>
            <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.65, maxWidth: 760 }}>
              Traditional patent offices are slow, expensive and national. AEVION offers instant, international, cryptographic proof of authorship — at 1% of the cost and 1/1000th of the time.
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, padding: "14px 24px 22px" }}>
            {[
              { title: "Global TAM", value: "$100B+", desc: "IP registration, notarization & rights management worldwide" },
              { title: "Cost advantage", value: "100× cheaper", desc: "vs. traditional copyright registration & notarization" },
              { title: "Speed advantage", value: "< 3 seconds", desc: "full 4-step protection vs. weeks of bureaucracy" },
              { title: "Defensible moat", value: "3-layer crypto", desc: "SHA-256 + HMAC + Ed25519 + Shamir SSS" },
            ].map((x) => (
              <div key={x.title} style={{ padding: "14px 14px 12px", borderRadius: 12, background: "#fff", border: "1px solid rgba(15,23,42,0.06)" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{x.title}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#0d9488", marginTop: 4, marginBottom: 4 }}>{x.value}</div>
                <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>{x.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Embeddable badge CTA ── */}
        <section style={{ marginBottom: 28, padding: "18px 22px", borderRadius: 16, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", display: "grid", gridTemplateColumns: "1fr auto", gap: 14, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", marginBottom: 4 }}>Embed the “Protected by AEVION” badge</div>
            <div style={{ fontSize: 12.5, color: "#64748b", lineHeight: 1.55 }}>
              Every issued certificate produces a live SVG badge you can paste on any website, GitHub README, or portfolio — links straight to the public verification page.
            </div>
            <div style={{ marginTop: 10, fontSize: 11, fontFamily: "ui-monospace, Menlo, monospace", color: "#334155", background: "#f8fafc", padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.06)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              &lt;img src=&quot;.../api/pipeline/badge/&lt;cert-id&gt;&quot; /&gt;
            </div>
          </div>
          <div style={{ flexShrink: 0 }}>
            <div style={{ width: 280, height: 58, borderRadius: 10, background: "linear-gradient(135deg, #0f172a, #1e1b4b)", position: "relative", overflow: "hidden", padding: "8px 12px", color: "#fff", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg, #0d9488, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: "#0f172a" }}>✓</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.06em" }}>PROTECTED BY AEVION</div>
                <div style={{ fontSize: 12, fontWeight: 800 }}>Your Work Title</div>
                <div style={{ fontSize: 9, color: "#5eead4", fontFamily: "ui-monospace, Menlo, monospace" }}>a1b2c3d4… · 0 verifications</div>
              </div>
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 4, background: "linear-gradient(90deg, #0d9488, #06b6d4)" }} />
            </div>
          </div>
        </section>

        {/* ── Technology stack ── */}
        <section style={{ padding: "18px 22px", borderRadius: 16, border: "1px solid rgba(15,23,42,0.08)", background: "rgba(15,23,42,0.02)", marginBottom: 28 }}>
          <div style={{ fontWeight: 900, fontSize: 14, color: "#0f172a", marginBottom: 10 }}>Technology Stack</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              "SHA-256 (NIST FIPS 180-4)",
              "HMAC-SHA256",
              "Ed25519 (RFC 8032)",
              "Shamir's Secret Sharing 2-of-3",
              "PostgreSQL 15",
              "Public Verification API",
              "PDF certificates + QR",
              "Embeddable SVG badges",
            ].map((t) => (
              <span key={t} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600, background: "#fff", border: "1px solid rgba(15,23,42,0.08)", color: "#334155" }}>{t}</span>
            ))}
          </div>
        </section>

        {/* ── Disclaimer ── */}
        <div style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", marginBottom: 40 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#92400e", marginBottom: 4 }}>Legal Disclaimer</div>
          <div style={{ fontSize: 11, color: "#78716c", lineHeight: 1.6 }}>
            Certificates issued by AEVION Digital IP Bureau constitute cryptographic proof of existence and authorship at the recorded time. They do not constitute a patent, trademark, or government-issued copyright registration. They serve as admissible evidence of prior art in intellectual property disputes under the legal frameworks referenced above.
          </div>
        </div>
      </ProductPageShell>
    </main>
  );
}
