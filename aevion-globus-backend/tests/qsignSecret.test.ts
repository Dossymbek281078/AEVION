import { describe, test, expect, beforeEach } from "vitest";
import { __resetConfigCache, getQSignSecret } from "../src/config/qright";
import { QRightError } from "../src/lib/errors/QRightError";

describe("getQSignSecret()", () => {
  beforeEach(() => {
    __resetConfigCache();
  });

  test("throws MISSING_QSIGN_SECRET when env is unset", () => {
    const prev = process.env.QSIGN_SECRET;
    delete process.env.QSIGN_SECRET;
    try {
      expect(() => getQSignSecret()).toThrow(QRightError);
      try {
        getQSignSecret();
      } catch (err) {
        expect(err).toBeInstanceOf(QRightError);
        expect((err as QRightError).code).toBe("MISSING_QSIGN_SECRET");
      }
    } finally {
      if (prev !== undefined) process.env.QSIGN_SECRET = prev;
    }
  });

  test("throws when secret is shorter than 16 chars", () => {
    const prev = process.env.QSIGN_SECRET;
    process.env.QSIGN_SECRET = "short";
    try {
      expect(() => getQSignSecret()).toThrow(QRightError);
    } finally {
      if (prev !== undefined) process.env.QSIGN_SECRET = prev;
      else delete process.env.QSIGN_SECRET;
    }
  });

  test("returns the value when env is set to a valid secret", () => {
    const prev = process.env.QSIGN_SECRET;
    process.env.QSIGN_SECRET = "valid-qsign-secret-value-0123";
    try {
      expect(getQSignSecret()).toBe("valid-qsign-secret-value-0123");
    } finally {
      if (prev !== undefined) process.env.QSIGN_SECRET = prev;
      else delete process.env.QSIGN_SECRET;
    }
  });
});
