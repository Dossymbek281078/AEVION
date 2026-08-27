import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { qskywayRouter } from "../src/routes/qskyway";

/**
 * Список возможностей в /health плоский, а одна из них — городская.
 *
 * Замер 27.08.2026: сетку потолков высоты публикует только FAA, поэтому
 * `regulatory-airspace-ceilings` работает в Нью-Йорке и не работает в Астане и
 * Токио. Ниже в том же ответе `airspace.astana.available` честно отвечает
 * false — то есть два наших собственных поля спорили друг с другом, а верит
 * читатель короткому: списку.
 *
 * Граница живёт в ОТДЕЛЬНОМ поле `featureScope`, а не в самой строке пункта.
 * Первая версия дописывала города в скобках прямо в идентификатор — и ломала
 * собственный смоук, который проверяет точное равенство. Третий тест ниже
 * закрепляет именно это: идентификаторы обязаны остаться машинными.
 */

const app = express();
app.use(express.json());
app.use("/api/qskyway", qskywayRouter);

describe("возможности в /health: городское названо городским", () => {
  test("граница городской возможности названа, и названа верно", async () => {
    const res = await request(app).get("/api/qskyway/health");
    expect(res.status).toBe(200);

    const features: string[] = res.body.features;
    expect(features).toContain("regulatory-airspace-ceilings");

    const scope: string[] = res.body.featureScope?.["regulatory-airspace-ceilings"];
    expect(scope, "граница городской возможности не названа вовсе").toBeTruthy();

    // Города с фидом берём из того же ответа — единственный источник правды,
    // доступный снаружи.
    const airspace: Record<string, { available: boolean }> = res.body.airspace ?? {};
    const withFeed = Object.keys(airspace).filter((id) => airspace[id]?.available);
    const withoutFeed = Object.keys(airspace).filter((id) => !airspace[id]?.available);

    expect(withFeed.length, "нет ни одного города с фидом — проверять нечего").toBeGreaterThan(0);
    expect(withoutFeed.length, "фид есть у всех — сторож бессмыслен").toBeGreaterThan(0);

    // Обе стороны: город с фидом назван, город без фида НЕ назван. Без второй
    // половины «назвали города» выродилось бы в «перечислили всех подряд».
    for (const id of withFeed) expect(scope).toContain(id);
    for (const id of withoutFeed) expect(scope).not.toContain(id);
  });

  test("идентификаторы в списке остаются машинными — без скобок и пояснений", async () => {
    const res = await request(app).get("/api/qskyway/health");
    const features: string[] = res.body.features;
    expect(features).toHaveLength(7);
    for (const f of features) {
      expect(f, `пункт "${f}" перестал быть идентификатором`).toMatch(/^[a-z0-9-]+$/);
    }
  });

  test("смоук ищет пункт точным равенством — значит формат ломать нельзя", () => {
    // Отрицательный контроль к предыдущему тесту, и он про НАСТОЯЩЕГО
    // потребителя, а не про наше представление о нём. scripts/qskyway-smoke.js
    // делает features.includes("regulatory-airspace-ceilings") и при несовпадении
    // печатает «сборка СТАРАЯ» — то есть уводит от настоящей причины. Если
    // однажды смоук перестанет так проверять, этот тест сам скажет, что охрана
    // формата больше не нужна.
    const smoke = readFileSync(join(__dirname, "..", "scripts", "qskyway-smoke.js"), "utf8");
    expect(
      smoke.includes('includes("regulatory-airspace-ceilings")'),
      "смоук больше не сверяет пункт точным равенством — проверьте, нужна ли ещё охрана формата",
    ).toBe(true);
  });
});
