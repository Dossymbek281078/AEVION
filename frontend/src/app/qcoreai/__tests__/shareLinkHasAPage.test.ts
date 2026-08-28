import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Ссылка, которую код СОБИРАЕТ из origin и отдаёт человеку, обязана вести на
 * существующий адрес.
 *
 * Замер 28.08.2026 на живом сайте: кнопка «Invite» в QCoreAI создавала ссылку
 * и клала её в буфер обмена. Человек отправлял её коллеге — и:
 *
 *   1) страница /qcoreai/multi НИКОГДА не читала параметр invite;
 *   2) ручка GET /invites/:token отдаёт только {sessionId, role}, без
 *      содержимого, то есть получателю всё равно нужен был вход;
 *   3) второй механизм, /collab/<токен>, указывал на адрес, которого не
 *      существовало вовсе — прод отвечал 404, проверено curl.
 *
 * «Поделиться» было сломано на последнем шаге ОБОИМИ способами, и ни один тест
 * этого не видел: кнопка отрисовывается, запрос уходит, ответ 201. Ломался не
 * код, а обещание.
 *
 * Замер по всему сайту: 46 таких ссылок, не разрешалась ОДНА — та самая.
 * Поэтому проверка сделана общей, а не только про QCoreAI: она дешёвая и
 * ловит весь класс.
 */

const APP = path.resolve(__dirname, "../..");

/**
 * Адреса, которые прибор честно не умеет раскрыть. Список закрытый и каждый
 * пункт объяснён: молчаливое исключение — это способ спрятать дефект.
 *
 * qpaynet/widget собирает `/qpaynet/${target}`, где target имеет тип
 * "send" | "request". Обе страницы существуют (проверено на проде: 200 и 200),
 * но раскрыть значение переменной статически нельзя.
 */
const KNOWN_UNRESOLVABLE = new Set(["/qpaynet/x"]);

/** Есть ли под адресом обработчик: страница или route-handler. */
function routeExists(route: string): boolean {
  let dir = APP;
  for (const part of route.split("/").filter(Boolean)) {
    const exact = path.join(dir, part);
    if (fs.existsSync(exact) && fs.statSync(exact).isDirectory()) { dir = exact; continue; }
    // Динамический сегмент: [id], [token], [walletId] — имя роли не играет.
    const dynamic = fs.existsSync(dir)
      ? fs.readdirSync(dir).find((d) => d.startsWith("[") && fs.statSync(path.join(dir, d)).isDirectory())
      : undefined;
    if (!dynamic) return false;
    dir = path.join(dir, dynamic);
  }
  // route.ts — тоже настоящий адрес. Без него сторож ругался на /bank/badge/[id],
  // который на проде отвечает 200: проверять только page.tsx было ошибкой.
  return ["page.tsx", "page.ts", "route.ts", "route.tsx"].some((f) =>
    fs.existsSync(path.join(dir, f)),
  );
}

function sources(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) sources(p, out);
    else if (e.name.endsWith(".tsx") || e.name.endsWith(".ts")) out.push(p);
  }
  return out;
}

/** Все ссылки-страницы, которые код собирает из origin. */
function builtLinks(): Array<{ file: string; route: string }> {
  const found: Array<{ file: string; route: string }> = [];
  for (const file of sources(APP)) {
    const src = fs.readFileSync(file, "utf8");
    // Хвост `/${` означает, что дальше подставят значение: адрес надо искать
    // на сегмент глубже, иначе /qcoreai/collab само по себе страницей не будет.
    const re = /origin\}((?:\/[a-z0-9-]+)+)(\/\$\{)?/g;
    for (let m = re.exec(src); m; m = re.exec(src)) {
      if (m[1].startsWith("/api")) continue; // это ручки, а не страницы
      found.push({ file: path.relative(APP, file).replace(/\\/g, "/"), route: m[1] + (m[2] ? "/x" : "") });
    }
  }
  return found;
}

describe("собранная ссылка ведёт на существующую страницу", () => {
  test("контроль прибора: различает существующий адрес и выдуманный", () => {
    // Без этого сторож, разучившийся находить страницы, был бы зелёным на
    // любом адресе — то есть тихо перестал бы что-либо значить.
    expect(routeExists("/qcoreai"), "не видит заведомо существующей страницы").toBe(true);
    expect(routeExists("/qcoreai/collab/x"), "не видит страницы за динамическим сегментом").toBe(true);
    expect(routeExists("/qcoreai/no-such-page-xyz"), "признал выдуманный адрес").toBe(false);
    expect(builtLinks().length, "прибор не нашёл ни одной ссылки — он сломан").toBeGreaterThan(20);
  });

  test("ни одна собранная ссылка не ведёт в никуда", () => {
    const dead = builtLinks()
      .filter((l) => !KNOWN_UNRESOLVABLE.has(l.route) && !routeExists(l.route))
      .map((l) => `${l.route}  <- ${l.file}`);
    expect(
      [...new Set(dead)],
      "код отдаёт человеку ссылку на адрес, которого нет. Снаружи это выглядит " +
        "исправной кнопкой: запрос уходит, ответ 200, ссылка копируется — а " +
        "получатель видит 404 и считает, что ошибся он.",
    ).toEqual([]);
  });

  test("страница совместного просмотра публична: не требует входа", () => {
    const p = path.join(APP, "qcoreai", "collab", "[token]", "page.tsx");
    expect(fs.existsSync(p), "страницы совместного просмотра нет").toBe(true);
    const src = fs.readFileSync(p, "utf8");
    // Смысл ссылки в том, что получатель ещё не наш пользователь. Появится тут
    // Authorization — и она снова перестанет работать у того, кому её послали,
    // оставаясь рабочей у отправителя: дефект, которого сам автор не увидит.
    expect(src.includes("getAuthToken"), "страница требует вход — тогда делиться нечем").toBe(false);
    expect(src.includes("Authorization"), "страница шлёт токен — значит вход обязателен").toBe(false);
  });
});
