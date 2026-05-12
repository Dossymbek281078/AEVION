/**
 * Drop-in patch for REQ-2026-05-12-E
 *
 * Adds OpenAPI 3.1 definitions for QMedia + QFusionAI to the fintech spec.
 * The aevion-core sprint owner can either:
 *   (a) merge these objects directly into openapiFintechSpec.ts and delete
 *       this file, or
 *   (b) import from here and spread into the existing exports — the const
 *       shapes mirror the existing FINTECH_OPENAPI_TAGS / FINTECH_OPENAPI_SCHEMAS
 *       / FINTECH_OPENAPI_PATHS structure exactly.
 *
 * Why a separate file: aevion-build zone (this worktree) cannot edit
 * openapiFintechSpec.ts directly per LIVE ZONE OWNERSHIP. This file lives
 * in aevion-build zone (it's a new file, not modifying owned territory)
 * and provides ready-to-paste content for aevion-core to integrate.
 *
 * Schemas mirror the actual route files (qmedia.ts, qfusionai.ts) for
 * field names + types. QMedia note: storage is in-memory Map<> in the
 * current implementation; see REQ-2026-05-12-D in AEVION_COORDINATION.md.
 */

const commonErrorResponses = {
  "400": { description: "Validation error — body or query parameters failed schema checks." },
  "401": { description: "Authentication required — missing or invalid Bearer token." },
  "404": { description: "Resource not found." },
  "500": { description: "Internal server error — see server logs for the failure code." },
};

/* ─────────────────────────────── Tags ─────────────────────────────────────── */

export const QMEDIA_QFUSIONAI_OPENAPI_TAGS = [
  {
    name: "QMedia",
    description:
      "Music, video, and creative AI tools. Tracks + playlists + videos with public/private flags, likes (track/video/playlist), play/view counters, and AI generators (lyrics, song titles, color palettes, video descriptions). Auth-required for /me/* mutations. NOTE: backend storage is currently in-process Map<> (REQ-D); Postgres migration pending.",
  },
  {
    name: "QFusionAI",
    description:
      "Hybrid AI router across 5 LLM providers (OpenAI, Anthropic, Gemini, DeepSeek, Grok). One API surface with automatic provider routing by category (code/chat/long-context/cheap/auto), explicit `hint` override, prompt classification, and fallback chain. Read-only health endpoint exposes provider configuration + route catalog.",
  },
];

/* ─────────────────────────────── Schemas ──────────────────────────────────── */

export const QMEDIA_QFUSIONAI_OPENAPI_SCHEMAS: Record<string, unknown> = {
  /* ─── QMedia ─── */
  QMediaTrack: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      userId: { type: "string" },
      title: { type: "string", maxLength: 200 },
      artist: { type: "string", maxLength: 200 },
      genre: { type: "string" },
      duration: { type: "number" },
      url: { type: "string", format: "uri", nullable: true, description: "Must be http:// or https://" },
      coverUrl: { type: "string", format: "uri", nullable: true, description: "Must be http:// or https://" },
      lyrics: { type: "string", maxLength: 10000, nullable: true },
      playCount: { type: "integer", minimum: 0 },
      isPublic: { type: "boolean" },
      tags: { type: "array", items: { type: "string" }, maxItems: 10 },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
    required: ["id", "userId", "title", "isPublic", "createdAt"],
  },
  QMediaPlaylist: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      userId: { type: "string" },
      name: { type: "string", maxLength: 100 },
      description: { type: "string", maxLength: 500, nullable: true },
      isPublic: { type: "boolean" },
      trackIds: { type: "array", items: { type: "string", format: "uuid" } },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
    required: ["id", "userId", "name", "isPublic", "createdAt"],
  },
  QMediaVideo: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      userId: { type: "string" },
      title: { type: "string", maxLength: 200 },
      description: { type: "string", maxLength: 1000, nullable: true },
      url: { type: "string", format: "uri", nullable: true, description: "Must be http:// or https://" },
      thumbnailUrl: { type: "string", format: "uri", nullable: true, description: "Must be http:// or https://" },
      duration: { type: "number" },
      viewCount: { type: "integer", minimum: 0 },
      isPublic: { type: "boolean" },
      category: { type: "string" },
      tags: { type: "array", items: { type: "string" }, maxItems: 10 },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
    required: ["id", "userId", "title", "isPublic", "createdAt"],
  },
  QMediaLike: {
    type: "object",
    properties: {
      type: { type: "string", enum: ["track", "video", "playlist"] },
      resourceId: { type: "string", format: "uuid" },
    },
    required: ["type", "resourceId"],
  },
  /* ─── QFusionAI ─── */
  QFusionProvider: {
    type: "object",
    properties: {
      id: { type: "string", enum: ["openai", "anthropic", "gemini", "deepseek", "grok"] },
      name: { type: "string" },
      configured: { type: "boolean", description: "True when API key for this provider is set in env." },
    },
    required: ["id", "name", "configured"],
  },
  QFusionRouteRequest: {
    type: "object",
    properties: {
      prompt: { type: "string", minLength: 1, maxLength: 32000 },
      hint: { type: "string", enum: ["auto", "code", "chat", "long-context", "cheap", "creative"], default: "auto" },
      model: { type: "string", description: "Explicit model override (optional)." },
      temperature: { type: "number", minimum: 0, maximum: 2, default: 0.7 },
      messages: {
        type: "array",
        description: "Optional explicit messages array (system/user/assistant). When omitted, server constructs from prompt.",
        items: {
          type: "object",
          properties: {
            role: { type: "string", enum: ["system", "user", "assistant"] },
            content: { type: "string" },
          },
          required: ["role", "content"],
        },
      },
    },
    required: ["prompt"],
  },
  QFusionRouteResponse: {
    type: "object",
    properties: {
      provider: { type: "string" },
      providerName: { type: "string" },
      model: { type: "string" },
      reply: { type: "string" },
      category: { type: "string" },
      hint: { type: "string" },
      durationMs: { type: "integer" },
      usage: { type: "object", nullable: true },
    },
    required: ["provider", "model", "reply", "category"],
  },
};

