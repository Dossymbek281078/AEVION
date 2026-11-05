/**
 * «За $50/год открывается: …» — один список для трёх мест (4.11.2026, Оркестратор):
 * замок глубокого анализа на /cyberchess, блок CyberChess на /pricing?app=cyberchess,
 * рядом с кнопкой «Купить» на /cyberchess/traps и /cyberchess/guide.
 *
 * Только подтверждённое гейтами page.tsx (сторож deepAnalysisLockNamesPaidFeatures):
 * isPro открывает уровни ИИ 5–6, Ghost-подсказки и «Глубокий разбор» без монет,
 * значок Pro; панель NNUE — по доступу. Пункт NNUE подписан честно: сети на сайте
 * (замер 4.11: /nnue/*.nnue 200), прогон у оплатившего не проверялся.
 * Серверный компонент без хуков: язык передаётся явно; ru/en/kk, остальные — из en.
 */
import { CHESS_YEARLY_USD } from "@/lib/termPricing";

export const CC_PAID_FEATURES: Record<"ru" | "en" | "kk", { title: string; items: string[] }> = {
  ru: {
    title: `За $${CHESS_YEARLY_USD}/год открывается:`,
    items: [
      "Уровни ИИ 5–6 — Мастер и Stockfish (бесплатно: до 4)",
      "Ghost-подсказки без монет",
      "Глубокий разбор партии без монет",
      "Глубокий анализ Stockfish 17.1 NNUE (нейросети уже на сайте)",
      "Значок Pro в профиле",
    ],
  },
  en: {
    title: `$${CHESS_YEARLY_USD}/year unlocks:`,
    items: [
      "AI levels 5–6 — Master and Stockfish (free: up to 4)",
      "Ghost hints without coins",
      "Deep game review without coins",
      "Deep analysis with Stockfish 17.1 NNUE (networks already on the site)",
      "Pro badge in your profile",
    ],
  },
  kk: {
    title: `Жылына $${CHESS_YEARLY_USD} ашады:`,
    items: [
      "ЖИ деңгейлері 5–6 — Мастер және Stockfish (тегін: 4-ке дейін)",
      "Монетасыз Ghost-кеңестер",
      "Монетасыз партияны терең талдау",
      "Stockfish 17.1 NNUE терең талдауы (нейрожелілер сайтта)",
      "Профильдегі Pro белгісі",
    ],
  },
};

export function ccPaidFeatures(lang: string | null | undefined) {
  return lang === "ru" || lang === "kk" ? CC_PAID_FEATURES[lang] : CC_PAID_FEATURES.en;
}

export function CyberChessPaidList({ lang, compact = false, color = "#4a4a4a" }: { lang: string | null | undefined; compact?: boolean; color?: string }) {
  const t = ccPaidFeatures(lang);
  return (
    <div data-testid="cc-paid-features" style={{ color, fontSize: compact ? 13.5 : 14.5, lineHeight: 1.5 }}>
      <div style={{ fontWeight: 800 }}>{t.title}</div>
      <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
        {t.items.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </div>
  );
}
