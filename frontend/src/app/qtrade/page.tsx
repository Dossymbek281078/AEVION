"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { PitchValueCallout } from "@/components/PitchValueCallout";
import {
  ldPairs, svPairs, ldPositions, svPositions,
  ldLimits, svLimits, checkLimitFills, ocoCancellations, buildOrderBook,
  ldClosed, svClosed, buildClosed, checkBracketHit, updateTrailingPeak,
  ldAlerts, svAlerts, checkAlertHits,
  tickPair, catchupPair, unrealizedPnl, unrealizedPct,
  fmtUsd, fmtPct, sparklinePath,
  aggregateCandles, TIMEFRAMES,
  type Pair, type Position, type PairId, type LimitOrder, type ClosedPosition, type PriceAlert,
  type TimeframeMs,
} from "./marketSim";
import { ldWallet, svWallet, sellAev, buyAev, recordPlay, ldActiveTheme, THEME_PALETTES, type AEVWallet, type ThemeId } from "../aev/aevToken";
import {
  computePortfolioStats, computePairBreakdown, buildCalendar, fmtMs,
  type PortfolioStats, type PairBreakdown, type CalendarCell,
} from "./analytics";
import { runBacktest, type BacktestResult, type StrategyKind } from "./backtest";
import { ldFees, slipEntryPrice, closeWithFees, dailyLossExceeded, feesForPair } from "./fees";
import FeesPanel from "./FeesPanel";
import { downloadTradesCsv } from "./csv";
import DcaBotsPanel from "./DcaBotsPanel";
import GridBotsPanel from "./GridBotsPanel";
import AccountsLedgerSection from "./AccountsLedgerSection";

