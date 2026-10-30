/**
 * 30.10.2026: значок «Сделано в AEVION» ведёт на /badge?c=badge&s=<id сайта>; короткий вход обязан донести s
 * до /devhub, чтобы page_view видел, с какого сайта гостя пришёл человек. Небезопасное значение отбрасывается.
 */
import { describe, expect, it } from "vitest";

import { хвостПерехода } from "../shortEntry";

describe("хвостПерехода несёт s (id сайта гостя DevHub)", () => {
  it("несёт s рядом с меткой", () => {
    expect(хвостПерехода({ c: "badge", s: "probe-produkt" })).toContain("&s=probe-produkt");
  });
  it("отбрасывает небезопасное значение", () => {
    expect(хвостПерехода({ s: "<script>" })).not.toContain("s=");
  });
  it("несёт uuid целиком", () => {
    const id = "f09d41f3-096e-457f-afc5-b5ad79b96c9e";
    expect(хвостПерехода({ s: id })).toContain(`s=${id}`);
  });
});
