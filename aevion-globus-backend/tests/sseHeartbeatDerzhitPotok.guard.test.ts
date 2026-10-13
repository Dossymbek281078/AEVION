import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sseHeartbeat } from "../src/lib/sseHeartbeat";

/*
 * 🔴 13.10.2026: сборка гостя DevHub молчит в SSE 30–120 с (модель без потока), и поток рвётся
 * до результата. Пульс пишет комментарий раз в 15 с и останавливается по stop; поток
 * generate/stream обязан его ставить и снимать.
 */
describe("sseHeartbeat", () => {
  it("🔴 пишет «: hb» раз в 15 с и перестаёт после stop", () => {
    vi.useFakeTimers();
    const write = vi.fn();
    const stop = sseHeartbeat({ write } as never);
    vi.advanceTimersByTime(44_999);
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[0][0]).toBe(": hb\n\n");
    vi.advanceTimersByTime(1);
    expect(write).toHaveBeenCalledTimes(3);
    stop();
    vi.advanceTimersByTime(60_000);
    expect(write).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it("отказ записи (сокет закрыт) не роняет таймер", () => {
    vi.useFakeTimers();
    const write = vi.fn(() => { throw new Error("EPIPE"); });
    const stop = sseHeartbeat({ write } as never, 1000);
    expect(() => vi.advanceTimersByTime(3000)).not.toThrow();
    expect(write).toHaveBeenCalledTimes(3);
    stop();
    vi.useRealTimers();
  });

  it("🔴 generate/stream DevHub ставит пульс после flushHeaders и снимает его перед res.end", () => {
    const src = readFileSync(join(process.cwd(), "src/routes/devhub.ts"), "utf8");
    const i = src.indexOf('devhubRouter.post("/projects/:id/generate/stream"');
    expect(i).toBeGreaterThan(0);
    const тело = src.slice(i, src.indexOf("\n});", i));
    expect(тело).toContain("const стопПульса = sseHeartbeat(res);");
    expect(тело.indexOf("sseHeartbeat(res)")).toBeGreaterThan(тело.indexOf("res.flushHeaders()"));
    expect(тело.indexOf("стопПульса();")).toBeLessThan(тело.lastIndexOf("res.end();"));
    expect(тело.indexOf("стопПульса();")).toBeGreaterThan(0);
  });
});
