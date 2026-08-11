import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./_stripComments";

/* У каждого ключа хранилища должен быть и писатель, и читатель.
 *
 * Ключ, который только ЧИТАЮТ, — это молчащая фича: значение всегда пустое, и никто
 * этого не замечает, потому что ничего не падает. 11.08.2026 таких нашлось два, и оба
 * были настоящими дефектами:
 *   - `aevion_cyberchess_chessy_v1` — баланс раздела «Экономика»: аукционы и аренда не
 *     работали ни у кого и никогда;
 *   - `cc_display_name` — имя игрока: его читали задача дня и страница турнира, а писал
 *     никто. В таблице лидеров все выглядели как `Player_ab12cd`.
 *
 * Настоящее имя лежит под `cyberchess.displayName` — его пишет матчмейкинг, когда игрок
 * вводит имя перед входом в очередь.
 */

const DIR = join(__dirname, "..");

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "__tests__") out.push(...sources(p));
    } else if (/\.tsx?$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

const files = sources(DIR);
const all = files.map((f) => stripComments(readFileSync(f, "utf8"))).join("\n");

describe("имя игрока", () => {
  it("читается из того ключа, который кто-то пишет", () => {
    expect(all).toMatch(/setItem\("cyberchess\.displayName"/);
    expect(all).toMatch(/getItem\(["']cyberchess\.displayName["']\)/);
  });

  it("мёртвого близнеца больше нет", () => {
    /* Он не падал и не мешал — просто всегда отдавал пустую строку. Именно поэтому
       прожил незамеченным. */
    expect(all).not.toMatch(/cc_display_name/);
  });
});

describe("ключи, которые только читают", () => {
  /* Ключ пишут и через константу — `const FAV_KEY = "cc_fav_streamer_v1"` и дальше
     `setItem(FAV_KEY, …)`. Первая версия проверки видела только литералы и обвинила
     четыре живых ключа. Сторож, который кричит зря, хуже отсутствующего: его отключают,
     и вместе с шумом уходят настоящие находки. Поэтому имена констант разрешаем. */
  const constRx = /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*["']([^"']+)["']/g;
  const byName = new Map<string, string>();
  for (const m of all.matchAll(constRx)) byName.set(m[1], m[2]);

  const collect = (rx: RegExp): Set<string> => {
    const out = new Set<string>();
    for (const m of all.matchAll(rx)) {
      const raw = m[1];
      const key = raw.startsWith('"') || raw.startsWith("'") ? raw.slice(1, -1) : byName.get(raw);
      if (key) out.add(key);
    }
    return out;
  };

  const reads = collect(/getItem\(\s*(["'][^"']+["']|[A-Za-z_$][\w$]*)\s*\)/g);
  const writes = collect(/(?:setItem|removeItem)\(\s*(["'][^"']+["']|[A-Za-z_$][\w$]*)\s*[,)]/g);

  /* Ключи платформы (авторизация, кошелёк аккаунта) пишутся вне модуля шахмат —
     их отсутствие здесь законно и дефектом не является. */
  const OUTSIDE_MODULE = new Set([
    "aevion_auth_token_v1",
    "aevion_jwt",
    "aevion_token",
    "aevion_user_display_name",
    "aevion_platform_wallet_id",
    "aevion_debug",
  ]);

  it("список известных исключений не разросся молча", () => {
    const orphans = [...reads].filter((k) => !writes.has(k) && !OUTSIDE_MODULE.has(k));
    expect(
      orphans,
      `Эти ключи читают, но никто в модуле не пишет: ${orphans.join(", ")}. Либо ключ неверный (как cc_display_name), либо писателя забыли подключить. Если значение приходит извне модуля — добавь ключ в OUTSIDE_MODULE с объяснением.`,
    ).toEqual([]);
  });

  it("проверка вообще что-то видит — иначе она бесполезна", () => {
    expect(reads.size).toBeGreaterThan(20);
    expect(writes.size).toBeGreaterThan(20);
  });
});
