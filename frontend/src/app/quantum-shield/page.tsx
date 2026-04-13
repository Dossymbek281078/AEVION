"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

type ShardInfo = { index: number; id?: string; data?: string; shard?: string; location?: string; status?: string };
type ShieldRecord = { id: string; objectId?: string; objectTitle?: string; algorithm: string; threshold: number; totalShards: number; shards: ShardInfo[]; signature?: string; publicKey?: string; createdAt: string; status?: string };

type Tab = "dashboard" | "detail" | "howItWorks";

/* ── Animated header background ── */
function ShieldHeaderBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const W = canvas.width = canvas.offsetWidth * 2; const H = canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2); const w = W / 2; const h = H / 2;
    type P = { x: number; y: number; vx: number; vy: number; r: number; alpha: number; color: string };
    const pts: P[] = []; const cols = ["rgba(13,148,136,", "rgba(59,130,246,", "rgba(139,92,246,", "rgba(16,185,129,"];
    for (let i = 0; i < 50; i++) pts.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.3, r: 1 + Math.random() * 2.5, alpha: 0.2 + Math.random() * 0.5, color: cols[Math.floor(Math.random() * cols.length)] });
    let frame = 0;
    const animate = () => {
      ctx.clearRect(0, 0, w, h); const t = frame * 0.008;
      const g1 = ctx.createRadialGradient(w * (0.2 + 0.1 * Math.sin(t)), h * (0.7 + 0.2 * Math.cos(t * 0.7)), 0, w * 0.3, h * 0.5, w * 0.6);
      g1.addColorStop(0, "rgba(13,148,136,0.3)"); g1.addColorStop(1, "transparent"); ctx.fillStyle = g1; ctx.fillRect(0, 0, w, h);
      const g2 = ctx.createRadialGradient(w * (0.8 + 0.1 * Math.cos(t * 0.5)), h * (0.3 + 0.15 * Math.sin(t * 0.8)), 0, w * 0.7, h * 0.4, w * 0.5);
      g2.addColorStop(0, "rgba(59,130,246,0.2)"); g2.addColorStop(1, "transparent"); ctx.fillStyle = g2; ctx.fillRect(0, 0, w, h);
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy; if (p.x < 0) p.x = w; if (p.x > w) p.x = 0; if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
        const fl = 0.5 + 0.5 * Math.sin(frame * 0.02 + p.x * 0.01); ctx.globalAlpha = p.alpha * fl;
        ctx.fillStyle = p.color + "1)"; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = p.alpha * fl * 0.3; ctx.fillStyle = p.color + "0.5)"; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.strokeStyle = "rgba(13,148,136,0.08)"; ctx.lineWidth = 0.5;
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < 80) { ctx.globalAlpha = (1 - d / 80) * 0.15; ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke(); }
      }
      ctx.globalAlpha = 1; frame++; return requestAnimationFrame(animate);
    };
    const raf = animate(); return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />;
}

