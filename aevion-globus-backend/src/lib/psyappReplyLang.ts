/**
 * Язык ответа ИИ-поддержки PsyApp (28.10.2026, окно «Приложения-2»).
 * Страница с 28.10 на ru/en/kk, а системная подсказка требовала «ответ на русском» —
 * человек на en получал по-русски. Неизвестный язык — русский, как было.
 */
export function psyappReplyLanguage(lang: unknown): string {
  if (lang === "en") return "Answer in English";
  if (lang === "kk") return "Жауапты қазақ тілінде бер (Answer in Kazakh)";
  return "Ответ на русском языке";
}
