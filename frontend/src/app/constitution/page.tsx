"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { ConstitutionEmbed } from "@/components/ConstitutionEmbed";
import { countryByCode } from "@/lib/constitution";
import { useFunnel } from "@/lib/useFunnel";

const API = "/api-backend/api/constitution";
const STORAGE_KEY = "constitution.draft";

import {
  classify,
  computeMetrics,
  COUNTRIES,
  DEFAULT_SLIDERS,
  PRESETS,
  SLIDER_META,
  type Country,
  type Metrics,
  type Preset,
  type Regime,
  type SliderMeta,
  type Sliders,
} from "@/lib/constitution";
import { PageTracking } from "@/components/PageTracking";

type TourStep = {
  // era/year/title/narrative text lives in i18n-data.ts under
  // "constitution.tour.<index>.*" — looked up via t() at render time.
  sliders: Sliders;
};

const TOUR: TourStep[] = [
  {
    sliders: {
      floor: 15,
      ruleOfLaw: 35,
      rotation: 5,
      transparency: 20,
      multiStatus: 25,
      skinInGame: 60,
      polycentricity: 70,
      positiveSum: 25,
    },
  },
  {
    sliders: {
      floor: 18,
      ruleOfLaw: 50,
      rotation: 10,
      transparency: 30,
      multiStatus: 30,
      skinInGame: 55,
      polycentricity: 60,
      positiveSum: 30,
    },
  },
  {
    sliders: {
      floor: 22,
      ruleOfLaw: 55,
      rotation: 15,
      transparency: 35,
      multiStatus: 45,
      skinInGame: 55,
      polycentricity: 55,
      positiveSum: 55,
    },
  },
  {
    sliders: {
      floor: 35,
      ruleOfLaw: 70,
      rotation: 35,
      transparency: 45,
      multiStatus: 50,
      skinInGame: 50,
      polycentricity: 50,
      positiveSum: 60,
    },
  },
  {
    sliders: {
      floor: 65,
      ruleOfLaw: 80,
      rotation: 45,
      transparency: 65,
      multiStatus: 60,
      skinInGame: 45,
      polycentricity: 45,
      positiveSum: 65,
    },
  },
  {
    sliders: {
      floor: 75,
      ruleOfLaw: 85,
      rotation: 65,
      transparency: 80,
      multiStatus: 75,
      skinInGame: 65,
      polycentricity: 70,
      positiveSum: 80,
    },
  },
];

function changedKeys(from: Sliders, to: Sliders, threshold = 5): Set<keyof Sliders> {
  const out = new Set<keyof Sliders>();
  for (const k of Object.keys(to) as Array<keyof Sliders>) {
    if (Math.abs(to[k] - from[k]) >= threshold) out.add(k);
  }
  return out;
}

type ShockId = "war" | "pandemic" | "crisis" | "tech";
type Shock = {
  id: ShockId;
  icon: string;
  // name/desc text lives in i18n-data.ts under "constitution.shock.<id>.*"
  // — looked up via t() at render time.
  delta: Partial<Record<keyof Sliders, number>>;
};

const SHOCKS: Shock[] = [
  {
    id: "war",
    icon: "🪖",
    delta: {
      transparency: -30,
      multiStatus: -25,
      polycentricity: -25,
      ruleOfLaw: -15,
      rotation: -10,
      floor: -10,
      positiveSum: -20,
      skinInGame: +15,
    },
  },
  {
    id: "pandemic",
    icon: "🦠",
    delta: {
      polycentricity: -20,
      multiStatus: -15,
      transparency: -10,
      ruleOfLaw: -5,
      floor: +5,
      positiveSum: -15,
    },
  },
  {
    id: "crisis",
    icon: "💸",
    delta: {
      positiveSum: -35,
      floor: -15,
      multiStatus: -10,
      transparency: -5,
      skinInGame: +5,
    },
  },
  {
    id: "tech",
    icon: "🚀",
    delta: {
      positiveSum: +30,
      polycentricity: +15,
      multiStatus: +10,
      ruleOfLaw: -5,
      transparency: -5,
      floor: -5,
    },
  },
];

function applyShock(s: Sliders, delta: Partial<Record<keyof Sliders, number>>): Sliders {
  const next = { ...s };
  for (const key of Object.keys(delta) as Array<keyof Sliders>) {
    const d = delta[key] ?? 0;
    next[key] = Math.max(0, Math.min(100, s[key] + d));
  }
  return next;
}

type SavedScenario = {
  id: string;
  title: string;
  regime: string;
  createdAt: string;
  sliders?: Sliders;
  metrics?: Metrics;
  regimeId?: string;
};

