import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";

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
 * Здесь закрепляется, что городской пункт называет города прямо в строке.
 * Проверяется обе стороны, иначе сторож не отличить от сломанного:
 *  1) город С фидом в строке назван;
 *  2) город БЕЗ фида в ней НЕ назван — иначе «назвали города» выродилось бы в
 *     «перечислили все».
 */

const app = express();
app.use(express.json());
app.use("/api/qskyway", qskywayRouter);

describe("возможности в /health: городское названо городским", () => {
  test("пункт про потолки регулятора называет города, а не молчит о границе", async () => {
    const res = await request(app).get("/api/qskyway/health");
    expect(res.status).toBe(200);

    const features: string[] = res.body.features;
    const ceilings = features.find((f) => f.startsWith("regulatory-airspace-ceilings"));
    expect(ceilings, "пункт про потолки регулятора исчез из списка").toBeTruthy();

    // Города, у которых фид регулятора ЕСТЬ, берём из того же ответа — это
    // единственный источник правды, доступный снаружи.
    const airspace: Record<string, { available: boolean }> = res.body.airspace ?? {};
    const withFeed = Object.keys(airspace).filter((id) => airspace[id]?.available);
    const withoutFeed = Object.keys(airspace).filter((id) => !airspace[id]?.available);

    expect(withFeed.length, "нет ни одного города с фидом — проверять нечего").toBeGreaterThan(0);
    expect(withoutFeed.length, "фид есть у всех — сторож бессмыслен, но и вреда нет").toBeGreaterThan(0);

    for (const id of withFeed) {
      expect(ceilings, `город ${id} имеет фид регулятора, но в строке не назван`).toContain(id);
    }
    for (const id of withoutFeed) {
      expect(ceilings, `город ${id} фида НЕ имеет, но назван — список перечислил всех подряд`).not.toContain(id);
    }
  });

  test("остальные шесть пунктов платформенные и городов не называют", async () => {
    const res = await request(app).get("/api/qskyway/health");
    const features: string[] = res.body.features;
    const plain = features.filter((f) => !f.startsWith("regulatory-airspace-ceilings"));
    expect(plain).toHaveLength(6);
    // Скобка со списком городов — признак городской возможности. Если она
    // появится у платформенной, значит граница поехала и это надо заметить.
    for (const f of plain) expect(f).not.toContain("(");
  });
});
