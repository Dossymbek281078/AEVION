import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { FINISH_PRESETS, materialById } from "./materials";

describe("готовые сочетания отделки", () => {
  it("три сочетания с теми же названиями, что в 3D-странице LA VIE", () => {
    expect(FINISH_PRESETS.map((p) => p.name)).toEqual(["Светлый дуб", "Тёплый орех", "Графит и бетон"]);
  });

  it("каждое сочетание ссылается на существующие материалы нужной поверхности", () => {
    for (const p of FINISH_PRESETS) {
      const пол = materialById(p.floor);
      const стена = materialById(p.wall);
      expect(пол, `пол ${p.floor} у «${p.name}»`).toBeDefined();
      expect(стена, `стена ${p.wall} у «${p.name}»`).toBeDefined();
      expect(пол!.surface).toBe("floor");
      expect(стена!.surface).toBe("wall");
    }
  });

  it("сочетания различаются полом — иначе три кнопки дают одно и то же", () => {
    expect(new Set(FINISH_PRESETS.map((p) => p.floor)).size).toBe(FINISH_PRESETS.length);
  });

  it("кнопки сочетаний есть на странице и ставят ОБА материала", () => {
    const src = readFileSync(path.join(__dirname, "_client.tsx"), "utf8");
    expect(src).toContain('aria-label="Готовые сочетания отделки"');
    expect(src).toContain("setWallMatId(p.wall); setFloorMatId(p.floor);");
  });
});
