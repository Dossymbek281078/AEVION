"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiUrl, getApiBase } from "@/lib/apiBase";

/* ----------------------------- types ----------------------------- */

interface CatalogItem {
  id: string;
  name: string;
  status: string;
  tags: string[];
}

interface Position {
  x: number;
  y: number;
}

interface Node {
  id: string;
  name: string;
  status: string;
  tags: string[];
  degree: number;
}

interface Edge {
  a: string;
  b: string;
  score: number;
  overlap: number;
  union: number;
  shared: string[];
}

interface SimulationResult {
  nodes: Node[];
  edges: Edge[];
  positions: Record<string, Position>;
}

type StatusFilter = "all" | "launched" | "mvp" | "planning" | "idea";

/* ----------------------------- constants ----------------------------- */

const TEAL = "#0d9488";
const CANVAS_W = 1100;
const CANVAS_H = 700;
const ITERATIONS = 200;
const REPULSION = 9000;
const ATTRACTION = 0.012;
const CENTER_PULL = 0.0025;
const DAMPING = 0.82;

const STATUS_COLORS: Record<string, string> = {
  launched: "#10b981",
  mvp: "#10b981",
  in_progress: "#f59e0b",
  research: "#8b5cf6",
  planning: "#3b82f6",
  idea: "#94a3b8",
};

const STATUS_FILTERS: StatusFilter[] = ["all", "launched", "mvp", "planning", "idea"];

/* ----------------------------- helpers ----------------------------- */

function colorForStatus(status: string): string {
  return STATUS_COLORS[status] || "#64748b";
}

function jaccard(
  a: string[],
  b: string[],
): { score: number; overlap: number; union: number; shared: string[] } {
  if (a.length === 0 || b.length === 0) {
    return { score: 0, overlap: 0, union: a.length + b.length, shared: [] };
  }
  const setA = new Set(a);
  const setB = new Set(b);
  const shared: string[] = [];
  for (const t of setA) if (setB.has(t)) shared.push(t);
  const unionSize = setA.size + setB.size - shared.length;
  if (unionSize === 0) return { score: 0, overlap: 0, union: 0, shared: [] };
  return {
    score: shared.length / unionSize,
    overlap: shared.length,
    union: unionSize,
    shared,
  };
}

