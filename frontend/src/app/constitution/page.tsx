"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

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

type TourStep = {
  era: string;
  year: string;
  title: string;
  narrative: string;
  sliders: Sliders;
};

const TOUR: TourStep[] = [
  {
    era: "Р¤РµРѕРґР°Р»РёР·Рј",
    year: "в‰€1200",
    title: "РўРѕС‡РєР° РѕС‚СЃС‡С‘С‚Р°",
    narrative:
      "Р’Р»Р°СЃС‚СЊ РЅР°СЃР»РµРґСЃС‚РІРµРЅРЅР°СЏ, Р·Р°РєРѕРЅ С„РѕСЂРјР°Р»СЊРЅС‹Р№ вЂ” РґР»СЏ Р±РµРґРЅС‹С… РѕРґРЅРѕ, РґР»СЏ Р·РЅР°С‚Рё РґСЂСѓРіРѕРµ. РќРёР· РїСЂРёРІСЏР·Р°РЅ Рє Р·РµРјР»Рµ. Р‘СѓРЅС‚ СЂР°Р· РІ РїРѕРєРѕР»РµРЅРёРµ, РѕР±С‹С‡РЅРѕ РЅРёС‡РµРіРѕ РЅРµ РјРµРЅСЏРµС‚. РџРёСЂРѕРі РЅРµ СЂР°СЃС‚С‘С‚. РЎРёР»СѓСЌС‚ вЂ” СѓР·РєРёР№ С€РёРї РїРѕ skin-in-the-game Рё РїРѕР»РёС†РµРЅС‚СЂРёС‡РЅРѕСЃС‚Рё (РєР°Р¶РґС‹Р№ Р±Р°СЂРѕРЅ СЃР°Рј СЃРµР±Рµ РєРѕСЂРѕР»СЊ), РІСЃС‘ РѕСЃС‚Р°Р»СЊРЅРѕРµ РІ РїРѕРґРІР°Р»Рµ.",
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
    era: "РњР°РіРЅР° РљР°СЂС‚Р° + СЂР°РЅРЅРёРµ РїР°СЂР»Р°РјРµРЅС‚С‹",
    year: "1215вЂ“1700",
    title: "Р—Р°РєРѕРЅ РЅР°С‡РёРЅР°РµС‚ СЃРІСЏР·С‹РІР°С‚СЊ РІРµСЂС…",
    narrative:
      "РљРѕСЂРѕР»СЊ РІРїРµСЂРІС‹Рµ РѕР±СЏР·Р°РЅ Р¶РёС‚СЊ РїРѕ РїСЂР°РІРёР»Р°Рј вЂ” Magna Carta 1215, РїРѕС‚РѕРј Р°РЅРіР»РёР№СЃРєРёР№ Habeas Corpus, РїРѕС‚РѕРј Р“РѕР»Р»Р°РЅРґРёСЏ СЃ РµС‘ СЂРµРіРµРЅС‚Р°РјРё. РЎРѕСЃР»РѕРІРЅС‹Рµ СЃРѕР±СЂР°РЅРёСЏ РїСЂРµРІСЂР°С‰Р°СЋС‚СЃСЏ РІ Р·Р°С‡Р°С‚РєРё РїР°СЂР»Р°РјРµРЅС‚Р°. Р­С‚Рѕ РїРµСЂРІС‹Р№ Рё РіР»Р°РІРЅС‹Р№ СЃРґРІРёРі: Р·Р°РєРѕРЅ РїРѕРґРЅРёРјР°РµС‚СЃСЏ РЅР°Рґ РІРµСЂС…РѕРІРЅРѕР№ РІР»Р°СЃС‚СЊСЋ. РџРѕР»Р·СѓРЅРѕРє ruleOfLaw +15.",
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
    era: "РџСЂРѕРјС‹С€Р»РµРЅРЅР°СЏ СЂРµРІРѕР»СЋС†РёСЏ",
    year: "1750вЂ“1850",
    title: "РџРёСЂРѕРі РЅР°С‡РёРЅР°РµС‚ СЂР°СЃС‚Рё",
    narrative:
      "Р’РїРµСЂРІС‹Рµ РІ РёСЃС‚РѕСЂРёРё СЌРєРѕРЅРѕРјРёРєР° СЂР°СЃС‚С‘С‚ Р±С‹СЃС‚СЂРµРµ, С‡РµРј РЅР°СЃРµР»РµРЅРёРµ. РџРѕСЏРІР»СЏРµС‚СЃСЏ Р±СѓСЂР¶СѓР° вЂ” РЅРѕРІР°СЏ РѕСЃСЊ СЃС‚Р°С‚СѓСЃР°, РЅРµ РЅР°СЃР»РµРґСЃС‚РІРµРЅРЅР°СЏ. Р“РѕСЂРѕРґР° РЅР°РєР°РїР»РёРІР°СЋС‚ РєР°РїРёС‚Р°Р» Рё Р°РІС‚РѕРЅРѕРјРёСЋ. positiveSum +25 вЂ” РіР»Р°РІРЅРѕРµ СЃРѕР±С‹С‚РёРµ РјРѕРґРµСЂРЅР°. Р‘РµР· СЂР°СЃС‚СѓС‰РµРіРѕ РїРёСЂРѕРіР° РЅРё РѕРґРЅР° СЃР»РµРґСѓСЋС‰Р°СЏ СЂРµС„РѕСЂРјР° РЅРµ Р±С‹Р»Р° Р±С‹ РїРѕР»РёС‚РёС‡РµСЃРєРё РІРѕР·РјРѕР¶РЅРѕР№.",
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
    era: "Р’СЃРµРѕР±С‰РµРµ РёР·Р±РёСЂР°С‚РµР»СЊРЅРѕРµ РїСЂР°РІРѕ",
    year: "1900вЂ“1950",
    title: "РќРёР· РїРѕР»СѓС‡Р°РµС‚ РіРѕР»РѕСЃ",
    narrative:
      "РЎРЅР°С‡Р°Р»Р° РјСѓР¶С‡РёРЅС‹ Р±РµР· С†РµРЅР·Р°, РїРѕС‚РѕРј Р¶РµРЅС‰РёРЅС‹. Р–СЂРµР±РёР№ СЃС‚Р°СЂС‹С… Р°С„РёРЅСЏРЅ РІРѕР·РІСЂР°С‰Р°РµС‚СЃСЏ РІ РІРёРґРµ СЂРµРіСѓР»СЏСЂРЅС‹С… РІС‹Р±РѕСЂРѕРІ Рё РїР°СЂР»Р°РјРµРЅС‚СЃРєРѕР№ СЂРѕС‚Р°С†РёРё. Р—Р°РєРѕРЅ РїРѕСЃС‚РµРїРµРЅРЅРѕ СЃС‚Р°РЅРѕРІРёС‚СЃСЏ РѕРґРёРЅР°РєРѕРІС‹Рј РґР»СЏ РІСЃРµС… вЂ” СЌС‚Рѕ СѓР¶Рµ Acemoglu/Robinson В«inclusive institutionsВ». rotation +20, ruleOfLaw +15.",
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
    era: "РџРѕСЃР»РµРІРѕРµРЅРЅС‹Р№ СЃРѕС†РёР°Р»-РєРѕРЅС‚СЂР°РєС‚",
    year: "1945вЂ“1980",
    title: "РџРѕСЏРІР»СЏРµС‚СЃСЏ РїРѕР» СЃРЅРёР·Сѓ",
    narrative:
      "Р‘РµСЃРїР»Р°С‚РЅРѕРµ РѕР±СЂР°Р·РѕРІР°РЅРёРµ, РІСЃРµРѕР±С‰Р°СЏ РјРµРґРёС†РёРЅР°, РїРµРЅСЃРёРё, РїРѕСЃРѕР±РёСЏ. Р‘РѕР»СЊС€РѕР№ С€Р°Рі: РЅРёР· РїРµСЂРµСЃС‚Р°С‘С‚ Р±С‹С‚СЊ РїСЂРёР¶Р°С‚С‹Рј Рє СЃС‚РµРЅРµ в†’ РёСЃС‡РµР·Р°РµС‚ СЌРєР·РёСЃС‚РµРЅС†РёР°Р»СЊРЅР°СЏ РјРѕС‚РёРІР°С†РёСЏ РѕС‚РЅРёРјР°С‚СЊ. РџСЂРѕР·СЂР°С‡РЅРѕСЃС‚СЊ РіРѕСЃСѓРґР°СЂСЃС‚РІР° СЂР°СЃС‚С‘С‚ вЂ” РЅР°Р»РѕРіРѕРІС‹Рµ СЃРёСЃС‚РµРјС‹, Р±СЋРґР¶РµС‚С‹. РќРµСЃРєРѕР»СЊРєРѕ РѕСЃРµР№ СЃС‚Р°С‚СѓСЃР° Р»РµРіРёС‚РёРјРЅС‹. floor +30 вЂ” СЃР°РјРѕРµ РґРѕСЂРѕРіРѕРµ Рё СЃР°РјРѕРµ СЃС‚Р°Р±РёР»РёР·РёСЂСѓСЋС‰РµРµ РёР·РјРµРЅРµРЅРёРµ.",
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
    era: "Р¦РёС„СЂРѕРІР°СЏ РїСЂРѕР·СЂР°С‡РЅРѕСЃС‚СЊ + Open Access",
    year: "2000-СЃРµР№С‡Р°СЃ (Рё РґР°Р»СЊС€Рµ)",
    title: "Р’СЃРµ С‡РµС‚С‹СЂРµ РѕРїРѕСЂС‹ СЃРѕР±СЂР°РЅС‹",
    narrative:
      "РћС‚РєСЂС‹С‚С‹Рµ РґРµРєР»Р°СЂР°С†РёРё, РґРѕСЃС‚СѓРї Рє РґР°РЅРЅС‹Рј, РїРѕСЂС‚Р°Р±РµР»СЊРЅС‹Рµ РїСЂР°РІР°, РєРѕРЅРєСѓСЂРµРЅС†РёСЏ СЋСЂРёСЃРґРёРєС†РёР№. РџРѕР»РЅР°СЏ РєР°СЂС‚РёРЅР° РїРѕ North/Wallis/Weingast: РїРѕР»РѕР¶РёС‚РµР»СЊРЅР°СЏ СЃСѓРјРјР° + Р·Р°РєРѕРЅ РЅР°Рґ РІРµСЂС…РѕРј + РїРѕР» СЃРЅРёР·Сѓ + РјРЅРѕР¶РµСЃС‚РІРµРЅРЅС‹Рµ СЃС‚Р°С‚СѓСЃС‹ + СЂРѕС‚Р°С†РёСЏ + РїСЂРѕР·СЂР°С‡РЅРѕСЃС‚СЊ. РЎРёР»СѓСЌС‚ РїСЂРµРІСЂР°С‰Р°РµС‚СЃСЏ РІ РїРѕС‡С‚Рё РїСЂР°РІРёР»СЊРЅС‹Р№ РІРѕСЃСЊРјРёСѓРіРѕР»СЊРЅРёРє Р±РѕР»СЊС€РѕРіРѕ СЂР°РґРёСѓСЃР°. Р­Р»РёС‚Р° Р±РѕР»СЊС€Рµ РЅРµ Р±РѕРёС‚СЃСЏ РЅРёР·Р° вЂ” РјРµР¶РґСѓ РЅРёРјРё РїСЂР°РІРёР»Р° Рё РѕР±С‰РёР№ СЂР°СЃС‚СѓС‰РёР№ РїРёСЂРѕРі. Р­С‚Рѕ РїСѓС‚СЊ, РєРѕС‚РѕСЂС‹Р№ РїСЂРѕС€Р»Рё СЃРєР°РЅРґРёРЅР°РІС‹, С‡Р°СЃС‚РёС‡РЅРѕ РїСЂРѕС€Р»Рё РєРѕРЅС‚РёРЅРµРЅС‚Р°Р»СЊРЅР°СЏ Р•РІСЂРѕРїР° Рё РљР°РЅР°РґР°. РћС‚РєСЂС‹С‚С‹Р№ РІРѕРїСЂРѕСЃ вЂ” СѓСЃС‚РѕР№С‡РёРІРѕ Р»Рё СЌС‚Рѕ РІ РєСЂРёР·РёСЃ.",
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
  name: string;
  desc: string;
  delta: Partial<Record<keyof Sliders, number>>;
};

const SHOCKS: Shock[] = [
  {
    id: "war",
    icon: "рџЄ–",
    name: "Р’РѕР№РЅР°",
    desc: "РљРѕРЅС†РµРЅС‚СЂР°С†РёСЏ РІР»Р°СЃС‚Рё, С†РµРЅР·СѓСЂР°, РјРѕР±РёР»РёР·Р°С†РёСЏ. Р›РѕРјР°РµС‚ РїСЂРѕР·СЂР°С‡РЅРѕСЃС‚СЊ Рё РїРѕР»РёС†РµРЅС‚СЂРёС‡РЅРѕСЃС‚СЊ.",
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
    icon: "рџ¦ ",
    name: "РџР°РЅРґРµРјРёСЏ",
    desc: "Р§СЂРµР·РІС‹С‡Р°Р№РЅС‹Рµ РїРѕР»РЅРѕРјРѕС‡РёСЏ С†РµРЅС‚СЂР°, СЂРµР¶СѓС‚ Р»РѕРєР°Р»СЊРЅСѓСЋ Р°РІС‚РѕРЅРѕРјРёСЋ Рё РїР»СЋСЂР°Р»РёР·Рј СЃС‚Р°С‚СѓСЃРѕРІ.",
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
    icon: "рџ’ё",
    name: "Р¤РёРЅР°РЅСЃРѕРІС‹Р№ РєСЂРёР·РёСЃ",
    desc: "РџРёСЂРѕРі СЂРµР·РєРѕ СЃР¶РёРјР°РµС‚СЃСЏ. РџР°РґР°СЋС‚ РїРѕР» СЃРЅРёР·Сѓ Рё РґРѕРІРµСЂРёРµ. Р’РѕР·СЂР°СЃС‚Р°РµС‚ РЅР°РїСЂСЏР¶РµРЅРёРµ.",
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
    icon: "рџљЂ",
    name: "РўРµС…СЃРєР°С‡РѕРє",
    desc: "Р Р°СЃС‚С‘С‚ РїРёСЂРѕРі Рё РґРµС†РµРЅС‚СЂР°Р»РёР·Р°С†РёСЏ, РЅРѕ СЂРµРіСѓР»СЏС†РёСЏ РѕС‚СЃС‚Р°С‘С‚ Рё РЅРµСЂР°РІРµРЅСЃС‚РІРѕ СЂР°СЃС‚С‘С‚.",
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
  const goToTourStep = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(TOUR.length - 1, idx));
    setTourStep(clamped);
    setSliders(TOUR[clamped].sliders);
  }, []);
  const startTour = useCallback(() => goToTourStep(0), [goToTourStep]);
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
    (k: keyof Sliders, v: number) => setSliders((s) => ({ ...s, [k]: v })),
    [],
  );

  const reset = useCallback(() => setSliders(DEFAULT_SLIDERS), []);

  const save = useCallback(async () => {
    if (!title.trim()) return;
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
        setTitle("");
        await loadRecent();
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }, [title, sliders, regime, metrics, loadRecent]);

  const signAndDownload = useCallback(async () => {
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
          hint: "POST { payload, signature } вЂ” must return { valid: true }",
        },
      };
      const slug = cleanTitle
        .toLowerCase()
        .replace(/[^a-z0-9Р°-СЏС‘-]+/giu, "-")
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b1736] via-[#131f3d] to-[#050a1a] text-[#e7ecf8] p-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6">
          <Link href="/" className="text-[#d4af37] hover:underline text-sm">
            в†ђ AEVION
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold mt-2 text-[#d4af37]">
            Constitution вЂ” Р›Р°Р±РѕСЂР°С‚РѕСЂРёСЏ СѓСЃС‚СЂРѕР№СЃС‚РІР° РјРёСЂР°
          </h1>
          <p className="text-[#9aa3c0] mt-2 max-w-3xl">
            Р’РѕСЃРµРјСЊ РїР°СЂР°РјРµС‚СЂРѕРІ вЂ” С‡РµС‚С‹СЂРµ РѕРїРѕСЂС‹, РЅР° РєРѕС‚РѕСЂС‹С… СЌР»РёС‚С‹ РїРµСЂРµСЃС‚Р°СЋС‚ Р±РѕСЏС‚СЊСЃСЏ РЅРёР·Р° Рё РіСЂС‹Р·С‚СЊСЃСЏ РјРµР¶РґСѓ СЃРѕР±РѕР№.
            Р”РІРёРіР°Р№ РїРѕР»Р·СѓРЅРєРё, СЃРјРѕС‚СЂРё, РІ РєР°РєРѕР№ РёСЃС‚РѕСЂРёС‡РµСЃРєРёР№ СЂРµР¶РёРј СЃРєР°С‚С‹РІР°РµС‚СЃСЏ СЃРёСЃС‚РµРјР°. РЎРѕС…СЂР°РЅРё СЃС†РµРЅР°СЂРёР№ вЂ” СѓРІРёРґРёС€СЊ,
            С‡С‚Рѕ РІС‹Р±СЂР°Р»Рё РґСЂСѓРіРёРµ.
          </p>
          {!tourActive && (
            <button
              type="button"
              onClick={startTour}
              className="mt-4 px-4 py-2 rounded bg-gradient-to-r from-[#d4af37] to-[#f5d27a] text-[#0b1736] font-semibold hover:opacity-90"
            >
              в–¶ РўСѓСЂ РїРѕ СЌРІРѕР»СЋС†РёРё вЂ” РѕС‚ Р¤РµРѕРґР°Р»РёР·РјР° РґРѕ Open Access Р·Р° 8 РІРµРєРѕРІ
            </button>
          )}
        </header>

        {tourActive && tourStep !== null && (
          <section className="mb-6 border border-[#d4af37]/40 rounded-xl p-5 bg-gradient-to-br from-[#0b1736]/80 to-[#131f3d]/80">
            <div className="flex justify-between items-baseline mb-2 flex-wrap gap-2">
              <div>
                <div className="text-xs uppercase tracking-wide text-[#9aa3c0]">
                  РЁР°Рі {tourStep + 1} РёР· {TOUR.length} В· {TOUR[tourStep].year}
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-[#d4af37]">
                  {TOUR[tourStep].era}
                </h2>
                <div className="text-sm text-[#f5d27a] italic mt-1">
                  {TOUR[tourStep].title}
                </div>
              </div>
              <button
                type="button"
                onClick={exitTour}
                className="text-xs px-3 py-1 rounded border border-[#d4af37]/40 hover:bg-[#d4af37]/10"
              >
                Р’С‹Р№С‚Рё РёР· С‚СѓСЂР°
              </button>
            </div>
            <p className="text-sm text-[#e7ecf8] leading-relaxed">
              {TOUR[tourStep].narrative}
            </p>
            <div className="flex justify-between items-center mt-4 gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => goToTourStep(tourStep - 1)}
                disabled={tourStep === 0}
                className="px-4 py-2 rounded border border-[#d4af37]/40 hover:bg-[#d4af37]/10 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
              >
                в†ђ РќР°Р·Р°Рґ
              </button>
              <div className="flex gap-1">
                {TOUR.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => goToTourStep(i)}
                    aria-label={`РЁР°Рі ${i + 1}`}
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
                  Р”Р°Р»СЊС€Рµ в†’
                </button>
              ) : (
                <div className="px-4 py-2 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm font-semibold">
                  Р¤РёРЅР°Р» В· 8 РІРµРєРѕРІ РїСЂРѕР№РґРµРЅРѕ
                </div>
              )}
            </div>
          </section>
        )}

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#0b1736]/60 border border-[#d4af37]/20 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[#f5d27a]">Р’РѕСЃРµРјСЊ РїР°СЂР°РјРµС‚СЂРѕРІ</h2>
              <button
                type="button"
                onClick={reset}
                className="text-xs px-3 py-1 rounded border border-[#d4af37]/40 hover:bg-[#d4af37]/10"
              >
                РЎР±СЂРѕСЃ
              </button>
            </div>

            <div className="space-y-4">
              {SLIDER_META.map((m) => {
                const val = sliders[m.key];
                const highlighted = tourHighlight.has(m.key);
                return (
                  <div
                    key={m.key}
                    className={
                      highlighted
                        ? "rounded-md px-2 py-1 -mx-2 ring-2 ring-emerald-400/60 bg-emerald-500/5 transition"
                        : ""
                    }
                  >
                    <div className="flex justify-between items-baseline">
                      <label htmlFor={`s-${m.key}`} className="font-medium">
                        {highlighted && <span className="text-emerald-400 mr-1">в—Џ</span>}
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
              <div className="text-xs text-[#9aa3c0] mb-2">РџСЂРµСЃРµС‚С‹:</div>
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
                РџРѕР»СѓС‡РёРІС€РёР№СЃСЏ СЂРµР¶РёРј
              </div>
              <h3 className="text-2xl font-bold text-[#d4af37] mt-1">{regime.name}</h3>
              <div className="text-sm text-[#9aa3c0] italic">{regime.era}</div>
              <p className="mt-3">{regime.summary}</p>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="border border-emerald-500/30 rounded p-3 bg-emerald-500/5">
                  <div className="text-emerald-300 text-xs uppercase mb-1">РџР»СЋСЃС‹</div>
                  <div>{regime.pros}</div>
                </div>
                <div className="border border-rose-500/30 rounded p-3 bg-rose-500/5">
                  <div className="text-rose-300 text-xs uppercase mb-1">РњРёРЅСѓСЃС‹</div>
                  <div>{regime.cons}</div>
                </div>
              </div>
            </div>

            <div className="bg-[#0b1736]/60 border border-[#d4af37]/20 rounded-xl p-5">
              <h3 className="text-lg font-semibold text-[#f5d27a] mb-3">РЁРµСЃС‚СЊ РёРЅРґРµРєСЃРѕРІ</h3>
              <MetricBar label="РЎС‚СЂР°С… СЌР»РёС‚ РїРµСЂРµРґ РЅРёР·РѕРј" value={metrics.eliteFear} invert />
              <MetricBar label="Р“СЂС‹Р·РЅСЏ РІРЅСѓС‚СЂРё СЌР»РёС‚" value={metrics.intraConflict} invert />
              <MetricBar label="РћР±РёРґР° РЅРёР·Р° РЅР° РІРµСЂС…" value={metrics.resentment} invert />
              <MetricBar label="РРЅРЅРѕРІР°С†РёСЏ / РґСЂР°Р№РІ" value={metrics.innovation} />
              <MetricBar label="РЈСЃС‚РѕР№С‡РёРІРѕСЃС‚СЊ" value={metrics.stability} />
              <MetricBar label="Р›РµРіРёС‚РёРјРЅРѕСЃС‚СЊ" value={metrics.legitimacy} />
            </div>

            <div className="bg-[#0b1736]/60 border border-[#d4af37]/20 rounded-xl p-5">
              <h3 className="text-lg font-semibold text-[#f5d27a] mb-1">РћС‚РїРµС‡Р°С‚РѕРє РєРѕРЅСЃС‚РёС‚СѓС†РёРё</h3>
              <div className="text-xs text-[#9aa3c0] mb-2">
                Р’РѕСЃСЊРјРёСѓРіРѕР»СЊРЅРёРє 0-100 РїРѕ РєР°Р¶РґРѕРјСѓ РїРѕР»Р·СѓРЅРєСѓ. РЎСЂР°РІРЅРёРІР°Р№ СЃРёР»СѓСЌС‚С‹ РїСЂРµСЃРµС‚РѕРІ Рё СЃС‚СЂР°РЅ.
              </div>
              <SpiderChart sliders={sliders} shockedSliders={shockedSliders} />
            </div>

            <div className="bg-[#0b1736]/60 border border-[#d4af37]/20 rounded-xl p-5">
              <h3 className="text-lg font-semibold text-[#f5d27a] mb-3">
                РЎРѕС…СЂР°РЅРёС‚СЊ СЃС†РµРЅР°СЂРёР№{savedTotal > 0 ? ` (РІСЃРµРіРѕ: ${savedTotal})` : ""}
              </h3>
              <div className="flex flex-wrap gap-2">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="РќР°Р·РІР°РЅРёРµ (РЅР°РїСЂРёРјРµСЂ, В«РљР°Р·Р°С…СЃС‚Р°РЅ-2050В»)"
                  className="flex-1 min-w-[180px] bg-[#050a1a] border border-[#d4af37]/30 rounded px-3 py-2 text-sm"
                  maxLength={120}
                />
                <button
                  type="button"
                  onClick={save}
                  disabled={busy || !title.trim()}
                  className="px-4 py-2 rounded bg-[#d4af37] text-[#0b1736] font-semibold disabled:opacity-40"
                >
                  {busy ? "..." : "РЎРѕС…СЂР°РЅРёС‚СЊ"}
                </button>
                <button
                  type="button"
                  onClick={signAndDownload}
                  disabled={signing}
                  title="QSign HMAC-SHA256: РїРѕРґРїРёСЃР°С‚СЊ С‚РµРєСѓС‰РёР№ СЃС†РµРЅР°СЂРёР№ Рё СЃРєР°С‡Р°С‚СЊ РєР°Рє .signed.json"
                  className="px-4 py-2 rounded border border-[#d4af37] text-[#d4af37] font-semibold hover:bg-[#d4af37]/10 disabled:opacity-40"
                >
                  {signing ? "..." : "QSign + СЃРєР°С‡Р°С‚СЊ"}
                </button>
              </div>
              {signError && (
                <div className="mt-2 text-xs text-rose-400 border border-rose-500/30 rounded px-2 py-1 bg-rose-500/5">
                  РћС€РёР±РєР° РїРѕРґРїРёСЃРё: {signError}
                </div>
              )}
              {saved.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs text-[#9aa3c0] mb-2">РќРµРґР°РІРЅРёРµ СЃС†РµРЅР°СЂРёРё:</div>
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
            shockLabel={activeShockObj ? `${activeShockObj.icon} ${activeShockObj.name}` : null}
          />
        </section>

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
            РўРµРѕСЂРµС‚РёС‡РµСЃРєР°СЏ РѕСЃРЅРѕРІР°: North / Wallis / Weingast В«Violence and Social OrdersВ»,
            Acemoglu / Robinson В«Why Nations FailВ», Elinor Ostrom В«Governing the CommonsВ»,
            Nassim Taleb В«Skin in the GameВ».
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
    floor: "РџРѕР»",
    ruleOfLaw: "Р—Р°РєРѕРЅ",
    rotation: "Р РѕС‚Р°С†РёСЏ",
    transparency: "РџСЂРѕР·СЂ.",
    multiStatus: "Multi-status",
    skinInGame: "Skin",
    polycentricity: "РџРѕР»РёС†РµРЅС‚СЂ.",
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
  const currentMetrics = computeMetrics(sliders);
  const shockedMetrics = shockedSliders ? computeMetrics(shockedSliders) : null;
  const W = 720;
  const H = 480;
  const PAD = 56;
  const xFor = (v: number) => PAD + ((100 - v) / 100) * (W - 2 * PAD); // invert: low elite-fear в†’ right
  const yFor = (v: number) => H - PAD - (v / 100) * (H - 2 * PAD); // high innovation в†’ top

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
          Р“РґРµ С‚С‹ РЅР° РєР°СЂС‚Рµ РјРёСЂР°
        </h3>
        <div className="text-xs text-[#9aa3c0]">
          РѕСЃСЊ X вЂ” СЃС‚СЂР°С… СЌР»РёС‚ РїРµСЂРµРґ РЅРёР·РѕРј (в†ђ&nbsp;РІС‹С€Рµ) В· РѕСЃСЊ Y вЂ” РёРЅРЅРѕРІР°С†РёСЏ / РґСЂР°Р№РІ (в†‘&nbsp;РІС‹С€Рµ)
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
            в†— СЃРІРѕР±РѕРґР° + СЂРѕСЃС‚
          </text>
          <text x={PAD + 8} y={PAD + 14} fill="#f97316" fontSize="11" opacity={0.7}>
            СЃС‚СЂР°С… + СЂРѕСЃС‚
          </text>
          <text x={W - PAD - 8} y={H - PAD - 8} textAnchor="end" fill="#9aa3c0" fontSize="11" opacity={0.7}>
            СЃРІРѕР±РѕРґР° + Р·Р°СЃС‚РѕР№
          </text>
          <text x={PAD + 8} y={H - PAD - 8} fill="#ef4444" fontSize="11" opacity={0.7}>
            в†™ СЃС‚СЂР°С… + Р·Р°СЃС‚РѕР№
          </text>
          {/* axis ticks */}
          <text x={PAD} y={H - PAD + 18} fill="#9aa3c0" fontSize="10">100</text>
          <text x={W - PAD} y={H - PAD + 18} textAnchor="end" fill="#9aa3c0" fontSize="10">0</text>
          <text x={PAD - 6} y={PAD + 4} textAnchor="end" fill="#9aa3c0" fontSize="10">100</text>
          <text x={PAD - 6} y={H - PAD} textAnchor="end" fill="#9aa3c0" fontSize="10">0</text>
          <text x={W / 2} y={H - PAD + 32} textAnchor="middle" fill="#d4af37" fontSize="12">
            СЃС‚СЂР°С… СЌР»РёС‚ РїРµСЂРµРґ РЅРёР·РѕРј в†ђ
          </text>
          <text
            x={PAD - 28}
            y={H / 2}
            textAnchor="middle"
            fill="#d4af37"
            fontSize="12"
            transform={`rotate(-90 ${PAD - 28} ${H / 2})`}
          >
            в†‘ РёРЅРЅРѕРІР°С†РёСЏ / РґСЂР°Р№РІ
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

          {/* current scenario вЂ” glowing dot */}
          <circle cx={cx} cy={cy} r={14} fill="#22d3ee" opacity={0.18}>
            <animate attributeName="r" values="10;18;10" dur="2.4s" repeatCount="indefinite" />
          </circle>
          <circle cx={cx} cy={cy} r={7} fill="#22d3ee" stroke="#0b1736" strokeWidth={2} />
          <text x={cx + 12} y={cy + 4} fill="#22d3ee" fontSize="12" fontWeight="bold">
            С‚С‹ СЃРµР№С‡Р°СЃ
          </text>

          {/* shocked scenario вЂ” magenta dot with arrow */}
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
                РїРѕСЃР»Рµ: {shockLabel ?? "С€РѕРє"}
              </text>
            </g>
          )}
        </svg>
      </div>
      <p className="text-xs text-[#9aa3c0] mt-3">
        РўРѕС‡РєР° В«С‚С‹ СЃРµР№С‡Р°СЃВ» СЃС‡РёС‚Р°РµС‚СЃСЏ РёР· С‚РµРєСѓС‰РёС… РїРѕР»Р·СѓРЅРєРѕРІ. Р§РµРј РїСЂР°РІРµРµ вЂ” С‚РµРј РјРµРЅСЊС€Рµ СЌР»РёС‚С‹ Р±РѕСЏС‚СЃСЏ РЅРёР·Р°.
        Р§РµРј РІС‹С€Рµ вЂ” С‚РµРј Р±РѕР»СЊС€Рµ РґСЂР°Р№РІР° Рё РёРЅРЅРѕРІР°С†РёРё. РЎС‚СЂР°РЅС‹ вЂ” РїСЂРёР±Р»РёР¶С‘РЅРЅР°СЏ РѕС†РµРЅРєР° РїРѕ С€РєР°Р»Рµ 0-100; РЅРµ РЅР°СѓС‡РЅС‹Р№
        СЂРµР№С‚РёРЅРі, Р° РёРЅСЃС‚СЂСѓРјРµРЅС‚ РґР»СЏ РёРЅС‚СѓРёС†РёРё.
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
        <h3 className="text-lg font-semibold text-[#f5d27a]">РЎСЂР°РІРЅРёС‚СЊ РґРІР° СЃС†РµРЅР°СЂРёСЏ</h3>
        <div className="text-xs text-[#9aa3c0]">
          Р’С‹Р±РµСЂРё РґРІР° СЃРѕС…СЂР°РЅС‘РЅРЅС‹С…, СѓРІРёРґРёС€СЊ РїРѕР»Р·СѓРЅРєРё + РјРµС‚СЂРёРєРё + СЂРµР¶РёРјС‹ СЂСЏРґРѕРј. URL ?compare=A,B РјРѕР¶РЅРѕ
          РїРѕРґРµР»РёС‚СЊСЃСЏ
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        <div>
          <div className="text-xs uppercase text-[#22d3ee] mb-1">A вЂ” СЃРёРЅРёР№</div>
          <select
            value={compareA?.id ?? ""}
            onChange={(e) => onPickA(e.target.value || null)}
            className="w-full bg-[#050a1a] border border-[#22d3ee]/40 rounded px-3 py-2 text-sm"
          >
            <option value="">вЂ” РІС‹Р±СЂР°С‚СЊ СЃС†РµРЅР°СЂРёР№ вЂ”</option>
            {pickable.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} {s.regime ? `В· ${s.regime}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="text-xs uppercase text-[#f472b6] mb-1">B вЂ” СЂРѕР·РѕРІС‹Р№</div>
          <select
            value={compareB?.id ?? ""}
            onChange={(e) => onPickB(e.target.value || null)}
            className="w-full bg-[#050a1a] border border-[#f472b6]/40 rounded px-3 py-2 text-sm"
          >
            <option value="">вЂ” РІС‹Р±СЂР°С‚СЊ СЃС†РµРЅР°СЂРёР№ вЂ”</option>
            {pickable.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} {s.regime ? `В· ${s.regime}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {pickable.length === 0 && (
        <div className="text-sm text-[#9aa3c0] italic">
          РџРѕРєР° РЅРµС‚ СЃРѕС…СЂР°РЅС‘РЅРЅС‹С… СЃС†РµРЅР°СЂРёРµРІ СЃ РїРѕР»РЅС‹РјРё РґР°РЅРЅС‹РјРё. РЎРѕС…СЂР°РЅРё РїР°СЂСѓ РІС‹С€Рµ, Рё РѕРЅРё РїРѕСЏРІСЏС‚СЃСЏ Р·РґРµСЃСЊ.
        </div>
      )}

      {(compareA || compareB) && (
        <div className="text-right mb-3">
          <button
            type="button"
            onClick={onClear}
            className="text-xs px-3 py-1 rounded border border-[#d4af37]/30 hover:bg-[#d4af37]/10"
          >
            РЎР±СЂРѕСЃРёС‚СЊ РІС‹Р±РѕСЂ
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
                <span className="text-rose-300">в€’</span> {regimeA.cons}
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
                <span className="text-rose-300">в€’</span> {regimeB.cons}
              </div>
            </div>
          </div>

          <div className="mb-5">
            <div className="text-xs text-[#9aa3c0] mb-2">РџРѕР»Р·СѓРЅРєРё (A vs B):</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-2">
              {SLIDER_META.map((m) => {
                const va = slidersA[m.key];
                const vb = slidersB[m.key];
                return (
                  <div key={m.key}>
                    <div className="flex justify-between text-xs">
                      <span className="truncate">{m.label}</span>
                      <span className="font-mono text-[#9aa3c0]">
                        <span className="text-[#22d3ee]">{va}</span> В·{" "}
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
            <div className="text-xs text-[#9aa3c0] mb-2">РРЅРґРµРєСЃС‹ вЂ” РґРµР»СЊС‚Р° B РјРёРЅСѓСЃ A:</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-2 text-xs">
              {(
                [
                  ["eliteFear", "РЎС‚СЂР°С… СЌР»РёС‚ РїРµСЂРµРґ РЅРёР·РѕРј", true],
                  ["intraConflict", "Р“СЂС‹Р·РЅСЏ РІРЅСѓС‚СЂРё СЌР»РёС‚", true],
                  ["resentment", "РћР±РёРґР° РЅРёР·Р° РЅР° РІРµСЂС…", true],
                  ["innovation", "РРЅРЅРѕРІР°С†РёСЏ / РґСЂР°Р№РІ", false],
                  ["stability", "РЈСЃС‚РѕР№С‡РёРІРѕСЃС‚СЊ", false],
                  ["legitimacy", "Р›РµРіРёС‚РёРјРЅРѕСЃС‚СЊ", false],
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
                      <span className="text-[#9aa3c0] mx-1">в†’</span>
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
        A в†’ B РЅР° РєР°СЂС‚Рµ РјРёСЂР° (X вЂ” СЃС‚СЂР°С… СЌР»РёС‚, Y вЂ” РёРЅРЅРѕРІР°С†РёСЏ)
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
  const active = SHOCKS.find((s) => s.id === activeShock) ?? null;
  const shockedSliders = active ? applyShock(sliders, active.delta) : null;
  return (
    <div className="bg-[#0b1736]/60 border border-[#d4af37]/20 rounded-xl p-5">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-lg font-semibold text-[#f5d27a]">Stress test вЂ” С‡С‚Рѕ РІС‹РґРµСЂР¶РёС‚ С‚РІРѕСЏ РєРѕРЅСЃС‚РёС‚СѓС†РёСЏ</h3>
        <div className="text-xs text-[#9aa3c0]">
          РџСЂРёРјРµРЅСЏР№ С€РѕРє, СЃРјРѕС‚СЂРё РЅР° СЃРєР°С‚С‚РµСЂРµ, РєР°Рє С‚РµР±СЏ СЃРЅРѕСЃРёС‚ Рё РІ РєР°РєРѕР№ СЂРµР¶РёРј СЃРєР°С‚С‹РІР°РµС€СЊСЃСЏ
        </div>
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
              <div className="font-semibold text-sm mt-1">{s.name}</div>
              <div className="text-xs text-[#9aa3c0] mt-1 leading-snug">{s.desc}</div>
            </button>
          );
        })}
      </div>
      {active && shockedSliders && shockedRegime && (
        <div className="border-t border-[#d4af37]/20 pt-4">
          <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
            <div className="text-sm">
              <span className="text-[#9aa3c0]">Р±С‹Р»Рѕ: </span>
              <span className="text-[#22d3ee] font-semibold">{currentRegime.name}</span>
              <span className="text-[#9aa3c0] mx-2">в†’</span>
              <span className="text-[#9aa3c0]">СЃС‚Р°Р»Рѕ: </span>
              <span className="text-[#f472b6] font-semibold">{shockedRegime.name}</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClear}
                className="text-xs px-3 py-1 rounded border border-[#d4af37]/40 hover:bg-[#d4af37]/10"
              >
                РћС‚РјРµРЅРёС‚СЊ
              </button>
              <button
                type="button"
                onClick={onApply}
                className="text-xs px-3 py-1 rounded bg-[#f472b6] text-[#0b1736] font-semibold hover:bg-[#f472b6]/80"
              >
                РџСЂРёРјРµРЅРёС‚СЊ Рє РїРѕР»Р·СѓРЅРєР°Рј
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
                    <span className="text-[#9aa3c0]">в†’</span>
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