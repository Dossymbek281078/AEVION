"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { PipelineSteps } from "@/components/PipelineSteps";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

type AuthShard = {
  index: number;
  sssShare: string;
  hmac: string;
  hmacKeyVersion: number;
  location?: string;
  createdAt?: string;
  lastVerified?: string;
};
type ShieldRecord = {
  id: string;
  objectId?: string;
  objectTitle?: string;
  algorithm: string;
  threshold: number;
  totalShards: number;
  shards: AuthShard[];
  signature?: string;
  publicKey?: string;
  hmacKeyVersion?: number;
  verifiedCount?: number;
  lastVerifiedAt?: string | null;
  legacy?: boolean;
  createdAt: string;
  status?: string;
};

const DEMO_SHARDS: AuthShard[] = [
  { index: 1, sssShare: "801demo3f2e8c4d6b9a0e1f3c5d7a9b2c4e6f8a0b2d4e6f8a1b3c5d7e9f0a2b4c6", hmac: "demo-hmac-1", hmacKeyVersion: 1, location: "Author Vault" },
  { index: 2, sssShare: "802demo4e3d9c5a7f1b3d5e7a9c1b3e5f7a9b1d3e5f7a9c1b3d5e7f9a1b3c5d7e9f", hmac: "demo-hmac-2", hmacKeyVersion: 1, location: "AEVION Platform" },
  { index: 3, sssShare: "803demo5f4e0d6b8a2c4f6e8a0c2d4f6a8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0", hmac: "demo-hmac-3", hmacKeyVersion: 1, location: "Witness Node" },
];
const DEMO_RECORDS: ShieldRecord[] = [
  { id: "qs-demo-001", objectId: "demo-1", objectTitle: "AI Music Generator v2.1", algorithm: "Shamir's Secret Sharing + Ed25519", threshold: 2, totalShards: 3, shards: DEMO_SHARDS, createdAt: "2026-03-15T10:35:00Z", status: "active" },
  { id: "qs-demo-002", objectId: "demo-2", objectTitle: "Quantum Shield Protocol Whitepaper", algorithm: "Shamir's Secret Sharing + Ed25519", threshold: 2, totalShards: 3, shards: DEMO_SHARDS, createdAt: "2026-03-10T14:25:00Z", status: "active" },
  { id: "qs-demo-003", objectId: "demo-3", objectTitle: "CyberChess AI Engine", algorithm: "Shamir's Secret Sharing + Ed25519", threshold: 2, totalShards: 3, shards: DEMO_SHARDS, createdAt: "2026-03-20T09:20:00Z", status: "active" },
  { id: "qs-demo-004", objectId: "demo-4", objectTitle: "AEVION Bank Smart Contract", algorithm: "Shamir's Secret Sharing + Ed25519", threshold: 2, totalShards: 3, shards: DEMO_SHARDS, createdAt: "2026-03-22T16:50:00Z", status: "active" },
];

type HealthInfo = {
  status: string;
  service?: string;
  algorithm?: string;
  threshold?: number;
  totalShards?: number;
  hmacKeyVersion?: number;
  shieldRecords?: number;
  timestamp?: string;
};

type Tab = "dashboard" | "detail" | "create" | "verify";

function ShieldHeaderBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    let W = canvas.width = canvas.offsetWidth * 2; let H = canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2); const w = W / 2; const h = H / 2;
    type P = { x: number; y: number; vx: number; vy: number; r: number; alpha: number; color: string };
    const pts: P[] = []; const cols = ["rgba(13,148,136,", "rgba(59,130,246,", "rgba(139,92,246,", "rgba(16,185,129,"];
    for (let i = 0; i < 50; i++) { pts.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.3, r: 1 + Math.random() * 2.5, alpha: 0.2 + Math.random() * 0.5, color: cols[Math.floor(Math.random() * cols.length)] }); }
    let frame = 0;
    const animate = () => {
      ctx.clearRect(0, 0, w, h); const t = frame * 0.008;
      const g1 = ctx.createRadialGradient(w * (0.2 + 0.1 * Math.sin(t)), h * (0.7 + 0.2 * Math.cos(t * 0.7)), 0, w * 0.3, h * 0.5, w * 0.6);
      g1.addColorStop(0, "rgba(13,148,136,0.3)"); g1.addColorStop(1, "transparent"); ctx.fillStyle = g1; ctx.fillRect(0, 0, w, h);
      const g2 = ctx.createRadialGradient(w * (0.8 + 0.1 * Math.cos(t * 0.5)), h * (0.3 + 0.15 * Math.sin(t * 0.8)), 0, w * 0.7, h * 0.4, w * 0.5);
      g2.addColorStop(0, "rgba(59,130,246,0.2)"); g2.addColorStop(1, "transparent"); ctx.fillStyle = g2; ctx.fillRect(0, 0, w, h);
      for (const p of pts) { p.x += p.vx; p.y += p.vy; if (p.x < 0) p.x = w; if (p.x > w) p.x = 0; if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
        const fl = 0.5 + 0.5 * Math.sin(frame * 0.02 + p.x * 0.01); ctx.globalAlpha = p.alpha * fl; ctx.fillStyle = p.color + "1)";
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = p.alpha * fl * 0.3; ctx.fillStyle = p.color + "0.5)"; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1; ctx.strokeStyle = "rgba(13,148,136,0.08)"; ctx.lineWidth = 0.5;
      for (let i = 0; i < pts.length; i++) { for (let j = i + 1; j < pts.length; j++) { const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < 80) { ctx.globalAlpha = (1 - d / 80) * 0.15; ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke(); } } }
      ctx.globalAlpha = 1; frame++; return requestAnimationFrame(animate);
    };
    const raf = animate(); return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />;
}