function buildEdges(items: CatalogItem[], topK: number, minOverlap: number): Edge[] {
  // For each node, collect candidate edges, then keep top-K per node.
  // Final edge set = union of per-node top-K (deduped on canonical (a,b) with a<b).
  const candidatesPerNode: Record<string, Edge[]> = {};
  for (const a of items) {
    candidatesPerNode[a.id] = [];
    for (const b of items) {
      if (a.id === b.id) continue;
      const j = jaccard(a.tags || [], b.tags || []);
      if (j.score <= 0) continue;
      if (j.overlap < minOverlap) continue;
      candidatesPerNode[a.id].push({
        a: a.id,
        b: b.id,
        score: j.score,
        overlap: j.overlap,
        union: j.union,
        shared: j.shared,
      });
    }
    candidatesPerNode[a.id].sort((x, y) => y.score - x.score);
    candidatesPerNode[a.id] = candidatesPerNode[a.id].slice(0, topK);
  }

  const seen = new Set<string>();
  const out: Edge[] = [];
  for (const list of Object.values(candidatesPerNode)) {
    for (const e of list) {
      const k = e.a < e.b ? `${e.a}|${e.b}` : `${e.b}|${e.a}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const canonical: Edge =
        e.a < e.b ? e : { ...e, a: e.b, b: e.a };
      out.push(canonical);
    }
  }
  out.sort((x, y) => y.score - x.score);
  return out;
}

function simulate(nodes: Node[], edges: Edge[]): Record<string, Position> {
  const n = nodes.length;
  if (n === 0) return {};
  const cx = CANVAS_W / 2;
  const cy = CANVAS_H / 2;
  const radius = Math.min(CANVAS_W, CANVAS_H) * 0.35;

  // Initialize on a circle
  const pos: Record<string, Position> = {};
  const vel: Record<string, Position> = {};
  nodes.forEach((node, i) => {
    const angle = (i / n) * Math.PI * 2;
    pos[node.id] = {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
    vel[node.id] = { x: 0, y: 0 };
  });

  // Adjacency map for attraction lookup
  const edgesByNode: Record<string, Edge[]> = {};
  for (const node of nodes) edgesByNode[node.id] = [];
  for (const e of edges) {
    edgesByNode[e.a]?.push(e);
    edgesByNode[e.b]?.push(e);
  }

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const forces: Record<string, Position> = {};
    for (const node of nodes) forces[node.id] = { x: 0, y: 0 };

    // Repulsion O(n²)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const A = nodes[i];
        const B = nodes[j];
        const pa = pos[A.id];
        const pb = pos[B.id];
        const dx = pa.x - pb.x;
        const dy = pa.y - pb.y;
        const distSq = dx * dx + dy * dy + 0.01;
        const dist = Math.sqrt(distSq);
        const force = REPULSION / distSq;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        forces[A.id].x += fx;
        forces[A.id].y += fy;
        forces[B.id].x -= fx;
        forces[B.id].y -= fy;
      }
    }

    // Attraction along edges (Hooke's law, scaled by score)
    for (const e of edges) {
      const pa = pos[e.a];
      const pb = pos[e.b];
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const dist = Math.sqrt(dx * dx + dy * dy + 0.01);
      const desired = 140; // rest length
      const delta = dist - desired;
      const k = ATTRACTION * (0.5 + e.score * 1.5);
      const fx = (dx / dist) * delta * k;
      const fy = (dy / dist) * delta * k;
      forces[e.a].x += fx;
      forces[e.a].y += fy;
      forces[e.b].x -= fx;
      forces[e.b].y -= fy;
    }

    // Center pull
    for (const node of nodes) {
      const p = pos[node.id];
      forces[node.id].x += (cx - p.x) * CENTER_PULL;
      forces[node.id].y += (cy - p.y) * CENTER_PULL;
    }

    // Integrate
    for (const node of nodes) {
      const v = vel[node.id];
      const f = forces[node.id];
      v.x = (v.x + f.x) * DAMPING;
      v.y = (v.y + f.y) * DAMPING;
      // Clamp velocity to avoid explosion
      const speed = Math.sqrt(v.x * v.x + v.y * v.y);
      if (speed > 25) {
        v.x = (v.x / speed) * 25;
        v.y = (v.y / speed) * 25;
      }
      const p = pos[node.id];
      p.x += v.x;
      p.y += v.y;
      // Bound inside canvas with padding
      const pad = 60;
      if (p.x < pad) p.x = pad;
      if (p.x > CANVAS_W - pad) p.x = CANVAS_W - pad;
      if (p.y < pad) p.y = pad;
      if (p.y > CANVAS_H - pad) p.y = CANVAS_H - pad;
    }
  }

  return pos;
}

/* ----------------------------- subcomponents ----------------------------- */

function Chip({
  label,
  active,
  onClick,
  accent,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  accent?: string;
}) {
  const c = accent || TEAL;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "5px 11px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        border: `1px solid ${active ? c : "rgba(15,23,42,0.16)"}`,
        background: active ? c : "#fff",
        color: active ? "#fff" : "#475569",
        transition: "all 120ms",
      }}
    >
      {label}
    </button>
  );
}

function CopyCard({
  label,
  body,
  copied,
  onCopy,
  copyKey,
}: {
  label: string;
  body: string;
  copied: string | null;
  onCopy: (text: string, key: string) => void;
  copyKey: string;
}) {
  return (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        background: "#0f172a",
        color: "#e2e8f0",
        border: "1px solid rgba(13,148,136,0.4)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span
          style={{
            fontSize: 10,
            color: "#94a3b8",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {label}
        </span>
        <button
          type="button"
          onClick={() => onCopy(body, copyKey)}
          style={{
            marginLeft: "auto",
            padding: "3px 10px",
            borderRadius: 6,
            background: copied === copyKey ? "#10b981" : "rgba(255,255,255,0.08)",
            color: copied === copyKey ? "#0f172a" : "#e2e8f0",
            border: "none",
            cursor: "pointer",
            fontSize: 10,
            fontWeight: 800,
          }}
        >
          {copied === copyKey ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          fontSize: 12,
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
          lineHeight: 1.5,
        }}
      >
        {body}
      </pre>
    </div>
  );
}

/* ----------------------------- page ----------------------------- */

export default function GraphExplorerPage() {
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [topK, setTopK] = useState(3);
  const [minOverlap, setMinOverlap] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Position>({ x: 0, y: 0 });
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const apiBase = getApiBase();
  const fullUrl = `${apiBase}/api/aevion/catalog?fields=id,name,status,tags`;

  // Fetch catalog once
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(apiUrl("/api/aevion/catalog?fields=id,name,status,tags"))
      .then(async (r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        const json: unknown = await r.json();
        if (cancelled) return;
        if (
          json &&
          typeof json === "object" &&
          Array.isArray((json as { items?: unknown }).items)
        ) {
          const raw = (json as { items: unknown[] }).items;
          const parsed: CatalogItem[] = raw
            .filter(
              (it): it is Record<string, unknown> =>
                typeof it === "object" && it !== null,
            )
            .map((it) => ({
              id: typeof it.id === "string" ? it.id : "",
              name:
                typeof it.name === "string"
                  ? it.name
                  : typeof it.id === "string"
                    ? it.id
                    : "",
              status: typeof it.status === "string" ? it.status : "idea",
              tags: Array.isArray(it.tags)
                ? it.tags.filter((t): t is string => typeof t === "string")
                : [],
            }))
            .filter((x) => x.id);
          setItems(parsed);
          setError(null);
        } else {
          setItems([]);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setItems([]);
          setError(e instanceof Error ? e.message : String(e));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Filter items by status
  const filteredItems = useMemo(() => {
    if (!items) return [];
    if (statusFilter === "all") return items;
    return items.filter((it) => it.status === statusFilter);
  }, [items, statusFilter]);

  // Build graph + simulate layout
  const sim: SimulationResult = useMemo(() => {
    if (!filteredItems.length) return { nodes: [], edges: [], positions: {} };
    const edges = buildEdges(filteredItems, topK, minOverlap);
    const degree: Record<string, number> = {};
    for (const it of filteredItems) degree[it.id] = 0;
    for (const e of edges) {
      degree[e.a] = (degree[e.a] || 0) + 1;
      degree[e.b] = (degree[e.b] || 0) + 1;
    }
    const nodes: Node[] = filteredItems.map((it) => ({
      id: it.id,
      name: it.name,
      status: it.status,
      tags: it.tags,
      degree: degree[it.id] || 0,
    }));
    const positions = simulate(nodes, edges);
    return { nodes, edges, positions };
  }, [filteredItems, topK, minOverlap]);

  // Adjacency for highlight + tooltip edge-count
  const adjacency = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const n of sim.nodes) map[n.id] = new Set();
    for (const e of sim.edges) {
      map[e.a]?.add(e.b);
      map[e.b]?.add(e.a);
    }
    return map;
  }, [sim.nodes, sim.edges]);

  const selectedEdges = useMemo(() => {
    if (!selected) return new Set<string>();
    const out = new Set<string>();
    for (const e of sim.edges) {
      if (e.a === selected || e.b === selected) {
        out.add(`${e.a}|${e.b}`);
      }
    }
    return out;
  }, [sim.edges, selected]);

  const copy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelected(null);
  };

  // Snippets
  const sdkSnippet = `import { AevionCatalog } from "@aevion-io/catalog-client";
const cat = new AevionCatalog();
const { nodes, edges } = await cat.graph({
  topK: ${topK},
  minOverlap: ${minOverlap}${statusFilter !== "all" ? `,\n  status: ["${statusFilter}"]` : ""},
});
// edges: [{ a, b, score, overlap, union, shared }, ...]`;

  const urlSnippet = fullUrl;

  const sampleEdge: Edge | null = sim.edges[0] || null;
  const sampleJson = sampleEdge
    ? JSON.stringify(sampleEdge, null, 2)
    : '{\n  "a": "qsign",\n  "b": "qshield",\n  "score": 0.5,\n  "overlap": 2,\n  "union": 4,\n  "shared": ["security", "core"]\n}';

  // For node sizing: square-root of degree, baseline radius
  const nodeRadius = (n: Node): number => {
    const base = 8;
    return base + Math.sqrt(n.degree) * 4.5;
  };

  // Top-15 edges for table
  const topEdges = sim.edges.slice(0, 15);

  // Hovered node info (memoized lookup)
  const hoveredNode = useMemo(() => {
    if (!hover) return null;
    return sim.nodes.find((n) => n.id === hover.id) || null;
  }, [hover, sim.nodes]);

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 20px" }}>
        <div style={{ marginBottom: 24 }}>
          <Link
            href="/api-explorer"
            style={{ fontSize: 12, color: "#64748b", textDecoration: "none" }}
          >
            ← API explorer
          </Link>
          <h1 style={{ fontSize: 34, fontWeight: 900, margin: "8px 0", letterSpacing: "-0.02em" }}>
            Module graph
          </h1>
          <p style={{ fontSize: 14, color: "#64748b", margin: 0, lineHeight: 1.6, maxWidth: 760 }}>
            Force-directed visualization of the AEVION module ecosystem. Edges are computed
            client-side via tag-Jaccard similarity — the same algorithm exposed as{" "}
            <code style={{ background: "rgba(15,23,42,0.06)", padding: "1px 6px", borderRadius: 4 }}>
              cat.graph()
            </code>{" "}
            in <code>@aevion-io/catalog-client</code> v0.4. Source data:{" "}
            <code style={{ background: "rgba(15,23,42,0.06)", padding: "1px 6px", borderRadius: 4 }}>
              GET /api/aevion/catalog?fields=id,name,status,tags
            </code>
            .
          </p>
        </div>

        {/* Controls (sticky) */}
        <div
          style={{
            padding: "14px 18px",
            borderRadius: 12,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
            marginBottom: 14,
            position: "sticky",
            top: 14,
            zIndex: 5,
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          {/* Top-K slider */}
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 6,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>Top-K neighbours</span>
              <span style={{ color: TEAL, fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>
                {topK}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              style={{ width: "100%", accentColor: TEAL }}
              aria-label="Top-K neighbours"
            />
          </div>

          {/* Min-overlap slider */}
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 6,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>Min overlap</span>
              <span style={{ color: TEAL, fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>
                {minOverlap}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={3}
              value={minOverlap}
              onChange={(e) => setMinOverlap(Number(e.target.value))}
              style={{ width: "100%", accentColor: TEAL }}
              aria-label="Minimum tag overlap"
            />
          </div>

          {/* Status filter chips */}
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 6,
              }}
            >
              Status filter
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {STATUS_FILTERS.map((s) => (
                <Chip
                  key={s}
                  label={s}
                  active={statusFilter === s}
                  onClick={() => setStatusFilter(s)}
                  accent={s === "all" ? TEAL : STATUS_COLORS[s] || TEAL}
                />
              ))}
            </div>
          </div>

          {/* Reset button */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={resetZoom}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                background: "transparent",
                border: "1px solid rgba(15,23,42,0.16)",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
                color: "#475569",
              }}
            >
              Reset view
            </button>
          </div>
        </div>

        {/* Stats banner */}
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
            marginBottom: 14,
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            fontSize: 12,
            color: "#64748b",
          }}
        >
          <span>
            <strong style={{ color: "#0f172a" }}>{sim.nodes.length}</strong> nodes
          </span>
          <span>
            <strong style={{ color: "#0f172a" }}>{sim.edges.length}</strong> edges
          </span>
          {sim.edges.length > 0 && (
            <span>
              top score{" "}
              <strong
                style={{
                  color: "#0f172a",
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                }}
              >
                {sim.edges[0].score.toFixed(3)}
              </strong>
            </span>
          )}
          {loading && <span style={{ color: TEAL }}>loading…</span>}
          {error && <span style={{ color: "#ef4444" }}>error: {error}</span>}
          <span style={{ marginLeft: "auto", fontFamily: "ui-monospace, SFMono-Regular, monospace", fontSize: 11, color: "#94a3b8" }}>
            zoom {zoom.toFixed(2)}×
          </span>
        </div>

        {/* SVG canvas */}
        <div
          style={{
            padding: 0,
            borderRadius: 12,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
            marginBottom: 14,
            overflow: "hidden",
            position: "relative",
          }}
        >
          <svg
            viewBox={`${-pan.x} ${-pan.y} ${CANVAS_W / zoom} ${CANVAS_H / zoom}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ width: "100%", height: CANVAS_H, display: "block", background: "#f8fafc", cursor: "default" }}
            onWheel={(e) => {
              const delta = e.deltaY > 0 ? 0.92 : 1.08;
              setZoom((z) => Math.max(0.4, Math.min(3, z * delta)));
            }}
          >
            {/* Edges */}
            <g>
              {sim.edges.map((e) => {
                const pa = sim.positions[e.a];
                const pb = sim.positions[e.b];
                if (!pa || !pb) return null;
                const key = `${e.a}|${e.b}`;
                const isHi =
                  selected !== null &&
                  (selectedEdges.has(key) || e.a === selected || e.b === selected);
                const isDim = selected !== null && !isHi;
                const opacity = isDim ? 0.06 : 0.2 + e.score * 0.8;
                const stroke = isHi ? TEAL : "#475569";
                const width = isHi ? 2 : 0.8 + e.score * 1.4;
                return (
                  <line
                    key={key}
                    x1={pa.x}
                    y1={pa.y}
                    x2={pb.x}
                    y2={pb.y}
                    stroke={stroke}
                    strokeWidth={width}
                    strokeOpacity={opacity}
                  />
                );
              })}
            </g>

            {/* Nodes */}
            <g>
              {sim.nodes.map((n) => {
                const p = sim.positions[n.id];
                if (!p) return null;
                const r = nodeRadius(n);
                const c = colorForStatus(n.status);
                const isSelected = selected === n.id;
                const isNeighbour =
                  selected !== null && adjacency[selected]?.has(n.id);
                const isDim = selected !== null && !isSelected && !isNeighbour;
                return (
                  <g
                    key={n.id}
                    transform={`translate(${p.x},${p.y})`}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => setHover({ id: n.id, x: p.x, y: p.y })}
                    onMouseLeave={() => setHover((h) => (h?.id === n.id ? null : h))}
                    onClick={() => setSelected((s) => (s === n.id ? null : n.id))}
                  >
                    <circle
                      r={r + 3}
                      fill="none"
                      stroke={isSelected ? TEAL : "transparent"}
                      strokeWidth={2}
                    />
                    <circle
                      r={r}
                      fill={c}
                      fillOpacity={isDim ? 0.25 : 0.95}
                      stroke="#fff"
                      strokeWidth={1.5}
                    />
                    <text
                      y={r + 12}
                      textAnchor="middle"
                      style={{
                        fontSize: 10,
                        fontFamily: "ui-monospace, SFMono-Regular, monospace",
                        fontWeight: 700,
                        fill: isDim ? "#94a3b8" : "#0f172a",
                        pointerEvents: "none",
                      }}
                    >
                      {n.id}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Tooltip */}
          {hoveredNode && hover && (
            <div
              style={{
                position: "absolute",
                left: `${(hover.x / (CANVAS_W / zoom) + pan.x / (CANVAS_W / zoom)) * 100}%`,
                top: `${(hover.y / (CANVAS_H / zoom) + pan.y / (CANVAS_H / zoom)) * 100}%`,
                transform: "translate(12px, -100%)",
                padding: "8px 10px",
                borderRadius: 8,
                background: "#0f172a",
                color: "#e2e8f0",
                fontSize: 11,
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                pointerEvents: "none",
                maxWidth: 240,
                lineHeight: 1.5,
                boxShadow: "0 4px 12px rgba(15,23,42,0.18)",
                zIndex: 4,
              }}
            >
              <div style={{ fontWeight: 800, color: "#fff", marginBottom: 4 }}>
                {hoveredNode.id}
              </div>
              <div style={{ color: "#94a3b8", marginBottom: 4 }}>{hoveredNode.name}</div>
              <div style={{ marginBottom: 4 }}>
                status:{" "}
                <span style={{ color: colorForStatus(hoveredNode.status) }}>
                  {hoveredNode.status}
                </span>
              </div>
              <div style={{ marginBottom: 4 }}>
                edges:{" "}
                <span style={{ color: "#fcd34d" }}>{hoveredNode.degree}</span>
              </div>
              <div style={{ color: "#86efac", wordBreak: "break-word" }}>
                {hoveredNode.tags.join(", ") || "(no tags)"}
              </div>
            </div>
          )}

          {/* Legend */}
          <div
            style={{
              position: "absolute",
              right: 14,
              bottom: 14,
              padding: "8px 10px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.95)",
              border: "1px solid rgba(15,23,42,0.08)",
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              fontSize: 10,
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              color: "#475569",
            }}
          >
            {(["launched", "in_progress", "research", "planning", "idea"] as const).map((s) => (
              <span key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: STATUS_COLORS[s],
                  }}
                  aria-hidden
                />
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* Top edges table */}
        {topEdges.length > 0 && (
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              background: "#fff",
              border: "1px solid rgba(15,23,42,0.08)",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 10,
              }}
            >
              Top {topEdges.length} edges by Jaccard score
            </div>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 12,
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                }}
              >
                <thead>
                  <tr style={{ textAlign: "left", color: "#94a3b8" }}>
                    <th style={{ padding: "6px 8px", fontWeight: 700 }}>a</th>
                    <th style={{ padding: "6px 8px", fontWeight: 700 }}>b</th>
                    <th style={{ padding: "6px 8px", fontWeight: 700, textAlign: "right" }}>
                      score
                    </th>
                    <th style={{ padding: "6px 8px", fontWeight: 700, textAlign: "right" }}>
                      overlap
                    </th>
                    <th style={{ padding: "6px 8px", fontWeight: 700, textAlign: "right" }}>
                      union
                    </th>
                    <th style={{ padding: "6px 8px", fontWeight: 700 }}>shared tags</th>
                  </tr>
                </thead>
                <tbody>
                  {topEdges.map((e, i) => (
                    <tr
                      key={`${e.a}|${e.b}`}
                      onClick={() => setSelected(e.a)}
                      style={{
                        borderTop: "1px solid rgba(15,23,42,0.06)",
                        cursor: "pointer",
                        background:
                          selected === e.a || selected === e.b
                            ? "rgba(13,148,136,0.06)"
                            : i % 2 === 0
                              ? "transparent"
                              : "rgba(15,23,42,0.02)",
                      }}
                    >
                      <td style={{ padding: "6px 8px", color: "#0f172a", fontWeight: 700 }}>
                        {e.a}
                      </td>
                      <td style={{ padding: "6px 8px", color: "#0f172a", fontWeight: 700 }}>
                        {e.b}
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          textAlign: "right",
                          color: TEAL,
                          fontWeight: 700,
                        }}
                      >
                        {e.score.toFixed(3)}
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "#475569" }}>
                        {e.overlap}
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "#475569" }}>
                        {e.union}
                      </td>
                      <td style={{ padding: "6px 8px", color: "#475569" }}>
                        {e.shared.join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Snippet cards */}
        <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
          <CopyCard
            label="SDK call"
            body={sdkSnippet}
            copied={copied}
            onCopy={copy}
            copyKey="sdk"
          />
          <CopyCard
            label="Source endpoint"
            body={urlSnippet}
            copied={copied}
            onCopy={copy}
            copyKey="url"
          />
          <CopyCard
            label="Sample edge"
            body={sampleJson}
            copied={copied}
            onCopy={copy}
            copyKey="edge"
          />
        </div>

        {/* Tip */}
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            background: "rgba(13,148,136,0.06)",
            border: "1px solid rgba(13,148,136,0.18)",
            marginBottom: 18,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: TEAL,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 6,
            }}
          >
            Tip
          </div>
          <div style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.6 }}>
            Edges are computed entirely client-side from{" "}
            <code style={{ background: "rgba(15,23,42,0.06)", padding: "1px 5px", borderRadius: 4 }}>
              tag
            </code>{" "}
            arrays — no extra HTTP round-trip. Jaccard = |A ∩ B| / |A ∪ B|. Click a node to
            highlight its neighbourhood; scroll on the canvas to zoom.
          </div>
        </div>

        {/* Footer crosslinks */}
        <div
          style={{
            marginTop: 18,
            fontSize: 11,
            color: "#94a3b8",
            lineHeight: 1.8,
          }}
        >
          <Link href="/api-explorer/catalog" style={{ color: TEAL }}>
            Catalog explorer
          </Link>{" "}
          ·{" "}
          <Link href="/api-explorer/sdk" style={{ color: TEAL }}>
            SDK playground
          </Link>{" "}
          ·{" "}
          <Link href="/api-explorer/openapi" style={{ color: TEAL }}>
            OpenAPI explorer
          </Link>{" "}
          ·{" "}
          <Link href="/api-explorer/health" style={{ color: TEAL }}>
            Health dashboard
          </Link>{" "}
          ·{" "}
          <Link href="/api-explorer/version" style={{ color: TEAL }}>
            Version & SDK
          </Link>{" "}
          ·{" "}
          <Link href="/api-explorer/sitemap" style={{ color: TEAL }}>
            Sitemap explorer
          </Link>{" "}
          ·{" "}
          <Link href="/api-explorer/badges" style={{ color: TEAL }}>
            Badge builder
          </Link>{" "}
          ·{" "}
          <Link href="/status" style={{ color: TEAL }}>
            Public status
          </Link>
        </div>
      </div>
    </main>
  );
}
