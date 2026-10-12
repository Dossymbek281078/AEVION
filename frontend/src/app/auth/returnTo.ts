/**
 * Куда вернуть человека после входа или регистрации.
 *
 * 🔴 Замер 12.10.2026 (окно Приложения-31.12): 21 ссылка сайта ведёт на
 * `/auth?next=<страница>` (ещё две — `?redirect=`), а страница входа этот
 * параметр не читала НИКОГДА. Гость QSign нажимал «Войти», регистрировался и
 * оставался на /auth со ссылками на шахматы и QRight — обратной дороги к
 * подписи не было.
 *
 * Только свой сайт: путь обязан начинаться с одного «/». «//evil.com» и
 * «/\evil.com» браузер читает как чужой адрес — это открытый редирект, через
 * который уводят только что вошедшего человека на поддельную страницу.
 */
export function адресВозврата(search: string): string | null {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return null;
  }
  const raw = params.get("next") ?? params.get("redirect");
  if (!raw) return null;
  const путь = raw.trim();
  if (!путь.startsWith("/")) return null;
  if (путь.startsWith("//") || путь.startsWith("/\\")) return null;
  // Управляющие символы (перевод строки, табуляция) браузер выбрасывает из
  // адреса — «/\t/evil.com» превратился бы в «//evil.com».
  if (/[\u0000-\u001f\u007f]/.test(путь)) return null;
  // Вернуть на саму страницу входа — значит оставить человека там же.
  if (путь === "/auth" || путь.startsWith("/auth?") || путь.startsWith("/auth/")) return null;
  return путь;
}
