/**
 * Класс устройства по строке браузера — без самой строки наружу.
 *
 * Повод 13.10.2026 (оркестратор): 12 живых сессий открыли /devhub и ушли без
 * единого шага первого экрана; различить «медленная мобильная сеть» и «витрина
 * не зацепила» событиями нельзя, а по классу устройства и часу суток — можно.
 * Строка браузера хранится в событии целиком (до 200 знаков) и наружу не
 * отдаётся; разрез отдаёт только класс.
 */
export type KlassUstroystva = "mobile" | "tablet" | "desktop" | "unknown";

export function klassUstroystva(ua: string | undefined | null): KlassUstroystva {
  const s = String(ua ?? "").trim();
  if (!s) return "unknown";
  // Планшеты — до телефонов: у iPad и Android-планшетов нет слова Mobile.
  if (/iPad|Tablet|PlayBook|Silk/i.test(s) || (/Android/i.test(s) && !/Mobile/i.test(s))) return "tablet";
  if (/Mobi|iPhone|iPod|Android|Windows Phone|Opera Mini|IEMobile/i.test(s)) return "mobile";
  return "desktop";
}
