import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * «Один логин на все модули» — центральное обещание платформы: оно стоит в заявке
 * YC, на /acquire и в письмах. Держится оно на одном ключе в localStorage.
 *
 * Канонический ключ — `aevion_auth_token_v1` (AUTH_TOKEN_KEY в src/lib/auth.ts),
 * и записывает его ТОЛЬКО вход. Ключ `aevion_token` не пишет никто: 27.07.2026
 * его читали 54 файла, то есть человек входил один раз и в этих модулях выглядел
 * гостем. Ничего не падало — фичи молча вели себя как для неавторизованного,
 * а e2e-смок был зелёным, потому что сам подставлял `aevion_token` перед прогоном.
 *
 * Поэтому сторож статический: он падает до того, как страница попадёт к человеку,
 * и не зависит от того, какое состояние тест себе создал.
 *
 * Читать `aevion_token` МОЖНО — но только запасным, после канонического.
 */

// Путь от самого файла теста, а не от process.cwd(): при полном прогоне достаточно
// одного теста, сменившего рабочую папку в том же воркере, чтобы сторож начал
// сканировать не тот каталог. В этом репозитории такое уже случалось.
const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const CANONICAL = "aevion_auth_token_v1";
const LEGACY = 'getItem("aevion_token")';

/** Путь относительно src с прямыми слэшами: на Windows relative() даёт обратные,
 *  и сравнение с литералом в тесте падало бы не по делу. */
const rel = (file: string) => relative(SRC_DIR, file).split(sep).join("/");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

// Обходим дерево ОДИН раз на файл: два полных обхода (по одному на проверку)
// не укладывались в пятисекундный лимит vitest при общем прогоне — сторож был
// зелёным в одиночку и красным вместе со всеми.
const FILES = walk(SRC_DIR);

describe("ключ токена: один логин должен работать во всех модулях", () => {
  it("ни один файл не читает aevion_token без канонического ключа", () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      const src = readFileSync(file, "utf8");
      if (!src.includes(LEGACY)) continue;
      if (!src.includes(CANONICAL)) offenders.push(rel(file));
    }
    expect(
      offenders,
      `Эти файлы читают только устаревший ключ, который никто не пишет — ` +
        `залогиненный человек будет выглядеть в них гостем. Читайте сначала ` +
        `"${CANONICAL}", старый оставляйте запасным:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });

  it("канонический ключ объявлен ровно в одном месте", () => {
    const declarations: string[] = [];
    for (const file of FILES) {
      const src = readFileSync(file, "utf8");
      if (/AUTH_TOKEN_KEY\s*=\s*"/.test(src)) declarations.push(rel(file));
    }
    // Второе объявление означает, что появился ещё один «канонический» ключ —
    // ровно так дрейф и начинается.
    expect(declarations).toEqual(["lib/auth.ts"]);
  });
});
