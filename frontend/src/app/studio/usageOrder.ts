import type { CapUsage } from "./usageTypes";

/**
 * Подписи, значки и ПОРЯДОК показа. Ключи приходят с бэкенда из таблицы
 * тарифов; здесь только оформление.
 *
 * Возможность, которой тут нет, всё равно будет показана — в конце и с ключом
 * вместо подписи. Это намеренно: спрятать списываемую возможность хуже, чем
 * показать её некрасиво.
 */
export const CAP_META: Record<string, { label: string; icon: string; color: string }> = {
  video:     { label: "Videos",       icon: "\u{1F3AC}", color: "#7c3aed" },
  image:     { label: "Images",       icon: "\u{1F5BC}️", color: "#0d9488" },
  music:     { label: "Music",        icon: "\u{1F3B5}", color: "#b45309" },
  tts:       { label: "TTS chars",    icon: "\u{1F399}️", color: "#0369a1" },
  deploy:    { label: "Deploys",      icon: "\u{1F680}", color: "#64748b" },
  speech:    { label: "Speech jobs",  icon: "\u{1F5E3}️", color: "#be123c" },
  translate: { label: "Translations", icon: "\u{1F310}", color: "#15803d" },
  generate:  { label: "Code generations", icon: "\u{2728}", color: "#7c3aed" },
};

/** Ключи в порядке показа: известные — по CAP_META, незнакомые — следом. */
export function порядокПоказа(usage: Record<string, CapUsage>): string[] {
  const известные = Object.keys(CAP_META).filter((k) => usage[k]);
  const остальные = Object.keys(usage).filter((k) => !CAP_META[k]);
  return [...известные, ...остальные];
}