function ShardVisualizer({ shards, threshold }: { shards: AuthShard[]; threshold: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null); const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current; const container = containerRef.current; if (!canvas || !container) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1; const rect = container.getBoundingClientRect(); const W = rect.width; const H = 320;
    canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + "px"; canvas.style.height = H + "px"; ctx.scale(dpr, dpr);
    const cx = W / 2, cy = H / 2, radius = Math.min(W, H) * 0.3; let frame = 0;
    type Pt = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number };
    const particles: Pt[] = [];
    type Ring = { x: number; y: number; r: number; maxR: number; alpha: number; color: string };
    const rings: Ring[] = [];
    const cols = ["#0d9488", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444"];
    const animate = () => {
      ctx.clearRect(0, 0, W, H);
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 2);
      bg.addColorStop(0, "rgba(13,148,136,0.06)"); bg.addColorStop(0.4, "rgba(59,130,246,0.03)"); bg.addColorStop(1, "transparent");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(15,23,42,0.04)"; ctx.lineWidth = 0.5;
      for (let i = 0; i < W; i += 30) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke(); }
      for (let i = 0; i < H; i += 30) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke(); }
      ctx.strokeStyle = "rgba(13,148,136,0.08)"; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      const pulse = 1 + 0.08 * Math.sin(frame * 0.04); const cR = 22 * pulse;
      const cGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, cR * 3);
      cGlow.addColorStop(0, "rgba(13,148,136,0.25)"); cGlow.addColorStop(0.5, "rgba(13,148,136,0.08)"); cGlow.addColorStop(1, "transparent");
      ctx.fillStyle = cGlow; ctx.beginPath(); ctx.arc(cx, cy, cR * 3, 0, Math.PI * 2); ctx.fill();
      const cg = ctx.createRadialGradient(cx - 4, cy - 4, 0, cx, cy, cR);
      cg.addColorStop(0, "#14b8a6"); cg.addColorStop(0.7, "#0d9488"); cg.addColorStop(1, "#0f766e");
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, cR, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(20,184,166,0.6)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, cR, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.font = "bold 16px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("\u{1F6E1}", cx, cy);
      shards.forEach((shard, i) => {
        const bAngle = (Math.PI * 2 * i) / shards.length - Math.PI / 2;
        const angle = bAngle + frame * 0.004 + Math.sin(frame * 0.015 + i * 2) * 0.03;
        const oR = radius + Math.sin(frame * 0.02 + i) * 6;
        const sx = cx + Math.cos(angle) * oR, sy = cy + Math.sin(angle) * oR;
        const col = cols[i % cols.length]; const active = i < threshold;
        if (active) {
          const segs = 20; ctx.strokeStyle = col; ctx.lineWidth = 2;
          ctx.globalAlpha = 0.15 + 0.1 * Math.sin(frame * 0.03 + i);
          ctx.beginPath(); ctx.moveTo(cx, cy);
          for (let s = 1; s <= segs; s++) { const t = s / segs; const mx = cx + (sx - cx) * t, my = cy + (sy - cy) * t;
            const wave = Math.sin(t * Math.PI * 3 + frame * 0.08 + i) * 4;
            const nx = -(sy - cy) / oR, ny = (sx - cx) / oR; ctx.lineTo(mx + nx * wave, my + ny * wave); }
          ctx.stroke(); ctx.globalAlpha = 1;
          for (let d = 0; d < 3; d++) { const t = ((frame * 0.015 + d * 0.33 + i * 0.2) % 1);
            ctx.fillStyle = col; ctx.globalAlpha = (1 - t) * 0.8;
            ctx.beginPath(); ctx.arc(cx + (sx - cx) * t, cy + (sy - cy) * t, 2.5 - t, 0, Math.PI * 2); ctx.fill(); }
          ctx.globalAlpha = 1;
        } else { ctx.strokeStyle = "rgba(100,116,139,0.12)"; ctx.lineWidth = 1; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(sx, sy); ctx.stroke(); ctx.setLineDash([]); }
        const ng = ctx.createRadialGradient(sx, sy, 0, sx, sy, 28);
        ng.addColorStop(0, col + (active ? "44" : "15")); ng.addColorStop(1, "transparent");
        ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(sx, sy, 28, 0, Math.PI * 2); ctx.fill();
        const nR = 14; const nGrad = ctx.createRadialGradient(sx - 2, sy - 2, 0, sx, sy, nR);
        if (active) { nGrad.addColorStop(0, col); nGrad.addColorStop(1, col + "cc"); }
        else { nGrad.addColorStop(0, "rgba(148,163,184,0.6)"); nGrad.addColorStop(1, "rgba(148,163,184,0.3)"); }
        ctx.fillStyle = nGrad; ctx.beginPath(); ctx.arc(sx, sy, nR, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = active ? col : "rgba(148,163,184,0.3)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sx, sy, nR, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font = "bold 10px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("S" + shard.index, sx, sy);
        ctx.fillStyle = active ? col : "rgba(100,116,139,0.6)"; ctx.font = "bold 9px system-ui";
        const lR = oR + 24; ctx.fillText("Shard " + shard.index, cx + Math.cos(angle) * lR, cy + Math.sin(angle) * lR);
        if (active && frame % 60 === i * 20) rings.push({ x: sx, y: sy, r: nR, maxR: 40, alpha: 0.5, color: col });
        if (active && Math.random() < 0.25) particles.push({ x: sx, y: sy, vx: (cx - sx) * 0.01 + (Math.random() - 0.5) * 0.6, vy: (cy - sy) * 0.01 + (Math.random() - 0.5) * 0.6, life: 0, maxLife: 50 + Math.random() * 30, color: col, size: 1 + Math.random() * 1.5 });
      });
      for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.r += 0.6; r.alpha -= 0.5 / (r.maxR - 14);
        if (r.alpha <= 0) { rings.splice(i, 1); continue; }
        ctx.globalAlpha = r.alpha; ctx.strokeStyle = r.color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke(); }
      ctx.globalAlpha = 1;
      for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.x += p.vx; p.y += p.vy; p.life++;
        const a = 1 - p.life / p.maxLife; if (a <= 0) { particles.splice(i, 1); continue; }
        ctx.globalAlpha = a * 0.6; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(15,23,42,0.5)"; ctx.font = "bold 10px system-ui"; ctx.textAlign = "center";
      ctx.fillText("Shamir's Secret Sharing - Threshold " + threshold + " of " + shards.length, W / 2, H - 12);
      frame++; return requestAnimationFrame(animate);
    };
    const raf = animate();
    const onResize = () => { const r = container.getBoundingClientRect(); canvas.width = r.width * dpr; canvas.height = H * dpr; canvas.style.width = r.width + "px"; };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, [shards, threshold]);
  return (<div ref={containerRef} style={{ width: "100%", maxWidth: 480 }}><canvas ref={canvasRef} style={{ width: "100%", height: 320, borderRadius: 16, background: "rgba(248,250,252,0.8)", border: "1px solid rgba(15,23,42,0.06)" }} /></div>);
}

