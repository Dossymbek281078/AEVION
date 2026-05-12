/**
 * OpenAPI 3.1 path + schema definitions for the 5 AEVION fintech modules.
 *
 *   1. QGood              — charity campaigns + donations
 *   2. QMaskCard          — virtual payment masks + charge authorization
 *   3. VeilNetX Ledger    — privacy-blinded settlement chain
 *   4. Z-Tide             — reputation / contribution layer
 *   5. QChainGov          — governance proposals + voting
 *
 * Spec library only — no runtime side effects. To expose these definitions
 * via /api/openapi.json, an integrator can spread them into the existing
 * spec builder (paths + components.schemas + tags). This file is intentionally
 * router-agnostic so it can be re-used by SDK generators, documentation
 * portals, and partner integrations.
 *
 * Schemas mirror the actual route files (qgood.ts, qmaskcard.ts,
 * veilnetxLedger.ts, ztide.ts, qchaingov.ts) for field names + types.
 */

/* ─────────────────────────── Reusable response stubs ─────────────────────── */

const errorResponse = (description: string) => ({ description });

const commonErrorResponses = {
  "400": errorResponse("Validation error — body or query parameters failed schema checks."),
  "401": errorResponse("Authentication required — missing or invalid Bearer token."),
  "500": errorResponse("Internal server error — see server logs for the failure code."),
};

const adminErrorResponses = {
  ...commonErrorResponses,
  "403": errorResponse("Forbidden — caller is not in the module admin allowlist."),
  "404": errorResponse("Resource not found, or not in the expected pre-condition state."),
};

/* ───────────────────────────────── Tags ──────────────────────────────────── */

export const FINTECH_OPENAPI_TAGS = [
  {
    name: "QGood",
    description:
      "Charity campaign platform. Donors fund campaigns via Stripe/QPayNet rails; every donation is appended to an immutable audit trail and earns Z-Tide reputation. Campaigns start in draft, require admin approval, then collect donations until closed.",
  },
  {
    name: "QMaskCard",
    description:
      "Virtual payment masks — a meta-tokenization layer between users and Stripe rails. Issue disposable virtual PANs with per-mask spend limits, merchant/category locks, TTL, and per-charge AI fraud scoring. Real PAN is never issued or stored.",
  },
  {
    name: "VeilNetX Ledger",
    description:
      "Append-only, hash-chained settlement ledger spanning every AEVION fintech surface (QPayNet, QGood, QMaskCard, Bureau, QBuild, …). Participants are HMAC-blinded; the chain is verifiable end-to-end via /chain/verify.",
  },
  {
    name: "Z-Tide",
    description:
      "Soft, decaying reputation layer. Each meaningful ecosystem action (login streak, helpful comment, Bureau cert, QGood donation, …) emits a weighted contribution event. Score unlocks ranks that downstream modules read for gating.",
  },
  {
    name: "QChainGov",
    description:
      "Governance + proposal infrastructure. Proposals carry vote mode (yes-no-abstain / ranked-choice / weighted), quorum and pass thresholds, and an admin-gated open/close lifecycle. One vote per user per proposal enforced via UNIQUE constraint.",
  },
];

/* ─────────────────────────────── Schemas ─────────────────────────────────── */

