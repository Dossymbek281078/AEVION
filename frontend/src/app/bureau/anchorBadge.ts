/**
 * Как показать состояние якоря в биткойне на карточке реестра.
 *
 * Вынесено из разметки отдельным модулем, чтобы решение можно было проверить
 * тестом, не поднимая страницу: правил здесь больше, чем кажется, и почти
 * каждая — про честность, а не про вид.
 *
 * ГЛАВНОЕ ПРАВИЛО. «Сервер не прислал поле» и «якоря нет» — РАЗНЫЕ вещи, и
 * путать их нельзя именно сейчас: бэкенд с этим полем ещё не выкачен, и до
 * выкатки поле будет отсутствовать у ВСЕХ записей. Написать в этот момент
 * «без якоря» на всей витрине значило бы оболгать собственный продукт из-за
 * собственной неосведомлённости. Поэтому отсутствие поля — это `null`, то есть
 * «ничего не рисуем», а не пометка.
 */

export type AnchorInfo =
  | { status?: string | null; bitcoinBlockHeight?: number | null }
  | null
  | undefined;

export type AnchorBadge = {
  label: string;
  /** Подпись при наведении — объясняет пометку словами. */
  title: string;
  tone: "confirmed" | "pending" | "none" | "failed" | "unknown";
};

export function anchorBadge(a: AnchorInfo): AnchorBadge | null {
  // Поля нет вовсе — молчим. См. главное правило выше.
  if (a === null || a === undefined) return null;
  const status = typeof a.status === "string" && a.status !== "" ? a.status : null;
  if (status === null) return null;

  const h = typeof a.bitcoinBlockHeight === "number" && Number.isFinite(a.bitcoinBlockHeight)
    ? a.bitcoinBlockHeight
    : null;

  if (status === "bitcoin-confirmed") {
    return {
      label: h === null ? "⛓ Bitcoin anchored" : `⛓ Bitcoin #${h}`,
      title:
        h === null
          ? "Хеш работы закреплён в цепочке Bitcoin. Доказательство существует независимо от AEVION."
          : `Хеш работы закреплён в блоке Bitcoin №${h}. Доказательство существует независимо от AEVION.`,
      tone: "confirmed",
    };
  }
  if (status === "pending") {
    return {
      label: "⏳ anchoring",
      title: "Штамп отправлен в календари OpenTimestamps; подтверждение блоком Bitcoin появляется в течение нескольких часов.",
      tone: "pending",
    };
  }
  if (status === "failed") {
    return {
      label: "⚠ anchor failed",
      title: "Штамповка не удалась. Остальные слои доказательства (SHA-256, подпись, Ed25519) в силе.",
      tone: "failed",
    };
  }
  if (status === "not_stamped") {
    return {
      label: "no Bitcoin anchor",
      title: "Эта запись создана до появления якорения в Bitcoin; якоря у неё нет и не появится. Остальные слои доказательства в силе.",
      tone: "none",
    };
  }
  // Незнакомое состояние показываем КАК ЕСТЬ: спрятать его значило бы сделать
  // расхождение между базой и экраном невидимым.
  return { label: status, title: `Состояние якоря: ${status}`, tone: "unknown" };
}

export const ANCHOR_TONE_COLORS: Record<AnchorBadge["tone"], { bg: string; fg: string }> = {
  confirmed: { bg: "rgba(245,158,11,0.12)", fg: "#92400e" },
  pending: { bg: "rgba(59,130,246,0.10)", fg: "#1d4ed8" },
  none: { bg: "rgba(15,23,42,0.05)", fg: "#64748b" },
  failed: { bg: "rgba(239,68,68,0.10)", fg: "#b91c1c" },
  unknown: { bg: "rgba(15,23,42,0.05)", fg: "#475569" },
};
