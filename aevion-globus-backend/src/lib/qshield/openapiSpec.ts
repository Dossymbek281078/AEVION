/**
 * Quantum Shield — OpenAPI 3.0 spec.
 * Served at GET /api/quantum-shield/openapi.json. Mirrors qsign-v2 conventions.
 * Update when endpoint shape changes — smoke asserts behavior, this asserts contract.
 */

export const QSHIELD_OPENAPI = {
  openapi: "3.0.3",
  info: {
    title: "AEVION Quantum Shield",
    version: "1.0.0",
    description:
      "Shamir's Secret Sharing (2-of-3) over a deterministic Ed25519 key, " +
      "with HMAC-SHA256 per-shard authentication, key rotation, and a " +
      "distributed_v2 policy (witness CID + author offline shard) so the " +
      "server alone cannot forge reconstruction.",
    contact: { name: "AEVION", url: "https://aevion.com" },
    license: { name: "Proprietary" },
  },
  servers: [
    {
      url: "https://aevion-production-a70c.up.railway.app/api/quantum-shield",
      description: "Production",
    },
    { url: "http://127.0.0.1:4001/api/quantum-shield", description: "Local dev" },
  ],
  tags: [
    { name: "health", description: "Liveness + counters" },
    { name: "create", description: "Create / list / delete records" },
    { name: "public", description: "Public projection + witness shard" },
    { name: "reconstruct", description: "Lagrange + Ed25519 probe-sign verify" },
  ],
  components: {
    securitySchemes: {
      BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      Error: {
        type: "object",
        properties: { error: { type: "string" } },
      },
      AuthenticatedShard: {
        type: "object",
        required: ["index", "sssShare", "hmac", "hmacKeyVersion"],
        properties: {
          index: { type: "integer", example: 1 },
          sssShare: { type: "string", description: "Shamir share (hex)" },
          hmac: { type: "string", description: "HMAC-SHA256 over (index|share|shieldId|version)" },
          hmacKeyVersion: { type: "integer", example: 1 },
          location: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          lastVerified: { type: "string", format: "date-time" },
        },
      },
      ShieldRecord: {
        type: "object",
        properties: {
          id: { type: "string" },
          objectId: { type: "string", nullable: true },
          objectTitle: { type: "string" },
          algorithm: { type: "string" },
          threshold: { type: "integer" },
          totalShards: { type: "integer" },
          shards: {
            type: "array",
            items: { $ref: "#/components/schemas/AuthenticatedShard" },
          },
          signature: { type: "string" },
          publicKey: { type: "string" },
          status: { type: "string", enum: ["active", "revoked"] },
          legacy: { type: "boolean" },
          ownerUserId: { type: "string", nullable: true },
          distribution: {
            type: "string",
            enum: ["legacy_all_local", "distributed_v2"],
          },
          witnessCid: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["health"],
        summary: "Liveness probe",
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    totalRecords: { type: "integer" },
                    activeRecords: { type: "integer" },
                    legacyRecords: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/": {
      post: {
        tags: ["create"],
        summary: "Create a new shield record",
        security: [{ BearerAuth: [] }, {}],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  objectId: { type: "string" },
                  objectTitle: { type: "string" },
                  payload: {},
                  threshold: { type: "integer", default: 2 },
                  totalShards: { type: "integer", default: 3 },
                  distribution: {
                    type: "string",
                    enum: ["legacy_all_local", "distributed_v2"],
                    default: "legacy_all_local",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ShieldRecord" },
              },
            },
          },
          "400": {
            description: "Bad request",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Error" } },
            },
          },
          "429": { description: "Rate-limited" },
        },
      },
      get: {
        tags: ["create"],
        summary: "List records (optionally filtered by owner)",
        security: [{ BearerAuth: [] }, {}],
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", maximum: 100 } },
          { name: "offset", in: "query", schema: { type: "integer" } },
          { name: "mine", in: "query", schema: { type: "string", enum: ["1"] } },
        ],
        responses: {
          "200": {
            description: "List page",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    records: { type: "array", items: { type: "object" } },
                    total: { type: "integer" },
                    limit: { type: "integer" },
                    offset: { type: "integer" },
                    mine: { type: "boolean" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/{id}/public": {
      get: {
        tags: ["public"],
        summary: "Shareable JSON view (no shards leaked)",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Public projection" },
          "404": { description: "Not found" },
        },
      },
    },
    "/{id}/witness": {
      get: {
        tags: ["public"],
        summary: "Public witness shard (only for distributed_v2 records)",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Witness shard + CID",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    shieldId: { type: "string" },
                    shard: { $ref: "#/components/schemas/AuthenticatedShard" },
                    cid: { type: "string", description: "RFC4648 base32 CID v1" },
                    createdAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          "404": { description: "No witness for this id" },
        },
      },
    },
    "/{id}/reconstruct": {
      post: {
        tags: ["reconstruct"],
        summary: "Lagrange interpolation + Ed25519 probe-sign verification",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          {
            name: "Idempotency-Key",
            in: "header",
            schema: { type: "string", pattern: "^[a-zA-Z0-9._:-]{8,128}$" },
            description:
              "If supplied, repeated calls with the same key return the cached verdict and skip verifiedCount bump.",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["shards"],
                properties: {
                  shards: {
                    type: "array",
                    minItems: 2,
                    items: { $ref: "#/components/schemas/AuthenticatedShard" },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Verified",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    valid: { type: "boolean", example: true },
                    reconstructed: { type: "boolean", example: true },
                    shieldId: { type: "string" },
                    verifiedAt: { type: "string", format: "date-time" },
                    idempotent: { type: "string", enum: ["replayed"], nullable: true },
                  },
                },
              },
            },
          },
          "400": {
            description:
              "Insufficient shards / legacy record / shard format / verification failed",
          },
          "404": { description: "Shield not found" },
        },
      },
    },
    "/{id}": {
      get: {
        tags: ["create"],
        summary: "Full record (auth required for owner-only fields in future)",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Record",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ShieldRecord" },
              },
            },
          },
          "404": { description: "Not found" },
        },
      },
      delete: {
        tags: ["create"],
        summary: "Soft-delete (owner or admin only)",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Deleted" },
          "401": { description: "Auth required" },
          "403": { description: "Not owner / not admin" },
          "404": { description: "Not found" },
        },
      },
    },
    "/{id}/revoke": {
      post: {
        tags: ["reconstruct"],
        summary: "Mark record as revoked (owner or admin)",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { reason: { type: "string", maxLength: 500 } },
              },
            },
          },
        },
        responses: {
          "200": { description: "Revoked or already-revoked" },
          "401": { description: "Auth required" },
          "403": { description: "Forbidden" },
          "404": { description: "Not found" },
        },
      },
    },
    "/{id}/audit": {
      get: {
        tags: ["reconstruct"],
        summary: "Audit log entries for a record (owner or admin)",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", maximum: 200 } },
          { name: "offset", in: "query", schema: { type: "integer" } },
        ],
        responses: {
          "200": {
            description: "Paginated audit feed",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    shieldId: { type: "string" },
                    entries: { type: "array", items: { type: "object" } },
                    limit: { type: "integer" },
                    offset: { type: "integer" },
                  },
                },
              },
            },
          },
          "401": { description: "Auth required" },
          "403": { description: "Forbidden" },
          "404": { description: "Not found" },
        },
      },
    },
    "/webhooks": {
      post: {
        tags: ["public"],
        summary: "Subscribe to shield events for the calling user",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["url"],
                properties: {
                  url: { type: "string", format: "uri" },
                  events: {
                    oneOf: [
                      { type: "string", enum: ["*"] },
                      { type: "string" },
                      {
                        type: "array",
                        items: {
                          type: "string",
                          enum: [
                            "shield.created",
                            "shield.reconstructed",
                            "shield.revoked",
                            "shield.deleted",
                          ],
                        },
                      },
                    ],
                  },
                  secret: { type: "string", minLength: 16 },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Subscription created (returns generated secret)" },
          "400": { description: "Invalid url / events" },
          "401": { description: "Auth required" },
        },
      },
      get: {
        tags: ["public"],
        summary: "List webhook subscriptions for the calling user",
        security: [{ BearerAuth: [] }],
        responses: { "200": { description: "List" } },
      },
    },
    "/webhooks/{id}": {
      delete: {
        tags: ["public"],
        summary: "Delete webhook subscription",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Deleted" },
          "401": { description: "Auth required" },
          "403": { description: "Forbidden" },
          "404": { description: "Not found" },
        },
      },
    },
    "/webhooks/{id}/deliveries": {
      get: {
        tags: ["public"],
        summary: "Recent webhook delivery log",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", maximum: 200 } },
        ],
        responses: {
          "200": { description: "List of deliveries" },
          "401": { description: "Auth required" },
          "403": { description: "Forbidden" },
          "404": { description: "Not found" },
        },
      },
    },
    "/metrics": {
      get: {
        tags: ["health"],
        summary: "Prometheus exposition format",
        responses: {
          "200": {
            description: "text/plain prometheus exposition",
            content: { "text/plain": { schema: { type: "string" } } },
          },
        },
      },
    },
  },
} as const;
