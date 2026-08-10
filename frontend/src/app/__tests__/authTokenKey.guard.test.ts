import { describe, it, expect } from "vitest";
import { readdirSync, statSync, readFileSync } from "node:fs";
import path from "node:path";
import BASELINE from "./authTokenKey.baseline.json";

/**
 * Токен авторизации берётся через хелпер, а не читается из localStorage.
 *
 * Поломка 10.08.2026: 87 файлов достают токен напрямую, и в 59 из них в
 * цепочке НЕТ имени, которое пишет вход (`aevion_auth_token_v1`) — там
 * читается только `aevion_token` или `aevion_jwt`. Эти имена не пишет ни
 * одна строка боевого кода. Единственная запись `aevion_token` во всём
 * репозитории нашлась в e2e-тесте `qpaynet-admin-smoke.spec.ts`, который сам
 * кладёт токен в хранилище перед проверкой: набор был зелёным ровно потому,
 * что готовил состояние, которого приложение не создаёт никогда.
 *
 * Последствие на проде: залогиненный пользователь обращался к QCoreAI,
 * QContract, QChainGov, QMaskCard, QEvents, QMedia и другим модулям как
 * аноним. Проверено запросами: /api/qcoreai/me/audit-log без токена → 401,
 * /api/healthai/profiles/me → 402, то есть платящему подписчику предлагали
 * оформить подписку.
 *
 * ПОЧЕМУ ЭТО СТОРОЖ-ХРАПОВИК, А НЕ ЗАПРЕТ
 * Правка 87 файлов сразу — это конфликты с полудюжиной параллельных сессий.
 * Сторож, требующий миграции, которой ещё не было, красит main в красный, а
 * такого сторожа через неделю отключают (feedback_baseline_guard_must_not_redden_main).
 * Поэтому текущее состояние заморожено списком, и проверяется одно: список
 * НЕ РАСТЁТ. Починки приветствуются — тест на них не краснеет, а просит
 * вычеркнуть файл, чтобы он не смог вернуться.
 *
 * Совместимость до миграции держится зеркалированием в src/lib/auth.ts:
 * владелец токена пишет и псевдонимы, поэтому читатели видят значение.
 */

const SRC = path.resolve(__dirname, "../..");
const BASELINE_FILE = "src/app/__tests__/authTokenKey.baseline.json";

/** Места, которые ВЛАДЕЮТ токеном и обязаны трогать хранилище напрямую. */
const OWNERS = [
  "lib/auth.ts",
  "lib/build/auth.ts", // своя авторизация модуля build (zustand persist)
  "__tests__",
];

/**
 * Чтение хранилища по ключу, похожему на токен.
 *
 * Намеренно узко: `token`/`jwt`/`auth` в ИМЕНИ КЛЮЧА. Ключи вида
 * `aevion_chess_theme_v1` сюда не попадают — сторож, ловящий половину
 * приложения, отключают вместе с пользой.
 */
const READS_TOKEN_KEY =
  /(?:localStorage|sessionStorage)\.getItem\(\s*["'`][^"'`]*(?:token|jwt|auth)[^"'`]*["'`]/i;

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) {
      if (e === "node_modules") continue;
      walk(p, acc);
    } else if (/\.tsx?$/.test(e)) acc.push(p);
  }
  return acc;
}

function offenders(): string[] {
  const found: string[] = [];
  for (const f of walk(SRC)) {
    const rel = path.relative(SRC, f).replace(/\\/g, "/");
    if (OWNERS.some((o) => rel.includes(o))) continue;
    const lines = readFileSync(f, "utf8").split("\n");
    const hit = lines.some((l) => {
      const t = l.trim();
      if (t.startsWith("//") || t.startsWith("*")) return false;
      return READS_TOKEN_KEY.test(l);
    });
    if (hit) found.push(rel);
  }
  return found.sort();
}

describe("авторизация — прямое чтение токена не разрастается", () => {
  it("набор файлов непустой (сторож не должен молча проверять ноль)", () => {
    expect(walk(SRC).length).toBeGreaterThan(200);
  });

  it("новых мест с прямым чтением токена не появилось", () => {
    const now = offenders();
    const frozen = new Set(BASELINE as string[]);
    const added = now.filter((f) => !frozen.has(f));
    expect(
      added.join("\n"),
      `Новый файл достаёт токен из хранилища напрямую. Возьми его через ` +
        `getAuthToken() / getAuthHeaders() из @/lib/auth (для модуля build — ` +
        `getAuthToken() из @/lib/build/auth). Имена ключей уже расходились, и ` +
        `каждый раз молча: заголовок уходил пустым, а пользователь выглядел анонимом.`,
    ).toBe("");
  }, 30_000);

  it("исправленные файлы вычеркнуты из списка (чтобы не смогли вернуться)", () => {
    const now = new Set(offenders());
    const stale = (BASELINE as string[]).filter((f) => !now.has(f));
    expect(
      stale.join("\n"),
      `Эти файлы больше не читают токен напрямую — удали их из ${BASELINE_FILE}. ` +
        `Пока они в списке, туда же можно вернуть прямое чтение, и сторож промолчит.`,
    ).toEqual([].join("\n"));
  }, 30_000);

  it("сторож действительно отличает токен от прочих ключей", () => {
    expect(READS_TOKEN_KEY.test(`localStorage.getItem("some_auth_token")`)).toBe(true);
    expect(READS_TOKEN_KEY.test(`localStorage.getItem("aevion_chess_theme_v1")`)).toBe(false);
  });
});
