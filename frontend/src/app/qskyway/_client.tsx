"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { apiUrl } from "@/lib/apiBase";
import { DataProvenanceChip } from "@/components/DataProvenanceChip";
import type { DataQuality } from "@/lib/dataQuality";

// QSkyway — навигационный слой городского неба для аэротакси.
// Клиент рисует реальный цифровой двойник Астаны (318 зданий из OpenStreetMap,
// поле высот 20 м из /api/qskyway/city), автогенерирует 3D-коридоры (A* с
// раскладкой по высотным полосам) и бронирует 4D-слот прав через /api/qskyway/slots.
// Честно: движок и доказательство концепции, не сертифицированное авиационное ПО.

interface NoFly { id: string; name: string; kind: string; x: number; y: number; radiusM: number; }
interface CityData {
  city: string;
  meters: { w: number; h: number };
  grid: { cols: number; rows: number; cell: number; heights: number[]; src?: number[] };
  buildings: { h: number; hs?: number; r: number[][] }[];
  vertiports: { c: number; r: number; x: number; y: number }[];
  nofly?: NoFly[];
  wind?: { fromDeg: number; groundMs: number; topMs: number };
  vertiportScores?: { c: number; r: number; suitability: number; class: string }[];
  dataQuality?: DataQuality;
  _signature?: { alg: string; contentHash: string };
}
interface Cell { c: number; r: number; }
interface Taxi { path: Cell[]; alts: number[]; seg: number; u: number; speed: number; hero: boolean; slow: number; }
interface VertiportRow { id: string; suitability: number; cls: string; }
interface Slot { id: string; routeId: string; t0: string; t1: string; holder: string; issued: string; receipt: string; }

const VP_CLASS_LABEL: Record<string, string> = {
  "candidate-pad": "кандидат на площадку",
  "needs-infrastructure": "нужна инфраструктура",
  unsuitable: "непригодна",
};
const VP_CLASS_COLOR: Record<string, string> = {
  "candidate-pad": "#2dd4bf",
  "needs-infrastructure": "#fbbf24",
  unsuitable: "#fb7185",
};

const FLOOR = 50, CLEAR = 15, BAND = 25, ALT_MIN = 50;
// Phase 5: extra safety clearance by height-data confidence (measured/derived/guessed).
const SRC_CLEARANCE = [0, 6, 16];

const STOPS: number[][] = [[56, 189, 248], [34, 211, 238], [129, 140, 248], [167, 139, 250]];
function altColor(alt: number, altMax: number, a = 1): string {
  const t = Math.max(0, Math.min(1, (alt - ALT_MIN) / (altMax - ALT_MIN)));
  const seg = t * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(seg));
  const f = seg - i;
  const c = STOPS[i].map((v, k) => Math.round(v + (STOPS[i + 1][k] - v) * f));
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

