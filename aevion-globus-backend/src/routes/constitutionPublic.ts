/**
 * Constitution — public read-only REST.
 *
 * Stable read endpoints for third-party integrations (bots, research
 * tools, AI agents). All responses are cacheable for 1 hour. No auth.
 *
 *   GET /api/constitution/public/regimes
 *   GET /api/constitution/public/presets
 *   GET /api/constitution/public/countries
 *   GET /api/constitution/public/sliders-spec
 *
 * Data shapes mirror frontend/src/lib/constitution.ts. Backend keeps an
 * independent copy because frontend code is not importable from the
 * Node runtime (different bundler, different paths).
 *
 * Versioning: this is "v1" — keys may be added but never removed within
 * v1. Breaking changes go to /api/constitution/public/v2/* (not yet).
 */

import { Router, type Request, type Response } from "express";
import { rateLimit } from "../lib/rateLimit";

const readLimit = rateLimit({
  windowMs: 60_000,
  max: 240,
  keyPrefix: "constitution-public",
});

function cacheable(res: Response, seconds = 3600): void {
  res.setHeader(
    "Cache-Control",
    `public, max-age=${seconds}, s-maxage=${seconds}, stale-while-revalidate=${seconds * 6}`,
  );
}

/* ───────── Slider spec ───────── */

const SLIDER_SPEC = [
  { key: "floor", label: "Floor below", low: "Everyone for themselves", high: "Nobody falls below", weight: { stability: 0.3, legitimacy: 0.2 } },
  { key: "ruleOfLaw", label: "Law binds the top too", low: "Law for the poor only", high: "All equal under law", weight: { stability: 0.4, legitimacy: 0.3 } },
  { key: "rotation", label: "Rotation / sortition", low: "Lifetime castes", high: "Regular sortition", weight: { stability: 0.1, legitimacy: 0.2 } },
  { key: "transparency", label: "Elite transparency", low: "Dark rooms", high: "Glass corridors", weight: { stability: 0.2, legitimacy: 0.3 } },
  { key: "multiStatus", label: "Multiple status axes", low: "One axis (money/power)", high: "Many legitimate arenas", weight: { innovation: 0.25 } },
  { key: "skinInGame", label: "Skin in the game", low: "Decide-without-risk", high: "All at stake" },
  { key: "polycentricity", label: "Polycentricity", low: "Super-state", high: "Federation of locales", weight: { innovation: 0.25 } },
  { key: "positiveSum", label: "Positive sum", low: "Pure distribution", high: "Inclusive growth", weight: { innovation: 0.5 } },
] as const;

/* ───────── Regimes (mirror of lib/constitution.ts classify()) ───────── */

const REGIMES = [
  {
    id: "open-access",
    name: "Open Access Order",
    name_ru: "Открытый порядок (Open Access)",
    era: "Ideal — North / Wallis / Weingast",
    summary: "All four pillars set: positive sum, law for all, floor below, rotation, transparency, multiple statuses. Elites compete but don't destroy each other.",
    pros: "Low intra-elite hostility, high legitimacy, strong innovation.",
    cons: "Fragile in crisis: war/pandemic harder to survive than mobilization regimes.",
  },
  {
    id: "nordic",
    name: "Nordic Model",
    name_ru: "Скандинавская модель",
    era: "Sweden / Denmark / Norway — post-1945",
    summary: "High floor, rule of law, state transparency. Elites don't fear the bottom because there is no bottom in the existential sense.",
    pros: "Minimal social tension, high trust, low corruption.",
    cons: "Expensive. Requires cultural homogeneity or strong integration.",
  },
  {
    id: "totalitarian",
    name: "Totalitarian Dictatorship",
    name_ru: "Тоталитарная диктатура",
    era: "Stalinist USSR, Maoist China, DPRK",
    summary: "One party, one leader. No law as defense from power, no rotation, no transparency.",
    pros: "Capacity for extreme mobilization.",
    cons: "Self-cannibalizing top, technological backwardness.",
  },
  {
    id: "authoritarian",
    name: "Authoritarian Vertical",
    name_ru: "Авторитарная вертикаль",
    era: "20th century — Latin America, post-Soviet regimes",
    summary: "One center, selective law, no transparency, no rotation. The elite permanently fears the bottom.",
    pros: "Fast mobilization in crisis, decade-scale visible stability.",
    cons: "Constant paranoia at the top. Succession crisis = revolution or chaos.",
  },
  {
    id: "extractive-boom",
    name: "Extractive Boom",
    name_ru: "Экстрактивный бум",
    era: "Belgian Congo; oil cycles",
    summary: "The pie really grows but is captured narrowly.",
    pros: "High short-term growth.",
    cons: "Explodes on the first long resource price slump.",
  },
  {
    id: "network-post-nation",
    name: "Network Post-Nation",
    name_ru: "Сетевая постнация",
    era: "Hypothesis — competing jurisdictions of the 2030s",
    summary: "Not one state but a patchwork of competing jurisdictions.",
    pros: "System competition, exit option, less capture.",
    cons: "Weak guarantees in crisis. Digital inequality entrenched.",
  },
  {
    id: "feudalism",
    name: "Late Feudalism",
    name_ru: "Поздний феодализм",
    era: "Europe 14th–17th c.; neo-feudal scenarios",
    summary: "Hereditary elite, bottom tied to land/employer, law respects form not substance.",
    pros: "Stability through inertia.",
    cons: "Low innovation, eventually replaced by force.",
  },
  {
    id: "ancient-polis",
    name: "Ancient Polis",
    name_ru: "Античный полис",
    era: "Athens 5th c. BCE",
    summary: "Sortition and rotation at the foundation, but 'full citizens' is only a narrow group.",
    pros: "Minimal infighting inside the citizen circle.",
    cons: "Systematic exclusion of a large part of the population.",
  },
  {
    id: "modern-liberal",
    name: "Modern Liberal Democracy",
    name_ru: "Современная либеральная демократия",
    era: "EU / US / Japan / Canada — 21st century",
    summary: "Law works, transparency present, floor middling. Elites fight within procedures.",
    pros: "Majority safe. Strong innovation.",
    cons: "Growing sense of 'they don't hear us'. Politics oligarchized via money.",
  },
  {
    id: "mixed",
    name: "Mixed Unstable Regime",
    name_ru: "Смешанный неустойчивый режим",
    era: "Hybrid — too early to classify",
    summary: "Parameters don't form a clean historical model.",
    pros: "Tuning room in the desired direction.",
    cons: "Unstable. Trust still weak in any direction.",
  },
] as const;

