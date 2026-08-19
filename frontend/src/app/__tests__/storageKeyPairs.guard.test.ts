import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Ключ хранилища, который ЧИТАЮТ, но не пишет никто.
 *
 * Такой ключ ведёт себя как «пользователь не вошёл» — навсегда. Ничего не
 * падает, в Sentry пусто: страница отрисовалась, форма показалась, токен
 * сохранён (под другим именем). Не работает только целое.
 *
 * Замер 20.08.2026: читается 304 ключа, пишется 299, сирот 13 — и СЕМЬ из
 * них это токен входа, каждый со своим именем. Вход пишет ровно одно:
 * `aevion_auth_token_v1`. Суммарно затронуто 32 модуля, среди них cyberchess,
 * который запускается первым.
 *
 * Дефект известен с 28.07.2026 и за три недели не сдвинулся. Сторож не чинит
 * его — починка это одна строка (`migrateAuthToken()` при старте приложения)
 * в файлах, которые правят чужие ветки. Сторож делает другое: не даёт классу
 * РАСТИ. Появится восьмое имя токена — тест назовёт его сразу, а не через
 * три недели.
 *
 * ПОЧЕМУ СПИСОК ИЗВЕСТНЫХ, А НЕ КРАСНЫЙ ТЕСТ. Сторож, валящий сборку с
 * первого дня, отключают в первый же день; платформа это проходила. Красным
 * он станет ровно на НОВОМ ключе.
 */
const KNOWN_ORPHANS = [
  // ——— Токены входа: настоящие дефекты. Читатель ждёт вход, а его там нет.
  "aevion_token",
  "aevion_auth_token",
  "aevion_jwt",
  "aevion:auth:token",
  "build_auth_token",
  "build_token",
  "qcore_token",
  "qcoreai_token",
  // ——— Остальные пять дефектами НЕ считаю: список даёт кандидатов, судить
  // надо по смыслу ключа. Эти ставит человек рукой либо это наследие.
  "aevion:locale",
  "aevion_debug",
  "aevion_platform_wallet_id",
  "aevion_user_display_name",
  "cc_display_name",
  // cc_user_id — НАМЕРЕННОЕ наследие, не дефект. 19.08.2026 CyberChess свёл
  // опознание игрока к одному ключу; старый читается запасным вариантом
  // (`getItem(новый) || getItem(старый)`) ради сессий, заведённых раньше, и
  // больше не пишется. Такой ключ и должен выглядеть сиротой: он доживает.
  //
  // Поймано этим сторожем при сведении с веткой прода — на моей отставшей
  // ветке его не было вовсе. Я сначала решил, что сторож считает комментарии
  // (грепом по литералу чтений не нашлось), и ошибся: чтение идёт ЧЕРЕЗ
  // КОНСТАНТУ, которую сторож умеет разворачивать, а мой греп — нет.
  "cc_user_id",
];

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "__tests__") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sources(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

/**
 * Ключи считаются ПАРОЙ: отдельно чтения, отдельно записи. Один список без
 * другого ничего не значит — 124 согласованных между собой читателя выглядят
 * как рабочая система ровно до вопроса «а кто это пишет».
 *
 * Учитываются и константы: `const KEY = "имя"` + `setItem(KEY, …)`.
 */
export function orphanKeys(files: { path: string; text: string }[]): string[] {
  const reads = new Set<string>();
  const writes = new Set<string>();
  const rx = {
    read: /(?:localStorage|sessionStorage)\.getItem\(\s*["'`]([A-Za-z0-9_.:-]+)["'`]/g,
    write: /(?:localStorage|sessionStorage)\.setItem\(\s*["'`]([A-Za-z0-9_.:-]+)["'`]/g,
    constDecl: /const\s+([A-Z_][A-Z0-9_]*)\s*=\s*["'`]([A-Za-z0-9_.:-]+)["'`]/g,
    readConst: /(?:localStorage|sessionStorage)\.getItem\(\s*([A-Z_][A-Z0-9_]*)\s*\)/g,
    writeConst: /(?:localStorage|sessionStorage)\.setItem\(\s*([A-Z_][A-Z0-9_]*)\s*,/g,
  };
  for (const f of files) {
    const consts = new Map<string, string>();
    for (const m of f.text.matchAll(rx.constDecl)) consts.set(m[1], m[2]);
    for (const m of f.text.matchAll(rx.read)) reads.add(m[1]);
    for (const m of f.text.matchAll(rx.write)) writes.add(m[1]);
    for (const m of f.text.matchAll(rx.readConst)) {
      const v = consts.get(m[1]);
      if (v) reads.add(v);
    }
    for (const m of f.text.matchAll(rx.writeConst)) {
      const v = consts.get(m[1]);
      if (v) writes.add(v);
    }
  }
  return [...reads].filter((k) => !writes.has(k)).sort();
}

describe("ключи хранилища: читают — значит кто-то должен писать", () => {
  const files = sources(SRC).map((p) => ({ path: p, text: readFileSync(p, "utf8") }));

  it("сканирует настоящий, непустой набор файлов", () => {
    // Без этого «новых сирот нет» верно и при сломанном обходе.
    expect(files.length).toBeGreaterThan(300);
  });

  it("новых ключей без писателя не появилось", () => {
    const fresh = orphanKeys(files).filter((k) => !KNOWN_ORPHANS.includes(k));
    expect(
      fresh,
      "ключ читают, но не пишет НИКТО — он навсегда пуст, и читатель ведёт себя " +
        "как «не вошёл». Либо запишите его, либо читайте тот, который пишут:\n" +
        fresh.join("\n"),
    ).toEqual([]);
  });

  it("сторож ловит сироту и молчит на парном ключе", () => {
    const orphan = [{ path: "a.ts", text: 'localStorage.getItem("no_writer_key")' }];
    const paired = [
      { path: "a.ts", text: 'localStorage.getItem("paired_key")' },
      { path: "b.ts", text: 'localStorage.setItem("paired_key", "x")' },
    ];
    const viaConst = [
      { path: "a.ts", text: 'const K = "const_key";\nlocalStorage.getItem(K)' },
      { path: "b.ts", text: 'const K = "const_key";\nlocalStorage.setItem(K, "x")' },
    ];
    expect(orphanKeys(orphan)).toEqual(["no_writer_key"]);
    expect(orphanKeys(paired)).toEqual([]);
    expect(orphanKeys(viaConst)).toEqual([]);
  });
});
