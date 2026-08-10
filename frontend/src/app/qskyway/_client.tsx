"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { apiUrl } from "@/lib/apiBase";
import { useI18n } from "@/lib/i18n";
import { DataProvenanceChip } from "@/components/DataProvenanceChip";
import { RegulatorySourceChip } from "@/components/RegulatorySourceChip";
import { CompetitorMatrix } from "@/components/CompetitorMatrix";
import { competitorsFor } from "@/lib/competitors";
import type { DataQuality } from "@/lib/dataQuality";
import type { RegulatorySource } from "@/lib/regulatorySource";
import { resolveStartCity } from "./startCity";

// QSkyway — навигационный слой городского неба для аэротакси.
// Клиент рисует реальный цифровой двойник Астаны (318 зданий из OpenStreetMap,
// поле высот 20 м из /api/qskyway/city), автогенерирует 3D-коридоры (A* с
// раскладкой по высотным полосам) и бронирует 4D-слот прав через /api/qskyway/slots.
// Честно: движок и доказательство концепции, не сертифицированное авиационное ПО.

interface NoFly { id: string; name: string; kind: string; x: number; y: number; radiusM: number; }
/** Published regulatory ceiling feed for the city — absent where no open feed exists. */
interface AirspaceSummary {
  available: boolean;
  authority?: string;
  source?: string;
  regime?: string;
  effective?: string;
  cells?: number;
  coveragePct?: number;
  minCeilingM?: number | null;
  maxCeilingM?: number | null;
  zeroCeilingCells?: number;
  note?: string;
  freshness?: { checked: boolean; upToDate: boolean | null; publishedEffective: string | null; cellsChanged: number; checkedAt: string | null };
  /** a regulator gate on the operation, published separately from any ceiling */
  permission?: { available: boolean; authority?: string; regime?: string; kind?: "permission" | "prohibition"; basis?: string; effective?: string; sampled?: string; coveragePct?: number; uniform?: boolean; note?: string; provenanceNote?: string };
  _signature?: { alg: string; contentHash: string };
}
/** Per-route verdict against that ceiling. compliant=null → no feed, no verdict. */
interface AirspaceCompliance {
  available: boolean;
  compliant: boolean | null;
  exceedingSegments: number;
  zeroCeilingSegments: number;
  maxExceedanceM: number;
  lowestCeilingM: number | null;
  note: string;
}
interface CityData {
  city: string;
  meters: { w: number; h: number };
  grid: { cols: number; rows: number; cell: number; heights: number[]; src?: number[] };
  buildings: { h: number; hs?: number; r: number[][] }[];
  vertiports: { c: number; r: number; x: number; y: number }[];
  nofly?: NoFly[];
  wind?: { fromDeg: number; groundMs: number; topMs: number; source?: "metar" | "illustrative" };
  airspace?: AirspaceSummary;
  vertiportScores?: { c: number; r: number; suitability: number; class: string; openRadiusM: number; clearanceM: number; distNoFlyM: number; ceilingM?: number | null; needsAtcCoordination?: boolean }[];
  /** QSkyway-specific: heights the generator flagged as towering over the rest
   *  of the city. Kept out of the shared DataQuality type on purpose — other
   *  modules do not have an obstacle grid, and a wrong height only matters
   *  because hs=0 buys zero safety clearance. */
  dataQuality?: DataQuality & { suspect?: { i: number; h: number; why?: string; times?: number; was?: number; levels?: number }[] };
  _signature?: { alg: string; contentHash: string };
}
/** The filing document /route/justification returns, signed as one unit. */
interface JustDoc {
  kind: string; city: string; from: number; to: number; respectCeiling: boolean;
  distanceKm: number; cruiseAltM: number; etaMinWind: number;
  twinContentHash: string; windSource: string; heightConfidencePct: number; issuedAt: string;
  airspace: null | { authority: string; source: string; regime: string; effective: string; contentHash: string | null; compliant: boolean | null; exceedingSegments: number; maxExceedanceM: number; lowestCeilingM: number | null };
}
interface JustAttestation { alg: string; contentHash: string; signature: string; publicKey: string; ephemeral: boolean }
interface Cell { c: number; r: number; }
interface Taxi { path: Cell[]; alts: number[]; seg: number; u: number; speed: number; hero: boolean; slow: number; }
interface VertiportRow { id: string; suitability: number; cls: string; openRadiusM: number | null; clearanceM: number | null; distNoFlyM: number | null; ceilingM: number | null; needsAtc: boolean; }
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