/* ───────── Presets (mirror of lib/constitution.ts PRESETS) ───────── */

const PRESETS = [
  { name: "Open Access (ideal)",   sliders: { floor: 75, ruleOfLaw: 85, rotation: 70, transparency: 80, multiStatus: 75, skinInGame: 70, polycentricity: 65, positiveSum: 80 } },
  { name: "Nordic",                sliders: { floor: 80, ruleOfLaw: 85, rotation: 40, transparency: 80, multiStatus: 55, skinInGame: 50, polycentricity: 30, positiveSum: 65 } },
  { name: "US 21st century",       sliders: { floor: 35, ruleOfLaw: 65, rotation: 25, transparency: 60, multiStatus: 50, skinInGame: 35, polycentricity: 55, positiveSum: 70 } },
  { name: "Authoritarian",         sliders: { floor: 30, ruleOfLaw: 25, rotation: 10, transparency: 15, multiStatus: 25, skinInGame: 25, polycentricity: 15, positiveSum: 50 } },
  { name: "Feudalism",             sliders: { floor: 15, ruleOfLaw: 35, rotation: 5,  transparency: 20, multiStatus: 25, skinInGame: 60, polycentricity: 70, positiveSum: 25 } },
  { name: "Singapore",             sliders: { floor: 65, ruleOfLaw: 80, rotation: 15, transparency: 65, multiStatus: 40, skinInGame: 55, polycentricity: 10, positiveSum: 85 } },
  { name: "UAE",                   sliders: { floor: 55, ruleOfLaw: 50, rotation: 5,  transparency: 25, multiStatus: 30, skinInGame: 40, polycentricity: 15, positiveSum: 80 } },
  { name: "Saudi Arabia",          sliders: { floor: 60, ruleOfLaw: 30, rotation: 5,  transparency: 15, multiStatus: 20, skinInGame: 25, polycentricity: 10, positiveSum: 55 } },
  { name: "USSR 1980",             sliders: { floor: 65, ruleOfLaw: 20, rotation: 10, transparency: 10, multiStatus: 30, skinInGame: 35, polycentricity: 10, positiveSum: 35 } },
  { name: "Nomadic Steppe",        sliders: { floor: 40, ruleOfLaw: 45, rotation: 60, transparency: 70, multiStatus: 65, skinInGame: 90, polycentricity: 85, positiveSum: 35 } },
] as const;

/* ───────── Countries (15) ───────── */

