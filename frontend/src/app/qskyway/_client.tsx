"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { apiUrl } from "@/lib/apiBase";
import { useI18n } from "@/lib/i18n";
import { DataProvenanceChip } from "@/components/DataProvenanceChip";
import { RegulatorySourceChip } from "@/components/RegulatorySourceChip";
import { CompetitorMatrix } from "@/components/CompetitorMatrix";
import WaitlistCapture from "@/components/WaitlistCapture";
import { competitorsFor } from "@/lib/competitors";
import type { DataQuality } from "@/lib/dataQuality";
import type { RegulatorySource } from "@/lib/regulatorySource";
import { resolveStartCity } from "./startCity";
import { isSmokeSlot, countSmokeSlots } from "./slotSource";
// Цена спорной высоты для ЭТОГО рейса. Отдельным файлом, потому что на живых
// городах блок не появляется (0 из 42 пар Астаны) — увидеть его можно только
// в тесте, а для этого он должен рендериться отдельно от канваса.
import { HeightDisputePanel, type HeightDispute } from "./HeightDisputePanel";
import { padProhibition } from "./padPermission";
import { verifyVerdict, verifyReasonOf } from "./verifyVerdict";
import { buildJustificationFile, justificationFileName } from "./justificationFile";
import { measuredObstaclePct } from "./heightQuality";

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
  noteEn?: string;
  freshness?: { checked: boolean; upToDate: boolean | null; publishedEffective: string | null; cellsChanged: number; checkedAt: string | null };
  /** a regulator gate on the operation, published separately from any ceiling */
  permission?: { available: boolean; authority?: string; regime?: string; regimeEn?: string; kind?: "permission" | "prohibition"; basis?: string; effective?: string; sampled?: string; coveragePct?: number; uniform?: boolean; note?: string; noteEn?: string; provenanceNote?: string; provenanceNoteEn?: string };
  _signature?: { alg: string; contentHash: string };
}
/** Per-route verdict against that ceiling. compliant=null → no feed, no verdict. */
interface AirspaceCompliance {
  available: boolean;
  compliant: boolean | null;
  exceedingSegments: number | null;
  zeroCeilingSegments: number | null;
  maxExceedanceM: number | null;
  lowestCeilingM: number | null;
  note: string;
  /** тот же вердикт по-английски: приходит с сервера, `t()` до него не достаёт */
  noteEn?: string;
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
  vertiportScores?: { c: number; r: number; suitability: number; class: string; openRadiusM: number; clearanceM: number; distNoFlyM: number; ceilingM?: number | null; needsAtcCoordination?: boolean | null }[];
  /** QSkyway-specific: heights the generator flagged as towering over the rest
   *  of the city. Kept out of the shared DataQuality type on purpose — other
   *  modules do not have an obstacle grid, and a wrong height only matters
   *  because hs=0 buys zero safety clearance. */
  dataQuality?: DataQuality & {
    suspect?: { i: number; h: number; why?: string; times?: number; was?: number; levels?: number }[];
    /** высоты, взятые из статистики по типу застройки, а не измеренные у этого дома */
    substituted?: { i: number; type: string; from: number; n: number }[];
  };
  /** разбор сомнительных высот: что публикует статья объекта и наш вердикт */
  heightReview?: { index: number; taggedM: number; publishedM: number; publishedSource: string; verdict: string; note: string }[];
  _signature?: { alg: string; contentHash: string };
}
/** The filing document /route/justification returns, signed as one unit. */
interface JustDoc {
  kind: string; city: string; from: number; to: number; respectCeiling: boolean;
  distanceKm: number; cruiseAltM: number; etaMinWind: number;
  twinContentHash: string; windSource: string; heightConfidencePct: number; issuedAt: string;
  /** участков коридора со зданием под крылом и сколько из них на городском обмере */
  obstacleSegments?: number; measuredObstacleSegments?: number;
  /** где страховочный запас за неуверенность съеден полом коридора — под подписью */
  blindHeight?: { guessedSegments: number; inertPenaltySegments: number; clearedUpToM: number };
  airspace: null | { authority: string; source: string; regime: string; effective: string; contentHash: string | null; compliant: boolean | null; exceedingSegments: number | null; maxExceedanceM: number | null; lowestCeilingM: number | null };
}
interface JustAttestation { alg: string; contentHash: string; signature: string; publicKey: string; ephemeral: boolean }
interface Cell { c: number; r: number; }
interface Taxi { path: Cell[]; alts: number[]; seg: number; u: number; speed: number; hero: boolean; slow: number; }
interface VertiportRow { id: string; suitability: number; cls: string; openRadiusM: number | null; clearanceM: number | null; distNoFlyM: number | null; ceilingM: number | null; needsAtc: boolean | null; }
interface Slot { id: string; routeId: string; t0: string; t1: string; holder: string; issued: string; receipt: string; }

// Без прототипа: класс приходит строкой из ответа бэкенда, и у обычного объекта
// `VP_CLASS_COLOR["constructor"]` вернул бы функцию — то есть непустое значение
// вместо «класса нет», и запасной вариант не сработал бы (см. разбор
// `feedback_prototype_keys_in_lookups`). Обращение при этом не меняется.
/**
 * Согласование числительного. Ровно то же поведение, что у `plural()` в
 * `aevion-globus-backend/src/routes/qskyway.ts` (число входит в результат): один
 * и тот же счётчик показывается и оттуда, и отсюда, и «38 зданий» рядом с
 * «1 зданий» выглядело бы небрежностью там, где всё остальное посчитано точно.
 * Через границу API общей функции нет — поэтому копия, а не третий способ.
 */
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

const VP_CLASS_LABEL: Record<string, string> = Object.assign(Object.create(null), {
  "candidate-pad": "qskyway.pad.candidate",
  "needs-infrastructure": "qskyway.pad.needsInfra",
  unsuitable: "qskyway.pad.unsuitable",
});
const VP_CLASS_COLOR: Record<string, string> = Object.assign(Object.create(null), {
  "candidate-pad": "#2dd4bf",
  "needs-infrastructure": "#fbbf24",
  unsuitable: "#fb7185",
});

/** Map the backend's airspace block onto the platform-wide regulatory vocabulary. */
/**
 * Язык нужен здесь, а не только в разметке: правило регулятора приходит С
 * СЕРВЕРА, и `t()` до него не достаёт. До 12.08.2026 это значило, что казахский
 * и английский посетитель читал русскую оговорку — а у Токио наоборот, русский
 * читал английскую, потому что поле `regime` там было заполнено по-английски.
 */