export default function QuantumShieldPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [records, setRecords] = useState<ShieldRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<ShieldRecord | null>(null);
  const [createPayload, setCreatePayload] = useState('{ "hello": "AEVION" }');
  const [createThreshold, setCreateThreshold] = useState(2);
  const [createTotalShards, setCreateTotalShards] = useState(3);
  const [creating, setCreating] = useState(false);
  const [verifyShard1, setVerifyShard1] = useState("");
  const [verifyShard2, setVerifyShard2] = useState("");
  const [verifyRecordId, setVerifyRecordId] = useState("");
  const [verifyResult, setVerifyResult] = useState("");
  const [verifying, setVerifying] = useState(false);
  const TOKEN_KEY = "aevion_auth_token_v1";
  const authHeaders = (): HeadersInit => { try { const r = localStorage.getItem(TOKEN_KEY); if (!r) return {}; return { Authorization: "Bearer " + r }; } catch { return {}; } };

  const loadRecords = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(apiUrl("/api/quantum-shield/records"), { headers: { ...authHeaders() } });
      if (!res.ok) throw new Error("API");
      const d = await res.json();
      setRecords(d.items || d.records || []);
      setIsDemo(false);
    } catch {
      setRecords(DEMO_RECORDS);
      setIsDemo(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHealth = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/quantum-shield/health"));
      if (!res.ok) throw new Error("health");
      const d = (await res.json()) as HealthInfo;
      setHealth(d);
    } catch {
      setHealth(null);
    }
  }, []);

  useEffect(() => { loadRecords(); loadHealth(); }, [loadRecords, loadHealth]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const payload = JSON.parse(createPayload);
      const res = await fetch(apiUrl("/api/quantum-shield/create"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ payload, threshold: createThreshold, totalShards: createTotalShards }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error((d as { error?: string }).error || "Error " + res.status); }
      showToast("Quantum Shield created!", "success");
      setTab("dashboard");
      await loadRecords();
    } catch (e: unknown) {
      showToast("Error: " + (e instanceof Error ? e.message : String(e)), "error");
    } finally {
      setCreating(false);
    }
  };

  /**
   * Real reconstruction: parse pasted shards as AuthenticatedShard JSON,
   * POST to /:id/reconstruct which runs Lagrange + Ed25519 probe-sign.
   * Falls back to legacy /verify only if user pasted plain hex.
   */
  const handleVerify = async () => {
    setVerifying(true); setVerifyResult("");
    try {
      const inputs = [verifyShard1.trim(), verifyShard2.trim()].filter(Boolean);
      if (inputs.length < 2) { showToast("Paste at least 2 shards", "error"); setVerifying(false); return; }

      const parsed: unknown[] = [];
      let allJson = true;
      for (const s of inputs) {
        try { parsed.push(JSON.parse(s)); } catch { allJson = false; break; }
      }

      if (allJson && verifyRecordId) {
        // Preferred: full Shamir reconstruction
        const res = await fetch(apiUrl(`/api/quantum-shield/${encodeURIComponent(verifyRecordId)}/reconstruct`), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ shards: parsed }),
        });
        const d = await res.json();
        setVerifyResult(JSON.stringify(d, null, 2));
        if (d.reconstructed) { showToast("Cryptographic recovery succeeded ✓", "success"); }
        else showToast("Recovery failed: " + (d.reason || "unknown"), "error");
      } else {
        // Legacy fallback for plain hex strings
        const res = await fetch(apiUrl("/api/quantum-shield/verify"), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ recordId: verifyRecordId || undefined, shards: inputs }),
        });
        const d = await res.json();
        setVerifyResult(JSON.stringify(d, null, 2));
        if (d.valid || d.recovered) showToast("Verification successful (legacy mode)", "success");
        else showToast("Verification failed", "error");
      }
    } catch (e: unknown) {
      setVerifyResult("Error: " + (e instanceof Error ? e.message : String(e)));
      showToast("Verification error", "error");
    } finally {
      setVerifying(false);
    }
  };

  const openDetail = (rec: ShieldRecord) => { setSelectedRecord(rec); setTab("detail"); };
  const copy = (text: string) => { navigator.clipboard.writeText(text).then(() => showToast("Copied!", "success"), () => showToast("Copy failed", "error")); };
  const downloadShard = (rec: ShieldRecord, shard: AuthShard) => {
    try {
      const blob = new Blob(
        [JSON.stringify({ shieldId: rec.id, shard, downloadedAt: new Date().toISOString() }, null, 2)],
        { type: "application/json" },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aevion-shard-${rec.id}-${shard.index}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Shard downloaded", "success");
    } catch (e: unknown) {
      showToast("Download failed: " + (e instanceof Error ? e.message : String(e)), "error");
    }
  };
  const sharePublic = (rec: ShieldRecord) => {
    try {
      const url = `${window.location.origin}/quantum-shield/${rec.id}`;
      navigator.clipboard.writeText(url);
      showToast("Public verify link copied", "success");
    } catch { showToast("Copy failed", "error"); }
  };
  const inp: React.CSSProperties = { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.15)", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" };

  const tabBtn = (t: Tab, label: string, icon: string) => (
    <button onClick={() => setTab(t)} style={{ padding: "9px 16px", borderRadius: 10, border: tab === t ? "2px solid #0f172a" : "1px solid rgba(15,23,42,0.15)", background: tab === t ? "#0f172a" : "transparent", color: tab === t ? "#fff" : "#0f172a", fontWeight: 800, fontSize: 13, cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" as const }}>
      <span style={{ fontSize: 14 }}>{icon}</span> {label}
    </button>
  );

  const badge = (status?: string) => {
    const ok = status === "active" || !status;
    return <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 10, fontWeight: 800, background: ok ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", color: ok ? "#059669" : "#ef4444", textTransform: "uppercase" as const, whiteSpace: "nowrap" as const }}>{ok ? "PROTECTED" : "EXPIRED"}</span>;
  };

  return (
    <main>
      <ProductPageShell maxWidth={960}>
        <Wave1Nav />
        <PipelineSteps current="qshield" />

        <div style={{ borderRadius: 20, overflow: "hidden", marginBottom: 20, position: "relative" }}>
          <div style={{ background: "linear-gradient(135deg, #0a0f1e 0%, #0f172a 30%, #0d2847 60%, #0c1a3a 100%)", padding: "32px 28px 26px", color: "#fff", position: "relative", overflow: "hidden", minHeight: 140 }}>
            <ShieldHeaderBg />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" as const }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, rgba(13,148,136,0.4), rgba(59,130,246,0.3))", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>&#x1F6E1;</div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0, letterSpacing: "-0.03em" }}>Quantum Shield</h1>
                  <div style={{ fontSize: 12, opacity: 0.55, marginTop: 2 }}>Post-Quantum Cryptographic Layer</div>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: health?.status === "ok" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)", color: health?.status === "ok" ? "#34d399" : "#fca5a5", border: "1px solid " + (health?.status === "ok" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"), letterSpacing: "0.05em" }}>
                    {health?.status === "ok" ? "● ONLINE" : "○ OFFLINE"}
                  </span>
                  {health?.shieldRecords !== undefined && <span style={{ padding: "4px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }}>{health.shieldRecords} records</span>}
                </div>
              </div>
              <p style={{ margin: "0 0 12px", fontSize: 14, opacity: 0.82, lineHeight: 1.6, maxWidth: 600 }}>
                Ed25519 with the private key Shamir-split across three independent locations &#8212; any 2 of 3 reconstruct it, no single party (including AEVION) ever holds enough to forge.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
                {["Ed25519 + SSS", "Threshold " + (health?.threshold ?? 2) + "/" + (health?.totalShards ?? 3), "Auto via QSign", "HMAC v" + (health?.hmacKeyVersion ?? 1)].map((tag) => (
                  <span key={tag} style={{ padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}>{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {isDemo && (
          <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, border: "1px dashed rgba(245,158,11,0.4)", background: "rgba(245,158,11,0.08)", fontSize: 12, color: "#92400e", display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 14 }}>&#x26A0;&#xFE0F;</span>
            <div>
              <b>Demo data</b> — backend unreachable. Records below are placeholders. Sign in or check API connection to see live shields.
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginBottom: 20 }}>
          <Link href="/qright" style={{ padding: "7px 14px", borderRadius: 8, textDecoration: "none", fontWeight: 700, fontSize: 13, border: "1px solid rgba(15,23,42,0.15)", color: "#0f172a" }}>&#8592; QRight</Link>
          <Link href="/qsign" style={{ padding: "7px 14px", borderRadius: 8, textDecoration: "none", fontWeight: 700, fontSize: 13, border: "1px solid rgba(15,23,42,0.15)", color: "#0f172a" }}>QSign v1</Link>
          <Link href="/qsign/v2" style={{ padding: "7px 14px", borderRadius: 8, textDecoration: "none", fontWeight: 700, fontSize: 13, border: "1px solid rgba(13,148,136,0.4)", color: "#0d9488" }}>QSign v2</Link>
          <Link href="/bureau" style={{ padding: "7px 14px", borderRadius: 8, textDecoration: "none", fontWeight: 700, fontSize: 13, border: "1px solid rgba(15,23,42,0.15)", color: "#0f172a" }}>IP Bureau &#8594;</Link>
          <Link href="/planet" style={{ padding: "7px 14px", borderRadius: 8, textDecoration: "none", fontWeight: 700, fontSize: 13, border: "1px solid #0f766e", color: "#0f766e" }}>Planet</Link>
        </div>

        <div className="aevion-nav-pills" style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginBottom: 24 }}>
          {tabBtn("dashboard", "Dashboard (" + records.length + ")", "\uD83D\uDCCA")}
          {tabBtn("detail", "Shard Viewer", "\uD83D\uDD0D")}
          {tabBtn("create", "Create Shield", "\u2795")}
          {tabBtn("verify", "Verify / Recover", "\uD83D\uDD11")}
        </div>

        {tab === "dashboard" && (<div>
          <div className="aevion-hero-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
            {[{ label: "Total Shields", value: records.length, color: "#0d9488" }, { label: "Active", value: records.filter((r) => r.status === "active" || !r.status).length, color: "#059669" }, { label: "Avg Threshold", value: records.length ? Math.round(records.reduce((a, r) => a + r.threshold, 0) / records.length * 10) / 10 : 0, color: "#3b82f6" }, { label: "Total Shards", value: records.reduce((a, r) => a + r.totalShards, 0), color: "#8b5cf6" }].map((s) => (
              <div key={s.label} style={{ padding: "16px 14px", borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", textAlign: "center" as const, boxShadow: "0 2px 8px rgba(15,23,42,0.03)" }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginTop: 4 }}>{s.label}</div>
              </div>))}
          </div>
          {loading ? <div style={{ textAlign: "center" as const, padding: 40, color: "#94a3b8" }}>Loading...</div> : records.length === 0 ? (
            <div style={{ textAlign: "center" as const, padding: 40 }}><div style={{ fontSize: 48, marginBottom: 12 }}>&#x1F6E1;</div><div style={{ fontWeight: 700, fontSize: 16, color: "#334155", marginBottom: 6 }}>No Shield records yet</div><button onClick={() => setTab("create")} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#0f172a", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>Create Shield</button></div>
          ) : (<div style={{ display: "grid", gap: 12 }}>
            {records.map((rec) => (
              <div key={rec.id} onClick={() => openDetail(rec)} style={{ border: "1px solid rgba(15,23,42,0.1)", borderRadius: 14, padding: 16, background: "#fff", boxShadow: "0 2px 8px rgba(15,23,42,0.04)", cursor: "pointer", transition: "all 0.2s" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(13,148,136,0.12)"; (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(13,148,136,0.3)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 8px rgba(15,23,42,0.04)"; (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(15,23,42,0.1)"; }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" as const }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" as const }}>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>{new Date(rec.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      {badge(rec.status)}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a", wordBreak: "break-word" as const }}>{rec.objectTitle || ("Shield " + rec.id.slice(0, 12))}</div>
                  </div>
                  <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
                    {Array.from({ length: rec.totalShards }).map((_, i) => (<div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: i < rec.threshold ? "#0d9488" : "rgba(15,23,42,0.1)", border: "2px solid " + (i < rec.threshold ? "#0d9488" : "rgba(15,23,42,0.15)") }} />))}
                  </div>
                </div>
                <div style={{ marginTop: 8, display: "flex", gap: 16, fontSize: 12, color: "#64748b", flexWrap: "wrap" as const }}>
                  <span>Algorithm: <b style={{ color: "#334155" }}>{rec.algorithm}</b></span>
                  <span>Threshold: <b style={{ color: "#0d9488" }}>{rec.threshold}/{rec.totalShards}</b></span>
                </div>
                <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 8, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.06)" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 2 }}>RECORD ID</div>
                  <div style={{ fontSize: 11, fontFamily: "monospace", color: "#334155", wordBreak: "break-all" as const }}>{rec.id}</div>
                </div>
              </div>))}
          </div>)}
        </div>)}

        {tab === "detail" && (<div>
          {selectedRecord ? (<div>
            <button onClick={() => { setSelectedRecord(null); setTab("dashboard"); }} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", background: "transparent", color: "#0f172a", fontWeight: 700, fontSize: 12, cursor: "pointer", marginBottom: 16 }}>&#8592; Back</button>
            <div style={{ borderRadius: 16, border: "1px solid rgba(15,23,42,0.1)", padding: 20, background: "#fff", marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap" as const, gap: 12 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 900, margin: "0 0 6px", color: "#0f172a" }}>{selectedRecord.objectTitle || ("Shield " + selectedRecord.id.slice(0, 12))}</h2>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Created: {new Date(selectedRecord.createdAt).toLocaleString("en-US")}</div>
                </div>
                {badge(selectedRecord.status)}
              </div>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                <ShardVisualizer shards={selectedRecord.shards} threshold={selectedRecord.threshold} />
              </div>
              <div className="aevion-form-grid" style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr 1fr", marginBottom: 20 }}>
                {[{ label: "Algorithm", value: selectedRecord.algorithm }, { label: "Threshold", value: selectedRecord.threshold + " of " + selectedRecord.totalShards }, { label: "Record ID", value: selectedRecord.id }].map((item) => (
                  <div key={item.label} style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.08)", background: "#f8fafc" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", fontFamily: "monospace", wordBreak: "break-all" as const }}>{item.value}</div>
                  </div>))}
              </div>
              <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 12 }}>Shards ({selectedRecord.shards.length})</div>
              <div style={{ display: "grid", gap: 10 }}>
                {selectedRecord.shards.map((shard) => (
                  <div key={shard.index} style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid " + (shard.index <= selectedRecord.threshold ? "rgba(13,148,136,0.25)" : "rgba(15,23,42,0.1)"), background: shard.index <= selectedRecord.threshold ? "rgba(13,148,136,0.04)" : "#fff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap" as const, gap: 8 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: shard.index <= selectedRecord.threshold ? "#0d9488" : "rgba(15,23,42,0.08)", color: shard.index <= selectedRecord.threshold ? "#fff" : "#64748b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900 }}>{shard.index}</div>
                        <span style={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>Shard #{shard.index}</span>
                        {shard.index <= selectedRecord.threshold && <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 9, fontWeight: 800, background: "rgba(13,148,136,0.15)", color: "#0d9488" }}>THRESHOLD</span>}
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={(e) => { e.stopPropagation(); copy(JSON.stringify(shard)); }} style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", background: "transparent", fontSize: 11, fontWeight: 700, cursor: "pointer", color: "#334155" }}>Copy JSON</button>
                        <button onClick={(e) => { e.stopPropagation(); downloadShard(selectedRecord, shard); }} style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid rgba(13,148,136,0.3)", background: "rgba(13,148,136,0.05)", fontSize: 11, fontWeight: 700, cursor: "pointer", color: "#0d9488" }}>Download</button>
                      </div>
                    </div>
                    {shard.location && <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>Storage: <b>{shard.location}</b></div>}
                    <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(15,23,42,0.03)", fontSize: 11, fontFamily: "monospace", color: "#475569", wordBreak: "break-all" as const, lineHeight: 1.5 }}>{shard.sssShare}</div>
                    <div style={{ marginTop: 4, fontSize: 9, color: "#94a3b8", fontFamily: "monospace" }}>HMAC v{shard.hmacKeyVersion}: {shard.hmac.slice(0, 16)}...</div>
                  </div>))}
              </div>
              <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" as const }}>
                <button onClick={() => { setVerifyRecordId(selectedRecord.id); setTab("verify"); }} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#0d9488", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>Verify / Recover &#8594;</button>
                <button onClick={() => sharePublic(selectedRecord)} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid rgba(13,148,136,0.4)", background: "rgba(13,148,136,0.05)", color: "#0d9488", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>Share Public Link</button>
                <Link href={`/quantum-shield/${selectedRecord.id}`} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.15)", background: "transparent", color: "#0f172a", fontWeight: 800, fontSize: 13, cursor: "pointer", textDecoration: "none" }}>Open Public Page &#8599;</Link>
                <button onClick={() => copy(JSON.stringify(selectedRecord, null, 2))} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.15)", background: "transparent", color: "#0f172a", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>Export JSON</button>
              </div>
            </div>
          </div>) : (
            <div style={{ textAlign: "center" as const, padding: 40, color: "#94a3b8" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>&#x1F50D;</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#334155", marginBottom: 6 }}>Select a Shield record</div>
              <button onClick={() => setTab("dashboard")} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#0f172a", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>Go to Dashboard</button>
            </div>)}
        </div>)}

        {tab === "create" && (<div style={{ display: "grid", gap: 20, gridTemplateColumns: "1fr 1fr" }} className="aevion-form-grid">
          <div style={{ border: "1px solid rgba(15,23,42,0.1)", borderRadius: 16, padding: 20 }}>
            <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 16 }}>Create New Quantum Shield</div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Payload (JSON)</div>
              <textarea value={createPayload} onChange={(e) => setCreatePayload(e.target.value)} rows={6} style={{ ...inp, fontFamily: "monospace", fontSize: 12 }} />
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Any JSON &#8212; signed with Ed25519 and split via SSS.</div>
            </div>
            <div className="aevion-form-grid" style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr", marginBottom: 14 }}>
              <div><div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Threshold</div><select value={createThreshold} onChange={(e) => setCreateThreshold(Number(e.target.value))} style={inp}><option value={2}>2 (recommended)</option><option value={3}>3</option></select></div>
              <div><div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Total Shards</div><select value={createTotalShards} onChange={(e) => setCreateTotalShards(Number(e.target.value))} style={inp}><option value={3}>3 (recommended)</option><option value={5}>5</option><option value={7}>7</option></select></div>
            </div>
            <button onClick={handleCreate} disabled={creating} style={{ padding: "12px 24px", borderRadius: 12, border: "none", width: "100%", background: creating ? "#94a3b8" : "linear-gradient(135deg, #0d9488, #0ea5e9)", color: "#fff", fontWeight: 900, fontSize: 15, cursor: creating ? "default" : "pointer", boxShadow: creating ? "none" : "0 4px 14px rgba(13,148,136,0.35)" }}>{creating ? "Creating..." : "Create Quantum Shield"}</button>
          </div>
          <div style={{ border: "1px solid rgba(15,23,42,0.08)", borderRadius: 16, padding: 20, background: "rgba(15,23,42,0.02)" }}>
            <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 14 }}>How it works</div>
            <div style={{ display: "grid", gap: 14 }}>
              {[{ s: "1", t: "Ed25519 Signing", d: "Payload signed with asymmetric key pair." }, { s: "2", t: "Secret Splitting", d: "Private key split into N shards via Shamir polynomial." }, { s: "3", t: "Threshold Recovery", d: "Any K shards reconstruct the key." }, { s: "4", t: "Distribution", d: "Shards stored on different devices or locations." }].map((item) => (
                <div key={item.s} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, #0d9488, #3b82f6)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900 }}>{item.s}</div>
                  <div><div style={{ fontWeight: 800, fontSize: 13, color: "#0f172a", marginBottom: 2 }}>{item.t}</div><div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>{item.d}</div></div>
                </div>))}
            </div>
            <div style={{ marginTop: 18, padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(13,148,136,0.2)", background: "rgba(13,148,136,0.05)", fontSize: 12, color: "#0f766e", lineHeight: 1.5 }}><b>Note:</b> Shield records auto-create when signing in QSign.</div>
          </div>
        </div>)}

        {tab === "verify" && (<div style={{ display: "grid", gap: 20, gridTemplateColumns: "1fr 1fr" }} className="aevion-form-grid">
          <div style={{ border: "1px solid rgba(15,23,42,0.1)", borderRadius: 16, padding: 20 }}>
            <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 16 }}>Verify and Recover from Shards</div>
            <div style={{ marginBottom: 14 }}><div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Record ID (optional)</div><input value={verifyRecordId} onChange={(e) => setVerifyRecordId(e.target.value)} placeholder="qs-xxxx" style={inp} /></div>
            <div style={{ marginBottom: 14 }}><div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Shard #1 (paste full JSON)</div><textarea value={verifyShard1} onChange={(e) => setVerifyShard1(e.target.value)} rows={3} placeholder='{"index":1,"sssShare":"...","hmac":"...","hmacKeyVersion":1}' style={{ ...inp, fontFamily: "monospace", fontSize: 11 }} /></div>
            <div style={{ marginBottom: 14 }}><div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Shard #2 (paste full JSON)</div><textarea value={verifyShard2} onChange={(e) => setVerifyShard2(e.target.value)} rows={3} placeholder='{"index":2,"sssShare":"...","hmac":"...","hmacKeyVersion":1}' style={{ ...inp, fontFamily: "monospace", fontSize: 11 }} /></div>
            <div style={{ marginBottom: 14, fontSize: 11, color: "#64748b", padding: "8px 10px", borderRadius: 8, background: "rgba(13,148,136,0.06)", border: "1px solid rgba(13,148,136,0.15)" }}>Tip: Paste full <b>AuthenticatedShard</b> JSON objects (with <code>sssShare</code>, <code>hmac</code>, <code>hmacKeyVersion</code>) to run real Lagrange reconstruction.</div>
            <button onClick={handleVerify} disabled={verifying} style={{ padding: "12px 24px", borderRadius: 12, border: "none", width: "100%", background: verifying ? "#94a3b8" : "#0d9488", color: "#fff", fontWeight: 900, fontSize: 15, cursor: verifying ? "default" : "pointer" }}>{verifying ? "Verifying..." : "Verify and Recover"}</button>
            {verifyResult && <div style={{ marginTop: 16, border: "1px solid rgba(15,23,42,0.1)", borderRadius: 12, padding: 14 }}><div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>Result</div><pre style={{ background: "#f8fafc", padding: 12, borderRadius: 8, fontSize: 11, whiteSpace: "pre-wrap" as const, fontFamily: "monospace", color: "#334155", margin: 0 }}>{verifyResult}</pre></div>}
          </div>
          <div style={{ border: "1px solid rgba(15,23,42,0.08)", borderRadius: 16, padding: 20, background: "rgba(15,23,42,0.02)" }}>
            <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 14 }}>Recovery Process</div>
            <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.7, marginBottom: 16 }}>Provide at least <b>threshold</b> shards. Lagrange interpolation reconstructs the secret.</div>
            <div style={{ display: "grid", gap: 12 }}>
              {[{ icon: "\u2705", t: "2+ shards = full recovery", d: "Key reconstructed, signature confirmed." }, { icon: "\u274C", t: "1 shard = impossible", d: "Single shard reveals zero info." }, { icon: "\uD83D\uDD12", t: "Wrong shards = detection", d: "Corrupted shards produce non-matching key." }].map((item) => (
                <div key={item.t} style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}><span>{item.icon}</span><span style={{ fontWeight: 800, fontSize: 13, color: "#0f172a" }}>{item.t}</span></div>
                  <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>{item.d}</div>
                </div>))}
            </div>
            {records.length > 0 && <div style={{ marginTop: 16 }}><div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 8 }}>Quick fill:</div><div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
              {records.slice(0, 4).map((rec) => (<button key={rec.id} onClick={() => { setVerifyRecordId(rec.id); if (rec.shards[0]) setVerifyShard1(JSON.stringify(rec.shards[0])); if (rec.shards[1]) setVerifyShard2(JSON.stringify(rec.shards[1])); }} style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", background: "transparent", fontSize: 11, fontWeight: 700, cursor: "pointer", color: "#0d9488" }}>{(rec.objectTitle || rec.id).slice(0, 20)}</button>))}
            </div></div>}
          </div>
        </div>)}

        <div style={{ marginTop: 28, border: "1px solid rgba(15,23,42,0.08)", borderRadius: 14, padding: 16, background: "rgba(15,23,42,0.02)" }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>About Quantum Shield</div>
          <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.7 }}>
            AEVION's cryptographic layer combining Ed25519 signatures with Shamir's Secret Sharing.
            Auto-created via QSign. Pipeline: QRight &#8594; QSign &#8594; Quantum Shield &#8594; Bureau &#8594; Planet.
          </div>
        </div>
      </ProductPageShell>
    </main>
  );
}