/** Map the backend's airspace block onto the platform-wide regulatory vocabulary. */
function airspaceRegSource(a: AirspaceSummary | undefined): RegulatorySource {
  if (!a?.available) {
    // No ceiling grid does not mean no regulator. Tokyo publishes no altitudes
    // but governs every flight over the twin, and calling that "no source"
    // would understate the regulator, not just our coverage.
    const perm = a?.permission;
    if (perm?.available) {
      return {
        tier: "official",
        authority: perm.authority,
        // The statute text is long; it belongs in the tooltip, not wrapping
        // across the toolbar. The chip line answers "whose rule", the hover
        // answers "which rule".
        effective: perm.effective,
        scopeNote: [perm.regime, perm.note, perm.provenanceNote].filter(Boolean).join(" "),
        upToDate: null,
        // Астана и Токио стоят не на фиде, а на документе: eAIP цикла AIRAC и
        // растровый слой ведомства. Опрашивать нечего, поэтому «сверка ещё не
        // выполнялась» обещало бы проверку, которой не бывает. Честно —
        // назвать природу источника и дату последней ручной сверки.
        noLiveFeed: true,
        lastReviewed: perm.sampled,
        attested: false,
      };
    }
    return { tier: "none", scopeNote: a?.note };
  }
  const range = a.minCeilingM != null && a.maxCeilingM != null ? ` ${a.minCeilingM}–${a.maxCeilingM} м` : "";
  return {
    tier: "official",
    authority: a.authority,
    title: (a.source ?? "") + range,
    effective: a.effective,
    scopeNote: a.regime ? `${a.regime} — не сертификация аэротакси` : undefined,
    upToDate: a.freshness?.checked ? a.freshness.upToDate : null,
    // Редакция, которую регулятор публикует ПРЯМО СЕЙЧАС. Отличается от нашей,
    // когда карту переиздали без изменения потолков: маршрут по-прежнему верен,
    // но говорить «снимок совпадает с тем, что публикует регулятор» уже нельзя.
    // Живая сверка 10.08.2026: снимок 7/9/2026, фид публикует 8/6/2026, ноль
    // изменённых ячеек.
    publishedEffective: a.freshness?.checked ? a.freshness.publishedEffective : null,
    attested: Boolean(a._signature),
  };
}

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
  const { t } = useI18n();
  const mapRef = useRef<HTMLCanvasElement | null>(null);
  const profRef = useRef<HTMLCanvasElement | null>(null);
  const cityRef = useRef<CityData | null>(null);
  const cityIdRef = useRef<string>("astana");
  const taxisRef = useRef<Taxi[]>([]);
  const heroRef = useRef<Taxi | null>(null);
  const rafRef = useRef<number>(0);
  const runningRef = useRef<boolean>(true);
  const conflictsRef = useRef<number>(0);
  const showColorRef = useRef<boolean>(true);
  const altMaxRef = useRef<number>(260);

  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [stats, setStats] = useState({ distKm: 0, cruiseAlt: 0, eta: 0, conflicts: 0, city: "", buildings: 0, corridors: 0, heightConfidencePct: null as number | null, avgConfClearM: null as number | null, etaStill: null as number | null });
  const [booking, setBooking] = useState<string>("");
  const [playing, setPlaying] = useState(true);
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [coverage, setCoverage] = useState<{ withFeed: number; total: number; missing: string[]; withCeilings?: number; withPermissionRegime?: number } | null>(null);
  const [impact, setImpact] = useState<{ compliant: number; pairs: number; compliantPct: number; strictRoutable: number; padsNeedingAtc: number; authority: string; note: string } | null>(null);
  const [cityId, setCityId] = useState<string>("astana");
  const [meta, setMeta] = useState<{ wind: string; windSource: "metar" | "illustrative"; signed: string; nofly: number; heightPct: number; realPct: number; dq?: DataQuality; suspect: { i: number; h: number; why?: string; times?: number; was?: number; levels?: number }[]; airspace?: AirspaceSummary } | null>(null);
  // Strict mode asks the backend to treat the published ceiling as a hard
  // constraint instead of an advisory verdict. Off by default: the honest
  // default is "fly the corridor and tell me what it would require".
  const [strictCeiling, setStrictCeiling] = useState(false);
  const strictRef = useRef(false);
  const [airspaceRoute, setAirspaceRoute] = useState<AirspaceCompliance | null>(null);
  const [ceilingBlocked, setCeilingBlocked] = useState<string | null>(null);
  const [heroPair, setHeroPair] = useState<{ from: number; to: number } | null>(null);
  const [justification, setJustification] = useState<{ doc: JustDoc; attestation: JustAttestation; scope: string } | null>(null);
  const [justState, setJustState] = useState<"idle" | "busy" | "verified" | "invalid">("idle");
  const [vpRows, setVpRows] = useState<VertiportRow[]>([]);
  const [slots, setSlots] = useState<{ list: Slot[]; count: number; capacityPerRoute: number; store: string }>({ list: [], count: 0, capacityPerRoute: 0, store: "" });
  const [verify, setVerify] = useState<"idle" | "checking" | "valid" | "invalid">("idle");

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

  const heroBusyRef = useRef(false);
  const localHero = useCallback(() => {
    const t = makeTaxi(true);
    if (!t) return;
    heroRef.current = t;
    const city = cityRef.current!;
    const distKm = t.alts.length * city.grid.cell / 1000;
    const cruise = t.alts.reduce((m, v) => Math.max(m, v), 0);
    setStats((s) => ({ ...s, distKm: +distKm.toFixed(2), cruiseAlt: Math.round(cruise), eta: +((distKm / 90) * 60).toFixed(1), heightConfidencePct: null, avgConfClearM: null, etaStill: null }));
  }, [makeTaxi]);

  // ── hero route: real backend A* (obeys no-fly + wind ETA), falls back to
  // local astar() above if the network call fails ─────────────────────────────
  const newHero = useCallback(async () => {
    const city = cityRef.current;
    if (!city || heroBusyRef.current) return;
    heroBusyRef.current = true;
    try {
      const n = city.vertiports.length;
      if (n < 2) throw new Error("недостаточно вертипортов");
      const from = Math.floor(Math.random() * n);
      let to = from; while (to === from) to = Math.floor(Math.random() * n);
      // strictRef, not the state value — newHero is held by the animation loop,
      // so reading state here would freeze whatever was set at mount (same
      // stale-closure trap cityIdRef already guards against).
      const res = await fetch(apiUrl("/api/qskyway/route"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, city: cityIdRef.current, respectCeiling: strictRef.current }),
      });
      if (res.status === 422) {
        const j = await res.json().catch(() => ({}));
        if (j.reason === "airspace-ceiling") {
          // Not an error to swallow: this IS the answer — the corridor exists but
          // needs ATC coordination. Show it instead of silently faking a route.
          setCeilingBlocked(`H-${from + 1} → H-${to + 1}: ${j.note ?? "нет коридора в пределах опубликованного потолка"}`);
          setAirspaceRoute(j.airspaceIfUnrestricted ?? null);
          heroRef.current = null;
          setHeroPair(null);
          setJustification(null);
          setJustState("idle");
          // There is no flight — leaving the previous route's telemetry on screen
          // next to a "refused" banner would read as if those numbers described it.
          setStats((s) => ({ ...s, distKm: 0, cruiseAlt: 0, eta: 0, heightConfidencePct: null, avgConfClearM: null, etaStill: null }));
          return;
        }
      }
      if (!res.ok) throw new Error("route " + res.status);
      const r = await res.json();
      setCeilingBlocked(null);
      setAirspaceRoute(r.airspace ?? null);
      setHeroPair({ from, to });
      // A justification describes one specific flight. Carrying the previous
      // one over to a new route would attach a signed document to the wrong trip.
      setJustification(null);
      setJustState("idle");
      heroRef.current = { path: r.path, alts: r.alts, seg: 0, u: 0, speed: 1.1 + Math.random() * 0.5, hero: true, slow: 0 };
      setStats((s) => ({ ...s, distKm: r.distanceKm, cruiseAlt: Math.round(r.cruiseAltM), eta: r.etaMinWind, heightConfidencePct: r.heightConfidencePct ?? null, avgConfClearM: r.avgConfClearM ?? null, etaStill: r.etaMinStill ?? null }));
    } catch {
      setCeilingBlocked(null);
      setAirspaceRoute(null);
      localHero();
    } finally {
      heroBusyRef.current = false;
    }
  }, [localHero]);

  // ── city loading (switchable) ─────────────────────────────────────────────────
  const loadCity = useCallback(async (id: string) => {
    cityIdRef.current = id;
    setLoaded(false); setErr(null); setVerify("idle");
    setAirspaceRoute(null); setCeilingBlocked(null); setImpact(null);
    // Measured server-side across every pair, never typed in by hand: the whole
    // point of this figure is that it comes from the same engine the routes do.
    fetch(apiUrl(`/api/qskyway/airspace/impact?city=${encodeURIComponent(id)}`))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setImpact(j?.available ? j : null))
      .catch(() => setImpact(null));
    try {
      const res = await fetch(apiUrl(`/api/qskyway/city?city=${encodeURIComponent(id)}`));
      if (!res.ok) throw new Error("city " + res.status);
      const city: CityData = await res.json();
      cityRef.current = city;
      taxisRef.current = []; heroRef.current = null; conflictsRef.current = 0;
      let mh = 0; for (const h of city.grid.heights) if (h > mh) mh = h;
      altMaxRef.current = FLOOR + Math.ceil((mh + CLEAR - FLOOR) / BAND) * BAND + BAND;
      const cols = Math.floor(city.grid.cols / 3), rows = Math.floor(city.grid.rows / 3);
      setStats({ distKm: 0, cruiseAlt: 0, eta: 0, conflicts: 0, city: city.city, buildings: city.buildings.length, corridors: cols * rows * 2, heightConfidencePct: null, avgConfClearM: null, etaStill: null });
      setMeta({
        wind: city.wind ? `${city.wind.groundMs}→${city.wind.topMs} м/с (от ${city.wind.fromDeg}°)` : "—",
        windSource: city.wind?.source ?? "illustrative",
        signed: city._signature ? city._signature.contentHash.slice(0, 12) : "—",
        nofly: city.nofly?.length ?? 0,
        heightPct: city.dataQuality?.measuredPct ?? 0,
        realPct: city.dataQuality?.realPct ?? 0,
        dq: city.dataQuality,
        suspect: city.dataQuality?.suspect ?? [],
        airspace: city.airspace,
      });
      type VpScore = NonNullable<CityData["vertiportScores"]>[number];
      const scoreOf = new Map<string, VpScore>();
      for (const s of city.vertiportScores ?? []) scoreOf.set(s.c + "," + s.r, s);
      setVpRows(city.vertiports.map((v, i) => {
        const s = scoreOf.get(v.c + "," + v.r);
        return {
          id: `H-${i + 1}`, suitability: s?.suitability ?? 0, cls: s?.class ?? "unscored",
          openRadiusM: s?.openRadiusM ?? null, clearanceM: s?.clearanceM ?? null, distNoFlyM: s?.distNoFlyM ?? null,
          ceilingM: s?.ceilingM ?? null, needsAtc: s?.needsAtcCoordination === true,
        };
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
        if (r.ok) {
          const j = await r.json();
          setCities((j.cities ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
          if (j.airspaceCoverage) setCoverage(j.airspaceCoverage);
        }
      } catch { /* selector optional */ }
      // `?city=` из адреса. До 10.08.2026 здесь стояло жёсткое "astana", и
      // ссылка вида /qskyway?city=nyc открывала Астану молча — при том что
      // бэкенд параметр поддерживает, и именно такой ссылкой естественно
      // поделиться. Незнакомый город не подменяем: пусть загрузка упрётся в 404
      // и страница скажет об этом, а не покажет чужой город под чужой ссылкой.
      const start = resolveStartCity(typeof window === "undefined" ? "" : window.location.search);
      setCityId(start);
      loadCity(start);
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
    if (t.seg >= t.path.length - 1) {
      if (t.hero) { newHero(); return; }
      const n = makeTaxi(t.hero); if (n) { Object.assign(t, n); }
      return;
    }
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

  // ── verify the displayed twin signature end-to-end (real Ed25519 check,
  // not just trusting the hash the city payload already carries) ────────────
  const verifySignature = useCallback(async () => {
    setVerify("checking");
    try {
      const res = await fetch(apiUrl(`/api/qskyway/verify?city=${encodeURIComponent(cityIdRef.current)}`));
      const j = await res.json();
      setVerify(res.ok && j.valid === true ? "valid" : "invalid");
    } catch { setVerify("invalid"); }
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

  // ── filing document ────────────────────────────────────────────────────────
  const requestJustification = useCallback(async () => {
    if (!heroPair) return;
    setJustState("busy");
    try {
      const res = await fetch(apiUrl("/api/qskyway/route/justification"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...heroPair, city: cityIdRef.current, respectCeiling: strictRef.current }),
      });
      if (!res.ok) throw new Error("justification " + res.status);
      const j = await res.json();
      setJustification({ doc: j.document, attestation: j.attestation, scope: j.scope });
      setJustState("idle");
    } catch { setJustState("idle"); setJustification(null); }
  }, [heroPair]);

  // Verification runs against the backend, not in the browser: a document that
  // only ever checks itself locally proves nothing to the person receiving it.
  const verifyJustification = useCallback(async () => {
    if (!justification) return;
    setJustState("busy");
    try {
      const res = await fetch(apiUrl("/api/qskyway/route/justification/verify"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document: justification.doc, attestation: justification.attestation }),
      });
      const j = await res.json();
      setJustState(j?.valid === true ? "verified" : "invalid");
    } catch { setJustState("invalid"); }
  }, [justification]);

  const downloadJustification = useCallback(() => {
    if (!justification) return;
    const payload = JSON.stringify(
      { document: justification.doc, attestation: justification.attestation, scope: justification.scope },
      null, 2,
    );
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `qskyway-justification-${justification.doc.city}-${justification.doc.from}-${justification.doc.to}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [justification]);

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
          3D-аэрокоридоры и авто-навигация для аэротакси поверх реального цифрового двойника города.
          Здания — OpenStreetMap, ограничения — из публикаций самих регуляторов там, где они существуют.
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

        {/* Two of three cities have no regulator feed. Left unexplained that reads
            as unfinished work; stated plainly it is the actual finding — the US
            publishes low-altitude limits machine-readably and most of the world
            does not, so no provider can obey them there yet. */}
        {coverage && (
          <div style={{ margin: "0 0 16px", padding: "10px 13px", borderRadius: 8, background: "#0e141f", border: "1px solid #1e2836", fontSize: 12.5, color: "#9fb0c4", lineHeight: 1.5 }}>
            <span style={{ color: "#22d3ee", fontFamily: "monospace" }}>
              🛂 {t("qskyway.coverage.head", { withFeed: coverage.withFeed, total: coverage.total })}
            </span>{" "}
            {coverage.missing.length === 0
              ? t("qskyway.coverage.full", {
                  ceilings: coverage.withCeilings ?? 0,
                  regimes: coverage.withPermissionRegime ?? 0,
                })
              : t("qskyway.coverage.body", {
                  missing: coverage.missing
                    .map((id) => cities.find((c) => c.id === id)?.name.split(" — ")[0] ?? id)
                    .join(", "),
                })}
          </div>
        )}

        {/* The strongest thing this module can say about a city, and it was
            computed nowhere until now: how much of the network the published
            ceiling actually rules out. */}
        {impact && (
          <div style={{ margin: "0 0 16px", padding: "12px 14px", borderRadius: 8, background: "#0e141f", border: "1px solid #1e2836" }}>
            <div style={{ fontFamily: "monospace", fontSize: 13, color: "#e8eef7" }}>
              <span style={{ color: impact.compliantPct >= 50 ? "#fbbf24" : "#fb7185", fontSize: 17, fontWeight: 700 }}>
                {impact.compliant} / {impact.pairs}
              </span>{" "}
              {t("qskyway.impact.head", { authority: impact.authority })}
            </div>
            <div style={{ fontSize: 12, color: "#9fb0c4", marginTop: 5, lineHeight: 1.5 }}>
              {t("qskyway.impact.body", { strict: impact.strictRoutable, pairs: impact.pairs, pads: impact.padsNeedingAtc })}
            </div>
          </div>
        )}

        {err && <div style={{ ...card, padding: 16, color: "#fb7185" }}>Не удалось загрузить город: {err}. Проверь, что бэкенд поднят (/api/qskyway/city).</div>}

        {!err && (
          <div className="qsky-grid" style={{ display: "grid", gap: 14 }}>
            <style>{`.qsky-grid { grid-template-columns: 1fr; } @media (min-width: 900px) { .qsky-grid { grid-template-columns: 1.55fr 1fr; } }`}</style>
            <section style={card}>
              <div style={cardH}>Аэрокарта · реальные здания{stats.city ? " · " + stats.city : ""}</div>
              {/*
                Пока город грузится, страница выглядела ТОЧНО как сломанная:
                пустая чёрная карта и нули в телеметрии, без единого признака,
                что что-то происходит. Ошибку она показывает честно (красная
                карточка выше), а загрузку не показывала никак — и отличить одно
                от другого было нельзя. Соседние страницы платформы (например
                /pricing) в этот момент прямо пишут «загружаю». Здесь — то же
                самое, и с указанием, какой именно город грузим: при переходе
                между городами это единственный признак, что клик сработал.
              */}
              {!loaded && (
                <div
                  role="status"
                  aria-live="polite"
                  style={{
                    padding: "10px 14px", fontSize: 12, color: "#9fb0c4",
                    borderBottom: "1px solid #1e2836", fontFamily: "monospace",
                  }}
                >
                  Загружаю город: {cityId} — здания, сетка высот и правила регулятора…
                </div>
              )}
              <canvas ref={mapRef} style={{ display: "block", width: "100%", background: "#0a121d" }} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "12px 14px", borderTop: "1px solid #1e2836" }}>
                <button style={btnPri} onClick={newHero} disabled={!loaded}>↻ Новый рейс</button>
                <button style={btn} onClick={() => { runningRef.current = !runningRef.current; setPlaying(runningRef.current); }}>{playing ? "⏸ Пауза" : "▶ Пуск"}</button>
                <button style={btn} onClick={() => { for (let i = 0; i < 3; i++) { const t = makeTaxi(false); if (t) taxisRef.current.push(t); } }}>＋ Трафик</button>
                <button style={btn} onClick={() => { showColorRef.current = !showColorRef.current; }}>Высотная раскраска</button>
                <button
                  style={strictCeiling ? { ...btn, borderColor: "#2dd4bf", color: "#2dd4bf" } : btn}
                  disabled={!meta?.airspace?.available}
                  title={meta?.airspace?.available
                    ? "Строгий режим: маршрут строится только в пределах опубликованного потолка регулятора. Часть пар площадок станет недостижимой — это и есть реальная картина допусков."
                    : "Для этого города нет открытого фида регулятора — строгий режим неприменим."}
                  onClick={() => { const v = !strictCeiling; setStrictCeiling(v); strictRef.current = v; newHero(); }}
                >
                  {strictCeiling ? "🛂 Строго по потолку: вкл" : "🛂 Строго по потолку: выкл"}
                </button>
              </div>
              {ceilingBlocked && (
                <div style={{ margin: "0 14px 12px", padding: "10px 12px", borderRadius: 8, background: "#2a1620", border: "1px solid #7f2f42", fontSize: 12, color: "#fda4af" }}>
                  🛂 {ceilingBlocked}
                </div>
              )}
              {meta && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 14, padding: "0 14px 12px", fontFamily: "monospace", fontSize: 11, color: "#9fb0c4" }}>
                  <span>
                    🌬 ветер {meta.wind}
                    <span
                      title={meta.windSource === "metar" ? "Наземный ветер — реальный METAR ближайшего аэропорта" : "METAR недоступен — используется иллюстративная демо-модель"}
                      style={{ marginLeft: 6, color: meta.windSource === "metar" ? "#2dd4bf" : "#5f7086" }}
                    >
                      · {meta.windSource === "metar" ? "METAR" : "демо"}
                    </span>
                  </span>
                  {/* Two chips, deliberately side by side: the ceiling layer is a real
                      regulator publication, the point zones are still ours. Showing
                      them under one badge would launder the second into the first. */}
                  <RegulatorySourceChip
                    // A prohibition labelled "permission regime" would read as
                    // "you may fly if you ask" where the rule is "you may not
                    // fly" — the one distinction the data layer keeps separate,
                    // so the label must keep it too.
                    subject={meta.airspace?.available
                      ? t("qskyway.reg.subject.ceilings")
                      : meta.airspace?.permission?.available
                        ? t(meta.airspace.permission.kind === "prohibition"
                            ? "qskyway.reg.subject.prohibition"
                            : "qskyway.reg.subject.permission")
                        : t("qskyway.reg.subject.ceilings")}
                    source={airspaceRegSource(meta.airspace)}
                    labels={{ none: t("qskyway.reg.nofeed") }}
                  />
                  <RegulatorySourceChip
                    subject={`${t("qskyway.reg.subject.zones")} (${meta.nofly})`}
                    source={{
                      tier: "illustrative",
                      scopeNote: t("qskyway.reg.zones.scope"),
                    }}
                  />
                  <span
                    onClick={verify === "checking" ? undefined : verifySignature}
                    title="Проверить подпись двойника на бэкенде (GET /verify)"
                    style={{
                      cursor: verify === "checking" ? "wait" : "pointer",
                      textDecoration: "underline dotted",
                      color: verify === "valid" ? "#2dd4bf" : verify === "invalid" ? "#fb7185" : "#2dd4bf",
                    }}
                  >
                    🔏 Ed25519 · {meta.signed}…
                    {verify === "checking" && " · проверка…"}
                    {verify === "valid" && " · ✓ подпись верна"}
                    {verify === "invalid" && " · ✗ проверка не прошла"}
                  </span>
                  <DataProvenanceChip compact dataQuality={meta.dq} labels={{ unit: "зданий" }} />
                  {meta.suspect.length > 0 && (
                    <span
                      title={
                        "Высоту из источника мы не считаем достоверной. Либо она в разы выше всей остальной " +
                        "застройки, либо тег высоты спорит с числом этажей в том же источнике. " +
                        "Молча мы ничего не переписываем: где источник противоречит сам себе, берём его же счёт " +
                        "этажей вместо спорной высоты, а где высота просто выделяется — оставляем как " +
                        "опубликовано и показываем расхождение. Страховочный запас коридор получает в обоих " +
                        "случаях: высота из OpenStreetMap — заявление участника проекта, а не обмер службы."
                      }
                      style={{ color: "#fbbf24", textDecoration: "underline dotted", cursor: "help" }}
                    >
                      ⚠ высота под вопросом:{" "}
                      {meta.suspect
                        .map((o) =>
                          o.was !== undefined
                            // источник спорит сам с собой: тег высоты против собственного счёта этажей
                            ? `${o.h} м вместо ${o.was} м — тег спорит с ${o.levels} этажами`
                            // высота, которая в разы выше всей остальной застройки
                            : `${o.h} м — ×${o.times} к застройке`,
                        )
                        .join(" · ")}
                    </span>
                  )}
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
                  {([
                    ["Дистанция", stats.distKm + " км"],
                    ["Крейсер. высота", stats.cruiseAlt + " м"],
                    ["Расч. время", stats.etaStill == null ? stats.eta + " мин" : (
                      <>
                        {stats.eta} мин
                        <span style={{ fontSize: 11, fontWeight: 400, color: "#5f7086", marginLeft: 5 }}>
                          ({stats.eta - stats.etaStill >= 0 ? "+" : ""}{(stats.eta - stats.etaStill).toFixed(2)} ветер)
                        </span>
                      </>
                    )],
                    ["Разведено бортов", String(stats.conflicts)],
                    ["Увер. высоты (маршрут)", stats.heightConfidencePct == null ? "—" : stats.heightConfidencePct + "%"],
                    ["Запас на неувер-ть", stats.avgConfClearM == null ? "—" : stats.avgConfClearM + " м"],
                  ] as [string, React.ReactNode][]).map(([k, v]) => (
                    <div key={k} style={{ background: "#0e141f", padding: "12px 14px" }}>
                      <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#5f7086" }}>{k}</div>
                      <div style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 600 }}>{v}</div>
                    </div>
                  ))}
                </div>
                {airspaceRoute?.available && (
                  <div style={{ padding: "10px 14px", borderTop: "1px solid #1e2836", fontFamily: "monospace", fontSize: 11, color: airspaceRoute.compliant ? "#2dd4bf" : "#fbbf24" }}>
                    {/* When the flight was refused, this verdict describes the corridor
                        an unrestricted flight would have needed — say so, don't let it
                        read as the current route. */}
                    {ceilingBlocked && <span style={{ color: "#5f7086" }}>без ограничения потолком: </span>}
                    🛂 {airspaceRoute.compliant ? "в пределах потолка регулятора" : `выше потолка на ${airspaceRoute.maxExceedanceM} м · участков ${airspaceRoute.exceedingSegments}`}
                    {airspaceRoute.lowestCeilingM != null && (
                      <span style={{ color: "#5f7086" }}> · мин. потолок по трассе {airspaceRoute.lowestCeilingM} м</span>
                    )}
                    <div style={{ color: "#5f7086", fontSize: 10.5, marginTop: 3, whiteSpace: "normal" }}>{airspaceRoute.note}</div>
                  </div>
                )}
                <div style={{ padding: "12px 14px", borderTop: "1px solid #1e2836" }}>
                  <button style={btnPri} onClick={bookSlot} disabled={!loaded}>Забронировать слот (QRight)</button>
                  {booking && <div style={{ marginTop: 10, fontFamily: "monospace", fontSize: 11, color: booking.startsWith("✓") ? "#2dd4bf" : "#fb7185", wordBreak: "break-all" }}>{booking}</div>}

                  {/* The filing document. Until now it existed only as an endpoint,
                      which is the same as not existing for the person who has to
                      justify a flight. */}
                  <div style={{ marginTop: 12, borderTop: "1px solid #1e2836", paddingTop: 12 }}>
                    {!justification ? (
                      <button style={btn} onClick={requestJustification} disabled={!heroPair || justState === "busy"}>
                        {justState === "busy" ? "…" : t("qskyway.just.build")}
                      </button>
                    ) : (
                      <div style={{ fontFamily: "monospace", fontSize: 11, color: "#9fb0c4" }}>
                        <div style={{ color: "#2dd4bf" }}>
                          📄 {t("qskyway.just.ready")} · H-{justification.doc.from + 1} → H-{justification.doc.to + 1}
                        </div>
                        <div style={{ color: "#5f7086", marginTop: 3, wordBreak: "break-all" }}>
                          sha256 {justification.attestation.contentHash.slice(0, 24)}…
                        </div>
                        {justification.doc.airspace && (
                          <div style={{ marginTop: 3, color: justification.doc.airspace.compliant ? "#2dd4bf" : "#fbbf24" }}>
                            {justification.doc.airspace.authority} · {justification.doc.airspace.effective} ·{" "}
                            {justification.doc.airspace.compliant ? t("qskyway.just.within") : t("qskyway.just.above")}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                          <button style={btn} onClick={downloadJustification}>{t("qskyway.just.download")}</button>
                          <button style={btn} onClick={verifyJustification} disabled={justState === "busy"}>
                            {justState === "verified" ? "✓ " + t("qskyway.just.verified")
                              : justState === "invalid" ? "✗ " + t("qskyway.just.invalid")
                              : t("qskyway.just.verify")}
                          </button>
                        </div>
                        <div style={{ marginTop: 8, color: "#5f7086", fontSize: 10.5, whiteSpace: "normal", lineHeight: 1.45 }}>
                          {justification.scope}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {vpRows.length > 0 && (
                <section style={card}>
                  <div style={cardH}>Пригодность площадок · {vpRows.length}</div>
                  <div style={{ maxHeight: 220, overflowY: "auto" }}>
                    {vpRows.map((v) => (
                      <div key={v.id} style={{ padding: "8px 14px", borderTop: "1px solid #1e2836", fontFamily: "monospace", fontSize: 11.5 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ color: "#9fb0c4" }}>{v.id}</span>
                          <span style={{ color: VP_CLASS_COLOR[v.cls] ?? "#5f7086" }}>{VP_CLASS_LABEL[v.cls] ?? "не оценена"} · {v.suitability}</span>
                        </div>
                        {v.openRadiusM != null && (
                          <div style={{ color: "#5f7086", fontSize: 10, marginTop: 2 }}>
                            откр. радиус {v.openRadiusM}м · просвет {v.clearanceM}м · до запретной зоны {v.distNoFlyM! >= 9999 ? "—" : v.distNoFlyM + "м"}
                            {v.ceilingM != null && <> · потолок {v.ceilingM}м</>}
                          </div>
                        )}
                        {v.needsAtc && (
                          <div style={{ color: "#fda4af", fontSize: 10, marginTop: 2 }} title="В этой ячейке регулятор не даёт автоматического допуска (потолок 0 ft) — вылет только по координации с УВД.">
                            🛂 нужна координация с УВД — автоматического допуска нет
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: "8px 14px", borderTop: "1px solid #1e2836", fontSize: 10.5, color: "#5f7086" }}>
                    Алгоритмические кандидаты по открытому радиусу и просвету — не утверждённые муниципальные площадки.
                  </div>
                </section>
              )}

              <section style={card}>
                <div style={{ ...cardH, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span>Рынок 4D-слотов (QRight) · {slots.count}</span>
                  {slots.store && (
                    <span style={{ color: slots.store === "postgres" ? "#2dd4bf" : "#fbbf24", textTransform: "none", letterSpacing: 0 }} title={slots.store === "postgres" ? "Слоты сохраняются в Postgres — переживут рестарт" : "Слоты только в памяти процесса — теряются при рестарте бэкенда"}>
                      {slots.store === "postgres" ? "● persist" : "● ephemeral"}
                    </span>
                  )}
                </div>
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

        {/* Сравнение с аналогами — часть демо, а не отдельная страница: тот, кто
            смотрит на маршруты, тут же видит, чем это отличается от UTM-провайдера
            и где мы объективно слабее. */}
        {competitorsFor("qskyway") && (
          <div style={{ marginTop: 18 }}>
            <CompetitorMatrix set={competitorsFor("qskyway")!} />
          </div>
        )}
      </div>
    </div>
  );
}
