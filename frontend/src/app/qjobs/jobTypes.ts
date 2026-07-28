// Тип занятости: цвета значка и человеческая подпись. Вынесено из страницы
// списка, когда появилась страница одной вакансии — иначе два словаря в двух
// файлах разъедутся на первом же новом типе занятости.

export const TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  "full-time": { bg: "#dcfce7", fg: "#15803d" },
  "part-time": { bg: "#fef3c7", fg: "#92400e" },
  contract: { bg: "#eff6ff", fg: "#2563eb" },
  freelance: { bg: "#f5f3ff", fg: "#7c3aed" },
  internship: { bg: "#fce7f3", fg: "#be185d" },
  /** Запасной вариант: неизвестный тип не должен ломать вёрстку. */
  other: { bg: "#f1f5f9", fg: "#475569" },
};

/** «full-time» → «Full-time». Показывать людям сырой ключ незачем. */
export function typeLabel(type: string): string {
  if (!type) return "Other";
  return type.charAt(0).toUpperCase() + type.slice(1);
}
