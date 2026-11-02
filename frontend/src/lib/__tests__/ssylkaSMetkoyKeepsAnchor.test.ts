import { describe, expect, test } from "vitest";
import { ссылкаСМеткой } from "../useKeepChannelHref";

describe("ссылкаСМеткой: метка перед якорем", () => {
  test("метка письма доносится и якорь остаётся последним", () => {
    const href = ссылкаСМеткой("/qright#protect-form", "mail-outreach", "mail-pb376");
    expect(href).toContain("c=mail-pb376");
    expect(href.endsWith("#protect-form")).toBe(true);
    expect(href.indexOf("?")).toBeLessThan(href.indexOf("#"));
  });
  test("без метки — голый путь с якорем", () => {
    expect(ссылкаСМеткой("/qright#protect-form", null, null)).toBe("/qright#protect-form");
  });
});
