import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Замер на проде 18.09.2026: у /qspace не было ни кнопки «купить», ни цены, ни
 * формы заявки — единственный модуль, у которого человек с готовым результатом
 * не мог оставить ни денег, ни контакта. Сторож держит хотя бы один путь:
 * форму листа ожидания с источником «qspace» (по нему заявки видны в выгрузке).
 */
describe("/qspace: у страницы есть путь к деньгам или к заявке", () => {
  const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
  it("рендерит WaitlistCapture с источником qspace", () => {
    expect(src).toMatch(/<WaitlistCapture[\s\S]*?source="qspace"/);
    expect(src).toMatch(/buttonLabel="[^"]+"/);
  });
});
