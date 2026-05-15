import { describe, test, expect } from "vitest";
import { canonicalContentHash } from "../src/lib/contentHash";

describe("canonicalContentHash", () => {
  test("is key-order independent", () => {
    const a = canonicalContentHash({
      title: "My Song",
      description: "desc",
      kind: "music",
      country: "KZ",
      city: "Almaty",
    });
    const b = canonicalContentHash({
      city: "Almaty",
      country: "KZ",
      kind: "music",
      description: "desc",
      title: "My Song",
    });
    expect(a).toBe(b);
  });

  test("treats undefined and null country/city as equivalent", () => {
    const a = canonicalContentHash({
      title: "t",
      description: "d",
      kind: "other",
      country: undefined,
      city: undefined,
    });
    const b = canonicalContentHash({
      title: "t",
      description: "d",
      kind: "other",
      country: null,
      city: null,
    });
    expect(a).toBe(b);
  });

  test("NFC-normalizes Unicode so NFC and NFD variants hash identically", () => {
    // "é" NFC (U+00E9) vs NFD ("e" + U+0301)
    const nfc = canonicalContentHash({
      title: "Café",
      description: "d",
      kind: "other",
    });
    const nfd = canonicalContentHash({
      title: "Café",
      description: "d",
      kind: "other",
    });
    expect(nfc).toBe(nfd);
  });

  test("different content produces different hash", () => {
    const a = canonicalContentHash({
      title: "A",
      description: "d",
      kind: "other",
    });
    const b = canonicalContentHash({
      title: "B",
      description: "d",
      kind: "other",
    });
    expect(a).not.toBe(b);
  });
});
