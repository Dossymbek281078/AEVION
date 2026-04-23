import { describe, test, expect, beforeAll, beforeEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";

beforeAll(() => {
  process.env.SHARD_HMAC_SECRET = Buffer.from(
    "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
    "hex",
  ).toString("base64");
  process.env.QSIGN_SECRET = "test-qsign-secret-at-least-16-chars";
  process.env.ENABLE_DEMO_ENDPOINTS = "true";
});

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery }),
}));

import { pipelineRouter } from "../src/routes/pipeline";
import {
  generateEphemeralEd25519,
  splitAndAuthenticate,
  wipeBuffer,
} from "../src/lib/shamir/shield";

function makeApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use("/api/pipeline", pipelineRouter);
  return app;
}

function seedShield(shieldId: string): { publicKeySpkiHex: string; shards: ReturnType<typeof splitAndAuthenticate> } {
  const { privateKeyRaw, publicKeySpkiHex } = generateEphemeralEd25519();
  const shards = splitAndAuthenticate(privateKeyRaw, shieldId);
  wipeBuffer(privateKeyRaw);
  return { publicKeySpkiHex, shards };
}

beforeEach(() => {
  mockQuery.mockReset();
  // Default: ensureTables DDL returns rowCount 0
  mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
});

describe("POST /api/pipeline/reconstruct", () => {
  test("200 success with 2 valid shards from stored shield", async () => {
    const shieldId = "qs-" + crypto.randomBytes(4).toString("hex");
    const { publicKeySpkiHex, shards } = seedShield(shieldId);

    mockQuery.mockImplementation((sql: string) => {
      if (/FROM "QuantumShield" WHERE/.test(sql)) {
        return Promise.resolve({
          rows: [{ publicKey: publicKeySpkiHex, legacy: false }],
          rowCount: 1,
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(makeApp())
      .post("/api/pipeline/reconstruct")
      .send({
        shieldId,
        shards: [shards[0], shards[1]],
      });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.reconstructed).toBe(true);
    expect(res.body.shieldId).toBe(shieldId);
  });

  test("400 INVALID_HMAC when a shard is tampered", async () => {
    const shieldId = "qs-" + crypto.randomBytes(4).toString("hex");
    const { publicKeySpkiHex, shards } = seedShield(shieldId);

    mockQuery.mockImplementation((sql: string) => {
      if (/FROM "QuantumShield" WHERE/.test(sql)) {
        return Promise.resolve({
          rows: [{ publicKey: publicKeySpkiHex, legacy: false }],
          rowCount: 1,
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const tampered = {
      ...shards[0],
      hmac:
        shards[0].hmac.slice(0, -1) +
        (shards[0].hmac.slice(-1) === "0" ? "1" : "0"),
    };

    const res = await request(makeApp())
      .post("/api/pipeline/reconstruct")
      .send({
        shieldId,
        shards: [tampered, shards[1]],
      });

    expect(res.status).toBe(400);
    expect(res.body.valid).toBe(false);
    expect(res.body.reconstructed).toBe(false);
    expect(res.body.reason).toBe("INVALID_HMAC");
  });

  test("400 INSUFFICIENT_SHARDS when only 1 shard provided", async () => {
    const shieldId = "qs-" + crypto.randomBytes(4).toString("hex");
    const { shards } = seedShield(shieldId);

    const res = await request(makeApp())
      .post("/api/pipeline/reconstruct")
      .send({
        shieldId,
        shards: [shards[0]],
      });

    expect(res.status).toBe(400);
    expect(res.body.reason).toBe("INSUFFICIENT_SHARDS");
  });

  test("400 LEGACY_RECORD for shields flagged legacy=true", async () => {
    const shieldId = "qs-legacy-" + crypto.randomBytes(4).toString("hex");
    const { publicKeySpkiHex, shards } = seedShield(shieldId);

    mockQuery.mockImplementation((sql: string) => {
      if (/FROM "QuantumShield" WHERE/.test(sql)) {
        return Promise.resolve({
          rows: [{ publicKey: publicKeySpkiHex, legacy: true }],
          rowCount: 1,
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(makeApp())
      .post("/api/pipeline/reconstruct")
      .send({
        shieldId,
        shards: [shards[0], shards[1]],
      });

    expect(res.status).toBe(400);
    expect(res.body.reason).toBe("LEGACY_RECORD");
  });

  test("404 SHIELD_NOT_FOUND when shield id missing", async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (/FROM "QuantumShield" WHERE/.test(sql)) {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const { shards } = seedShield("qs-orig");
    const res = await request(makeApp())
      .post("/api/pipeline/reconstruct")
      .send({
        shieldId: "qs-does-not-exist",
        shards: [shards[0], shards[1]],
      });

    expect(res.status).toBe(404);
    expect(res.body.reason).toBe("SHIELD_NOT_FOUND");
  });

  test("400 INVALID_SHARD_FORMAT when body malformed", async () => {
    const res = await request(makeApp())
      .post("/api/pipeline/reconstruct")
      .send({ shards: [] });

    expect(res.status).toBe(400);
    expect(res.body.reason).toBe("INVALID_SHARD_FORMAT");
  });
});

describe("POST /api/pipeline/demo-generate + demo-reconstruct", () => {
  test("demo-generate returns 3 authenticated shards + public key, sets X-Demo header", async () => {
    const res = await request(makeApp())
      .post("/api/pipeline/demo-generate")
      .send({});

    expect(res.status).toBe(200);
    expect(res.headers["x-demo"]).toBe("true");
    expect(res.body.demo).toBe(true);
    expect(res.body.shards.length).toBe(3);
    expect(typeof res.body.publicKeySpkiHex).toBe("string");
  });

  test("demo-reconstruct succeeds with 2 shards from demo-generate output", async () => {
    const gen = await request(makeApp())
      .post("/api/pipeline/demo-generate")
      .send({});

    expect(gen.status).toBe(200);

    const res = await request(makeApp())
      .post("/api/pipeline/demo-reconstruct")
      .send({
        shieldId: gen.body.shieldId,
        publicKeySpkiHex: gen.body.publicKeySpkiHex,
        shards: [gen.body.shards[0], gen.body.shards[2]],
      });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.reconstructed).toBe(true);
  });

  test("demo endpoints return 404 when ENABLE_DEMO_ENDPOINTS=false", async () => {
    const original = process.env.ENABLE_DEMO_ENDPOINTS;
    process.env.ENABLE_DEMO_ENDPOINTS = "false";
    try {
      const res = await request(makeApp())
        .post("/api/pipeline/demo-generate")
        .send({});
      expect(res.status).toBe(404);
      expect(res.body.reason).toBe("DEMO_DISABLED");
    } finally {
      process.env.ENABLE_DEMO_ENDPOINTS = original;
    }
  });
});