export const FINTECH_OPENAPI_SCHEMAS: Record<string, unknown> = {
  /* ─── QGood ─── */
  Campaign: {
    type: "object",
    description:
      "A QGood charity campaign. Created in 'draft', moves to 'active' via admin approval, then 'closed' or 'rejected'.",
    properties: {
      id: { type: "string", format: "uuid" },
      ownerUserId: { type: "string", nullable: true },
      ownerEmail: { type: "string", format: "email", nullable: true },
      title: { type: "string", minLength: 3, maxLength: 200 },
      description: { type: "string", minLength: 20, maxLength: 5000 },
      category: {
        type: "string",
        enum: [
          "health",
          "education",
          "disaster-relief",
          "environment",
          "animals",
          "community",
          "tech-for-good",
          "other",
        ],
      },
      country: { type: "string", maxLength: 80, nullable: true },
      targetCents: { type: "integer", format: "int64", minimum: 100, maximum: 1_000_000_000 },
      raisedCents: { type: "integer", format: "int64", minimum: 0 },
      donorCount: { type: "integer", minimum: 0 },
      currency: { type: "string", maxLength: 8, example: "USD" },
      status: { type: "string", enum: ["draft", "active", "closed", "rejected"] },
      imageUrl: { type: "string", format: "uri", nullable: true },
      approvedAt: { type: "string", format: "date-time", nullable: true },
      closedAt: { type: "string", format: "date-time", nullable: true },
      createdAt: { type: "string", format: "date-time" },
    },
    required: ["id", "title", "description", "category", "targetCents", "currency", "status", "createdAt"],
  },
  Donation: {
    type: "object",
    description:
      "A single donation against a campaign. donorEmail is hashed (SHA-256, 32 hex chars) before storage; donorName is suppressed in public detail responses when anonymous=true.",
    properties: {
      id: { type: "string", format: "uuid" },
      campaignId: { type: "string", format: "uuid" },
      amountCents: { type: "integer", format: "int64", minimum: 100, maximum: 100_000_000 },
      currency: { type: "string", maxLength: 8, example: "USD" },
      donorName: { type: "string", maxLength: 100, nullable: true },
      messageText: { type: "string", maxLength: 500, nullable: true },
      anonymous: { type: "boolean" },
      paymentRef: { type: "string", maxLength: 100, nullable: true },
      createdAt: { type: "string", format: "date-time" },
    },
    required: ["id", "amountCents", "currency", "anonymous", "createdAt"],
  },

  /* ─── QMaskCard ─── */
  Mask: {
    type: "object",
    description:
      "A virtual payment mask. virtualPan is the only identifier merchants ever see — real PAN is never issued. remainingCents decrements atomically per authorized charge.",
    properties: {
      id: { type: "string", format: "uuid" },
      label: { type: "string", maxLength: 80 },
      virtualPan: {
        type: "string",
        description: "Format: 'aev-mask-<32hex>'. Unique across the system.",
        pattern: "^aev-mask-[0-9a-f]{32}$",
      },
      kind: {
        type: "string",
        enum: ["single-use", "recurring", "merchant-locked", "category-locked"],
        description:
          "single-use auto-revokes after one authorized charge. merchant-locked/category-locked enforce a lockedToMerchant or lockedToCategory string at charge-time.",
      },
      lockedToMerchant: { type: "string", maxLength: 100, nullable: true },
      lockedToCategory: { type: "string", maxLength: 50, nullable: true },
      currency: { type: "string", maxLength: 8, example: "USD" },
      spendLimitCents: { type: "integer", format: "int64", minimum: 100, maximum: 100_000_000 },
      remainingCents: { type: "integer", format: "int64", minimum: 0 },
      expiresAt: { type: "string", format: "date-time", nullable: true },
      revokedAt: { type: "string", format: "date-time", nullable: true },
      createdAt: { type: "string", format: "date-time" },
    },
    required: ["id", "label", "virtualPan", "kind", "currency", "spendLimitCents", "remainingCents", "createdAt"],
  },
  Charge: {
    type: "object",
    description:
      "A charge attempt against a mask. status='authorized' decrements remainingCents; status='declined' includes a declineReason and bumps riskScore to 100.",
    properties: {
      id: { type: "string", format: "uuid" },
      maskId: { type: "string", format: "uuid" },
      amountCents: { type: "integer", format: "int64", minimum: 1, maximum: 100_000_000 },
      currency: { type: "string", maxLength: 8 },
      merchantName: { type: "string", maxLength: 100, nullable: true },
      merchantCategory: { type: "string", maxLength: 50, nullable: true },
      geoCountry: { type: "string", maxLength: 4, nullable: true },
      status: { type: "string", enum: ["authorized", "declined"] },
      declineReason: {
        type: "string",
        nullable: true,
        enum: [
          null,
          "mask_revoked",
          "mask_expired",
          "currency_mismatch",
          "merchant_locked",
          "category_locked",
          "insufficient_balance",
        ],
      },
      riskScore: {
        type: "integer",
        minimum: 0,
        maximum: 100,
        description:
          "AI fraud heuristic — combines geo mismatch, off-hour, large-amount, and 60-minute velocity. 0 = safe, 100 = declined.",
      },
      paymentRef: { type: "string", maxLength: 100, nullable: true },
      createdAt: { type: "string", format: "date-time" },
    },
    required: ["id", "maskId", "amountCents", "currency", "status", "riskScore", "createdAt"],
  },

  /* ─── VeilNetX Ledger ─── */
  LedgerEntry: {
    type: "object",
    description:
      "A privacy-blinded ledger entry. blindedFrom/blindedTo are HMAC-SHA256 over (lowercase identifier, server salt). entryHash = SHA-256 of canonical join of (prevHash, module, kind, blindedFrom, blindedTo, amountCents, currency, metaJson, createdAt).",
    properties: {
      id: { type: "string", format: "uuid" },
      sequenceNumber: { type: "integer", format: "int64", minimum: 1 },
      module: {
        type: "string",
        enum: [
          "qpaynet",
          "qgood",
          "qmaskcard",
          "bureau",
          "qbuild",
          "qsign",
          "qright",
          "aev",
          "qcontract",
          "qtrade",
          "external",
        ],
      },
      kind: {
        type: "string",
        enum: [
          "transfer",
          "deposit",
          "withdrawal",
          "fee",
          "refund",
          "donation",
          "escrow-lock",
          "escrow-release",
          "mint",
          "burn",
          "settlement",
        ],
      },
      blindedFrom: { type: "string", description: "Hex HMAC-SHA256 of the sender identifier." },
      blindedTo: { type: "string", description: "Hex HMAC-SHA256 of the recipient identifier." },
      amountCents: {
        type: "string",
        description:
          "Signed integer cents transferred. Stored as BIGINT; serialized as string to avoid JS Number precision loss for sums > 2^53.",
      },
      currency: { type: "string", maxLength: 8, example: "USD" },
      meta: { type: "object", additionalProperties: true },
      prevHash: { type: "string", description: "Hex SHA-256 of the previous chain entry, or 64×'0' for genesis." },
      entryHash: { type: "string", description: "Hex SHA-256 of this entry's canonical payload." },
      createdAt: { type: "string", format: "date-time" },
    },
    required: ["id", "sequenceNumber", "module", "kind", "blindedFrom", "blindedTo", "amountCents", "currency", "prevHash", "entryHash", "createdAt"],
  },

  /* ─── Z-Tide ─── */
  ZTideEvent: {
    type: "object",
    description: "An append-only contribution event. weight defaults to BASE_WEIGHTS[kind] unless weightOverride supplied by an admin/service caller.",
    properties: {
      id: { type: "string", format: "uuid" },
      userId: { type: "string", maxLength: 200 },
      kind: {
        type: "string",
        enum: [
          "login-streak",
          "helpful-comment",
          "bureau-cert",
          "build-hire",
          "qgood-donation",
          "qcontract-share",
          "qsign-sign",
          "qright-protect",
          "qpaynet-payout",
          "referral-success",
        ],
      },
      sourceModule: {
        type: "string",
        enum: [
          "auth",
          "build",
          "bureau",
          "qgood",
          "qcontract",
          "qsign",
          "qright",
          "qpaynet",
          "qmaskcard",
          "cyberchess",
          "qcore",
          "external",
        ],
      },
      weight: { type: "integer", minimum: 1, maximum: 1000 },
      meta: { type: "object", additionalProperties: true },
      createdAt: { type: "string", format: "date-time" },
    },
    required: ["id", "userId", "kind", "sourceModule", "weight", "createdAt"],
  },
  ZTideRank: {
    type: "object",
    description: "Materialized rank derived from the user's cumulative score.",
    properties: {
      id: { type: "string", enum: ["seedling", "current", "wave", "stream", "tide", "river", "ocean"] },
      label: { type: "string" },
      min: { type: "integer", description: "Minimum score required to hold this rank." },
      next: {
        type: "integer",
        nullable: true,
        description: "Score at which the user is promoted to the next rank, or null if at the top.",
      },
    },
    required: ["id", "label", "min"],
  },
  ZTideScore: {
    type: "object",
    description: "Per-user rolling tide score. Materialized; updated atomically per ingested event.",
    properties: {
      userId: { type: "string" },
      score: { type: "integer", format: "int64", minimum: 0 },
      eventCount: { type: "integer", minimum: 0 },
      rank: { type: "string" },
      lastEventAt: { type: "string", format: "date-time", nullable: true },
    },
    required: ["userId", "score", "eventCount", "rank"],
  },

  /* ─── QChainGov ─── */
  Proposal: {
    type: "object",
    description:
      "A governance proposal. Lifecycle: draft → open (admin) → closed (admin) → optionally executed/rejected. options must be 2..10 non-empty strings.",
    properties: {
      id: { type: "string", format: "uuid" },
      authorUserId: { type: "string" },
      title: { type: "string", minLength: 5, maxLength: 200 },
      summary: { type: "string", minLength: 10, maxLength: 500 },
      body: { type: "string", minLength: 20, maxLength: 20_000 },
      category: {
        type: "string",
        enum: [
          "treasury",
          "protocol",
          "module",
          "partnership",
          "tokenomics",
          "social",
          "operations",
          "emergency",
        ],
      },
      voteMode: {
        type: "string",
        enum: ["yes-no-abstain", "ranked-choice", "weighted"],
      },
      options: {
        type: "array",
        items: { type: "string", maxLength: 80 },
        minItems: 2,
        maxItems: 10,
      },
      quorumPercent: { type: "integer", minimum: 1, maximum: 100 },
      passThreshold: { type: "integer", minimum: 1, maximum: 100 },
      status: {
        type: "string",
        enum: ["draft", "open", "closed", "executed", "rejected"],
      },
      votesOpenAt: { type: "string", format: "date-time", nullable: true },
      votesCloseAt: { type: "string", format: "date-time", nullable: true },
      executedAt: { type: "string", format: "date-time", nullable: true },
      createdAt: { type: "string", format: "date-time" },
    },
    required: ["id", "authorUserId", "title", "summary", "body", "category", "voteMode", "options", "status", "createdAt"],
  },
  Vote: {
    type: "object",
    description: "A single vote on a proposal. (proposalId, voterUserId) is UNIQUE — re-voting returns 409 already_voted.",
    properties: {
      id: { type: "string", format: "uuid" },
      proposalId: { type: "string", format: "uuid" },
      voterUserId: { type: "string" },
      choice: { type: "string", description: "Must be one of the proposal's options[]." },
      weight: { type: "number", format: "double", minimum: 0, maximum: 1_000_000, default: 1 },
      rationale: { type: "string", maxLength: 1000, nullable: true },
      createdAt: { type: "string", format: "date-time" },
    },
    required: ["id", "proposalId", "voterUserId", "choice", "weight", "createdAt"],
  },
  ProposalTallyRow: {
    type: "object",
    description: "Aggregated tally for one choice on a proposal.",
    properties: {
      choice: { type: "string" },
      votes: { type: "integer", minimum: 0 },
      weight: { type: "number", format: "double", minimum: 0 },
    },
    required: ["choice", "votes", "weight"],
  },

  /* ─── Shared ─── */
  HealthResponse: {
    type: "object",
    properties: {
      status: { type: "string", example: "ok" },
      service: { type: "string" },
      timestamp: { type: "string", format: "date-time" },
    },
    required: ["status", "service", "timestamp"],
  },
};

