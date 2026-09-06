/**
 * Подсказка пилюли выручки — ОДНА строка на оба бейджа, по языку читателя.
 *
 * Повод (06.09.2026, класс «атрибут против доводчика»): title/aria пилюли
 * были зашиты по-русски с локалью ru-RU в ДВУХ файлах независимо
 * (RevenueGoalBadge и AppShellRevenueBadge) — EN-визитёр видел русскую
 * подсказку на каждой странице волны, а два экземпляра строки уже начали
 * жить порознь (класс «второй список расходится молча»). Теперь источник
 * один; язык подставляет вызывающий из useI18nOptional.
 */
const ЛОКАЛЬ: Record<string, string> = { ru: "ru-RU", kk: "kk-KZ", en: "en-US" };

export function revenueTip(lang: string, grossUsd: number, days: number): string {
  const сумма = `$${grossUsd.toLocaleString(ЛОКАЛЬ[lang] ?? "en-US", { maximumFractionDigits: 0 })}`;
  switch (lang) {
    case "ru":
      return `${сумма} собрано из $1M · ${days} дн. до срока ($20M stretch goal)`;
    case "kk":
      return `$1M ішінен ${сумма} жиналды · мерзімге дейін ${days} күн ($20M stretch goal)`;
    default:
      return `${сумма} raised of $1M · ${days} days to deadline ($20M stretch goal)`;
  }
}
