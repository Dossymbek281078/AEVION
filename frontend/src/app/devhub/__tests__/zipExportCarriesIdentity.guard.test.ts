import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 4.11.2026, замер Ниш на проде (гость, 2 из 2): «ZIP ⬇» открывал
 * /api/devhub/projects/<id>/export через window.open — без гостевого заголовка
 * и токена, ответ {"error":"project not found"}. Экспорт обязан идти через
 * fetch (обёртка кладёт личность) и отдавать файл.
 */
const page = readFileSync(join(__dirname, "..", "[id]", "page.tsx"), "utf8");

describe("ZIP-экспорт DevHub несёт личность гостя", () => {
  it("нет window.open на экспорт; есть fetch + download", () => {
    expect(page).not.toMatch(/window\.open\(apiUrl\(`\/api\/devhub\/projects\/\$\{project\.id\}\/export`/);
    expect(page).toMatch(/fetch\(apiUrl\(`\/api\/devhub\/projects\/\$\{projectId\}\/export`\)\)/);
    expect(page).toMatch(/a\.download = /);
    expect(page).toMatch(/скачатьZip\(project\.id, project\.name\)/);
  });
  it("отказ не молчит", () => {
    const fn = page.slice(page.indexOf("async function скачатьZip"), page.indexOf("export default function"));
    expect(fn).toMatch(/if \(!r\.ok\)/);
    expect(fn).toMatch(/alert\(/);
  });
});
