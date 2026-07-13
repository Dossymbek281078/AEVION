// CyberChess design system — single source of truth for tokens.
// CSS equivalents live in globals.css under `/* CyberChess Design System */`.

// LIGHT — слоистая палитра в духе lichess: фон НЕ белый, а мягкий тёпло-серый «paper»,
// карточки/кнопки светлее фона и с ЗАМЕТНЫМИ границами → всё читается, ничего не «теряется»
// на белом. Раньше bg #f5f6fa ≈ surface #fff (разница ~1%) и границы #e4e7ee были бледные.
export const COLOR = {
  bg: "#e7e5df",           // тёпло-серый фон страницы (paper) — карточки на нём выделяются
  surface1: "#ffffff",     // основные панели/карточки
  surface2: "#f3f1ea",     // вторичные поверхности, дорожки табов, инпуты
  surface3: "#e2dfd6",     // утопленные зоны
  surfaceGlass: "rgba(255,255,255,0.85)",

  text: "#26231e",         // тёплый тёмный (не резко-чёрный, как lichess #4d4d4d но контрастнее)
  textDim: "#5f5952",
  textMute: "#6f6a61",     // затемнён с #8d867c: ~3.4:1 не проходил WCAG AA на белом/paper; #6f6a61 ≈ 5:1 (surface1/2), сохраняя иерархию text>textDim>textMute
  textInv: "#ffffff",

  border: "#cbc5ba",       // ЗАМЕТНАЯ тёпло-серая граница (было почти невидимо)
  borderStrong: "#a7a094",

  // Фирменные hue не трогаем (совпадают с CAT-палитрой, логотипом, onboarding) —
  // «смена гаммы» достигается тёплым paper-фоном и заметными границами выше.
  brand: "#059669",
  brandHover: "#047857",
  brandSoft: "rgba(5,150,105,0.12)",
  accent: "#7c3aed",
  accentSoft: "rgba(124,58,237,0.11)",
  gold: "#d97706",
  goldSoft: "rgba(217,119,6,0.12)",
  danger: "#dc2626",
  dangerSoft: "rgba(220,38,38,0.1)",
  info: "#2563eb",
  infoSoft: "rgba(37,99,235,0.1)",

  // Board interactions
  sqSel: "rgba(5,150,105,0.45)",
  sqValid: "rgba(5,150,105,0.35)",
  sqCap: "rgba(220,38,38,0.35)",
  sqLast: "rgba(217,119,6,0.28)",
  sqCheck: "rgba(220,38,38,0.55)",
  sqPremove: "rgba(37,99,235,0.4)",
  sqPremoveStrong: "rgba(37,99,235,0.55)",
} as const;

export const SPACE = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32, 8: 48 } as const;

export const RADIUS = { xs: 4, sm: 6, md: 10, lg: 14, xl: 20, full: 999 } as const;

export const SHADOW = {
  sm: "0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.03)",
  md: "0 4px 12px rgba(15,23,42,0.06), 0 1px 3px rgba(15,23,42,0.04)",
  lg: "0 10px 32px rgba(15,23,42,0.1), 0 4px 12px rgba(15,23,42,0.05)",
  xl: "0 24px 64px rgba(15,23,42,0.14), 0 8px 24px rgba(15,23,42,0.08)",
  glow: "0 0 0 3px rgba(5,150,105,0.18), 0 0 24px rgba(5,150,105,0.3)",
  glowPurple: "0 0 0 3px rgba(124,58,237,0.2), 0 0 24px rgba(124,58,237,0.3)",
  glowDanger: "0 0 0 3px rgba(220,38,38,0.22), 0 0 24px rgba(220,38,38,0.35)",
} as const;

export const MOTION = {
  fast: "120ms",
  base: "200ms",
  slow: "320ms",
  ease: "cubic-bezier(0.4,0,0.2,1)",
  easeOut: "cubic-bezier(0,0,0.2,1)",
  easeSpring: "cubic-bezier(0.34,1.56,0.64,1)",
} as const;

export const BREAK = { sm: 480, md: 768, lg: 1024, xl: 1280, xxl: 1536 } as const;

export const Z = {
  base: 1,
  sticky: 50,
  dropdown: 200,
  modalBackdrop: 900,
  modal: 1000,
  toast: 1100,
} as const;
