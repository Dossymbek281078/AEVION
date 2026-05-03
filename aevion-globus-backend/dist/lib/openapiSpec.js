"use strict";
// OpenAPI 3.1 spec for the AEVION Globus backend.
//
// Bank-track routes (qtrade + ecosystem + qright royalties + cyberchess +
// planet payouts + auth) carry full request/response schemas and example
// bodies. Legacy / less-integrated routes still use summary-only entries —
// good enough for the developer reference page at /bank/api.
Object.defineProperty(exports, "__esModule", { value: true });
exports.openapiSpec = void 0;
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
    // ──────────────────────────────────────────────────────────────────────
    // Tier 1 trust spine — full schemas (added in 0.5.0)
    // ──────────────────────────────────────────────────────────────────────
    QRightObject: {
        type: "object",
        required: ["id", "title", "kind", "author", "contentHash", "protectedAt"],
        properties: {
            id: { type: "string", example: "qr_2026_05_03_abcd1234" },
            title: { type: "string", example: "My AI-music track v3" },
            kind: { type: "string", enum: ["audio", "video", "image", "text", "code", "other"], example: "audio" },
            description: { type: "string", nullable: true },
            author: { type: "string", example: "alice@aevion.test" },
            email: { type: "string", format: "email", nullable: true },
            location: { type: "string", nullable: true, example: "Berlin, DE" },
            contentHash: { type: "string", description: "SHA-256 of canonical payload (hex)" },
            signatureHmac: { type: "string", description: "HMAC-SHA256 over canonical payload (hex)" },
            signatureEd25519: { type: "string", description: "Ed25519 signature (hex)" },
            shieldId: { type: "string", description: "Quantum Shield record id" },
            shards: { type: "integer", minimum: 2, example: 3 },
            threshold: { type: "integer", minimum: 1, example: 2 },
            algorithm: { type: "string", example: "ed25519+shamir-2of3" },
            protectedAt: { type: "string", format: "date-time" },
            verifyUrl: { type: "string", example: "/qright/verify/qr_2026_05_03_abcd1234" },
            revokedAt: { type: "string", format: "date-time", nullable: true },
        },
    },
    IPCertificate: {
        type: "object",
        required: ["id", "objectId", "title", "contentHash", "status", "protectedAt"],
        properties: {
            id: { type: "string", example: "ipc_2026_05_03_xyz" },
            objectId: { type: "string", description: "QRight object id this cert protects" },
            title: { type: "string" },
            contentHash: { type: "string", description: "SHA-256 of canonical payload (hex)" },
            hmacSignature: { type: "string", description: "HMAC-SHA256 over {objectId,title,contentHash,timestamp} (hex)" },
            cosignSignatures: {
                type: "array",
                description: "Optional witness co-signatures (Ed25519). Empty for self-signed certs.",
                items: {
                    type: "object",
                    properties: {
                        witnessId: { type: "string" },
                        signature: { type: "string" },
                        algorithm: { type: "string", enum: ["ed25519"] },
                    },
                },
            },
            otsAnchor: {
                type: "object",
                nullable: true,
                description: "OpenTimestamps anchor proof (Bitcoin-blockchain attestation).",
                properties: {
                    calendar: { type: "string" },
                    height: { type: "integer", nullable: true },
                    completeAt: { type: "string", format: "date-time", nullable: true },
                },
            },
            status: { type: "string", enum: ["active", "revoked"], example: "active" },
            protectedAt: { type: "string", format: "date-time" },
            revokedAt: { type: "string", format: "date-time", nullable: true },
            revocationReason: { type: "string", nullable: true },
        },
    },
    BureauCert: {
        type: "object",
        required: ["id", "objectId", "authorVerificationLevel", "status"],
        properties: {
            id: { type: "string" },
            objectId: { type: "string", description: "underlying IPCertificate id" },
            authorVerificationLevel: {
                type: "string",
                enum: ["anonymous", "verified", "notarized"],
                description: "anonymous = self-signed; verified = KYC + payment; notarized = quorum-attested by registered notaries",
            },
            authorName: { type: "string", nullable: true },
            authorVerifiedAt: { type: "string", format: "date-time", nullable: true },
            kycSessionId: { type: "string", nullable: true },
            paymentIntentId: { type: "string", nullable: true },
            paymentAmountCents: { type: "integer", nullable: true },
            paymentCurrency: { type: "string", nullable: true, example: "USD" },
            status: { type: "string", enum: ["active", "revoked"] },
        },
    },
    PlanetArtifactVersion: {
        type: "object",
        required: ["id", "submissionId", "version", "createdAt"],
        properties: {
            id: { type: "string" },
            submissionId: { type: "string" },
            version: { type: "integer", minimum: 1 },
            contentHash: { type: "string" },
            productKey: { type: "string", nullable: true, example: "awards-music-2026-Q1" },
            certificateId: { type: "string", nullable: true },
            certifiedAt: { type: "string", format: "date-time", nullable: true },
            voteTally: {
                type: "object",
                properties: {
                    approve: { type: "integer", minimum: 0 },
                    reject: { type: "integer", minimum: 0 },
                    abstain: { type: "integer", minimum: 0 },
                },
            },
            createdAt: { type: "string", format: "date-time" },
        },
    },
    AwardSeason: {
        type: "object",
        required: ["id", "code", "title", "type", "status"],
        properties: {
            id: { type: "string" },
            code: { type: "string", example: "music-2026-q1" },
            title: { type: "string" },
            type: { type: "string", enum: ["music", "film"] },
            status: { type: "string", enum: ["draft", "open", "closed", "finalized"] },
            productKey: { type: "string", nullable: true, description: "Planet validator routing key for entries in this season" },
            openedAt: { type: "string", format: "date-time", nullable: true },
            closedAt: { type: "string", format: "date-time", nullable: true },
            finalizedAt: { type: "string", format: "date-time", nullable: true },
        },
    },
    AwardEntry: {
        type: "object",
        required: ["id", "seasonId", "artifactVersionId", "status"],
        properties: {
            id: { type: "string" },
            seasonId: { type: "string" },
            artifactVersionId: { type: "string", description: "PlanetArtifactVersion this entry references" },
            productKey: { type: "string" },
            status: { type: "string", enum: ["pending", "qualified", "disqualified", "medalist"] },
            place: { type: "integer", nullable: true, minimum: 1, description: "1-2-3 podium position when finalized" },
            submittedAt: { type: "string", format: "date-time" },
        },
    },
    PlanetStats: {
        type: "object",
        properties: {
            submissions: { type: "integer", minimum: 0 },
            eligibleParticipants: { type: "integer", minimum: 0 },
            distinctVotersAllTime: { type: "integer", minimum: 0 },
            certifiedArtifactVersions: { type: "integer", minimum: 0 },
            scopedToProductKeyPrefix: {
                type: "object",
                nullable: true,
                properties: {
                    submissions: { type: "integer", minimum: 0 },
                    certifiedArtifactVersions: { type: "integer", minimum: 0 },
                },
            },
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
        description: "Optional 1-128 char client-generated key. Repeating a successful (200) request with the same key + auth replays the cached response with `Idempotency-Replayed: true`.",
        schema: { type: "string", maxLength: 128 },
    },
};
exports.openapiSpec = {
    openapi: "3.1.0",
    info: {
        title: "AEVION Globus Backend",
        version: "0.5.1",
        description: "Bank-relevant endpoints (qtrade + ecosystem) and Tier 1 trust spine (qright register/verify, bureau verify, pipeline protect, planet artifact submit + read views, awards transparency + leaderboards) carry full schemas. Tier 3 amplifier surfaces (OG cards, sitemaps, badges, RSS) and admin bulk-edit panels documented as summary entries; see per-surface specs (qsign-v2 at /api/qsign/v2/openapi.json, quantum-shield at /api/quantum-shield/openapi.json) for their full schemas.",
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
        "/api/qright/objects": {
            get: {
                summary: "List own QRight objects (paginated)",
                parameters: paginationParams,
                responses: {
                    "200": {
                        description: "Page of QRight objects.",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["items"],
                                    properties: {
                                        items: { type: "array", items: { $ref: "#/components/schemas/QRightObject" } },
                                        nextCursor: { type: ["string", "null"] },
                                    },
                                },
                            },
                        },
                    },
                    "401": { description: "missing/invalid bearer", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                },
            },
            post: {
                summary: "Register a new QRight object — full crypto pipeline",
                description: "Hashes the canonical payload (SHA-256), seals with HMAC, signs with Ed25519, threshold-shards the secret on Quantum Shield (default 2-of-3), persists IPCertificate. Returns the object plus verifyUrl. Rate-limited per JWT sub.",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["title", "kind", "contentHash"],
                                properties: {
                                    title: { type: "string", minLength: 1, maxLength: 200 },
                                    kind: { type: "string", enum: ["audio", "video", "image", "text", "code", "other"] },
                                    description: { type: "string", maxLength: 2000 },
                                    author: { type: "string", description: "Display name. Defaults to authed user's name." },
                                    email: { type: "string", format: "email" },
                                    location: { type: "string", description: "Free-form geo. Auto-filled from Globus when bearer has it." },
                                    contentHash: { type: "string", pattern: "^[0-9a-f]{64}$", description: "Pre-computed SHA-256 of the work payload (hex)." },
                                    shards: { type: "integer", minimum: 2, maximum: 16, default: 3 },
                                    threshold: { type: "integer", minimum: 1, default: 2 },
                                },
                            },
                            example: {
                                title: "AEVION pitch demo — Berlin session 1",
                                kind: "audio",
                                description: "Test track for the registry walkthrough",
                                contentHash: "a6f9c5e0d3b18a4f7c92e10b2d88a73f04e6c5d9b127a3f0e5d76c8a4be2913f",
                                shards: 3,
                                threshold: 2,
                            },
                        },
                    },
                },
                responses: {
                    "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/QRightObject" } } } },
                    "400": { description: "Missing/invalid fields", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                    "401": { description: "missing/invalid bearer" },
                    "429": { description: "Rate limit — see Retry-After" },
                },
            },
        },
        "/api/qright/objects/{id}/public": {
            get: {
                summary: "Public verification view (no auth)",
                security: [],
                parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
                responses: {
                    "200": {
                        description: "Public-safe slice of the object — verifyable signatures, no PII beyond the author display name.",
                        content: { "application/json": { schema: { $ref: "#/components/schemas/QRightObject" } } },
                    },
                    "404": { description: "Not found / revoked" },
                },
            },
        },
        "/api/pipeline/protect": {
            post: {
                summary: "Mint an IPCertificate over a QRight object (HMAC + optional cosign + optional OTS anchor)",
                description: "Backbone of the Tier 1 trust spine. Re-canonicalises the payload, HMAC-seals, optionally collects witness co-signatures (Ed25519), optionally submits to OpenTimestamps for blockchain attestation. Idempotent on objectId — calling twice on the same object returns the existing cert.",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["objectId"],
                                properties: {
                                    objectId: { type: "string", description: "QRight object id this cert covers" },
                                    cosignWitnesses: {
                                        type: "array",
                                        items: { type: "string" },
                                        description: "Optional list of witness public-key ids (Ed25519). Each witness must be reachable.",
                                    },
                                    anchorOts: { type: "boolean", default: false, description: "Submit cert hash to OpenTimestamps for Bitcoin-anchored proof." },
                                },
                            },
                            example: { objectId: "qr_2026_05_03_abcd1234", anchorOts: true },
                        },
                    },
                },
                responses: {
                    "201": { description: "Cert minted", content: { "application/json": { schema: { $ref: "#/components/schemas/IPCertificate" } } } },
                    "200": { description: "Already protected (idempotent replay)" },
                    "404": { description: "Object not found / not owned" },
                    "401": { description: "missing/invalid bearer" },
                },
            },
        },
        "/api/pipeline/verify/{certId}": {
            get: {
                summary: "Verify an IPCertificate (no auth)",
                security: [],
                parameters: [{ in: "path", name: "certId", required: true, schema: { type: "string" } }],
                responses: {
                    "200": {
                        description: "Verification result + cert payload",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        valid: { type: "boolean" },
                                        reason: { type: "string", nullable: true, description: "When valid=false, why" },
                                        cert: { $ref: "#/components/schemas/IPCertificate" },
                                    },
                                },
                            },
                        },
                    },
                    "404": { description: "Cert not found" },
                },
            },
        },
        "/api/bureau/cert/{certId}/verify/start": {
            post: {
                summary: "Begin Verified-tier upgrade (KYC + payment intent)",
                description: "Creates a KYC session via the configured provider (BUREAU_KYC_PROVIDER) and a payment intent (BUREAU_PAYMENT_PROVIDER). Cert flips to 'verified' once both come back successful.",
                parameters: [{ in: "path", name: "certId", required: true, schema: { type: "string" } }],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["declaredName", "declaredCountry"],
                                properties: {
                                    declaredName: { type: "string", maxLength: 200 },
                                    declaredCountry: { type: "string", description: "ISO-3166-1 alpha-2", example: "KZ" },
                                    email: { type: "string", format: "email" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "200": {
                        description: "KYC + payment session created",
                        content: {
                            "application/json": {
                                example: {
                                    kycSessionId: "kyc-stub-1714000000-abc",
                                    kycRedirectUrl: "/bureau/upgrade/kyc-stub-1714000000-abc",
                                    paymentIntentId: "pay-stub-1714000000-xyz",
                                    paymentAmountCents: 1900,
                                    paymentCurrency: "USD",
                                },
                            },
                        },
                    },
                    "404": { description: "Cert not found / not owned" },
                    "409": { description: "Cert already verified" },
                    "401": { description: "missing/invalid bearer" },
                },
            },
        },
        "/api/bureau/cert/{certId}/public": {
            get: {
                summary: "Public verification view of a Bureau cert (no auth)",
                security: [],
                parameters: [{ in: "path", name: "certId", required: true, schema: { type: "string" } }],
                responses: {
                    "200": { description: "Public-safe Bureau cert slice", content: { "application/json": { schema: { $ref: "#/components/schemas/BureauCert" } } } },
                    "404": { description: "Not found / revoked" },
                },
            },
        },
        "/api/planet/health": {
            get: { summary: "Planet sub-service health probe", security: [], responses: { "200": { description: "ok" } } },
        },
        "/api/planet/stats": {
            get: {
                summary: "Cross-platform Planet statistics (no auth)",
                security: [],
                parameters: [
                    { in: "query", name: "productKeyPrefix", schema: { type: "string" }, description: "Scope counts to keys starting with this prefix (e.g. `awards-music-`)." },
                ],
                responses: {
                    "200": { description: "Counts dashboard", content: { "application/json": { schema: { $ref: "#/components/schemas/PlanetStats" } } } },
                },
            },
        },
        "/api/planet/artifacts/recent": {
            get: {
                summary: "Recently certified or active artifact versions (no auth)",
                security: [],
                parameters: [
                    { in: "query", name: "limit", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
                    { in: "query", name: "productKey", schema: { type: "string" }, description: "Filter to one validator pool" },
                ],
                responses: {
                    "200": {
                        description: "List of recent artifacts",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: { items: { type: "array", items: { $ref: "#/components/schemas/PlanetArtifactVersion" } } },
                                },
                            },
                        },
                    },
                },
            },
        },
        "/api/planet/artifacts/{artifactVersionId}/votes/snapshot/latest": {
            get: {
                summary: "Most recent vote-tally snapshot for an artifact (no auth)",
                security: [],
                parameters: [{ in: "path", name: "artifactVersionId", required: true, schema: { type: "string" } }],
                responses: {
                    "200": {
                        description: "Snapshot blob with HMAC over the canonical tally",
                        content: {
                            "application/json": {
                                example: {
                                    artifactVersionId: "art_v1",
                                    snapshotId: "snap_2026_05_03_xyz",
                                    tally: { approve: 7, reject: 1, abstain: 0 },
                                    hmac: "...",
                                    takenAt: "2026-05-03T12:00:00Z",
                                },
                            },
                        },
                    },
                    "404": { description: "No snapshot recorded for this artifact yet" },
                },
            },
        },
        "/api/planet/me/code-symbol": {
            get: {
                summary: "Stable per-user identity code (rotateable)",
                responses: {
                    "200": {
                        description: "User's current code symbol",
                        content: { "application/json": { example: { symbol: "PNT-XYZ-1234", rotatedAt: "2026-04-30T12:00:00Z" } } },
                    },
                    "401": { description: "missing/invalid bearer" },
                },
            },
        },
        "/api/planet/submissions": {
            post: {
                summary: "Submit an artifact version to a Planet validator quorum",
                description: "Creates a PlanetSubmission + PlanetArtifactVersion (v1). Validators on the configured product key vote; once quorum approves, a PlanetCertificate is minted and the AEC reward (if any) settles to the author's Bank wallet via /api/planet/payouts/certify-webhook.",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["title", "productKey", "contentHash"],
                                properties: {
                                    title: { type: "string", maxLength: 200 },
                                    productKey: { type: "string", description: "Validator pool routing key, e.g. 'awards-music-2026-Q1'" },
                                    contentHash: { type: "string", pattern: "^[0-9a-f]{64}$" },
                                    qrightObjectId: { type: "string", description: "Optional — links to a pre-existing QRight registration" },
                                    metadata: { type: "object", additionalProperties: true },
                                },
                            },
                            example: {
                                title: "AI-music track for Awards Q1",
                                productKey: "awards-music-2026-Q1",
                                contentHash: "a6f9c5e0d3b18a4f7c92e10b2d88a73f04e6c5d9b127a3f0e5d76c8a4be2913f",
                                qrightObjectId: "qr_2026_05_03_abcd1234",
                            },
                        },
                    },
                },
                responses: {
                    "201": { description: "Submission + first artifact version created", content: { "application/json": { schema: { $ref: "#/components/schemas/PlanetArtifactVersion" } } } },
                    "400": { description: "Validation error" },
                    "401": { description: "missing/invalid bearer" },
                },
            },
        },
        // ──────────────────────────────────────────────────────────────────────
        // Awards — read paths (admin writes documented at § Tier 3 above)
        // ──────────────────────────────────────────────────────────────────────
        "/api/awards/seasons": {
            get: {
                summary: "List all award seasons (no auth)",
                security: [],
                parameters: [
                    { in: "query", name: "type", schema: { type: "string", enum: ["music", "film"] }, description: "Filter to one track" },
                    { in: "query", name: "status", schema: { type: "string", enum: ["draft", "open", "closed", "finalized"] } },
                ],
                responses: {
                    "200": {
                        description: "Seasons list",
                        content: {
                            "application/json": {
                                schema: { type: "object", properties: { items: { type: "array", items: { $ref: "#/components/schemas/AwardSeason" } } } },
                            },
                        },
                    },
                },
            },
        },
        "/api/awards/seasons/current/{type}": {
            get: {
                summary: "Currently open season for a track (music or film), 404 if none",
                security: [],
                parameters: [{ in: "path", name: "type", required: true, schema: { type: "string", enum: ["music", "film"] } }],
                responses: {
                    "200": { description: "Open season", content: { "application/json": { schema: { $ref: "#/components/schemas/AwardSeason" } } } },
                    "404": { description: "No open season for this track" },
                },
            },
        },
        "/api/awards/{type}/leaderboard": {
            get: {
                summary: "Live leaderboard for a track (no auth)",
                security: [],
                parameters: [
                    { in: "path", name: "type", required: true, schema: { type: "string", enum: ["music", "film"] } },
                    { in: "query", name: "limit", schema: { type: "integer", minimum: 1, maximum: 100, default: 25 } },
                ],
                responses: {
                    "200": {
                        description: "Ranked entries with vote tallies",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        type: { type: "string", enum: ["music", "film"] },
                                        items: {
                                            type: "array",
                                            items: {
                                                allOf: [
                                                    { $ref: "#/components/schemas/AwardEntry" },
                                                    {
                                                        type: "object",
                                                        properties: {
                                                            title: { type: "string" },
                                                            tally: { type: "object", properties: { approve: { type: "integer" }, reject: { type: "integer" }, abstain: { type: "integer" } } },
                                                        },
                                                    },
                                                ],
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        "/api/awards/seasons/{seasonId}/results": {
            get: {
                summary: "Final results for a finalized season (podium + medals)",
                security: [],
                parameters: [{ in: "path", name: "seasonId", required: true, schema: { type: "string" } }],
                responses: {
                    "200": {
                        description: "Season + podium entries (place 1-2-3) when finalized",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        season: { $ref: "#/components/schemas/AwardSeason" },
                                        podium: { type: "array", items: { $ref: "#/components/schemas/AwardEntry" } },
                                    },
                                },
                            },
                        },
                    },
                    "404": { description: "Season not found" },
                },
            },
        },
        "/api/awards/transparency": {
            get: {
                summary: "Public transparency dashboard — counts per track + per season",
                security: [],
                responses: {
                    "200": {
                        description: "Aggregate dashboard JSON",
                        content: {
                            "application/json": {
                                example: {
                                    totals: { seasons: 4, finalizedSeasons: 2, entries: 137, medals: 6 },
                                    perTrack: [
                                        { type: "music", seasons: 2, entries: 89 },
                                        { type: "film", seasons: 2, entries: 48 },
                                    ],
                                },
                            },
                        },
                    },
                },
            },
        },
        "/api/awards/entries": {
            post: {
                summary: "Submit a Planet artifact to an open Awards season",
                description: "Caller must own the underlying PlanetArtifactVersion (matched against PlanetSubmission.ownerId). Idempotent on (seasonId, artifactVersionId) — re-submitting returns the existing entry with `duplicate: true`.",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["seasonId", "artifactVersionId"],
                                properties: {
                                    seasonId: { type: "string" },
                                    artifactVersionId: { type: "string" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "201": { description: "Entry created", content: { "application/json": { schema: { $ref: "#/components/schemas/AwardEntry" } } } },
                    "200": { description: "Already submitted (duplicate replay)" },
                    "401": { description: "missing/invalid bearer" },
                    "403": { description: "Not owner of the artifact" },
                    "404": { description: "Season or artifact not found" },
                    "409": { description: "Season not in 'open' status" },
                },
            },
        },
        "/api/awards/me/entries": {
            get: {
                summary: "Caller's own award submissions",
                responses: {
                    "200": {
                        description: "List of own entries",
                        content: {
                            "application/json": {
                                schema: { type: "object", properties: { items: { type: "array", items: { $ref: "#/components/schemas/AwardEntry" } } } },
                            },
                        },
                    },
                    "401": { description: "missing/invalid bearer" },
                },
            },
        },
        "/api/qcoreai/chat": {
            post: {
                summary: "Chat (5 LLM providers + stub fallback)",
                description: "Rate-limited 30/min per JWT sub or per IP. Optional conversationId persists each turn into chat_turns for /history replay. Returns 429 + Retry-After when the bucket is empty.",
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
                description: "Rate-limited 12/min per user. Each agent's reply is recorded in chat_turns under conversationId `${id}:${agentId}` so per-agent history is queryable. Promise.all — slow agents don't block the rest.",
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
                description: "Increments AEVIONUser.tokenVersion. The current token is rejected on the next request because requireAuth compares its tv claim with the bumped server-side counter. Other devices/tabs lose access within ~10s (cache TTL).",
                responses: { "200": { description: "{ ok: true, tokenVersion: number }" }, "401": { description: "auth required" } },
            },
        },
        "/api/planet/artifacts/{artifactVersionId}/public": { get: { summary: "Public artifact + votes", security: [] } },
        // ──────────────────────────────────────────────────────────────────────
        // Tier 3 amplifier surfaces (OG cards, sitemaps, RSS, badges)
        // ──────────────────────────────────────────────────────────────────────
        // Public crawler-facing endpoints. All use weak ETag + Cache-Control:
        // public,max-age=300 — repeat fetches return 304 Not Modified.
        // Rate-limited per-IP by `*EmbedRateLimit` (240/min/ip).
        "/api/modules/og.svg": { get: { summary: "Modules registry OG card (1200x630, ETag/304)", security: [] } },
        "/api/modules/sitemap.xml": { get: { summary: "Modules registry XML sitemap", security: [] } },
        "/api/modules/{id}/og.svg": { get: { summary: "Per-module OG card with effective tier+status (ETag/304)", security: [] } },
        "/api/modules/{id}/badge.svg": { get: { summary: "Embeddable per-module status badge (SVG)", security: [] } },
        "/api/bureau/og.svg": { get: { summary: "Bureau index OG card (verified/notarized/anon counts, ETag/304)", security: [] } },
        "/api/bureau/sitemap.xml": { get: { summary: "Bureau certificates XML sitemap", security: [] } },
        "/api/bureau/cert/{certId}/og.svg": { get: { summary: "Per-cert OG card (ETag/304)", security: [] } },
        "/api/bureau/cert/{certId}/badge.svg": { get: { summary: "Embeddable per-cert badge (SVG)", security: [] } },
        "/api/awards/og.svg": { get: { summary: "Awards index OG card (seasons/finalized/entries/medals, ETag/304)", security: [] } },
        "/api/awards/sitemap.xml": { get: { summary: "Awards XML sitemap (seasons + entries)", security: [] } },
        "/api/awards/entries/{entryId}/og.svg": { get: { summary: "Per-entry OG card with podium place (ETag/304)", security: [] } },
        "/api/awards/entries/{entryId}/badge.svg": { get: { summary: "Embeddable per-entry medal badge (SVG)", security: [] } },
        "/api/pipeline/og.svg": { get: { summary: "Pipeline registry OG card (ETag/304)", security: [] } },
        "/api/pipeline/sitemap.xml": { get: { summary: "Pipeline certificates XML sitemap", security: [] } },
        "/api/pipeline/certificate/{certId}/og.svg": { get: { summary: "Per-IPCertificate OG card (ETag/304)", security: [] } },
        "/api/quantum-shield/og.svg": { get: { summary: "Quantum Shield registry OG card (ETag/304)", security: [] } },
        "/api/quantum-shield/sitemap.xml": { get: { summary: "Quantum Shield XML sitemap", security: [] } },
        "/api/quantum-shield/{id}/og.svg": { get: { summary: "Per-shield OG card with k-of-n threshold (ETag/304)", security: [] } },
        "/api/qright/og.svg": { get: { summary: "QRight registry OG card (ETag/304)", security: [] } },
        "/api/qright/sitemap.xml": { get: { summary: "QRight XML sitemap", security: [] } },
        "/api/qright/badge/{id}.svg": { get: { summary: "Embeddable per-object QRight badge (SVG)", security: [] } },
        "/api/planet/og.svg": { get: { summary: "Planet Compliance registry OG card (ETag/304)", security: [] } },
        "/api/planet/sitemap.xml": { get: { summary: "Planet Compliance XML sitemap", security: [] } },
        "/api/planet/certificates/{certId}/og.svg": { get: { summary: "Per-cert OG card (ETag/304)", security: [] } },
        "/api/planet/certificates/{certId}/badge.svg": { get: { summary: "Embeddable per-cert badge (SVG)", security: [] } },
        "/api/aevion/sitemap.xml": { get: { summary: "Cross-surface sitemap-index pointing at every per-surface sitemap", security: [] } },
        "/api/aevion/openapi.json": { get: { summary: "Index of OpenAPI specs across all AEVION surfaces", security: [] } },
        // ──────────────────────────────────────────────────────────────────────
        // Admin bulk-edit panels (Tier 3 ops surface)
        // ──────────────────────────────────────────────────────────────────────
        // All require admin role. Single-transaction; abort-on-first-error so
        // partial writes never reach disk. Cap 100 items per call. One audit-log
        // row per item.
        "/api/modules/admin/bulk": {
            patch: {
                summary: "Bulk override module status/tier/hint (admin, ≤100 items)",
                responses: {
                    "200": { description: "Updated rows" },
                    "400": { description: "validation error — no writes" },
                    "403": { description: "admin role required" },
                },
            },
        },
        "/api/bureau/admin/bulk": {
            patch: {
                summary: "Bulk verify/revoke certs (admin, ≤100 items)",
                responses: {
                    "200": { description: "Updated rows" },
                    "400": { description: "validation error — no writes" },
                    "403": { description: "admin role required" },
                },
            },
        },
        "/api/awards/admin/entries/bulk": {
            patch: {
                summary: "Bulk qualify/disqualify entries (admin, ≤100 items)",
                responses: {
                    "200": { description: "Updated rows" },
                    "400": { description: "validation error — no writes" },
                    "403": { description: "admin role required" },
                },
            },
        },
    },
};
