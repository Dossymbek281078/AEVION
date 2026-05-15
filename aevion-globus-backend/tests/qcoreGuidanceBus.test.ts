import { describe, test, expect, beforeEach } from "vitest";
import { InMemoryGuidanceBus } from "../src/services/qcoreai/guidanceBus";

describe("InMemoryGuidanceBus", () => {
  let bus: InMemoryGuidanceBus;
  beforeEach(() => {
    bus = new InMemoryGuidanceBus();
  });

  test("kind is 'memory'", () => {
    expect(bus.kind).toBe("memory");
  });

  test("push returns false on unregistered run", () => {
    const result = bus.push("ghost-run", "hi");
    expect(result).toBe(false);
  });

  test("register + push + drain works in order", () => {
    bus.register("r1");
    expect(bus.push("r1", "first")).toBe(true);
    expect(bus.push("r1", "second")).toBe(true);
    const out = bus.drain("r1");
    expect(out).toEqual(["first", "second"]);
    // Drain clears the buffer.
    expect(bus.drain("r1")).toEqual([]);
  });

  test("drain on unregistered run returns empty array", () => {
    expect(bus.drain("never-registered")).toEqual([]);
  });

  test("unregister removes the buffer; subsequent push returns false", () => {
    bus.register("r2");
    bus.push("r2", "x");
    bus.unregister("r2");
    expect(bus.push("r2", "y")).toBe(false);
    expect(bus.drain("r2")).toEqual([]);
  });

  test("liveRuns reflects registered set", () => {
    bus.register("a");
    bus.register("b");
    expect(bus.liveRuns().sort()).toEqual(["a", "b"]);
    bus.unregister("a");
    expect(bus.liveRuns()).toEqual(["b"]);
  });

  test("isolation between runs", () => {
    bus.register("x");
    bus.register("y");
    bus.push("x", "for x");
    bus.push("y", "for y");
    expect(bus.drain("x")).toEqual(["for x"]);
    expect(bus.drain("y")).toEqual(["for y"]);
  });

  test("register is idempotent — does not clear existing buffer", () => {
    bus.register("r");
    bus.push("r", "kept");
    bus.register("r"); // second register
    expect(bus.drain("r")).toEqual(["kept"]);
  });
});