/* ── Shard visualizer (animated canvas) ── */
function ShardVisualizer({ shards, threshold }: { shards: ShardInfo[]; threshold: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current; const container = containerRef.current; if (!canvas || !container) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1; const rect = container.getBoundingClientRect(); const W = rect.width; const H = 280;
    canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + "px"; canvas.style.height = H + "px"; ctx.scale(dpr, dpr);
    const cx = W / 2, cy = H / 2, radius = Math.min(W, H) * 0.28; let frame = 0;
    const cols = ["#0d9488", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444"];
    const animate = () => {
      ctx.clearRect(0, 0, W, H);
      // Background glow
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 2);
      bg.addColorStop(0, "rgba(13,148,136,0.06)"); bg.addColorStop(1, "transparent");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      // Grid
      ctx.strokeStyle = "rgba(15,23,42,0.04)"; ctx.lineWidth = 0.5;
      for (let i = 0; i < W; i += 30) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke(); }
      for (let i = 0; i < H; i += 30) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke(); }
      // Center orbit
      ctx.strokeStyle = "rgba(13,148,136,0.08)"; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      // Center node
      const pulse = 1 + 0.08 * Math.sin(frame * 0.04); const cR = 20 * pulse;
      const cg = ctx.createRadialGradient(cx - 3, cy - 3, 0, cx, cy, cR);
      cg.addColorStop(0, "#14b8a6"); cg.addColorStop(1, "#0f766e");
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, cR, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(20,184,166,0.5)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, cR, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.font = "bold 14px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("\u{1F6E1}", cx, cy);
      // Shard nodes
      shards.forEach((shard, i) => {
        const angle = (Math.PI * 2 * i) / shards.length - Math.PI / 2 + frame * 0.003;
        const oR = radius + Math.sin(frame * 0.02 + i) * 4;
        const sx = cx + Math.cos(angle) * oR, sy = cy + Math.sin(angle) * oR;
        const col = cols[i % cols.length]; const active = i < threshold;
        // Connection line
        if (active) {
          ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.globalAlpha = 0.2 + 0.1 * Math.sin(frame * 0.03 + i);
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(sx, sy); ctx.stroke(); ctx.globalAlpha = 1;
        } else {
          ctx.strokeStyle = "rgba(100,116,139,0.12)"; ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(sx, sy); ctx.stroke(); ctx.setLineDash([]);
        }
        // Node
        const nR = 12;
        const nGrad = ctx.createRadialGradient(sx - 2, sy - 2, 0, sx, sy, nR);
        if (active) { nGrad.addColorStop(0, col); nGrad.addColorStop(1, col + "cc"); }
        else { nGrad.addColorStop(0, "rgba(148,163,184,0.5)"); nGrad.addColorStop(1, "rgba(148,163,184,0.2)"); }
        ctx.fillStyle = nGrad; ctx.beginPath(); ctx.arc(sx, sy, nR, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = active ? col : "rgba(148,163,184,0.3)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sx, sy, nR, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font = "bold 9px system-ui";
        ctx.fillText("S" + shard.index, sx, sy);
        // Label
        ctx.fillStyle = active ? col : "rgba(100,116,139,0.5)"; ctx.font = "bold 9px system-ui";
        const lR = oR + 22; ctx.fillText("Shard " + shard.index, cx + Math.cos(angle) * lR, cy + Math.sin(angle) * lR);
      });
      ctx.fillStyle = "rgba(15,23,42,0.4)"; ctx.font = "bold 10px system-ui"; ctx.textAlign = "center";
      ctx.fillText("Shamir's Secret Sharing — Threshold " + threshold + " of " + shards.length, W / 2, H - 10);
      frame++; return requestAnimationFrame(animate);
    };
    const raf = animate();
    const onResize = () => { const r = container.getBoundingClientRect(); canvas.width = r.width * dpr; canvas.height = H * dpr; canvas.style.width = r.width + "px"; };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, [shards, threshold]);
  return (<div ref={containerRef} style={{ width: "100%", maxWidth: 480 }}><canvas ref={canvasRef} style={{ width: "100%", height: 280, borderRadius: 16, background: "rgba(248,250,252,0.8)", border: "1px solid rgba(15,23,42,0.06)" }} /></div>);
}

