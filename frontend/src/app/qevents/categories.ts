// Значок и цвета категории события. Вынесено из страницы списка, когда
// появилась страница одного события: два одинаковых словаря в двух файлах
// разъезжаются на первой же новой категории — одна страница её знает, вторая
// рисует серую заглушку.

export const CATEGORY_ICONS: Record<string, string> = {
  tech: "💻",
  business: "📊",
  art: "🎨",
  music: "🎵",
  sports: "⚽",
  education: "📚",
  networking: "🤝",
  other: "🎉",
};

export const CATEGORY_COLORS: Record<string, { bg: string; fg: string }> = {
  tech: { bg: "#eff6ff", fg: "#2563eb" },
  business: { bg: "#f0fdf4", fg: "#15803d" },
  art: { bg: "#fce7f3", fg: "#be185d" },
  music: { bg: "#fff7ed", fg: "#c2410c" },
  sports: { bg: "#ecfdf5", fg: "#059669" },
  education: { bg: "#f5f3ff", fg: "#7c3aed" },
  networking: { bg: "#fef2f2", fg: "#b91c1c" },
  other: { bg: "#f1f5f9", fg: "#475569" },
};

/** Значок и цвета с запасным вариантом: неизвестная категория не должна ломать вёрстку. */
export function categoryLook(category: string): { icon: string; bg: string; fg: string } {
  const colors = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other;
  return { icon: CATEGORY_ICONS[category] ?? CATEGORY_ICONS.other, ...colors };
}
