import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Адрес репозитория должен жить в одном месте — `lib/repoUrl.ts`.
 *
 * 27.07.2026 аккаунт GitHub заблокировали, и все ссылки на репозиторий разом
 * стали отдавать 404 — включая ту, что стоит на странице для инвестора рядом со
 * словами «verifiable in public GitHub history». Переключить их на зеркало
 * одним движением было нельзя: адрес был вписан руками в 21 файл, тридцатью
 * вхождениями.
 *
 * Сторож не даёт вернуть россыпь: в `src/app` не должно быть ни одного
 * захардкоженного адреса.
 */

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OWNER = "Dossymbek281078";

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "__tests__") continue;
      out.push(...walk(p));
    } else if (/\.(ts|tsx)$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

const files = walk(SRC);

describe("адрес репозитория — только через lib/repoUrl", () => {
  it("файлы вообще нашлись", () => {
    // контроль инструмента: на пустом списке проверка ниже пройдёт всегда
    expect(files.length).toBeGreaterThan(200);
  });

  it("захардкоженного адреса нет нигде, кроме самого lib/repoUrl.ts", () => {
    const offenders = files
      .filter((f) => readFileSync(f, "utf8").includes(OWNER))
      .map((f) => f.split(sep).join("/"))
      .filter((f) => !f.endsWith("/lib/repoUrl.ts"));

    expect(offenders, `адрес вписан руками: ${offenders.join(", ")}`).toEqual([]);
  });

  it("сам модуль отдаёт адрес и умеет строить путь", async () => {
    const { repoUrl, repoPath, repoLabel } = await import("@/lib/repoUrl");
    expect(repoUrl()).toMatch(/^https?:\/\//);
    expect(repoUrl().endsWith("/")).toBe(false);
    expect(repoPath("issues")).toBe(`${repoUrl()}/issues`);
    expect(repoPath("/issues")).toBe(`${repoUrl()}/issues`);
    expect(repoPath("")).toBe(repoUrl());
    expect(repoLabel().startsWith("http")).toBe(false);
  });
});