function airspaceRegSource(a: AirspaceSummary | undefined, ru: boolean, noGridNote?: string): RegulatorySource {
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
        // ⚠️ Сюда же — почему у этого города НЕТ чисел по потолкам.
        //
        // Замер 28.08.2026 на живой странице: у Токио ноль подсказок и ни
        // одной строки про потолки, тогда как у NYC есть «6 из 42 маршрутов
        // укладывается в потолок». Читается как «Токио не считали», хотя
        // правда обратная: считали, просто его регулятор публикует правило
        // ДРУГОГО ВИДА. Сервер это объясняет полем `note`, но оно оставалось
        // в другой ветке этой же функции и до экрана не доходило.
        //
        // Серверную формулировку не берём дословно: в ней «см. блок
        // permission рядом» — слово из нашей схемы данных, а не из речи
        // человека. Отдельный ключ говорит то же на языке посетителя.
        scopeNote: (ru
          ? [perm.regime, perm.note, perm.provenanceNote, noGridNote]
          : [perm.regimeEn ?? perm.regime, perm.noteEn ?? perm.note, perm.provenanceNoteEn ?? perm.provenanceNote, noGridNote]
        ).filter(Boolean).join(" "),
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
    return { tier: "none", scopeNote: ru ? a?.note : (a?.noteEn ?? a?.note) };
  }
  const range = a.minCeilingM != null && a.maxCeilingM != null ? ` ${a.minCeilingM}–${a.maxCeilingM} ${ru ? "м" : "m"}` : "";
  return {
    tier: "official",
    authority: a.authority,
    title: (a.source ?? "") + range,
    effective: a.effective,
    // Правило FAA приходит по-английски (так его публикует регулятор), а
    // приписка была русской: строка получалась на двух языках сразу.
    scopeNote: a.regime
      ? `${a.regime} — ${ru ? "не сертификация аэротакси" : "not an air-taxi certification"}`
      : undefined,
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
  // `lang` нужен ровно для одного места: русское числительное склоняется, и
  // общий ключ этого не умеет (см. чип подстановки ниже).
  const { t, lang } = useI18n();
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
  const [stats, setStats] = useState({ distKm: 0, cruiseAlt: 0, eta: 0, conflicts: 0, city: "", local: false, heightConfidencePct: null as number | null, avgConfClearM: null as number | null, etaStill: null as number | null, obstacleSegments: null as number | null, measuredObstacleSegments: null as number | null, blindInert: null as number | null, blindClearedUpToM: null as number | null, confClearOnObstaclesM: null as number | null });
  const [booking, setBooking] = useState<string>("");
  const [playing, setPlaying] = useState(true);
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [coverage, setCoverage] = useState<{ withFeed: number; withRegulatoryLayer?: number; total: number; missing: string[]; withCeilings?: number; withPermissionRegime?: number } | null>(null);
  const [impact, setImpact] = useState<{ compliant: number; pairs: number; compliantPct: number; strictRoutable: number; padsNeedingAtc: number; authority: string; note: string } | null>(null);
  const [cityId, setCityId] = useState<string>("astana");
  const [meta, setMeta] = useState<{ wind: string; windSource: "metar" | "illustrative"; signed: string; nofly: number | null; dq?: DataQuality; suspect: { i: number; h: number; why?: string; times?: number; was?: number; levels?: number }[]; substituted: { i: number; type: string; from: number; n: number }[]; heightReview: { index: number; taggedM: number; publishedM: number; publishedSource: string; verdict: string; note: string }[]; airspace?: AirspaceSummary } | null>(null);
  // Strict mode asks the backend to treat the published ceiling as a hard
  // constraint instead of an advisory verdict. Off by default: the honest
  // default is "fly the corridor and tell me what it would require".
  const [strictCeiling, setStrictCeiling] = useState(false);
  const strictRef = useRef(false);
  const [airspaceRoute, setAirspaceRoute] = useState<AirspaceCompliance | null>(null);
  const [ceilingBlocked, setCeilingBlocked] = useState<string | null>(null);
  const [heightDispute, setHeightDispute] = useState<HeightDispute | null>(null);
  const [disputeImpact, setDisputeImpact] = useState<{ available: boolean; routable: number; affectedPairs: number; maxCruiseDeltaM: number; note: string } | null>(null);
  // Второй ответ того же рода: доходит ли ПОДСТАВЛЕННАЯ высота до маршрутов.
  // Ответ у него другой, чем у спорной, — поэтому отдельное состояние, а не
  // общий флаг «с высотами что-то не так».
  const [substImpact, setSubstImpact] = useState<{ available: boolean; routable: number; affectedPairs: number; buildings: number; buildingsUnderRoutes: number; note: string } | null>(null);
  const [heroPair, setHeroPair] = useState<{ from: number; to: number } | null>(null);
  const [justification, setJustification] = useState<{ doc: JustDoc; attestation: JustAttestation; scope: string; scopeEn?: string; verify?: unknown } | null>(null);
  const [justState, setJustState] = useState<"idle" | "busy" | "verified" | "invalid" | "unknown" | "failed">("idle");
  const [vpRows, setVpRows] = useState<VertiportRow[]>([]);
  const [slots, setSlots] = useState<{ list: Slot[]; count: number; liveCount: number | null; capacityPerRoute: number; store: string }>({ list: [], count: 0, liveCount: null, capacityPerRoute: 0, store: "" });
  // Считаем по загруженному списку, а не по `count` с сервера: сервер отдаёт
  // общее число, а тестовые видны только в записях.
  const smokeSlotCount = countSmokeSlots(slots.list);
  // Запрет, накрывающий город целиком, — свойство каждой площадки, поэтому
  // считается здесь и ставится в строку, а не только в регуляторную карточку.
  const padBan = padProhibition(meta?.airspace?.permission);
  const [verify, setVerify] = useState<"idle" | "checking" | "valid" | "invalid" | "unknown">("idle");
  // Оговорка о ключе приходит вместе с вердиктом и показывается рядом с ним:
  // без `QSKYWAY_SIGN_SK` ключ подписи генерируется при старте процесса, и
  // «подпись верна» тогда означает лишь «в этом процессе двойник не менялся».
  const [verifyKey, setVerifyKey] = useState<{ ephemeral: boolean; note: string } | null>(null);

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
    setStats((s) => ({ ...s, local: true, distKm: +distKm.toFixed(2), cruiseAlt: Math.round(cruise), eta: +((distKm / 90) * 60).toFixed(1), heightConfidencePct: null, avgConfClearM: null, etaStill: null, obstacleSegments: null, measuredObstacleSegments: null, blindInert: null, blindClearedUpToM: null, confClearOnObstaclesM: null }));
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
          setCeilingBlocked(`H-${from + 1} → H-${to + 1}: ${(lang === "ru" ? j.note : (j.noteEn ?? j.note)) ?? (lang === "ru" ? "нет коридора в пределах опубликованного потолка регулятора" : "no corridor within the regulator's published ceiling")}`);
          setAirspaceRoute(j.airspaceIfUnrestricted ?? null);
          // Рейса нет — значит нет и коридора, про который можно сказать, что он
          // поднят спорной высотой. Старое предупреждение тут читалось бы как
          // причина отказа.
          setHeightDispute(null);
          heroRef.current = null;
          setHeroPair(null);
          setJustification(null);
          setJustState("idle");
          // There is no flight — leaving the previous route's telemetry on screen
          // next to a "refused" banner would read as if those numbers described it.
          setStats((s) => ({ ...s, local: false, distKm: 0, cruiseAlt: 0, eta: 0, heightConfidencePct: null, avgConfClearM: null, etaStill: null, obstacleSegments: null, measuredObstacleSegments: null, blindInert: null, blindClearedUpToM: null, confClearOnObstaclesM: null }));
          return;
        }
      }
      if (!res.ok) throw new Error("route " + res.status);
      const r = await res.json();
      setCeilingBlocked(null);
      setAirspaceRoute(r.airspace ?? null);
      setHeightDispute(r.heightDispute ?? null);
      setHeroPair({ from, to });
      // A justification describes one specific flight. Carrying the previous
      // one over to a new route would attach a signed document to the wrong trip.
      setJustification(null);
      setJustState("idle");
      heroRef.current = { path: r.path, alts: r.alts, seg: 0, u: 0, speed: 1.1 + Math.random() * 0.5, hero: true, slow: 0 };
      setStats((s) => ({ ...s, local: false, distKm: r.distanceKm, cruiseAlt: Math.round(r.cruiseAltM), eta: r.etaMinWind, heightConfidencePct: r.heightConfidencePct ?? null, avgConfClearM: r.avgConfClearM ?? null, etaStill: r.etaMinStill ?? null, obstacleSegments: r.obstacleSegments ?? null, measuredObstacleSegments: r.measuredObstacleSegments ?? null, blindInert: r.blindHeight?.inertPenaltySegments ?? null, blindClearedUpToM: r.blindHeight?.clearedUpToM ?? null, confClearOnObstaclesM: r.confClearOnObstaclesM ?? null }));
    } catch {
      setCeilingBlocked(null);
      setAirspaceRoute(null);
      setHeightDispute(null);
      localHero();
    } finally {
      heroBusyRef.current = false;
    }
    // `lang` обязателен: внутри выбирается note/noteEn и русский запасной текст.
    // Без него посетитель, переключивший язык, получает прежний.
  }, [localHero, lang]);

  // ── city loading (switchable) ─────────────────────────────────────────────────
  const loadCity = useCallback(async (id: string) => {
    cityIdRef.current = id;
    setLoaded(false); setErr(null); setVerify("idle"); setVerifyKey(null);
    setAirspaceRoute(null); setCeilingBlocked(null); setImpact(null); setHeightDispute(null); setDisputeImpact(null);
    // Measured server-side across every pair, never typed in by hand: the whole
    // point of this figure is that it comes from the same engine the routes do.
    fetch(apiUrl(`/api/qskyway/airspace/impact?city=${encodeURIComponent(id)}`))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setImpact(j?.available ? j : null))
      .catch(() => setImpact(null));
    // Тем же движком и по тем же парам площадок: влияет ли спорная высота на
    // коридоры на самом деле. Отдельный запрос, потому что ответ дорогой (все
    // пары) и кэшируется на бэкенде.
    fetch(apiUrl(`/api/qskyway/height-substitution?city=${encodeURIComponent(id)}`))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setSubstImpact(j?.available ? j : null))
      .catch(() => setSubstImpact(null));
    fetch(apiUrl(`/api/qskyway/height-dispute?city=${encodeURIComponent(id)}`))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setDisputeImpact(j?.available ? j : null))
      .catch(() => setDisputeImpact(null));
    try {
      const res = await fetch(apiUrl(`/api/qskyway/city?city=${encodeURIComponent(id)}`));
      if (!res.ok) throw new Error("city " + res.status);
      const city: CityData = await res.json();
      cityRef.current = city;
      taxisRef.current = []; heroRef.current = null; conflictsRef.current = 0;
      let mh = 0; for (const h of city.grid.heights) if (h > mh) mh = h;
      altMaxRef.current = FLOOR + Math.ceil((mh + CLEAR - FLOOR) / BAND) * BAND + BAND;
      setStats({ distKm: 0, cruiseAlt: 0, eta: 0, conflicts: 0, city: city.city, local: false, heightConfidencePct: null, avgConfClearM: null, etaStill: null, obstacleSegments: null, measuredObstacleSegments: null, blindInert: null, blindClearedUpToM: null, confClearOnObstaclesM: null });
      setMeta({
        wind: city.wind ? t("qskyway.meta.wind", { g: city.wind.groundMs, top: city.wind.topMs, deg: city.wind.fromDeg }) : "—",
        windSource: city.wind?.source ?? "illustrative",
        signed: city._signature ? city._signature.contentHash.slice(0, 12) : "—",
        // null, а не 0. Ноль здесь читается как «запретных зон нет», то
        // есть «летайте где хотите» — самое опасное, что можно сказать
        // о воздушном пространстве, не имея данных. Подстановка
        // срабатывает лишь если ответ пришёл без списка, но направление
        // отказа выбирается по цене ошибки, а не по её вероятности.
        nofly: city.nofly?.length ?? null,
        // `heightPct` и `realPct` отсюда убраны 29.08: они клались в
        // состояние и НЕ читались никем (проценты на экране приходят
        // другим путём). Мёртвое поле само по себе безвредно, но внутри
        // у них было `?? 0` — «измерено 0 %» при отсутствии сведений о
        // качестве. Ловушка для того, кто однажды начнёт их читать и
        // унаследует фальшивый ноль вместе с полем.
        dq: city.dataQuality,
        suspect: city.dataQuality?.suspect ?? [],
        substituted: city.dataQuality?.substituted ?? [],
        heightReview: city.heightReview ?? [],
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
          ceilingM: s?.ceilingM ?? null, needsAtc: s ? (s.needsAtcCoordination ?? null) : null,
        };
      }).sort((a, b) => b.suitability - a.suitability));
      setLoaded(true);
      newHero();
      for (let i = 0; i < 5; i++) { const t = makeTaxi(false); if (t) taxisRef.current.push(t); }
    } catch (e) { setErr(String(e)); }
    // `t` обязателен по той же причине: строка про ветер собирается словарём.
  }, [newHero, makeTaxi, t]);

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
    // Дома, высота которых ПОДСТАВЛЕНА по типу застройки. Тёплый оттенок ниже
    // означает «угадано» и достаётся им наравне со слепым дефолтом 12 м — то
    // есть на карте они неотличимы, хотя утверждения разные: дефолт занижает и
    // виден по абсурдности, а подстановка выглядит замером. Обводим пунктиром.
    const substituted = new Set((city.dataQuality?.substituted ?? []).map((x) => x.i));
    for (let bi = 0; bi < city.buildings.length; bi++) {
      const b = city.buildings[bi];
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
      if (substituted.has(bi)) {
        ctx.strokeStyle = "rgba(200,150,79,0.95)"; ctx.lineWidth = 1;
        ctx.setLineDash([3, 2]); ctx.stroke(); ctx.setLineDash([]);
      }
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
      // Из той же таблицы, что список и легенда: цвет класса жил здесь третьей
      // копией, и перекрасить класс в одном месте значило разойтись с картой.
      // `#22d3ee` — это «не оценена», у которой своего класса нет.
      const col = (cls && VP_CLASS_COLOR[cls]) || "#22d3ee";
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
      setSlots({ list: j.slots ?? [], count: j.count ?? 0, liveCount: typeof j.liveCount === "number" ? j.liveCount : null, capacityPerRoute: j.capacityPerRoute ?? 0, store: j.store ?? "" });
    } catch { /* market panel is best-effort */ }
  }, []);

  // ── verify the displayed twin signature end-to-end (real Ed25519 check,
  // not just trusting the hash the city payload already carries) ────────────
  const verifySignature = useCallback(async () => {
    setVerify("checking");
    try {
      const res = await fetch(apiUrl(`/api/qskyway/verify?city=${encodeURIComponent(cityIdRef.current)}`));
      const j = await res.json();
      // Три исхода, а не два. Раньше здесь стояло
      // `res.ok && j.valid === true ? "valid" : "invalid"`, и в «недействительна»
      // сваливались упавшая сеть, ответ 500 и `valid: null` — принятое на
      // платформе значение «подтверждать нечего» (см. переход qsignV2 на
      // valid:null в preview-режиме). То есть сбой связи объявлял документ
      // поддельным. Обвинение в подделке нельзя выводить из неполученного ответа.
      setVerify(verifyVerdict(res.ok, j.valid));
      setVerifyKey(typeof j.ephemeral === "boolean"
        ? { ephemeral: j.ephemeral, note: String(lang === "ru" ? j.keyNote : (j.keyNoteEn ?? j.keyNote)) }
        : null);
    } catch { setVerify("unknown"); setVerifyKey(null); }
    // `lang` в зависимостях, а не через ref: список был пустым, и колбэк
    // запомнил бы язык, выбранный при монтировании.
  }, [lang]);

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
      // Квитанция настоящая, но бронь помечена тестовой (сервер: lib/slotOrigin.ts).
      // Без этой оговорки человек читает `✓ slot-… · qright:…` как занятое им
      // воздушное окно: демо-кнопка подписывается зашитым «AEVION demo», имени
      // посетителя мы не спрашиваем вовсе.
      // Отказ читаем на языке посетителя. Сервер шлёт обе половины (errorEn
      // появился 28.08.2026), но страница брала только русскую — поле в ответе
      // было, а до экрана не доходило. `?? j.error` намеренно: если сервер
      // старой сборки половины не прислал, показать русский текст честнее, чем
      // пустоту.
      const refusal = (lang === "ru" ? j.error : (j.errorEn ?? j.error)) ?? "";
      setBooking(j.ok
        ? t("qskyway.book.demoOk", { id: j.slot.id, receipt: j.slot.receipt })
        : `✗ ${refusal}`);
      if (j.ok) fetchSlots();
    } catch (e) {
      // Текст исключения на экран НЕ уходит: человек видел «ошибка сети:
      // TypeError: Failed to fetch» — то же, что и в загрузке города, только
      // приклеенное в месте вызова, а не записанное в словаре. Поэтому
      // сторож словаря его и не поймал.
      console.warn("[qskyway] бронь не прошла:", e);
      // ⚠️ Причину РАЗЛИЧАЕМ, а не подставляем.
      //
      // До 28.08 здесь на любое исключение показывалось «ошибка сети». Но
      // `fetch` бросает TypeError только когда запрос не ушёл; разбор ответа
      // падает SyntaxError, и тогда запрос УШЁЛ — а человеку говорили про сеть
      // и он проверял бы вайфай вместо того, чтобы просто повторить.
      //
      // В тот же день я поймал ровно этот класс в машинном инструменте: один
      // catch подписывал пять разных ошибок одной причиной и создал пять
      // ложных находок. Здесь цена тише, но природа та же.
      const isNetworkFailure = e instanceof TypeError;
      setBooking(t(isNetworkFailure ? "qskyway.err.network" : "qskyway.err.unexpected"));
    }
    // `t` и `lang` в зависимостях обязательны: без них колбэк держит переводчик
    // того языка, который был выбран при его создании. Посетитель переключает
    // язык, жмёт бронь — и получает текст на прежнем. Не падает, не логируется,
    // видно только глазом.
  }, [cityId, fetchSlots, t, lang]);

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
      setJustification({ doc: j.document, attestation: j.attestation, scope: j.scope, scopeEn: j.scopeEn, verify: j.verifyYourself });
      setJustState("idle");
    } catch {
      // Раньше здесь стояло `setJustState("idle")`: кнопка уходила в «…»
      // и возвращалась к исходной подписи, не сказав ни слова. Для
      // человека это неотличимо от «я не нажимал» — он жмёт ещё раз и
      // получает ту же тишину. Отказ ПРОВЕРКИ рядом показывался честно
      // («неизвестно»), а отказ ПОСТРОЕНИЯ молчал: та же панель, два
      // разных поведения у одного автора — почти всегда недосмотр.
      setJustState("failed");
      setJustification(null);
    }
  }, [heroPair]);

  // Verification runs against the backend, not in the browser: a document that
  // only ever checks itself locally proves nothing to the person receiving it.
  // Причина отказа проверки: «изменён» и «подписан не нами» ведут к разным
  // действиям, и объединять их в «недействителен» значит не сказать ничего.
  const [verifyReason, setVerifyReason] = useState<"tampered" | "forged" | null>(null);

  const verifyJustification = useCallback(async () => {
    if (!justification) return;
    setJustState("busy");
    try {
      const res = await fetch(apiUrl("/api/qskyway/route/justification/verify"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document: justification.doc, attestation: justification.attestation }),
      });
      const j = await res.json();
      // Тот же разбор, что и у подписи двойника; здесь вдобавок не смотрели
      // на res.ok вовсе, поэтому 500 от бэкенда читался как «обоснование
      // недействительно».
      const v = verifyVerdict(res.ok, j?.valid);
      setJustState(v === "valid" ? "verified" : v);
      // ⚠️ КАКАЯ ИМЕННО половина не сошлась — разные вещи для человека.
      //
      // Бэкенд считает `hashValid` и `signatureValid` РАЗДЕЛЬНО и прямо пишет в
      // комментарии, что один вердикт скрыл бы, что случилось. Страница до
      // 28.08.2026 читала только сводный `valid` и показывала «✗ недействительно»
      // — то есть ровно тот единый вердикт, которого бэкенд избегал.
      //
      // А действия противоположные: документ изменён после подписи — скачай
      // заново, своя же копия устарела. Подпись не наша — кто-то выдаёт чужую
      // бумагу за нашу, и это уже не про кнопку «скачать».
      // ⚠️ Обвинять — только по ПОЛОЖИТЕЛЬНОМУ признаку.
      //
      // Прежняя версия писала «подпись не наша» всякий раз, когда `hashValid`
      // не был строго `false` — то есть и когда поля не было вовсе. Сегодня
      // такой ответ недостижим (бэкенд отдаёт обе половины, а отказ 400 даёт
      // вердикт "unknown"), но ДЕФОЛТ был выбран в сторону более тяжёлого
      // обвинения: «вы принесли чужую бумагу» вместо «не сошлось».
      //
      // Из двух половин это разные разговоры: изменённый документ человек
      // перевыпустит сам, а поддельная подпись — это уже не про кнопку
      // «скачать». Сказать второе по отсутствующим данным нельзя.
      setVerifyReason(verifyReasonOf(v, j?.hashValid, j?.signatureValid));
    } catch { setJustState("unknown"); setVerifyReason(null); }
  }, [justification]);

  const downloadJustification = useCallback(() => {
    if (!justification) return;
    // Содержимое файла собирает отдельная функция: его надо проверять
    // значениями, а не кликом. Там же решается, класть ли рецепт.
    const payload = buildJustificationFile({
      document: justification.doc,
      attestation: justification.attestation,
      scope: justification.scope,
      scopeEn: justification.scopeEn,
      verifyYourself: justification.verify,
    });
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = justificationFileName(justification.doc);
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
        <div style={{ fontFamily: "monospace", fontSize: 10.5, letterSpacing: 2, textTransform: "uppercase", color: "#5f7086" }}>{t("qskyway.hero.eyebrow")}</div>
        <h1 style={{ fontFamily: "monospace", fontSize: 24, margin: "2px 0 4px" }}><span style={{ color: "#fbbf24" }}>Q</span>Skyway</h1>
        <p style={{ color: "#9fb0c4", fontSize: 14, margin: "0 0 4px", maxWidth: 720 }}>
          {t("qskyway.hero.lede1")}{" "}
          {t("qskyway.hero.lede2")}
        </p>
        <p style={{ color: "#5f7086", fontSize: 12, margin: "0 0 18px" }}>
          {t("qskyway.hero.disclaimer")}
        </p>

        {/*
          На телефоне три кнопки города вставали столбиком: названия длинные
          («Астана — центр (бульвар Нуржол)»), и каждая занимала строку.
          Замер 28.08.2026 на 390×844: сама 3D-сцена начиналась на 862px —
          то есть ниже сгиба, и человек с телефона видел навигацию, описание и
          выбор города, но НЕ видел продукта.

          Сокращать названия нельзя: район в скобках отличает Мидтаун от
          остального Нью-Йорка. Поэтому строка прокручивается вбок — приём
          обычный для телефона, третья кнопка видна краем и сама показывает,
          что список продолжается. На широком экране всё как было.
        */}
        {cities.length > 1 && (
          <style>{`@media (max-width: 640px) { .qsky-cities { flex-wrap: nowrap !important; overflow-x: auto; -webkit-overflow-scrolling: touch; } .qsky-cities > button { flex: 0 0 auto; } }`}</style>
        )}
        {cities.length > 1 && (
          <div className="qsky-cities" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "0 0 16px" }}>
            <span style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: 1, color: "#5f7086" }}>{t("qskyway.city.label")}</span>
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
              🛂 {t("qskyway.coverage.head", { withFeed: coverage.withRegulatoryLayer ?? coverage.withFeed, total: coverage.total })}
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

        {/* Сообщение об ошибке — для ПОСЕТИТЕЛЯ, а не для разработчика. Раньше
            здесь стояло «Проверь, что бэкенд поднят (/api/qskyway/city)»: человек,
            зашедший на публичную страницу, поднять бэкенд не может, и такой текст
            только сообщает ему, что мы о нём не думали. Технический текст
            исключения оставлен в подсказке — для диагностики он там же, а на
            экран не лезет. */}
        {err && (
          <div style={{ ...card, padding: 16, color: "#fb7185" }} title={String(err)}>
            {t("qskyway.err.cityLoad")}
          </div>
        )}

        {!err && (
          <div className="qsky-grid" style={{ display: "grid", gap: 14 }}>
            <style>{`.qsky-grid { grid-template-columns: 1fr; } @media (min-width: 900px) { .qsky-grid { grid-template-columns: 1.55fr 1fr; } }`}</style>
            <section style={card}>
              <div style={cardH}>{t("qskyway.map.head")}{stats.city ? " · " + stats.city : ""}</div>
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
                  {t("qskyway.loading.city", { city: cityId })}
                </div>
              )}
              <canvas ref={mapRef} style={{ display: "block", width: "100%", background: "#0a121d" }} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "12px 14px", borderTop: "1px solid #1e2836" }}>
                <button style={btnPri} onClick={newHero} disabled={!loaded}>{t("qskyway.btn.newFlight")}</button>
                <button style={btn} onClick={() => { runningRef.current = !runningRef.current; setPlaying(runningRef.current); }}>{playing ? t("qskyway.btn.pause") : t("qskyway.btn.play")}</button>
                <button style={btn} onClick={() => { for (let i = 0; i < 3; i++) { const t = makeTaxi(false); if (t) taxisRef.current.push(t); } }}>{t("qskyway.btn.traffic")}</button>
                <button style={btn} onClick={() => { showColorRef.current = !showColorRef.current; }}>{t("qskyway.btn.heightColors")}</button>
                <button
                  style={strictCeiling ? { ...btn, borderColor: "#2dd4bf", color: "#2dd4bf" } : btn}
                  disabled={!meta?.airspace?.available}
                  title={meta?.airspace?.available
                    ? t("qskyway.strict.tipOn")
                    : t("qskyway.strict.tipOff")}
                  onClick={() => { const v = !strictCeiling; setStrictCeiling(v); strictRef.current = v; newHero(); }}
                >
                  {strictCeiling ? t("qskyway.strict.on") : t("qskyway.strict.off")}
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
                    {t("qskyway.wind.label", { wind: meta.wind })}
                    <span
                      title={meta.windSource === "metar" ? t("qskyway.wind.metarTip") : t("qskyway.wind.demoTip")}
                      style={{ marginLeft: 6, color: meta.windSource === "metar" ? "#2dd4bf" : "#5f7086" }}
                    >
                      · {meta.windSource === "metar" ? "METAR" : t("qskyway.wind.demo")}
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
                    source={airspaceRegSource(meta.airspace, lang === "ru", t("qskyway.reg.noCeilingGrid"))}
                    labels={{ none: t("qskyway.reg.nofeed") }}
                  />
                  {/* ССЫЛКА НА ПРОВЕРКУ — потому что самое сильное наше
                      доказательство было невидимым.

                      29.08.2026: привязка слоя воздушного пространства к
                      Bitcoin на странице не показывалась ВООБЩЕ, а более
                      слабое доказательство — наша собственная подпись
                      обоснования — стоит на видном месте с кнопкой и
                      вердиктом. Посетитель не узнавал ни что слой
                      проштампован во внешнем реестре, ни что это проверяемо.

                      ⚠️ Хотел показать рядом хэш редакции и номер блока — и НЕ
                      стал: этих данных у страницы нет (в сводке `airspace`
                      поля contentHash не оказалось, компилятор это и сказал).
                      Выдумать их в вёрстке значило бы повторить ту же ошибку
                      в другую сторону. Хэш показывает сама ручка. */}
                  {meta.airspace?.available && (
                    <div style={{ fontSize: 11, color: "#5f7086", lineHeight: 1.6, marginTop: 2 }}>
                      <a
                        href={apiUrl(`/api/qskyway/airspace/edition?city=${encodeURIComponent(cityId)}`)}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#c8a24a" }}
                      >
                        {t("qskyway.reg.editionVerify")}
                      </a>
                    </div>
                  )}
                  <RegulatorySourceChip
                    subject={`${t("qskyway.reg.subject.zones")} (${meta.nofly ?? "—"})`}
                    source={{
                      tier: "illustrative",
                      scopeNote: t("qskyway.reg.zones.scope"),
                    }}
                  />
                  {/* Настоящая кнопка, а не кликабельный текст.
                      До 28.08.2026 здесь был <span> с onClick: с клавиатуры
                      недостижим, диктор объявляет текстом, а подсказка живёт в
                      title — то есть на телефоне её нет вовсе. И это главное
                      действие блока доверия: проверка подписи двойника.
                      Сторож clickableA11y написан 19.08 ровно про этот элемент,
                      но лежал в несмёрженной ветке и потому никого не стерёг. */}
                  <button
                    type="button"
                    onClick={verifySignature}
                    disabled={verify === "checking"}
                    aria-label={t("qskyway.tip.verifySig")}
                    title={t("qskyway.tip.verifySig")}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      font: "inherit",
                      textAlign: "left",
                      cursor: verify === "checking" ? "wait" : "pointer",
                      textDecoration: "underline dotted",
                      color: verify === "valid" ? "#2dd4bf" : verify === "invalid" ? "#fb7185" : verify === "unknown" ? "#94a3b8" : "#2dd4bf",
                    }}
                  >
                    🔏 Ed25519 · {meta.signed}…
                    {verify === "checking" && t("qskyway.verify.checking")}
                    {verify === "valid" && t("qskyway.verify.ok")}
                    {/* Вердикт без этой приписки читается сильнее, чем есть:
                        временный ключ никто раньше не видел, и связи со вчерашним
                        двойником подпись не даёт. На проде ключ именно такой. */}
                    {verify === "valid" && verifyKey?.ephemeral && (
                      <span style={{ color: "#fbbf24" }} title={verifyKey.note}>
                        {t("qskyway.verify.ephemeralKey")}
                      </span>
                    )}
                    {verify === "invalid" && t("qskyway.verify.failed")}
                    {/* Серым и отдельным словом: «не смогли проверить» — не то же,
                        что «подпись не сошлась». Раньше оба вида читались как второй. */}
                    {verify === "unknown" && (
                      <span style={{ color: "#94a3b8" }}>{t("qskyway.verify.unknown")}</span>
                    )}
                  </button>
                  <DataProvenanceChip compact dataQuality={meta.dq} labels={{ unit: t("qskyway.unit.buildings") }} />
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
                      {t("qskyway.height.suspect")}{" "}
                      {meta.suspect
                        .map((o) => {
                          // Оба поля обязаны быть, а не одно: раньше здесь стояла
                          // шаблонная строка, и при отсутствии `levels` на экран
                          // уезжало слово «undefined». Типы это поймали только
                          // после перевода на ключ — шаблон печатает что угодно.
                          if (o.was !== undefined && o.levels !== undefined) {
                            // источник спорит сам с собой: тег высоты против собственного счёта этажей
                            return t("qskyway.disp.vsLevels", { h: o.h, was: o.was, levels: o.levels });
                          }
                          // Высота, которая в разы выше остальной застройки. Если такой
                          // случай уже разобран человеком — называем ЧИСЛО из статьи
                          // объекта, а не только кратность: «×4.66 к застройке» верно, но
                          // проверить его нельзя, а «310.8 м в статье» можно.
                          const rev = meta.heightReview.find((r) => r.index === o.i);
                          return rev
                            ? t("qskyway.disp.vsPublished", { h: o.h, pub: rev.publishedM })
                            : o.times !== undefined
                              ? t("qskyway.disp.vsBuilt", { h: o.h, times: o.times })
                              // Кратности нет — говорим, что высота под вопросом, и не
                              // выдумываем число. «×undefined к застройке» хуже молчания.
                              : t("qskyway.disp.suspectPlain", { h: o.h });
                        })
                        .join(" · ")}
                      {/* Доходит ли спорная высота до маршрутов — измерено движком по
                          всем парам площадок, а не выведено рассуждением. Без этой
                          строки чип оставлял человека наедине с вопросом «а летаем-то
                          мы по ней?», и естественный ответ («максимум сетки — она,
                          значит подняты все») оказался неверным. */}
                      {disputeImpact?.available && (
                        <span style={{ color: disputeImpact.affectedPairs > 0 ? "#fb7185" : "#5f7086" }}>
                          {disputeImpact.affectedPairs > 0
                            ? t("qskyway.disp.affects", { n: disputeImpact.affectedPairs, m: disputeImpact.routable })
                            : t("qskyway.disp.noAffect", { m: disputeImpact.routable })}
                        </span>
                      )}
                    </span>
                  )}
                  {/* Подстановка по типу — не то же самое, что «угадано».
                      Слепому дому ставится 75-й процентиль домов ЕГО типа в этом
                      же городе; число выглядит замером, хотя измерен не он.
                      Класс высоты остаётся `guessed`, и по нему эти дома от
                      слепого дефолта 12 м не отличить — поэтому сказано прямо. */}
                  {meta.substituted.length > 0 && (
                    <span
                      title={
                        "Высота взята из статистики домов того же типа в этом городе, а не измерена и не выведена из этажности самого дома. "
                        + "Занижать нельзя: коридор пройдёт ниже крыши, поэтому берётся 75-й процентиль, а не медиана. Примеры: "
                        + meta.substituted.slice(0, 3).map((o) => `дом ${o.i} (${o.type}) вместо ${o.from} м, по ${o.n} известным высотам`).join("; ")
                        + ". На карте такие дома обведены пунктиром: тёплый оттенок значит «угадано» и достаётся им наравне со слепым дефолтом 12 м, хотя утверждения разные."
                      }
                      style={{ color: "#c8964f", textDecoration: "underline dotted", cursor: "help" }}
                    >
                      {/* Русская форма склоняется числительным, остальные языки —
                          нет: `plural` даёт «38 зданий», ключ для en/kk несёт число сам. */}
                      ▨ {lang === "ru"
                        ? `подставлено по типу: ${plural(meta.substituted.length, "здание", "здания", "зданий")}`
                        : t("qskyway.subst.head", { n: meta.substituted.length })}
                      {/* Тот же вопрос, что у спорной высоты: доходит ли она до
                          полётов. Ответы у них РАЗНЫЕ — спорная высота Астаны не
                          задевает ни одного маршрута, а подстановка больше
                          половины, — поэтому оба замера показаны, а не один. */}
                      {substImpact?.available && (
                        <span style={{ color: substImpact.affectedPairs > 0 ? "#fb7185" : "#5f7086" }}>
                          {substImpact.affectedPairs > 0
                            ? t("qskyway.subst.underRoutes", { under: substImpact.buildingsUnderRoutes, total: substImpact.buildings, pairs: substImpact.affectedPairs, routable: substImpact.routable })
                            : t("qskyway.subst.noRoutes", { routable: substImpact.routable })}
                        </span>
                      )}
                    </span>
                  )}
                  {/* «Годна» здесь было сильнее, чем подпись той же площадки в
                      списке справа («кандидат на площадку»): один и тот же класс,
                      два разных слова, и самое сильное стояло там, где нет ни
                      одной оговорки. Легенда говорит теми же словами, что список. */}
                  <span>{t("qskyway.legend.pads")} <span style={{ color: "#2dd4bf" }}>●</span> {t("qskyway.pad.candidate")} · <span style={{ color: "#fbbf24" }}>●</span> {t("qskyway.legend.needsInfraShort")} · <span style={{ color: "#fb7185" }}>●</span> {t("qskyway.pad.unsuitable")} · <span style={{ color: "#c8964f" }}>▨</span> {t("qskyway.legend.heightGuessed")}
                    {padBan && (
                      <span style={{ color: "#fb7185" }} title={padBan.rule}> · 🚫 {t("qskyway.pad.cityProhibited")}</span>
                    )}
                  </span>
                </div>
              )}
            </section>

            <aside style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <section style={card}>
                <div style={cardH}>{t("qskyway.panel.heightProfile")}</div>
                <canvas ref={profRef} style={{ display: "block", width: "100%", height: 190, background: "#0a121d" }} />
              </section>
              <section style={card}>
                <div style={cardH}>{t("qskyway.panel.telemetry")}</div>
                {/*
                  Когда бэкенд не ответил, страница всё равно рисует полёт —
                  маршрут считается тут же, в браузере. Числа при этом
                  выглядели РОВНО как серверные: те же поля, тот же вид.
                  Уверенность по высотам и обмеренные участки при таком
                  падении честно гасятся в null, но расстояние, высота и
                  время оставались без единого признака своего
                  происхождения — а по ним и судят о модуле.

                  Признак живёт В САМИХ данных телеметрии (`stats.local`),
                  а не отдельной переменной рядом: иначе он разъедется с
                  числами при следующей же правке, и подпись будет
                  описывать не тот полёт.
                */}
                {stats.local && (
                  <div style={{ padding: "8px 12px", fontSize: 12, color: "#fbbf24" }}>
                    {t("qskyway.tel.localRoute")}
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "#1e2836" }}>
                  {([
                    [t("qskyway.tel.distance"), stats.distKm + " " + t("qskyway.unit.km")],
                    [t("qskyway.tel.cruiseAlt"), stats.cruiseAlt + " " + t("qskyway.unit.m")],
                    [t("qskyway.tel.eta"), stats.etaStill == null ? stats.eta + " " + t("qskyway.unit.min") : (
                      <>
                        {stats.eta} {t("qskyway.unit.min")}
                        {/* Знак сам по себе не читается: «−0.38 ветер» не говорит,
                            помог ветер или помешал. Число верное, непонятна ЗНАКОВАЯ
                            договорённость — её и объясняем, а не переписываем цифру. */}
                        <span
                          title={t("qskyway.tel.windTip")}
                          style={{ fontSize: 11, fontWeight: 400, color: "#5f7086", marginLeft: 5, cursor: "help" }}
                        >
                          ({stats.eta - stats.etaStill >= 0 ? "+" : ""}{(stats.eta - stats.etaStill).toFixed(2)} {t("qskyway.tel.windSuffix")})
                        </span>
                      </>
                    )],
                    [t("qskyway.tel.separated"), String(stats.conflicts)],
                    // Две цифры рядом, и это не дублирование. Первая считает все
                    // участки, включая открытую землю (её высота известна — там
                    // ничего не стоит), вторая — только те, где под крылом
                    // действительно здание. В Астане первая даёт 78–97%, вторая
                    // ноль: городского обмера нет ни у одного дома. Одна первая
                    // читалась как «с высотами всё хорошо» и спорила с чипом
                    // города «0% обмерено» — замер 12.08.2026.
                    [t("qskyway.tel.heightConfidence"), stats.heightConfidencePct == null ? "—" : (
                      <>
                        {stats.heightConfidencePct}%
                        {/* Условие тут одно, а было два: сама функция отдаёт null
                            ровно при отсутствии участков, и отдельная проверка
                            `obstacleSegments > 0` её дублировала. TypeScript
                            дубликат не связывал и требовал разбирать null там,
                            где он недостижим. */}
                        {measuredObstaclePct(stats.obstacleSegments, stats.measuredObstacleSegments) != null && (
                          <span
                            title={`Из ${stats.obstacleSegments} участков со зданием под крылом на обмеренной городом высоте стоят ${stats.measuredObstacleSegments ?? 0}. Остальные — вывод из тега или счёта этажей OSM, либо слепой дефолт; за неуверенность коридор платит запасом по высоте.`}
                            style={{ fontSize: 11, fontWeight: 400, color: (stats.measuredObstacleSegments ?? 0) === 0 ? "#fbbf24" : "#5f7086", marginLeft: 5, cursor: "help" }}
                          >
                            {t("qskyway.tel.byBuildings", { pct: measuredObstaclePct(stats.obstacleSegments, stats.measuredObstacleSegments) ?? 0 })}
                          </span>
                        )}
                      </>
                    )],
                    // Средний страховочный запас — самое лживое число на панели,
                    // если показывать его одно. Замер 27.08.2026 по Астане: из
                    // 237 зданий с угаданной высотой 199 сидят на слепом дефолте
                    // 12 м, и для них 12 + 15 + 16 = 43 при поле коридора 50 —
                    // ступеней вверх ноль, запас не добавляет НИ МЕТРА. То есть
                    // плитка честно называет метры, которых в этих участках нет.
                    // Приписка говорит, на скольких участках так вышло и до какой
                    // настоящей высоты здания обещанный просвет вообще выдержан.
                    // Показываем запас ПО ЗДАНИЯМ, а не среднее по всему коридору.
                    //
                    // Замер 27.08.2026, живой маршрут Астаны 0→3: среднее по всем
                    // участкам дало 0.7 м при настоящих 16 м на каждом из четырёх
                    // участков со зданием — 93 участка из 97 это открытая земля с
                    // нулевым запасом. «0.7 м» читается как «мы почти ничего не
                    // добавляем» и спорит с чипом города, где заявлены 16.
                    //
                    // Разбавленное число не выбрасываем, а прячем в подсказку:
                    // оно правдиво отвечает на свой вопрос («сколько в среднем по
                    // маршруту»), просто этот вопрос не тот, который читают.
                    [t("qskyway.tel.confClearance"), stats.avgConfClearM == null ? "—" : (
                      <>
                        <span title={`По всему коридору в среднем ${stats.avgConfClearM} ${t("qskyway.unit.m")}, включая участки над открытой землёй, где запас не нужен и равен нулю.`}>
                          {stats.confClearOnObstaclesM ?? stats.avgConfClearM} {t("qskyway.unit.m")}
                        </span>
                        {(stats.blindInert ?? 0) > 0 && (
                          <span
                            title={`На ${plural(stats.blindInert ?? 0, "участке", "участках", "участках")} высота под крылом угадана, а страховочный запас съеден полом коридора: коридор лёг туда же, куда лёг бы без запаса. Обещанный просвет выдержан, только если здание не выше ${stats.blindClearedUpToM} м.`}
                            style={{ fontSize: 11, fontWeight: 400, color: "#fbbf24", marginLeft: 5, cursor: "help" }}
                          >
                            {t("qskyway.tel.blindInert", { n: stats.blindInert ?? 0 })}
                          </span>
                        )}
                      </>
                    )],
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
                    {ceilingBlocked && <span style={{ color: "#5f7086" }}>{t("qskyway.route.noCeilingLimit")}</span>}
                    🛂 {airspaceRoute.compliant ? t("qskyway.route.withinCeiling") : t("qskyway.route.aboveCeiling", { m: airspaceRoute.maxExceedanceM ?? "—", n: airspaceRoute.exceedingSegments ?? "—" })}
                    {airspaceRoute.lowestCeilingM != null && (
                      <span style={{ color: "#5f7086" }}>{t("qskyway.route.lowestCeiling", { m: airspaceRoute.lowestCeilingM })}</span>
                    )}
                    <div style={{ color: "#5f7086", fontSize: 10.5, marginTop: 3, whiteSpace: "normal" }}>{lang === "ru" ? airspaceRoute.note : (airspaceRoute.noteEn ?? airspaceRoute.note)}</div>
                  </div>
                )}
                {/* Расхождение двух наших же ответов: чип в шапке говорит «высоте
                    не верим», а коридор на неё закладывается. Пока это было видно
                    только по городу, рейс молчал — здесь названа цена именно для
                    него. Высоту при этом не переписываем: починка принадлежит OSM. */}
                <HeightDisputePanel dispute={heightDispute} />
                <div style={{ padding: "12px 14px", borderTop: "1px solid #1e2836" }}>
                  <button style={btnPri} onClick={bookSlot} disabled={!loaded}>{t("qskyway.btn.bookSlot")}</button>
                  {booking && <div style={{ marginTop: 10, fontFamily: "monospace", fontSize: 11, color: booking.startsWith("✓") ? "#2dd4bf" : "#fb7185", wordBreak: "break-all" }}>{booking}</div>}

                  {/* The filing document. Until now it existed only as an endpoint,
                      which is the same as not existing for the person who has to
                      justify a flight. */}
                  <div style={{ marginTop: 12, borderTop: "1px solid #1e2836", paddingTop: 12 }}>
                    {!justification && (
                      <button style={btn} onClick={requestJustification} disabled={!heroPair || justState === "busy"}>
                        {justState === "busy" ? "…" : t("qskyway.just.build")}
                      </button>
                    )}
                    {justState === "failed" && (
                      <div style={{ marginTop: 8, fontSize: 11.5, color: "#fb7185" }}>
                        {t("qskyway.just.failed")}
                      </div>
                    )}
                    {!justification ? null : (
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
                        {/* Качество высотных данных — часть обоснования, а не
                            примечание к нему: коридор в этом документе построен
                            по ним. Показываем то же, что лежит внутри файла, и
                            обе цифры сразу — иначе на экране остаётся удобная. */}
                        {justification.doc.obstacleSegments != null && justification.doc.obstacleSegments > 0 && (
                          <div style={{ marginTop: 3, color: justification.doc.measuredObstacleSegments === 0 ? "#fbbf24" : "#5f7086" }}>
                            {t("qskyway.just.heights", { pct: justification.doc.heightConfidencePct })}{" "}
                            {measuredObstaclePct(justification.doc.obstacleSegments, justification.doc.measuredObstacleSegments)}{t("qskyway.just.byBuildings")}
                            {justification.doc.measuredObstacleSegments === 0 && t("qskyway.just.noCityMeasure")}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                          <button style={btn} onClick={downloadJustification}>{t("qskyway.just.download")}</button>
                          <button style={btn} onClick={verifyJustification} disabled={justState === "busy"}>
                            {justState === "verified" ? "✓ " + t("qskyway.just.verified")
                              : justState === "unknown" ? "— " + t("qskyway.just.unknown")
                              : justState === "invalid"
                                ? "✗ " + t("qskyway.just.invalid")
                                  + (verifyReason ? ": " + t("qskyway.just." + verifyReason) : "")
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
                  <div style={cardH}>{t("qskyway.panel.padSuitability")} · {vpRows.length}</div>
                  <div style={{ maxHeight: 220, overflowY: "auto" }}>
                    {vpRows.map((v) => (
                      <div key={v.id} style={{ padding: "8px 14px", borderTop: "1px solid #1e2836", fontFamily: "monospace", fontSize: 11.5 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ color: "#9fb0c4" }}>{v.id}</span>
                          <span style={{ color: VP_CLASS_COLOR[v.cls] ?? "#5f7086" }}>{t(VP_CLASS_LABEL[v.cls] ?? "qskyway.pad.unrated")} · {v.suitability}</span>
                        </div>
                        {v.openRadiusM != null && (
                          <div style={{ color: "#5f7086", fontSize: 10, marginTop: 2 }}>
                            {/* Единица «м» уехала в КЛЮЧ, как у соседних двух величин.
                                Раньше она приклеивалась здесь по-русски, и на английской
                                странице выходило «to no-fly zone 1426м» — три единицы `m`
                                и четвёртая `м` в одной строке. Словари были полными и в
                                паритете: текст собирался в коде МИМО словаря, и проверка
                                ключей такого не видит по устройству. */}
                            {v.distNoFlyM == null || v.distNoFlyM >= 9999
                              ? t("qskyway.pad.rowDetailsFar", { r: v.openRadiusM ?? "—", c: v.clearanceM ?? "—" })
                              : t("qskyway.pad.rowDetails", { r: v.openRadiusM ?? "—", c: v.clearanceM ?? "—", d: v.distNoFlyM })}
                            {v.ceilingM != null && <>{t("qskyway.pad.ceiling", { m: v.ceilingM })}</>}
                          </div>
                        )}
                        {/*
                          Три случая, а не два. Раньше `needsAtc` был
                          `boolean`, и отсутствие данных о площадке давало
                          `false` — предупреждение о согласовании с
                          диспетчером просто ИСЧЕЗАЛО, что читается как
                          «согласование не нужно». Соседнее поле
                          `ceilingM` уже было `?? null` — снова разное
                          обращение с двумя полями в одной строке.
                        */}
                        {v.needsAtc === null && (
                          <div style={{ color: "#94a3b8", fontSize: 10, marginTop: 2 }}>
                            {t("qskyway.pad.atcUnknown")}
                          </div>
                        )}
                        {v.needsAtc === true && (
                          <div style={{ color: "#fda4af", fontSize: 10, marginTop: 2 }} title={t("qskyway.tip.noAutoClearance")}>
                            {t("qskyway.pad.needsAtc")}
                          </div>
                        )}
                        {/* Оценка отвечает «сядет ли сюда аппарат», а не «можно ли
                            отсюда лететь». Без этой строки «кандидат на площадку · 78»
                            в городе под сплошным запретом оставалось единственным,
                            что человек здесь читает о полёте. */}
                        {padBan && (
                          <div style={{ color: "#fb7185", fontSize: 10, marginTop: 2 }} title={padBan.rule}>
                            🚫 {t("qskyway.pad.prohibited", { authority: padBan.authority })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: "8px 14px", borderTop: "1px solid #1e2836", fontSize: 10.5, color: "#5f7086" }}>
                    {t("qskyway.pad.algorithmicNote")}
                  </div>
                </section>
              )}

              <section style={card}>
                <div style={{ ...cardH, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  {/*
                    На проде 10.08.2026 здесь стояло «· 34», и 33 из них были
                    вывод смоук-набора. Читалось как рыночная активность:
                    квитанции настоящие, отличить нечем. Не прячем — называем.
                  */}
                  <span>
                    {t("qskyway.panel.slotMarket")} · {slots.liveCount ?? slots.count}
                    {smokeSlotCount > 0 && (
                      <span style={{ color: "#fbbf24", textTransform: "none", letterSpacing: 0 }}>
                        {" "}{t("qskyway.slots.testSuffix", { n: smokeSlotCount })}
                      </span>
                    )}
                  </span>
                  {slots.store && (
                    <span style={{ color: slots.store === "postgres" ? "#2dd4bf" : "#fbbf24", textTransform: "none", letterSpacing: 0 }} title={slots.store === "postgres" ? t("qskyway.slots.storeDurable") : t("qskyway.slots.storeMemory")}>
                      {slots.store === "postgres" ? "● persist" : "● ephemeral"}
                    </span>
                  )}
                </div>
                {slots.list.length === 0 ? (
                  <div style={{ padding: "12px 14px", fontSize: 12, color: "#5f7086" }}>{t("qskyway.slots.empty")}</div>
                ) : (
                  <div style={{ maxHeight: 220, overflowY: "auto" }}>
                    {[...slots.list].reverse().slice(0, 20).map((s) => (
                      <div key={s.id} style={{ padding: "8px 14px", borderTop: "1px solid #1e2836", fontFamily: "monospace", fontSize: 11 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#9fb0c4" }}>
                          <span>
                            {s.id}
                            {isSmokeSlot(s) && (
                              <span
                                style={{ color: "#fbbf24", marginLeft: 6 }}
                                title={t("qskyway.tip.smokeBooking")}
                              >
                                {t("qskyway.slots.testBadge")}
                              </span>
                            )}
                          </span>
                          <span>{s.holder}</span>
                        </div>
                        <div style={{ color: "#5f7086", fontSize: 10.5, wordBreak: "break-all" }}>{s.routeId} · {s.receipt}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ padding: "8px 14px", borderTop: "1px solid #1e2836", fontSize: 10.5, color: "#5f7086" }}>
                  {/* «Якорем» в этом модуле называется привязка слоя ограничений к
                      Bitcoin через OpenTimestamps: её проверяет третья сторона и она
                      доказывает время. Квитанция слота — SHA-256 от нашей же записи в
                      нашей же базе. Одно слово на две разные гарантии занимало чужой вес. */}
                  {t("qskyway.slots.capacity", { n: String(slots.capacityPerRoute || "—") })} {t("qskyway.slots.receipt")}
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

        {/*
          Ворота запуска 6: у страницы модуля не было НИ ОДНОГО поля для
          адреса — человек досматривал демо и уходил, не оставив следа.
          Берём готовый компонент платформы, а не пишем свой: он уже
          пишет в работающую ручку, дедуплицирует по адресу и — главное —
          показывает отказ отказом (форма бюро до 11.08 печатала зелёное
          «вы подписаны», ничего не отправив).

          `source` помечает страницу-источник: без него нельзя ответить,
          какой модуль привёл человека, и весь приём сливается в один
          список. Тексты через `t()`, а не литералами, как на
          одноязычных страницах запуска: здесь три языка и свой сторож
          против русского вне словаря.
        */}
        <div style={{ marginTop: 18 }}>
          <WaitlistCapture
            source="qskyway"
            tone="light"
            title={t("qskyway.wait.title")}
            description={t("qskyway.wait.desc")}
            // Подпись кнопки обязательна, а не по вкусу: у компонента
            // умолчание — РУССКИЙ литерал. На четырёх соседних страницах
            // это верно, они одноязычные; здесь три языка, и англоязычный
            // посетитель слышал от читалки «Получить ранний доступ».
            // Поймано замером отрисованной страницы, в исходнике не видно.
            buttonLabel={t("qskyway.wait.cta")}
                promise={t("qskyway.wait.promise")}
          />
        </div>
      </div>
    </div>
  );
}
