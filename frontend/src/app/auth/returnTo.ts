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

/**
 * То же, но если `next` не передан — страница, с которой пришли (referrer),
 * если она с нашего сайта. 12.10.2026: 32 ссылки «Войти» на страницах модулей
 * ведут на голый /auth (банк, шахматы, lifebox, z-tide, qpaynet…); править
 * каждую — 32 правки в чужих зонах, а без возврата человек после входа
 * застревал на /auth. Явный next всегда главнее.
 */
export function адресВозвратаИлиОткуда(
  search: string,
  referrer: string,
  origin: string,
  запомненная: string | null = null,
): string | null {
  const явный = адресВозврата(search);
  if (явный) return явный;
  // Запомненная страница (components/LastPageMemory.tsx) главнее referrer:
  // при переходе через <Link> referrer пустой — замер прода 12.10.2026.
  if (запомненная) {
    const путь = адресВозврата(`?next=${encodeURIComponent(запомненная)}`);
    if (путь) return путь;
  }
  if (!referrer) return null;
  let u: URL;
  try {
    u = new URL(referrer);
  } catch {
    return null;
  }
  if (u.origin !== origin) return null;
  return адресВозврата(`?next=${encodeURIComponent(u.pathname + u.search)}`);
}
