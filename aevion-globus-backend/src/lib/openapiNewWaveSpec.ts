/**
 * OpenAPI 3.1 path + schema definitions — New Wave modules (2026-05-13 batch).
 *
 *   1. StartupX           — startup ideas marketplace + investor interest
 *   2. Kids AI Content    — multilang lesson catalog + AI-ask + progress
 *   3. MapReality         — geo signals (need/event/request) + support
 *   4. Voice of Earth     — multilang track catalog + vote
 */

const bearer = [{ bearerAuth: [] }];

function errorResponse(desc: string) {
  return { description: desc, content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } };
}

const commonOk = (desc: string, schema: Record<string, unknown>) => ({
  description: desc,
  content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean", example: true }, data: schema } } } },
});

export const NEW_WAVE_OPENAPI_TAGS = [
  { name: "StartupX", description: "Startup ideas marketplace: submit → QRight-hash → investor interest" },
  { name: "KidsAI", description: "Multilang children lesson catalog with AI tutor and progress tracking" },
  { name: "MapReality", description: "Geo-tagged community signals (need / event / request) with support votes" },
  { name: "VoiceOfEarth", description: "International multilang music series: tracks + voting" },
];

export const NEW_WAVE_OPENAPI_SCHEMAS = {
  StartupIdea: {
    type: "object",
    properties: {
      id: { type: "integer" },
      title: { type: "string", maxLength: 200 },
      description: { type: "string" },
      stage: { type: "string", enum: ["idea", "prototype", "mvp", "scaling"] },
      contactMethod: { type: "string" },
      qrightProtected: { type: "boolean" },
      contentHash: { type: "string" },
      visibility: { type: "string", enum: ["public", "private"] },
      interestCount: { type: "integer" },
      createdAt: { type: "string", format: "date-time" },
    },
  },
  KidsLesson: {
    type: "object",
    properties: {
      id: { type: "integer" },
      title: { type: "string" },
      description: { type: "string" },
      ageMin: { type: "integer" },
      ageMax: { type: "integer" },
      language: { type: "string", enum: ["ru", "en", "kz"] },
      category: { type: "string" },
      contentMd: { type: "string" },
    },
  },
  MapSignal: {
    type: "object",
    properties: {
      id: { type: "integer" },
      title: { type: "string", maxLength: 200 },
      description: { type: "string", maxLength: 2000 },
      category: { type: "string", enum: ["need", "event", "request"] },
      country: { type: "string" },
      city: { type: "string" },
      lat: { type: "number" },
      lng: { type: "number" },
      authorAlias: { type: "string" },
      supportCount: { type: "integer" },
      status: { type: "string", enum: ["active", "resolved", "flagged"] },
      createdAt: { type: "string", format: "date-time" },
    },
  },
  VoeTrack: {
    type: "object",
    properties: {
      id: { type: "integer" },
      title: { type: "string", maxLength: 200 },
      artistAlias: { type: "string" },
      language: { type: "string" },
      lyrics: { type: "string" },
      mood: { type: "string", enum: ["hopeful", "peaceful", "joyful", "reflective", "uplifting"] },
      audioUrl: { type: "string", nullable: true },
      votes: { type: "integer" },
      status: { type: "string", enum: ["pending", "published", "flagged"] },
      createdAt: { type: "string", format: "date-time" },
    },
  },
};

