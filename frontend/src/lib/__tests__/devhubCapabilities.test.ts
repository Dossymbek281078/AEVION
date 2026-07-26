import { describe, it, expect } from "vitest";
import { indexCapabilities, isCapabilityBlocked, capabilityHint } from "../devhubCapabilities";

const LIVE_SHAPE = [
  { id: "railway", name: "Railway Deploy", status: "live", token: "RAILWAY_API_TOKEN" },
  { id: "vercel", name: "Vercel Deploy", status: "needs_token", token: "VERCEL_API_TOKEN" },
  { id: "pages", name: "Cloudflare Pages Deploy", status: "live", tokens: ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"] },
  { id: "video", name: "Video Generation", status: "needs_token", token: "REPLICATE_API_TOKEN" },
];

describe("devhubCapabilities", () => {
  it("indexes the live /studio/capabilities payload by id", () => {
    const idx = indexCapabilities(LIVE_SHAPE);
    expect(idx.vercel.status).toBe("needs_token");
    expect(Object.keys(idx)).toHaveLength(4);
    expect(indexCapabilities(null)).toEqual({});
    // Junk entries never become keys.
    expect(indexCapabilities([{ id: undefined } as never, { id: "ok" }])).toEqual({ ok: { id: "ok" } });
  });

  it("blocks only what the server explicitly reports as not live", () => {
    const idx = indexCapabilities(LIVE_SHAPE);
    expect(isCapabilityBlocked(idx, "vercel")).toBe(true);
    expect(isCapabilityBlocked(idx, "railway")).toBe(false);
    expect(isCapabilityBlocked(idx, "pages")).toBe(false);
  });

  it("fails open when capabilities are unknown or not loaded yet", () => {
    // A wrongly disabled button hides a working feature — worse than a 503.
    expect(isCapabilityBlocked(null, "vercel")).toBe(false);
    expect(isCapabilityBlocked({}, "vercel")).toBe(false);
    expect(isCapabilityBlocked(indexCapabilities([{ id: "vercel" }]), "vercel")).toBe(false);
  });

  it("names the exact env vars a blocked capability is waiting on", () => {
    const idx = indexCapabilities(LIVE_SHAPE);
    expect(capabilityHint(idx, "vercel", "Vercel deploy")).toBe(
      "Vercel deploy is not configured — set VERCEL_API_TOKEN on the server"
    );
    expect(capabilityHint(idx, "video", "Video generation")).toContain("REPLICATE_API_TOKEN");
    // Live capability keeps its plain label; unknown ones do too (fail open).
    expect(capabilityHint(idx, "railway", "Deploy to Railway")).toBe("Deploy to Railway");
    expect(capabilityHint(null, "vercel", "Vercel deploy")).toBe("Vercel deploy");
  });

  it("lists every token when a capability needs several", () => {
    const idx = indexCapabilities([
      { id: "domain", status: "needs_token", tokens: ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_ZONE_ID"] },
    ]);
    expect(capabilityHint(idx, "domain", "Custom domain")).toBe(
      "Custom domain is not configured — set CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_ZONE_ID on the server"
    );
  });
});