export default function QTradePage() {
  // ─── Live Markets ────────────────────────────────────────────────
  // Lazy-load from localStorage post-mount to avoid SSR hydration mismatch.
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [limits, setLimits] = useState<LimitOrder[]>([]);
  const [closedPositions, setClosedPositions] = useState<ClosedPosition[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [marketsReady, setMarketsReady] = useState(false);
  const [alertNote, setAlertNote] = useState("");
  const [alertPrice, setAlertPrice] = useState("");
  const [alertDir, setAlertDir] = useState<"above" | "below">("above");
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>("default");
  const [soundOn, setSoundOn] = useState(true);

  // Quick-alert modal (bell button in top bar — no pair selection needed)
  const [quickAlertOpen, setQuickAlertOpen] = useState(false);
  const [quickAlertPair, setQuickAlertPair] = useState<PairId>("BTC/USD");
  const [quickAlertDir, setQuickAlertDir] = useState<"above" | "below">("above");
  const [quickAlertPrice, setQuickAlertPrice] = useState("");
  const [quickAlertNote, setQuickAlertNote] = useState("");

  // Copy-to-clipboard toast
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const copyId = (id: string) => {
    try {
      navigator.clipboard.writeText(id).then(() => {
        setCopyToast(id.slice(0, 16) + "…");
        setTimeout(() => setCopyToast(null), 1800);
      }).catch(() => {});
    } catch {}
  };

  // Beep sound для price alerts через Web Audio API (no asset, генерируем sine)
  const playBeep = useCallback(() => {
    if (!soundOn) return;
    if (typeof window === "undefined") return;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = 880;       // A5
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.30);
      osc.start();
      osc.stop(ctx.currentTime + 0.32);
      // Auto-close context after sound to avoid leak
      setTimeout(() => { try { ctx.close(); } catch {/* ignore */} }, 400);
    } catch {/* AudioContext unavailable / blocked */}
  }, [soundOn]);
  useEffect(() => {
    try {
      const v = localStorage.getItem("aevion_qtrade_sound_v1");
      if (v === "0") setSoundOn(false);
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem("aevion_qtrade_sound_v1", soundOn ? "1" : "0"); } catch {}
  }, [soundOn]);
  const [activePair, setActivePair] = useState<PairId | null>(null);
  const [orderQty, setOrderQty] = useState("1");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [limitPrice, setLimitPrice] = useState("");
  // OCO bracket inputs (один qty + 2 цены — long-limit ниже / short-limit выше)
  const [ocoLowPrice, setOcoLowPrice] = useState("");
  const [ocoHighPrice, setOcoHighPrice] = useState("");
  const [tradeMsg, setTradeMsg] = useState<string | null>(null);
  const [bracketEditId, setBracketEditId] = useState<string | null>(null);
  const [bracketSL, setBracketSL] = useState("");
  const [bracketTP, setBracketTP] = useState("");
  const [bracketTSMin, setBracketTSMin] = useState(""); // time-stop в минутах
  const [bracketTrailPct, setBracketTrailPct] = useState(""); // trailing-stop offset %

  // Watchlist + active pair persistence
  const [watchlist, setWatchlist] = useState<Set<PairId>>(new Set());
  const [watchOnly, setWatchOnly] = useState(false);
  const [marketPrefsHydrated, setMarketPrefsHydrated] = useState(false);
  useEffect(() => {
    try {
      const w = localStorage.getItem("aevion_qtrade_watchlist_v1");
      if (w) {
        const parsed = JSON.parse(w);
        if (Array.isArray(parsed)) setWatchlist(new Set(parsed.filter((x): x is PairId => typeof x === "string")));
      }
      setWatchOnly(localStorage.getItem("aevion_qtrade_watch_only_v1") === "1");
      const ap = localStorage.getItem("aevion_qtrade_active_pair_v1");
      if (ap) setActivePair(ap as PairId);
    } catch {}
    setMarketPrefsHydrated(true);
  }, []);
  useEffect(() => {
    if (!marketPrefsHydrated) return;
    try { localStorage.setItem("aevion_qtrade_watchlist_v1", JSON.stringify([...watchlist])) } catch {}
  }, [watchlist, marketPrefsHydrated]);
  useEffect(() => {
    if (!marketPrefsHydrated) return;
    try { localStorage.setItem("aevion_qtrade_watch_only_v1", watchOnly ? "1" : "0") } catch {}
  }, [watchOnly, marketPrefsHydrated]);
  useEffect(() => {
    if (!marketPrefsHydrated) return;
    try {
      if (activePair) localStorage.setItem("aevion_qtrade_active_pair_v1", activePair);
      else localStorage.removeItem("aevion_qtrade_active_pair_v1");
    } catch {}
  }, [activePair, marketPrefsHydrated]);
  const toggleWatch = (id: PairId) => {
    setWatchlist((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ─── Position sizing calculator ──────────────────────────────────
  const [psAccount, setPsAccount] = useState("10000");
  const [psRisk, setPsRisk] = useState("1");
  const [psStop, setPsStop] = useState("");

  // AEV wallet (for AEV/USD spot conversion)
  const [aevWallet, setAevWallet] = useState<AEVWallet | null>(null);
  const [aevSpotQty, setAevSpotQty] = useState("");
  const [activeTheme, setActiveTheme] = useState<ThemeId>("default");
  useEffect(() => { setAevWallet(ldWallet()); setActiveTheme(ldActiveTheme()); }, []);
  useEffect(() => { if (aevWallet) svWallet(aevWallet) }, [aevWallet]);

  // ─── Trading Journal ─────────────────────────────────────────────
  const [journalEditId, setJournalEditId] = useState<string | null>(null);
  const [journalNote, setJournalNote] = useState("");
  const [journalTags, setJournalTags] = useState("");
  const [journalTagFilter, setJournalTagFilter] = useState<string | null>(null);

  // ─── Backtester ──────────────────────────────────────────────────
  const [btStrategy, setBtStrategy] = useState<StrategyKind>("dca");
  const [btPair, setBtPair] = useState<PairId>("BTC/USD");
  const [btDcaInterval, setBtDcaInterval] = useState("3");      // candles
  const [btDcaAmount, setBtDcaAmount] = useState("25");
  const [btDcaTrail, setBtDcaTrail] = useState("");             // optional trailing exit %
  const [btGridLow, setBtGridLow] = useState("");
  const [btGridHigh, setBtGridHigh] = useState("");
  const [btGridCount, setBtGridCount] = useState("8");
  const [btGridAmount, setBtGridAmount] = useState("25");
  const [btBnhTotal, setBtBnhTotal] = useState("1000");
  const [btBnhSL, setBtBnhSL] = useState(""); // optional stop-loss %
  const [btBnhTP, setBtBnhTP] = useState(""); // optional take-profit %
  const [btResult, setBtResult] = useState<BacktestResult | null>(null);

  useEffect(() => {
    setPairs(ldPairs().map((p) => catchupPair(p)));
    setPositions(ldPositions());
    setLimits(ldLimits());
    setClosedPositions(ldClosed());
    setAlerts(ldAlerts());
    if (typeof Notification !== "undefined") setNotifPerm(Notification.permission);
    setMarketsReady(true);
  }, []);

  // Tick price every 1000ms after markets are ready + auto-fill limit orders + SL/TP brackets
  useEffect(() => {
    if (!marketsReady) return;
    const id = setInterval(() => {
      setPairs((prev) => {
        if (prev.length === 0) return prev;
        const next = prev.map(tickPair);
        svPairs(next);
        // Check price alerts (compare prev vs new for crossing)
        setAlerts((prevAlerts) => {
          if (prevAlerts.length === 0) return prevAlerts;
          const fired: string[] = [];
          for (const np of next) {
            const op = prev.find((x) => x.id === np.id);
            if (!op) continue;
            for (const id of checkAlertHits(prevAlerts, np, op.price)) fired.push(id);
          }
          if (fired.length === 0) return prevAlerts;
          for (const id of fired) {
            const a = prevAlerts.find((x) => x.id === id);
            if (!a) continue;
            const np = next.find((x) => x.id === a.pair);
            if (!np) continue;
            const msg = `${a.pair} ${a.direction === "above" ? "↑" : "↓"} ${fmtUsd(a.price)} · сейчас ${fmtUsd(np.price)}`;
            // Browser notification (if granted)
            try {
              if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                new Notification("⚡ AEVION QTrade · price alert", { body: msg + (a.note ? ` — ${a.note}` : "") });
              }
            } catch {}
            // Audio beep (если включен toggle)
            playBeep();
            setTradeMsg(`🔔 ${msg}`);
            setTimeout(() => setTradeMsg(null), 4000);
          }
          return prevAlerts.filter((a) => !fired.includes(a.id));
        });
        // After tick, check whether any limit orders have crossed.
        setLimits((prevLimits) => {
          if (prevLimits.length === 0) return prevLimits;
          const fillIds = new Set<string>();
          for (const p of next) {
            for (const id2 of checkLimitFills(prevLimits, p)) fillIds.add(id2);
          }
          if (fillIds.size === 0) return prevLimits;
          // OCO: cancel siblings of filled orders that share ocoGroupId
          const ocoCancelled = ocoCancellations(prevLimits, Array.from(fillIds));
          // Convert filled limit orders into positions
          const newPositions: Position[] = [];
          const remaining: LimitOrder[] = [];
          for (const o of prevLimits) {
            if (fillIds.has(o.id)) {
              const pair = next.find((x) => x.id === o.pair);
              if (!pair) { remaining.push(o); continue; }
              newPositions.push({
                id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
                pair: o.pair, side: o.side, qty: o.qty,
                entryPrice: pair.price, entryTs: Date.now(),
                entryMode: "maker",
              });
            } else if (ocoCancelled.has(o.id)) {
              // dropped — OCO sibling was filled
              continue;
            } else {
              remaining.push(o);
            }
          }
          if (newPositions.length > 0) {
            setPositions((pp) => [...newPositions, ...pp]);
            const f = newPositions[0];
            const ocoSuffix = ocoCancelled.size > 0 ? ` · OCO cancelled ${ocoCancelled.size}` : "";
            setTradeMsg(`⚡ Limit filled · ${f.side === "long" ? "Long" : "Short"} ${f.qty} ${f.pair.split("/")[0]} @ ${fmtUsd(f.entryPrice)}${ocoSuffix}`);
            setTimeout(() => setTradeMsg(null), 3000);
          }
          svLimits(remaining);
          return remaining;
        });
        // Check SL/TP/TS/TR brackets on open positions; update trailing peak first
        setPositions((prevPos) => {
          if (prevPos.length === 0) return prevPos;
          const stillOpen: Position[] = [];
          const triggered: { pos: Position; reason: "tp" | "sl" | "ts" | "tr"; price: number }[] = [];
          for (const rawPos of prevPos) {
            const pair = next.find((x) => x.id === rawPos.pair);
            if (!pair) { stillOpen.push(rawPos); continue; }
            const pos = updateTrailingPeak(rawPos, pair.price);
            const hit = checkBracketHit(pos, pair.price);
            if (hit) triggered.push({ pos, reason: hit, price: pair.price });
            else stillOpen.push(pos);
          }
          if (triggered.length === 0) return prevPos;
          const fees = ldFees();
          const newClosed: ClosedPosition[] = triggered.map(({ pos, price }) => {
            // Bracket exit = market = taker; entryMode наследуется с позиции;
            // пара берёт свой override (AEV/USD = 0% maker promo).
            const r = closeWithFees(pos, price, feesForPair(pos.pair, fees), "taker", pos.entryMode ?? "taker");
            return { ...buildClosed(pos, r.exitPrice), realizedPnl: r.realizedPnl, realizedPct: r.realizedPct };
          });
          setClosedPositions((cs) => [...newClosed, ...cs].slice(0, 200));
          // Mint AEV per profitable bracket-close
          const profitableCount = newClosed.filter((c) => c.realizedPnl > 0).length;
          if (profitableCount > 0) {
            setAevWallet((w) => {
              if (!w) return w;
              let next2 = w;
              for (let i = 0; i < profitableCount; i++) {
                next2 = recordPlay(next2, "qtrade_close_winning", "qtrade");
              }
              return next2;
            });
          }
          const t = triggered[0];
          const reasonLabel =
            t.reason === "tp" ? "🎯 TP"
            : t.reason === "sl" ? "🛑 SL"
            : t.reason === "ts" ? "⏱ Time-stop"
            : "📉 Trailing";
          setTradeMsg(
            `${reasonLabel} hit · ${t.pos.side === "long" ? "Long" : "Short"} ${t.pos.qty} ${t.pos.pair.split("/")[0]} @ ${fmtUsd(t.price)}` +
            (newClosed[0].realizedPnl >= 0 ? ` · +${fmtUsd(newClosed[0].realizedPnl)}` : ` · ${fmtUsd(newClosed[0].realizedPnl)}`),
          );
          setTimeout(() => setTradeMsg(null), 3500);
          return stillOpen;
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [marketsReady]);

  // Persist positions/limits/closed/alerts when they change (bots/gridBots
  // persist themselves — see DcaBotsPanel/GridBotsPanel, issue #765)
  useEffect(() => { if (marketsReady) svPositions(positions); }, [positions, marketsReady]);
  useEffect(() => { if (marketsReady) svLimits(limits); }, [limits, marketsReady]);
  useEffect(() => { if (marketsReady) svClosed(closedPositions); }, [closedPositions, marketsReady]);
  useEffect(() => { if (marketsReady) svAlerts(alerts); }, [alerts, marketsReady]);

  // ─── Cross-tab sync ───────────────────────────────────────────────
  // Другой tab пишет в localStorage → синхронизируем local state.
  // Wallet особенно важен — buyAev/sellAev в spot-секции должны пересчитать
  // балланс если /aev tab его поменял (mining / staking / claim).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      switch (e.key) {
        case "aevion_aev_wallet_v1":        setAevWallet(ldWallet()); break;
        case "aevion_qtrade_positions_v1":  setPositions(ldPositions()); break;
        case "aevion_qtrade_limits_v1":     setLimits(ldLimits()); break;
        case "aevion_qtrade_closed_v1":     setClosedPositions(ldClosed()); break;
        case "aevion_qtrade_alerts_v1":     setAlerts(ldAlerts()); break;
        case "aevion_aev_active_theme_v1":  setActiveTheme(ldActiveTheme()); break;
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Grid Bot and DCA Bot ticks (1500ms / 2000ms) now live in their own
  // GridBotsPanel/DcaBotsPanel components (see those files) — extracting
  // them stops those two ticking setState calls from forcing this whole
  // (very large) QTrade page to re-render every 1.5s/2s. See issue #765.
  // mintAev is the shared AEV Proof-of-Play callback passed down to both
  // panels (and used below for bracket-close/manual-close mints) — the AEV
  // wallet itself stays here since it's shared with the rest of qtrade
  // (spot conversion section etc).
  const mintAev = useCallback((kind: "qtrade_close_winning" | "qtrade_dca_run", times: number) => {
    setAevWallet((w) => {
      if (!w) return w;
      let cur = w;
      for (let i = 0; i < times; i++) cur = recordPlay(cur, kind, "qtrade");
      return cur;
    });
  }, []);

  const pairById = useMemo(() => {
    const m = new Map<PairId, Pair>();
    for (const p of pairs) m.set(p.id, p);
    return m;
  }, [pairs]);

  const totalUnrealized = useMemo(() => {
    let sum = 0;
    for (const pos of positions) {
      const cur = pairById.get(pos.pair);
      if (cur) sum += unrealizedPnl(pos, cur.price);
    }
    return sum;
  }, [positions, pairById]);

  // 30-day portfolio sparkline: use equity points from closed positions if available,
  // otherwise generate a seeded random walk for visual interest.
  const portfolioSparkline30 = useMemo((): number[] => {
    const N = 30;
    if (closedPositions.length >= 3) {
      // Build daily buckets from closed positions (last 30 days)
      const now = Date.now();
      const MS_DAY = 86_400_000;
      const buckets = Array<number>(N).fill(0);
      for (const c of closedPositions) {
        const daysAgo = Math.floor((now - c.exitTs) / MS_DAY);
        if (daysAgo >= 0 && daysAgo < N) {
          buckets[N - 1 - daysAgo] += c.realizedPnl;
        }
      }
      // Turn daily deltas into cumulative equity
      const cum: number[] = [];
      let acc = 0;
      for (const d of buckets) { acc += d; cum.push(acc); }
      return cum;
    }
    // Seeded random walk based on pair count (deterministic across renders)
    const seed = pairs.length * 17 + 42;
    const pts: number[] = [];
    let val = 0;
    let rng = seed;
    for (let i = 0; i < N; i++) {
      rng = (rng * 1664525 + 1013904223) & 0xffffffff;
      const delta = ((rng >>> 0) / 0xffffffff - 0.45) * 120;
      val += delta;
      pts.push(val);
    }
    return pts;
  }, [closedPositions, pairs.length]);

  const submitOrder = (pid: PairId, side: "long" | "short") => {
    const cur = pairById.get(pid);
    if (!cur) return;
    const q = Number(orderQty);
    if (!Number.isFinite(q) || q <= 0) {
      setTradeMsg("Введи положительное количество");
      return;
    }
    const fees = ldFees();
    if (fees.enabled && dailyLossExceeded(closedPositions, fees)) {
      setTradeMsg(`🛑 Daily-loss limit ${fmtUsd(fees.dailyLossLimitUsd ?? 0)} достигнут — новые ордера заблокированы`);
      setTimeout(() => setTradeMsg(null), 3500);
      return;
    }
    if (orderType === "market") {
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const pairFees = feesForPair(pid, fees);
      const fillPrice = slipEntryPrice(cur.price, side, pairFees);
      const pos: Position = { id, pair: pid, side, qty: q, entryPrice: fillPrice, entryTs: Date.now(), entryMode: "taker" };
      setPositions((prev) => [pos, ...prev]);
      setTradeMsg(`✓ ${side === "long" ? "Long" : "Short"} ${q} ${cur.symbol} @ ${fmtUsd(fillPrice)}`);
      setTimeout(() => setTradeMsg(null), 2400);
      return;
    }
    // Limit order
    const trigger = Number(limitPrice);
    if (!Number.isFinite(trigger) || trigger <= 0) {
      setTradeMsg("Введи цену исполнения");
      return;
    }
    // Sanity check: long limit should be below current price; short limit above.
    if (side === "long" && trigger >= cur.price) {
      setTradeMsg(`Long-limit должен быть ниже текущей ${fmtUsd(cur.price)} (иначе исполнится мгновенно)`);
      return;
    }
    if (side === "short" && trigger <= cur.price) {
      setTradeMsg(`Short-limit должен быть выше текущей ${fmtUsd(cur.price)}`);
      return;
    }
    const order: LimitOrder = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      pair: pid, side, qty: q, triggerPrice: trigger, createdTs: Date.now(),
    };
    setLimits((prev) => [order, ...prev]);
    setTradeMsg(`📌 Limit ${side === "long" ? "long" : "short"} ${q} ${cur.symbol} @ ${fmtUsd(trigger)}`);
    setTimeout(() => setTradeMsg(null), 2400);
  };

  // OCO bracket: ставим long-limit ниже + short-limit выше с одним ocoGroupId.
  // Fill одного отменяет другой. Хороший exit-bracket для уже открытой позиции
  // (manual SL/TP через limits) или straddle-entry.
  const submitOcoBracket = (pid: PairId) => {
    const cur = pairById.get(pid);
    if (!cur) return;
    const q = Number(orderQty);
    if (!Number.isFinite(q) || q <= 0) {
      setTradeMsg("Введи положительное количество");
      return;
    }
    const fees = ldFees();
    if (fees.enabled && dailyLossExceeded(closedPositions, fees)) {
      setTradeMsg(`🛑 Daily-loss limit достигнут — OCO заблокирован`);
      setTimeout(() => setTradeMsg(null), 3500);
      return;
    }
    const lo = Number(ocoLowPrice);
    const hi = Number(ocoHighPrice);
    if (!Number.isFinite(lo) || lo <= 0 || !Number.isFinite(hi) || hi <= 0) {
      setTradeMsg("Введи обе цены OCO (low + high)");
      return;
    }
    if (lo >= cur.price) { setTradeMsg(`OCO low должна быть ниже текущей ${fmtUsd(cur.price)}`); return; }
    if (hi <= cur.price) { setTradeMsg(`OCO high должна быть выше текущей ${fmtUsd(cur.price)}`); return; }
    const groupId = `oco-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const longOrder: LimitOrder = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}-l`,
      pair: pid, side: "long", qty: q, triggerPrice: lo, createdTs: Date.now(), ocoGroupId: groupId,
    };
    const shortOrder: LimitOrder = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}-s`,
      pair: pid, side: "short", qty: q, triggerPrice: hi, createdTs: Date.now(), ocoGroupId: groupId,
    };
    setLimits((prev) => [longOrder, shortOrder, ...prev]);
    setTradeMsg(`📍 OCO ${q} ${cur.symbol} · long @ ${fmtUsd(lo)} / short @ ${fmtUsd(hi)}`);
    setTimeout(() => setTradeMsg(null), 2800);
  };

  const cancelLimit = (id: string) => {
    setLimits((prev) => prev.filter((l) => l.id !== id));
    setTradeMsg("✓ Limit отменён");
    setTimeout(() => setTradeMsg(null), 1800);
  };

  const startEditBrackets = (pos: Position) => {
    setBracketEditId(pos.id);
    setBracketSL(pos.stopLoss !== undefined ? String(pos.stopLoss) : "");
    setBracketTP(pos.takeProfit !== undefined ? String(pos.takeProfit) : "");
    setBracketTSMin(pos.maxHoldMs !== undefined && pos.maxHoldMs > 0 ? String(Math.round(pos.maxHoldMs / 60_000)) : "");
    setBracketTrailPct(pos.trailingPct !== undefined && pos.trailingPct > 0 ? String(pos.trailingPct) : "");
  };

  const saveBrackets = (posId: string) => {
    const sl = bracketSL.trim() === "" ? undefined : Number(bracketSL);
    const tp = bracketTP.trim() === "" ? undefined : Number(bracketTP);
    const tsMin = bracketTSMin.trim() === "" ? undefined : Number(bracketTSMin);
    const trailPct = bracketTrailPct.trim() === "" ? undefined : Number(bracketTrailPct);
    if (sl !== undefined && (!Number.isFinite(sl) || sl <= 0)) { setTradeMsg("SL: положительная цена"); return; }
    if (tp !== undefined && (!Number.isFinite(tp) || tp <= 0)) { setTradeMsg("TP: положительная цена"); return; }
    if (tsMin !== undefined && (!Number.isFinite(tsMin) || tsMin <= 0)) { setTradeMsg("Time-stop: положительные минуты"); return; }
    if (trailPct !== undefined && (!Number.isFinite(trailPct) || trailPct <= 0 || trailPct >= 100)) {
      setTradeMsg("Trailing: процент в (0, 100)");
      return;
    }
    const maxHoldMs = tsMin !== undefined ? Math.round(tsMin * 60_000) : undefined;
    setPositions((prev) => prev.map((p) => {
      if (p.id !== posId) return p;
      const cur = pairById.get(p.pair);
      const px = cur?.price ?? p.entryPrice;
      // Sanity: long → SL < px < TP; short → TP < px < SL
      if (p.side === "long") {
        if (sl !== undefined && sl >= px) { setTradeMsg(`SL должен быть ниже текущей ${fmtUsd(px)} для long`); return p; }
        if (tp !== undefined && tp <= px) { setTradeMsg(`TP должен быть выше текущей ${fmtUsd(px)} для long`); return p; }
      } else {
        if (sl !== undefined && sl <= px) { setTradeMsg(`SL должен быть выше текущей ${fmtUsd(px)} для short`); return p; }
        if (tp !== undefined && tp >= px) { setTradeMsg(`TP должен быть ниже текущей ${fmtUsd(px)} для short`); return p; }
      }
      // Reset trailing peak when toggling on/off — иначе стартуем с current price
      const trailingPeak = trailPct !== undefined ? px : undefined;
      return { ...p, stopLoss: sl, takeProfit: tp, maxHoldMs, trailingPct: trailPct, trailingPeak };
    }));
    setBracketEditId(null);
    setTradeMsg("✓ Brackets сохранены");
    setTimeout(() => setTradeMsg(null), 1800);
  };

  const clearBrackets = (posId: string) => {
    setPositions((prev) => prev.map((p) => p.id === posId ? { ...p, stopLoss: undefined, takeProfit: undefined, maxHoldMs: undefined, trailingPct: undefined, trailingPeak: undefined } : p));
    setBracketEditId(null);
  };

  const requestNotifPerm = async () => {
    try {
      if (typeof Notification === "undefined") return;
      const res = await Notification.requestPermission();
      setNotifPerm(res);
    } catch {}
  };

  const addAlert = (pid: PairId) => {
    const cur = pairById.get(pid);
    if (!cur) return;
    const px = Number(alertPrice);
    if (!Number.isFinite(px) || px <= 0) { setTradeMsg("Введи цену"); return; }
    const a: PriceAlert = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      pair: pid,
      direction: alertDir,
      price: px,
      createdTs: Date.now(),
      note: alertNote.trim() || undefined,
    };
    setAlerts((prev) => [a, ...prev]);
    setAlertPrice(""); setAlertNote("");
    setTradeMsg(`🔔 Alert ${alertDir === "above" ? "↑" : "↓"} ${fmtUsd(px)}`);
    setTimeout(() => setTradeMsg(null), 2400);
  };

  const removeAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const addQuickAlert = () => {
    const px = Number(quickAlertPrice);
    if (!Number.isFinite(px) || px <= 0) { setTradeMsg("Введи цену для алерта"); return; }
    const a: PriceAlert = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      pair: quickAlertPair,
      direction: quickAlertDir,
      price: px,
      createdTs: Date.now(),
      note: quickAlertNote.trim() || undefined,
    };
    setAlerts((prev) => [a, ...prev]);
    setQuickAlertPrice(""); setQuickAlertNote("");
    setQuickAlertOpen(false);
    setTradeMsg(`🔔 Alert ${quickAlertDir === "above" ? "↑" : "↓"} ${fmtUsd(px)} on ${quickAlertPair}`);
    setTimeout(() => setTradeMsg(null), 2400);
  };

  const closePosition = (posId: string) => {
    setPositions((prev) => {
      const target = prev.find((p) => p.id === posId);
      if (!target) return prev;
      const cur = pairById.get(target.pair);
      if (!cur) return prev;
      // Manual close = market exit = taker; entryMode из позиции (legacy ⇒ taker);
      // пара получает promo override (AEV/USD = 0% maker).
      const r = closeWithFees(target, cur.price, feesForPair(target.pair, ldFees()), "taker", target.entryMode ?? "taker");
      const closed: ClosedPosition = {
        ...buildClosed(target, r.exitPrice),
        realizedPnl: r.realizedPnl,
        realizedPct: r.realizedPct,
      };
      setClosedPositions((cs) => [closed, ...cs].slice(0, 200));
      // Auto-mint AEV via Proof-of-Play when the trade was profitable.
      if (closed.realizedPnl > 0) {
        setAevWallet((w) => (w ? recordPlay(w, "qtrade_close_winning", "qtrade") : w));
      }
      const pnl = closed.realizedPnl;
      const aevHint = pnl > 0 ? " · +AEV в кошелёк" : "";
      setTradeMsg(`✓ Закрыто · P&L ${pnl >= 0 ? "+" : ""}${fmtUsd(pnl)} (${fmtPct(closed.realizedPct)})${aevHint}`);
      setTimeout(() => setTradeMsg(null), 3000);
      return prev.filter((p) => p.id !== posId);
    });
  };
  // ─────────────────────────────────────────────────────────────────

  return (
    <main>
      <ProductPageShell maxWidth={1000}>
      <Wave1Nav />
      <PitchValueCallout moduleId="qtrade" variant="dark" />
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>QTrade</h1>
      <div style={{ color: "#666", marginBottom: 16 }}>
        Live Markets с симулированной ценой и торговый ledger. Данные ledger'а — backend disk (
        <code style={{ fontSize: 13 }}>.aevion-data/qtrade.json</code>); цены и позиции
        — клиентский localStorage.
      </div>

      <FeesPanel closed={closedPositions} />

      {/* ═══ LIVE MARKETS ══════════════════════════════════════════ */}
      <section
        style={{
          marginBottom: 24,
          padding: 16,
          borderRadius: 12,
          background: THEME_PALETTES[activeTheme].hero,
          color: "#fff",
          boxShadow: `0 8px 24px ${THEME_PALETTES[activeTheme].glow}`,
          transition: "background 0.4s, box-shadow 0.4s",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: THEME_PALETTES[activeTheme].accent }}>📊 Live Markets</span>
            {activeTheme !== "default" && (
              <span style={{
                padding: "2px 8px", borderRadius: 999,
                background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.20)",
                fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: "#fff", textTransform: "uppercase" as const,
              }}>
                🎨 {THEME_PALETTES[activeTheme].label}
              </span>
            )}
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "2px 8px", borderRadius: 999,
              background: "rgba(34,197,94,0.18)", border: "1px solid rgba(34,197,94,0.45)",
              fontSize: 10, fontWeight: 800, color: "#86efac",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: "#22c55e", animation: "qt-pulse 1.4s ease-in-out infinite" }} />
              SIMULATED · 1s tick
            </span>
            {/* Watchlist filter toggle */}
            <button
              onClick={() => setWatchOnly((v) => !v)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "3px 10px", borderRadius: 999, border: "none", cursor: "pointer",
                background: watchOnly ? "rgba(251,191,36,0.25)" : "rgba(255,255,255,0.07)",
                color: watchOnly ? "#fbbf24" : "#94a3b8",
                fontSize: 11, fontWeight: 800,
                transition: "all 0.2s",
              }}
            >
              {watchOnly ? "★" : "☆"} Watchlist
            </button>
          </div>
          <div style={{ fontSize: 13, color: "#cbd5e1" }}>
            Открытые позиции: <strong style={{ color: "#fff" }}>{positions.length}</strong>
            <span style={{ margin: "0 8px", color: "#475569" }}>·</span>
            Unrealized P&L: <strong style={{ color: totalUnrealized > 0 ? "#22c55e" : totalUnrealized < 0 ? "#f87171" : "#cbd5e1" }}>
              {totalUnrealized >= 0 ? "+" : ""}{fmtUsd(totalUnrealized)}
            </strong>
          </div>
        </div>

        {/* Pair cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 14 }}>
          {pairs.filter((p) => !watchOnly || watchlist.has(p.id)).map((p) => {
            const change24 = ((p.price - p.open24h) / p.open24h) * 100;
            const tickUp = p.price >= p.prevPrice;
            const isActive = activePair === p.id;
            const isWatched = watchlist.has(p.id);
            const sparkColor = change24 >= 0 ? "#22c55e" : "#f87171";
            return (
              <div key={p.id} style={{ position: "relative" }}>
                {/* Star button */}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleWatch(p.id); }}
                  aria-label={(isWatched ? "Убрать из вотчлиста: " : "Добавить в вотчлист: ") + p.id}
                  title={isWatched ? "Remove from watchlist" : "Add to watchlist"}
                  style={{
                    position: "absolute", top: 8, right: 8, zIndex: 2,
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 16, lineHeight: 1,
                    color: isWatched ? "#fbbf24" : "rgba(255,255,255,0.3)",
                    transition: "color 0.2s",
                    padding: 2,
                  }}
                >
                  {isWatched ? "★" : "☆"}
                </button>
                <button
                  onClick={() => setActivePair((cur) => (cur === p.id ? null : p.id))}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: isActive ? "rgba(34,211,238,0.12)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${isActive ? "#22d3ee" : "rgba(255,255,255,0.1)"}`,
                    borderRadius: 10,
                    padding: 12,
                    cursor: "pointer",
                    color: "#fff",
                    transition: "background 0.2s, border 0.2s",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", paddingRight: 20 }}>
                    <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: 0.4 }}>{p.symbol}</span>
                    <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700 }}>{p.name}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                    <span style={{
                      fontFamily: "ui-monospace, SFMono-Regular, monospace",
                      fontWeight: 900,
                      fontSize: 19,
                      color: tickUp ? "#86efac" : "#fca5a5",
                      transition: "color 0.4s",
                    }}>
                      {fmtUsd(p.price)}
                    </span>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: change24 >= 0 ? "#22c55e" : "#f87171",
                    }}>
                      {fmtPct(change24)}
                    </span>
                  </div>
                  <svg viewBox="0 0 100 30" preserveAspectRatio="none" style={{ width: "100%", height: 30, display: "block" }}>
                    <path d={sparklinePath(p.history, 100, 30)} stroke={sparkColor} strokeWidth={1.4} fill="none" opacity={0.85} />
                  </svg>
                  <div style={{ fontSize: 10, color: "#64748b", letterSpacing: 0.4, fontWeight: 700 }}>
                    {isActive ? "▼ свернуть" : "▶ торговать"}
                  </div>
                </button>
              </div>
            );
          })}
          {watchOnly && watchlist.size === 0 && (
            <div style={{ gridColumn: "1/-1", padding: 24, textAlign: "center" as const, color: "#64748b", fontSize: 13 }}>
              Нет пар в вотчлисте. Нажми ☆ на карточке пары, чтобы добавить.
            </div>
          )}
        </div>

        {/* OHLC candle chart for active pair */}
        {activePair && (() => {
          const p = pairById.get(activePair);
          if (!p || !p.candles || p.candles.length < 2) return null;
          return <CandleChart pair={p} />;
        })()}

        {/* Trade panel + Order book (responsive 2-column) */}
        {activePair && (() => {
          const p = pairById.get(activePair);
          if (!p) return null;
          const change24 = ((p.price - p.open24h) / p.open24h) * 100;
          const ob = buildOrderBook(p, 6);
          const maxBidSize = Math.max(...ob.bids.map((l) => l.size), 1);
          const maxAskSize = Math.max(...ob.asks.map((l) => l.size), 1);
          return (
            <div style={{
              padding: 12, borderRadius: 10,
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr)", gap: 14,
            }}>
              {/* LEFT: trade panel */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 16, fontWeight: 900 }}>{p.symbol}</span>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 800, fontSize: 18 }}>{fmtUsd(p.price)}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: change24 >= 0 ? "#86efac" : "#fca5a5" }}>{fmtPct(change24)}</span>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>· vol {p.vol >= 0.004 ? "high" : p.vol >= 0.003 ? "med" : "low"}</span>
                </div>
                {/* ──── AEV/USD SPOT — конвертация из/в кошелёк /aev ──── */}
                {p.id === "AEV/USD" && aevWallet && (
                  <div style={{
                    padding: "10px 12px", borderRadius: 8, marginBottom: 10,
                    background: "rgba(34,211,238,0.10)", border: "1px solid rgba(34,211,238,0.35)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, color: "#67e8f9", textTransform: "uppercase" as const }}>
                        ◆ Spot · из/в кошелёк AEV
                      </span>
                      <a href="/aev" style={{ fontSize: 11, color: "#22d3ee", textDecoration: "none", fontWeight: 700 }}>
                        В кошельке: <strong>{aevWallet.balance.toFixed(4)} AEV</strong> →
                      </a>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <input aria-label="qty AEV"
                        value={aevSpotQty}
                        onChange={(e) => setAevSpotQty(e.target.value)}
                        type="number"
                        min={0}
                        step="any"
                        placeholder="qty AEV"
                        style={{
                          width: 130, padding: "6px 10px", borderRadius: 6,
                          border: "1px solid #334155", background: "#0f172a", color: "#fff",
                          fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 13,
                        }}
                      />
                      <button
                        onClick={() => {
                          const q = Number(aevSpotQty);
                          if (!Number.isFinite(q) || q <= 0) { setTradeMsg("Введи qty"); return; }
                          if (!aevWallet || aevWallet.balance < q) { setTradeMsg("Недостаточно AEV в кошельке"); return; }
                          const next = sellAev(aevWallet, q, p.price);
                          if (next) {
                            setAevWallet(next); setAevSpotQty("");
                            setTradeMsg(`✓ Продано ${q} AEV @ ${fmtUsd(p.price)} ≈ ${fmtUsd(q * p.price)}`);
                            setTimeout(() => setTradeMsg(null), 2400);
                          }
                        }}
                        style={{
                          padding: "7px 14px", borderRadius: 6, border: "none",
                          background: "linear-gradient(135deg, #b45309, #d97706)", color: "#fff",
                          fontWeight: 800, fontSize: 12, cursor: "pointer",
                        }}
                      >
                        💵 Sell spot
                      </button>
                      <button
                        onClick={() => {
                          const q = Number(aevSpotQty);
                          if (!Number.isFinite(q) || q <= 0) { setTradeMsg("Введи qty"); return; }
                          if (!aevWallet) return;
                          const next = buyAev(aevWallet, q, p.price);
                          setAevWallet(next); setAevSpotQty("");
                          setTradeMsg(`✓ Куплено ${q} AEV @ ${fmtUsd(p.price)} ≈ ${fmtUsd(q * p.price)}`);
                          setTimeout(() => setTradeMsg(null), 2400);
                        }}
                        style={{
                          padding: "7px 14px", borderRadius: 6, border: "none",
                          background: "linear-gradient(135deg, #166534, #16a34a)", color: "#fff",
                          fontWeight: 800, fontSize: 12, cursor: "pointer",
                        }}
                      >
                        🛒 Buy spot
                      </button>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>
                        ≈ {Number(aevSpotQty) > 0 ? fmtUsd(Number(aevSpotQty) * p.price) : "—"}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: "#64748b", marginTop: 6 }}>
                      Spot касается твоего AEV-кошелька. Long/Short ниже — это derivatives, не трогают баланс.
                    </div>
                  </div>
                )}
                {/* Order type toggle */}
                <div style={{ display: "inline-flex", marginBottom: 10, borderRadius: 6, overflow: "hidden", border: "1px solid #334155" }}>
                  {(["market", "limit"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setOrderType(t)}
                      style={{
                        padding: "5px 14px", border: "none",
                        background: orderType === t ? "#22d3ee" : "transparent",
                        color: orderType === t ? "#0f172a" : "#cbd5e1",
                        fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase",
                        cursor: "pointer",
                      }}
                    >
                      {t === "market" ? "Market" : "Limit"}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <label style={{ fontSize: 12, color: "#cbd5e1", fontWeight: 700 }}>Qty</label>
                  <input
                    value={orderQty}
                    onChange={(e) => setOrderQty(e.target.value)}
                    type="number"
                    min={0}
                    step="any"
                    style={{
                      width: 110, padding: "6px 10px", borderRadius: 6,
                      border: "1px solid #334155", background: "#0f172a", color: "#fff",
                      fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 13,
                    }}
                  />
                  {orderType === "limit" && (
                    <>
                      <label style={{ fontSize: 12, color: "#cbd5e1", fontWeight: 700 }}>@</label>
                      <input
                        value={limitPrice}
                        onChange={(e) => setLimitPrice(e.target.value)}
                        type="number"
                        min={0}
                        step="any"
                        placeholder={p.price.toFixed(p.price > 100 ? 2 : 4)}
                        style={{
                          width: 130, padding: "6px 10px", borderRadius: 6,
                          border: "1px solid #334155", background: "#0f172a", color: "#fff",
                          fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 13,
                        }}
                      />
                    </>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button
                    onClick={() => submitOrder(p.id, "long")}
                    style={{
                      padding: "8px 16px", borderRadius: 6, border: "none",
                      background: "linear-gradient(135deg, #16a34a, #22c55e)", color: "#fff",
                      fontWeight: 800, fontSize: 13, cursor: "pointer",
                      boxShadow: "0 2px 8px rgba(34,197,94,0.25)",
                    }}
                  >
                    ▲ {orderType === "market" ? "LONG @ market" : "LONG @ limit"}
                  </button>
                  <button
                    onClick={() => submitOrder(p.id, "short")}
                    style={{
                      padding: "8px 16px", borderRadius: 6, border: "none",
                      background: "linear-gradient(135deg, #dc2626, #ef4444)", color: "#fff",
                      fontWeight: 800, fontSize: 13, cursor: "pointer",
                      boxShadow: "0 2px 8px rgba(220,38,38,0.25)",
                    }}
                  >
                    ▼ {orderType === "market" ? "SHORT @ market" : "SHORT @ limit"}
                  </button>
                </div>
                {/* OCO bracket: paired long-limit (low) + short-limit (high), fill cancels sibling */}
                <details style={{ marginTop: 10 }}>
                  <summary
                    style={{
                      cursor: "pointer", fontSize: 11, fontWeight: 800, color: "#a5b4fc",
                      letterSpacing: 0.5, textTransform: "uppercase", padding: "4px 0",
                    }}
                  >
                    📍 OCO bracket — long-low / short-high (fill cancels sibling)
                  </summary>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" as const, marginTop: 6 }}>
                    <input
                      value={ocoLowPrice}
                      onChange={(e) => setOcoLowPrice(e.target.value)}
                      type="number" min={0} step="any"
                      placeholder={`< ${fmtUsd(p.price)}`}
                      aria-label={`OCO low price for ${p.id}`}
                      style={{
                        width: 110, padding: "5px 8px", borderRadius: 4,
                        border: "1px solid rgba(34,197,94,0.4)", background: "#0f172a", color: "#fff",
                        fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 700,
                      }}
                    />
                    <span style={{ fontSize: 11, color: "#64748b" }}>/</span>
                    <input
                      value={ocoHighPrice}
                      onChange={(e) => setOcoHighPrice(e.target.value)}
                      type="number" min={0} step="any"
                      placeholder={`> ${fmtUsd(p.price)}`}
                      aria-label={`OCO high price for ${p.id}`}
                      style={{
                        width: 110, padding: "5px 8px", borderRadius: 4,
                        border: "1px solid rgba(220,38,38,0.4)", background: "#0f172a", color: "#fff",
                        fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 700,
                      }}
                    />
                    <button
                      onClick={() => submitOcoBracket(p.id)}
                      style={{
                        padding: "5px 12px", borderRadius: 5, border: "none",
                        background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff",
                        fontSize: 11, fontWeight: 800, cursor: "pointer",
                      }}
                    >
                      📍 Place OCO
                    </button>
                  </div>
                </details>
                {tradeMsg && (
                  <div style={{ marginTop: 10, fontSize: 12, color: "#86efac", fontWeight: 700 }}>{tradeMsg}</div>
                )}
                {/* Price alerts */}
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px dashed rgba(255,255,255,0.1)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap" as const, gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5, color: "#94a3b8", textTransform: "uppercase" as const }}>
                      🔔 Price alerts
                    </span>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" as const, flexWrap: "wrap" as const }}>
                      <button onClick={() => setSoundOn((v) => !v)}
                        aria-label={soundOn ? "Выключить звук price-алертов" : "Включить звук price-алертов"}
                        title={soundOn ? "Звук вкл (sine 880Hz beep)" : "Звук выкл"}
                        style={{
                          padding: "3px 8px", borderRadius: 4,
                          border: `1px solid ${soundOn ? "rgba(134,239,172,0.4)" : "#334155"}`,
                          background: "transparent",
                          color: soundOn ? "#86efac" : "#94a3b8",
                          fontSize: 10, fontWeight: 700, cursor: "pointer",
                        }}>
                        {soundOn ? "🔊 Sound" : "🔇 Muted"}
                      </button>
                      {notifPerm !== "granted" && (
                        <button onClick={requestNotifPerm}
                          style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(34,211,238,0.4)", background: "transparent", color: "#67e8f9", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                          {notifPerm === "denied" ? "🚫 Уведомления запрещены" : "✓ Включить уведомления"}
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, alignItems: "center" }}>
                    <select value={alertDir} onChange={(e) => setAlertDir(e.target.value as "above" | "below")}
                      style={{ padding: "5px 8px", borderRadius: 4, border: "1px solid #334155", background: "#0f172a", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      <option value="above">↑ Above</option>
                      <option value="below">↓ Below</option>
                    </select>
                    <input value={alertPrice} onChange={(e) => setAlertPrice(e.target.value)} type="number" min={0} step="any"
                      placeholder={p.price.toFixed(p.price > 100 ? 2 : 4)}
                      style={{ width: 110, padding: "5px 8px", borderRadius: 4, border: "1px solid #334155", background: "#0f172a", color: "#fff", fontSize: 11, fontFamily: "ui-monospace, monospace" }} />
                    <input aria-label="заметка" value={alertNote} onChange={(e) => setAlertNote(e.target.value)} maxLength={40}
                      placeholder="заметка (optional)"
                      style={{ flex: "1 1 120px", minWidth: 0, padding: "5px 8px", borderRadius: 4, border: "1px solid #334155", background: "#0f172a", color: "#fff", fontSize: 11 }} />
                    <button onClick={() => addAlert(p.id)}
                      disabled={!alertPrice || Number(alertPrice) <= 0}
                      style={{
                        padding: "5px 12px", borderRadius: 4, border: "none",
                        background: !alertPrice || Number(alertPrice) <= 0 ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #0891b2, #06b6d4)",
                        color: "#fff", fontSize: 11, fontWeight: 800,
                        cursor: !alertPrice || Number(alertPrice) <= 0 ? "default" : "pointer",
                      }}>
                      + Set
                    </button>
                  </div>
                  {/* Active alerts on this pair */}
                  {(() => {
                    const myAlerts = alerts.filter((a) => a.pair === p.id);
                    if (myAlerts.length === 0) return null;
                    return (
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const, marginTop: 6 }}>
                        {myAlerts.map((a) => (
                          <span key={a.id} style={{
                            display: "inline-flex", alignItems: "center" as const, gap: 5,
                            padding: "3px 8px", borderRadius: 4,
                            background: "rgba(34,211,238,0.12)", border: "1px solid rgba(34,211,238,0.35)",
                            fontSize: 10, fontWeight: 700, color: "#67e8f9",
                            fontFamily: "ui-monospace, monospace",
                          }} title={a.note}>
                            {a.direction === "above" ? "↑" : "↓"} {fmtUsd(a.price)}
                            {a.note && <span style={{ opacity: 0.7 }}>· {a.note.slice(0, 20)}</span>}
                            <button onClick={() => removeAlert(a.id)}
                              style={{ background: "transparent", border: "none", color: "#67e8f9", cursor: "pointer", padding: 0, fontSize: 12, lineHeight: 1, marginLeft: 2 }}>
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
              {/* RIGHT: order book */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" as const, color: "#94a3b8", marginBottom: 6 }}>
                  Order Book · spread {fmtUsd(ob.spread, p.price > 100 ? 2 : 4)}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 1, fontFamily: "ui-monospace, monospace", fontSize: 11 }}>
                  {/* Asks reversed (top is highest ask, closest to mid) */}
                  {[...ob.asks].slice(0, 5).reverse().map((lvl, i) => {
                    const w = (lvl.size / maxAskSize) * 100;
                    return (
                      <div key={`ask-${i}`} style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr", padding: "2px 6px", borderRadius: 3 }}>
                        <div style={{ position: "absolute", inset: 0, right: "auto", width: `${w}%`, background: "rgba(220,38,38,0.18)", borderRadius: 3, pointerEvents: "none" }} />
                        <span style={{ color: "#fca5a5", position: "relative", fontWeight: 700 }}>{lvl.price.toFixed(p.price > 100 ? 2 : 4)}</span>
                        <span style={{ color: "#cbd5e1", textAlign: "right" as const, position: "relative" }}>{lvl.size}</span>
                      </div>
                    );
                  })}
                  {/* Mid */}
                  <div style={{ padding: "4px 6px", margin: "4px 0", textAlign: "center" as const, fontSize: 12, fontWeight: 900, color: "#22d3ee", background: "rgba(34,211,238,0.08)", borderRadius: 3, border: "1px solid rgba(34,211,238,0.25)" }}>
                    ◆ {fmtUsd(p.price, p.price > 100 ? 2 : 4)}
                  </div>
                  {/* Bids */}
                  {ob.bids.slice(0, 5).map((lvl, i) => {
                    const w = (lvl.size / maxBidSize) * 100;
                    return (
                      <div key={`bid-${i}`} style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr", padding: "2px 6px", borderRadius: 3 }}>
                        <div style={{ position: "absolute", inset: 0, right: "auto", width: `${w}%`, background: "rgba(34,197,94,0.18)", borderRadius: 3, pointerEvents: "none" }} />
                        <span style={{ color: "#86efac", position: "relative", fontWeight: 700 }}>{lvl.price.toFixed(p.price > 100 ? 2 : 4)}</span>
                        <span style={{ color: "#cbd5e1", textAlign: "right" as const, position: "relative" }}>{lvl.size}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Pending limits */}
        {limits.length > 0 && (
          <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)" }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" as const, color: "#fbbf24", marginBottom: 8 }}>
              📌 Ожидающие limit-ордера ({limits.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {limits.map((o) => {
                const cur = pairById.get(o.pair);
                const distance = cur ? ((o.triggerPrice - cur.price) / cur.price) * 100 : 0;
                return (
                  <div
                    key={o.id}
                    style={{
                      padding: "7px 12px", borderRadius: 8,
                      background: "rgba(0,0,0,0.18)", border: "1px solid rgba(255,255,255,0.08)",
                      display: "grid", gridTemplateColumns: "auto 1fr auto auto",
                      gap: 12, alignItems: "center", fontSize: 13,
                    }}
                  >
                    <span style={{
                      padding: "2px 8px", borderRadius: 4,
                      background: o.side === "long" ? "rgba(34,197,94,0.18)" : "rgba(220,38,38,0.18)",
                      color: o.side === "long" ? "#86efac" : "#fca5a5",
                      fontSize: 10, fontWeight: 900, letterSpacing: 0.5, textTransform: "uppercase" as const,
                    }}>
                      {o.side === "long" ? "▲ Long" : "▼ Short"} limit
                    </span>
                    <span style={{ fontFamily: "ui-monospace, monospace", color: "#cbd5e1" }}>
                      {o.qty} {o.pair.split("/")[0]} @ {fmtUsd(o.triggerPrice)}
                      {cur && (
                        <span style={{ marginLeft: 8, color: Math.abs(distance) < 0.5 ? "#fbbf24" : "#64748b", fontSize: 11, fontWeight: 700 }}>
                          ({distance >= 0 ? "+" : ""}{distance.toFixed(2)}% от рынка)
                        </span>
                      )}
                      {o.ocoGroupId && (
                        <span
                          style={{ marginLeft: 8, padding: "1px 7px", borderRadius: 999, background: "rgba(99,102,241,0.18)", color: "#a5b4fc", fontSize: 10, fontWeight: 800, letterSpacing: 0.4 }}
                          title="OCO bracket — fill any sibling cancels этот"
                        >
                          📍 OCO
                        </span>
                      )}
                    </span>
                    <span style={{ fontSize: 10, color: "#64748b" }}>
                      {Math.max(0, Math.round((Date.now() - o.createdTs) / 60000))}m ago
                    </span>
                    <button
                      onClick={() => cancelLimit(o.id)}
                      style={{
                        padding: "4px 10px", borderRadius: 5,
                        background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.18)",
                        color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Open positions */}
        {positions.length > 0 && (
          <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "#cbd5e1", marginBottom: 8 }}>Открытые позиции</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {positions.map((pos) => {
                const cur = pairById.get(pos.pair);
                const price = cur?.price ?? pos.entryPrice;
                const pnl = cur ? unrealizedPnl(pos, price) : 0;
                const pct = cur ? unrealizedPct(pos, price) : 0;
                const ageMin = Math.max(0, Math.round((Date.now() - pos.entryTs) / 60000));
                const editing = bracketEditId === pos.id;
                const hasSL = pos.stopLoss !== undefined;
                const hasTP = pos.takeProfit !== undefined;
                const hasTS = pos.maxHoldMs !== undefined && pos.maxHoldMs > 0;
                const tsRemainingMin = hasTS ? Math.max(0, (pos.maxHoldMs! - (Date.now() - pos.entryTs)) / 60_000) : 0;
                const hasTR = pos.trailingPct !== undefined && pos.trailingPct > 0;
                const trStop = hasTR && pos.trailingPeak
                  ? (pos.side === "long"
                      ? pos.trailingPeak * (1 - pos.trailingPct! / 100)
                      : pos.trailingPeak * (1 + pos.trailingPct! / 100))
                  : null;
                return (
                  <div key={pos.id} style={{
                    padding: "8px 12px", borderRadius: 8,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    display: "flex", flexDirection: "column" as const, gap: 6, fontSize: 13,
                  }}>
                    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto auto", gap: 12, alignItems: "center" as const }}>
                      <span style={{
                        padding: "2px 8px", borderRadius: 4,
                        background: pos.side === "long" ? "rgba(34,197,94,0.2)" : "rgba(220,38,38,0.2)",
                        color: pos.side === "long" ? "#86efac" : "#fca5a5",
                        fontSize: 11, fontWeight: 900, letterSpacing: 0.5, textTransform: "uppercase" as const,
                      }}>
                        {pos.side === "long" ? "▲ Long" : "▼ Short"} {pos.pair.split("/")[0]}
                      </span>
                      <span style={{ fontFamily: "ui-monospace, monospace", color: "#cbd5e1" }}>
                        {pos.qty} @ {fmtUsd(pos.entryPrice)} → {fmtUsd(price)}
                        <span style={{ marginLeft: 8, color: "#64748b", fontSize: 11 }}>({ageMin}m ago)</span>
                      </span>
                      <span style={{
                        fontFamily: "ui-monospace, monospace", fontWeight: 900,
                        color: pnl > 0 ? "#22c55e" : pnl < 0 ? "#f87171" : "#cbd5e1",
                      }}>
                        {pnl >= 0 ? "+" : ""}{fmtUsd(pnl)} ({fmtPct(pct)})
                      </span>
                      <button
                        onClick={() => editing ? setBracketEditId(null) : startEditBrackets(pos)}
                        style={{
                          padding: "5px 10px", borderRadius: 5,
                          background: editing ? "rgba(34,211,238,0.18)" : "rgba(255,255,255,0.06)",
                          border: `1px solid ${editing ? "#22d3ee" : "rgba(255,255,255,0.15)"}`,
                          color: editing ? "#67e8f9" : "#cbd5e1", fontSize: 11, fontWeight: 800, cursor: "pointer",
                        }}
                      >
                        {hasSL || hasTP ? "🎯 SL/TP" : "+ SL/TP"}
                      </button>
                      <button
                        onClick={() => closePosition(pos.id)}
                        style={{
                          padding: "5px 11px", borderRadius: 5,
                          background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)",
                          color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer",
                        }}
                      >
                        Close
                      </button>
                    </div>
                    {/* SL/TP/TS/TR chips (display when set, not editing) */}
                    {!editing && (hasSL || hasTP || hasTS || hasTR) && (
                      <div style={{ display: "flex", gap: 6, fontSize: 11, fontFamily: "ui-monospace, monospace", flexWrap: "wrap" as const }}>
                        {hasSL && (
                          <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(220,38,38,0.18)", color: "#fca5a5", fontWeight: 700 }}>
                            🛑 SL {fmtUsd(pos.stopLoss!)}
                          </span>
                        )}
                        {hasTP && (
                          <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(34,197,94,0.18)", color: "#86efac", fontWeight: 700 }}>
                            🎯 TP {fmtUsd(pos.takeProfit!)}
                          </span>
                        )}
                        {hasTS && (
                          <span
                            style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(251,191,36,0.18)", color: "#fde68a", fontWeight: 700 }}
                            title={`Auto-close через ${tsRemainingMin.toFixed(1)} мин`}
                          >
                            ⏱ TS {tsRemainingMin >= 1 ? `${Math.round(tsRemainingMin)}m` : `${Math.round(tsRemainingMin * 60)}s`}
                          </span>
                        )}
                        {hasTR && trStop !== null && (
                          <span
                            style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(168,85,247,0.18)", color: "#d8b4fe", fontWeight: 700 }}
                            title={`Trail ${pos.trailingPct}% от peak ${fmtUsd(pos.trailingPeak!)} → exit ${fmtUsd(trStop)}`}
                          >
                            📉 TR {pos.trailingPct}% @ {fmtUsd(trStop)}
                          </span>
                        )}
                      </div>
                    )}
                    {/* SL/TP editor */}
                    {editing && (
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", padding: "6px 8px", borderRadius: 6, background: "rgba(34,211,238,0.07)", border: "1px solid rgba(34,211,238,0.25)" }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: "#fca5a5", letterSpacing: 0.5, textTransform: "uppercase" as const }}>SL</span>
                        <input
                          value={bracketSL}
                          onChange={(e) => setBracketSL(e.target.value)}
                          type="number" min={0} step="any"
                          placeholder={pos.side === "long" ? `< ${fmtUsd(price)}` : `> ${fmtUsd(price)}`}
                          style={{
                            width: 110, padding: "4px 8px", borderRadius: 4,
                            border: "1px solid rgba(220,38,38,0.5)", background: "#0f172a", color: "#fff",
                            fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 12,
                          }}
                        />
                        <span style={{ fontSize: 10, fontWeight: 800, color: "#86efac", letterSpacing: 0.5, textTransform: "uppercase" as const }}>TP</span>
                        <input
                          value={bracketTP}
                          onChange={(e) => setBracketTP(e.target.value)}
                          type="number" min={0} step="any"
                          placeholder={pos.side === "long" ? `> ${fmtUsd(price)}` : `< ${fmtUsd(price)}`}
                          style={{
                            width: 110, padding: "4px 8px", borderRadius: 4,
                            border: "1px solid rgba(34,197,94,0.5)", background: "#0f172a", color: "#fff",
                            fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 12,
                          }}
                        />
                        <span style={{ fontSize: 10, fontWeight: 800, color: "#fde68a", letterSpacing: 0.5, textTransform: "uppercase" as const }}>⏱ TS min</span>
                        <input
                          value={bracketTSMin}
                          onChange={(e) => setBracketTSMin(e.target.value)}
                          type="number" min={0} step={1}
                          placeholder="auto-close"
                          aria-label="Time-stop in minutes"
                          title="Авто-закрытие через N минут после entry. Пусто = нет лимита"
                          style={{
                            width: 90, padding: "4px 8px", borderRadius: 4,
                            border: "1px solid rgba(251,191,36,0.5)", background: "#0f172a", color: "#fff",
                            fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 12,
                          }}
                        />
                        <span style={{ fontSize: 10, fontWeight: 800, color: "#d8b4fe", letterSpacing: 0.5, textTransform: "uppercase" as const }}>📉 TR %</span>
                        <input
                          value={bracketTrailPct}
                          onChange={(e) => setBracketTrailPct(e.target.value)}
                          type="number" min={0} max={100} step="any"
                          placeholder="trail"
                          aria-label="Trailing-stop percent"
                          title="Trailing stop: stop = peak ∓ N% (защищает прибыль). Пусто = выкл"
                          style={{
                            width: 80, padding: "4px 8px", borderRadius: 4,
                            border: "1px solid rgba(168,85,247,0.5)", background: "#0f172a", color: "#fff",
                            fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 12,
                          }}
                        />
                        <button onClick={() => saveBrackets(pos.id)}
                          style={{ padding: "5px 12px", borderRadius: 4, border: "none", background: "#22d3ee", color: "#0f172a", fontSize: 11, fontWeight: 900, cursor: "pointer" }}>
                          Save
                        </button>
                        {(hasSL || hasTP) && (
                          <button onClick={() => clearBrackets(pos.id)}
                            style={{ padding: "5px 10px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.18)", background: "transparent", color: "#94a3b8", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                            Clear
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Risk Dashboard — agg-уровневая аналитика поверх открытых позиций */}
        {positions.length > 0 && (() => {
          // Per-position risk numbers
          const rows = positions.map((pos) => {
            const cur = pairById.get(pos.pair);
            const price = cur?.price ?? pos.entryPrice;
            const notional = price * pos.qty;
            const dir = pos.side === "long" ? 1 : -1;
            const slDist = pos.stopLoss !== undefined
              ? Math.max(0, (price - pos.stopLoss) * dir)
              : null; // null → SL не выставлен
            const slLoss = slDist !== null ? slDist * pos.qty : null;
            const tpDist = pos.takeProfit !== undefined
              ? Math.max(0, (pos.takeProfit - price) * dir)
              : null;
            const tpProfit = tpDist !== null ? tpDist * pos.qty : null;
            // Implied "tick risk" — pair.vol × notional. Pair vol — per-tick stdev.
            const tickRisk = (cur?.vol ?? 0) * notional;
            // Hourly stdev = tick stdev × sqrt(3600)
            const hourlyRisk = tickRisk * Math.sqrt(3600);
            return { pos, price, notional, dir, slLoss, tpProfit, tickRisk, hourlyRisk, hasSl: pos.stopLoss !== undefined };
          });

          const totalExposure = rows.reduce((s, r) => s + r.notional, 0);
          const longExposure = rows.filter((r) => r.pos.side === "long").reduce((s, r) => s + r.notional, 0);
          const shortExposure = rows.filter((r) => r.pos.side === "short").reduce((s, r) => s + r.notional, 0);
          const netBiasPct = totalExposure > 0 ? ((longExposure - shortExposure) / totalExposure) * 100 : 0;
          const largest = rows.reduce<typeof rows[number] | null>((b, r) => (!b || r.notional > b.notional ? r : b), null);
          const largestPct = totalExposure > 0 && largest ? (largest.notional / totalExposure) * 100 : 0;

          // Per-pair aggregation
          const perPair = new Map<PairId, { exposure: number; count: number; sl: number; unprotected: number }>();
          for (const r of rows) {
            const cur = perPair.get(r.pos.pair) ?? { exposure: 0, count: 0, sl: 0, unprotected: 0 };
            cur.exposure += r.notional;
            cur.count += 1;
            if (r.slLoss !== null) cur.sl += r.slLoss;
            else cur.unprotected += r.notional;
            perPair.set(r.pos.pair, cur);
          }
          const pairBreakdown = [...perPair.entries()]
            .map(([pair, agg]) => ({ pair, ...agg, pct: totalExposure > 0 ? (agg.exposure / totalExposure) * 100 : 0 }))
            .sort((a, b) => b.exposure - a.exposure);

          const totalSlLoss = rows.reduce((s, r) => s + (r.slLoss ?? 0), 0);
          const totalTpProfit = rows.reduce((s, r) => s + (r.tpProfit ?? 0), 0);
          const unprotectedCount = rows.filter((r) => !r.hasSl).length;
          const unprotectedExposure = rows.filter((r) => !r.hasSl).reduce((s, r) => s + r.notional, 0);
          const totalHourlyVol = rows.reduce((s, r) => s + r.hourlyRisk, 0);

          // Concentration severity: HHI of pair shares
          const hhi = pairBreakdown.reduce((s, p) => {
            const share = totalExposure > 0 ? p.exposure / totalExposure : 0;
            return s + share * share;
          }, 0);
          const concentrationLabel = hhi >= 0.5 ? "HIGH" : hhi >= 0.25 ? "MED" : "LOW";
          const concentrationColor = hhi >= 0.5 ? "#fca5a5" : hhi >= 0.25 ? "#fde68a" : "#86efac";

          return (
            <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "linear-gradient(135deg, rgba(220,38,38,0.06), rgba(0,0,0,0.30))", border: "1px solid rgba(252,165,165,0.18)" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" as const, marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" as const, color: "#fca5a5" }}>
                  ⚠ Risk Dashboard · агрегатная экспозиция
                </div>
                <span style={{
                  padding: "2px 8px", borderRadius: 5,
                  background: `${concentrationColor}20`, color: concentrationColor,
                  fontSize: 10, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase" as const,
                }}>
                  Concentration: {concentrationLabel} (HHI {hhi.toFixed(2)})
                </span>
                {unprotectedCount > 0 && (
                  <span style={{
                    padding: "2px 8px", borderRadius: 5,
                    background: "rgba(252,165,165,0.18)", color: "#fca5a5",
                    fontSize: 10, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase" as const,
                  }}>
                    🛡 {unprotectedCount} без SL · {fmtUsd(unprotectedExposure)} unprotected
                  </span>
                )}
              </div>

              {/* Top metrics row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 10 }}>
                <div style={{ padding: 9, borderRadius: 7, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: "#cbd5e1", textTransform: "uppercase" as const }}>Total exposure</div>
                  <div style={{ fontSize: 18, fontWeight: 900, fontFamily: "ui-monospace, monospace", color: "#fff" }}>{fmtUsd(totalExposure)}</div>
                </div>
                <div style={{ padding: 9, borderRadius: 7, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: "#cbd5e1", textTransform: "uppercase" as const }}>Net bias</div>
                  <div style={{ fontSize: 18, fontWeight: 900, fontFamily: "ui-monospace, monospace", color: netBiasPct > 30 ? "#86efac" : netBiasPct < -30 ? "#fca5a5" : "#cbd5e1" }}>
                    {netBiasPct >= 0 ? "▲ +" : "▼ "}{netBiasPct.toFixed(0)}%
                  </div>
                  <div style={{ fontSize: 10, color: "#64748b", fontFamily: "ui-monospace, monospace" }}>
                    L {fmtUsd(longExposure)} · S {fmtUsd(shortExposure)}
                  </div>
                </div>
                <div style={{ padding: 9, borderRadius: 7, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: "#cbd5e1", textTransform: "uppercase" as const }}>Largest position</div>
                  <div style={{ fontSize: 18, fontWeight: 900, fontFamily: "ui-monospace, monospace", color: largestPct >= 50 ? "#fca5a5" : largestPct >= 30 ? "#fde68a" : "#86efac" }}>
                    {largestPct.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: 10, color: "#64748b", fontFamily: "ui-monospace, monospace" }}>
                    {largest ? `${largest.pos.pair.split("/")[0]} ${largest.pos.side === "long" ? "▲L" : "▼S"}` : "—"}
                  </div>
                </div>
                <div style={{ padding: 9, borderRadius: 7, background: "rgba(220,38,38,0.10)", border: "1px solid rgba(220,38,38,0.25)" }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: "#fca5a5", textTransform: "uppercase" as const }}>Max loss if all SL hit</div>
                  <div style={{ fontSize: 18, fontWeight: 900, fontFamily: "ui-monospace, monospace", color: "#fca5a5" }}>
                    -{fmtUsd(totalSlLoss)}
                  </div>
                  <div style={{ fontSize: 10, color: "#64748b", fontFamily: "ui-monospace, monospace" }}>
                    {unprotectedCount > 0 ? `+ ${fmtUsd(unprotectedExposure)} unprotected` : "all positions guarded"}
                  </div>
                </div>
                <div style={{ padding: 9, borderRadius: 7, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.20)" }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: "#86efac", textTransform: "uppercase" as const }}>Max profit if all TP hit</div>
                  <div style={{ fontSize: 18, fontWeight: 900, fontFamily: "ui-monospace, monospace", color: "#86efac" }}>
                    +{fmtUsd(totalTpProfit)}
                  </div>
                  <div style={{ fontSize: 10, color: "#64748b", fontFamily: "ui-monospace, monospace" }}>
                    R/R {totalSlLoss > 0 ? (totalTpProfit / totalSlLoss).toFixed(2) : "∞"}
                  </div>
                </div>
                <div style={{ padding: 9, borderRadius: 7, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: "#cbd5e1", textTransform: "uppercase" as const }}>1h vol exposure</div>
                  <div style={{ fontSize: 18, fontWeight: 900, fontFamily: "ui-monospace, monospace", color: "#cbd5e1" }}>
                    ±{fmtUsd(totalHourlyVol)}
                  </div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>1σ ожидаемый swing/час</div>
                </div>
              </div>

              {/* Per-pair breakdown */}
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: 0.5, textTransform: "uppercase" as const, marginBottom: 4 }}>
                  Распределение по парам
                </div>
                {pairBreakdown.map((b) => {
                  const barColor = b.pct >= 50 ? "#fca5a5" : b.pct >= 30 ? "#fde68a" : "#a5b4fc";
                  return (
                    <div key={b.pair} style={{
                      padding: "5px 9px", borderRadius: 5,
                      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                      display: "grid", gridTemplateColumns: "70px 1fr auto auto auto", gap: 10, alignItems: "center" as const, fontSize: 11,
                    }}>
                      <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 800, color: "#fff" }}>{b.pair.split("/")[0]}</span>
                      <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden" as const }}>
                        <div style={{ height: "100%", width: `${b.pct}%`, background: `linear-gradient(90deg, ${barColor}AA, ${barColor})`, transition: "width 0.3s" }} />
                      </div>
                      <span style={{ fontFamily: "ui-monospace, monospace", color: barColor, fontWeight: 800, minWidth: 50, textAlign: "right" as const }}>
                        {b.pct.toFixed(1)}%
                      </span>
                      <span style={{ fontFamily: "ui-monospace, monospace", color: "#cbd5e1", fontSize: 10, minWidth: 80, textAlign: "right" as const }}>
                        {fmtUsd(b.exposure)}
                      </span>
                      <span style={{ fontSize: 10, color: b.unprotected > 0 ? "#fca5a5" : "#64748b", minWidth: 80, textAlign: "right" as const, fontFamily: "ui-monospace, monospace" }}>
                        {b.count} pos {b.unprotected > 0 ? `· ${fmtUsd(b.unprotected)} ⚠` : "· guarded"}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div style={{ fontSize: 10, color: "#64748b", marginTop: 8, lineHeight: 1.5 }}>
                HHI (Herfindahl) — индекс концентрации (sum of squared shares); ≥0.5 = HIGH risk, ≤0.25 = диверсифицировано.
                «1h vol exposure» — 1σ ожидаемый swing за час по pair-vol параметрам симулятора.
              </div>
            </div>
          );
        })()}

        {/* Trade history + performance */}
        {closedPositions.length > 0 && (() => {
          // Tag-based filtering (если выбран тег — только сделки с этим тегом)
          const filtered = journalTagFilter
            ? closedPositions.filter((c) => (c.tags ?? []).includes(journalTagFilter))
            : closedPositions;
          const stats = computePortfolioStats(filtered);
          const pairBreakdown = computePairBreakdown(filtered);
          const calendar = buildCalendar(filtered, 28);
          const { wins, losses, total, realizedSum, winrate, best, worst, equity: equityPoints, peak, maxDrawdown: maxDD } = stats;
          // Tag-stats — агрегируем wins/losses/avg pnl по каждому тегу.
          const tagStats: Map<string, { count: number; wins: number; pnl: number }> = new Map();
          for (const c of closedPositions) {
            for (const t of c.tags ?? []) {
              const cur = tagStats.get(t) ?? { count: 0, wins: 0, pnl: 0 };
              cur.count += 1;
              if (c.realizedPnl > 0) cur.wins += 1;
              cur.pnl += c.realizedPnl;
              tagStats.set(t, cur);
            }
          }
          const tagList = [...tagStats.entries()]
            .map(([tag, s]) => ({ tag, ...s, wr: s.count > 0 ? (s.wins / s.count) * 100 : 0 }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 12);
          const startEdit = (c: ClosedPosition) => {
            setJournalEditId(c.id);
            setJournalNote(c.notes ?? "");
            setJournalTags((c.tags ?? []).join(", "));
          };
          const saveEdit = () => {
            if (!journalEditId) return;
            const tags = journalTags
              .split(",")
              .map((t) => t.trim().toLowerCase().replace(/\s+/g, "-"))
              .filter((t) => t.length > 0 && t.length <= 24 && /^[a-z0-9а-яё-]+$/i.test(t))
              .filter((t, i, a) => a.indexOf(t) === i)
              .slice(0, 8);
            setClosedPositions((cs) => cs.map((c) =>
              c.id === journalEditId
                ? { ...c, notes: journalNote.trim().slice(0, 240), tags: tags.length > 0 ? tags : undefined }
                : c
            ));
            setJournalEditId(null);
          };
          const cancelEdit = () => setJournalEditId(null);
          return (
            <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" as const, color: "#cbd5e1" }}>
                  📊 История сделок · performance{journalTagFilter && (
                    <span style={{ marginLeft: 8, padding: "2px 7px", borderRadius: 4, background: "rgba(99,102,241,0.18)", color: "#a5b4fc", fontSize: 10, letterSpacing: 0.5 }}>
                      filter: #{journalTagFilter} ✕
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#cbd5e1", flexWrap: "wrap", alignItems: "center" }}>
                  <span>Closed: <strong style={{ color: "#fff" }}>{total}</strong></span>
                  <span>Winrate: <strong style={{ color: winrate >= 55 ? "#22c55e" : winrate >= 40 ? "#fbbf24" : "#f87171" }}>{winrate.toFixed(1)}%</strong> ({wins}W {losses}L)</span>
                  <span>Realized P&L: <strong style={{ color: realizedSum > 0 ? "#22c55e" : realizedSum < 0 ? "#f87171" : "#cbd5e1" }}>{realizedSum >= 0 ? "+" : ""}{fmtUsd(realizedSum)}</strong></span>
                  <span>Peak: <strong style={{ color: "#86efac" }}>{peak >= 0 ? "+" : ""}{fmtUsd(peak)}</strong></span>
                  <span>Max DD: <strong style={{ color: maxDD > 0 ? "#fca5a5" : "#cbd5e1" }}>{fmtUsd(-maxDD)}</strong></span>
                  {best && best.realizedPnl > 0 && <span style={{ color: "#86efac" }}>Best <strong>+{fmtUsd(best.realizedPnl)}</strong></span>}
                  {worst && worst.realizedPnl < 0 && <span style={{ color: "#fca5a5" }}>Worst <strong>{fmtUsd(worst.realizedPnl)}</strong></span>}
                  <button
                    onClick={() => {
                      const ok = downloadTradesCsv(filtered);
                      if (!ok) setTradeMsg("Нет сделок для экспорта");
                    }}
                    aria-label="Export closed trades as CSV"
                    title="Экспорт сделок в CSV (ISO timestamps + UTF-8 BOM)"
                    style={{
                      padding: "4px 10px", borderRadius: 6,
                      border: "1px solid rgba(34,211,238,0.4)",
                      background: "rgba(34,211,238,0.10)",
                      color: "#67e8f9", fontSize: 11, fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    📥 Export CSV
                  </button>
                </div>
              </div>

              {/* Tag stats — журнал по тегам сетапов */}
              {tagList.length > 0 && (
                <div style={{
                  marginBottom: 10, padding: "8px 10px", borderRadius: 6,
                  background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.20)",
                }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5, color: "#a5b4fc", textTransform: "uppercase" as const, marginBottom: 6 }}>
                    🏷 Trade Journal · по тегам сетапов · клик = фильтр
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                    {journalTagFilter && (
                      <button onClick={() => setJournalTagFilter(null)}
                        style={{
                          padding: "3px 9px", borderRadius: 12, border: "1px solid rgba(252,165,165,0.4)",
                          background: "rgba(252,165,165,0.12)", color: "#fca5a5",
                          fontSize: 10, fontWeight: 800, cursor: "pointer",
                        }}>
                        ✕ clear filter
                      </button>
                    )}
                    {tagList.map((t) => {
                      const isActive = t.tag === journalTagFilter;
                      const wrColor = t.wr >= 55 ? "#86efac" : t.wr >= 40 ? "#fde68a" : "#fca5a5";
                      return (
                        <button key={t.tag}
                          onClick={() => setJournalTagFilter(isActive ? null : t.tag)}
                          title={`${t.count} сделок · ${t.wins}W · WR ${t.wr.toFixed(1)}% · PnL ${t.pnl >= 0 ? "+" : ""}${fmtUsd(t.pnl)}`}
                          style={{
                            padding: "3px 9px", borderRadius: 12,
                            border: isActive ? "1px solid #6366f1" : "1px solid rgba(165,180,252,0.30)",
                            background: isActive ? "rgba(99,102,241,0.30)" : "rgba(255,255,255,0.05)",
                            color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer",
                            display: "flex", gap: 5, alignItems: "center" as const,
                            fontFamily: "ui-monospace, monospace",
                          }}>
                          <span>#{t.tag}</span>
                          <span style={{ color: "#94a3b8" }}>×{t.count}</span>
                          <span style={{ color: wrColor }}>{t.wr.toFixed(0)}%</span>
                          <span style={{ color: t.pnl >= 0 ? "#86efac" : "#fca5a5" }}>
                            {t.pnl >= 0 ? "+" : ""}{fmtUsd(t.pnl)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Advanced analytics — Sharpe, profit factor, R-multiples, streaks */}
              <AdvancedAnalytics stats={stats} />

              {/* Calendar heatmap — last 28 days P&L */}
              {stats.total > 0 && <CalendarHeatmap cells={calendar} />}

              {/* Per-pair breakdown */}
              {pairBreakdown.length > 1 && <PairBreakdownTable rows={pairBreakdown} />}

              {equityPoints.length >= 2 && <EquityCurve points={equityPoints} />}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 320, overflowY: "auto" as const }}>
                {filtered.slice(0, 30).map((c) => {
                  const dur = (() => {
                    const ms = c.exitTs - c.entryTs;
                    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
                    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
                    if (ms < 86400000) return `${Math.round(ms / 3600000)}h`;
                    return `${Math.round(ms / 86400000)}d`;
                  })();
                  const isEditing = journalEditId === c.id;
                  const hasJournal = (c.notes && c.notes.length > 0) || (c.tags && c.tags.length > 0);
                  return (
                    <div key={c.id} style={{
                      padding: "6px 12px", borderRadius: 6,
                      background: c.realizedPnl >= 0 ? "rgba(34,197,94,0.07)" : "rgba(220,38,38,0.07)",
                      border: `1px solid ${c.realizedPnl >= 0 ? "rgba(34,197,94,0.18)" : "rgba(220,38,38,0.18)"}`,
                      display: "flex", flexDirection: "column" as const, gap: 4,
                    }}>
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "auto 1fr auto auto auto",
                        gap: 12, alignItems: "center" as const, fontSize: 12,
                      }}>
                        <span style={{
                          padding: "2px 7px", borderRadius: 4,
                          background: c.side === "long" ? "rgba(34,197,94,0.2)" : "rgba(220,38,38,0.2)",
                          color: c.side === "long" ? "#86efac" : "#fca5a5",
                          fontSize: 10, fontWeight: 900, letterSpacing: 0.5, textTransform: "uppercase" as const,
                        }}>
                          {c.side === "long" ? "▲L" : "▼S"} {c.pair.split("/")[0]}
                        </span>
                        <span style={{ fontFamily: "ui-monospace, monospace", color: "#cbd5e1" }}>
                          {c.qty} @ {fmtUsd(c.entryPrice)} → {fmtUsd(c.exitPrice)}
                          <span style={{ marginLeft: 8, color: "#64748b", fontSize: 11 }}>· {dur}</span>
                        </span>
                        <span style={{
                          fontFamily: "ui-monospace, monospace", fontWeight: 900,
                          color: c.realizedPnl > 0 ? "#22c55e" : c.realizedPnl < 0 ? "#f87171" : "#cbd5e1",
                        }}>
                          {c.realizedPnl >= 0 ? "+" : ""}{fmtUsd(c.realizedPnl)}
                        </span>
                        <span style={{
                          fontFamily: "ui-monospace, monospace", fontSize: 11,
                          color: c.realizedPct >= 0 ? "#86efac" : "#fca5a5",
                        }}>
                          {fmtPct(c.realizedPct)}
                        </span>
                        <button onClick={() => isEditing ? cancelEdit() : startEdit(c)}
                          title={isEditing ? "Отмена" : (hasJournal ? "Редактировать заметку" : "Добавить заметку")}
                          style={{
                            padding: "3px 7px", borderRadius: 4,
                            border: "1px solid rgba(165,180,252,0.30)",
                            background: hasJournal ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.04)",
                            color: hasJournal ? "#a5b4fc" : "#94a3b8",
                            fontSize: 11, fontWeight: 700, cursor: "pointer",
                          }}>
                          {isEditing ? "✕" : (hasJournal ? "✎" : "+")}
                        </button>
                      </div>

                      {/* Existing journal display */}
                      {!isEditing && hasJournal && (
                        <div style={{ display: "flex", flexDirection: "column" as const, gap: 4, paddingLeft: 4 }}>
                          {c.tags && c.tags.length > 0 && (
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const }}>
                              {c.tags.map((t) => (
                                <button key={t} onClick={() => setJournalTagFilter(t === journalTagFilter ? null : t)}
                                  style={{
                                    padding: "1px 8px", borderRadius: 10,
                                    background: t === journalTagFilter ? "rgba(99,102,241,0.30)" : "rgba(99,102,241,0.10)",
                                    border: "1px solid rgba(99,102,241,0.30)",
                                    color: "#a5b4fc", fontSize: 10, fontWeight: 700,
                                    fontFamily: "ui-monospace, monospace",
                                    cursor: "pointer",
                                  }}>
                                  #{t}
                                </button>
                              ))}
                            </div>
                          )}
                          {c.notes && (
                            <div style={{
                              padding: "4px 8px", borderRadius: 4,
                              background: "rgba(255,255,255,0.04)",
                              fontSize: 11, color: "#cbd5e1", lineHeight: 1.4,
                              fontStyle: "italic" as const,
                            }}>
                              💭 {c.notes}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Edit form */}
                      {isEditing && (
                        <div style={{
                          padding: 8, borderRadius: 5,
                          background: "rgba(99,102,241,0.10)", border: "1px solid rgba(99,102,241,0.25)",
                          display: "flex", flexDirection: "column" as const, gap: 6,
                        }}>
                          <textarea aria-label="Заметка о сделке: вход на breakout, exit на news"
                            value={journalNote}
                            onChange={(e) => setJournalNote(e.target.value.slice(0, 240))}
                            rows={2}
                            placeholder="Заметка о сделке: вход на breakout, exit на news (до 240 char)"
                            style={{
                              padding: "6px 8px", borderRadius: 4,
                              border: "1px solid rgba(165,180,252,0.30)",
                              background: "rgba(0,0,0,0.30)", color: "#fff",
                              fontSize: 12, fontFamily: "inherit", resize: "vertical" as const, lineHeight: 1.4,
                            }}
                          />
                          <input aria-label="Теги через запятую: breakout, news, trend, scalp"
                            value={journalTags}
                            onChange={(e) => setJournalTags(e.target.value)}
                            placeholder="Теги через запятую: breakout, news, trend, scalp"
                            style={{
                              padding: "6px 8px", borderRadius: 4,
                              border: "1px solid rgba(165,180,252,0.30)",
                              background: "rgba(0,0,0,0.30)", color: "#fff",
                              fontSize: 12, fontFamily: "ui-monospace, monospace",
                            }}
                          />
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" as const }}>
                            <button onClick={cancelEdit}
                              style={{
                                padding: "5px 12px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.15)",
                                background: "rgba(255,255,255,0.04)", color: "#94a3b8",
                                fontSize: 11, fontWeight: 700, cursor: "pointer",
                              }}>
                              Cancel
                            </button>
                            <button onClick={saveEdit}
                              style={{
                                padding: "5px 14px", borderRadius: 4, border: "none",
                                background: "linear-gradient(135deg, #6366f1, #818cf8)",
                                color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer",
                              }}>
                              💾 Save
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {closedPositions.length > 0 && (
                <button
                  onClick={() => { if (confirm("Очистить всю историю сделок?")) setClosedPositions([]) }}
                  style={{
                    marginTop: 8, padding: "5px 12px", borderRadius: 5,
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
                    color: "#94a3b8", fontSize: 11, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  Очистить историю
                </button>
              )}
            </div>
          );
        })()}
      </section>
      <style>{`@keyframes qt-pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      {/* ═══ POSITION SIZING CALCULATOR ════════════════════════════ */}
      {(() => {
        const acct = Number(psAccount);
        const risk = Number(psRisk);
        const stop = Number(psStop);
        const valid = Number.isFinite(acct) && acct > 0 && Number.isFinite(risk) && risk > 0 && Number.isFinite(stop) && stop > 0;
        const maxLoss = valid ? (acct * risk) / 100 : null;
        const posSize = valid ? maxLoss! / stop : null;
        return (
          <section style={{
            marginBottom: 18, padding: 16, borderRadius: 12,
            background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#fff",
          }}>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase" as const, color: "#22d3ee", marginBottom: 12 }}>
              🧮 Position Sizing Calculator
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>
                Account size ($)
                <input
                  type="number" min={1} step="any"
                  value={psAccount} onChange={(e) => setPsAccount(e.target.value)}
                  style={{
                    width: 120, padding: "7px 10px", borderRadius: 6,
                    border: "1px solid #334155", background: "#0f172a", color: "#fff",
                    fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 13,
                  }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>
                Risk %
                <input
                  type="number" min={0.01} max={100} step="any"
                  value={psRisk} onChange={(e) => setPsRisk(e.target.value)}
                  style={{
                    width: 90, padding: "7px 10px", borderRadius: 6,
                    border: "1px solid #334155", background: "#0f172a", color: "#fff",
                    fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 13,
                  }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>
                Stop-loss distance ($)
                <input aria-label="Stop-loss distance ($)"
                  type="number" min={0.00001} step="any"
                  value={psStop} onChange={(e) => setPsStop(e.target.value)}
                  placeholder="e.g. 50"
                  style={{
                    width: 140, padding: "7px 10px", borderRadius: 6,
                    border: "1px solid #334155", background: "#0f172a", color: "#fff",
                    fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 13,
                  }}
                />
              </label>
              {valid && posSize !== null && maxLoss !== null ? (
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", paddingBottom: 2 }}>
                  <div style={{ padding: "7px 14px", borderRadius: 8, background: "rgba(34,211,238,0.12)", border: "1px solid rgba(34,211,238,0.35)" }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: "#67e8f9", letterSpacing: 0.6, textTransform: "uppercase" as const }}>Position Size</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#22d3ee", fontFamily: "ui-monospace, monospace" }}>
                      {posSize >= 1 ? posSize.toFixed(4) : posSize.toFixed(6)} units
                    </div>
                  </div>
                  <div style={{ padding: "7px 14px", borderRadius: 8, background: "rgba(248,113,113,0.10)", border: "1px solid rgba(248,113,113,0.35)" }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: "#fca5a5", letterSpacing: 0.6, textTransform: "uppercase" as const }}>Max Loss</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#f87171", fontFamily: "ui-monospace, monospace" }}>
                      {fmtUsd(maxLoss)}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "#475569", paddingBottom: 4 }}>
                  Введи все три поля, чтобы увидеть размер позиции
                </div>
              )}
            </div>
            <div style={{ fontSize: 10, color: "#334155", marginTop: 8 }}>
              Размер позиции = (account × risk%) / stop-distance. Только для симуляции.
            </div>
          </section>
        );
      })()}

      {/* ═══ DCA AUTO-TRADER (BOTS) ════════════════════════════════ */}
      <DcaBotsPanel pairs={pairs} mintAev={mintAev} />

      {/* ═══ GRID BOT — buy низко, sell высоко по сетке ════════════ */}
      <GridBotsPanel pairs={pairs} mintAev={mintAev} />

      {/* ═══ BACKTESTER — applies стратегия на исторических OHLC ═══ */}
      {(() => {
        const pair = pairs.find((p) => p.id === btPair);
        const candles = pair?.candles ?? [];
        const candleCount = candles.length;

        const runBt = () => {
          if (!pair || candleCount === 0) {
            setBtResult({ ok: false, error: "Нет candles на паре — подожди пока накопятся", strategy: btStrategy, equity: [], totalSpent: 0, finalQty: 0, finalValue: 0, realizedProfit: 0, totalReturn: 0, maxDrawdown: 0, maxDrawdownPct: 0, numTrades: 0, numBuys: 0, numSells: 0 });
            return;
          }
          const fees = ldFees();
          if (btStrategy === "dca") {
            const r = runBacktest(candles, {
              kind: "dca",
              cfg: {
                amountUsd: Math.max(1, Number(btDcaAmount) || 0),
                intervalCandles: Math.max(1, Math.floor(Number(btDcaInterval) || 1)),
                trailingPct: btDcaTrail.trim() === "" ? undefined : Math.max(0, Number(btDcaTrail) || 0) || undefined,
              },
            }, fees);
            setBtResult(r);
          } else if (btStrategy === "grid") {
            const r = runBacktest(candles, {
              kind: "grid",
              cfg: {
                lowPrice: Number(btGridLow) || 0,
                highPrice: Number(btGridHigh) || 0,
                gridCount: Math.max(2, Math.min(60, Math.floor(Number(btGridCount) || 0))),
                amountUsdPerLevel: Math.max(1, Number(btGridAmount) || 0),
              },
            }, fees);
            setBtResult(r);
          } else {
            const r = runBacktest(candles, {
              kind: "bnh",
              cfg: {
                totalUsd: Math.max(1, Number(btBnhTotal) || 0),
                stopLossPct: btBnhSL.trim() === "" ? undefined : Math.max(0, Number(btBnhSL) || 0) || undefined,
                takeProfitPct: btBnhTP.trim() === "" ? undefined : Math.max(0, Number(btBnhTP) || 0) || undefined,
              },
            }, fees);
            setBtResult(r);
          }
        };

        const fillGridFromCurrent = () => {
          if (!pair) return;
          const lo = pair.price * 0.95;
          const hi = pair.price * 1.05;
          setBtGridLow(lo.toFixed(pair.price < 1 ? 4 : 2));
          setBtGridHigh(hi.toFixed(pair.price < 1 ? 4 : 2));
        };

        // Equity curve SVG
        const eqSvg = (() => {
          if (!btResult || !btResult.ok || btResult.equity.length < 2) return null;
          const w = 600, h = 80, pad = 4;
          const pl = btResult.equity.map((p) => p.equity - p.spent);
          const minPl = Math.min(...pl, 0);
          const maxPl = Math.max(...pl, 0);
          const range = (maxPl - minPl) || 1;
          const dx = (w - pad * 2) / (pl.length - 1);
          const path = pl
            .map((v, i) => `${i === 0 ? "M" : "L"} ${(pad + i * dx).toFixed(2)} ${(pad + (h - pad * 2) - ((v - minPl) / range) * (h - pad * 2)).toFixed(2)}`)
            .join(" ");
          // Zero line
          const zeroY = pad + (h - pad * 2) - ((0 - minPl) / range) * (h - pad * 2);
          return (
            <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 80, display: "block" }}>
              <line x1={pad} x2={w - pad} y1={zeroY} y2={zeroY} stroke="rgba(255,255,255,0.20)" strokeDasharray="3 3" strokeWidth={1} />
              <path d={path} fill="none" stroke={btResult.totalReturn >= 0 ? "#86efac" : "#fca5a5"} strokeWidth={2} />
            </svg>
          );
        })();

        return (
          <section style={{
            marginBottom: 18, padding: 16, borderRadius: 12,
            background: "linear-gradient(135deg, #1e1b4b 0%, #4c1d95 60%, #7e22ce 100%)",
            border: "1px solid rgba(255,255,255,0.10)",
            color: "#fff",
            boxShadow: "0 8px 24px rgba(76,29,149,0.25)",
          }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12, flexWrap: "wrap" as const }}>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase" as const, color: "#c4b5fd" }}>
                🧪 Backtester
              </div>
              <span style={{ fontSize: 10, color: "#cbd5e1" }}>
                applies стратегия на исторических OHLC candles ({candleCount} candles доступно)
              </span>
            </div>

            {/* Strategy tabs */}
            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" as const }}>
              {(["dca", "grid", "bnh"] as StrategyKind[]).map((s) => {
                const labels: Record<StrategyKind, string> = { dca: "DCA", grid: "Grid", bnh: "Buy & Hold" };
                const active = btStrategy === s;
                return (
                  <button key={s} onClick={() => { setBtStrategy(s); setBtResult(null); }}
                    style={{
                      padding: "5px 12px", borderRadius: 5,
                      background: active ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.20)",
                      color: active ? "#4c1d95" : "#e0e7ff",
                      border: active ? "none" : "1px solid rgba(255,255,255,0.20)",
                      fontSize: 11, fontWeight: 800, letterSpacing: 0.3, cursor: "pointer",
                      textTransform: "uppercase" as const,
                    }}>
                    {labels[s]}
                  </button>
                );
              })}
            </div>

            {/* Config form */}
            <div style={{
              padding: 10, borderRadius: 8,
              background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.10)",
              marginBottom: 10,
              display: "flex", gap: 10, flexWrap: "wrap" as const, alignItems: "flex-end" as const,
            }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#c4b5fd", fontWeight: 700 }}>
                Pair
                <select value={btPair} onChange={(e) => setBtPair(e.target.value as PairId)}
                  style={{ padding: "6px 10px", borderRadius: 5, border: "1px solid #4c1d95", background: "#1e1b4b", color: "#fff", fontSize: 13, fontWeight: 700 }}>
                  {(["AEV/USD", "BTC/USD", "ETH/USD", "SOL/USD"] as PairId[]).map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>
              {btStrategy === "dca" && (
                <>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#c4b5fd", fontWeight: 700 }}>
                    Buy every (candles)
                    <input type="number" min={1} step={1} value={btDcaInterval} onChange={(e) => setBtDcaInterval(e.target.value)}
                      style={{ width: 110, padding: "6px 10px", borderRadius: 5, border: "1px solid #4c1d95", background: "#1e1b4b", color: "#fff", fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 13 }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#c4b5fd", fontWeight: 700 }}>
                    $ per buy
                    <input type="number" min={1} step="any" value={btDcaAmount} onChange={(e) => setBtDcaAmount(e.target.value)}
                      style={{ width: 90, padding: "6px 10px", borderRadius: 5, border: "1px solid #4c1d95", background: "#1e1b4b", color: "#fff", fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 13 }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#d8b4fe", fontWeight: 700 }}>
                    📉 Trailing exit %
                    <input type="number" min={0} step="any" value={btDcaTrail} onChange={(e) => setBtDcaTrail(e.target.value)}
                      placeholder="off"
                      aria-label="Trailing exit percent for DCA backtest"
                      title="Закрыть all qty при retrace на N% от peak. Пусто = держим до конца"
                      style={{ width: 90, padding: "6px 10px", borderRadius: 5, border: "1px solid rgba(168,85,247,0.5)", background: "#1e1b4b", color: "#fff", fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 13 }} />
                  </label>
                </>
              )}
              {btStrategy === "grid" && (
                <>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#c4b5fd", fontWeight: 700 }}>
                    Low ($)
                    <input type="number" min={0} step="any" value={btGridLow} onChange={(e) => setBtGridLow(e.target.value)}
                      style={{ width: 100, padding: "6px 10px", borderRadius: 5, border: "1px solid #4c1d95", background: "#1e1b4b", color: "#fff", fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 13 }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#c4b5fd", fontWeight: 700 }}>
                    High ($)
                    <input type="number" min={0} step="any" value={btGridHigh} onChange={(e) => setBtGridHigh(e.target.value)}
                      style={{ width: 100, padding: "6px 10px", borderRadius: 5, border: "1px solid #4c1d95", background: "#1e1b4b", color: "#fff", fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 13 }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#c4b5fd", fontWeight: 700 }}>
                    Levels
                    <input type="number" min={2} max={60} step={1} value={btGridCount} onChange={(e) => setBtGridCount(e.target.value)}
                      style={{ width: 70, padding: "6px 10px", borderRadius: 5, border: "1px solid #4c1d95", background: "#1e1b4b", color: "#fff", fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 13 }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#c4b5fd", fontWeight: 700 }}>
                    $/level
                    <input type="number" min={1} step="any" value={btGridAmount} onChange={(e) => setBtGridAmount(e.target.value)}
                      style={{ width: 80, padding: "6px 10px", borderRadius: 5, border: "1px solid #4c1d95", background: "#1e1b4b", color: "#fff", fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 13 }} />
                  </label>
                  <button onClick={fillGridFromCurrent}
                    style={{
                      padding: "6px 10px", borderRadius: 5,
                      border: "1px solid rgba(196,181,253,0.40)", background: "rgba(196,181,253,0.12)",
                      color: "#c4b5fd", fontSize: 11, fontWeight: 700, cursor: "pointer",
                    }}>
                    ±5%
                  </button>
                </>
              )}
              {btStrategy === "bnh" && (
                <>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#c4b5fd", fontWeight: 700 }}>
                    Total invest ($)
                    <input type="number" min={1} step="any" value={btBnhTotal} onChange={(e) => setBtBnhTotal(e.target.value)}
                      style={{ width: 110, padding: "6px 10px", borderRadius: 5, border: "1px solid #4c1d95", background: "#1e1b4b", color: "#fff", fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 13 }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#fca5a5", fontWeight: 700 }}>
                    Stop-loss %
                    <input type="number" min={0} step="any" value={btBnhSL} onChange={(e) => setBtBnhSL(e.target.value)}
                      placeholder="off"
                      aria-label="Stop-loss percent for BnH backtest"
                      style={{ width: 90, padding: "6px 10px", borderRadius: 5, border: "1px solid rgba(220,38,38,0.5)", background: "#1e1b4b", color: "#fff", fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 13 }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#86efac", fontWeight: 700 }}>
                    Take-profit %
                    <input type="number" min={0} step="any" value={btBnhTP} onChange={(e) => setBtBnhTP(e.target.value)}
                      placeholder="off"
                      aria-label="Take-profit percent for BnH backtest"
                      style={{ width: 90, padding: "6px 10px", borderRadius: 5, border: "1px solid rgba(34,197,94,0.5)", background: "#1e1b4b", color: "#fff", fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 13 }} />
                  </label>
                </>
              )}
              <button onClick={runBt}
                disabled={candleCount < 2}
                style={{
                  padding: "8px 18px", borderRadius: 6, border: "none",
                  background: candleCount < 2 ? "rgba(255,255,255,0.15)" : "linear-gradient(135deg, #c4b5fd, #fff)",
                  color: candleCount < 2 ? "#94a3b8" : "#4c1d95",
                  fontWeight: 800, fontSize: 13,
                  cursor: candleCount < 2 ? "default" : "pointer",
                  boxShadow: candleCount < 2 ? "none" : "0 2px 8px rgba(196,181,253,0.4)",
                }}>
                ▶ Запустить backtest
              </button>
            </div>

            {/* Result */}
            {btResult && !btResult.ok && (
              <div style={{
                padding: "8px 12px", borderRadius: 6,
                background: "rgba(252,165,165,0.18)", border: "1px solid rgba(252,165,165,0.40)",
                color: "#fca5a5", fontSize: 12, fontWeight: 700,
              }}>⚠ {btResult.error}</div>
            )}
            {btResult && btResult.ok && (
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
                  <div style={{ padding: 8, borderRadius: 6, background: "rgba(0,0,0,0.30)", border: "1px solid rgba(255,255,255,0.10)" }}>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: "#c4b5fd", textTransform: "uppercase" as const }}>Total return</div>
                    <div style={{ fontSize: 17, fontWeight: 900, fontFamily: "ui-monospace, monospace", color: btResult.totalReturn >= 0 ? "#86efac" : "#fca5a5" }}>
                      {btResult.totalReturn >= 0 ? "+" : ""}{btResult.totalReturn.toFixed(2)}%
                    </div>
                  </div>
                  <div style={{ padding: 8, borderRadius: 6, background: "rgba(0,0,0,0.30)", border: "1px solid rgba(255,255,255,0.10)" }}>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: "#c4b5fd", textTransform: "uppercase" as const }}>Final value</div>
                    <div style={{ fontSize: 17, fontWeight: 900, fontFamily: "ui-monospace, monospace", color: "#fff" }}>{fmtUsd(btResult.finalValue)}</div>
                    <div style={{ fontSize: 9, color: "#94a3b8", fontFamily: "ui-monospace, monospace" }}>spent {fmtUsd(btResult.totalSpent)}</div>
                  </div>
                  <div style={{ padding: 8, borderRadius: 6, background: "rgba(0,0,0,0.30)", border: "1px solid rgba(255,255,255,0.10)" }}>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: "#c4b5fd", textTransform: "uppercase" as const }}>Max drawdown</div>
                    <div style={{ fontSize: 17, fontWeight: 900, fontFamily: "ui-monospace, monospace", color: "#fca5a5" }}>
                      -{fmtUsd(btResult.maxDrawdown)}
                    </div>
                    <div style={{ fontSize: 9, color: "#94a3b8", fontFamily: "ui-monospace, monospace" }}>{btResult.maxDrawdownPct.toFixed(1)}%</div>
                  </div>
                  <div style={{ padding: 8, borderRadius: 6, background: "rgba(0,0,0,0.30)", border: "1px solid rgba(255,255,255,0.10)" }}>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: "#c4b5fd", textTransform: "uppercase" as const }}>Trades</div>
                    <div style={{ fontSize: 17, fontWeight: 900, fontFamily: "ui-monospace, monospace", color: "#fff" }}>{btResult.numTrades}</div>
                    <div style={{ fontSize: 9, color: "#94a3b8", fontFamily: "ui-monospace, monospace" }}>{btResult.numBuys}B {btResult.numSells}S</div>
                  </div>
                  {btResult.realizedProfit !== 0 && (
                    <div style={{ padding: 8, borderRadius: 6, background: "rgba(134,239,172,0.10)", border: "1px solid rgba(134,239,172,0.30)" }}>
                      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: "#86efac", textTransform: "uppercase" as const }}>Realized profit</div>
                      <div style={{ fontSize: 17, fontWeight: 900, fontFamily: "ui-monospace, monospace", color: "#86efac" }}>
                        +{fmtUsd(btResult.realizedProfit)}
                      </div>
                    </div>
                  )}
                  <div style={{ padding: 8, borderRadius: 6, background: "rgba(0,0,0,0.30)", border: "1px solid rgba(255,255,255,0.10)" }}>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: "#c4b5fd", textTransform: "uppercase" as const }}>Final qty</div>
                    <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "ui-monospace, monospace", color: "#fff" }}>{btResult.finalQty.toFixed(6)}</div>
                    <div style={{ fontSize: 9, color: "#94a3b8", fontFamily: "ui-monospace, monospace" }}>{btPair.split("/")[0]}</div>
                  </div>
                </div>
                {/* Equity curve */}
                {eqSvg && (
                  <div style={{ padding: 8, borderRadius: 6, background: "rgba(0,0,0,0.30)", border: "1px solid rgba(255,255,255,0.10)" }}>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: "#c4b5fd", textTransform: "uppercase" as const, marginBottom: 4 }}>
                      P&L equity curve · {btResult.equity.length} candles
                    </div>
                    {eqSvg}
                  </div>
                )}
              </div>
            )}

            <div style={{ fontSize: 10, color: "#c4b5fd", marginTop: 10, lineHeight: 1.5 }}>
              Backtest применяет стратегию на исторических 30s-candles той пары (накопленных pair tick'ами).
              Чем дольше держишь страничку открытой — тем больше candle history для backtest.
              DCA: buy fixed-amount каждые N candles. Grid: buy/sell на cross levels. B&H: одна покупка на старте.
            </div>
          </section>
        );
      })()}

      <AccountsLedgerSection />
      </ProductPageShell>
    </main>
  );
}

// ─── Equity curve ──────────────────────────────────────────────────
// Cumulative realized P&L over time, with running max (peak) overlay
// and drawdown shaded area. Pure SVG.
function EquityCurve({ points }: { points: { ts: number; equity: number }[] }) {
  if (points.length < 2) return null;
  const W = 100;
  const H = 22;
  const minEq = Math.min(0, ...points.map((p) => p.equity));
  const maxEq = Math.max(0, ...points.map((p) => p.equity));
  const range = (maxEq - minEq) || 1;
  // Build running peak
  let runningPeak = -Infinity;
  const peaks = points.map((p) => { runningPeak = Math.max(runningPeak, p.equity); return runningPeak });
  const yOf = (v: number) => H - ((v - minEq) / range) * H;
  const xOf = (i: number) => (i / (points.length - 1)) * W;
  const eqPath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(i).toFixed(2)} ${yOf(p.equity).toFixed(2)}`).join(" ");
  const peakPath = peaks.map((v, i) => `${i === 0 ? "M" : "L"} ${xOf(i).toFixed(2)} ${yOf(v).toFixed(2)}`).join(" ");
  // Shaded drawdown area between peak and equity (only where below peak)
  const ddArea = (() => {
    const top = peaks.map((v, i) => `${i === 0 ? "M" : "L"} ${xOf(i).toFixed(2)} ${yOf(v).toFixed(2)}`).join(" ");
    const bot = points.map((p, i) => `L ${xOf(points.length - 1 - i).toFixed(2)} ${yOf(points[points.length - 1 - i].equity).toFixed(2)}`).join(" ");
    return `${top} ${bot} Z`;
  })();
  // Zero line
  const zeroY = yOf(0);
  const lastEq = points[points.length - 1].equity;
  const lastColor = lastEq >= 0 ? "#22c55e" : "#ef4444";
  return (
    <div style={{ marginBottom: 10, padding: "8px 10px", borderRadius: 8, background: "rgba(0,0,0,0.18)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" as const, color: "#94a3b8" }}>
          📈 Equity curve · кумулятивный P&L
        </span>
        <span style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", fontWeight: 800, color: lastColor }}>
          {lastEq >= 0 ? "+" : ""}{lastEq.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 70, display: "block" }}>
        {/* Zero line */}
        {zeroY >= 0 && zeroY <= H && (
          <line x1={0} x2={W} y1={zeroY} y2={zeroY} stroke="rgba(255,255,255,0.18)" strokeWidth={0.12} strokeDasharray="0.6 0.4" />
        )}
        {/* Drawdown shaded */}
        <path d={ddArea} fill="rgba(220,38,38,0.18)" />
        {/* Running peak */}
        <path d={peakPath} stroke="rgba(34,197,94,0.45)" strokeWidth={0.16} fill="none" strokeDasharray="0.5 0.3" />
        {/* Equity */}
        <path d={eqPath} stroke={lastColor} strokeWidth={0.28} fill="none" />
      </svg>
    </div>
  );
}

// ─── Advanced analytics ────────────────────────────────────────────
// 12 derived metrics в plain key/value сетке. Цветовая семантика: зелёный =
// healthy, жёлтый = borderline, красный = problem. Tooltip explains each metric
// в plain Russian — то, чего не хватает обычным trade history.
function AdvancedAnalytics({ stats }: { stats: PortfolioStats }) {
  if (stats.total === 0) return null;
  const sharpeColor = stats.sharpeLike === null ? "#94a3b8" : stats.sharpeLike >= 1.5 ? "#22c55e" : stats.sharpeLike >= 0.5 ? "#fbbf24" : "#f87171";
  const pfColor = stats.profitFactor === null ? "#94a3b8" : stats.profitFactor >= 1.5 ? "#22c55e" : stats.profitFactor >= 1 ? "#fbbf24" : "#f87171";
  const expColor = stats.expectancy > 0 ? "#22c55e" : stats.expectancy < 0 ? "#f87171" : "#cbd5e1";
  const payoffColor = stats.payoffRatio === null ? "#94a3b8" : stats.payoffRatio >= 1.5 ? "#22c55e" : stats.payoffRatio >= 1 ? "#fbbf24" : "#f87171";
  const ddColor = stats.maxDrawdownPct < 10 ? "#86efac" : stats.maxDrawdownPct < 25 ? "#fbbf24" : "#f87171";
  const streakColor = stats.currentStreak.kind === "W" ? "#86efac" : stats.currentStreak.kind === "L" ? "#fca5a5" : "#94a3b8";
  return (
    <div style={{
      marginBottom: 10, padding: "10px 12px", borderRadius: 8,
      background: "linear-gradient(135deg, rgba(99,102,241,0.07), rgba(34,211,238,0.05))",
      border: "1px solid rgba(99,102,241,0.18)",
    }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.6, color: "#a5b4fc", textTransform: "uppercase" as const, marginBottom: 8 }}>
        🧮 Advanced metrics · risk-adjusted performance
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
        <Metric label="Sharpe-like" tooltip="√N × meanR / stdevR — насколько стабильно на единицу риска" color={sharpeColor}
          value={stats.sharpeLike === null ? "—" : stats.sharpeLike.toFixed(2)} />
        <Metric label="Profit factor" tooltip="grossWin / grossLoss — каждый $1 убытков покрывается стольким" color={pfColor}
          value={stats.profitFactor === null ? (stats.grossWin > 0 ? "∞" : "—") : stats.profitFactor.toFixed(2)} />
        <Metric label="Expectancy" tooltip="ожидаемый P&L на сделку = winrate × avgWin − lossrate × avgLoss" color={expColor}
          value={`${stats.expectancy >= 0 ? "+" : ""}${fmtUsd(stats.expectancy)}`} />
        <Metric label="Payoff ratio" tooltip="avgWin / avgLoss — типичная победа versus типичный проигрыш" color={payoffColor}
          value={stats.payoffRatio === null ? (stats.avgWin > 0 ? "∞" : "—") : stats.payoffRatio.toFixed(2)} />
        <Metric label="Avg R" tooltip="средний %-return на сделку (signed)" color={stats.avgRPct >= 0 ? "#86efac" : "#fca5a5"}
          value={`${stats.avgRPct >= 0 ? "+" : ""}${stats.avgRPct.toFixed(2)}%`} />
        <Metric label="Stdev R" tooltip="разброс %-доходности — мера риска / волатильности" color="#cbd5e1"
          value={`${stats.stddevRPct.toFixed(2)}%`} />
        <Metric label="Avg win" tooltip="средняя прибыль по выигрышной сделке" color="#86efac"
          value={fmtUsd(stats.avgWin)} />
        <Metric label="Avg loss" tooltip="средний убыток по проигрышной сделке" color="#fca5a5"
          value={`-${fmtUsd(stats.avgLoss)}`} />
        <Metric label="Max DD" tooltip="макс. просадка в $ от пика equity" color="#fca5a5"
          value={`-${fmtUsd(stats.maxDrawdown)}`} />
        <Metric label="Max DD %" tooltip="та же просадка в % от пика" color={ddColor}
          value={`${stats.maxDrawdownPct.toFixed(1)}%`} />
        <Metric label="Best streak" tooltip={`лонгест W ${stats.longestWinStreak} · L ${stats.longestLossStreak}`} color="#cbd5e1"
          value={`${stats.longestWinStreak}W · ${stats.longestLossStreak}L`} />
        <Metric label="Current streak" tooltip="текущая серия — W (вин), L (лосс) или — (ничья/начало)" color={streakColor}
          value={stats.currentStreak.kind === "—" ? "—" : `${stats.currentStreak.kind}×${stats.currentStreak.len}`} />
        <Metric label="Avg holding" tooltip="средняя длительность сделки от входа до выхода" color="#cbd5e1"
          value={fmtMs(stats.avgHoldingMs)} />
        <Metric label="Long / Short" tooltip={`Long ${stats.longCount} / Short ${stats.shortCount}`} color="#cbd5e1"
          value={`${stats.longCount}/${stats.shortCount}`} />
        <Metric label="Long PnL" tooltip="суммарный realized P&L по long-сделкам" color={stats.longPnl >= 0 ? "#86efac" : "#fca5a5"}
          value={`${stats.longPnl >= 0 ? "+" : ""}${fmtUsd(stats.longPnl)}`} />
        <Metric label="Short PnL" tooltip="суммарный realized P&L по short-сделкам" color={stats.shortPnl >= 0 ? "#86efac" : "#fca5a5"}
          value={`${stats.shortPnl >= 0 ? "+" : ""}${fmtUsd(stats.shortPnl)}`} />
      </div>
    </div>
  );
}

function Metric({ label, value, color, tooltip }: { label: string; value: string | number; color: string; tooltip?: string }) {
  return (
    <div title={tooltip} style={{
      padding: "6px 8px", borderRadius: 6,
      background: "rgba(0,0,0,0.18)",
      border: "1px solid rgba(255,255,255,0.05)",
      cursor: tooltip ? "help" : "default",
    }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.4, color: "#94a3b8", textTransform: "uppercase" as const, marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontFamily: "ui-monospace, monospace", fontWeight: 800, color, lineHeight: 1.1 }}>
        {value}
      </div>
    </div>
  );
}

// ─── Calendar heatmap — last 28 days realized P&L by day ──────────
function CalendarHeatmap({ cells }: { cells: CalendarCell[] }) {
  if (cells.length === 0) return null;
  const maxAbs = Math.max(1, ...cells.map((c) => Math.abs(c.pnl)));
  const labels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  // Align grid: first cell weekday → leading empty slots
  const firstDate = new Date(cells[0].dayKey + "T00:00:00");
  const firstDay = (firstDate.getDay() + 6) % 7; // Mon=0
  const grid: (CalendarCell | null)[] = Array(firstDay).fill(null).concat(cells);
  const totalPnl = cells.reduce((s, c) => s + c.pnl, 0);
  const tradingDays = cells.filter((c) => c.trades > 0).length;
  const avgPerDay = tradingDays > 0 ? totalPnl / tradingDays : 0;
  return (
    <div style={{
      marginBottom: 10, padding: "10px 12px", borderRadius: 8,
      background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, flexWrap: "wrap" as const, gap: 6 }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.6, color: "#94a3b8", textTransform: "uppercase" as const }}>
          📅 Calendar · последние 28 дней
        </div>
        <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#cbd5e1" }}>
          <span>Trading days: <strong style={{ color: "#fff" }}>{tradingDays}/28</strong></span>
          <span>Avg/day: <strong style={{ color: avgPerDay >= 0 ? "#86efac" : "#fca5a5" }}>{avgPerDay >= 0 ? "+" : ""}{fmtUsd(avgPerDay)}</strong></span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
        {labels.map((l) => (
          <div key={l} style={{ fontSize: 9, color: "#64748b", textAlign: "center" as const, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" as const }}>{l}</div>
        ))}
        {grid.map((cell, i) => {
          if (!cell) return <div key={`pad-${i}`} />;
          const intensity = Math.abs(cell.pnl) / maxAbs;
          const bg = cell.pnl > 0
            ? `rgba(34,197,94,${0.15 + intensity * 0.55})`
            : cell.pnl < 0
              ? `rgba(220,38,38,${0.15 + intensity * 0.55})`
              : cell.trades > 0 ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)";
          const day = new Date(cell.dayKey + "T00:00:00").getDate();
          return (
            <div key={cell.dayKey} title={`${cell.dayKey} · ${cell.trades} сделок · ${cell.wins}W/${cell.losses}L · ${cell.pnl >= 0 ? "+" : ""}${fmtUsd(cell.pnl)}`}
              style={{
                aspectRatio: "1 / 1",
                borderRadius: 4, background: bg,
                border: cell.trades > 0 ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(255,255,255,0.04)",
                padding: 3, display: "flex", flexDirection: "column", justifyContent: "space-between" as const,
                cursor: cell.trades > 0 ? "help" : "default",
                position: "relative" as const, minHeight: 38,
              }}>
              <div style={{ fontSize: 9, color: cell.trades > 0 ? "#fff" : "#475569", fontWeight: 700, lineHeight: 1 }}>{day}</div>
              {cell.trades > 0 && (
                <div style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", fontWeight: 800, color: cell.pnl >= 0 ? "#86efac" : "#fca5a5", lineHeight: 1, textAlign: "right" as const }}>
                  {cell.pnl >= 0 ? "+" : ""}{Math.abs(cell.pnl) >= 1000 ? `${(cell.pnl / 1000).toFixed(1)}K` : cell.pnl.toFixed(0)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Per-pair breakdown ────────────────────────────────────────────
function PairBreakdownTable({ rows }: { rows: PairBreakdown[] }) {
  const headerStyle = { fontSize: 9, color: "#64748b", fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" as const };
  const monoCell = { fontFamily: "ui-monospace, monospace" };
  return (
    <div style={{
      marginBottom: 10, padding: "10px 12px", borderRadius: 8,
      background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.6, color: "#94a3b8", textTransform: "uppercase" as const, marginBottom: 8 }}>
        🎯 По парам · best & worst performers
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(80px, 1.2fr) 0.6fr 0.6fr 1fr 0.8fr 1fr", rowGap: 4, columnGap: 8, fontSize: 11, alignItems: "center" as const }}>
        <div style={headerStyle}>Pair</div>
        <div style={{ ...headerStyle, textAlign: "right" as const }}>Trades</div>
        <div style={{ ...headerStyle, textAlign: "right" as const }}>WR</div>
        <div style={{ ...headerStyle, textAlign: "right" as const }}>P&L</div>
        <div style={{ ...headerStyle, textAlign: "right" as const }}>Avg R</div>
        <div style={{ ...headerStyle, textAlign: "right" as const }}>Range</div>
        {rows.map((r) => {
          const wrColor = r.winrate >= 55 ? "#86efac" : r.winrate >= 40 ? "#fde68a" : "#fca5a5";
          const pnlColor = r.pnl >= 0 ? "#86efac" : "#fca5a5";
          return (
            <PairRow key={r.pair} row={r} wrColor={wrColor} pnlColor={pnlColor} monoCell={monoCell} />
          );
        })}
      </div>
    </div>
  );
}

function PairRow({ row, wrColor, pnlColor, monoCell }: { row: PairBreakdown; wrColor: string; pnlColor: string; monoCell: React.CSSProperties }) {
  return (
    <>
      <div style={{ fontWeight: 800, color: "#fff", ...monoCell }}>{row.pair}</div>
      <div style={{ ...monoCell, color: "#cbd5e1", textAlign: "right" as const }}>{row.trades}</div>
      <div style={{ ...monoCell, color: wrColor, textAlign: "right" as const }}>{row.winrate.toFixed(0)}%</div>
      <div style={{ ...monoCell, color: pnlColor, fontWeight: 800, textAlign: "right" as const }}>
        {row.pnl >= 0 ? "+" : ""}{fmtUsd(row.pnl)}
      </div>
      <div style={{ ...monoCell, color: row.avgR >= 0 ? "#86efac" : "#fca5a5", textAlign: "right" as const }}>
        {row.avgR >= 0 ? "+" : ""}{row.avgR.toFixed(2)}%
      </div>
      <div style={{ ...monoCell, color: "#94a3b8", textAlign: "right" as const, fontSize: 10 }}>
        {row.worstPct.toFixed(1)} … {row.bestPct >= 0 ? "+" : ""}{row.bestPct.toFixed(1)}%
      </div>
    </>
  );
}

// ─── OHLC Candlestick chart ────────────────────────────────────────
// Pure-SVG, no external deps. Base = 30s candles × 40 (20m of base history),
// higher timeframes агрегируются on-the-fly через aggregateCandles().
const TF_KEY = "aevion_qtrade_chart_tf_v1";

function loadTf(): TimeframeMs {
  try {
    const s = typeof window !== "undefined" ? localStorage.getItem(TF_KEY) : null;
    if (!s) return 30_000;
    const n = Number(s);
    if (TIMEFRAMES.some((t) => t.ms === n)) return n as TimeframeMs;
  } catch {}
  return 30_000;
}

function CandleChart({ pair }: { pair: Pair }) {
  const [tf, setTf] = useState<TimeframeMs>(30_000);
  // Lazy hydrate from localStorage post-mount (SSR-safe)
  useEffect(() => { setTf(loadTf()) }, []);
  useEffect(() => { try { localStorage.setItem(TF_KEY, String(tf)) } catch {} }, [tf]);

  const baseCandles = pair.candles || [];
  const candles = useMemo(() => aggregateCandles(baseCandles, tf), [baseCandles, tf]);
  const tfLabel = TIMEFRAMES.find((t) => t.ms === tf)?.label ?? "30s";
  if (candles.length < 2) {
    // Fallback: на высоких TF может быть меньше 2 buckets — показать инфо
    return (
      <div style={{
        padding: 12, borderRadius: 10,
        background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.1)",
        marginBottom: 10, color: "#94a3b8", fontSize: 12, textAlign: "center" as const,
      }}>
        <TfPicker tf={tf} onChange={setTf} />
        <div style={{ marginTop: 8 }}>На таймфрейме {tfLabel} пока недостаточно истории · открой 30s или 1m</div>
      </div>
    );
  }
  const W = 100;        // viewBox width — scales via SVG
  const H = 36;         // viewBox height for chart area
  const VOL_H = 8;      // height of volume bars below
  const PADDING = 1;
  const minP = Math.min(...candles.map((c) => c.l));
  const maxP = Math.max(...candles.map((c) => c.h));
  const range = (maxP - minP) || 1;
  const maxVol = Math.max(...candles.map((c) => c.vol), 1);
  const candleW = (W - PADDING * 2) / candles.length;
  const bodyW = Math.max(0.4, candleW * 0.62);
  const yOf = (p: number) => H - ((p - minP) / range) * H;
  const decimals = pair.price > 100 ? 2 : pair.price > 1 ? 4 : 5;
  // Last candle
  const lastC = candles[candles.length - 1];
  const change = lastC.c - candles[0].o;
  const changePct = (change / candles[0].o) * 100;
  // Total span covered (in minutes) — base × 30s × n / 60
  const spanMin = Math.round((baseCandles.length * 30) / 60);
  return (
    <div style={{
      padding: 12, borderRadius: 10,
      background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.1)",
      marginBottom: 10,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap" as const, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" as const, color: "#94a3b8" }}>
            📈 {pair.symbol} · {tfLabel} × {candles.length} ({spanMin}m base)
          </span>
          <TfPicker tf={tf} onChange={setTf} />
        </div>
        <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#cbd5e1", fontFamily: "ui-monospace, monospace", flexWrap: "wrap" as const }}>
          <span>O <strong style={{ color: "#fff" }}>{candles[0].o.toFixed(decimals)}</strong></span>
          <span>H <strong style={{ color: "#86efac" }}>{Math.max(...candles.map(c => c.h)).toFixed(decimals)}</strong></span>
          <span>L <strong style={{ color: "#fca5a5" }}>{Math.min(...candles.map(c => c.l)).toFixed(decimals)}</strong></span>
          <span>C <strong style={{ color: "#fff" }}>{lastC.c.toFixed(decimals)}</strong></span>
          <span style={{ color: change >= 0 ? "#22c55e" : "#f87171", fontWeight: 800 }}>
            {change >= 0 ? "+" : ""}{change.toFixed(decimals)} ({changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%)
          </span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H + VOL_H + 1}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: 160, display: "block" }}
      >
        {/* Grid: 4 horizontal lines at 25/50/75% */}
        {[0.25, 0.5, 0.75].map((p) => (
          <line key={p} x1={0} x2={W} y1={H * p} y2={H * p} stroke="rgba(255,255,255,0.06)" strokeWidth={0.1} />
        ))}
        {/* Candles + volume */}
        {candles.map((c, i) => {
          const x = PADDING + i * candleW + (candleW - bodyW) / 2;
          const isUp = c.c >= c.o;
          const fill = isUp ? "#22c55e" : "#ef4444";
          const wickX = PADDING + i * candleW + candleW / 2;
          const bodyTop = yOf(Math.max(c.o, c.c));
          const bodyBot = yOf(Math.min(c.o, c.c));
          const bodyH = Math.max(0.3, bodyBot - bodyTop);
          const volH = (c.vol / maxVol) * VOL_H;
          return (
            <g key={i}>
              {/* Wick */}
              <line x1={wickX} x2={wickX} y1={yOf(c.h)} y2={yOf(c.l)} stroke={fill} strokeWidth={0.18} />
              {/* Body */}
              <rect x={x} y={bodyTop} width={bodyW} height={bodyH} fill={fill} opacity={isUp ? 0.95 : 0.95} />
              {/* Volume bar */}
              <rect x={x} y={H + 1 + (VOL_H - volH)} width={bodyW} height={volH} fill={fill} opacity={0.4} />
            </g>
          );
        })}
        {/* Last price line */}
        <line x1={0} x2={W} y1={yOf(lastC.c)} y2={yOf(lastC.c)} stroke="#22d3ee" strokeWidth={0.12} strokeDasharray="0.6 0.4" opacity={0.8} />
      </svg>
    </div>
  );
}

// ─── Timeframe picker (used in CandleChart) ──────────────────────────
function TfPicker({ tf, onChange }: { tf: TimeframeMs; onChange: (t: TimeframeMs) => void }) {
  return (
    <div style={{
      display: "inline-flex", gap: 0,
      padding: 2, borderRadius: 6,
      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    }}>
      {TIMEFRAMES.map((t) => {
        const active = t.ms === tf;
        return (
          <button key={t.ms} onClick={() => onChange(t.ms)}
            style={{
              padding: "3px 9px", borderRadius: 4, border: "none",
              background: active ? "rgba(34,211,238,0.25)" : "transparent",
              color: active ? "#67e8f9" : "#94a3b8",
              fontSize: 10, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase" as const,
              cursor: active ? "default" : "pointer",
              fontFamily: "ui-monospace, monospace",
              transition: "all 0.15s",
            }}>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
