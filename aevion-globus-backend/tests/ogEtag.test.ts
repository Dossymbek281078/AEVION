import { describe, it, expect } from "vitest";
import type { Request, Response } from "express";
import { applyOgEtag } from "../src/lib/ogEtag";

function fakeRes(): Response & { _headers: Record<string, string>; _status?: number; _ended?: boolean } {
  const headers: Record<string, string> = {};
  const res: any = {
    _headers: headers,
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    status(code: number) {
      this._status = code;
      return this;
    },
    end() {
      this._ended = true;
      return this;
    },
  };
  return res;
}

function fakeReq(ifNoneMatch?: string): Request {
  return { headers: ifNoneMatch ? { "if-none-match": ifNoneMatch } : {} } as Request;
}

describe("applyOgEtag", () => {
  it("sets weak ETag derived from fingerprint", () => {
    const req = fakeReq();
    const res = fakeRes();
    const sent304 = applyOgEtag(req, res, "abc-123");
    expect(sent304).toBe(false);
    expect(res._headers.ETag).toBe('W/"og-abc-123"');
  });

  it("sets default Cache-Control of public,max-age=300", () => {
    const req = fakeReq();
    const res = fakeRes();
    applyOgEtag(req, res, "fp");
    expect(res._headers["Cache-Control"]).toBe("public, max-age=300");
  });

  it("honours custom maxAgeSec", () => {
    const req = fakeReq();
    const res = fakeRes();
    applyOgEtag(req, res, "fp", 600);
    expect(res._headers["Cache-Control"]).toBe("public, max-age=600");
  });

  it("returns 304 when If-None-Match matches", () => {
    const fingerprint = "bureau-cert-x-1-verified-1700000000000";
    const etag = `W/"og-${fingerprint}"`;
    const req = fakeReq(etag);
    const res = fakeRes();
    const sent304 = applyOgEtag(req, res, fingerprint);
    expect(sent304).toBe(true);
    expect(res._status).toBe(304);
    expect(res._ended).toBe(true);
  });

  it("does not 304 when If-None-Match differs", () => {
    const req = fakeReq('W/"og-stale"');
    const res = fakeRes();
    const sent304 = applyOgEtag(req, res, "fresh");
    expect(sent304).toBe(false);
    expect(res._status).toBeUndefined();
  });

  it("fingerprint changes when underlying data changes (verifiedAt rotates)", () => {
    const req1 = fakeReq();
    const res1 = fakeRes();
    applyOgEtag(req1, res1, "bureau-cert-x-1-verified-1");
    const req2 = fakeReq();
    const res2 = fakeRes();
    applyOgEtag(req2, res2, "bureau-cert-x-1-verified-2");
    expect(res1._headers.ETag).not.toBe(res2._headers.ETag);
  });
});