export default function QuantumShieldPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [records, setRecords] = useState<ShieldRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<ShieldRecord | null>(null);

  const loadRecords = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(apiUrl("/api/quantum-shield/records"));
      if (!res.ok) throw new Error("API");
      const d = await res.json();
      setRecords(d.items || d.records || []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const openDetail = (rec: ShieldRecord) => { setSelectedRecord(rec); setTab("detail"); };
  const copy = (text: string, label?: string) => {
    navigator.clipboard.writeText(text).then(
      () => showToast((label || "Value") + " copied!", "success"),
      () => showToast("Copy failed", "error")
    );
  };

  const badge = (status?: string) => {
    const ok = status === "active" || !status;
    return <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 10, fontWeight: 800, background: ok ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", color: ok ? "#059669" : "#ef4444", textTransform: "uppercase" as const }}>{ok ? "ACTIVE" : "EXPIRED"}</span>;
  };

  return (
    <main>
      <ProductPageShell maxWidth={960}>
        <Wave1Nav />

        {/* ── Animated Header ── */}
        <div style={{ borderRadius: 20, overflow: "hidden", marginBottom: 24, position: "relative" }}>
          <div style={{ background: "linear-gradient(135deg, #0a0f1e 0%, #0f172a 30%, #0d2847 60%, #0c1a3a 100%)", padding: "32px 28px 26px", color: "#fff", position: "relative", overflow: "hidden", minHeight: 140 }}>
            <ShieldHeaderBg />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, rgba(13,148,136,0.4), rgba(59,130,246,0.3))", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🛡️</div>
                <div>
                  <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0, letterSpacing: "-0.03em" }}>Quantum Shield</h1>
                  <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>Post-Quantum Cryptographic Protection Layer</div>
                </div>
              </div>
              <p style={{ margin: "0 0 14px", fontSize: 14, opacity: 0.82, lineHeight: 1.6, maxWidth: 600 }}>
                Military-grade protection using Ed25519 digital signatures and Shamir&apos;s Secret Sharing. Your key is split into shards — any threshold can reconstruct, but no single shard reveals anything.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["Ed25519 + SSS", "Threshold 2/3", "Auto via Pipeline"].map((tag) => (
                  <span key={tag} style={{ padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}>{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Navigation ── */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          <Link href="/qright" style={{ padding: "8px 16px", borderRadius: 8, background: "linear-gradient(135deg, #0d9488, #06b6d4)", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 13 }}>🛡️ Protect New Work</Link>
          <Link href="/qsign" style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", color: "#0f172a", textDecoration: "none", fontWeight: 700, fontSize: 13 }}>QSign</Link>
          <Link href="/bureau" style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", color: "#0f172a", textDecoration: "none", fontWeight: 700, fontSize: 13 }}>IP Bureau</Link>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          {([
            { t: "dashboard" as Tab, label: `Dashboard (${records.length})`, icon: "📊" },
            { t: "detail" as Tab, label: "Shard Viewer", icon: "🔍" },
            { t: "howItWorks" as Tab, label: "How It Works", icon: "📖" },
          ]).map((item) => (
            <button key={item.t} onClick={() => setTab(item.t)} style={{
              padding: "9px 16px", borderRadius: 10,
              border: tab === item.t ? "2px solid #0f172a" : "1px solid rgba(15,23,42,0.15)",
              background: tab === item.t ? "#0f172a" : "transparent",
              color: tab === item.t ? "#fff" : "#0f172a",
              fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            }}>
              <span>{item.icon}</span> {item.label}
            </button>
          ))}
        </div>

        {/* ── Stats ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Total Shields", value: records.length, color: "#0d9488" },
            { label: "Active", value: records.filter((r) => r.status === "active" || !r.status).length, color: "#059669" },
            { label: "Avg Threshold", value: records.length ? Math.round(records.reduce((a, r) => a + r.threshold, 0) / records.length * 10) / 10 : 0, color: "#3b82f6" },
            { label: "Total Shards", value: records.reduce((a, r) => a + r.totalShards, 0), color: "#8b5cf6" },
          ].map((s) => (
            <div key={s.label} style={{ padding: "16px 14px", borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ══ DASHBOARD TAB ══ */}
        {tab === "dashboard" && (
          <div>
            {loading ? (
              <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Loading shields...</div>
            ) : records.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px", borderRadius: 16, border: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🛡️</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a", marginBottom: 6 }}>No Shield records yet</div>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>Protect your first work — Quantum Shield is created automatically</div>
                <Link href="/qright" style={{ display: "inline-block", padding: "12px 24px", borderRadius: 12, background: "linear-gradient(135deg, #0d9488, #06b6d4)", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: 14 }}>🛡️ Protect Your Work</Link>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {records.map((rec) => (
                  <div key={rec.id} onClick={() => openDetail(rec)} style={{
                    border: "1px solid rgba(15,23,42,0.1)", borderRadius: 14, padding: 16, background: "#fff",
                    boxShadow: "0 2px 8px rgba(15,23,42,0.04)", cursor: "pointer", transition: "all 0.2s",
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(13,148,136,0.12)"; e.currentTarget.style.borderColor = "rgba(13,148,136,0.3)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(15,23,42,0.04)"; e.currentTarget.style.borderColor = "rgba(15,23,42,0.1)"; }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                          <span style={{ fontSize: 11, color: "#94a3b8" }}>{new Date(rec.createdAt).toLocaleDateString()}</span>
                          {badge(rec.status)}
                        </div>
                        <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a", wordBreak: "break-word" as const }}>{rec.objectTitle || ("Shield " + rec.id.slice(0, 12))}</div>
                      </div>
                      <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
                        {Array.from({ length: rec.totalShards }).map((_, i) => (
                          <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: i < rec.threshold ? "#0d9488" : "rgba(15,23,42,0.1)", border: "2px solid " + (i < rec.threshold ? "#0d9488" : "rgba(15,23,42,0.15)") }} />
                        ))}
                      </div>
                    </div>
                    <div style={{ marginTop: 8, display: "flex", gap: 16, fontSize: 12, color: "#64748b", flexWrap: "wrap" }}>
                      <span>Algorithm: <b style={{ color: "#334155" }}>{rec.algorithm}</b></span>
                      <span>Threshold: <b style={{ color: "#0d9488" }}>{rec.threshold}/{rec.totalShards}</b></span>
                    </div>
                    <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 8, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.06)" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 2 }}>SHIELD ID</div>
                      <div style={{ fontSize: 11, fontFamily: "monospace", color: "#334155", wordBreak: "break-all" as const }}>{rec.id}</div>
                    </div>
                    <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
                      <Link href="/bureau" style={{ padding: "6px 12px", borderRadius: 8, background: "#0d9488", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 11 }}>View in Bureau</Link>
                      <Link href="/qright" style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", color: "#0f172a", textDecoration: "none", fontWeight: 700, fontSize: 11 }}>Protect New Work</Link>
                      <button onClick={() => copy(rec.id, "Shield ID")} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", background: "#fff", fontWeight: 700, fontSize: 11, cursor: "pointer", color: "#475569" }}>Copy ID</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ DETAIL TAB ══ */}
        {tab === "detail" && (
          <div>
            {selectedRecord ? (
              <div>
                <button onClick={() => { setSelectedRecord(null); setTab("dashboard"); }} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", background: "transparent", color: "#0f172a", fontWeight: 700, fontSize: 12, cursor: "pointer", marginBottom: 16 }}>← Back</button>
                <div style={{ borderRadius: 16, border: "1px solid rgba(15,23,42,0.1)", padding: 20, background: "#fff", marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <h2 style={{ fontSize: 20, fontWeight: 900, margin: "0 0 6px", color: "#0f172a" }}>{selectedRecord.objectTitle || ("Shield " + selectedRecord.id.slice(0, 12))}</h2>
                      <div style={{ fontSize: 12, color: "#64748b" }}>Created: {new Date(selectedRecord.createdAt).toLocaleString()}</div>
                    </div>
                    {badge(selectedRecord.status)}
                  </div>
                  {/* Shard visualizer */}
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                    <ShardVisualizer shards={selectedRecord.shards} threshold={selectedRecord.threshold} />
                  </div>
                  {/* Info grid */}
                  <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr 1fr", marginBottom: 20 }}>
                    {[
                      { label: "Algorithm", value: selectedRecord.algorithm },
                      { label: "Threshold", value: selectedRecord.threshold + " of " + selectedRecord.totalShards },
                      { label: "Shield ID", value: selectedRecord.id },
                    ].map((item) => (
                      <div key={item.label} style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.08)", background: "#f8fafc" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>{item.label}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", fontFamily: "monospace", wordBreak: "break-all" as const }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                  {/* Shards list */}
                  <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 12 }}>Shards ({selectedRecord.shards.length})</div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {selectedRecord.shards.map((shard) => {
                      const shardValue = shard.data || shard.shard || "";
                      return (
                        <div key={shard.index} style={{
                          padding: "14px 16px", borderRadius: 12,
                          border: "1px solid " + (shard.index <= selectedRecord.threshold ? "rgba(13,148,136,0.25)" : "rgba(15,23,42,0.1)"),
                          background: shard.index <= selectedRecord.threshold ? "rgba(13,148,136,0.04)" : "#fff",
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8, flexWrap: "wrap" }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <div style={{ width: 28, height: 28, borderRadius: "50%", background: shard.index <= selectedRecord.threshold ? "#0d9488" : "rgba(15,23,42,0.08)", color: shard.index <= selectedRecord.threshold ? "#fff" : "#64748b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900 }}>{shard.index}</div>
                              <span style={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>Shard #{shard.index}</span>
                              {shard.index <= selectedRecord.threshold && <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 9, fontWeight: 800, background: "rgba(13,148,136,0.15)", color: "#0d9488" }}>THRESHOLD</span>}
                              {shard.location && <span style={{ fontSize: 10, color: "#64748b" }}>📍 {shard.location}</span>}
                            </div>
                            <button onClick={() => copy(shardValue, "Shard")} style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", background: "transparent", fontSize: 11, fontWeight: 700, cursor: "pointer", color: "#334155" }}>Copy</button>
                          </div>
                          <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(15,23,42,0.03)", fontSize: 11, fontFamily: "monospace", color: "#475569", wordBreak: "break-all" as const, lineHeight: 1.5 }}>{shardValue}</div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Actions */}
                  <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Link href="/bureau" style={{ padding: "10px 20px", borderRadius: 10, background: "#0d9488", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: 13 }}>View in Bureau</Link>
                    <button onClick={() => copy(JSON.stringify(selectedRecord, null, 2), "Shield JSON")} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.15)", background: "transparent", color: "#0f172a", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>Export JSON</button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#334155", marginBottom: 6 }}>Select a Shield record from Dashboard</div>
                <button onClick={() => setTab("dashboard")} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#0f172a", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>Go to Dashboard</button>
              </div>
            )}
          </div>
        )}

        {/* ══ HOW IT WORKS TAB ══ */}
        {tab === "howItWorks" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
              {[
                { icon: "🔑", title: "Ed25519 Digital Signature", desc: "Your data is signed with an Ed25519 asymmetric key pair. The private key proves authorship; the public key allows anyone to verify the signature." },
                { icon: "✂️", title: "Shamir's Secret Splitting", desc: "The private key is split into N shards using Shamir's polynomial. No single shard contains useful information — you need at least K (threshold) shards to reconstruct." },
                { icon: "🔄", title: "Threshold Recovery", desc: "Any K-of-N shards can reconstruct the original key using Lagrange interpolation. This means even if some shards are lost, the key can still be recovered." },
                { icon: "🌍", title: "Distributed Storage", desc: "Shards are stored in different locations: Author Vault, AEVION Platform, and Witness Nodes. This ensures no single point of failure." },
              ].map((item) => (
                <div key={item.title} style={{ padding: "18px 20px", borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 24 }}>{item.icon}</span>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>{item.title}</div>
                  </div>
                  <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{item.desc}</div>
                </div>
              ))}
            </div>

            <div style={{ padding: "16px 18px", borderRadius: 14, background: "rgba(13,148,136,0.05)", border: "1px solid rgba(13,148,136,0.15)", marginBottom: 24 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: "#0f766e", marginBottom: 6 }}>Automatic Protection</div>
              <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
                Quantum Shield is created automatically when you protect a work through QRight. You don&apos;t need to create shields manually — the pipeline handles everything: registration → signing → shielding → certification.
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[
                { icon: "✅", title: "2+ shards = full recovery", desc: "Key reconstructed, signature verified" },
                { icon: "❌", title: "1 shard = impossible", desc: "Single shard reveals zero information" },
                { icon: "🔒", title: "Wrong shards = detection", desc: "Corrupted shards produce invalid key" },
              ].map((item) => (
                <div key={item.title} style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span>{item.icon}</span>
                    <span style={{ fontWeight: 800, fontSize: 12, color: "#0f172a" }}>{item.title}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tech stack footer ── */}
        <div style={{ marginTop: 28, padding: "14px 18px", borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", background: "rgba(15,23,42,0.02)", marginBottom: 40 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: "#0f172a", marginBottom: 8 }}>Quantum Shield Technology</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["Ed25519 (RFC 8032)", "Shamir's Secret Sharing", "Threshold 2-of-3", "SHA-256 Shard Hashing", "Distributed Storage", "Auto via Pipeline"].map((t) => (
              <span key={t} style={{ padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600, background: "rgba(15,23,42,0.04)", border: "1px solid rgba(15,23,42,0.08)", color: "#334155" }}>{t}</span>
            ))}
          </div>
        </div>
      </ProductPageShell>
    </main>
  );
}