/* ─────────────────────────────── Paths ────────────────────────────────────── */

export const QMEDIA_QFUSIONAI_OPENAPI_PATHS: Record<string, unknown> = {
  /* ── QMedia ── */
  "/api/qmedia/health": {
    get: {
      tags: ["QMedia"],
      summary: "Health probe (DB ping)",
      description: "Returns 200 if DB reachable, 503 with `db: down` otherwise. Includes storage mode + counts (in-memory only).",
      responses: {
        "200": { description: "Healthy", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" }, service: { type: "string" }, db: { type: "string", enum: ["ok", "down"] }, storage: { type: "string" }, counts: { type: "object" }, timestamp: { type: "string", format: "date-time" } } } } } },
        "503": { description: "DB down" },
      },
    },
  },
  "/api/qmedia/tracks": {
    get: {
      tags: ["QMedia"],
      summary: "List public tracks (with filters)",
      parameters: [
        { name: "genre", in: "query", schema: { type: "string" } },
        { name: "q", in: "query", schema: { type: "string" } },
        { name: "limit", in: "query", schema: { type: "integer", maximum: 50, default: 20 } },
      ],
      responses: {
        "200": { description: "List", content: { "application/json": { schema: { type: "object", properties: { items: { type: "array", items: { $ref: "#/components/schemas/QMediaTrack" } } } } } } },
        "500": commonErrorResponses["500"],
      },
    },
  },
  "/api/qmedia/me/tracks": {
    get: {
      tags: ["QMedia"],
      summary: "List my tracks",
      security: [{ bearerAuth: [] }],
      responses: {
        "200": { description: "List", content: { "application/json": { schema: { type: "object", properties: { items: { type: "array", items: { $ref: "#/components/schemas/QMediaTrack" } } } } } } },
        ...commonErrorResponses,
      },
    },
    post: {
      tags: ["QMedia"],
      summary: "Create track",
      security: [{ bearerAuth: [] }],
      requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/QMediaTrack" } } } },
      responses: { "201": { description: "Created" }, ...commonErrorResponses },
    },
  },
  "/api/qmedia/me/tracks/{id}": {
    patch: {
      tags: ["QMedia"],
      summary: "Update track",
      security: [{ bearerAuth: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/QMediaTrack" } } } },
      responses: { "200": { description: "Updated" }, ...commonErrorResponses },
    },
    delete: {
      tags: ["QMedia"],
      summary: "Delete track (cascades orphaned likes)",
      security: [{ bearerAuth: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      responses: { "200": { description: "Deleted" }, ...commonErrorResponses },
    },
  },
  "/api/qmedia/tracks/{id}/play": {
    post: {
      tags: ["QMedia"],
      summary: "Increment play count",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      responses: { "200": { description: "OK" }, "404": commonErrorResponses["404"] },
    },
  },
  "/api/qmedia/{type}/{id}/like": {
    post: {
      tags: ["QMedia"],
      summary: "Toggle like on a resource (track/video/playlist)",
      description: "Returns 404 if the resource ID does not exist. Returns 400 if type is not in {track, video, playlist}.",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "type", in: "path", required: true, schema: { type: "string", enum: ["track", "video", "playlist"] } },
        { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
      ],
      responses: { "200": { description: "Toggled", content: { "application/json": { schema: { type: "object", properties: { liked: { type: "boolean" } } } } } }, ...commonErrorResponses },
    },
  },
  "/api/qmedia/ai/generate-lyrics": {
    post: {
      tags: ["QMedia"],
      summary: "Generate song lyrics (AI; rate-limited 12/min/IP)",
      requestBody: { content: { "application/json": { schema: { type: "object", properties: { genre: { type: "string" }, mood: { type: "string" }, theme: { type: "string" }, lines: { type: "integer" } } } } } },
      responses: { "200": { description: "OK" }, "500": commonErrorResponses["500"] },
    },
  },
  /* ── QFusionAI ── */
  "/api/qfusionai/health": {
    get: {
      tags: ["QFusionAI"],
      summary: "Health + provider catalog",
      responses: {
        "200": { description: "OK", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" }, module: { type: "string" }, providers: { type: "array", items: { $ref: "#/components/schemas/QFusionProvider" } }, routes: { type: "array", items: { type: "string" } } } } } } },
      },
    },
  },
  "/api/qfusionai/route": {
    post: {
      tags: ["QFusionAI"],
      summary: "Route a prompt to the best provider (or explicit hint)",
      description: "Returns 200 with reply if a configured provider succeeds. 400 on validation error. 413 if prompt > 32000 chars. 502 on provider error. 503 if no provider configured.",
      requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/QFusionRouteRequest" } } }, required: true },
      responses: {
        "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/QFusionRouteResponse" } } } },
        "400": { description: "Validation error (prompt-required)" },
        "413": { description: "Prompt too long (> 32000 chars)" },
        "502": { description: "Provider error" },
        "503": { description: "No provider configured" },
      },
    },
  },
};