const COUNTRIES = [
  { code: "us", flag: "🇺🇸", en: "United States",        name_ru: "США",          sliders: { floor: 35, ruleOfLaw: 65, rotation: 25, transparency: 60, multiStatus: 60, skinInGame: 35, polycentricity: 65, positiveSum: 75 } },
  { code: "de", flag: "🇩🇪", en: "Germany",              name_ru: "Германия",     sliders: { floor: 75, ruleOfLaw: 85, rotation: 40, transparency: 75, multiStatus: 60, skinInGame: 50, polycentricity: 65, positiveSum: 65 } },
  { code: "no", flag: "🇳🇴", en: "Norway",               name_ru: "Норвегия",     sliders: { floor: 90, ruleOfLaw: 90, rotation: 50, transparency: 90, multiStatus: 60, skinInGame: 55, polycentricity: 30, positiveSum: 70 } },
  { code: "jp", flag: "🇯🇵", en: "Japan",                name_ru: "Япония",       sliders: { floor: 70, ruleOfLaw: 80, rotation: 25, transparency: 65, multiStatus: 65, skinInGame: 50, polycentricity: 30, positiveSum: 60 } },
  { code: "sg", flag: "🇸🇬", en: "Singapore",            name_ru: "Сингапур",     sliders: { floor: 65, ruleOfLaw: 80, rotation: 15, transparency: 65, multiStatus: 40, skinInGame: 55, polycentricity: 10, positiveSum: 85 } },
  { code: "ae", flag: "🇦🇪", en: "United Arab Emirates", name_ru: "ОАЭ",          sliders: { floor: 55, ruleOfLaw: 50, rotation: 5,  transparency: 25, multiStatus: 30, skinInGame: 40, polycentricity: 15, positiveSum: 80 } },
  { code: "sa", flag: "🇸🇦", en: "Saudi Arabia",         name_ru: "Сауд. Аравия", sliders: { floor: 60, ruleOfLaw: 30, rotation: 5,  transparency: 15, multiStatus: 20, skinInGame: 25, polycentricity: 10, positiveSum: 55 } },
  { code: "ru", flag: "🇷🇺", en: "Russia",               name_ru: "Россия",       sliders: { floor: 35, ruleOfLaw: 25, rotation: 10, transparency: 20, multiStatus: 30, skinInGame: 30, polycentricity: 25, positiveSum: 50 } },
  { code: "cn", flag: "🇨🇳", en: "China",                name_ru: "Китай",        sliders: { floor: 50, ruleOfLaw: 35, rotation: 10, transparency: 20, multiStatus: 35, skinInGame: 35, polycentricity: 30, positiveSum: 80 } },
  { code: "ir", flag: "🇮🇷", en: "Iran",                 name_ru: "Иран",         sliders: { floor: 30, ruleOfLaw: 25, rotation: 15, transparency: 15, multiStatus: 30, skinInGame: 30, polycentricity: 25, positiveSum: 35 } },
  { code: "kp", flag: "🇰🇵", en: "North Korea",          name_ru: "КНДР",         sliders: { floor: 15, ruleOfLaw: 5,  rotation: 0,  transparency: 5,  multiStatus: 10, skinInGame: 15, polycentricity: 5,  positiveSum: 20 } },
  { code: "ve", flag: "🇻🇪", en: "Venezuela",            name_ru: "Венесуэла",    sliders: { floor: 25, ruleOfLaw: 15, rotation: 10, transparency: 15, multiStatus: 25, skinInGame: 25, polycentricity: 25, positiveSum: 25 } },
  { code: "in", flag: "🇮🇳", en: "India",                name_ru: "Индия",        sliders: { floor: 35, ruleOfLaw: 55, rotation: 30, transparency: 50, multiStatus: 55, skinInGame: 40, polycentricity: 70, positiveSum: 65 } },
  { code: "br", flag: "🇧🇷", en: "Brazil",               name_ru: "Бразилия",     sliders: { floor: 40, ruleOfLaw: 45, rotation: 25, transparency: 50, multiStatus: 50, skinInGame: 35, polycentricity: 60, positiveSum: 50 } },
  { code: "kz", flag: "🇰🇿", en: "Kazakhstan",           name_ru: "Казахстан",    sliders: { floor: 50, ruleOfLaw: 40, rotation: 10, transparency: 30, multiStatus: 30, skinInGame: 35, polycentricity: 25, positiveSum: 60 } },
] as const;

export const constitutionPublicRouter = Router();

constitutionPublicRouter.get(
  "/regimes",
  readLimit as unknown as (req: Request, res: Response, next: () => void) => void,
  (_req: Request, res: Response) => {
    cacheable(res);
    res.json({
      version: 1,
      count: REGIMES.length,
      items: REGIMES,
    });
  },
);

constitutionPublicRouter.get(
  "/presets",
  readLimit as unknown as (req: Request, res: Response, next: () => void) => void,
  (_req: Request, res: Response) => {
    cacheable(res);
    res.json({
      version: 1,
      count: PRESETS.length,
      items: PRESETS,
    });
  },
);

constitutionPublicRouter.get(
  "/countries",
  readLimit as unknown as (req: Request, res: Response, next: () => void) => void,
  (_req: Request, res: Response) => {
    cacheable(res);
    res.json({
      version: 1,
      count: COUNTRIES.length,
      items: COUNTRIES,
    });
  },
);

constitutionPublicRouter.get(
  "/sliders-spec",
  readLimit as unknown as (req: Request, res: Response, next: () => void) => void,
  (_req: Request, res: Response) => {
    cacheable(res);
    res.json({
      version: 1,
      count: SLIDER_SPEC.length,
      items: SLIDER_SPEC,
    });
  },
);

constitutionPublicRouter.get(
  "/",
  readLimit as unknown as (req: Request, res: Response, next: () => void) => void,
  (_req: Request, res: Response) => {
    cacheable(res, 600);
    res.json({
      version: 1,
      endpoints: {
        regimes: "/api/constitution/public/regimes",
        presets: "/api/constitution/public/presets",
        countries: "/api/constitution/public/countries",
        slidersSpec: "/api/constitution/public/sliders-spec",
      },
      docs: "https://github.com/Dossymbek281078/AEVION/blob/main/docs/constitution-public-api.md",
      cache: "1 hour public + 6h stale-while-revalidate",
    });
  },
);
