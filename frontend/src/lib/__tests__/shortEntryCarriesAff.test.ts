import { describe, it, expect } from "vitest";
import { хвостПерехода } from "@/lib/shortEntry";

describe("короткий вход несёт партнёрский id Lemon Squeezy", () => {
  it("aff доезжает", () => {
    expect(хвостПерехода({ aff: "probe" })).toContain("&aff=probe");
  });
  it("небезопасное значение aff отбрасывается", () => {
    expect(хвостПерехода({ aff: "a&b=c" })).not.toContain("aff=");
  });
});
