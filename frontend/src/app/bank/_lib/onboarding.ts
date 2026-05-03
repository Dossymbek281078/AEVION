// Onboarding tour — 5-step walk-through that fires on first wallet load
// (or on-demand via the "?tour=1" query param / the in-page button).
// State persisted in localStorage so we only run it once by default.

const STORAGE_KEY = "aevion_bank_tour_seen_v1";

export type TourStep = {
  id: string;
  anchorId: string;
  label: string;
  headline: string;
  body: string;
  tip?: string;
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: "wallet",
    anchorId: "bank-anchor-wallet",
    label: "Wallet",
    headline: "Your AEC wallet lives here",
    body: "Top up, send to any account, and watch the balance tick up with live sparkline + CoinTower visualisation. Switch display currency any time — the conversion applies everywhere.",
    tip: "Try a 500 AEC top-up first — you'll see the balance animate and ecosystem stats refresh.",
  },
  {
    id: "ecosystem",
    anchorId: "bank-anchor-ecosystem",
    label: "Today across AEVION",
    headline: "One pulse, four modules",
    body: "Every QRight verification, CyberChess tournament, Planet bonus and banking op flows into this row. Click any tile to jump into that module — your money story is the ecosystem's story.",
  },
  {
    id: "forecast",
    anchorId: "bank-anchor-forecast",
    label: "Wealth forecast",
    headline: "Where your money is heading",
    body: "Three scenarios × three horizons, plus calendar-date ETAs for every savings goal. Forecasts use your live 30-day earning pace across all modules.",
    tip: "Switch the scenario to \"Optimistic\" to see the 1-year compounding case.",
  },
  {
    id: "trust",
    anchorId: "bank-anchor-trust",
    label: "Trust & peers",
    headline: "Your reputation, across AEVION",
    body: "The Ecosystem Trust Score feeds into salary-advance limits and peer ranking. \"Fastest wins\" tells you exactly which actions move your score the most.",
    tip: "You need a Growing-tier score (20+) to unlock instant advances.",
  },
  {
    id: "achievements",
    anchorId: "bank-anchor-achievements",
    label: "Achievements",
    headline: "18 badges, 4 tracks",
    body: "Every stat you build unlocks badges across Banking / Creator / Ecosystem / Security. Locked badges show exactly how close you are.",
    tip: "Enroll biometric, sign one transfer, and register a QRight work to grab your first three instantly.",
  },
];

export function hasSeenTour(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function markTourSeen(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
  } catch {
    // ignore
  }
}

export function resetTour(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function scrollToAnchor(anchorId: string): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById(anchorId);
  if (!el) return;
  try {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch {
    el.scrollIntoView();
  }
  // Flash the target briefly so the user's eye tracks it.
  el.style.transition = "box-shadow 600ms ease";
  el.style.boxShadow = "0 0 0 4px rgba(14,165,233,0.35)";
  window.setTimeout(() => {
    el.style.boxShadow = "none";
  }, 1400);
}