/* ─────────────────────────────── Paths ───────────────────────────────────── */

const bearer = [{ bearerAuth: [] }];

export const FINTECH_OPENAPI_PATHS: Record<string, unknown> = {
  /* ╔══════════════════════════════ QGood ════════════════════════════════╗ */
  "/api/qgood/health": {
    get: {
      tags: ["QGood"],
      summary: "Health probe",
      description: "Liveness probe. Always returns 200 with service identifier and current timestamp.",
      responses: {
        "200": {
          description: "Service is up.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/HealthResponse" } } },
        },
      },
    },
  },
  "/api/qgood/campaigns": {
    get: {
      tags: ["QGood"],
      summary: "List campaigns",
      description:
        "List campaigns ordered by creation date desc. Defaults to status=active. Filterable by status and category; limit clamped to 1..100 (default 20).",
      parameters: [
        {
          name: "status",
          in: "query",
          schema: { type: "string", enum: ["draft", "active", "closed", "rejected"] },
          description: "Filter by campaign status. Default 'active'. Unknown values are ignored (no filter applied).",
        },
        {
          name: "category",
          in: "query",
          schema: {
            type: "string",
            enum: [
              "health",
              "education",
              "disaster-relief",
              "environment",
              "animals",
              "community",
              "tech-for-good",
              "other",
            ],
          },
        },
        { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
      ],
      responses: {
        "200": {
          description: "Page of campaigns.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  campaigns: { type: "array", items: { $ref: "#/components/schemas/Campaign" } },
                  total: { type: "integer" },
                },
              },
            },
          },
        },
        "500": commonErrorResponses["500"],
      },
    },
    post: {
      tags: ["QGood"],
      summary: "Create draft campaign",
      description:
        "Create a campaign in 'draft' status. Requires Bearer auth — the caller becomes ownerUserId/ownerEmail. Admin approval is required before donations can flow.",
      security: bearer,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["title", "description", "targetCents"],
              properties: {
                title: { type: "string", minLength: 3, maxLength: 200 },
                description: { type: "string", minLength: 20, maxLength: 5000 },
                category: { type: "string", default: "other" },
                country: { type: "string", maxLength: 80 },
                targetCents: { type: "integer", minimum: 100, maximum: 1_000_000_000 },
                currency: { type: "string", maxLength: 8, default: "USD" },
                imageUrl: { type: "string", format: "uri", maxLength: 500 },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Campaign created in draft status.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  status: { type: "string", example: "draft" },
                  message: { type: "string" },
                },
              },
            },
          },
        },
        ...commonErrorResponses,
      },
    },
  },
  "/api/qgood/campaigns/{id}": {
    get: {
      tags: ["QGood"],
      summary: "Get campaign detail",
      description:
        "Fetch one campaign plus its 20 most recent donations. Donor names on anonymous donations are nulled out in the response.",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      responses: {
        "200": {
          description: "Campaign detail with recent donations.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  campaign: { $ref: "#/components/schemas/Campaign" },
                  donations: { type: "array", items: { $ref: "#/components/schemas/Donation" } },
                },
              },
            },
          },
        },
        "400": commonErrorResponses["400"],
        "404": errorResponse("Campaign not found."),
        "500": commonErrorResponses["500"],
      },
    },
  },
  "/api/qgood/campaigns/{id}/approve": {
    post: {
      tags: ["QGood"],
      summary: "Approve campaign (admin)",
      description:
        "Move a draft campaign to 'active' status. Restricted to addresses listed in the QGOOD_ADMIN_EMAILS env var.",
      security: bearer,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      responses: {
        "200": { description: "Campaign approved and now accepting donations." },
        ...adminErrorResponses,
      },
    },
  },
  "/api/qgood/campaigns/{id}/donations": {
    post: {
      tags: ["QGood"],
      summary: "Record donation",
      description:
        "Anonymous-friendly: Bearer auth is optional. If the caller is authenticated, a Z-Tide 'qgood-donation' reputation event fires. Donor email (if provided) is SHA-256 hashed before storage. Atomically increments campaign.raisedCents and donorCount.",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["amountCents"],
              properties: {
                amountCents: { type: "integer", minimum: 100, maximum: 100_000_000 },
                currency: { type: "string", default: "USD" },
                donorName: { type: "string", maxLength: 100 },
                donorEmail: { type: "string", format: "email" },
                messageText: { type: "string", maxLength: 500 },
                anonymous: { type: "boolean", default: false },
                paymentRef: { type: "string", maxLength: 100 },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Donation recorded.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  campaignId: { type: "string", format: "uuid" },
                  amountCents: { type: "integer" },
                },
              },
            },
          },
        },
        "400": errorResponse("Validation error, currency mismatch, or campaign not active."),
        "404": errorResponse("Campaign not found."),
        "500": commonErrorResponses["500"],
      },
    },
  },
  "/api/qgood/stats": {
    get: {
      tags: ["QGood"],
      summary: "Ecosystem-wide stats",
      description: "Roll-up across all campaigns: total + active campaigns, total raised cents, total donors.",
      responses: {
        "200": {
          description: "Aggregate statistics.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  total_campaigns: { type: "integer" },
                  active_campaigns: { type: "integer" },
                  total_raised_cents: { type: "integer", format: "int64" },
                  total_donors: { type: "integer" },
                  service: { type: "string", example: "qgood" },
                  currency: { type: "string", example: "USD" },
                },
              },
            },
          },
        },
        "500": commonErrorResponses["500"],
      },
    },
  },

  /* ╔══════════════════════════════ QMaskCard ════════════════════════════╗ */
  "/api/qmaskcard/health": {
    get: {
      tags: ["QMaskCard"],
      summary: "Health probe",
      description: "Liveness probe.",
      responses: {
        "200": {
          description: "Service is up.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/HealthResponse" } } },
        },
      },
    },
  },
  "/api/qmaskcard/masks": {
    get: {
      tags: ["QMaskCard"],
      summary: "List caller's masks",
      description:
        "Lists up to 50 of the caller's masks, newest first. By default revoked masks are filtered out; pass includeRevoked=1 to include them.",
      security: bearer,
      parameters: [
        {
          name: "includeRevoked",
          in: "query",
          schema: { type: "string", enum: ["1"] },
          description: "Pass '1' to include masks where revokedAt IS NOT NULL.",
        },
      ],
      responses: {
        "200": {
          description: "Masks owned by the caller.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  masks: { type: "array", items: { $ref: "#/components/schemas/Mask" } },
                  total: { type: "integer" },
                },
              },
            },
          },
        },
        "401": commonErrorResponses["401"],
        "500": commonErrorResponses["500"],
      },
    },
    post: {
      tags: ["QMaskCard"],
      summary: "Issue mask",
      description:
        "Issue a new virtual mask. The server generates the virtualPan ('aev-mask-<32hex>'); the real PAN never exists. ttlHours defaults to 168 (7 days), max 8760 (1 year). For 'single-use' masks the mask auto-revokes after the first authorized charge.",
      security: bearer,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["label", "spendLimitCents"],
              properties: {
                label: { type: "string", minLength: 1, maxLength: 80 },
                kind: {
                  type: "string",
                  enum: ["single-use", "recurring", "merchant-locked", "category-locked"],
                  default: "single-use",
                },
                lockedToMerchant: { type: "string", maxLength: 100 },
                lockedToCategory: { type: "string", maxLength: 50 },
                currency: { type: "string", default: "USD" },
                spendLimitCents: { type: "integer", minimum: 100, maximum: 100_000_000 },
                ttlHours: { type: "integer", minimum: 1, maximum: 8760, default: 168 },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Mask issued.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Mask" } } },
        },
        ...commonErrorResponses,
      },
    },
  },
  "/api/qmaskcard/masks/{id}/revoke": {
    post: {
      tags: ["QMaskCard"],
      summary: "Revoke mask",
      description: "Soft-revoke a mask. Idempotent on already-revoked masks (returns 404). Future charges against a revoked mask are auto-declined.",
      security: bearer,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      responses: {
        "200": { description: "Mask revoked." },
        "401": commonErrorResponses["401"],
        "404": errorResponse("Mask not found or already revoked."),
        "500": commonErrorResponses["500"],
      },
    },
  },
  "/api/qmaskcard/charges": {
    get: {
      tags: ["QMaskCard"],
      summary: "List caller's charges",
      description: "Returns up to 100 of the caller's charges (authorized + declined), newest first. Optional maskId filter.",
      security: bearer,
      parameters: [{ name: "maskId", in: "query", schema: { type: "string", format: "uuid" } }],
      responses: {
        "200": {
          description: "Charges owned by the caller.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  charges: { type: "array", items: { $ref: "#/components/schemas/Charge" } },
                  total: { type: "integer" },
                },
              },
            },
          },
        },
        "401": commonErrorResponses["401"],
        "500": commonErrorResponses["500"],
      },
    },
    post: {
      tags: ["QMaskCard"],
      summary: "Authorize charge",
      description:
        "Attempt to authorize a charge against one of the caller's masks. Decline paths return HTTP 402 with a structured reason: mask_revoked, mask_expired, currency_mismatch, merchant_locked, category_locked, insufficient_balance. Authorized charges decrement remainingCents and fire a fire-and-forget VeilNetX 'settlement' entry.",
      security: bearer,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["maskId", "amountCents"],
              properties: {
                maskId: { type: "string", format: "uuid" },
                amountCents: { type: "integer", minimum: 1, maximum: 100_000_000 },
                currency: { type: "string", default: "USD" },
                merchantName: { type: "string", maxLength: 100 },
                merchantCategory: { type: "string", maxLength: 50 },
                geoCountry: { type: "string", maxLength: 4 },
                paymentRef: { type: "string", maxLength: 100 },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Charge authorized.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  maskId: { type: "string", format: "uuid" },
                  status: { type: "string", enum: ["authorized"] },
                  amountCents: { type: "integer" },
                  riskScore: { type: "integer", minimum: 0, maximum: 100 },
                  autoRevoked: { type: "boolean", description: "true when the mask was single-use and is now revoked." },
                },
              },
            },
          },
        },
        "400": commonErrorResponses["400"],
        "401": commonErrorResponses["401"],
        "402": errorResponse("Charge declined — see body.reason for the structured decline code."),
        "403": errorResponse("Caller is not the owner of the referenced mask."),
        "404": errorResponse("Mask not found."),
        "500": commonErrorResponses["500"],
      },
    },
  },
  "/api/qmaskcard/stats": {
    get: {
      tags: ["QMaskCard"],
      summary: "Module stats",
      description: "Active vs total masks, authorized vs declined charge counts, and aggregate authorized-volume cents.",
      responses: {
        "200": {
          description: "Aggregate statistics.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  active_masks: { type: "integer" },
                  total_masks: { type: "integer" },
                  authorized_charges: { type: "integer" },
                  declined_charges: { type: "integer" },
                  volume_cents: { type: "integer", format: "int64" },
                  service: { type: "string", example: "qmaskcard" },
                },
              },
            },
          },
        },
        "500": commonErrorResponses["500"],
      },
    },
  },

  /* ╔══════════════════════════ VeilNetX Ledger ══════════════════════════╗ */
  "/api/veilnetx-ledger/health": {
    get: {
      tags: ["VeilNetX Ledger"],
      summary: "Health probe",
      description: "Liveness probe.",
      responses: {
        "200": {
          description: "Service is up.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/HealthResponse" } } },
        },
      },
    },
  },
  "/api/veilnetx-ledger/entries": {
    get: {
      tags: ["VeilNetX Ledger"],
      summary: "List ledger entries",
      description:
        "Lists ledger entries in reverse-sequence order. Filter by module (must be in the known module set) and/or fromIdentifier (the raw identifier is blinded server-side, then compared against blindedFrom). Limit clamped to 1..200 (default 50).",
      parameters: [
        { name: "module", in: "query", schema: { type: "string" }, description: "One of the known modules; unknown values are ignored." },
        { name: "fromIdentifier", in: "query", schema: { type: "string" }, description: "Raw sender identifier; server blinds it before lookup." },
        { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 200, default: 50 } },
      ],
      responses: {
        "200": {
          description: "Page of entries.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  entries: { type: "array", items: { $ref: "#/components/schemas/LedgerEntry" } },
                  total: { type: "integer" },
                },
              },
            },
          },
        },
        "500": commonErrorResponses["500"],
      },
    },
    post: {
      tags: ["VeilNetX Ledger"],
      summary: "Register entry",
      description:
        "Register a settlement entry. Server blinds fromIdentifier/toIdentifier (HMAC-SHA256 with VEILNETX_SALT), computes prevHash from the chain tip, and appends. amountCents accepts integer or numeric string (BigInt range, non-zero, ±1e12).",
      security: bearer,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["module", "kind", "amountCents"],
              properties: {
                module: {
                  type: "string",
                  enum: [
                    "qpaynet",
                    "qgood",
                    "qmaskcard",
                    "bureau",
                    "qbuild",
                    "qsign",
                    "qright",
                    "aev",
                    "qcontract",
                    "qtrade",
                    "external",
                  ],
                },
                kind: {
                  type: "string",
                  enum: [
                    "transfer",
                    "deposit",
                    "withdrawal",
                    "fee",
                    "refund",
                    "donation",
                    "escrow-lock",
                    "escrow-release",
                    "mint",
                    "burn",
                    "settlement",
                  ],
                },
                fromIdentifier: { type: "string" },
                toIdentifier: { type: "string" },
                amountCents: {
                  oneOf: [{ type: "integer", format: "int64" }, { type: "string", pattern: "^-?\\d+$" }],
                },
                currency: { type: "string", default: "USD" },
                meta: { type: "object", additionalProperties: true },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Entry appended.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/LedgerEntry" } } },
        },
        ...commonErrorResponses,
      },
    },
  },
  "/api/veilnetx-ledger/entries/{id}": {
    get: {
      tags: ["VeilNetX Ledger"],
      summary: "Get entry + verify integrity",
      description: "Fetch one entry and recompute its hash from stored fields. Response includes integrity='ok' or 'broken' plus the recomputed hash for client comparison.",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      responses: {
        "200": {
          description: "Entry with integrity verdict.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  entry: { $ref: "#/components/schemas/LedgerEntry" },
                  integrity: { type: "string", enum: ["ok", "broken"] },
                  recomputedHash: { type: "string" },
                },
              },
            },
          },
        },
        "404": errorResponse("Entry not found."),
        "500": commonErrorResponses["500"],
      },
    },
  },
  "/api/veilnetx-ledger/chain/head": {
    get: {
      tags: ["VeilNetX Ledger"],
      summary: "Chain tip",
      description: "Returns the current tip hash and chain length. For an empty chain, head = '0'×64 (genesis) and length = 0.",
      responses: {
        "200": {
          description: "Chain head info.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  head: { type: "string" },
                  length: { type: "integer" },
                  tipAt: { type: "string", format: "date-time", nullable: true },
                },
              },
            },
          },
        },
        "500": commonErrorResponses["500"],
      },
    },
  },
  "/api/veilnetx-ledger/chain/verify": {
    get: {
      tags: ["VeilNetX Ledger"],
      summary: "Verify full chain",
      description:
        "Recomputes the entire hash chain (up to 10 000 entries) from genesis. Returns brokenAt = the first sequenceNumber whose hash or prevHash does not match, or null if the chain is intact.",
      responses: {
        "200": {
          description: "Verification verdict.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  verified: { type: "boolean" },
                  brokenAt: { type: "integer", nullable: true },
                  length: { type: "integer" },
                  head: { type: "string" },
                },
              },
            },
          },
        },
        "500": commonErrorResponses["500"],
      },
    },
  },
  "/api/veilnetx-ledger/stats": {
    get: {
      tags: ["VeilNetX Ledger"],
      summary: "Per-module stats",
      description: "Total entries and per-module breakdown (entries + volume cents).",
      responses: {
        "200": {
          description: "Aggregate statistics.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  service: { type: "string", example: "veilnetx-ledger" },
                  total: { type: "integer" },
                  perModule: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        module: { type: "string" },
                        entries: { type: "integer" },
                        volume_cents: { type: "integer", format: "int64" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        "500": commonErrorResponses["500"],
      },
    },
  },

  /* ╔════════════════════════════════ Z-Tide ═════════════════════════════╗ */
  "/api/ztide/health": {
    get: {
      tags: ["Z-Tide"],
      summary: "Health probe",
      description: "Liveness probe.",
      responses: {
        "200": {
          description: "Service is up.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/HealthResponse" } } },
        },
      },
    },
  },
  "/api/ztide/events": {
    post: {
      tags: ["Z-Tide"],
      summary: "Record contribution event",
      description:
        "Server-side ingestion. Caller must be either (a) an admin JWT (email in ZTIDE_ADMIN_EMAILS) or (b) carry the X-ZTide-Service-Key header matching ZTIDE_SERVICE_KEY. The event's weight defaults to BASE_WEIGHTS[kind]; weightOverride (1..1000) lets an admin tune individual events. Upserts the per-user score atomically and recomputes the rank.",
      security: [{ bearerAuth: [] }, { serviceKey: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["userId", "kind", "sourceModule"],
              properties: {
                userId: { type: "string", minLength: 1, maxLength: 200 },
                kind: {
                  type: "string",
                  enum: [
                    "login-streak",
                    "helpful-comment",
                    "bureau-cert",
                    "build-hire",
                    "qgood-donation",
                    "qcontract-share",
                    "qsign-sign",
                    "qright-protect",
                    "qpaynet-payout",
                    "referral-success",
                  ],
                },
                sourceModule: {
                  type: "string",
                  enum: [
                    "auth",
                    "build",
                    "bureau",
                    "qgood",
                    "qcontract",
                    "qsign",
                    "qright",
                    "qpaynet",
                    "qmaskcard",
                    "cyberchess",
                    "qcore",
                    "external",
                  ],
                },
                weightOverride: { type: "integer", minimum: 1, maximum: 1000 },
                meta: { type: "object", additionalProperties: true },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Event ingested.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  userId: { type: "string" },
                  kind: { type: "string" },
                  weight: { type: "integer" },
                  score: { type: "integer", format: "int64" },
                  rank: { $ref: "#/components/schemas/ZTideRank" },
                },
              },
            },
          },
        },
        "400": commonErrorResponses["400"],
        "403": errorResponse("Caller is neither an admin nor presents a valid X-ZTide-Service-Key."),
        "500": commonErrorResponses["500"],
      },
    },
  },
  "/api/ztide/me": {
    get: {
      tags: ["Z-Tide"],
      summary: "Caller's score + recent events",
      description: "Returns the caller's score, rank, eventCount, lastEventAt, and 20 most recent events.",
      security: bearer,
      responses: {
        "200": {
          description: "Caller's tide state.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  userId: { type: "string" },
                  score: { type: "integer", format: "int64" },
                  eventCount: { type: "integer" },
                  lastEventAt: { type: "string", format: "date-time", nullable: true },
                  rank: { $ref: "#/components/schemas/ZTideRank" },
                  recentEvents: { type: "array", items: { $ref: "#/components/schemas/ZTideEvent" } },
                },
              },
            },
          },
        },
        "401": commonErrorResponses["401"],
        "500": commonErrorResponses["500"],
      },
    },
  },
  "/api/ztide/leaderboard": {
    get: {
      tags: ["Z-Tide"],
      summary: "Global leaderboard",
      description: "Top-N users by score (descending). limit clamped to 1..200 (default 50).",
      parameters: [{ name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 200, default: 50 } }],
      responses: {
        "200": {
          description: "Leaderboard rows.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  leaderboard: {
                    type: "array",
                    items: {
                      allOf: [
                        { $ref: "#/components/schemas/ZTideScore" },
                        { type: "object", properties: { position: { type: "integer", minimum: 1 } } },
                      ],
                    },
                  },
                  total: { type: "integer" },
                },
              },
            },
          },
        },
        "500": commonErrorResponses["500"],
      },
    },
  },
  "/api/ztide/rank/{userId}": {
    get: {
      tags: ["Z-Tide"],
      summary: "Public score lookup",
      description: "Look up any user's score + rank by userId. Unknown users return score=0 / rank=seedling (no 404).",
      parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": {
          description: "Public score / rank.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  userId: { type: "string" },
                  score: { type: "integer", format: "int64" },
                  eventCount: { type: "integer" },
                  rank: { $ref: "#/components/schemas/ZTideRank" },
                  lastEventAt: { type: "string", format: "date-time", nullable: true },
                },
              },
            },
          },
        },
        "400": commonErrorResponses["400"],
        "500": commonErrorResponses["500"],
      },
    },
  },
  "/api/ztide/stats": {
    get: {
      tags: ["Z-Tide"],
      summary: "Module stats",
      description: "Active users, total events, total weight summed across all events, and top score. Also returns the static ranks ladder.",
      responses: {
        "200": {
          description: "Aggregate statistics.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  active_users: { type: "integer" },
                  total_events: { type: "integer" },
                  total_weight: { type: "integer", format: "int64" },
                  top_score: { type: "integer", format: "int64", nullable: true },
                  service: { type: "string", example: "ztide" },
                  ranks: { type: "array", items: { $ref: "#/components/schemas/ZTideRank" } },
                },
              },
            },
          },
        },
        "500": commonErrorResponses["500"],
      },
    },
  },

  /* ╔════════════════════════════ QChainGov ══════════════════════════════╗ */
  "/api/qchaingov/health": {
    get: {
      tags: ["QChainGov"],
      summary: "Health probe",
      description: "Liveness probe.",
      responses: {
        "200": {
          description: "Service is up.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/HealthResponse" } } },
        },
      },
    },
  },
  "/api/qchaingov/proposals": {
    get: {
      tags: ["QChainGov"],
      summary: "List proposals",
      description: "List proposals ordered by createdAt desc. Filterable by status and category. limit clamped to 1..100 (default 30).",
      parameters: [
        {
          name: "status",
          in: "query",
          schema: { type: "string", enum: ["draft", "open", "closed", "executed", "rejected"] },
        },
        {
          name: "category",
          in: "query",
          schema: {
            type: "string",
            enum: ["treasury", "protocol", "module", "partnership", "tokenomics", "social", "operations", "emergency"],
          },
        },
        { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 30 } },
      ],
      responses: {
        "200": {
          description: "Page of proposals.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  proposals: { type: "array", items: { $ref: "#/components/schemas/Proposal" } },
                  total: { type: "integer" },
                },
              },
            },
          },
        },
        "500": commonErrorResponses["500"],
      },
    },
    post: {
      tags: ["QChainGov"],
      summary: "Create proposal",
      description:
        "Create a proposal in 'draft' status. options must be 2..10 non-empty strings. Defaults: voteMode='yes-no-abstain', options=['yes','no','abstain'], quorumPercent=10, passThreshold=50.",
      security: bearer,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["title", "summary", "body"],
              properties: {
                title: { type: "string", minLength: 5, maxLength: 200 },
                summary: { type: "string", minLength: 10, maxLength: 500 },
                body: { type: "string", minLength: 20, maxLength: 20_000 },
                category: { type: "string", default: "protocol" },
                voteMode: { type: "string", default: "yes-no-abstain" },
                options: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 10 },
                quorumPercent: { type: "integer", minimum: 1, maximum: 100, default: 10 },
                passThreshold: { type: "integer", minimum: 1, maximum: 100, default: 50 },
                votesOpenAt: { type: "string", format: "date-time" },
                votesCloseAt: { type: "string", format: "date-time" },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Proposal created in draft status.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  status: { type: "string", example: "draft" },
                  options: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
        ...commonErrorResponses,
      },
    },
  },
  "/api/qchaingov/proposals/{id}": {
    get: {
      tags: ["QChainGov"],
      summary: "Get proposal + tally",
      description: "Fetch one proposal plus aggregated tally (votes + summed weight per choice) and totals (total votes + total weight).",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      responses: {
        "200": {
          description: "Proposal detail with tally.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  proposal: { $ref: "#/components/schemas/Proposal" },
                  tally: { type: "array", items: { $ref: "#/components/schemas/ProposalTallyRow" } },
                  totals: {
                    type: "object",
                    properties: {
                      total: { type: "integer" },
                      total_weight: { type: "number", format: "double" },
                    },
                  },
                },
              },
            },
          },
        },
        "400": commonErrorResponses["400"],
        "404": errorResponse("Proposal not found."),
        "500": commonErrorResponses["500"],
      },
    },
  },
  "/api/qchaingov/proposals/{id}/votes": {
    get: {
      tags: ["QChainGov"],
      summary: "List votes on a proposal",
      description: "Public list of up to 200 most recent votes on a proposal, newest first. Includes voterUserId and rationale.",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      responses: {
        "200": {
          description: "Votes on this proposal.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  votes: { type: "array", items: { $ref: "#/components/schemas/Vote" } },
                  total: { type: "integer" },
                },
              },
            },
          },
        },
        "500": commonErrorResponses["500"],
      },
    },
    post: {
      tags: ["QChainGov"],
      summary: "Cast vote",
      description:
        "Cast a vote on an open proposal. choice must be one of proposal.options[]. Re-voting (same voterUserId on same proposalId) returns 409 already_voted thanks to the UNIQUE constraint.",
      security: bearer,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["choice"],
              properties: {
                choice: { type: "string" },
                weight: { type: "number", format: "double", minimum: 0, maximum: 1_000_000, default: 1 },
                rationale: { type: "string", maxLength: 1000 },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Vote recorded.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  proposalId: { type: "string", format: "uuid" },
                  choice: { type: "string" },
                  weight: { type: "number", format: "double" },
                },
              },
            },
          },
        },
        "400": errorResponse("Validation error, voting not open, or invalid choice for this proposal's options."),
        "401": commonErrorResponses["401"],
        "404": errorResponse("Proposal not found."),
        "409": errorResponse("Caller has already voted on this proposal."),
        "500": commonErrorResponses["500"],
      },
    },
  },
  "/api/qchaingov/proposals/{id}/open": {
    post: {
      tags: ["QChainGov"],
      summary: "Open voting (admin)",
      description: "Move a draft proposal to 'open' status. Restricted to addresses listed in QCHAINGOV_ADMIN_EMAILS. Sets votesOpenAt = NOW().",
      security: bearer,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      responses: {
        "200": { description: "Voting opened." },
        ...adminErrorResponses,
      },
    },
  },
  "/api/qchaingov/proposals/{id}/close": {
    post: {
      tags: ["QChainGov"],
      summary: "Close voting (admin)",
      description: "Move an open proposal to 'closed' status. Restricted to addresses listed in QCHAINGOV_ADMIN_EMAILS. Sets votesCloseAt = NOW().",
      security: bearer,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      responses: {
        "200": { description: "Voting closed." },
        ...adminErrorResponses,
      },
    },
  },
  "/api/qchaingov/stats": {
    get: {
      tags: ["QChainGov"],
      summary: "Module stats",
      description: "Total / open / closed proposal counts, total votes, and unique voters.",
      responses: {
        "200": {
          description: "Aggregate statistics.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  total_proposals: { type: "integer" },
                  open_proposals: { type: "integer" },
                  closed_proposals: { type: "integer" },
                  total_votes: { type: "integer" },
                  unique_voters: { type: "integer" },
                  service: { type: "string", example: "qchaingov" },
                },
              },
            },
          },
        },
        "500": commonErrorResponses["500"],
      },
    },
  },
};
