// Цвета уровня и значок категории курса. Вынесено из страницы списка, когда
// появилась страница одного курса: два одинаковых словаря в двух файлах
// разъезжаются на первой же новой категории.

export const LEVEL_COLORS: Record<string, { bg: string; fg: string }> = {
  beginner: { bg: "#dcfce7", fg: "#15803d" },
  intermediate: { bg: "#fef3c7", fg: "#92400e" },
  advanced: { bg: "#fee2e2", fg: "#991b1b" },
};

export const CATEGORY_ICONS: Record<string, string> = {
  tech: "💻",
  business: "📊",
  design: "🎨",
  music: "🎵",
  language: "🌍",
  other: "📚",
};
