/**
 * QSign v2 — OpenAPI 3.0 spec.
 * Served at GET /api/qsign/v2/openapi.json. Importable into Postman,
 * Stoplight, or any client SDK generator. Update this whenever endpoint
 * shape changes — the smoke test asserts shape, this asserts contract.
 */

export const QSIGN_V2_OPENAPI = {
  openapi: "3.0.3",
  info: {
    title: "AEVION QSign v2",
    version: "2.0.0",
    description:
      "Tamper-evident JSON signature platform: RFC 8785 canonicalization, " +
      "HMAC-SHA256 + Ed25519 hybrid + post-quantum-ready Dilithium preview slot, " +
      "key rotation with overlap, revocation ledger, geo-anchoring, audit log, " +
      "webhooks, and PDF stamps. Independent of legacy /api/qsign/* (v1).",
    contact: { name: "AEVION", url: "https://aevion.com" },
    license: { name: "Proprietary" },
  },
  servers: [
    { url: "https://aevion-production-a70c.up.railway.app/api/qsign/v2", description: "Production" },
    { url: "http://127.0.0.1:4001/api/qsign/v2", description: "Local dev" },
  ],
  tags: [
    { name: "health", description: "Liveness + readiness" },
    { name: "metrics", description: "Public aggregate metrics" },
    { name: "sign", description: "Create and verify signatures" },
    { name: "keys", description: "Key registry and rotation" },
    { name: "revoke", description: "Revocation ledger" },
    { name: "audit", description: "Per-user event log" },
    { name: "webhooks", description: "Event delivery callbacks" },
  ],
  components: {
    securitySchemes: {
      BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
          details: { type: "string" },
          requestId: { type: "string" },
        },
        required: ["error"],
      },
      DilithiumPreview: {
        type: "object",
        properties: {
          algo: { type: "string", enum: ["ML-DSA-65"] },
          kid: { type: "string" },
          mode: { type: "string", enum: ["preview"] },
          digest: { type: "string", description: "SHA-512 fingerprint of canonical||kid (NOT a real PQ signature)" },
          valid: { type: "boolean", nullable: true },
          note: { type: "string" },
        },
      },
      SignRequest: {
        type: "object",
        properties: {
          payload: { type: "object", description: "Any JSON object/array — canonicalized via RFC 8785" },
          gps: {
            type: "object",
            description: "Optional client GPS; takes priority over IP geo",
            properties: { lat: { type: "number" }, lng: { type: "number" } },
            required: ["lat", "lng"],
          },
        },
        required: ["payload"],
      },
      SignResponse: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          algoVersion: { type: "string" },
          canonicalization: { type: "string" },
          payloadHash: { type: "string" },
          payloadCanonical: { type: "string" },
          hmac: {
            type: "object",
            properties: {
              kid: { type: "string" },
              algo: { type: "string", enum: ["HMAC-SHA256"] },
              signature: { type: "string", description: "Lowercase hex" },
            },
          },
          ed25519: {
            type: "object",
            properties: {
              kid: { type: "string" },
              algo: { type: "string", enum: ["Ed25519"] },
              signature: { type: "string" },
              publicKey: { type: "string" },
            },
          },
          dilithium: { $ref: "#/components/schemas/DilithiumPreview" },
          issuer: {
            type: "object",
            properties: {
              userId: { type: "string", nullable: true },
              email: { type: "string", nullable: true },
            },
          },
          geo: {
            type: "object",
            nullable: true,
            properties: {
              source: { type: "string", enum: ["ip", "gps"], nullable: true },
              country: { type: "string", nullable: true },
              city: { type: "string", nullable: true },
              lat: { type: "number", nullable: true },
              lng: { type: "number", nullable: true },
            },
          },
          createdAt: { type: "string", format: "date-time" },
          verifyUrl: { type: "string" },
          publicUrl: { type: "string" },
        },
      },
      VerifyResponse: {
        type: "object",
        properties: {
          valid: { type: "boolean" },
          algoVersion: { type: "string" },
          canonicalization: { type: "string" },
          payloadHash: { type: "string" },
          hmac: { type: "object", properties: { kid: { type: "string" }, valid: { type: "boolean" } } },
          ed25519: {
            type: "object",
            properties: {
              kid: { type: "string", nullable: true },
              valid: { type: "boolean", nullable: true },
            },
          },
          dilithium: { allOf: [{ $ref: "#/components/schemas/DilithiumPreview" }], nullable: true },
          stateless: { type: "boolean" },
        },
      },
      Webhook: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          url: { type: "string", format: "uri" },
          events: { type: "array", items: { type: "string", enum: ["sign", "revoke"] } },
          active: { type: "boolean" },
          createdAt: { type: "string", format: "date-time", nullable: true },
          lastFiredAt: { type: "string", format: "date-time", nullable: true },
          lastStatus: { type: "integer", nullable: true },
          lastError: { type: "string", nullable: true },
        },
      },
      WebhookDelivery: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          event: { type: "string", enum: ["sign", "revoke"] },
          attempt: { type: "integer", minimum: 1, maximum: 3 },
          httpStatus: { type: "integer", nullable: true },
          error: { type: "string", nullable: true },
          durationMs: { type: "integer" },
          succeeded: { type: "boolean" },
          createdAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      AuditEvent: {
        type: "object",
        properties: {
          event: { type: "string", enum: ["sign", "revoke"] },
          signatureId: { type: "string" },
          revocationId: { type: "string", nullable: true },
          at: { type: "string", format: "date-time", nullable: true },
          hmacKid: { type: "string" },
          ed25519Kid: { type: "string", nullable: true },
          payloadHash: { type: "string" },
          country: { type: "string", nullable: true },
          reason: { type: "string", nullable: true },
          causalSignatureId: { type: "string", nullable: true },
          revokerUserId: { type: "string", nullable: true },
          publicUrl: { type: "string" },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["health"],
        summary: "Liveness + readiness probe",
        description:
          "200 with full payload when DB + active keys reachable; 503 with `status='degraded'` and per-component breakdown otherwise.",
        responses: {
          "200": { description: "OK" },
          "503": { description: "Degraded — DB unreachable or keys unresolved" },
        },
      },
    },
    "/openapi.json": {
      get: {
        tags: ["health"],
        summary: "This OpenAPI 3.0 spec",
        responses: { "200": { description: "OK" } },
      },
    },
    "/stats": {
      get: {
        tags: ["metrics"],
        summary: "Public aggregate metrics",
        responses: { "200": { description: "OK" } },
      },
    },
    "/recent": {
      get: {
        tags: ["metrics"],
        summary: "Sanitized recent signatures feed",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 20, default: 8 } },
        ],
        responses: { "200": { description: "OK" } },
      },
    },
    "/sign": {
      post: {
        tags: ["sign"],
        summary: "Sign a JSON payload",
        description: "Persists signature; rate-limited at 60 req/min/IP. Returns RateLimit-* headers.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/SignRequest" } } },
        },
        responses: {
          "201": {
            description: "Created",
            content: { "application/json": { schema: { $ref: "#/components/schemas/SignResponse" } } },
          },
          "400": { description: "Invalid payload" },
          "401": { description: "Missing or invalid bearer" },
          "429": { description: "Rate limit exceeded" },
        },
      },
    },
    "/sign/batch": {
      post: {
        tags: ["sign"],
        summary: "Bulk sign up to 50 payloads",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  items: {
                    type: "array",
                    minItems: 1,
                    maxItems: 50,
                    items: { description: "Either a raw payload object/array, or { payload, gps? }" },
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "All succeeded" },
          "207": { description: "Multi-status — some items failed" },
          "400": { description: "Invalid request (empty/oversized)" },
          "401": { description: "Missing or invalid bearer" },
        },
      },
    },
    "/verify": {
      post: {
        tags: ["sign"],
        summary: "Stateless verify",
        description: "No DB lookup. Pass payload + signatures + kids; recomputes canonical and signatures.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  payload: { type: "object" },
                  hmacKid: { type: "string" },
                  signatureHmac: { type: "string" },
                  ed25519Kid: { type: "string" },
                  signatureEd25519: { type: "string" },
                  signatureDilithium: { type: "string", description: "Optional preview-slot digest to round-trip" },
                },
                required: ["payload", "signatureHmac"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "OK",
            content: { "application/json": { schema: { $ref: "#/components/schemas/VerifyResponse" } } },
          },
          "400": { description: "Bad request" },
        },
      },
    },
    "/verify/{id}": {
      get: {
        tags: ["sign"],
        summary: "DB-backed verify by signature id",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "OK" }, "404": { description: "Not found" } },
      },
    },
    "/{id}/public": {
      get: {
        tags: ["sign"],
        summary: "Public JSON for shareable verify page",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "OK" }, "404": { description: "Not found" } },
      },
    },
    "/{id}/pdf": {
      get: {
        tags: ["sign"],
        summary: "Self-contained PDF stamp with QR",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { name: "accent", in: "query", schema: { type: "string", description: "#hex accent stripe color" } },
          { name: "title", in: "query", schema: { type: "string", maxLength: 60 } },
          { name: "subtitle", in: "query", schema: { type: "string", maxLength: 120 } },
          { name: "download", in: "query", schema: { type: "string", enum: ["1", "true"] } },
          { name: "host", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "PDF binary", content: { "application/pdf": {} } },
          "404": { description: "Not found" },
        },
      },
    },
    "/revoke/{id}": {
      post: {
        tags: ["revoke"],
        summary: "Revoke a signature (issuer or admin)",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  reason: { type: "string", maxLength: 500 },
                  causalSignatureId: { type: "string", nullable: true },
                },
                required: ["reason"],
              },
            },
          },
        },
        responses: {
          "201": { description: "Revoked" },
          "400": { description: "Bad request" },
          "403": { description: "Not the issuer or admin" },
          "404": { description: "Signature not found" },
          "409": { description: "Already revoked" },
          "429": { description: "Rate limit exceeded" },
        },
      },
    },
    "/audit": {
      get: {
        tags: ["audit"],
        summary: "Per-user event log",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } },
          { name: "offset", in: "query", schema: { type: "integer", minimum: 0, default: 0 } },
          { name: "event", in: "query", schema: { type: "string", enum: ["sign", "revoke"] } },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: { type: "array", items: { $ref: "#/components/schemas/AuditEvent" } },
                    total: { type: "integer" },
                    limit: { type: "integer" },
                    offset: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/keys": {
      get: {
        tags: ["keys"],
        summary: "JWKS-like key registry",
        responses: { "200": { description: "OK" } },
      },
    },
    "/keys/{kid}": {
      get: {
        tags: ["keys"],
        summary: "Single key detail",
        parameters: [{ name: "kid", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "OK" }, "404": { description: "Not found" } },
      },
    },
    "/keys/rotate": {
      post: {
        tags: ["keys"],
        summary: "Rotate active key (admin only)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  algo: { type: "string", enum: ["HMAC-SHA256", "Ed25519"] },
                  kid: { type: "string" },
                  secretRef: { type: "string" },
                  publicKey: { type: "string", description: "Required for Ed25519 if env seed not set" },
                  notes: { type: "string" },
                },
                required: ["algo"],
              },
            },
          },
        },
        responses: {
          "201": { description: "Rotated" },
          "400": { description: "Bad request" },
          "403": { description: "Admin role required" },
          "409": { description: "kid already exists" },
          "429": { description: "Rate limit exceeded" },
        },
      },
    },
    "/webhooks": {
      get: {
        tags: ["webhooks"],
        summary: "List my webhooks",
        security: [{ BearerAuth: [] }],
        responses: { "200": { description: "OK" } },
      },
      post: {
        tags: ["webhooks"],
        summary: "Create webhook (returns one-time secret)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  url: { type: "string", format: "uri" },
                  events: { type: "array", items: { type: "string", enum: ["sign", "revoke"] } },
                },
                required: ["url"],
              },
            },
          },
        },
        responses: {
          "201": { description: "Created" },
          "400": { description: "Bad request" },
          "409": { description: "Quota exceeded (10/user)" },
        },
      },
    },
    "/webhooks/{id}": {
      delete: {
        tags: ["webhooks"],
        summary: "Delete one of my webhooks (cascades deliveries)",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "Deleted" }, "404": { description: "Not yours" } },
      },
    },
    "/webhooks/{id}/deliveries": {
      get: {
        tags: ["webhooks"],
        summary: "Per-attempt delivery audit trail",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 200, default: 50 } },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    webhookId: { type: "string" },
                    total: { type: "integer" },
                    limit: { type: "integer" },
                    deliveries: { type: "array", items: { $ref: "#/components/schemas/WebhookDelivery" } },
                  },
                },
              },
            },
          },
          "404": { description: "Webhook not found or not yours" },
        },
      },
    },
  },
} as const;
