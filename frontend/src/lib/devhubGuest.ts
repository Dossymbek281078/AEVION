/**
 * Идентификатор гостя DevHub — чтобы черновики разлогиненных посетителей не
 * лежали в одном ящике на всех.
 *
 * До 21.08.2026 бэкенд читал всех разлогиненных как одного пользователя
 * "anonymous": список проектов был общий, а `DELETE /projects/:id` пускал
 * любого посетителя удалить чужой проект вместе с его базой. Пользоваться без
 * аккаунта предполагалось намеренно («No GitHub or cloud accounts needed»),
 * поэтому чиним не запретом, а собственным идентификатором у каждого браузера.
 *
 * ЧЕСТНАЯ ГРАНИЦА: это не авторизация. Значение хранится у клиента и им же
 * присылается — подделавший чужое получит чужие черновики. Оно разделяет
 * посетителей, а не защищает от злоумышленника; защита — вход в аккаунт.
 */
export const DEVHUB_GUEST_HEADER = "x-devhub-guest";
const STORAGE_KEY = "devhub_guest_id";

/** Тот же формат, что проверяет бэкенд (src/lib/devhubGuest.ts). */
const GUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

function newId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch { /* нет crypto — ниже запасной путь */ }
  // Запасной путь для старых браузеров. Уникальность здесь нужна только чтобы
  // не столкнуться с соседом, секретности от неё не требуется.
  return `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Идентификатор этого браузера. `null`, если хранилище недоступно (приватный
 * режим, запрет куки): тогда заголовок не шлётся и поведение остаётся прежним —
 * общий ящик. Молча деградировать здесь правильнее, чем ломать страницу.
 */
export function getDevhubGuestId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && GUEST_ID.test(saved)) return saved;
    const fresh = newId();
    if (!GUEST_ID.test(fresh)) return null;
    window.localStorage.setItem(STORAGE_KEY, fresh);
    return fresh;
  } catch {
    return null;
  }
}

/**
 * Выдать браузеру НОВУЮ гостевую личность.
 *
 * Зовётся ровно в одном случае: после того как гостевая работа переехала в
 * аккаунт. Прежняя личность с этого момента принадлежит аккаунту, и оставлять
 * её браузеру нельзя — иначе следующая гостевая работа (человек вышел и снова
 * пробует без входа, или браузером пользуется второй человек) ляжет на ту же
 * личность, которую перенос уже считает разобранной, и пропадёт из виду
 * ровно так же, как до починки.
 *
 * Возвращает новую личность или `null`, если хранилище недоступно.
 */
export function rotateDevhubGuestId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const fresh = newId();
    if (!GUEST_ID.test(fresh)) return null;
    window.localStorage.setItem(STORAGE_KEY, fresh);
    return fresh;
  } catch {
    return null;
  }
}

/** Адрес ручки DevHub — только таким запросам добавляется заголовок. */
export function isDevhubApiUrl(input: unknown): boolean {
  let url = "";
  if (typeof input === "string") url = input;
  else if (input && typeof input === "object") {
    const o = input as { href?: unknown; url?: unknown };
    if (typeof o.href === "string") url = o.href;
    else if (typeof o.url === "string") url = o.url;
  }
  return url.includes("/api/devhub/") || url.endsWith("/api/devhub");
}

/**
 * Добавляет заголовок, сохраняя те, что уже были. `Headers` принимает все три
 * формы (объект, массив пар, сам `Headers`), поэтому разбирать их руками не
 * нужно — руками как раз и теряются заголовки вызывающего.
 */
export function withGuestHeader(init: RequestInit | undefined, id: string): RequestInit {
  const headers = new Headers(init?.headers as HeadersInit | undefined);
  headers.set(DEVHUB_GUEST_HEADER, id);
  return { ...init, headers };
}

let installed = false;

/**
 * Ставит заголовок на запросы к DevHub, не трогая 90 мест вызова.
 *
 * Почему подменой `fetch`, а не обёрткой на каждом вызове: мест девяносто, из
 * них 81 в одном файле, и механическая замена там оставила бы огрызки — класс
 * ошибок дороже самой починки. Проверка адреса пропускает всё постороннее
 * нетронутым.
 *
 * Возвращает функцию отката (нужна тестам). Повторный вызов ничего не делает.
 */
export function installDevhubGuestHeader(): () => void {
  if (typeof window === "undefined" || installed) return () => {};
  const id = getDevhubGuestId();
  if (!id) return () => {};
  const original = window.fetch;
  installed = true;
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    isDevhubApiUrl(input) ? original(input, withGuestHeader(init, id)) : original(input, init)) as typeof window.fetch;
  return () => {
    window.fetch = original;
    installed = false;
  };
}
