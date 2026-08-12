import { describe, expect, it } from "vitest";
import { BuildApiError, buildErrorText } from "../api";

describe("buildErrorText", () => {
  it("translates codes a person can act on", () => {
    expect(buildErrorText(new BuildApiError(503, "video_not_configured"))).toContain(
      "Видеозвонки",
    );
    expect(buildErrorText(new BuildApiError(409, "already_checked_in"))).toBe(
      "Смена уже начата.",
    );
    expect(buildErrorText(new BuildApiError(400, "not_checked_in_yet"))).toBe(
      "Сначала отметьте начало смены.",
    );
  });

  it("makes an unmapped code legible instead of dumping snake_case", () => {
    expect(buildErrorText(new BuildApiError(500, "shift_checkin_failed"))).toBe(
      "Shift checkin failed",
    );
  });

  it("names a dropped connection as a connection problem", () => {
    // fetch() rejects with a plain TypeError, not a BuildApiError.
    expect(buildErrorText(new TypeError("Failed to fetch"))).toContain("связи");
  });

  it("never returns an empty string, whatever it is handed", () => {
    for (const value of [undefined, null, "", new Error(""), {}]) {
      expect(buildErrorText(value).length).toBeGreaterThan(0);
    }
  });

  it("passes through a already-human message untouched", () => {
    expect(buildErrorText(new Error("Слишком много попыток, подождите минуту"))).toBe(
      "Слишком много попыток, подождите минуту",
    );
  });
});
