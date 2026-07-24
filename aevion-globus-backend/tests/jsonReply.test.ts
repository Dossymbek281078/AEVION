import { describe, test, expect } from "vitest";
import { extractJsonObject, salvageCompleteArrayObjects } from "../src/services/qcoreai/jsonReply";

describe("extractJsonObject", () => {
  test("raw object", () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });
  test("fenced with prose around it", () => {
    expect(extractJsonObject('Sure!\n```json\n{"a":1}\n```\nDone.')).toEqual({ a: 1 });
  });
  test("bare object buried in prose (first-{ to last-})", () => {
    expect(extractJsonObject('Here you go: {"a":{"b":2}} hope it helps')).toEqual({ a: { b: 2 } });
  });
  test("hopeless input → null, not a throw", () => {
    expect(extractJsonObject("no json here")).toBeNull();
    expect(extractJsonObject('{"unterminated": "str')).toBeNull();
  });
});

describe("salvageCompleteArrayObjects", () => {
  test("recovers complete objects from a truncated array and drops the tail", () => {
    const raw = '{"items":[{"id":1,"v":"a{b}c"},{"id":2,"v":"x\\"y"},{"id":3,"v":"cut off he';
    expect(salvageCompleteArrayObjects(raw, "items")).toEqual([
      { id: 1, v: "a{b}c" }, // braces inside strings don't fool the walker
      { id: 2, v: 'x"y' },   // escaped quotes don't either
    ]);
  });
  test("missing key → empty, never a throw", () => {
    expect(salvageCompleteArrayObjects('{"other":[]}', "items")).toEqual([]);
  });
});
