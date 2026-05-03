// OpenAPI 3.1 spec for the AEVION Globus backend.
//
// Bank-track routes (qtrade + ecosystem + qright royalties + cyberchess +
// planet payouts + auth) carry full request/response schemas and example
// bodies. Legacy / less-integrated routes still use summary-only entries —
// good enough for the developer reference page at /bank/api.

const securitySchemes = {
  bearerAuth: {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
  },
  qrightWebhook: {
    type: "apiKey",
    in: "header",
    name: "X-QRight-Secret",
  },
  cyberchessWebhook: {
    type: "apiKey",
    in: "header",
    name: "X-CyberChess-Secret",
  },
  planetWebhook: {
    type: "apiKey",
    in: "header",
    name: "X-Planet-Secret",
  },
};

const schemas = {
  Account: {
    type: "object",
    required: ["id", "owner", "balance", "createdAt"],
    properties: {
      id: { type: "string", example: "acc_8b1f...e2c4" },
      owner: { type: "string", format: "email", example: "alice@aevion.test" },
      balance: { type: "number", example: 100 },
      createdAt: { type: "string", format: "date-time" },
    },
  },
  Operation: {
    type: "object",
    required: ["id", "kind", "amount", "to", "createdAt"],
    properties: {
      id: { type: "string", example: "op_..." },
      kind: { type: "string", enum: ["topup", "transfer"] },
      amount: { type: "number", example: 100 },
      from: { type: ["string", "null"], example: null },
      to: { type: "string", example: "acc_..." },
      createdAt: { type: "string", format: "date-time" },
    },
  },
  Transfer: {
    type: "object",
    required: ["id", "from", "to", "amount", "createdAt"],
    properties: {
      id: { type: "string", example: "tx_..." },
      from: { type: "string", example: "acc_..." },
      to: { type: "string", example: "acc_..." },
      amount: { type: "number", example: 1 },
      createdAt: { type: "string", format: "date-time" },
    },
  },
  Page: {
    type: "object",
    required: ["items", "nextCursor"],
    properties: {
      items: { type: "array" },
      nextCursor: { type: ["string", "null"] },
    },
  },
  Error: {
    type: "object",
    required: ["error"],
    properties: {
      error: { type: "string" },
      details: { type: "string" },
    },
  },
  RoyaltyEvent: {
    type: "object",
    properties: {
      id: { type: "string" },
      email: { type: "string", format: "email" },
      productKey: { type: "string" },
      period: { type: "string", example: "2026-Q1" },
      amount: { type: "number" },
      paidAt: { type: "string", format: "date-time" },
      transferId: { type: ["string", "null"] },
      source: { type: "string", enum: ["qright"] },
    },
  },
  ChessPrize: {
    type: "object",
    properties: {
      id: { type: "string" },
      email: { type: "string", format: "email" },
      tournamentId: { type: "string" },
      place: { type: "integer", minimum: 1 },
      amount: { type: "number" },
      finalizedAt: { type: "string", format: "date-time" },
      source: { type: "string", enum: ["cyberchess"] },
    },
  },
  PlanetCert: {
    type: "object",
    properties: {
      id: { type: "string" },
      email: { type: "string", format: "email" },
      artifactVersionId: { type: "string" },
      amount: { type: "number" },
      certifiedAt: { type: "string", format: "date-time" },
      source: { type: "string", enum: ["planet"] },
    },
  },
  EcosystemEarnings: {
    type: "object",
    required: ["totals", "perSource"],
    properties: {
      totals: {
        type: "object",
        properties: {
          qright: { type: "number" },
          cyberchess: { type: "number" },
          planet: { type: "number" },
          all: { type: "number" },
        },
      },
      perSource: {
        type: "array",
        items: {
          type: "object",
          properties: {
            source: { type: "string", enum: ["qright", "cyberchess", "planet"] },
            amount: { type: "number" },
            count: { type: "integer" },
            last: { type: ["string", "null"], format: "date-time" },
          },
        },
      },
    },
  },
};

