import { describe, it, expect } from "vitest";
import { buildTradesCsv, csvFilename, TRADES_CSV_HEADER } from "../csv";
import type { ClosedPosition } from "../marketSim";

const mk = (overrides: Partial<ClosedPosition> = {}): ClosedPosition => ({
  id: "abc",
  pair: "BTC/USD",
  side: "long",
  qty: 0.5,
  entryPrice: 100,
  entryTs: Date.UTC(2026, 3, 29, 10, 0, 0),
  exitPrice: 110,
  exitTs: Date.UTC(2026, 3, 29, 11, 0, 0),
  realizedPnl: 5,
  realizedPct: 10,
  ...overrides,
});

describe("csv · buildTradesCsv", () => {
  it("emits BOM + header on empty input", () => {
    const csv = buildTradesCsv([]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain(TRADES_CSV_HEADER.join(","));
  });

  it("includes all header columns in correct order", () => {
    expect(TRADES_CSV_HEADER).toEqual([
      "id", "pair", "side", "qty", "entryPrice", "exitPrice",
      "entryTs", "exitTs", "holdMs", "realizedPnl", "realizedPct",
      "tags", "notes",
    ]);
  });

  it("renders one row per trade with CRLF line endings", () => {
    const csv = buildTradesCsv([mk(), mk({ id: "xyz" })]);
    const stripped = csv.replace(/^﻿/, "");
    const lines = stripped.split("\r\n").filter(Boolean);
    expect(lines.length).toBe(3); // header + 2 rows
  });

  it("renders ISO 8601 entry/exit timestamps", () => {
    const csv = buildTradesCsv([mk()]);
    expect(csv).toContain("2026-04-29T10:00:00.000Z");
    expect(csv).toContain("2026-04-29T11:00:00.000Z");
  });

  it("computes holdMs = exitTs - entryTs", () => {
    const csv = buildTradesCsv([mk()]);
    // 1 hour = 3_600_000 ms
    expect(csv).toContain(",3600000,");
  });

  it("clamps negative holdMs to zero", () => {
    const csv = buildTradesCsv([mk({ entryTs: 1000, exitTs: 500 })]);
    expect(csv).toMatch(/,0,/);
  });

  it("quotes notes containing comma", () => {
    const csv = buildTradesCsv([mk({ notes: "breakout, volume confirm" })]);
    expect(csv).toContain('"breakout, volume confirm"');
  });

  it("escapes embedded quotes in notes", () => {
    const csv = buildTradesCsv([mk({ notes: 'said "buy"' })]);
    expect(csv).toContain('"said ""buy"""');
  });

  it("joins tags with space", () => {
    const csv = buildTradesCsv([mk({ tags: ["breakout", "trend"] })]);
    expect(csv).toContain("breakout trend");
  });

  it("renders empty cells for missing optional fields", () => {
    const csv = buildTradesCsv([mk({ tags: undefined, notes: undefined })]);
    const stripped = csv.replace(/^﻿/, "");
    const lines = stripped.split("\r\n");
    const dataRow = lines[1];
    expect(dataRow.endsWith(",,")).toBe(true); // empty tags + empty notes
  });
});

describe("csv · csvFilename", () => {
  it("includes the date stamp", () => {
    const ts = new Date(2026, 3, 29, 13, 45).getTime();
    const name = csvFilename(ts);
    expect(name).toMatch(/^qtrade-trades-20260429-13\d{2}\.csv$/);
  });

  it("ends with .csv", () => {
    expect(csvFilename()).toMatch(/\.csv$/);
  });
});