export const NEW_WAVE_OPENAPI_PATHS: Record<string, unknown> = {
  // ---- StartupX ----
  "/api/startupx/health": {
    get: { tags: ["StartupX"], summary: "StartupX health + DB status", security: [], responses: { "200": commonOk("ok", { type: "object", properties: { ok: { type: "boolean" }, dbReady: { type: "boolean" } } }) } },
  },
  "/api/startupx/ideas": {
    get: {
      tags: ["StartupX"], summary: "List public startup ideas",
      parameters: [
        { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
        { name: "stage", in: "query", schema: { type: "string", enum: ["idea", "prototype", "mvp", "scaling"] } },
      ],
      responses: { "200": commonOk("Paginated list", { type: "array", items: { $ref: "#/components/schemas/StartupIdea" } }) },
    },
    post: {
      tags: ["StartupX"], summary: "Submit a new startup idea (auto-protects via SHA-256)",
      requestBody: {
        required: true,
        content: { "application/json": { schema: { type: "object", required: ["title", "description", "stage"], properties: {
          title: { type: "string", maxLength: 200 }, description: { type: "string" },
          stage: { type: "string", enum: ["idea", "prototype", "mvp", "scaling"] },
          founderEmail: { type: "string", format: "email" }, contactMethod: { type: "string" },
        } } } },
      },
      responses: { "200": commonOk("Created idea with contentHash and qrightProtected flag", { $ref: "#/components/schemas/StartupIdea" }), "400": errorResponse("Validation error") },
    },
  },
  "/api/startupx/ideas/{id}": {
    get: {
      tags: ["StartupX"], summary: "Get single idea with interest_count",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
      responses: { "200": commonOk("Single idea", { $ref: "#/components/schemas/StartupIdea" }), "404": errorResponse("Not found") },
    },
  },
  "/api/startupx/ideas/{id}/interest": {
    post: {
      tags: ["StartupX"], summary: "Investor expresses interest in an idea",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
      requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["investorEmail"], properties: { investorEmail: { type: "string", format: "email" }, message: { type: "string" } } } } } },
      responses: { "200": commonOk("Recorded", { type: "object" }), "404": errorResponse("Idea not found") },
    },
  },
  "/api/startupx/stats": {
    get: { tags: ["StartupX"], summary: "Aggregate stats: total, byStage, recentCount (7d)", responses: { "200": commonOk("Stats", { type: "object" }) } },
  },

  // ---- Kids AI ----
  "/api/kids-ai/health": {
    get: { tags: ["KidsAI"], summary: "Kids AI health + lesson count", security: [], responses: { "200": commonOk("ok", { type: "object", properties: { ok: { type: "boolean" }, dbReady: { type: "boolean" }, lessonsCount: { type: "integer" } } }) } },
  },
  "/api/kids-ai/lessons": {
    get: {
      tags: ["KidsAI"], summary: "List lessons (filter by lang / age / category)",
      parameters: [
        { name: "lang", in: "query", schema: { type: "string", enum: ["ru", "en", "kz"] } },
        { name: "ageMin", in: "query", schema: { type: "integer" } },
        { name: "ageMax", in: "query", schema: { type: "integer" } },
        { name: "category", in: "query", schema: { type: "string" } },
        { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
      ],
      responses: { "200": commonOk("Lessons", { type: "array", items: { $ref: "#/components/schemas/KidsLesson" } }) },
    },
  },
  "/api/kids-ai/lessons/{id}": {
    get: {
      tags: ["KidsAI"], summary: "Get full lesson including content_md and ai_prompt",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
      responses: { "200": commonOk("Lesson", { $ref: "#/components/schemas/KidsLesson" }), "404": errorResponse("Not found") },
    },
  },
  "/api/kids-ai/ask": {
    post: {
      tags: ["KidsAI"], summary: "Ask a question via AI tutor (uses QCoreAI providers with child-safe prompt)",
      requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["question", "lang"], properties: { lessonId: { type: "integer" }, question: { type: "string" }, lang: { type: "string" } } } } } },
      responses: { "200": commonOk("AI answer", { type: "object", properties: { answer: { type: "string" } } }), "429": errorResponse("Rate limited") },
    },
  },
  "/api/kids-ai/progress": {
    post: {
      tags: ["KidsAI"], summary: "Record lesson completion",
      requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["childAlias", "lessonId"], properties: { childAlias: { type: "string" }, lessonId: { type: "integer" }, score: { type: "integer", minimum: 0, maximum: 100 } } } } } },
      responses: { "200": commonOk("Recorded", { type: "object" }) },
    },
  },
  "/api/kids-ai/progress/{childAlias}": {
    get: {
      tags: ["KidsAI"], summary: "Get progress for a child alias",
      parameters: [{ name: "childAlias", in: "path", required: true, schema: { type: "string" } }],
      responses: { "200": commonOk("Progress items", { type: "array", items: { type: "object" } }) },
    },
  },
  "/api/kids-ai/stats": {
    get: { tags: ["KidsAI"], summary: "Total lessons, languages count, categories", responses: { "200": commonOk("Stats", { type: "object" }) } },
  },

  // ---- MapReality ----
  "/api/mapreality/health": {
    get: { tags: ["MapReality"], summary: "MapReality health + signal count", security: [], responses: { "200": commonOk("ok", { type: "object" }) } },
  },
  "/api/mapreality/signals": {
    get: {
      tags: ["MapReality"], summary: "List signals sorted by support_count DESC",
      parameters: [
        { name: "category", in: "query", schema: { type: "string", enum: ["need", "event", "request"] } },
        { name: "country", in: "query", schema: { type: "string" } },
        { name: "status", in: "query", schema: { type: "string", enum: ["active", "resolved", "flagged"] } },
        { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
        { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
      ],
      responses: { "200": commonOk("Signals", { type: "array", items: { $ref: "#/components/schemas/MapSignal" } }) },
    },
    post: {
      tags: ["MapReality"], summary: "Submit a new signal (title ≤200, description ≤2000)",
      requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["title", "description", "category", "country", "authorAlias"], properties: {
        title: { type: "string", maxLength: 200 }, description: { type: "string", maxLength: 2000 },
        category: { type: "string", enum: ["need", "event", "request"] },
        country: { type: "string" }, city: { type: "string" }, lat: { type: "number" }, lng: { type: "number" },
        authorAlias: { type: "string" },
      } } } } },
      responses: { "200": commonOk("Created", { $ref: "#/components/schemas/MapSignal" }), "400": errorResponse("Validation error"), "429": errorResponse("Rate limited") },
    },
  },
  "/api/mapreality/signals/{id}": {
    get: {
      tags: ["MapReality"], summary: "Get single signal",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
      responses: { "200": commonOk("Signal", { $ref: "#/components/schemas/MapSignal" }), "404": errorResponse("Not found") },
    },
  },
  "/api/mapreality/signals/{id}/support": {
    post: {
      tags: ["MapReality"], summary: "+1 support (UNIQUE per alias — 409 on duplicate)",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
      requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["supporterAlias"], properties: { supporterAlias: { type: "string" } } } } } },
      responses: { "200": commonOk("New supportCount", { type: "object", properties: { supportCount: { type: "integer" } } }), "409": errorResponse("Already supported"), "429": errorResponse("Rate limited") },
    },
  },
  "/api/mapreality/signals/{id}/status": {
    patch: {
      tags: ["MapReality"], summary: "Mark signal as resolved (author only via alias match)",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
      requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["authorAlias", "status"], properties: { authorAlias: { type: "string" }, status: { type: "string", enum: ["resolved", "flagged"] } } } } } },
      responses: { "200": commonOk("Updated", { type: "object" }), "403": errorResponse("Alias mismatch"), "404": errorResponse("Not found") },
    },
  },
  "/api/mapreality/stats": {
    get: { tags: ["MapReality"], summary: "Total, byCategory, byCountry, topSignals (top 5)", responses: { "200": commonOk("Stats", { type: "object" }) } },
  },

  // ---- Voice of Earth ----
  "/api/voice-of-earth/health": {
    get: { tags: ["VoiceOfEarth"], summary: "Voice of Earth health + track count", security: [], responses: { "200": commonOk("ok", { type: "object" }) } },
  },
  "/api/voice-of-earth/tracks": {
    get: {
      tags: ["VoiceOfEarth"], summary: "List tracks sorted by votes DESC (seed loaded on first run)",
      parameters: [
        { name: "lang", in: "query", schema: { type: "string" } },
        { name: "mood", in: "query", schema: { type: "string", enum: ["hopeful", "peaceful", "joyful", "reflective", "uplifting"] } },
        { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
      ],
      responses: { "200": commonOk("Tracks", { type: "array", items: { $ref: "#/components/schemas/VoeTrack" } }) },
    },
    post: {
      tags: ["VoiceOfEarth"], summary: "Submit a new track (title ≤200, lyrics ≤10000, mood ENUM)",
      requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["title", "artistAlias", "language", "lyrics", "mood"], properties: {
        title: { type: "string", maxLength: 200 }, artistAlias: { type: "string" }, language: { type: "string" },
        lyrics: { type: "string", maxLength: 10000 }, mood: { type: "string", enum: ["hopeful", "peaceful", "joyful", "reflective", "uplifting"] },
        audioUrl: { type: "string", nullable: true },
      } } } } },
      responses: { "200": commonOk("Created", { $ref: "#/components/schemas/VoeTrack" }), "400": errorResponse("Validation error"), "429": errorResponse("Rate limited") },
    },
  },
  "/api/voice-of-earth/tracks/{id}": {
    get: {
      tags: ["VoiceOfEarth"], summary: "Get single track with full lyrics",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
      responses: { "200": commonOk("Track", { $ref: "#/components/schemas/VoeTrack" }), "404": errorResponse("Not found") },
    },
  },
  "/api/voice-of-earth/tracks/{id}/vote": {
    post: {
      tags: ["VoiceOfEarth"], summary: "+1 vote (UNIQUE per alias — 409 on duplicate)",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
      requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["voterAlias"], properties: { voterAlias: { type: "string" } } } } } },
      responses: { "200": commonOk("New votes count", { type: "object", properties: { votes: { type: "integer" } } }), "409": errorResponse("Already voted"), "429": errorResponse("Rate limited") },
    },
  },
  "/api/voice-of-earth/stats": {
    get: { tags: ["VoiceOfEarth"], summary: "Total, byLanguage, byMood, topTracks (top 5)", responses: { "200": commonOk("Stats", { type: "object" }) } },
  },
};