const paginationParams = [
  {
    in: "query",
    name: "limit",
    schema: { type: "integer", minimum: 1, maximum: 200, default: 50 },
    description: "Page size, capped at 200.",
  },
  {
    in: "query",
    name: "cursor",
    schema: { type: "string" },
    description: "Opaque id-based cursor returned as `nextCursor` from the previous page.",
  },
];

const idemHeader = {
  "Idempotency-Key": {
    description:
      "Optional 1-128 char client-generated key. Repeating a successful (200) request with the same key + auth replays the cached response with `Idempotency-Replayed: true`.",
    schema: { type: "string", maxLength: 128 },
  },
};

export const openapiSpec = {
  openapi: "3.1.0",
  info: {
    title: "AEVION Globus Backend",
    version: "0.3.0",
    description:
      "Bank-relevant endpoints (qtrade + ecosystem) carry full schemas. Legacy globus / qsign routes use summary-only entries.",
    contact: { name: "AEVION", url: "https://aevion.app" },
  },
  servers: [
    { url: "/", description: "Same-origin proxy via Next.js rewrite" },
    { url: "https://api.aevion.app", description: "Production" },
    { url: "http://127.0.0.1:4001", description: "Local dev" },
  ],
  components: { securitySchemes, schemas },
  security: [{ bearerAuth: [] }],
  paths: {
    "/health": {
      get: { summary: "Service health", security: [], responses: { "200": { description: "ok" } } },
    },
    "/api/auth/register": {
      post: {
        summary: "Register a new user (rate-limited)",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password", "name"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 6 },
                  name: { type: "string" },
                },
              },
              example: { email: "alice@aevion.test", password: "secret123", name: "Alice" },
            },
          },
        },
        responses: {
          "200": { description: "Registered, returns JWT + user" },
          "429": { description: "Rate limit exceeded — see Retry-After header" },
        },
      },
    },
    "/api/auth/login": {
      post: {
        summary: "Login (rate-limited)",
        security: [],
        responses: {
          "200": { description: "Returns JWT + user" },
          "401": { description: "Invalid credentials" },
          "429": { description: "Rate limit exceeded" },
        },
      },
    },
    "/api/auth/me": {
      get: { summary: "Current user from bearer token", responses: { "200": { description: "user payload" }, "401": { description: "missing/invalid bearer" } } },
    },
    "/api/qtrade/accounts": {
      get: {
        summary: "List own accounts (paginated)",
        parameters: paginationParams,
        responses: {
          "200": {
            description: "Page of own accounts.",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/Page" },
                    { properties: { items: { type: "array", items: { $ref: "#/components/schemas/Account" } } } },
                  ],
                },
              },
            },
          },
          "401": { description: "missing/invalid bearer", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      post: {
        summary: "Provision an account for the authenticated user",
        responses: { "201": { description: "Account created", content: { "application/json": { schema: { $ref: "#/components/schemas/Account" } } } } },
      },
    },
    "/api/qtrade/accounts/lookup": {
      get: {
        summary: "Resolve email → primary accountId",
        parameters: [{ in: "query", name: "email", required: true, schema: { type: "string", format: "email" } }],
        responses: {
          "200": {
            description: "Lookup hit",
            content: {
              "application/json": {
                example: {
                  email: "bob@aevion.test",
                  primary: { id: "acc_aaaa...bbbb", balance: 12.5 },
                  accounts: [{ id: "acc_aaaa...bbbb", balance: 12.5, createdAt: "2026-04-29T20:00:00Z" }],
                  userExists: true,
                },
              },
            },
          },
          "400": { description: "missing email" },
          "404": { description: "no account for that email" },
        },
      },
    },
    "/api/qtrade/operations": {
      get: {
        summary: "Own operation history, newest first (paginated)",
        parameters: paginationParams,
        responses: {
          "200": {
            description: "Page of operations.",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/Page" },
                    { properties: { items: { type: "array", items: { $ref: "#/components/schemas/Operation" } } } },
                  ],
                },
              },
            },
          },
        },
      },
    },
    "/api/qtrade/transfers": {
      get: { summary: "Own transfer history (paginated)", parameters: paginationParams, responses: { "200": { description: "Page of transfers" } } },
    },
    "/api/qtrade/summary": {
      get: { summary: "Per-user totals (accounts, operations, balance, volume)", responses: { "200": { description: "summary object" } } },
    },
    "/api/qtrade/topup": {
      post: {
        summary: "Credit an own account (idempotent)",
        parameters: [{ in: "header", name: "Idempotency-Key", ...idemHeader["Idempotency-Key"] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["accountId", "amount"],
                properties: { accountId: { type: "string" }, amount: { type: "number", exclusiveMinimum: 0 } },
              },
              example: { accountId: "acc_...", amount: 100 },
            },
          },
        },
        responses: {
          "200": { description: "Updated balance", content: { "application/json": { example: { id: "acc_...", balance: 100, updatedAt: "2026-04-29T20:00:00Z" } } } },
          "403": { description: "Not owner of account" },
          "400": { description: "Invalid amount" },
        },
      },
    },
    "/api/qtrade/transfer": {
      post: {
        summary: "P2P transfer between own → any account (idempotent)",
        parameters: [{ in: "header", name: "Idempotency-Key", ...idemHeader["Idempotency-Key"] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["from", "to", "amount"],
                properties: { from: { type: "string" }, to: { type: "string" }, amount: { type: "number", exclusiveMinimum: 0 } },
              },
              example: { from: "acc_alice", to: "acc_bob", amount: 1 },
            },
          },
        },
        responses: {
          "200": { description: "Transfer record", content: { "application/json": { schema: { $ref: "#/components/schemas/Transfer" } } } },
          "403": { description: "Not owner of source account" },
          "400": { description: "Insufficient funds / invalid accounts" },
        },
      },
    },
    "/api/ecosystem/earnings": {
      get: {
        summary: "Aggregated earnings: qright + cyberchess + planet",
        responses: {
          "200": {
            description: "Per-source totals + counts.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/EcosystemEarnings" } } },
          },
        },
      },
    },
    "/api/qright/royalties": {
      get: {
        summary: "Paid royalties for caller (newest first)",
        responses: {
          "200": { description: "Royalty events list", content: { "application/json": { schema: { type: "object", properties: { items: { type: "array", items: { $ref: "#/components/schemas/RoyaltyEvent" } } } } } } },
        },
      },
    },
    "/api/qright/royalties/verify-webhook": {
      post: {
        summary: "External rights body posts a paid royalty event (idempotent)",
        security: [{ qrightWebhook: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: { eventId: "rights-2026-04-q1-001", email: "creator@aevion.test", productKey: "album-x", period: "2026-Q1", amount: 12.34 },
            },
          },
        },
        responses: { "201": { description: "Recorded" }, "200": { description: "Replayed (eventId already seen)" }, "401": { description: "bad secret" } },
      },
    },
    "/api/cyberchess/results": {
      get: { summary: "Caller's tournament prize wins", responses: { "200": { description: "items: ChessPrize[]" } } },
    },
    "/api/cyberchess/upcoming": {
      get: { summary: "Public upcoming tournaments", security: [], responses: { "200": { description: "items: TournamentSummary[]" } } },
    },
    "/api/cyberchess/tournament-finalized": {
      post: {
        summary: "Tournament service posts a finalized podium (idempotent on tournamentId+place+email)",
        security: [{ cyberchessWebhook: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                tournamentId: "tour_demo_swiss_001",
                podium: [
                  { email: "alice@aevion.test", place: 1, amount: 125 },
                  { email: "bob@aevion.test", place: 2, amount: 75 },
                ],
              },
            },
          },
        },
        responses: { "201": { description: "Podium recorded" }, "401": { description: "bad secret" } },
      },
    },
    "/api/planet/payouts": {
      get: { summary: "Planet certification rewards for caller", responses: { "200": { description: "items: PlanetCert[]" } } },
    },
    "/api/planet/payouts/certify-webhook": {
      post: {
        summary: "Planet quorum certified an artifact version (idempotent on eventId)",
        security: [{ planetWebhook: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: { eventId: "cert-001", email: "creator@aevion.test", artifactVersionId: "art_v1", amount: 25 },
            },
          },
        },
        responses: { "201": { description: "Recorded" }, "200": { description: "Replayed" }, "401": { description: "bad secret" } },
      },
    },
    "/api/qsign/sign": { post: { summary: "Sign payload (legacy)" } },
    "/api/qsign/verify": { post: { summary: "Verify signature (legacy)" } },
    "/api/qtrade/cap-status": { get: { summary: "Daily-cap headroom for caller (used / cap / remainingSec)" } },
    "/api/qtrade/receipt/{opId}.pdf": { get: { summary: "Server-rendered single-page PDF receipt (auth, scoped)" } },
    "/api/qtrade/statement.pdf": { get: { summary: "Multi-page PDF statement (auth; ?period=30d|90d|ytd|all)" } },
    "/api/qtrade/accounts.csv": { get: { summary: "Caller's accounts as CSV" } },
    "/api/qtrade/transfers.csv": { get: { summary: "Caller's transfers as CSV" } },
    "/api/qtrade/operations.csv": { get: { summary: "Caller's ledger operations as CSV" } },
    "/api/ecosystem/earnings.csv": { get: { summary: "Per-source ecosystem earnings as CSV" } },
    "/api/qright/royalties.csv": { get: { summary: "Caller's royalty events as CSV" } },
    "/api/cyberchess/results.csv": { get: { summary: "Caller's chess prizes as CSV" } },
    "/api/planet/payouts.csv": { get: { summary: "Caller's planet certifications as CSV" } },
    "/api/bank/test-webhook/qright": { post: { summary: "Internal: fire synthetic QRight royalty webhook (auth)" } },
    "/api/bank/test-webhook/chess": { post: { summary: "Internal: fire synthetic CyberChess tournament webhook (auth)" } },
    "/api/bank/test-webhook/planet": { post: { summary: "Internal: fire synthetic Planet certify webhook (auth)" } },
    "/api/metrics": { get: { summary: "Prometheus exposition (gated by METRICS_TOKEN if set)", security: [] } },
    "/api/health": { get: { summary: "Liveness probe", security: [] } },
    "/api/health/deep": { get: { summary: "Aggregated health: ledger sizes + memory + env flags", security: [] } },
    "/api/globus/projects": { get: { summary: "All Globus projects + runtime", security: [] } },
    "/api/globus/projects/{id}": { get: { summary: "Single project + runtime", security: [] } },
    "/api/modules/status": { get: { summary: "Modules dashboard payload", security: [] } },
    "/api/modules/{id}/health": { get: { summary: "Per-module health stub", security: [] } },
    "/api/qright/objects": { get: { summary: "List QRight" }, post: { summary: "Create QRight object" } },
    "/api/qcoreai/chat": {
      post: {
        summary: "Chat (5 LLM providers + stub fallback)",
        description:
          "Rate-limited 30/min per JWT sub or per IP. Optional conversationId persists each turn into chat_turns for /history replay. Returns 429 + Retry-After when the bucket is empty.",
        responses: {
          "200": { description: "Provider reply (or stub when none configured)" },
          "400": { description: "messages required" },
          "429": { description: "rate limit — see Retry-After header" },
        },
      },
    },
    "/api/qcoreai/history": {
      get: {
        summary: "Caller's chat-turn history (auth)",
        parameters: [
          { in: "query", name: "conversationId", schema: { type: "string" }, description: "Filter to one conversation. Multichat uses `${convId}:${agentId}` to isolate per-agent chains." },
          { in: "query", name: "limit", schema: { type: "integer", minimum: 1, maximum: 500, default: 100 } },
        ],
        responses: {
          "200": { description: "{ items: ChatTurn[], total: number }" },
          "401": { description: "auth required" },
        },
      },
    },
    "/api/qcoreai/providers": { get: { summary: "Configured LLM providers + active selection", security: [] } },
    "/api/qcoreai/health": { get: { summary: "QCoreAI config probe", security: [] } },
    "/api/multichat/conversations": {
      get: { summary: "Caller's conversations, newest first (auth, max 200)" },
      post: {
        summary: "Create a conversation (auth)",
        requestBody: {
          required: false,
          content: { "application/json": { example: { title: "Brainstorm — pitch outline" } } },
        },
        responses: { "201": { description: "Conversation row" } },
      },
    },
    "/api/multichat/conversations/{id}": {
      get: {
        summary: "Conversation + last 200 turns (auth)",
        responses: { "200": { description: "{ conversation, turns: ChatTurn[] }" }, "404": { description: "not yours / not found" } },
      },
    },
    "/api/multichat/conversations/{id}/dispatch": {
      post: {
        summary: "Fan out one prompt across N agents in parallel (auth, ≤8 agents/call)",
        description:
          "Rate-limited 12/min per user. Each agent's reply is recorded in chat_turns under conversationId `${id}:${agentId}` so per-agent history is queryable. Promise.all — slow agents don't block the rest.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                prompt: "Summarise this in 50 words",
                agents: [
                  { id: "code", role: "Senior engineer", provider: "anthropic" },
                  { id: "biz", role: "Investor", provider: "openai" },
                ],
              },
            },
          },
        },
        responses: {
          "200": { description: "{ results: [{ agentId, ok, reply | error }, …] }" },
          "400": { description: "prompt or agents missing" },
          "429": { description: "dispatch rate limit" },
        },
      },
    },
    "/api/auth/oauth/providers": { get: { summary: "List configured OAuth providers (Google + GitHub)", security: [] } },
    "/api/auth/oauth/{provider}/start": {
      get: {
        summary: "Begin OAuth — 302 to provider authorize URL (Google | GitHub)",
        security: [],
        parameters: [{ in: "path", name: "provider", required: true, schema: { type: "string", enum: ["google", "github"] } }],
        responses: { "302": { description: "Redirect to provider" }, "503": { description: "provider not configured" } },
      },
    },
    "/api/auth/oauth/{provider}/callback": {
      get: {
        summary: "OAuth callback — exchange code, upsert user, redirect to OAUTH_SUCCESS_REDIRECT?token=…",
        security: [],
        parameters: [
          { in: "path", name: "provider", required: true, schema: { type: "string", enum: ["google", "github"] } },
          { in: "query", name: "code", required: true, schema: { type: "string" } },
          { in: "query", name: "state", required: true, schema: { type: "string" } },
        ],
        responses: { "302": { description: "Redirect carrying ?token=<jwt>" }, "400": { description: "state mismatch / code missing" } },
      },
    },
    "/api/auth/sign-out-everywhere": {
      post: {
        summary: "Bump tokenVersion — invalidate every JWT for caller (auth)",
        description:
          "Increments AEVIONUser.tokenVersion. The current token is rejected on the next request because requireAuth compares its tv claim with the bumped server-side counter. Other devices/tabs lose access within ~10s (cache TTL).",
        responses: { "200": { description: "{ ok: true, tokenVersion: number }" }, "401": { description: "auth required" } },
      },
    },
    "/api/planet/stats": { get: { summary: "Planet public stats", security: [] } },
    "/api/planet/artifacts/recent": { get: { summary: "Recent certified artifacts", security: [] } },
    "/api/planet/artifacts/{artifactVersionId}/public": { get: { summary: "Public artifact + votes", security: [] } },
  },
};
