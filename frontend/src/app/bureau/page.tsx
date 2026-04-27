"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  source?: "postgres" | "memory";
};

type SortMode = "recent" | "popular" | "az";
type KindKey = "" | "music" | "code" | "design" | "text" | "video" | "idea" | "other";

type LookupResult =
  | { protected: false; hash: string; source?: string }
  | {
      protected: true;
      hash: string;
      source?: string;
      certificate: {
        id: string; title: string; kind: string; author: string; location: string | null;
        contentHash: string; algorithm: string; protectedAt: string; verifiedCount: number; verifyUrl: string;
      };
    };

type Anchor = {
  version: string;
  algorithm: string;
  leafCount: number;
  merkleRoot: string;
  publishedAt: string;
  source?: string;
};

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

/* Markdown export — render the currently-loaded certificate slice as a
 * pipe-separated Markdown table and trigger a download. Stays
 * client-side: no backend round-trip, perfectly mirrors what the user
 * sees with their current filters. Pipe characters in titles are
 * escaped so the table doesn't fracture.
 */
function exportMarkdown(
  certs: Certificate[],
  q: string,
  kind: string,
  sort: string,
): void {
  if (typeof window === "undefined" || certs.length === 0) return;
  const escapeCell = (v: string): string => v.replace(/\|/g, "\\|").replace(/\n/g, " ");
  const header = "| # | Title | Type | Author | Location | Protected | Verified | Cert ID | Verify URL |";
  const sep = "|---|-------|------|--------|----------|-----------|----------|---------|------------|";
  const rows = certs.map((c, i) => {
    const cells = [
      String(i + 1),
      escapeCell(c.title || ""),
      escapeCell(c.kind || ""),
      escapeCell(c.author || ""),
      escapeCell(c.location || ""),
      new Date(c.protectedAt).toISOString().slice(0, 10),
      `${c.verifiedCount}×`,
      `\`${c.id}\``,
      c.verifyUrl ? `[verify](${c.verifyUrl})` : "—",
    ];
    return "| " + cells.join(" | ") + " |";
  });
  const filterDesc: string[] = [];
  if (q) filterDesc.push(`q="${q}"`);
  if (kind) filterDesc.push(`kind=${kind}`);
  if (sort) filterDesc.push(`sort=${sort}`);
  const md = [
    "# AEVION Bureau — Public Certificate Registry",
    "",
    `Exported ${new Date().toISOString()}` +
      (filterDesc.length ? ` · filters: ${filterDesc.join(", ")}` : "") +
      ` · ${certs.length} certificate(s)`,
    "",
    "Verify any row independently at https://aevion.app/verify/<cert id> — no AEVION login required.",
    "",
    header,
    sep,
    ...rows,
    "",
  ].join("\n");

  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `aevion-bureau-${new Date().toISOString().slice(0, 10)}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* Relative time helper — keeps copy concise on cards / activity feed.
 * Returns "just now", "5 min ago", "3 h ago", "yesterday", "12 d ago",
 * "8 mo ago", or "2 y ago". Falls back to a localized date string for
 * invalid input.
 */
function formatRelative(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const diff = Date.now() - t;
  const sec = Math.round(diff / 1000);
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const day = Math.round(hr / 24);
  if (day === 1) return "yesterday";
  if (day < 30) return `${day} d ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo} mo ago`;
  const yr = Math.round(mo / 12);
  return `${yr} y ago`;
}

/* Debounce helper (tiny inline) */
function useDebounced<T>(value: T, delay = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/* SHA-256 helpers running entirely in the browser */
async function sha256OfBuffer(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function sha256OfFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  return sha256OfBuffer(buf);
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

  const [statsError, setStatsError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [previewCert, setPreviewCert] = useState<Certificate | null>(null);
  const [activityTick, setActivityTick] = useState(0);
  const [hashInput, setHashInput] = useState("");
  const [checkerBusy, setCheckerBusy] = useState(false);
  const [checkerFile, setCheckerFile] = useState<{ name: string; size: number } | null>(null);
  const [checkerResult, setCheckerResult] = useState<LookupResult | null>(null);
  const [checkerError, setCheckerError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [batch, setBatch] = useState<Array<{ name: string; size: number; hash?: string; status: "hashing" | "checking" | "found" | "missing" | "error"; cert?: { id: string; title: string; author: string; protectedAt: string; verifiedCount: number }; error?: string }>>([]);
  const [helpOpen, setHelpOpen] = useState<boolean>(false);
  // nowTick re-renders the page once a minute so relative timestamps
  // ("3 min ago", "yesterday") stay accurate without a hard refresh.
  const [nowTick, setNowTick] = useState<number>(0);
  useEffect(() => {
    const i = setInterval(() => setNowTick((n) => n + 1), 60_000);
    return () => clearInterval(i);
  }, []);
  void nowTick;
  const searchRef = useRef<HTMLInputElement>(null);

  /* Load stats */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingStats(true);
        setStatsError(null);
        const res = await fetch(apiUrl("/api/pipeline/bureau/stats"));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setStats(data);
          setLastSynced(Date.now());
        }
      } catch (e) {
        if (!cancelled) setStatsError(e instanceof Error ? e.message : "offline");
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshNonce]);

  /* Load certificates whenever query changes */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingList(true);
        setListError(null);
        const params = new URLSearchParams();
        if (debouncedQ) params.set("q", debouncedQ);
        if (kind) params.set("kind", kind);
        if (sort) params.set("sort", sort);
        params.set("limit", "60");
        const res = await fetch(apiUrl(`/api/pipeline/certificates?${params.toString()}`));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setCertificates(data.certificates || []);
      } catch (e) {
        if (!cancelled) {
          setListError(e instanceof Error ? e.message : "offline");
          setCertificates([]);
        }
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debouncedQ, kind, sort, refreshNonce]);

  const handleRefresh = () => setRefreshNonce((n) => n + 1);

  /* Load Merkle anchor alongside stats */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/pipeline/bureau/anchor"));
        if (res.ok) {
          const j = (await res.json()) as Anchor;
          if (!cancelled) setAnchor(j);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [refreshNonce]);

  /* Activity auto-tick (every 15s when tab is visible) — re-fetches stats */
  useEffect(() => {
    const onVisibility = () => { /* no-op trigger by interval */ };
    document.addEventListener("visibilitychange", onVisibility);
    const i = setInterval(() => {
      if (document.visibilityState === "visible") setActivityTick((n) => n + 1);
    }, 15000);
    return () => { document.removeEventListener("visibilitychange", onVisibility); clearInterval(i); };
  }, []);

  useEffect(() => {
    if (activityTick === 0) return;
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/pipeline/bureau/stats"));
        if (res.ok) {
          setStats(await res.json());
          setLastSynced(Date.now());
        }
      } catch {}
    })();
  }, [activityTick]);

  /* Keyboard shortcuts: / focuses search, r refreshes, n opens /qright, ? opens help */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const inField = !!active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);
      // Esc always closes the help overlay regardless of focus.
      if (e.key === "Escape" && helpOpen) {
        e.preventDefault();
        setHelpOpen(false);
        return;
      }
      if (e.key === "/" && !inField) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      // ? is shift + / on US layouts; capture both forms so it works on
      // layouts where shift+/ doesn't produce ?.
      if ((e.key === "?" || (e.key === "/" && e.shiftKey)) && !inField) {
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }
      if (!inField && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key === "r") { e.preventDefault(); setRefreshNonce((n) => n + 1); return; }
        if (e.key === "n") { e.preventDefault(); window.location.href = "/qright"; return; }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [helpOpen]);

  /* Hash checker: send to backend */
  async function runLookup(hashHex: string) {
    setCheckerBusy(true);
    setCheckerError(null);
    setCheckerResult(null);
    try {
      const res = await fetch(apiUrl(`/api/pipeline/lookup/${hashHex}`));
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      setCheckerResult(await res.json());
    } catch (e) {
      setCheckerError(e instanceof Error ? e.message : "lookup failed");
    } finally {
      setCheckerBusy(false);
    }
  }

  async function handleFileCheck(file: File) {
    try {
      setCheckerBusy(true);
      setCheckerError(null);
      setCheckerResult(null);
      setCheckerFile({ name: file.name, size: file.size });
      const hex = await sha256OfFile(file);
      setHashInput(hex);
      await runLookup(hex);
    } catch (e) {
      setCheckerError(e instanceof Error ? e.message : "hashing failed");
      setCheckerBusy(false);
    }
  }

  async function handleManualCheck() {
    const h = hashInput.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(h)) {
      setCheckerError("Enter a 64-character lowercase hex SHA-256");
      return;
    }
    setCheckerFile(null);
    await runLookup(h);
  }

  function handleClearChecker() {
    setHashInput("");
    setCheckerResult(null);
    setCheckerError(null);
    setCheckerFile(null);
    setBatch([]);
  }

  async function handleBatchFiles(files: File[]) {
    if (!files.length) return;
    setCheckerResult(null);
    setCheckerError(null);
    setCheckerFile(null);
    const initial = files.map((f) => ({ name: f.name, size: f.size, status: "hashing" as const }));
    setBatch(initial);
    // Hash + lookup each file with limited concurrency (4).
    const q = [...files.entries()];
    const worker = async () => {
      while (q.length) {
        const entry = q.shift();
        if (!entry) break;
        const [idx, f] = entry;
        try {
          const hash = await sha256OfFile(f);
          setBatch((prev) => prev.map((r, i) => (i === idx ? { ...r, hash, status: "checking" } : r)));
          const res = await fetch(apiUrl(`/api/pipeline/lookup/${hash}`));
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j?.error || `HTTP ${res.status}`);
          }
          const j: LookupResult = await res.json();
          setBatch((prev) => prev.map((r, i) => {
            if (i !== idx) return r;
            return j.protected
              ? { ...r, status: "found", cert: { id: j.certificate.id, title: j.certificate.title, author: j.certificate.author, protectedAt: j.certificate.protectedAt, verifiedCount: j.certificate.verifiedCount } }
              : { ...r, status: "missing" };
          }));
        } catch (e) {
          setBatch((prev) => prev.map((r, i) => (i === idx ? { ...r, status: "error", error: e instanceof Error ? e.message : "failed" } : r)));
        }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
  }

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

        {/* ── File / Hash Checker (unique killer widget) ── */}
        <section style={{ marginBottom: 14, borderRadius: 18, overflow: "hidden", border: "1px solid rgba(15,23,42,0.08)", background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)" }}>
          <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid rgba(15,23,42,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, background: "rgba(13,148,136,0.1)", color: "#0d9488", fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Instant check</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.01em" }}>Is your work already protected?</div>
              <div style={{ fontSize: 12.5, color: "#64748b", lineHeight: 1.5, marginTop: 2 }}>
                Drop a file or paste a SHA-256. We hash it locally in your browser — your file never leaves your device.
              </div>
            </div>
            {anchor && (
              <div title={`Merkle root over ${anchor.leafCount} certificates — tamper-evident registry anchor. Recomputable from the public registry.`} style={{ padding: "8px 12px", borderRadius: 10, background: "#0f172a", color: "#e2e8f0", minWidth: 220, cursor: "help" }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.06em" }}>REGISTRY ANCHOR · {anchor.leafCount} leaves</div>
                <div style={{ fontSize: 10.5, fontFamily: "ui-monospace, Menlo, monospace", color: "#5eead4", wordBreak: "break-all", marginTop: 2 }}>{anchor.merkleRoot.slice(0, 32)}…</div>
                <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>{new Date(anchor.publishedAt).toLocaleString()}</div>
              </div>
            )}
          </div>

          <div style={{ padding: "16px 22px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {/* Drop zone */}
            <label
              htmlFor="aevion-file-check"
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault(); setDragOver(false);
                const files = Array.from(e.dataTransfer.files || []);
                if (files.length === 1) handleFileCheck(files[0]);
                else if (files.length > 1) handleBatchFiles(files);
              }}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                minHeight: 120, padding: "16px 14px", borderRadius: 14, cursor: "pointer",
                border: `2px dashed ${dragOver ? "#0d9488" : "rgba(15,23,42,0.15)"}`,
                background: dragOver ? "rgba(13,148,136,0.06)" : "#fff",
                textAlign: "center", transition: "background .15s ease, border-color .15s ease",
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 6 }}>📁</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>Drop one or many files</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>Hashed locally with Web Crypto SHA-256 · nothing is uploaded.</div>
              {checkerFile && (
                <div style={{ marginTop: 8, fontSize: 10.5, color: "#334155", background: "rgba(15,23,42,0.05)", padding: "4px 10px", borderRadius: 999, fontFamily: "ui-monospace, Menlo, monospace" }}>
                  {checkerFile.name} · {(checkerFile.size / 1024).toFixed(1)} KB
                </div>
              )}
              <input id="aevion-file-check" type="file" multiple style={{ display: "none" }} onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (files.length === 1) handleFileCheck(files[0]);
                else if (files.length > 1) handleBatchFiles(files);
                (e.target as HTMLInputElement).value = "";
              }} />
            </label>

            {/* Hash input */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                or paste a SHA-256 (64 hex chars)
              </label>
              <textarea
                value={hashInput}
                onChange={(e) => setHashInput(e.target.value.replace(/\s+/g, ""))}
                placeholder="e.g. 9985021b07c412915c03549e59459c2d514c41b8bb7d3c3ab33fef9c6d4ff06c"
                rows={3}
                style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.12)", fontSize: 12, fontFamily: "ui-monospace, Menlo, monospace", color: "#0f172a", background: "#fff", resize: "none", outline: "none" }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleManualCheck}
                  disabled={checkerBusy}
                  style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #0d9488, #06b6d4)", color: "#fff", fontSize: 13, fontWeight: 800, cursor: checkerBusy ? "wait" : "pointer", opacity: checkerBusy ? 0.6 : 1 }}
                >
                  {checkerBusy ? "Checking…" : "✓ Check registry"}
                </button>
                <button onClick={handleClearChecker} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.12)", background: "#fff", color: "#0f172a", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Clear</button>
              </div>
              {/* Sample hashes — pulled from the live registry's first cert
                  (real, will hit "found") and a deterministic dummy that
                  will hit "missing". Lets first-time visitors see both
                  outcomes without needing their own file. */}
              {stats?.latest && stats.latest.length > 0 ? (
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", fontSize: 11, color: "#64748b" }}>
                  <span>No file handy?</span>
                  <button
                    type="button"
                    onClick={() => setHashInput(stats.latest[0].contentHash)}
                    title={`Real cert hash from "${stats.latest[0].title}" — will be FOUND`}
                    style={{ padding: "3px 9px", borderRadius: 999, border: "1px solid rgba(15,118,110,0.3)", background: "rgba(15,118,110,0.06)", color: "#0f766e", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                  >
                    Try a real hash
                  </button>
                  <button
                    type="button"
                    onClick={() => setHashInput("0".repeat(64))}
                    title="64 zeros — guaranteed not in registry, will be MISSING"
                    style={{ padding: "3px 9px", borderRadius: 999, border: "1px solid rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.06)", color: "#92400e", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                  >
                    Try a missing hash
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {/* Batch result */}
          {batch.length > 0 && (
            <div style={{ padding: "14px 22px 18px" }}>
              {(() => {
                const found = batch.filter((b) => b.status === "found").length;
                const missing = batch.filter((b) => b.status === "missing").length;
                const errored = batch.filter((b) => b.status === "error").length;
                const pending = batch.length - found - missing - errored;
                return (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ padding: "3px 10px", borderRadius: 999, background: "rgba(16,185,129,0.1)", color: "#059669", fontSize: 11, fontWeight: 800 }}>✓ {found} protected</span>
                        <span style={{ padding: "3px 10px", borderRadius: 999, background: "rgba(245,158,11,0.1)", color: "#92400e", fontSize: 11, fontWeight: 800 }}>🛡️ {missing} unprotected</span>
                        {errored > 0 && <span style={{ padding: "3px 10px", borderRadius: 999, background: "rgba(239,68,68,0.1)", color: "#b91c1c", fontSize: 11, fontWeight: 800 }}>⚠ {errored} errors</span>}
                        {pending > 0 && <span style={{ padding: "3px 10px", borderRadius: 999, background: "rgba(15,23,42,0.06)", color: "#475569", fontSize: 11, fontWeight: 800 }}>{pending} in progress</span>}
                      </div>
                      {missing > 0 && (
                        <Link href="/qright" style={{ padding: "8px 14px", borderRadius: 10, background: "linear-gradient(135deg, #0d9488, #06b6d4)", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: 12 }}>
                          🛡️ Protect the {missing} unprotected →
                        </Link>
                      )}
                    </div>
                    <div style={{ border: "1px solid rgba(15,23,42,0.08)", borderRadius: 10, overflow: "hidden", maxHeight: 280, overflowY: "auto" }}>
                      {batch.map((b, i) => (
                        <div key={i} style={{ display: "grid", gridTemplateColumns: "20px 1fr auto 100px", gap: 10, alignItems: "center", padding: "8px 12px", background: i % 2 === 0 ? "#fff" : "#f8fafc", borderBottom: i < batch.length - 1 ? "1px solid rgba(15,23,42,0.04)" : "none", fontSize: 12 }}>
                          <span>
                            {b.status === "hashing" || b.status === "checking" ? "⏳" :
                             b.status === "found" ? "✅" :
                             b.status === "missing" ? "🛡️" : "⚠"}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</div>
                            {b.hash ? (
                              <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10, color: "#64748b" }}>{b.hash.slice(0, 32)}…</div>
                            ) : b.status === "hashing" ? (
                              <div style={{ fontSize: 10, color: "#94a3b8" }}>hashing…</div>
                            ) : null}
                          </div>
                          <span style={{ fontSize: 10, color: "#94a3b8", fontVariantNumeric: "tabular-nums" }}>{(b.size / 1024).toFixed(1)} KB</span>
                          <span style={{ textAlign: "right" }}>
                            {b.status === "found" && b.cert ? (
                              <Link href={`/verify/${b.cert.id}`} style={{ color: "#0d9488", fontWeight: 800, fontSize: 11, textDecoration: "none" }}>Verify →</Link>
                            ) : b.status === "missing" ? (
                              <Link href="/qright" style={{ color: "#92400e", fontWeight: 800, fontSize: 11, textDecoration: "none" }}>Protect →</Link>
                            ) : b.status === "error" ? (
                              <span style={{ color: "#b91c1c", fontSize: 10, fontWeight: 700 }}>{b.error?.slice(0, 24)}</span>
                            ) : (
                              <span style={{ color: "#94a3b8", fontSize: 10 }}>…</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* Single Result */}
          {(checkerResult || checkerError || checkerBusy) && batch.length === 0 && (
            <div style={{ padding: "14px 22px 20px" }}>
              {checkerBusy ? (
                <div style={{ fontSize: 12, color: "#64748b" }}>Computing hash / querying registry…</div>
              ) : checkerError ? (
                <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", color: "#b91c1c", fontSize: 12, fontWeight: 700 }}>⚠ {checkerError}</div>
              ) : checkerResult && checkerResult.protected ? (
                <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.25)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 20 }}>✅</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: "#059669" }}>This work is already protected</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>Found in AEVION Bureau registry</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Title</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{checkerResult.certificate.title}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Author</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{checkerResult.certificate.author}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Protected</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{new Date(checkerResult.certificate.protectedAt).toLocaleString()}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Verifications</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{checkerResult.certificate.verifiedCount}×</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    <Link href={`/verify/${checkerResult.certificate.id}`} style={{ padding: "8px 16px", borderRadius: 8, background: "#0d9488", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 12 }}>Open Certificate →</Link>
                    <button onClick={() => copy(checkerResult.certificate.id, "Certificate ID")} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.12)", background: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", color: "#475569" }}>Copy ID</button>
                  </div>
                </div>
              ) : checkerResult && !checkerResult.protected ? (
                <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 20 }}>🛡️</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: "#92400e" }}>Not protected yet</div>
                      <div style={{ fontSize: 11, color: "#64748b", fontFamily: "ui-monospace, Menlo, monospace", wordBreak: "break-all" }}>{checkerResult.hash}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "#78716c", lineHeight: 1.5, marginTop: 6 }}>
                    This SHA-256 hash isn&apos;t in the AEVION registry yet. Register now — one click, 3 seconds, backed by international copyright law.
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <Link href="/qright" style={{ padding: "9px 18px", borderRadius: 10, background: "linear-gradient(135deg, #0d9488, #06b6d4)", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: 13 }}>🛡️ Protect now</Link>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>

        {/* ── Data status strip ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#64748b", flexWrap: "wrap" }}>
            {statsError || listError ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#b91c1c", fontWeight: 700 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444" }} />
                Data source temporarily unavailable
              </span>
            ) : lastSynced ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#059669", fontWeight: 700 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
                Synced {new Date(lastSynced).toLocaleTimeString()}
              </span>
            ) : (
              <span style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(15,23,42,0.05)", color: "#64748b", fontWeight: 700 }}>Loading live registry…</span>
            )}
            {stats?.source === "memory" && (
              <span
                title="Backend is running without a connected database — showing demonstration data. Set DATABASE_URL to switch to production storage."
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", color: "#92400e", fontWeight: 700 }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b" }} />
                Demo data
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              title="Keyboard shortcuts (press ?)"
              aria-label="Show keyboard shortcuts"
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.1)", background: "#f8fafc", color: "#64748b", fontSize: 10, fontWeight: 800, fontFamily: "ui-monospace, Menlo, monospace", cursor: "pointer" }}
            >
              ?   /   r   n
            </button>
            <button
              onClick={handleRefresh}
              disabled={loadingStats || loadingList}
              style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.12)", background: "#fff", color: "#0f172a", fontSize: 11, fontWeight: 700, cursor: loadingStats || loadingList ? "wait" : "pointer", opacity: loadingStats || loadingList ? 0.6 : 1 }}
              title="Reload live registry data (r)"
            >
              {loadingStats || loadingList ? "Refreshing…" : "↻ Refresh"}
            </button>
          </div>
        </div>

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

        {/* ── Live activity feed ── */}
        {stats && stats.latest && stats.latest.length > 0 && (
          <section style={{ marginBottom: 26, padding: "16px 18px", borderRadius: 16, border: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981", animation: "pulse 1.8s infinite" }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>Live activity</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>Auto-refresh every 15s · last {stats.latest.length} certifications</div>
                </div>
              </div>
              {stats.generatedAt && <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "ui-monospace, Menlo, monospace" }}>updated {new Date(stats.generatedAt).toLocaleTimeString()}</div>}
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {stats.latest.map((l) => (
                <div key={l.id} style={{ display: "grid", gridTemplateColumns: "20px 1fr auto auto", gap: 10, alignItems: "center", padding: "8px 10px", borderRadius: 10, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.04)" }}>
                  <span style={{ fontSize: 14 }}>{KIND_ICONS[l.kind] || "📦"}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.title}</div>
                    <div style={{ fontSize: 10.5, color: "#64748b" }}>by {l.author}{l.location ? ` · ${l.location}` : ""}</div>
                  </div>
                  <span title={new Date(l.protectedAt).toLocaleString()} style={{ fontSize: 10, color: "#94a3b8", fontVariantNumeric: "tabular-nums" }}>{formatRelative(l.protectedAt)}</span>
                  <Link href={`/verify/${l.id}`} style={{ padding: "4px 10px", borderRadius: 6, background: "#fff", border: "1px solid rgba(15,23,42,0.12)", color: "#0d9488", textDecoration: "none", fontSize: 10, fontWeight: 800 }}>Verify →</Link>
                </div>
              ))}
            </div>
            <style jsx>{`
              @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.35 } }
            `}</style>
          </section>
        )}

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
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a
                href={(() => {
                  const p = new URLSearchParams();
                  if (debouncedQ) p.set("q", debouncedQ);
                  if (kind) p.set("kind", kind);
                  if (sort) p.set("sort", sort);
                  return apiUrl(`/api/pipeline/certificates.csv${p.toString() ? `?${p.toString()}` : ""}`);
                })()}
                target="_blank"
                rel="noopener noreferrer"
                style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.15)", background: "#fff", color: "#0f172a", textDecoration: "none", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
                title="Download the current registry view as CSV"
              >
                📥 Export CSV
              </a>
              <button
                type="button"
                onClick={() => exportMarkdown(certificates, debouncedQ, kind, sort)}
                disabled={certificates.length === 0}
                title="Download the current registry view as a Markdown table — paste into docs / READMEs / blog posts"
                style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.15)", background: certificates.length === 0 ? "rgba(15,23,42,0.04)" : "#fff", color: certificates.length === 0 ? "#94a3b8" : "#0f172a", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6, cursor: certificates.length === 0 ? "default" : "pointer" }}
              >
                📝 Export Markdown
              </button>
              <Link href="/qright" style={{ padding: "9px 16px", borderRadius: 10, background: "#0f172a", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 12 }}>+ New Certificate</Link>
            </div>
          </div>

          {/* filter bar */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, marginBottom: 8 }}>
            <div style={{ position: "relative" }}>
              <input
                ref={searchRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by title, author, country, city… (press /)"
                aria-label="Search registry"
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

          {/* Suggested queries — teach users what works in the search box. */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 14, fontSize: 11, color: "#64748b" }}>
            <span>Try:</span>
            {(
              [
                { label: "music", q: "", k: "music" as KindKey, hint: "Filter by type" },
                { label: "code", q: "", k: "code" as KindKey, hint: "Filter by type" },
                { label: "Kazakhstan", q: "Kazakhstan", k: "" as KindKey, hint: "Search by country" },
                { label: "popular", q: "", k: "" as KindKey, s: "popular" as SortMode, hint: "Sort by verifies" },
              ] as Array<{ label: string; q: string; k: KindKey; s?: SortMode; hint: string }>
            ).map((sug) => (
              <button
                key={sug.label}
                type="button"
                onClick={() => {
                  setQ(sug.q);
                  setKind(sug.k);
                  if (sug.s) setSort(sug.s);
                }}
                title={sug.hint}
                style={{ padding: "3px 9px", borderRadius: 999, border: "1px solid rgba(15,23,42,0.1)", background: "#f8fafc", color: "#334155", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
              >
                {sug.label}
              </button>
            ))}
            {(q || kind || sort !== "recent") && (
              <button
                type="button"
                onClick={() => { setQ(""); setKind(""); setSort("recent"); }}
                style={{ padding: "3px 9px", borderRadius: 999, border: "1px solid rgba(15,23,42,0.1)", background: "#fff", color: "#64748b", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
              >
                Reset
              </button>
            )}
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
          ) : listError ? (
            <div style={{ textAlign: "center", padding: "56px 20px", borderRadius: 16, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.04)" }}>
              <div style={{ fontSize: 46, marginBottom: 8 }}>🛰️</div>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#b91c1c", marginBottom: 4 }}>Registry source unreachable</div>
              <div style={{ fontSize: 12.5, color: "#7f1d1d", marginBottom: 16, maxWidth: 420, margin: "0 auto 16px" }}>
                We couldn&apos;t reach the verification backend. Your certificates are safe — this is a transient connectivity issue.
              </div>
              <button onClick={handleRefresh} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.25)", background: "#fff", fontWeight: 700, cursor: "pointer", color: "#0f172a", fontSize: 13 }}>
                ↻ Retry
              </button>
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
                  <div key={cert.id}
                       onClick={(e) => {
                         const t = e.target as HTMLElement;
                         if (t.closest("button") || t.closest("a")) return;
                         setPreviewCert(cert);
                       }}
                       style={{ border: "1px solid rgba(15,23,42,0.08)", borderRadius: 14, padding: 16, background: "#fff", transition: "transform .15s ease, box-shadow .15s ease", cursor: "pointer" }}
                       onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(15,23,42,0.08)"; }}
                       onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 16 }}>{KIND_ICONS[cert.kind] || "📦"}</span>
                          <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 800, background: `${kindColor}20`, color: kindColor, textTransform: "uppercase" }}>{KIND_LABELS[cert.kind] || cert.kind}</span>
                          <span title={new Date(cert.protectedAt).toLocaleString()} style={{ fontSize: 11, color: "#94a3b8" }}>{formatRelative(cert.protectedAt)}</span>
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

        {/* ── Pricing plans ── */}
        <section style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.01em" }}>Simple, honest pricing</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>Every plan includes 3-layer cryptographic protection, international legal basis, and public verifiability.</div>
            </div>
            <div style={{ fontSize: 11, color: "#0d9488", fontWeight: 800, padding: "4px 10px", borderRadius: 999, background: "rgba(13,148,136,0.08)", border: "1px solid rgba(13,148,136,0.2)" }}>
              Save 20% with annual billing
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {[
              {
                name: "Free",
                price: "$0",
                per: "forever",
                tagline: "For individual creators getting started.",
                color: "#64748b",
                bg: "#fff",
                features: [
                  "Up to 3 certificates / month",
                  "SHA-256 + HMAC + Ed25519 protection",
                  "Public verification page + QR",
                  "Embeddable SVG badge",
                  "Community support",
                ],
                cta: { label: "Start free", href: "/qright", primary: false },
              },
              {
                name: "Pro",
                price: "$29",
                per: "per month",
                tagline: "For serious creators and small teams.",
                color: "#0d9488",
                bg: "linear-gradient(180deg, rgba(13,148,136,0.06), rgba(6,182,212,0.04))",
                featured: true,
                features: [
                  "Unlimited certificates",
                  "Batch protection (upload many files)",
                  "CSV + JSON registry export",
                  "Priority verification & support",
                  "Custom embed badges",
                  "Merkle-root inclusion proofs",
                ],
                cta: { label: "Upgrade to Pro", href: "/auth?plan=pro", primary: true },
              },
              {
                name: "Enterprise",
                price: "Custom",
                per: "annual",
                tagline: "For studios, publishers, labels, law firms.",
                color: "#8b5cf6",
                bg: "#fff",
                features: [
                  "REST API + webhooks",
                  "White-label certificate design",
                  "SSO (SAML / OIDC)",
                  "Dedicated Merkle anchor + audit log",
                  "On-prem / regional deployment",
                  "SLA & named support engineer",
                ],
                cta: { label: "Talk to sales", href: "mailto:yahiin1978@gmail.com?subject=AEVION%20Enterprise%20inquiry", primary: false, external: true },
              },
            ].map((p) => (
              <div key={p.name} style={{
                borderRadius: 16,
                padding: "20px 18px 18px",
                background: p.bg,
                border: `1px solid ${p.featured ? "rgba(13,148,136,0.4)" : "rgba(15,23,42,0.08)"}`,
                position: "relative",
                boxShadow: p.featured ? "0 12px 30px rgba(13,148,136,0.15)" : "none",
              }}>
                {p.featured && (
                  <div style={{ position: "absolute", top: -10, left: 18, padding: "3px 10px", borderRadius: 999, background: "linear-gradient(135deg, #0d9488, #06b6d4)", color: "#fff", fontSize: 10, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    Most popular
                  </div>
                )}
                <div style={{ fontSize: 12, fontWeight: 800, color: p.color, letterSpacing: "0.05em", textTransform: "uppercase" }}>{p.name}</div>
                <div style={{ fontSize: 34, fontWeight: 900, color: "#0f172a", marginTop: 6, letterSpacing: "-0.025em", lineHeight: 1 }}>{p.price}</div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{p.per}</div>
                <div style={{ fontSize: 12.5, color: "#475569", marginTop: 10, lineHeight: 1.5 }}>{p.tagline}</div>
                <ul style={{ listStyle: "none", padding: 0, margin: "14px 0 16px", display: "grid", gap: 6 }}>
                  {p.features.map((f) => (
                    <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, color: "#0f172a" }}>
                      <span style={{ color: p.color, fontWeight: 900, flexShrink: 0 }}>✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {p.cta.external ? (
                  <a href={p.cta.href} style={{ display: "block", textAlign: "center", padding: "11px 18px", borderRadius: 10, textDecoration: "none", fontWeight: 800, fontSize: 13, background: p.cta.primary ? "linear-gradient(135deg, #0d9488, #06b6d4)" : "#fff", color: p.cta.primary ? "#fff" : "#0f172a", border: p.cta.primary ? "none" : "1px solid rgba(15,23,42,0.12)" }}>
                    {p.cta.label} →
                  </a>
                ) : (
                  <Link href={p.cta.href} style={{ display: "block", textAlign: "center", padding: "11px 18px", borderRadius: 10, textDecoration: "none", fontWeight: 800, fontSize: 13, background: p.cta.primary ? "linear-gradient(135deg, #0d9488, #06b6d4)" : "#fff", color: p.cta.primary ? "#fff" : "#0f172a", border: p.cta.primary ? "none" : "1px solid rgba(15,23,42,0.12)" }}>
                    {p.cta.label} →
                  </Link>
                )}
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

        {/* ── Audit & Disclaimer ── */}
        <section style={{ marginBottom: 40, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(13,148,136,0.06)", border: "1px solid rgba(13,148,136,0.15)" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#0d9488", marginBottom: 4 }}>Public audit</div>
            <div style={{ fontSize: 11, color: "#334155", lineHeight: 1.6, marginBottom: 10 }}>
              The entire active registry — every certificate plus the current Merkle anchor — is publicly downloadable as deterministic JSON for independent verification.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a href={apiUrl("/api/pipeline/bureau/snapshot.json")} target="_blank" rel="noopener noreferrer" style={{ padding: "7px 14px", borderRadius: 8, background: "#0d9488", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: 11 }}>↓ snapshot.json</a>
              <a href={apiUrl("/api/pipeline/bureau/anchor")} target="_blank" rel="noopener noreferrer" style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(13,148,136,0.3)", background: "#fff", color: "#0d9488", textDecoration: "none", fontWeight: 800, fontSize: 11 }}>anchor.json</a>
              <a href={apiUrl("/api/openapi.json")} target="_blank" rel="noopener noreferrer" style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.1)", background: "#fff", color: "#0f172a", textDecoration: "none", fontWeight: 800, fontSize: 11 }}>OpenAPI</a>
            </div>
          </div>
          <div style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#92400e", marginBottom: 4 }}>Legal Disclaimer</div>
            <div style={{ fontSize: 11, color: "#78716c", lineHeight: 1.6 }}>
              Certificates issued by AEVION Digital IP Bureau constitute cryptographic proof of existence and authorship at the recorded time. They do not constitute a patent, trademark, or government-issued copyright registration. They serve as admissible evidence of prior art in intellectual property disputes under the legal frameworks referenced above.
            </div>
          </div>
        </section>
      </ProductPageShell>

      {previewCert && (
        <CertificatePreviewModal cert={previewCert} onClose={() => setPreviewCert(null)} onCopy={copy} />
      )}

      {helpOpen && <ShortcutHelpOverlay onClose={() => setHelpOpen(false)} />}
    </main>
  );
}

/* ──────────────────────────────────────────────────────────────
   Keyboard shortcut help overlay
   ────────────────────────────────────────────────────────────── */
function ShortcutHelpOverlay({ onClose }: { onClose: () => void }) {
  const shortcuts: Array<{ keys: string[]; label: string }> = [
    { keys: ["?"], label: "Toggle this help" },
    { keys: ["/"], label: "Focus the registry search" },
    { keys: ["r"], label: "Refresh stats + registry" },
    { keys: ["n"], label: "Open QRight to register a new certificate" },
    { keys: ["Esc"], label: "Close any open modal or overlay" },
  ];
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 90 }}
    >
      <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 16, padding: 22, boxShadow: "0 24px 48px rgba(15,23,42,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>Keyboard shortcuts</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Quick keys for the AEVION Bureau registry.</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 4 }}
          >
            ×
          </button>
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          {shortcuts.map((s) => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.06)" }}>
              <span style={{ fontSize: 12, color: "#334155" }}>{s.label}</span>
              <span style={{ display: "flex", gap: 4 }}>
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    style={{ minWidth: 24, padding: "2px 8px", borderRadius: 6, border: "1px solid rgba(15,23,42,0.15)", background: "#fff", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11, fontWeight: 800, color: "#0f172a", textAlign: "center" }}
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Certificate preview modal
   ────────────────────────────────────────────────────────────── */
type InclusionProof = {
  version: string;
  certId: string;
  leaf: string;
  leafIndex: number;
  leafCount: number;
  path: Array<{ hash: string; side: "L" | "R" }>;
  merkleRoot: string;
  verifyAlgorithm: string;
  publishedAt: string;
};

function CertificatePreviewModal({ cert, onClose, onCopy }: { cert: Certificate; onClose: () => void; onCopy: (text: string, label: string) => void }) {
  const [proof, setProof] = useState<InclusionProof | null>(null);
  const [proofBusy, setProofBusy] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);

  async function loadProof() {
    try {
      setProofBusy(true);
      setProofError(null);
      const res = await fetch(apiUrl(`/api/pipeline/bureau/proof/${cert.id}`));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setProof(await res.json());
    } catch (e) {
      setProofError(e instanceof Error ? e.message : "proof failed");
    } finally {
      setProofBusy(false);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prevOverflow; };
  }, [onClose]);

  const verifyUrl = cert.verifyUrl || `https://aevion.vercel.app/verify/${cert.id}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(verifyUrl)}`;
  const shareText = `I just certified "${cert.title}" on AEVION Digital IP Bureau — cryptographic proof of authorship backed by the Berne Convention.`;

  const shareLinks = [
    { name: "Twitter",   color: "#0f172a", url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(verifyUrl)}` },
    { name: "LinkedIn",  color: "#0a66c2", url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(verifyUrl)}` },
    { name: "Telegram",  color: "#26a5e4", url: `https://t.me/share/url?url=${encodeURIComponent(verifyUrl)}&text=${encodeURIComponent(shareText)}` },
    { name: "WhatsApp",  color: "#25d366", url: `https://wa.me/?text=${encodeURIComponent(shareText + " " + verifyUrl)}` },
    { name: "Email",     color: "#64748b", url: `mailto:?subject=${encodeURIComponent("AEVION IP Certificate: " + cert.title)}&body=${encodeURIComponent(shareText + "\n\n" + verifyUrl)}` },
  ];

  const kindColor = KIND_COLORS[cert.kind] || "#64748b";

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)", zIndex: 60, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "50px 20px", overflowY: "auto" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 640, borderRadius: 18, background: "#fff", boxShadow: "0 40px 80px rgba(2,6,23,0.45)", overflow: "hidden" }}
      >
        {/* header */}
        <div style={{ padding: "18px 22px", background: "linear-gradient(135deg, #0f172a, #1e1b4b)", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#5eead4", letterSpacing: "0.08em", textTransform: "uppercase" }}>AEVION Digital IP Bureau · Protection Certificate</div>
            <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4, letterSpacing: "-0.015em" }}>{cert.title}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{KIND_ICONS[cert.kind] || "📦"} {KIND_LABELS[cert.kind] || cert.kind} · by {cert.author}{cert.location ? ` · ${cert.location}` : ""}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16, fontWeight: 800 }}>✕</button>
        </div>

        {/* body */}
        <div style={{ padding: "20px 22px", display: "grid", gridTemplateColumns: "1fr 200px", gap: 18 }}>
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Status</div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 999, background: "rgba(16,185,129,0.1)", color: "#059669", fontSize: 11, fontWeight: 800, marginTop: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} /> Active
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Verifications</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>{cert.verifiedCount}×</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Protected</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginTop: 4 }}>{new Date(cert.protectedAt).toLocaleString()}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Type</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: kindColor, marginTop: 4 }}>{KIND_LABELS[cert.kind] || cert.kind}</div>
              </div>
            </div>

            <div style={{ padding: "10px 12px", borderRadius: 10, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.06)", marginBottom: 12 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>SHA-256 Content Hash</div>
              <div style={{ fontSize: 11, fontFamily: "ui-monospace, Menlo, monospace", color: "#334155", wordBreak: "break-all" }}>{cert.contentHash}</div>
            </div>

            <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>Algorithm</div>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 14 }}>{cert.algorithm}</div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link href={`/verify/${cert.id}`} style={{ padding: "9px 16px", borderRadius: 10, background: "#0d9488", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: 13 }}>✓ Open full verification</Link>
              <a href={apiUrl(`/api/pipeline/certificate/${cert.id}/pdf`)} target="_blank" rel="noopener noreferrer" style={{ padding: "9px 16px", borderRadius: 10, background: "#0f172a", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: 13 }}>📄 PDF</a>
              <button onClick={loadProof} disabled={proofBusy} style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid rgba(13,148,136,0.35)", background: "rgba(13,148,136,0.08)", fontWeight: 800, fontSize: 12, cursor: proofBusy ? "wait" : "pointer", color: "#0d9488" }}>
                {proofBusy ? "Loading…" : "🔐 Merkle proof"}
              </button>
              <button onClick={() => onCopy(verifyUrl, "Verify URL")} style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.12)", background: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", color: "#475569" }}>Copy Link</button>
              <button onClick={() => onCopy(cert.contentHash, "Hash")} style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.12)", background: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", color: "#475569" }}>Copy Hash</button>
            </div>

            {(proof || proofError) && (
              <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 10, background: "#0f172a", color: "#e2e8f0" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#5eead4", letterSpacing: "0.06em", textTransform: "uppercase" }}>Merkle inclusion proof</div>
                    {proof && <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>leaf #{proof.leafIndex} of {proof.leafCount} · path length {proof.path.length}</div>}
                  </div>
                  {proof && (
                    <button onClick={() => onCopy(JSON.stringify(proof, null, 2), "Proof JSON")} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(148,163,184,0.3)", background: "transparent", color: "#5eead4", fontSize: 10, fontWeight: 800, cursor: "pointer" }}>Copy JSON</button>
                  )}
                </div>
                {proofError ? (
                  <div style={{ fontSize: 11, color: "#fca5a5" }}>⚠ {proofError}</div>
                ) : proof ? (
                  <pre style={{ margin: 0, fontSize: 10.5, fontFamily: "ui-monospace, Menlo, monospace", color: "#e2e8f0", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 180, overflowY: "auto" }}>
{`root:  ${proof.merkleRoot}
leaf:  ${proof.leaf}
index: ${proof.leafIndex} / ${proof.leafCount - 1}
path:${proof.path.length === 0 ? " (empty — lone leaf)" : ""}
${proof.path.map((p, i) => `  ${i}. ${p.side}  ${p.hash}`).join("\n")}`}
                  </pre>
                ) : null}
              </div>
            )}
          </div>

          {/* QR panel */}
          <div style={{ textAlign: "center" }}>
            <div style={{ padding: 8, borderRadius: 12, border: "1px solid rgba(15,23,42,0.1)", background: "#fff" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- QR is a client-generated data URL, next/image adds no benefit */}
              <img src={qrUrl} alt="Verify QR" width={184} height={184} style={{ width: "100%", height: "auto", display: "block", borderRadius: 6 }} />
            </div>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", marginTop: 8 }}>Scan to verify</div>
            <div style={{ fontSize: 10, fontFamily: "ui-monospace, Menlo, monospace", color: "#475569", marginTop: 2, wordBreak: "break-all" }}>{cert.id}</div>
          </div>
        </div>

        {/* share */}
        <div style={{ padding: "14px 22px 20px", borderTop: "1px solid rgba(15,23,42,0.06)", background: "#fafafa" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Share this certificate</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {shareLinks.map((s) => (
              <a
                key={s.name}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ padding: "8px 14px", borderRadius: 10, background: s.color, color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {s.name}
              </a>
            ))}
            <button
              onClick={() => onCopy(`<a href="${verifyUrl}"><img src="${apiUrl(`/api/pipeline/badge/${cert.id}`)}" alt="Protected by AEVION" /></a>`, "Embed snippet")}
              style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.15)", background: "#fff", color: "#0f172a", fontWeight: 800, fontSize: 12, cursor: "pointer" }}
            >
              Copy HTML badge
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
