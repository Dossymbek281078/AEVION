import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tq } from "../qrightI18n";

/**
 * 20.10.2026, окно «Приложения», задача 2 по слову оркестратора. Замер на проде 10:15:
 * после регистрации (201) экран «готово» показывал сертификат, но ссылки на публичную
 * страницу /qright/object/<id> на нём не было — только в списке реестра ниже; человек
 * не знал, чем делиться. Плюс две фразы под заголовком были английскими при ru.
 */
const PAGE = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

describe("экран «готово» QRight ведёт на публичную страницу записи", () => {
  test("ссылка стоит в блоке done и берёт id записи", () => {
    const i = PAGE.indexOf('{step === "done" && result && (');
    expect(i).toBeGreaterThan(0);
    const done = PAGE.slice(i, i + 4000);
    expect(done).toContain("data-qright-public-link");
    expect(done).toContain("href={`/qright/object/${encodeURIComponent(result.qright.id)}`}");
    expect(done).toContain('tq(lang, "Open the public page of this record →")');
  });

  test("фразы экрана «готово» идут через словарь и переведены", () => {
    for (const en of ["Open the public page of this record →", "Four cryptographic layers active — including a co-signature only you can produce.", "Three cryptographic layers active — content hash, HMAC, and Shamir-split Ed25519."]) {
      expect(PAGE, en).toContain(`tq(lang, ${JSON.stringify(en)})`);
      expect(tq("ru", en), en).not.toBe(en);
      expect(tq("en", en)).toBe(en);
    }
  });
});
