import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { capabilityLabel } from "../devhubCapabilities";

// 29.10.2026, прод f4a0c073a: /en/devhub — «temporarily unavailable: Выкатка на Railway» (имя с сервера).
describe("имя недоступного канала DevHub — на языке страницы", () => {
  it("en/kk из словаря, ru — русское, незнакомый id — имя с сервера", () => {
    expect(capabilityLabel("railway", "Выкатка на Railway", "en")).toBe("Railway deploy");
    expect(capabilityLabel("railway", "Выкатка на Railway", "kk")).toBe("Railway-ге жариялау");
    expect(capabilityLabel("railway", "x", "ru")).toBe("Выкатка на Railway");
    expect(capabilityLabel("novoe", "Новое", "en")).toBe("Новое");
  });
  it("список «временно недоступно» в page.tsx берёт имя через capabilityLabel, а не c.name", () => {
    const src = readFileSync(join(process.cwd(), "src/app/devhub/page.tsx"), "utf8");
    expect(src).toContain("{capabilityLabel(c.id, c.name, lang)}</span>");
    expect(src).not.toContain('cursor: "help" }}>{c.name}</span>');
  });
});