export default function ConstitutionPage() {
  const { t } = useI18n();
  const { track } = useFunnel();
  useEffect(() => { track("page_view"); }, [track]);

  // Касса возвращает сюда после УСПЕШНОЙ оплаты: `?upgrade=success&tier=...`.
  // До 29.08.2026 страница этот признак не читала, и человек, только что
  // заплативший, попадал на обычную страницу — ни благодарности, ни
  // подтверждения. Понять, прошла ли оплата, он не мог.
  //
  // Сегодня путь спит: LemonSqueezy не настроен. Он оживёт ровно в день, когда
  // зададут ключи, — и тогда молчание встретит ПЕРВОГО настоящего покупателя.
  const [paidTier, setPaidTier] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    if (q.get("upgrade") !== "success") return;
    const tier = q.get("tier");
    setPaidTier(tier === "team" ? "Team" : "Pro");
    // Событие в словаре воронки БЫЛО, а слал его никто: завершение покупки
    // не фиксировалось вовсе. Теперь фиксируется.
    track("upgrade_complete", { tier: tier ?? "pro" });
  }, [track]);

  // Auto-redirect first-time visitors to /welcome (unless they came via deep-link)
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const hasDeepLink = sp.has("artifact") || sp.has("country") || sp.has("compare");
      const onboarded = window.localStorage.getItem("constitution.onboarded");
      if (!onboarded && !hasDeepLink) {
        window.location.replace("/constitution/welcome");
      }
    } catch {
      /* ignore — bail out, let the user use the editor */
    }
  }, []);
  const localizedSliderMeta = useMemo(
    () =>
      SLIDER_META.map((m) => ({
        ...m,
        label: t(`constitution.slider.${m.key}.label`),
      })),
    [t],
  );
  const [sliders, setSliders] = useState<Sliders>(DEFAULT_SLIDERS);
  const [title, setTitle] = useState<string>("");
  const [saved, setSaved] = useState<SavedScenario[]>([]);
  const [busy, setBusy] = useState<boolean>(false);
  const [savedTotal, setSavedTotal] = useState<number>(0);
  const [activeShock, setActiveShock] = useState<ShockId | null>(null);

  const activeShockObj = useMemo(
    () => SHOCKS.find((s) => s.id === activeShock) ?? null,
    [activeShock],
  );
  const shockedSliders = useMemo<Sliders | null>(
    () => (activeShockObj ? applyShock(sliders, activeShockObj.delta) : null),
    [activeShockObj, sliders],
  );
  const shockedRegime = useMemo(
    () => (shockedSliders ? classify(shockedSliders) : null),
    [shockedSliders],
  );
  const applyShockNow = useCallback(() => {
    if (shockedSliders) {
      setSliders(shockedSliders);
      setActiveShock(null);
    }
  }, [shockedSliders]);

  const [signing, setSigning] = useState<boolean>(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<boolean>(false);
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState<boolean>(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [openedArtifactId, setOpenedArtifactId] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [plan, setPlan] = useState<"free" | "pro" | null>(null);
  const [planLimits, setPlanLimits] = useState<{ savedScenarios: number; aiSuggestPerDay: number } | null>(null);
  const [collabPeers, setCollabPeers] = useState<Array<{ id: string; name: string; color: string }>>([]);
  const [collabSelf, setCollabSelf] = useState<{ id: string; name: string; color: string } | null>(null);
  const [remoteHighlights, setRemoteHighlights] = useState<Record<string, { color: string; name: string; ts: number }>>({});
  const collabWsRef = useRef<WebSocket | null>(null);

  // Establish collab WebSocket when ?artifact=X is in URL.
  useEffect(() => {
    if (!openedArtifactId) return;
    const name = (() => {
      try {
        const stored = window.localStorage.getItem("constitution.username");
        if (stored) return stored;
      } catch { /* ignore */ }
      const fresh = `user-${Math.random().toString(36).slice(2, 6)}`;
      try { window.localStorage.setItem("constitution.username", fresh); } catch {}
      return fresh;
    })();
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/api-backend/api/constitution/collab?artifact=${encodeURIComponent(openedArtifactId)}&name=${encodeURIComponent(name)}`;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(url);
    } catch {
      return;
    }
    collabWsRef.current = ws;
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as Record<string, unknown>;
        const t = msg.type;
        if (t === "presence-self" && msg.self) {
          setCollabSelf(msg.self as { id: string; name: string; color: string });
        } else if (t === "presence" && Array.isArray(msg.peers)) {
          setCollabPeers(msg.peers as Array<{ id: string; name: string; color: string }>);
        } else if (t === "slider" && typeof msg.key === "string") {
          const key = msg.key as keyof Sliders;
          const value = Number(msg.value);
          if (Number.isFinite(value)) {
            setSliders((s) => ({ ...s, [key]: Math.max(0, Math.min(100, value)) }));
            setRemoteHighlights((prev) => ({
              ...prev,
              [key]: {
                color: String(msg.color ?? "#22d3ee"),
                name: String(msg.name ?? "peer"),
                ts: Date.now(),
              },
            }));
          }
        } else if (t === "cursor" && msg.key) {
          const key = String(msg.key) as keyof Sliders;
          setRemoteHighlights((prev) => ({
            ...prev,
            [key]: {
              color: String(msg.color ?? "#22d3ee"),
              name: String(msg.name ?? "peer"),
              ts: Date.now(),
            },
          }));
        }
      } catch {
        /* ignore */
      }
    };
    ws.onclose = () => {
      collabWsRef.current = null;
    };
    return () => {
      try { ws?.close(); } catch { /* ignore */ }
      collabWsRef.current = null;
      setCollabPeers([]);
      setCollabSelf(null);
    };
  }, [openedArtifactId]);

  // Decay remote highlights after 1.5s
  useEffect(() => {
    const t = setInterval(() => {
      setRemoteHighlights((prev) => {
        const now = Date.now();
        const next: typeof prev = {};
        let changed = false;
        for (const [k, v] of Object.entries(prev)) {
          if (now - v.ts < 1500) next[k] = v;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api-backend/api/constitution/me/plan");
        if (!r.ok) return;
        const j = (await r.json()) as {
          plan: "free" | "pro";
          limits: { savedScenarios: number; aiSuggestPerDay: number };
        };
        setPlan(j.plan);
        setPlanLimits(j.limits);
      } catch {
        /* ignore — default to "no plan info, no paywall" */
      }
    })();
  }, []);

  const overSaveLimit =
    plan === "free" &&
    planLimits !== null &&
    planLimits.savedScenarios > 0 &&
    savedTotal >= planLimits.savedScenarios;
  const [compareAId, setCompareAId] = useState<string | null>(null);
  const [compareBId, setCompareBId] = useState<string | null>(null);

  // Read ?compare=A,B from URL once on mount
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const c = sp.get("compare");
      if (c) {
        const [a, b] = c.split(",").map((s) => s.trim());
        if (a) setCompareAId(a);
        if (b) setCompareBId(b);
      }
      // Deep-link from Globus / external: ?country=<code>
      const countryCode = sp.get("country");
      if (countryCode) {
        const cc = countryByCode(countryCode);
        if (cc) {
          setSliders({ ...DEFAULT_SLIDERS, ...cc.sliders });
          setTitle(`${cc.flag} ${cc.name}`);
        }
      }
      // Deep-link from leaderboard: ?artifact=<id>
      const artifactId = sp.get("artifact");
      if (artifactId) {
        setOpenedArtifactId(artifactId);
        void (async () => {
          try {
            const r = await fetch(
              `/api-backend/api/planet/constitution-artifacts/${encodeURIComponent(artifactId)}`,
            );
            if (!r.ok) return;
            const j = (await r.json()) as {
              payload?: { sliders?: Sliders; title?: string };
            };
            if (j.payload?.sliders) {
              setSliders({ ...DEFAULT_SLIDERS, ...j.payload.sliders });
            }
            if (j.payload?.title) {
              setTitle(j.payload.title);
            }
          } catch {
            /* ignore — page still works without prefilled sliders */
          }
        })();
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Keep URL in sync with compare selection
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      if (compareAId || compareBId) {
        sp.set("compare", `${compareAId ?? ""},${compareBId ?? ""}`);
      } else {
        sp.delete("compare");
      }
      const query = sp.toString();
      const url = window.location.pathname + (query ? `?${query}` : "");
      window.history.replaceState({}, "", url);
    } catch {
      /* ignore */
    }
  }, [compareAId, compareBId]);

  const compareA = useMemo(
    () => (compareAId ? saved.find((s) => s.id === compareAId) ?? null : null),
    [compareAId, saved],
  );
  const compareB = useMemo(
    () => (compareBId ? saved.find((s) => s.id === compareBId) ?? null : null),
    [compareBId, saved],
  );

  const [tourStep, setTourStep] = useState<number | null>(null);
  const tourActive = tourStep !== null;
  const tourHighlight = useMemo<Set<keyof Sliders>>(() => {
    if (tourStep === null || tourStep === 0) return new Set();
    return changedKeys(TOUR[tourStep - 1].sliders, TOUR[tourStep].sliders);
  }, [tourStep]);
  // Событие `tour_completed` было в словаре воронки и не отправлялось ниоткуда:
  // мы знали, сколько человек НАЧАЛО знакомство с продуктом, и никогда —
  // сколько дошло до конца. Начало без завершения — это половина воронки.
  //
  // Флаг нужен, чтобы событие ушло ОДИН раз за тур: на последний шаг можно
  // вернуться кнопкой «назад-вперёд», и без него мы считали бы одно
  // прохождение несколько раз, то есть завысили бы собственную метрику.
  const tourFinishedRef = useRef(false);
  const goToTourStep = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(TOUR.length - 1, idx));
    setTourStep(clamped);
    setSliders(TOUR[clamped].sliders);
    if (clamped === TOUR.length - 1 && !tourFinishedRef.current) {
      tourFinishedRef.current = true;
      track("tour_completed", { steps: TOUR.length });
    }
  }, [track]);
  const startTour = useCallback(() => {
    track("tour_started");
    tourFinishedRef.current = false; // новый тур считается заново
    goToTourStep(0);
  }, [goToTourStep, track]);
  const exitTour = useCallback(() => setTourStep(null), []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Sliders>;
        if (parsed && typeof parsed === "object") {
          setSliders({ ...DEFAULT_SLIDERS, ...parsed });
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sliders));
    } catch {
      /* ignore */
    }
  }, [sliders]);

  const loadRecent = useCallback(async () => {
    try {
      const r = await fetch(`${API}/scenarios?limit=30`);
      if (!r.ok) return;
      const j = await r.json();
      if (Array.isArray(j?.items)) {
        const items = j.items as Array<{
          id: string;
          title: string;
          summary?: string | null;
          createdAt: string;
          payload?: {
            sliders?: Sliders;
            metrics?: Metrics;
            tags?: string[];
          };
          tags?: string[];
        }>;
        setSaved(
          items.map((it) => {
            const tags = it.tags ?? it.payload?.tags ?? [];
            const regimeId = tags.find((t) => t !== "governance") ?? undefined;
            return {
              id: it.id,
              title: it.title,
              regime: it.summary ?? "",
              createdAt: it.createdAt,
              sliders: it.payload?.sliders,
              metrics: it.payload?.metrics,
              regimeId,
            };
          }),
        );
        setSavedTotal(typeof j.total === "number" ? j.total : items.length);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  const metrics = useMemo(() => computeMetrics(sliders), [sliders]);
  const regime = useMemo(() => classify(sliders), [sliders]);

  const setSlider = useCallback(
    (k: keyof Sliders, v: number) => {
      setSliders((s) => ({ ...s, [k]: v }));
      track("slider_change", { key: k, value: v });
      const ws = collabWsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ type: "slider", key: k, value: v })); } catch { /* ignore */ }
      }
    },
    [track],
  );

  const reset = useCallback(() => setSliders(DEFAULT_SLIDERS), []);

  const save = useCallback(async () => {
    if (!title.trim()) return;
    track("save_clicked");
    setBusy(true);
    try {
      const r = await fetch(`${API}/scenarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          sliders,
          regime: regime.name,
          metrics,
          tags: ["governance", regime.id],
        }),
      });
      if (r.ok) {
        track("save_success", { regime: regime.id });
        setTitle("");
        await loadRecent();
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }, [title, sliders, regime, metrics, loadRecent, track]);

  const signAndDownload = useCallback(async () => {
    track("qsign_clicked");
    setSigning(true);
    setSignError(null);
    try {
      const cleanTitle = title.trim() || "untitled-constitution";
      const payload = {
        module: "aevion.constitution",
        version: 1,
        title: cleanTitle,
        regime: { id: regime.id, name: regime.name, era: regime.era },
        sliders: Object.fromEntries(
          (Object.keys(sliders) as Array<keyof Sliders>)
            .sort()
            .map((k) => [k, sliders[k]]),
        ),
        metrics: Object.fromEntries(
          (Object.keys(metrics) as Array<keyof Metrics>)
            .sort()
            .map((k) => [k, metrics[k]]),
        ),
        issuedAt: new Date().toISOString(),
      };
      const r = await fetch("/api-backend/api/qsign/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        throw new Error(`QSign HTTP ${r.status}: ${text.slice(0, 120)}`);
      }
      const signed = (await r.json()) as {
        payload: unknown;
        signature: string;
        algo: string;
        createdAt: string;
      };
      const envelope = {
        spec: "aevion.constitution/v1+qsign",
        algo: signed.algo,
        signedAt: signed.createdAt,
        signature: signed.signature,
        payload: signed.payload,
        verify: {
          endpoint: "/api/qsign/verify",
          hint: "POST { payload, signature } — must return { valid: true }",
        },
      };
      const slug = cleanTitle
        .toLowerCase()
        .replace(/[^a-z0-9а-яё-]+/giu, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || "constitution";
      const ts = signed.createdAt.replace(/[:.]/g, "-");
      const filename = `constitution-${slug}-${ts}.signed.json`;
      const blob = new Blob([JSON.stringify(envelope, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setSignError(err instanceof Error ? err.message : "sign_failed");
    } finally {
      setSigning(false);
    }
  }, [title, sliders, regime, metrics]);

  const downloadPdf = useCallback(async () => {
    track("pdf_download", { regime: regime.id });
    setPdfBusy(true);
    setPdfError(null);
    try {
      const cleanTitle = title.trim() || "untitled-constitution";
      const r = await fetch("/api-backend/api/constitution/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cleanTitle,
          sliders,
          regime: { id: regime.id, name: regime.name, era: regime.era },
          artifactId: openedArtifactId ?? undefined,
        }),
      });
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        throw new Error(`PDF HTTP ${r.status}: ${text.slice(0, 120)}`);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const slug = cleanTitle.toLowerCase().replace(/[^a-z0-9а-яё-]+/giu, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "constitution";
      a.download = `constitution-${slug}-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "pdf_failed");
    } finally {
      setPdfBusy(false);
    }
  }, [title, sliders, regime, openedArtifactId]);

  const publishToPlanet = useCallback(async () => {
    track("planet_publish", { regime: regime.id });
    setPublishing(true);
    setPublishError(null);
    setPublishedId(null);
    try {
      const cleanTitle = title.trim() || "untitled-constitution";
      const payload = {
        module: "aevion.constitution",
        version: 1,
        title: cleanTitle,
        regime: { id: regime.id, name: regime.name, era: regime.era },
        sliders: Object.fromEntries(
          (Object.keys(sliders) as Array<keyof Sliders>)
            .sort()
            .map((k) => [k, sliders[k]]),
        ),
        metrics: Object.fromEntries(
          (Object.keys(metrics) as Array<keyof Metrics>)
            .sort()
            .map((k) => [k, metrics[k]]),
        ),
        issuedAt: new Date().toISOString(),
      };
      const signRes = await fetch("/api-backend/api/qsign/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!signRes.ok) {
        throw new Error(`QSign HTTP ${signRes.status}`);
      }
      const signed = (await signRes.json()) as {
        payload: unknown;
        signature: string;
        algo: string;
        createdAt: string;
      };
      const envelope = {
        spec: "aevion.constitution/v1+qsign",
        algo: signed.algo,
        signedAt: signed.createdAt,
        signature: signed.signature,
        payload: signed.payload,
      };
      const pubRes = await fetch("/api-backend/api/planet/constitution-artifacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ envelope }),
      });
      if (!pubRes.ok) {
        const text = await pubRes.text().catch(() => "");
        throw new Error(`Planet HTTP ${pubRes.status}: ${text.slice(0, 120)}`);
      }
      const j = (await pubRes.json()) as { artifact?: { id?: string } };
      if (j.artifact?.id) setPublishedId(j.artifact.id);
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : "publish_failed");
    } finally {
      setPublishing(false);
    }
  }, [title, sliders, regime, metrics]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b1736] via-[#131f3d] to-[#050a1a] text-[#e7ecf8] p-6">
      {paidTier ? (
        <div
          role="status"
          className="mx-auto mt-4 mb-2 max-w-3xl rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-emerald-100"
        >
          <strong className="block mb-1">{t("constitution.pay.thanksTitle")}</strong>
          {t("constitution.pay.thanksBody", { tier: paidTier })}
        </div>
      ) : null}
      <div className="max-w-6xl mx-auto">
      {/* Общий замер платформы. Свою подробную воронку модуль ведёт сам
          (useFunnel → /api/constitution/funnel/track), но она отдельная: в
          сводке платформы посещения Конституции не появлялись ВООБЩЕ, хотя
          это страница с кнопкой покупки. Два канала намеренно — этот отвечает
          на «сколько человек пришло на AEVION и сколько ушло платить»; между
          собой их складывать нельзя, один визит попадёт в оба. */}
      <PageTracking page="constitution" />
        <header className="mb-6">
          <Link href="/" className="text-[#d4af37] hover:underline text-sm">
            ← AEVION
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold mt-2 text-[#d4af37]">
            {t("constitution.title")}
          </h1>
          <p className="text-[#9aa3c0] mt-2 max-w-3xl">{t("constitution.subtitle")}</p>
          {openedArtifactId && collabPeers.length > 1 && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-400/40 text-xs">
              <span className="text-cyan-300 font-semibold">
                👀 {collabPeers.length} viewing live
              </span>
              <div className="flex -space-x-1">
                {collabPeers.slice(0, 6).map((p) => (
                  <span
                    key={p.id}
                    title={p.name + (collabSelf?.id === p.id ? " (you)" : "")}
                    style={{ background: p.color }}
                    className="w-5 h-5 rounded-full border-2 border-[#0b1736] text-[10px] text-[#0b1736] font-bold flex items-center justify-center"
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
          )}
          {!tourActive && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={startTour}
                className="px-4 py-2 rounded bg-gradient-to-r from-[#d4af37] to-[#f5d27a] text-[#0b1736] font-semibold hover:opacity-90"
              >
                ▶ {t("constitution.tour.heading")}
              </button>
              <Link
                href="/constitution/leaderboard"
                className="px-4 py-2 rounded border border-emerald-400/60 text-emerald-300 font-semibold hover:bg-emerald-500/10"
              >
                🌍 Planet Leaderboard →
              </Link>
              <Link
                href="/constitution/stats"
                className="px-4 py-2 rounded border border-cyan-400/60 text-cyan-300 font-semibold hover:bg-cyan-500/10"
              >
                📊 {t("constitution.nav.analytics")} →
              </Link>
              <button
                type="button"
                onClick={() => setAiOpen(true)}
                className="px-4 py-2 rounded border border-fuchsia-400/60 text-fuchsia-300 font-semibold hover:bg-fuchsia-500/10"
              >
                🤖 {t("constitution.nav.askAi")}
              </button>
              <Link
                href="/constitution/api"
                className="px-4 py-2 rounded border border-orange-400/60 text-orange-300 font-semibold hover:bg-orange-500/10"
              >
                {`</> API`}
              </Link>
              <Link
                href="/constitution/learn"
                className="px-4 py-2 rounded border border-emerald-400/60 text-emerald-300 font-semibold hover:bg-emerald-500/10"
              >
                🎓 Academy
              </Link>
              <Link
                href="/constitution/blog"
                className="px-4 py-2 rounded border border-amber-400/60 text-amber-300 font-semibold hover:bg-amber-500/10"
              >
                📝 Blog
              </Link>
              <Link
                href="/constitution/pricing"
                className="px-4 py-2 rounded bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-[#0b1736] font-bold hover:opacity-90"
              >
                💎 Pricing
              </Link>
            </div>
          )}
          {aiOpen && (
            <AiAdvisorModal
              onClose={() => setAiOpen(false)}
              onApply={(s, expl) => {
                setSliders({ ...DEFAULT_SLIDERS, ...s });
                setAiExplanation(expl);
                setAiOpen(false);
              }}
            />
          )}
          {aiExplanation && (
            <div className="mt-3 max-w-3xl text-sm text-fuchsia-200 border border-fuchsia-500/30 rounded px-3 py-2 bg-fuchsia-500/5">
              <span className="font-semibold">🤖 {t("constitution.ai.label")}</span> {aiExplanation}
              <button
                type="button"
                onClick={() => setAiExplanation(null)}
                className="ml-3 text-xs text-fuchsia-300 hover:underline"
              >
                {t("constitution.button.close")}
              </button>
            </div>
          )}
        </header>

        {tourActive && tourStep !== null && (
          <section className="mb-6 border border-[#d4af37]/40 rounded-xl p-5 bg-gradient-to-br from-[#0b1736]/80 to-[#131f3d]/80">
            <div className="flex justify-between items-baseline mb-2 flex-wrap gap-2">
              <div>
                <div className="text-xs uppercase tracking-wide text-[#9aa3c0]">
                  {tourStep + 1} / {TOUR.length} · {t(`constitution.tour.${tourStep}.year`)}
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-[#d4af37]">
                  {t(`constitution.tour.${tourStep}.era`)}
                </h2>
                <div className="text-sm text-[#f5d27a] italic mt-1">
                  {t(`constitution.tour.${tourStep}.title`)}
                </div>
              </div>
              <button
                type="button"
                onClick={exitTour}
                className="text-xs px-3 py-1 rounded border border-[#d4af37]/40 hover:bg-[#d4af37]/10"
              >
                {t("constitution.button.exitTour")}
              </button>
            </div>
            <p className="text-sm text-[#e7ecf8] leading-relaxed">
              {t(`constitution.tour.${tourStep}.narrative`)}
            </p>
            <div className="flex justify-between items-center mt-4 gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => goToTourStep(tourStep - 1)}
                disabled={tourStep === 0}
                className="px-4 py-2 rounded border border-[#d4af37]/40 hover:bg-[#d4af37]/10 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
              >
                ← {t("constitution.button.back")}
              </button>
              <div className="flex gap-1">
                {TOUR.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => goToTourStep(i)}
                    aria-label={`Step ${i + 1}`}
                    className={`w-2.5 h-2.5 rounded-full transition ${
                      i === tourStep
                        ? "bg-[#d4af37]"
                        : i < tourStep
                          ? "bg-[#d4af37]/50"
                          : "bg-[#d4af37]/15 hover:bg-[#d4af37]/30"
                    }`}
                  />
                ))}
              </div>
              {tourStep < TOUR.length - 1 ? (
                <button
                  type="button"
                  onClick={() => goToTourStep(tourStep + 1)}
                  className="px-4 py-2 rounded bg-[#d4af37] text-[#0b1736] font-semibold hover:opacity-90 text-sm"
                >
                  {t("constitution.button.next")} →
                </button>
              ) : (
                <div className="px-4 py-2 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm font-semibold">
                  {t("constitution.tour.final")}
                </div>
              )}
            </div>
          </section>
        )}

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#0b1736]/60 border border-[#d4af37]/20 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[#f5d27a]">
                {t("constitution.params.heading")}
              </h2>
              <button
                type="button"
                onClick={reset}
                className="text-xs px-3 py-1 rounded border border-[#d4af37]/40 hover:bg-[#d4af37]/10"
              >
                {t("constitution.button.reset")}
              </button>
            </div>

            <div className="space-y-4">
              {localizedSliderMeta.map((m) => {
                const val = sliders[m.key];
                const highlighted = tourHighlight.has(m.key);
                const remote = remoteHighlights[m.key];
                return (
                  <div
                    key={m.key}
                    className={
                      highlighted
                        ? "rounded-md px-2 py-1 -mx-2 ring-2 ring-emerald-400/60 bg-emerald-500/5 transition"
                        : remote
                          ? "rounded-md px-2 py-1 -mx-2 ring-2 transition"
                          : ""
                    }
                    style={remote && !highlighted ? { boxShadow: `0 0 0 2px ${remote.color}55` } : undefined}
                  >
                    <div className="flex justify-between items-baseline">
                      <label htmlFor={`s-${m.key}`} className="font-medium">
                        {highlighted && <span className="text-emerald-400 mr-1">●</span>}
                        {m.label}
                      </label>
                      <span className="text-[#d4af37] font-mono text-sm">{val}</span>
                    </div>
                    <input
                      id={`s-${m.key}`}
                      type="range"
                      min={0}
                      max={100}
                      value={val}
                      onChange={(e) => setSlider(m.key, Number(e.target.value))}
                      className="w-full accent-[#d4af37]"
                    />
                    <div className="flex justify-between text-xs text-[#9aa3c0] mt-1">
                      <span>{m.low}</span>
                      <span>{m.high}</span>
                    </div>
                    <p className="text-xs text-[#9aa3c0] italic mt-1">{m.hint}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 pt-4 border-t border-[#d4af37]/20">
              <div className="text-xs text-[#9aa3c0] mb-2">
                {t("constitution.button.presets")}
              </div>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setSliders(p.sliders)}
                    className="text-xs px-3 py-1 rounded border border-[#d4af37]/30 hover:bg-[#d4af37]/10"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="bg-[#0b1736]/60 border border-[#d4af37]/30 rounded-xl p-5">
              <div className="text-xs uppercase tracking-wide text-[#9aa3c0]">
                {t("constitution.regime.heading")}
              </div>
              <h3 className="text-2xl font-bold text-[#d4af37] mt-1">
                {t(`constitution.regime.${regime.id}.name`)}
              </h3>
              <div className="text-sm text-[#9aa3c0] italic">
                {t(`constitution.regime.${regime.id}.era`)}
              </div>
              <p className="mt-3">{t(`constitution.regime.${regime.id}.summary`)}</p>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="border border-emerald-500/30 rounded p-3 bg-emerald-500/5">
                  <div className="text-emerald-300 text-xs uppercase mb-1">+</div>
                  <div>{t(`constitution.regime.${regime.id}.pros`)}</div>
                </div>
                <div className="border border-rose-500/30 rounded p-3 bg-rose-500/5">
                  <div className="text-rose-300 text-xs uppercase mb-1">−</div>
                  <div>{t(`constitution.regime.${regime.id}.cons`)}</div>
                </div>
              </div>
            </div>

            <div className="bg-[#0b1736]/60 border border-[#d4af37]/20 rounded-xl p-5">
              <h3 className="text-lg font-semibold text-[#f5d27a] mb-3">
                {t("constitution.metrics.heading")}
              </h3>
              <MetricBar label={t("constitution.metrics.eliteFear")} value={metrics.eliteFear} invert />
              <MetricBar label={t("constitution.metrics.intraConflict")} value={metrics.intraConflict} invert />
              <MetricBar label={t("constitution.metrics.resentment")} value={metrics.resentment} invert />
              <MetricBar label={t("constitution.metrics.innovation")} value={metrics.innovation} />
              <MetricBar label={t("constitution.metrics.stability")} value={metrics.stability} />
              <MetricBar label={t("constitution.metrics.legitimacy")} value={metrics.legitimacy} />
            </div>

            <div className="bg-[#0b1736]/60 border border-[#d4af37]/20 rounded-xl p-5">
              <h3 className="text-lg font-semibold text-[#f5d27a] mb-1">{t("constitution.spider.heading")}</h3>
              <div className="text-xs text-[#9aa3c0] mb-2">
                {t("constitution.spider.description")}
              </div>
              <SpiderChart sliders={sliders} shockedSliders={shockedSliders} />
            </div>

            {overSaveLimit && <ProPaywallBanner savedTotal={savedTotal} limit={planLimits?.savedScenarios ?? 5} />}

            <div className="bg-[#0b1736]/60 border border-[#d4af37]/20 rounded-xl p-5">
              <h3 id="constitution-save-heading" className="text-lg font-semibold text-[#f5d27a] mb-3">
                {t("constitution.save.heading")}
                {savedTotal > 0 ? ` (${t("constitution.save.total", { count: savedTotal })})` : ""}
                {plan === "pro" && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white font-bold align-middle">
                    PRO
                  </span>
                )}
              </h3>
              <div className="flex flex-wrap gap-2">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  // Поле держалось на одной подсказке, а она исчезает при
                  // вводе — читалка объявляла его безымянным ровно тогда,
                  // когда в нём работают. Найдено сторожем AEVION-A11yNamesWatch
                  // 28.08.2026. Связываю с заголовком блока: новых ключей
                  // не завожу — словарь сейчас перестраивает соседняя ветка.
                  aria-labelledby="constitution-save-heading"
                  placeholder={t("constitution.save.titlePlaceholder")}
                  className="flex-1 min-w-[180px] bg-[#050a1a] border border-[#d4af37]/30 rounded px-3 py-2 text-sm"
                  maxLength={120}
                />
                <button
                  type="button"
                  onClick={save}
                  disabled={busy || !title.trim()}
                  className="px-4 py-2 rounded bg-[#d4af37] text-[#0b1736] font-semibold disabled:opacity-40"
                >
                  {busy ? "..." : t("constitution.button.save")}
                </button>
                <button
                  type="button"
                  onClick={signAndDownload}
                  disabled={signing}
                  title={t("constitution.qsign.signTooltip")}
                  className="px-4 py-2 rounded border border-[#d4af37] text-[#d4af37] font-semibold hover:bg-[#d4af37]/10 disabled:opacity-40"
                >
                  {signing ? "..." : t("constitution.button.qsignDownload")}
                </button>
                <button
                  type="button"
                  onClick={publishToPlanet}
                  disabled={publishing}
                  title={t("constitution.qsign.publishTooltip")}
                  className="px-4 py-2 rounded border border-emerald-400/60 text-emerald-300 font-semibold hover:bg-emerald-500/10 disabled:opacity-40"
                >
                  {publishing ? "..." : `🌍 ${t("constitution.button.publishPlanet")}`}
                </button>
                <button
                  type="button"
                  onClick={downloadPdf}
                  disabled={pdfBusy}
                  title={t("constitution.pdf.tooltip")}
                  className="px-4 py-2 rounded border border-orange-400/60 text-orange-300 font-semibold hover:bg-orange-500/10 disabled:opacity-40"
                >
                  {pdfBusy ? "..." : `📄 ${t("constitution.button.downloadPdf")}`}
                </button>
              </div>
              {pdfError && (
                <div className="mt-2 text-xs text-rose-400 border border-rose-500/30 rounded px-2 py-1 bg-rose-500/5">
                  PDF: {pdfError}
                </div>
              )}
              {signError && (
                <div className="mt-2 text-xs text-rose-400 border border-rose-500/30 rounded px-2 py-1 bg-rose-500/5">
                  {t("constitution.error.signPrefix", { error: signError ?? "" })}
                </div>
              )}
              {publishError && (
                <div className="mt-2 text-xs text-rose-400 border border-rose-500/30 rounded px-2 py-1 bg-rose-500/5">
                  Planet publish failed: {publishError}
                </div>
              )}
              {publishedId && (
                <div className="mt-2 text-xs text-emerald-300 border border-emerald-500/40 rounded px-2 py-1 bg-emerald-500/5">
                  ✓ {t("constitution.publish.success")}{" "}
                  <code className="font-mono">{publishedId.slice(0, 8)}</code>{" "}
                  <span className="text-[#9aa3c0]">{t("constitution.publish.stubNote")}</span>
                </div>
              )}
              {saved.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs text-[#9aa3c0] mb-2">{t("constitution.save.recentHeading")}</div>
                  <ul className="space-y-1 text-sm">
                    {saved.slice(0, 8).map((it) => (
                      <li
                        key={it.id}
                        className="flex justify-between border-b border-[#d4af37]/10 py-1"
                      >
                        <span className="truncate flex-1">{it.title}</span>
                        <span className="text-[#9aa3c0] text-xs ml-2 truncate max-w-[40%]">
                          {it.regime}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-6">
          <StressTestPanel
            sliders={sliders}
            activeShock={activeShock}
            shockedRegime={shockedRegime}
            onPick={setActiveShock}
            onClear={() => setActiveShock(null)}
            onApply={applyShockNow}
            currentRegime={regime}
          />
        </section>

        <section className="mt-6">
          <WorldMapScatter
            sliders={sliders}
            shockedSliders={shockedSliders}
            shockLabel={activeShockObj ? `${activeShockObj.icon} ${t(`constitution.shock.${activeShockObj.id}.name`)}` : null}
          />
        </section>

        {openedArtifactId && (
          <section className="mt-6">
            <SimilarPanel artifactId={openedArtifactId} onApply={(s) => setSliders({ ...DEFAULT_SLIDERS, ...s })} />
          </section>
        )}

        {openedArtifactId && (
          <section id="comments" className="mt-6">
            <SocialPanel artifactId={openedArtifactId} />
          </section>
        )}

        <section className="mt-6">
          <ComparePanel
            saved={saved}
            compareA={compareA}
            compareB={compareB}
            onPickA={setCompareAId}
            onPickB={setCompareBId}
            onClear={() => {
              setCompareAId(null);
              setCompareBId(null);
            }}
          />
        </section>

        <footer className="mt-8 text-xs text-[#9aa3c0] max-w-3xl">
          <p>
            {t("constitution.footer.theoreticalBasis")}
          </p>
        </footer>
      </div>
    </div>
  );
}

function SpiderChart({
  sliders,
  shockedSliders,
}: {
  sliders: Sliders;
  shockedSliders?: Sliders | null;
}) {
  const { t } = useI18n();
  const W = 360;
  const H = 360;
  const cx = W / 2;
  const cy = H / 2;
  const radius = 120;
  const n = SLIDER_META.length; // 8

  const angleFor = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pointAt = (i: number, val: number) => {
    const a = angleFor(i);
    const r = (val / 100) * radius;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };

  const polygonPoints = (vals: number[]) =>
    vals
      .map((v, i) => {
        const p = pointAt(i, v);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(" ");

  const valsCurrent = SLIDER_META.map((m) => sliders[m.key]);
  const valsShocked = shockedSliders ? SLIDER_META.map((m) => shockedSliders[m.key]) : null;

  // Short axis labels for radial layout (full names too long)
  const SHORT_LABELS: Record<keyof Sliders, string> = {
    floor: t("constitution.spider.short.floor"),
    ruleOfLaw: t("constitution.spider.short.ruleOfLaw"),
    rotation: t("constitution.spider.short.rotation"),
    transparency: t("constitution.spider.short.transparency"),
    multiStatus: "Multi-status",
    skinInGame: "Skin",
    polycentricity: t("constitution.spider.short.polycentricity"),
    positiveSum: "Pos-sum",
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-w-[360px] mx-auto block">
      {/* concentric rings */}
      {[25, 50, 75, 100].map((pct) => {
        const r = (pct / 100) * radius;
        return (
          <circle
            key={pct}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="#d4af37"
            strokeOpacity={pct === 100 ? 0.4 : 0.15}
            strokeDasharray={pct === 100 ? undefined : "3 4"}
          />
        );
      })}

      {/* axes + labels */}
      {SLIDER_META.map((m, i) => {
        const outer = pointAt(i, 100);
        const labelPos = pointAt(i, 118);
        const a = angleFor(i);
        const anchor =
          Math.cos(a) > 0.3 ? "start" : Math.cos(a) < -0.3 ? "end" : "middle";
        return (
          <g key={m.key}>
            <line
              x1={cx}
              y1={cy}
              x2={outer.x}
              y2={outer.y}
              stroke="#d4af37"
              strokeOpacity={0.18}
            />
            <text
              x={labelPos.x}
              y={labelPos.y}
              fill="#9aa3c0"
              fontSize="10"
              textAnchor={anchor}
              dominantBaseline="middle"
            >
              {SHORT_LABELS[m.key]}
            </text>
          </g>
        );
      })}

      {/* shocked polygon (under current so current is on top) */}
      {valsShocked && (
        <polygon
          points={polygonPoints(valsShocked)}
          fill="#f472b6"
          fillOpacity={0.22}
          stroke="#f472b6"
          strokeWidth={2}
          strokeDasharray="4 3"
        />
      )}

      {/* current polygon */}
      <polygon
        points={polygonPoints(valsCurrent)}
        fill="#22d3ee"
        fillOpacity={0.28}
        stroke="#22d3ee"
        strokeWidth={2}
      />

      {/* dots on each vertex */}
      {valsCurrent.map((v, i) => {
        const p = pointAt(i, v);
        return <circle key={i} cx={p.x} cy={p.y} r={3} fill="#22d3ee" />;
      })}
      {valsShocked &&
        valsShocked.map((v, i) => {
          const p = pointAt(i, v);
          return <circle key={`s-${i}`} cx={p.x} cy={p.y} r={2.5} fill="#f472b6" />;
        })}
    </svg>
  );
}

function MetricBar({
  label,
  value,
  invert,
}: {
  label: string;
  value: number;
  invert?: boolean;
}) {
  const color = invert
    ? value > 60
      ? "bg-rose-500"
      : value > 30
        ? "bg-amber-500"
        : "bg-emerald-500"
    : value > 60
      ? "bg-emerald-500"
      : value > 30
        ? "bg-amber-500"
        : "bg-rose-500";
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span>{label}</span>
        <span className="text-[#d4af37] font-mono">{value}</span>
      </div>
      <div className="w-full h-2 bg-[#050a1a] rounded">
        <div className={`h-full rounded ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function WorldMapScatter({
  sliders,
  shockedSliders,
  shockLabel,
}: {
  sliders: Sliders;
  shockedSliders?: Sliders | null;
  shockLabel?: string | null;
}) {
  const { t } = useI18n();
  const currentMetrics = computeMetrics(sliders);
  const shockedMetrics = shockedSliders ? computeMetrics(shockedSliders) : null;
  const W = 720;
  const H = 480;
  const PAD = 56;
  const xFor = (v: number) => PAD + ((100 - v) / 100) * (W - 2 * PAD); // invert: low elite-fear → right
  const yFor = (v: number) => H - PAD - (v / 100) * (H - 2 * PAD); // high innovation → top

  const points = COUNTRIES.map((c) => {
    const m = computeMetrics(c.sliders);
    return { ...c, eliteFear: m.eliteFear, innovation: m.innovation };
  });

  const cx = xFor(currentMetrics.eliteFear);
  const cy = yFor(currentMetrics.innovation);
  const sx = shockedMetrics ? xFor(shockedMetrics.eliteFear) : null;
  const sy = shockedMetrics ? yFor(shockedMetrics.innovation) : null;

  return (
    <div className="bg-[#0b1736]/60 border border-[#d4af37]/30 rounded-xl p-5">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-lg font-semibold text-[#f5d27a]">
          {t("constitution.map.heading")}
        </h3>
        <div className="text-xs text-[#9aa3c0]">
          {t("constitution.map.axesLegend")}
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto max-w-full"
          style={{ minWidth: 480 }}
        >
          {/* axes */}
          <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#d4af37" strokeOpacity={0.4} />
          <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#d4af37" strokeOpacity={0.4} />
          {/* gridlines at 50 */}
          <line x1={xFor(50)} y1={PAD} x2={xFor(50)} y2={H - PAD} stroke="#d4af37" strokeOpacity={0.12} strokeDasharray="4 6" />
          <line x1={PAD} y1={yFor(50)} x2={W - PAD} y2={yFor(50)} stroke="#d4af37" strokeOpacity={0.12} strokeDasharray="4 6" />
          {/* quadrant labels */}
          <text x={W - PAD - 8} y={PAD + 14} textAnchor="end" fill="#10b981" fontSize="11" opacity={0.7}>
            ↗ {t("constitution.map.quadrant.freedomGrowth")}
          </text>
          <text x={PAD + 8} y={PAD + 14} fill="#f97316" fontSize="11" opacity={0.7}>
            {t("constitution.map.quadrant.fearGrowth")}
          </text>
          <text x={W - PAD - 8} y={H - PAD - 8} textAnchor="end" fill="#9aa3c0" fontSize="11" opacity={0.7}>
            {t("constitution.map.quadrant.freedomStagnation")}
          </text>
          <text x={PAD + 8} y={H - PAD - 8} fill="#ef4444" fontSize="11" opacity={0.7}>
            ↙ {t("constitution.map.quadrant.fearStagnation")}
          </text>
          {/* axis ticks */}
          <text x={PAD} y={H - PAD + 18} fill="#9aa3c0" fontSize="10">100</text>
          <text x={W - PAD} y={H - PAD + 18} textAnchor="end" fill="#9aa3c0" fontSize="10">0</text>
          <text x={PAD - 6} y={PAD + 4} textAnchor="end" fill="#9aa3c0" fontSize="10">100</text>
          <text x={PAD - 6} y={H - PAD} textAnchor="end" fill="#9aa3c0" fontSize="10">0</text>
          <text x={W / 2} y={H - PAD + 32} textAnchor="middle" fill="#d4af37" fontSize="12">
            {t("constitution.map.xAxisLabel")}
          </text>
          <text
            x={PAD - 28}
            y={H / 2}
            textAnchor="middle"
            fill="#d4af37"
            fontSize="12"
            transform={`rotate(-90 ${PAD - 28} ${H / 2})`}
          >
            ↑ {t("constitution.map.yAxisLabel")}
          </text>

          {/* country points */}
          {points.map((p) => (
            <g key={p.name}>
              <circle cx={xFor(p.eliteFear)} cy={yFor(p.innovation)} r={4} fill="#d4af37" opacity={0.55} />
              <text
                x={xFor(p.eliteFear) + 8}
                y={yFor(p.innovation) + 4}
                fontSize="14"
              >
                {p.flag}
              </text>
              <text
                x={xFor(p.eliteFear) + 28}
                y={yFor(p.innovation) + 4}
                fill="#9aa3c0"
                fontSize="10"
              >
                {p.name}
              </text>
            </g>
          ))}

          {/* current scenario — glowing dot */}
          <circle cx={cx} cy={cy} r={14} fill="#22d3ee" opacity={0.18}>
            <animate attributeName="r" values="10;18;10" dur="2.4s" repeatCount="indefinite" />
          </circle>
          <circle cx={cx} cy={cy} r={7} fill="#22d3ee" stroke="#0b1736" strokeWidth={2} />
          <text x={cx + 12} y={cy + 4} fill="#22d3ee" fontSize="12" fontWeight="bold">
            {t("constitution.map.youAreHere")}
          </text>

          {/* shocked scenario — magenta dot with arrow */}
          {sx !== null && sy !== null && (
            <g>
              <defs>
                <marker
                  id="shockArrow"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto"
                >
                  <path d="M0,0 L10,5 L0,10 z" fill="#f472b6" />
                </marker>
              </defs>
              <line
                x1={cx}
                y1={cy}
                x2={sx}
                y2={sy}
                stroke="#f472b6"
                strokeWidth={2}
                strokeDasharray="6 4"
                opacity={0.85}
                markerEnd="url(#shockArrow)"
              />
              <circle cx={sx} cy={sy} r={14} fill="#f472b6" opacity={0.18}>
                <animate attributeName="r" values="10;18;10" dur="1.8s" repeatCount="indefinite" />
              </circle>
              <circle cx={sx} cy={sy} r={7} fill="#f472b6" stroke="#0b1736" strokeWidth={2} />
              <text x={sx + 12} y={sy + 4} fill="#f472b6" fontSize="12" fontWeight="bold">
                {t("constitution.map.afterPrefix")} {shockLabel ?? t("constitution.map.shockFallback")}
              </text>
            </g>
          )}
        </svg>
      </div>
      <p className="text-xs text-[#9aa3c0] mt-3">
        {t("constitution.map.description")}
      </p>
    </div>
  );
}

function ComparePanel({
  saved,
  compareA,
  compareB,
  onPickA,
  onPickB,
  onClear,
}: {
  saved: SavedScenario[];
  compareA: SavedScenario | null;
  compareB: SavedScenario | null;
  onPickA: (id: string | null) => void;
  onPickB: (id: string | null) => void;
  onClear: () => void;
}) {
  const { t } = useI18n();
  const pickable = saved.filter((s) => s.sliders);
  const slidersA = compareA?.sliders ?? null;
  const slidersB = compareB?.sliders ?? null;
  const metricsA = slidersA ? compareA?.metrics ?? computeMetrics(slidersA) : null;
  const metricsB = slidersB ? compareB?.metrics ?? computeMetrics(slidersB) : null;
  const regimeA = slidersA ? classify(slidersA) : null;
  const regimeB = slidersB ? classify(slidersB) : null;
  const both = slidersA && slidersB;

  return (
    <div className="bg-[#0b1736]/60 border border-[#d4af37]/20 rounded-xl p-5">
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-lg font-semibold text-[#f5d27a]">{t("constitution.compare.heading")}</h3>
        <div className="text-xs text-[#9aa3c0]">
          {t("constitution.compare.description")}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        <div>
          <div className="text-xs uppercase text-[#22d3ee] mb-1">{t("constitution.compare.slotA")}</div>
          <select
            value={compareA?.id ?? ""}
            onChange={(e) => onPickA(e.target.value || null)}
            className="w-full bg-[#050a1a] border border-[#22d3ee]/40 rounded px-3 py-2 text-sm"
          >
            <option value="">{t("constitution.compare.selectPlaceholder")}</option>
            {pickable.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} {s.regime ? `· ${s.regime}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="text-xs uppercase text-[#f472b6] mb-1">{t("constitution.compare.slotB")}</div>
          <select
            value={compareB?.id ?? ""}
            onChange={(e) => onPickB(e.target.value || null)}
            className="w-full bg-[#050a1a] border border-[#f472b6]/40 rounded px-3 py-2 text-sm"
          >
            <option value="">{t("constitution.compare.selectPlaceholder")}</option>
            {pickable.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} {s.regime ? `· ${s.regime}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {pickable.length === 0 && (
        <div className="text-sm text-[#9aa3c0] italic">
          {t("constitution.compare.emptyState")}
        </div>
      )}

      {(compareA || compareB) && (
        <div className="text-right mb-3">
          <button
            type="button"
            onClick={onClear}
            className="text-xs px-3 py-1 rounded border border-[#d4af37]/30 hover:bg-[#d4af37]/10"
          >
            {t("constitution.compare.clearSelection")}
          </button>
        </div>
      )}

      {both && slidersA && slidersB && metricsA && metricsB && regimeA && regimeB && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
            <div className="border border-[#22d3ee]/40 rounded p-3 bg-[#22d3ee]/5">
              <div className="text-[#22d3ee] font-semibold">{compareA!.title}</div>
              <div className="text-sm font-bold mt-1">{regimeA.name}</div>
              <div className="text-xs text-[#9aa3c0] italic">{regimeA.era}</div>
              <div className="text-xs mt-2">
                <span className="text-emerald-300">+</span> {regimeA.pros}
              </div>
              <div className="text-xs mt-1">
                <span className="text-rose-300">−</span> {regimeA.cons}
              </div>
            </div>
            <div className="border border-[#f472b6]/40 rounded p-3 bg-[#f472b6]/5">
              <div className="text-[#f472b6] font-semibold">{compareB!.title}</div>
              <div className="text-sm font-bold mt-1">{regimeB.name}</div>
              <div className="text-xs text-[#9aa3c0] italic">{regimeB.era}</div>
              <div className="text-xs mt-2">
                <span className="text-emerald-300">+</span> {regimeB.pros}
              </div>
              <div className="text-xs mt-1">
                <span className="text-rose-300">−</span> {regimeB.cons}
              </div>
            </div>
          </div>

          <div className="mb-5">
            <div className="text-xs text-[#9aa3c0] mb-2">{t("constitution.compare.slidersHeading")}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-2">
              {SLIDER_META.map((m) => {
                const va = slidersA[m.key];
                const vb = slidersB[m.key];
                return (
                  <div key={m.key}>
                    <div className="flex justify-between text-xs">
                      <span className="truncate">{m.label}</span>
                      <span className="font-mono text-[#9aa3c0]">
                        <span className="text-[#22d3ee]">{va}</span> ·{" "}
                        <span className="text-[#f472b6]">{vb}</span>
                      </span>
                    </div>
                    <div className="relative w-full h-2 bg-[#050a1a] rounded">
                      <div
                        className="absolute top-0 left-0 h-full rounded bg-[#22d3ee]"
                        style={{ width: `${va}%`, opacity: 0.55 }}
                      />
                      <div
                        className="absolute top-0 left-0 h-full rounded bg-[#f472b6]"
                        style={{ width: `${vb}%`, opacity: 0.55 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mb-5">
            <div className="text-xs text-[#9aa3c0] mb-2">{t("constitution.compare.indexDeltaHeading")}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-2 text-xs">
              {(
                [
                  ["eliteFear", t("constitution.metrics.eliteFear"), true],
                  ["intraConflict", t("constitution.metrics.intraConflict"), true],
                  ["resentment", t("constitution.metrics.resentment"), true],
                  ["innovation", t("constitution.metrics.innovation"), false],
                  ["stability", t("constitution.metrics.stability"), false],
                  ["legitimacy", t("constitution.metrics.legitimacy"), false],
                ] as Array<[keyof Metrics, string, boolean]>
              ).map(([key, label, invert]) => {
                const va = metricsA[key];
                const vb = metricsB[key];
                const d = vb - va;
                // For invert metrics (bad ones): negative delta is improvement (green)
                const good = invert ? d < 0 : d > 0;
                return (
                  <div key={key} className="flex justify-between items-center">
                    <span className="truncate">{label}</span>
                    <span className="font-mono">
                      <span className="text-[#22d3ee]">{va}</span>
                      <span className="text-[#9aa3c0] mx-1">→</span>
                      <span className="text-[#f472b6]">{vb}</span>
                      <span
                        className={`ml-2 ${d === 0 ? "text-[#9aa3c0]" : good ? "text-emerald-400" : "text-rose-400"}`}
                      >
                        ({d > 0 ? "+" : ""}
                        {d})
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <MiniCompareScatter slidersA={slidersA} slidersB={slidersB} />
        </>
      )}
    </div>
  );
}

function MiniCompareScatter({
  slidersA,
  slidersB,
}: {
  slidersA: Sliders;
  slidersB: Sliders;
}) {
  const { t } = useI18n();
  const ma = computeMetrics(slidersA);
  const mb = computeMetrics(slidersB);
  const W = 560;
  const H = 320;
  const PAD = 44;
  const xFor = (v: number) => PAD + ((100 - v) / 100) * (W - 2 * PAD);
  const yFor = (v: number) => H - PAD - (v / 100) * (H - 2 * PAD);
  const ax = xFor(ma.eliteFear);
  const ay = yFor(ma.innovation);
  const bx = xFor(mb.eliteFear);
  const by = yFor(mb.innovation);
  return (
    <div>
      <div className="text-xs text-[#9aa3c0] mb-1">
        {t("constitution.compare.miniMapCaption")}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-w-full">
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#d4af37" strokeOpacity={0.4} />
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#d4af37" strokeOpacity={0.4} />
        <line x1={xFor(50)} y1={PAD} x2={xFor(50)} y2={H - PAD} stroke="#d4af37" strokeOpacity={0.12} strokeDasharray="4 6" />
        <line x1={PAD} y1={yFor(50)} x2={W - PAD} y2={yFor(50)} stroke="#d4af37" strokeOpacity={0.12} strokeDasharray="4 6" />
        {COUNTRIES.map((c) => {
          const m = computeMetrics(c.sliders);
          return (
            <g key={c.name}>
              <circle cx={xFor(m.eliteFear)} cy={yFor(m.innovation)} r={3} fill="#d4af37" opacity={0.35} />
              <text x={xFor(m.eliteFear) + 5} y={yFor(m.innovation) + 4} fontSize="11">
                {c.flag}
              </text>
            </g>
          );
        })}
        <defs>
          <marker id="cmpArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="#f472b6" />
          </marker>
        </defs>
        <line x1={ax} y1={ay} x2={bx} y2={by} stroke="#f472b6" strokeWidth={2} strokeDasharray="6 4" opacity={0.85} markerEnd="url(#cmpArrow)" />
        <circle cx={ax} cy={ay} r={6} fill="#22d3ee" stroke="#0b1736" strokeWidth={2} />
        <text x={ax + 10} y={ay - 6} fill="#22d3ee" fontSize="11" fontWeight="bold">A</text>
        <circle cx={bx} cy={by} r={6} fill="#f472b6" stroke="#0b1736" strokeWidth={2} />
        <text x={bx + 10} y={by + 16} fill="#f472b6" fontSize="11" fontWeight="bold">B</text>
      </svg>
    </div>
  );
}

function StressTestPanel({
  sliders,
  activeShock,
  shockedRegime,
  currentRegime,
  onPick,
  onClear,
  onApply,
}: {
  sliders: Sliders;
  activeShock: ShockId | null;
  shockedRegime: Regime | null;
  currentRegime: Regime;
  onPick: (id: ShockId) => void;
  onClear: () => void;
  onApply: () => void;
}) {
  const { t } = useI18n();
  const active = SHOCKS.find((s) => s.id === activeShock) ?? null;
  const shockedSliders = active ? applyShock(sliders, active.delta) : null;
  return (
    <div className="bg-[#0b1736]/60 border border-[#d4af37]/20 rounded-xl p-5">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-lg font-semibold text-[#f5d27a]">
          {t("constitution.stress.heading")}
        </h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        {SHOCKS.map((s) => {
          const isActive = activeShock === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onPick(s.id)}
              className={`text-left p-3 rounded border transition ${
                isActive
                  ? "border-[#f472b6] bg-[#f472b6]/10"
                  : "border-[#d4af37]/25 hover:bg-[#d4af37]/10"
              }`}
            >
              <div className="text-xl">{s.icon}</div>
              <div className="font-semibold text-sm mt-1">
                {t(`constitution.shock.${s.id}.name`)}
              </div>
              <div className="text-xs text-[#9aa3c0] mt-1 leading-snug">
                {t(`constitution.shock.${s.id}.desc`)}
              </div>
            </button>
          );
        })}
      </div>
      {active && shockedSliders && shockedRegime && (
        <div className="border-t border-[#d4af37]/20 pt-4">
          <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
            <div className="text-sm">
              <span className="text-[#9aa3c0]">{t("constitution.stress.before")} </span>
              <span className="text-[#22d3ee] font-semibold">
                {t(`constitution.regime.${currentRegime.id}.name`)}
              </span>
              <span className="text-[#9aa3c0] mx-2">→</span>
              <span className="text-[#9aa3c0]">{t("constitution.stress.after")} </span>
              <span className="text-[#f472b6] font-semibold">
                {t(`constitution.regime.${shockedRegime.id}.name`)}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClear}
                className="text-xs px-3 py-1 rounded border border-[#d4af37]/40 hover:bg-[#d4af37]/10"
              >
                {t("constitution.stress.undo")}
              </button>
              <button
                type="button"
                onClick={onApply}
                className="text-xs px-3 py-1 rounded bg-[#f472b6] text-[#0b1736] font-semibold hover:bg-[#f472b6]/80"
              >
                {t("constitution.stress.apply")}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            {SLIDER_META.map((m) => {
              const before = sliders[m.key];
              const after = shockedSliders[m.key];
              const diff = after - before;
              if (diff === 0) return null;
              const sign = diff > 0 ? "+" : "";
              return (
                <div
                  key={m.key}
                  className="border border-[#d4af37]/15 rounded px-2 py-1 bg-[#050a1a]/50"
                >
                  <div className="text-[#9aa3c0] text-[10px] truncate">{m.label}</div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono">{before}</span>
                    <span className="text-[#9aa3c0]">→</span>
                    <span className="font-mono">{after}</span>
                    <span
                      className={`font-mono ${
                        diff > 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      ({sign}
                      {diff})
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

type AiHistoryEntry = {
  description: string;
  sliders: Sliders;
  explanation: string;
  ts: number;
  provider?: string;
};

const AI_HISTORY_KEY = "constitution.ai.history";
const AI_HISTORY_MAX = 20;

function loadAiHistory(): AiHistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(AI_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AiHistoryEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, AI_HISTORY_MAX);
  } catch {
    return [];
  }
}

function pushAiHistory(entry: AiHistoryEntry): AiHistoryEntry[] {
  const list = loadAiHistory();
  list.unshift(entry);
  const trimmed = list.slice(0, AI_HISTORY_MAX);
  try {
    window.localStorage.setItem(AI_HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore quota */
  }
  return trimmed;
}

function AiAdvisorModal({
  onClose,
  onApply,
}: {
  onClose: () => void;
  onApply: (sliders: Sliders, explanation: string) => void;
}) {
  const { t } = useI18n();
  // Свой счётчик модуля, как у остального: useFunnel -> /api/constitution/funnel/track.
  const { track } = useFunnel();
  const [description, setDescription] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [streamText, setStreamText] = useState<string>("");
  const [history, setHistory] = useState<AiHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  useEffect(() => {
    setHistory(loadAiHistory());
  }, []);

  const submit = async () => {
    if (description.trim().length < 8) {
      setError(t("constitution.ai.errorTooShort"));
      return;
    }
    setBusy(true);
    setError(null);
    setProvider(null);
    setStreamText("");
    // Расход платного совета виден в воронке. Событие ai_suggest было в
    // словаре, а слал его ноль мест: суточный лимит aiSuggestPerDay тратился
    // невидимо. Шлём в точке РАСХОДА, а не успеха, и без текста запроса.
    track("ai_suggest", { length: description.trim().length });
    let finalSliders: Sliders | null = null;
    let finalExplanation = "";
    let finalProvider = "unknown";
    try {
      const r = await fetch("/api-backend/api/constitution/ai-suggest-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim() }),
      });
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        throw new Error(`HTTP ${r.status}: ${text.slice(0, 140)}`);
      }
      if (!r.body) throw new Error("no_body");
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let sseTail = "";
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        sseTail += decoder.decode(value, { stream: true });
        const lines = sseTail.split("\n");
        sseTail = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const ev = JSON.parse(data) as {
              kind?: string;
              text?: string;
              sliders?: Sliders;
              explanation?: string;
              provider?: string;
              message?: string;
            };
            if (ev.kind === "text" && typeof ev.text === "string") {
              acc += ev.text;
              setStreamText(acc);
            } else if (ev.kind === "sliders" && ev.sliders) {
              finalSliders = ev.sliders;
              finalExplanation = ev.explanation ?? "";
              finalProvider = ev.provider ?? "unknown";
              setProvider(finalProvider);
            } else if (ev.kind === "error") {
              setError(ev.message ?? "stream_error");
            }
          } catch {
            /* ignore */
          }
        }
      }
      if (finalSliders) {
        const entry: AiHistoryEntry = {
          description: description.trim(),
          sliders: finalSliders,
          explanation: finalExplanation,
          provider: finalProvider,
          ts: Date.now(),
        };
        setHistory(pushAiHistory(entry));
        onApply(finalSliders, finalExplanation);
      } else if (!error) {
        setError(t("constitution.ai.errorNoSliders"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "ai_failed");
    } finally {
      setBusy(false);
    }
  };

  const applyFromHistory = (entry: AiHistoryEntry) => {
    onApply(entry.sliders, entry.explanation);
  };

  const clearHistory = () => {
    try {
      window.localStorage.removeItem(AI_HISTORY_KEY);
    } catch {
      /* ignore */
    }
    setHistory([]);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div className="bg-[#0b1736] border border-fuchsia-400/40 rounded-xl p-5 max-w-2xl w-full shadow-2xl">
        <div className="flex justify-between items-baseline mb-3">
          <h3 className="text-xl font-bold text-fuchsia-300">
            🤖 {t("constitution.ai.modalHeading")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-[#9aa3c0] hover:text-white text-xl leading-none"
            aria-label={t("constitution.button.close")}
          >
            ×
          </button>
        </div>
        <p className="text-sm text-[#9aa3c0] mb-3">
          {t("constitution.ai.description")}
        </p>
        {history.length > 0 && (
          <div className="mb-3 border border-[#d4af37]/20 rounded">
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="w-full text-left px-3 py-2 text-xs text-[#9aa3c0] hover:bg-[#d4af37]/5 flex justify-between"
            >
              <span>📜 {t("constitution.ai.historyHeading", { count: history.length })}</span>
              <span>{showHistory ? "▴" : "▾"}</span>
            </button>
            {showHistory && (
              <div className="max-h-48 overflow-y-auto border-t border-[#d4af37]/20">
                {history.map((h, i) => (
                  <div
                    key={h.ts}
                    className="px-3 py-2 text-xs border-b border-[#d4af37]/10 last:border-b-0 flex justify-between items-start gap-2 hover:bg-[#d4af37]/5"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[#e7ecf8] truncate">{h.description}</div>
                      <div className="text-[#9aa3c0] text-[10px]">
                        {new Date(h.ts).toLocaleString()}{" "}
                        {h.provider && <span>· {h.provider}</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => applyFromHistory(h)}
                      className="text-fuchsia-300 hover:underline whitespace-nowrap"
                    >
                      {t("constitution.button.applyArrow")}
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={clearHistory}
                  className="w-full px-3 py-1.5 text-[10px] text-rose-400 hover:bg-rose-500/10"
                >
                  {t("constitution.ai.clearHistory")}
                </button>
              </div>
            )}
          </div>
        )}
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("constitution.ai.placeholderExample")}
          rows={5}
          className="w-full bg-[#050a1a] border border-fuchsia-400/30 rounded px-3 py-2 text-sm resize-y"
          maxLength={4000}
        />
        <div className="text-right text-xs text-[#9aa3c0] mt-1">
          {description.length} / 4000
        </div>
        {streamText && busy && (
          <div className="mt-2 max-h-32 overflow-y-auto border border-fuchsia-400/20 rounded px-3 py-2 bg-fuchsia-500/5 text-xs text-fuchsia-200 font-mono whitespace-pre-wrap">
            {streamText}
            <span className="animate-pulse text-fuchsia-300">▌</span>
          </div>
        )}
        {error && (
          <div className="mt-2 text-xs text-rose-400 border border-rose-500/30 rounded px-2 py-1 bg-rose-500/5">
            {error}
          </div>
        )}
        {provider && (
          <div className="mt-2 text-xs text-[#9aa3c0]">
            Provider: <span className="text-fuchsia-300">{provider}</span>
          </div>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-4 py-2 rounded border border-[#d4af37]/40 hover:bg-[#d4af37]/10"
          >
            {t("constitution.button.cancel")}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || description.trim().length < 8}
            className="text-sm px-4 py-2 rounded bg-fuchsia-500 text-[#0b1736] font-semibold hover:bg-fuchsia-400 disabled:opacity-40"
          >
            {busy ? t("constitution.ai.thinking") : t("constitution.ai.submitButton")}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProPaywallBanner({
  savedTotal,
  limit,
}: {
  savedTotal: number;
  limit: number;
}) {
  const { t } = useI18n();
  // Own funnel, like the rest of this module (useFunnel → /api/constitution/funnel/track).
  const { track } = useFunnel();
  return (
    <div className="mb-4 bg-gradient-to-r from-fuchsia-900/40 via-purple-900/30 to-cyan-900/40 border border-fuchsia-400/40 rounded-xl p-4">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white font-bold">
              PRO
            </span>
            <span className="text-fuchsia-200 font-semibold">
              {t("constitution.pro.banner.title")}
            </span>
          </div>
          <div className="text-sm text-[#e7ecf8] mt-1">
            {t("constitution.pro.usage", { used: savedTotal, limit })}
          </div>
          <ul className="text-xs text-[#9aa3c0] mt-2 space-y-0.5 list-disc list-inside">
            <li>{t("constitution.pro.feature.unlimited")}</li>
            <li>{t("constitution.pro.feature.aiNoLimit")}</li>
            <li>{t("constitution.pro.feature.pdfNoWatermark")}</li>
            <li>{t("constitution.pro.feature.themes")}</li>
            <li>{t("constitution.pro.feature.embed")}</li>
          </ul>
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          <a
            href="https://aevion.gumroad.com/l/pyiaz"
            target="_blank"
            rel="noopener noreferrer"
            // Constitution keeps its own funnel (useFunnel → /api/constitution/funnel/track);
            // its /pricing page already fires upgrade_click here, this banner did not.
            onClick={() => track("upgrade_click", { tier: "pro", source: "constitution/inline-banner" })}
            className="px-4 py-2 rounded bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white font-bold text-sm text-center hover:opacity-90"
          >
            Upgrade →
          </a>
          <span className="text-[10px] text-[#9aa3c0] text-center">
            Gumroad · cancel anytime
          </span>
        </div>
      </div>
    </div>
  );
}

type SimilarItem = {
  id: string;
  title: string;
  regimeId: string;
  regimeName: string;
  publishedAt: string;
  similarity: number;
  euclideanDistance: number;
  sliders: Sliders | null;
};

function SimilarPanel({
  artifactId,
  onApply,
}: {
  artifactId: string;
  onApply: (sliders: Sliders) => void;
}) {
  const { t } = useI18n();
  const [items, setItems] = useState<SimilarItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const r = await fetch(
          `/api-backend/api/planet/constitution-artifacts/${artifactId}/similar?limit=6`,
        );
        if (!r.ok) return;
        const j = (await r.json()) as { items: SimilarItem[] };
        if (alive) setItems(j.items ?? []);
      } catch {
        /* ignore */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [artifactId]);

  if (loading && items.length === 0) return null;
  if (items.length === 0) return null;

  return (
    <div className="bg-[#0b1736]/60 border border-[#d4af37]/20 rounded-xl p-5">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-lg font-semibold text-[#f5d27a]">
          🪞 {t("constitution.similar.heading")}
        </h3>
        <div className="text-xs text-[#9aa3c0]">
          {t("constitution.similar.description")}
        </div>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {items.map((it) => (
          <div
            key={it.id}
            className="flex-shrink-0 border border-[#d4af37]/15 rounded p-2 bg-[#050a1a]/50"
            style={{ width: 210 }}
          >
            {it.sliders && (
              <ConstitutionEmbed
                sliders={it.sliders}
                label={it.title}
                size="sm"
              />
            )}
            <div className="mt-1 text-xs text-[#9aa3c0]">
              sim:{" "}
              <span className="text-emerald-300 font-mono">
                {Math.round(it.similarity * 100)}%
              </span>{" "}
              · dist:{" "}
              <span className="font-mono">{it.euclideanDistance}</span>
            </div>
            <button
              type="button"
              onClick={() => it.sliders && onApply(it.sliders)}
              disabled={!it.sliders}
              className="mt-2 w-full px-2 py-1 rounded bg-[#d4af37]/20 border border-[#d4af37]/40 text-[#f5d27a] text-xs hover:bg-[#d4af37]/30 disabled:opacity-40"
            >
              {t("constitution.button.applyArrow")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

type SocialComment = {
  id: string;
  authorName: string | null;
  userId: string | null;
  text: string;
  createdAt: string;
};
type SocialData = {
  votes: { up: number; down: number; total: number; my: -1 | 0 | 1 };
  comments: SocialComment[];
};

function SocialPanel({ artifactId }: { artifactId: string }) {
  const { t } = useI18n();
  const [data, setData] = useState<SocialData | null>(null);
  const [text, setText] = useState<string>("");
  const [authorName, setAuthorName] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(
        `/api-backend/api/planet/constitution-artifacts/${artifactId}/social`,
      );
      if (!r.ok) return;
      setData((await r.json()) as SocialData);
    } catch {
      /* ignore */
    }
  }, [artifactId]);

  useEffect(() => {
    void load();
  }, [load]);

  const castVote = async (vote: 1 | -1) => {
    const toggleOff = data?.votes.my === vote;
    try {
      if (toggleOff) {
        await fetch(
          `/api-backend/api/planet/constitution-artifacts/${artifactId}/vote`,
          { method: "DELETE" },
        );
      } else {
        await fetch(
          `/api-backend/api/planet/constitution-artifacts/${artifactId}/vote`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vote }),
          },
        );
      }
      await load();
    } catch {
      /* ignore */
    }
  };

  const submitComment = async () => {
    if (text.trim().length < 1) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(
        `/api-backend/api/planet/constitution-artifacts/${artifactId}/comment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: text.trim(),
            authorName: authorName.trim() || undefined,
          }),
        },
      );
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new Error(`HTTP ${r.status}: ${t.slice(0, 120)}`);
      }
      setText("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "comment_failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-[#0b1736]/60 border border-[#d4af37]/20 rounded-xl p-5">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-lg font-semibold text-[#f5d27a]">
          💬 {t("constitution.social.heading")}
        </h3>
        <div className="text-xs text-[#9aa3c0]">
          {t("constitution.social.artifactLabel")} <code className="font-mono">{artifactId.slice(0, 8)}</code>
        </div>
      </div>
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => castVote(1)}
          className={`px-3 py-1.5 rounded text-sm transition ${
            data?.votes.my === 1
              ? "bg-emerald-500/30 border border-emerald-400/60 text-emerald-200"
              : "border border-[#d4af37]/30 hover:bg-emerald-500/10"
          }`}
        >
          👍 {data?.votes.up ?? 0}
        </button>
        <button
          type="button"
          onClick={() => castVote(-1)}
          className={`px-3 py-1.5 rounded text-sm transition ${
            data?.votes.my === -1
              ? "bg-rose-500/30 border border-rose-400/60 text-rose-200"
              : "border border-[#d4af37]/30 hover:bg-rose-500/10"
          }`}
        >
          👎 {data?.votes.down ?? 0}
        </button>
        <div className="px-3 py-1.5 text-sm text-[#9aa3c0]">
          {t("constitution.social.totalLabel")}{" "}
          <span
            className={`font-semibold ${
              (data?.votes.total ?? 0) > 0
                ? "text-emerald-300"
                : (data?.votes.total ?? 0) < 0
                  ? "text-rose-300"
                  : "text-[#9aa3c0]"
            }`}
          >
            {(data?.votes.total ?? 0) > 0 ? "+" : ""}
            {data?.votes.total ?? 0}
          </span>
        </div>
      </div>
      <div className="border-t border-[#d4af37]/20 pt-3">
        <div className="flex gap-2 mb-2 flex-wrap">
          <input
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder={t("constitution.social.namePlaceholder")}
            maxLength={60}
            className="flex-shrink-0 w-40 bg-[#050a1a] border border-[#d4af37]/30 rounded px-2 py-1.5 text-xs"
          />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submitComment();
              }
            }}
            placeholder={t("constitution.social.commentPlaceholder")}
            maxLength={800}
            className="flex-1 min-w-[200px] bg-[#050a1a] border border-[#d4af37]/30 rounded px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={submitComment}
            disabled={busy || text.trim().length < 1}
            className="px-3 py-1.5 rounded bg-[#d4af37] text-[#0b1736] font-semibold text-sm disabled:opacity-40"
          >
            {busy ? "..." : "→"}
          </button>
        </div>
        {error && (
          <div className="text-xs text-rose-400 mb-2 border border-rose-500/30 rounded px-2 py-1 bg-rose-500/5">
            {error}
          </div>
        )}
        {data?.comments && data.comments.length > 0 ? (
          <ul className="space-y-2 max-h-80 overflow-y-auto">
            {data.comments.map((c) => (
              <li
                key={c.id}
                className="border-l-2 border-[#d4af37]/30 pl-3 py-1 text-sm"
              >
                <div className="flex justify-between text-xs text-[#9aa3c0] mb-0.5">
                  <span className="font-semibold text-[#f5d27a]">
                    {c.authorName ?? (c.userId ? `user-${c.userId.slice(0, 6)}` : "anon")}
                  </span>
                  <span>{new Date(c.createdAt).toLocaleString()}</span>
                </div>
                <div className="text-[#e7ecf8] whitespace-pre-wrap break-words">
                  {c.text}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-xs text-[#9aa3c0] italic py-2">
            {t("constitution.social.noComments")}
          </div>
        )}
      </div>
    </div>
  );
}