// Токены темы мультичата.
//
// До 2026-07-26 цвета были 118 литералами, разбросанными по 2418 строкам, и
// перевод страницы на светлый газетный эталон AEVION означал слепую правку
// каждого. Имена здесь — по РОЛИ, а не по оттенку: при смене темы меняются
// значения, имена остаются. Значения ниже перенесены один в один, чтобы
// извлечение токенов ничего не перекрасило — сама смена темы отдельным
// шагом, с просмотром экранов глазами.

export const T = {
  accent: "#5eead4",
  accentDeep: "#0d9488",
  accentDeeper: "#0e7490",
  bad: "#fca5a5",
  badBright: "#f87171",
  brand: "#c4b5fd",
  brandAlt: "#9333ea",
  brandDeep: "#7c3aed",
  brandDeeper: "#6d28d9",
  brandGlow: "#7c3aed55",
  brandInk: "#1e1b4b",
  brandInkSoft: "#312e81",
  cyan: "#06b6d4",
  cyanDeep: "#0891b2",
  good: "#86efac",
  goodBright: "#22c55e",
  goodDeep: "#15803d",
  indigo: "#4338ca",
  indigoBright: "#1d4ed8",
  indigoDeep: "#1e40af",
  line: "#475569",
  lineSoft: "#334155",
  onAccent: "#fff",
  sky: "#0ea5e9",
  skyDeep: "#0284c7",
  skyDeeper: "#0369a1",
  skyLight: "#7dd3fc",
  surface: "#0f172a",
  text: "#e2e8f0",
  textBright: "#f8fafc",
  textDim: "#cbd5e1",
  textFaded: "#64748b",
  textMute: "#94a3b8",
  textSoft: "#f1f5f9",
  warn: "#fbbf24",
  warnBright: "#facc15",
  warnDeep: "#b45309",
  surfaceSoft: "#1e293b",
  canvas: "#0b1220",
  onAccentDeep: "#042f2e",
  cardLight: "#fff",
  inkOnCard: "#0f172a",
  inkOnCardSoft: "#334155",
  inkOnCardMute: "#475569",
  divider: "#e2e8f0",
  btnAccentBg: "#5eead4",
  btnDisabledBg: "#334155",
} as const;