export default function QSkywayClient() {
  const mapRef = useRef<HTMLCanvasElement | null>(null);
  const profRef = useRef<HTMLCanvasElement | null>(null);
  const cityRef = useRef<CityData | null>(null);
  const taxisRef = useRef<Taxi[]>([]);
  const heroRef = useRef<Taxi | null>(null);
  const rafRef = useRef<number>(0);
  const runningRef = useRef<boolean>(true);
  const conflictsRef = useRef<number>(0);
  const showColorRef = useRef<boolean>(true);
  const altMaxRef = useRef<number>(260);

  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [stats, setStats] = useState({ distKm: 0, cruiseAlt: 0, eta: 0, conflicts: 0, city: "", buildings: 0, corridors: 0 });
  const [booking, setBooking] = useState<string>("");
  const [playing, setPlaying] = useState(true);
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [cityId, setCityId] = useState<string>("astana");
  const [meta, setMeta] = useState<{ wind: string; signed: string; nofly: number; heightPct: number; realPct: number; dq?: DataQuality } | null>(null);
  const [vpRows, setVpRows] = useState<VertiportRow[]>([]);
  const [slots, setSlots] = useState<{ list: Slot[]; count: number; capacityPerRoute: number; store: string }>({ list: [], count: 0, capacityPerRoute: 0, store: "" });

  // ── engine (pure over the loaded city) ──────────────────────────────────────
  const obst = useCallback((c: number, r: number): number => {
    const city = cityRef.current;
    if (!city) return 999;
    const { cols, rows, heights } = city.grid;
    return c < 0 || r < 0 || c >= cols || r >= rows ? 999 : heights[r * cols + c];
  }, []);

  const srcAt = useCallback((c: number, r: number): number => {
    const g = cityRef.current?.grid;
    if (!g || !g.src) return 0;
    return c < 0 || r < 0 || c >= g.cols || r >= g.rows ? 0 : (g.src[r * g.cols + c] ?? 0);
  }, []);

  const edgeAlt = useCallback((fc: number, fr: number, tc: number, tr: number): number => {
    const conf = Math.max(SRC_CLEARANCE[srcAt(fc, fr)] ?? 0, SRC_CLEARANCE[srcAt(tc, tr)] ?? 0);
    const required = Math.max(obst(fc, fr), obst(tc, tr)) + CLEAR + conf;
    const band = Math.max(0, Math.ceil((required - FLOOR) / BAND));
    const eastOrNorth = tc - fc > 0 || tr - fr < 0;
    return FLOOR + band * BAND + (eastOrNorth ? 0 : BAND / 2);
  }, [obst, srcAt]);

  const astar = useCallback((s: Cell, g: Cell): Cell[] | null => {
    const city = cityRef.current;
    if (!city) return null;
    const { cols, rows } = city.grid;
    const nofly = city.nofly ?? [];
    const cellM = city.grid.cell;
    const inNoFly = (c: number, r: number) => { const x = (c + 0.5) * cellM, y = (r + 0.5) * cellM; for (const z of nofly) if (Math.hypot(x - z.x, y - z.y) <= z.radiusM) return true; return false; };
    const idx = (c: number, r: number) => r * cols + c;
    const gsc = new Float64Array(cols * rows).fill(Infinity);
    const came = new Int32Array(cols * rows).fill(-1);
    const h = (c: number, r: number) => Math.abs(c - g.c) + Math.abs(r - g.r);
    // simple array priority queue (grid is small enough)
    const open: { c: number; r: number; f: number }[] = [];
    const push = (n: { c: number; r: number; f: number }) => {
      let lo = 0, hi = open.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (open[m].f < n.f) lo = m + 1; else hi = m; }
      open.splice(lo, 0, n);
    };
    gsc[idx(s.c, s.r)] = 0;
    push({ c: s.c, r: s.r, f: h(s.c, s.r) });
    const D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (open.length) {
      const cur = open.shift() as { c: number; r: number; f: number };
      if (cur.c === g.c && cur.r === g.r) break;
      const ci = idx(cur.c, cur.r);
      for (const [dc, dr] of D) {
        const nc = cur.c + dc, nr = cur.r + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        if (inNoFly(nc, nr) && !(nc === g.c && nr === g.r) && !(nc === s.c && nr === s.r)) continue;
        const alt = edgeAlt(cur.c, cur.r, nc, nr);
        const step = 1 + (alt - FLOOR) / 90;
        const t = gsc[ci] + step, ni = idx(nc, nr);
        if (t < gsc[ni]) { gsc[ni] = t; came[ni] = ci; push({ c: nc, r: nr, f: t + h(nc, nr) }); }
      }
    }
    let ci = idx(g.c, g.r);
    if (came[ci] < 0 && ci !== idx(s.c, s.r)) return null;
    const path: Cell[] = [];
    while (ci >= 0) { path.unshift({ c: ci % cols, r: Math.floor(ci / cols) }); ci = came[ci]; }
    return path.length > 1 ? path : null;
  }, [edgeAlt]);

  const makeTaxi = useCallback((hero: boolean): Taxi | null => {
    const city = cityRef.current;
    if (!city) return null;
    const vps = city.vertiports;
    let path: Cell[] | null = null, tries = 0;
    while (!path && tries++ < 16) {
      const a = vps[Math.floor(Math.random() * vps.length)];
      const b = vps[Math.floor(Math.random() * vps.length)];
      if (a === b) continue;
      path = astar({ c: a.c, r: a.r }, { c: b.c, r: b.r });
    }
    if (!path) return null;
    const alts: number[] = [];
    for (let k = 0; k < path.length - 1; k++) alts.push(edgeAlt(path[k].c, path[k].r, path[k + 1].c, path[k + 1].r));
    return { path, alts, seg: 0, u: 0, speed: 1.1 + Math.random() * 0.5, hero, slow: 0 };
  }, [astar, edgeAlt]);

  const newHero = useCallback(() => {
    const t = makeTaxi(true);
    if (!t) return;
    heroRef.current = t;
    const city = cityRef.current!;
    const distKm = t.alts.length * city.grid.cell / 1000;
    const cruise = t.alts.reduce((m, v) => Math.max(m, v), 0);
    setStats((s) => ({ ...s, distKm: +distKm.toFixed(2), cruiseAlt: Math.round(cruise), eta: +((distKm / 90) * 60).toFixed(1) }));
  }, [makeTaxi]);

  // ── city loading (switchable) ─────────────────────────────────────────────────
  const loadCity = useCallback(async (id: string) => {
    setLoaded(false); setErr(null);
    try {
      const res = await fetch(apiUrl(`/api/qskyway/city?city=${encodeURIComponent(id)}`));
      if (!res.ok) throw new Error("city " + res.status);
      const city: CityData = await res.json();
      cityRef.current = city;
      taxisRef.current = []; heroRef.current = null; conflictsRef.current = 0;
      let mh = 0; for (const h of city.grid.heights) if (h > mh) mh = h;
      altMaxRef.current = FLOOR + Math.ceil((mh + CLEAR - FLOOR) / BAND) * BAND + BAND;
      const cols = Math.floor(city.grid.cols / 3), rows = Math.floor(city.grid.rows / 3);
      setStats({ distKm: 0, cruiseAlt: 0, eta: 0, conflicts: 0, city: city.city, buildings: city.buildings.length, corridors: cols * rows * 2 });
      setMeta({
        wind: city.wind ? `${city.wind.groundMs}→${city.wind.topMs} м/с (от ${city.wind.fromDeg}°)` : "—",
        signed: city._signature ? city._signature.contentHash.slice(0, 12) : "—",
        nofly: city.nofly?.length ?? 0,
        heightPct: city.dataQuality?.measuredPct ?? 0,
        realPct: city.dataQuality?.realPct ?? 0,
        dq: city.dataQuality,
      });
      const scoreOf = new Map<string, { suitability: number; cls: string }>();
      for (const s of city.vertiportScores ?? []) scoreOf.set(s.c + "," + s.r, { suitability: s.suitability, cls: s.class });
      setVpRows(city.vertiports.map((v, i) => {
        const s = scoreOf.get(v.c + "," + v.r);
        return { id: `H-${i + 1}`, suitability: s?.suitability ?? 0, cls: s?.cls ?? "unscored" };
      }).sort((a, b) => b.suitability - a.suitability));
      setLoaded(true);
      newHero();
      for (let i = 0; i < 5; i++) { const t = makeTaxi(false); if (t) taxisRef.current.push(t); }
    } catch (e) { setErr(String(e)); }
  }, [newHero, makeTaxi]);

  // ── rendering / bootstrap ──────────────────────────────────────────────────────
  useEffect(() => {
    startLoop();
    (async () => {
      try {
        const r = await fetch(apiUrl("/api/qskyway/cities"));
        if (r.ok) { const j = await r.json(); setCities((j.cities ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))); }
      } catch { /* selector optional */ }
      loadCity("astana");
      fetchSlots();
    })();
    return () => { cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startLoop = useCallback(() => {
    let last = 0, statFlush = 0;
    const step = (ts: number) => {
      if (!last) last = ts;
      let dt = (ts - last) / 1000; last = ts; dt = Math.min(0.05, dt);
      const city = cityRef.current;
      if (city) {
        if (runningRef.current) {
          const all = heroRef.current ? [heroRef.current, ...taxisRef.current] : taxisRef.current;
          for (const t of all) advance(t, dt);
          deconflict(all);
          statFlush += dt;
          if (statFlush > 0.6) { statFlush = 0; setStats((s) => (s.conflicts === conflictsRef.current ? s : { ...s, conflicts: conflictsRef.current })); }
        }
        drawMap(); drawProfile();
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function advance(t: Taxi, dt: number) {
    if (t.seg >= t.path.length - 1) { const n = makeTaxi(t.hero); if (n) { Object.assign(t, n); } return; }
    const sp = t.speed * (t.slow > 0 ? 0.35 : 1);
    t.u += sp * dt; if (t.slow > 0) t.slow -= dt;
    while (t.u >= 1 && t.seg < t.path.length - 1) { t.u -= 1; t.seg++; }
  }
  function taxiPos(t: Taxi) {
    const a = t.path[t.seg], b = t.path[Math.min(t.seg + 1, t.path.length - 1)];
    return { c: a.c + (b.c - a.c) * t.u, r: a.r + (b.r - a.r) * t.u, alt: t.alts[Math.min(t.seg, t.alts.length - 1)] };
  }
  function deconflict(all: Taxi[]) {
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const a = taxiPos(all[i]), b = taxiPos(all[j]);
      if (Math.hypot(a.c - b.c, a.r - b.r) < 2.2 && Math.abs(a.alt - b.alt) < BAND * 0.5) {
        const low = all[i].hero ? all[j] : all[j].hero ? all[i] : all[i].speed <= all[j].speed ? all[i] : all[j];
        if (low.slow <= 0) conflictsRef.current++;
        low.slow = Math.max(low.slow, 0.9);
      }
    }
  }

  function drawMap() {
    const cv = mapRef.current, city = cityRef.current; if (!cv || !city) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = cv.getBoundingClientRect();
    const W = rect.width, H = rect.width * city.meters.h / city.meters.w;
    if (cv.style.height !== H + "px") cv.style.height = H + "px";
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const SC = W / city.meters.w, CELL = city.grid.cell;
    const cX = (c: number) => (c + 0.5) * CELL * SC, cY = (r: number) => (r + 0.5) * CELL * SC;
    const altMax = altMaxRef.current;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0a121d"; ctx.fillRect(0, 0, W, H);
    // buildings
    let maxH = 1; for (const b of city.buildings) if (b.h > maxH) maxH = b.h;
    for (const b of city.buildings) {
      const t = Math.min(1, b.h / maxH);
      const g = Math.round(24 + t * 90);
      // guessed height (blind default) → warm/amber tint so data uncertainty is visible;
      // measured/derived → cool blue-grey. Brightness still encodes height.
      ctx.fillStyle = b.hs === 2
        ? `rgb(${g + 42},${g + 22},${Math.round(16 + t * 26)})`
        : `rgb(${g},${g + 12},${g + 26})`;
      ctx.beginPath();
      const rr = b.r; ctx.moveTo(rr[0][0] * SC, rr[0][1] * SC);
      for (let i = 1; i < rr.length; i++) ctx.lineTo(rr[i][0] * SC, rr[i][1] * SC);
      ctx.closePath(); ctx.fill();
    }
    // no-fly zones
    if (city.nofly) for (const z of city.nofly) {
      ctx.beginPath(); ctx.arc(z.x * SC, z.y * SC, z.radiusM * SC, 0, 7);
      ctx.fillStyle = "rgba(251,113,133,0.14)"; ctx.fill();
      ctx.strokeStyle = "rgba(251,113,133,0.8)"; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
    }
    // hero corridor
    const hero = heroRef.current;
    if (hero) {
      ctx.lineWidth = Math.max(2.5, CELL * SC * 0.5); ctx.lineCap = "round"; ctx.lineJoin = "round";
      for (let k = 0; k < hero.path.length - 1; k++) {
        ctx.strokeStyle = showColorRef.current ? altColor(hero.alts[k], altMax, 0.92) : "#fbbf24";
        ctx.beginPath(); ctx.moveTo(cX(hero.path[k].c), cY(hero.path[k].r)); ctx.lineTo(cX(hero.path[k + 1].c), cY(hero.path[k + 1].r)); ctx.stroke();
      }
    }
    // vertiports (coloured by landing-suitability)
    const scoreOf = new Map<string, string>();
    if (city.vertiportScores) for (const s of city.vertiportScores) scoreOf.set(s.c + "," + s.r, s.class);
    for (const v of city.vertiports) {
      const cls = scoreOf.get(v.c + "," + v.r);
      const col = cls === "candidate-pad" ? "#2dd4bf" : cls === "needs-infrastructure" ? "#fbbf24" : cls === "unsuitable" ? "#fb7185" : "#22d3ee";
      const r = Math.max(5, CELL * SC * 0.9);
      ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cX(v.c), cY(v.r), r, 0, 7); ctx.stroke();
      ctx.fillStyle = col; ctx.font = `700 ${r}px monospace`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("H", cX(v.c), cY(v.r) + 0.5);
    }
    // taxis
    const all = hero ? [...taxisRef.current, hero] : taxisRef.current;
    for (const t of all) {
      const p = taxiPos(t), x = cX(p.c), y = cY(p.r), a = Math.max(4, CELL * SC * (t.hero ? 1.1 : 0.8));
      const s = t.path[t.seg], e = t.path[Math.min(t.seg + 1, t.path.length - 1)];
      const ang = Math.atan2(cY(e.r) - cY(s.r), cX(e.c) - cX(s.c));
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      ctx.fillStyle = t.slow > 0 ? "#fb7185" : showColorRef.current ? altColor(p.alt, altMax) : "#fbbf24";
      ctx.beginPath(); ctx.moveTo(a, 0); ctx.lineTo(-a * 0.7, a * 0.6); ctx.lineTo(-a * 0.7, -a * 0.6); ctx.closePath(); ctx.fill();
      if (t.slow > 0) { ctx.strokeStyle = "#fb7185"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, a * 1.9, 0, 7); ctx.stroke(); }
      ctx.restore();
    }
  }

  function drawProfile() {
    const cv = profRef.current, hero = heroRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = cv.getBoundingClientRect();
    if (cv.width !== Math.round(rect.width * dpr)) { cv.width = Math.round(rect.width * dpr); cv.height = Math.round(rect.height * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width, h = rect.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0a121d"; ctx.fillRect(0, 0, w, h);
    if (!hero) return;
    const altMax = altMaxRef.current, n = hero.alts.length, padL = 36, padB = 18, padT = 12, pw = w - padL - 8, ph = h - padB - padT;
    const yOf = (a: number) => padT + ph * (1 - (a - ALT_MIN) / (altMax - ALT_MIN));
    ctx.strokeStyle = "rgba(150,180,220,.12)"; ctx.fillStyle = "#5f7086"; ctx.font = "10px monospace"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    const stepA = Math.max(25, Math.round((altMax - FLOOR) / 5 / 25) * 25);
    for (let a = FLOOR; a <= altMax; a += stepA) { const y = yOf(a); ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - 4, y); ctx.stroke(); ctx.fillText(String(a), padL - 5, y); }
    // obstacle silhouette
    const city = cityRef.current!;
    const obstAt = (c: number, r: number) => { const { cols } = city.grid; return city.grid.heights[r * cols + c]; };
    ctx.fillStyle = "#43597a"; ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.moveTo(padL, h - padB);
    for (let k = 0; k < n; k++) {
      const x0 = padL + pw * k / n, x1 = padL + pw * (k + 1) / n;
      const ob = Math.min(altMax, Math.max(obstAt(hero.path[k].c, hero.path[k].r), obstAt(hero.path[k + 1].c, hero.path[k + 1].r)));
      const y = yOf(ob); ctx.lineTo(x0, y); ctx.lineTo(x1, y);
    }
    ctx.lineTo(padL + pw, h - padB); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    // corridor
    ctx.lineWidth = 3; ctx.lineCap = "round";
    for (let k = 0; k < n; k++) {
      const x0 = padL + pw * k / n, x1 = padL + pw * (k + 1) / n, y = yOf(hero.alts[k]);
      ctx.strokeStyle = showColorRef.current ? altColor(hero.alts[k], altMax) : "#fbbf24";
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      if (k > 0) { ctx.beginPath(); ctx.moveTo(x0, yOf(hero.alts[k - 1])); ctx.lineTo(x0, y); ctx.stroke(); }
    }
    const prog = (hero.seg + hero.u) / n, mx = padL + pw * Math.min(1, prog);
    ctx.strokeStyle = "#e8eef7"; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(mx, padT); ctx.lineTo(mx, h - padB); ctx.stroke(); ctx.setLineDash([]);
  }

  // ── slots market (real backend) ──────────────────────────────────────────────
  const fetchSlots = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/qskyway/slots"));
      if (!res.ok) return;
      const j = await res.json();
      setSlots({ list: j.slots ?? [], count: j.count ?? 0, capacityPerRoute: j.capacityPerRoute ?? 0, store: j.store ?? "" });
    } catch { /* market panel is best-effort */ }
  }, []);

  // ── slot booking (real backend) ──────────────────────────────────────────────
  const bookSlot = useCallback(async () => {
    const hero = heroRef.current;
    if (!hero) return;
    const routeId = `${cityId}-vp-${hero.path[0].c}_${hero.path[0].r}`;
    const t0 = "2026-07-11T09:00:00Z", t1 = "2026-07-11T09:03:00Z";
    try {
      const res = await fetch(apiUrl("/api/qskyway/slots"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routeId, t0, t1, holder: "AEVION demo" }),
      });
      const j = await res.json();
      setBooking(j.ok ? `✓ ${j.slot.id} · ${j.slot.receipt}` : `✗ ${j.error}`);
      if (j.ok) fetchSlots();
    } catch (e) { setBooking("ошибка сети: " + String(e)); }
  }, [cityId, fetchSlots]);

  const wrap: React.CSSProperties = { maxWidth: 1180, margin: "0 auto", padding: "24px 18px 48px", fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", color: "#e8eef7" };
  const card: React.CSSProperties = { background: "#0e141f", border: "1px solid #1e2836", borderRadius: 12, overflow: "hidden" };
  const cardH: React.CSSProperties = { padding: "10px 14px", borderBottom: "1px solid #1e2836", background: "#131b28", fontFamily: "monospace", fontSize: 11.5, letterSpacing: 1.5, textTransform: "uppercase", color: "#9fb0c4" };
  const btn: React.CSSProperties = { fontSize: 13, borderRadius: 8, padding: "8px 13px", cursor: "pointer", border: "1px solid #1e2836", background: "transparent", color: "#9fb0c4" };
  const btnPri: React.CSSProperties = { ...btn, background: "#fbbf24", color: "#1a1200", border: "none", fontWeight: 600 };

  return (
    <div style={{ background: "#070b12", minHeight: "100vh" }}>
      <div style={wrap}>
        <div style={{ fontFamily: "monospace", fontSize: 10.5, letterSpacing: 2, textTransform: "uppercase", color: "#5f7086" }}>AEVION · планета городского неба</div>
        <h1 style={{ fontFamily: "monospace", fontSize: 24, margin: "2px 0 4px" }}><span style={{ color: "#fbbf24" }}>Q</span>Skyway</h1>
        <p style={{ color: "#9fb0c4", fontSize: 14, margin: "0 0 4px", maxWidth: 720 }}>
          3D-аэрокоридоры и авто-навигация для аэротакси поверх реального цифрового двойника города. Данные зданий — OpenStreetMap.
        </p>
        <p style={{ color: "#5f7086", fontSize: 12, margin: "0 0 18px" }}>
          Движок и доказательство концепции, не сертифицированное авиационное ПО. Полёты в реальном небе требуют допуска регулятора (U-space / UTM / CAAC). Данные зданий — OpenStreetMap (открытые, ODbL).
        </p>

        {cities.length > 1 && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "0 0 16px" }}>
            <span style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: 1, color: "#5f7086" }}>ГОРОД:</span>
            {cities.map((c) => (
              <button key={c.id} onClick={() => { setCityId(c.id); loadCity(c.id); }}
                style={{ fontSize: 13, borderRadius: 8, padding: "7px 13px", cursor: "pointer", ...(cityId === c.id ? { background: "#22d3ee", color: "#04212a", border: "none", fontWeight: 600 } : { background: "transparent", color: "#9fb0c4", border: "1px solid #1e2836" }) }}>
                {c.name}
              </button>
            ))}
          </div>
        )}

        {err && <div style={{ ...card, padding: 16, color: "#fb7185" }}>Не удалось загрузить город: {err}. Проверь, что бэкенд поднят (/api/qskyway/city).</div>}

        {!err && (
          <div className="qsky-grid" style={{ display: "grid", gap: 14 }}>
            <style>{`.qsky-grid { grid-template-columns: 1fr; } @media (min-width: 900px) { .qsky-grid { grid-template-columns: 1.55fr 1fr; } }`}</style>
            <section style={card}>
              <div style={cardH}>Аэрокарта · реальные здания{stats.city ? " · " + stats.city : ""}</div>
              <canvas ref={mapRef} style={{ display: "block", width: "100%", background: "#0a121d" }} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "12px 14px", borderTop: "1px solid #1e2836" }}>
                <button style={btnPri} onClick={newHero} disabled={!loaded}>↻ Новый рейс</button>
                <button style={btn} onClick={() => { runningRef.current = !runningRef.current; setPlaying(runningRef.current); }}>{playing ? "⏸ Пауза" : "▶ Пуск"}</button>
                <button style={btn} onClick={() => { for (let i = 0; i < 3; i++) { const t = makeTaxi(false); if (t) taxisRef.current.push(t); } }}>＋ Трафик</button>
                <button style={btn} onClick={() => { showColorRef.current = !showColorRef.current; }}>Высотная раскраска</button>
              </div>
              {meta && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 14, padding: "0 14px 12px", fontFamily: "monospace", fontSize: 11, color: "#9fb0c4" }}>
                  <span>🌬 ветер {meta.wind}</span>
                  <span style={{ color: "#fb7185" }}>⛔ запретных зон: {meta.nofly}</span>
                  <span style={{ color: "#2dd4bf" }}>🔏 Ed25519 · {meta.signed}…</span>
                  <DataProvenanceChip compact dataQuality={meta.dq} labels={{ unit: "зданий" }} />
                  <span>площадки: <span style={{ color: "#2dd4bf" }}>●</span> годна · <span style={{ color: "#fbbf24" }}>●</span> нужна инфра · <span style={{ color: "#fb7185" }}>●</span> непригодна · <span style={{ color: "#c8964f" }}>▨</span> высота угадана</span>
                </div>
              )}
            </section>

            <aside style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <section style={card}>
                <div style={cardH}>Профиль высот рейса</div>
                <canvas ref={profRef} style={{ display: "block", width: "100%", height: 190, background: "#0a121d" }} />
              </section>
              <section style={card}>
                <div style={cardH}>Телеметрия</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "#1e2836" }}>
                  {[
                    ["Дистанция", stats.distKm + " км"],
                    ["Крейсер. высота", stats.cruiseAlt + " м"],
                    ["Расч. время", stats.eta + " мин"],
                    ["Разведено бортов", String(stats.conflicts)],
                  ].map(([k, v]) => (
                    <div key={k} style={{ background: "#0e141f", padding: "12px 14px" }}>
                      <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#5f7086" }}>{k}</div>
                      <div style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 600 }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: "12px 14px", borderTop: "1px solid #1e2836" }}>
                  <button style={btnPri} onClick={bookSlot} disabled={!loaded}>Забронировать слот (QRight)</button>
                  {booking && <div style={{ marginTop: 10, fontFamily: "monospace", fontSize: 11, color: booking.startsWith("✓") ? "#2dd4bf" : "#fb7185", wordBreak: "break-all" }}>{booking}</div>}
                </div>
              </section>

              {vpRows.length > 0 && (
                <section style={card}>
                  <div style={cardH}>Пригодность площадок · {vpRows.length}</div>
                  <div style={{ maxHeight: 220, overflowY: "auto" }}>
                    {vpRows.map((v) => (
                      <div key={v.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 14px", borderTop: "1px solid #1e2836", fontFamily: "monospace", fontSize: 11.5 }}>
                        <span style={{ color: "#9fb0c4" }}>{v.id}</span>
                        <span style={{ color: VP_CLASS_COLOR[v.cls] ?? "#5f7086" }}>{VP_CLASS_LABEL[v.cls] ?? "не оценена"} · {v.suitability}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: "8px 14px", borderTop: "1px solid #1e2836", fontSize: 10.5, color: "#5f7086" }}>
                    Алгоритмические кандидаты по открытому радиусу и просвету — не утверждённые муниципальные площадки.
                  </div>
                </section>
              )}

              <section style={card}>
                <div style={cardH}>Рынок 4D-слотов (QRight) · {slots.count}{slots.store ? " · " + slots.store : ""}</div>
                {slots.list.length === 0 ? (
                  <div style={{ padding: "12px 14px", fontSize: 12, color: "#5f7086" }}>Слотов пока не забронировано.</div>
                ) : (
                  <div style={{ maxHeight: 220, overflowY: "auto" }}>
                    {[...slots.list].reverse().slice(0, 20).map((s) => (
                      <div key={s.id} style={{ padding: "8px 14px", borderTop: "1px solid #1e2836", fontFamily: "monospace", fontSize: 11 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#9fb0c4" }}>
                          <span>{s.id}</span><span>{s.holder}</span>
                        </div>
                        <div style={{ color: "#5f7086", fontSize: 10.5, wordBreak: "break-all" }}>{s.routeId} · {s.receipt}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ padding: "8px 14px", borderTop: "1px solid #1e2836", fontSize: 10.5, color: "#5f7086" }}>
                  Ёмкость на маршрут: {slots.capacityPerRoute || "—"}. Право фиксируется SHA-256-якорем (receipt).
                </div>
              </section>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
