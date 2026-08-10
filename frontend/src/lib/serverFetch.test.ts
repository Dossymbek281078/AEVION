import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { serverFetch } from "./apiBase";

// serverFetch sits on the server-side path of every shared QVenture report (the
// share page's loadAnalysis and the OG card's fetchAnalysis), and its whole
// reason to exist is the retry branch — which the live check could not exercise
// because the backend was warm. These tests drive that branch directly by mocking
// global.fetch: a 404 must NOT retry, a 5xx and a thrown fetch MUST retry, and the
// backoff must not make the suite slow.

const res = (status: number): Response =>
  ({ status, ok: status >= 200 && status < 300, json: async () => ({}) }) as Response;

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  // Make backoff instant so retries don't add real delay to the suite.
  vi.stubGlobal("setTimeout", ((fn: () => void) => { fn(); return 0 as unknown; }) as typeof setTimeout);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("serverFetch — retry policy", () => {
  it("returns immediately on a 200 (one call, no retry)", async () => {
    fetchMock.mockResolvedValue(res(200));
    const r = await serverFetch("/api/qventure/analyses/x");
    expect(r?.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry a 404 — a missing report is a real answer", async () => {
    fetchMock.mockResolvedValue(res(404));
    const r = await serverFetch("/api/qventure/analyses/missing");
    expect(r?.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a 5xx up to the retry limit, then returns the last response", async () => {
    fetchMock.mockResolvedValue(res(503));
    const r = await serverFetch("/api/qventure/analyses/x", { retries: 2 });
    expect(r?.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("recovers when a cold 503 is followed by a 200", async () => {
    fetchMock
      .mockResolvedValueOnce(res(503))
      .mockResolvedValueOnce(res(200));
    const r = await serverFetch("/api/qventure/analyses/x", { retries: 2 });
    expect(r?.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries a thrown fetch (network/timeout) and returns null once exhausted", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const r = await serverFetch("/api/qventure/analyses/x", { retries: 2 });
    expect(r).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("recovers when a thrown fetch is followed by a success", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("cold start"))
      .mockResolvedValueOnce(res(200));
    const r = await serverFetch("/api/qventure/analyses/x", { retries: 2 });
    expect(r?.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("honours retries: 0 — a single attempt, no retry", async () => {
    fetchMock.mockResolvedValue(res(500));
    const r = await serverFetch("/api/qventure/analyses/x", { retries: 0 });
    expect(r?.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("passes an absolute URL and no-store to fetch", async () => {
    fetchMock.mockResolvedValue(res(200));
    await serverFetch("/api/qventure/health");
    const [url, init] = fetchMock.mock.calls[0];
    expect(typeof url).toBe("string");
    expect(url).toMatch(/\/api\/qventure\/health$/);
    expect((init as RequestInit).cache).toBe("no-store");
  });
});
