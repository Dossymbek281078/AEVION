import { describe, it, expect } from "vitest";
import type { Request } from "express";
import { resolveGeo, extractClientIp } from "../src/lib/qsignV2/geo";

/** Stub minimal Express request for testing geo helpers without lifting an HTTP server. */
function fakeReq(opts: {
  xff?: string;
  remoteAddress?: string;
} = {}): Request {
  return {
    headers: opts.xff !== undefined ? { "x-forwarded-for": opts.xff } : {},
    socket: opts.remoteAddress ? { remoteAddress: opts.remoteAddress } : ({} as any),
  } as unknown as Request;
}

describe("qsignV2 geo helpers", () => {
  describe("extractClientIp", () => {
    it("prefers first X-Forwarded-For when multiple comma-separated", () => {
      expect(extractClientIp(fakeReq({ xff: "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
    });
    it("falls back to socket.remoteAddress", () => {
      expect(extractClientIp(fakeReq({ remoteAddress: "203.0.113.7" }))).toBe("203.0.113.7");
    });
    it("returns null when nothing is available", () => {
      expect(extractClientIp(fakeReq())).toBeNull();
    });
  });

  describe("resolveGeo", () => {
    it("GPS takes priority over IP for lat/lng", () => {
      const out = resolveGeo({ lat: 43.238949, lng: 76.889709 }, fakeReq({ remoteAddress: "8.8.8.8" }));
      expect(out.source).toBe("gps");
      expect(out.lat).toBeCloseTo(43.238949);
      expect(out.lng).toBeCloseTo(76.889709);
    });

    it("rejects out-of-range GPS, falls back to IP", () => {
      const out = resolveGeo({ lat: 999, lng: 999 }, fakeReq({ remoteAddress: "8.8.8.8" }));
      expect(out.source === "ip" || out.source === null).toBeTruthy();
    });

    it("rejects non-numeric GPS values", () => {
      const out = resolveGeo({ lat: "abc", lng: "def" }, fakeReq());
      expect(out.source).toBeNull();
    });

    it("treats private/loopback IPs as no-IP-geo", () => {
      const out = resolveGeo(undefined, fakeReq({ remoteAddress: "127.0.0.1" }));
      expect(out.source).toBeNull();
      expect(out.country).toBeNull();
    });

    it("treats 10/8 and 192.168/16 as private", () => {
      expect(resolveGeo(undefined, fakeReq({ remoteAddress: "10.0.0.1" })).source).toBeNull();
      expect(resolveGeo(undefined, fakeReq({ remoteAddress: "192.168.1.1" })).source).toBeNull();
    });

    it("strips IPv4-in-IPv6 prefix before lookup", () => {
      // ::ffff:127.0.0.1 → 127.0.0.1 → private → null
      expect(resolveGeo(undefined, fakeReq({ remoteAddress: "::ffff:127.0.0.1" })).source).toBeNull();
    });

    it("returns null geo when no IP and no GPS", () => {
      const out = resolveGeo(undefined, fakeReq());
      expect(out).toEqual({ source: null, country: null, city: null, lat: null, lng: null });
    });

    it("with valid GPS even when IP missing", () => {
      const out = resolveGeo({ lat: 1, lng: 2 }, fakeReq());
      expect(out.source).toBe("gps");
      expect(out.lat).toBe(1);
      expect(out.lng).toBe(2);
    });
  });
});
