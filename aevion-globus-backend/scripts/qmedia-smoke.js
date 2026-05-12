#!/usr/bin/env node
/**
 * QMedia smoke — verifies /api/qmedia/* surface.
 *
 * Tests: health → public lists → AI tools (stub mode) → authed CRUD → cleanup
 *
 * Note: QMedia storage is currently in-process Map<>; data evaporates on
 * restart. This smoke runs within a single process boundary so create/read/
 * delete operations are consistent — but multi-replica drift is NOT covered.
 * See REQ-D in AEVION_COORDINATION.md.
 *
 * Usage:
 *   node scripts/qmedia-smoke.js
 *   BASE=https://aevion-production-a70c.up.railway.app node scripts/qmedia-smoke.js
 */

const BASE = (process.env.BASE || process.env.BACKEND_URL || "http://localhost:4001").replace(/\/+$/, "");

let passed = 0; let failed = 0;
function ok(l, e) { passed++; console.log(`  ✓ ${l}${e ? "  " + e : ""}`); }
function fail(l, r) { failed++; console.error(`  ✗ ${l}${r ? "  ↳ " + r : ""}`); }

async function req(method, path, body, token) {
  const h = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  const r = await fetch(`${BASE}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  let json; try { json = await r.json(); } catch { json = {}; }
  return { status: r.status, body: json };
}

async function run() {
  console.log(`\nQMedia smoke → ${BASE}\n`);

  // ── Health
  let r = await req("GET", "/api/qmedia/health");
  if ((r.status === 200 || r.status === 503) && r.body?.service === "qmedia") {
    ok("GET /health", `db=${r.body.db ?? "n/a"} storage=${r.body.storage ?? "n/a"}`);
  } else fail("GET /health", `${r.status}`);

  // ── Public lists (anonymous — empty or populated)
  r = await req("GET", "/api/qmedia/tracks?limit=5");
  if (r.status === 200 && Array.isArray(r.body?.items)) ok("GET /tracks", `count=${r.body.items.length}`);
  else fail("GET /tracks", `${r.status}`);

  r = await req("GET", "/api/qmedia/videos?limit=5");
  if (r.status === 200 && Array.isArray(r.body?.items)) ok("GET /videos", `count=${r.body.items.length}`);
  else fail("GET /videos", `${r.status}`);

  r = await req("GET", "/api/qmedia/playlists");
  if (r.status === 200 && Array.isArray(r.body?.items)) ok("GET /playlists", `count=${r.body.items.length}`);
  else fail("GET /playlists", `${r.status}`);

  // ── AI tools (stub mode if no provider configured)
  r = await req("POST", "/api/qmedia/ai/generate-lyrics", { genre: "pop", mood: "upbeat", theme: "smoke test", lines: 4 });
  if (r.status === 200 && typeof r.body?.lyrics === "string") ok("POST /ai/generate-lyrics", `mode=${r.body.mode ?? "live"}`);
  else fail("POST /ai/generate-lyrics", `${r.status}`);

  r = await req("POST", "/api/qmedia/ai/generate-color-palette", { mood: "happy" });
  if (r.status === 200 && Array.isArray(r.body?.colors) && r.body.colors.length >= 5) ok("POST /ai/generate-color-palette", `count=${r.body.colors.length}`);
  else fail("POST /ai/generate-color-palette", `${r.status}`);

  // ── Auth required for me/* endpoints
  r = await req("GET", "/api/qmedia/me/tracks");
  if (r.status === 401) ok("GET /me/tracks rejects anonymous");
  else fail("GET /me/tracks should 401", `${r.status}`);

  // ── Register a test user
  const EMAIL = `qmedia-smoke-${Date.now()}@aevion.test`;
  r = await req("POST", "/api/auth/register", { email: EMAIL, password: "QMediaSmoke123!", name: "QMediaBot" });
  if ((r.status === 200 || r.status === 201) && r.body?.token) ok("register");
  else { fail("register", `${r.status}`); process.exit(1); }
  const token = r.body.token;

  // ── Authed create track
  r = await req("POST", "/api/qmedia/me/tracks", {
    title: "Smoke Test Track",
    artist: "QMediaBot",
    genre: "electronic",
    url: "https://example.com/audio/smoke.mp3",
    isPublic: true,
    tags: ["smoke", "test"],
  }, token);
  let trackId;
  if (r.status === 201 && r.body?.id) {
    trackId = r.body.id;
    ok("POST /me/tracks", `id=${trackId.slice(0, 8)}`);
  } else fail("POST /me/tracks", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);

  // ── Validation: missing title
  r = await req("POST", "/api/qmedia/me/tracks", { artist: "x" }, token);
  if (r.status === 400) ok("POST /me/tracks rejects missing title");
  else fail("POST /me/tracks should reject missing title", `${r.status}`);

  // ── Read my tracks
  r = await req("GET", "/api/qmedia/me/tracks", null, token);
  if (r.status === 200 && Array.isArray(r.body?.items) && r.body.items.length >= 1) ok("GET /me/tracks", `count=${r.body.items.length}`);
  else fail("GET /me/tracks", `${r.status}`);

  // ── Play counter
  if (trackId) {
    r = await req("POST", `/api/qmedia/tracks/${trackId}/play`);
    if (r.status === 200 && typeof r.body?.playCount === "number") ok("POST /tracks/:id/play", `count=${r.body.playCount}`);
    else fail("POST /tracks/:id/play", `${r.status}`);
  }

  // ── Like flow
  if (trackId) {
    r = await req("POST", `/api/qmedia/track/${trackId}/like`, null, token);
    if (r.status === 200 && r.body?.liked === true) ok("POST /track/:id/like (toggle on)");
    else fail("POST /track/:id/like", `${r.status}`);

    r = await req("POST", `/api/qmedia/track/${trackId}/like`, null, token);
    if (r.status === 200 && r.body?.liked === false) ok("POST /track/:id/like (toggle off)");
    else fail("POST /track/:id/like (toggle off)", `${r.status}`);
  }

  // ── Create playlist
  r = await req("POST", "/api/qmedia/me/playlists", {
    name: "Smoke Test Playlist",
    description: "Auto-created by smoke test",
    isPublic: false,
  }, token);
  let playlistId;
  if (r.status === 201 && r.body?.id) {
    playlistId = r.body.id;
    ok("POST /me/playlists", `id=${playlistId.slice(0, 8)}`);
  } else fail("POST /me/playlists", `${r.status}`);

  // ── Add track to playlist
  if (playlistId && trackId) {
    r = await req("POST", `/api/qmedia/me/playlists/${playlistId}/tracks`, { trackId }, token);
    if (r.status === 200 && Array.isArray(r.body?.trackIds) && r.body.trackIds.includes(trackId)) {
      ok("POST /me/playlists/:id/tracks");
    } else fail("POST /me/playlists/:id/tracks", `${r.status}`);
  }

  // ── Delete track
  if (trackId) {
    r = await req("DELETE", `/api/qmedia/me/tracks/${trackId}`, null, token);
    if (r.status === 200 && r.body?.deleted) ok("DELETE /me/tracks/:id");
    else fail("DELETE /me/tracks/:id", `${r.status}`);
  }

  // ── Delete playlist
  if (playlistId) {
    r = await req("DELETE", `/api/qmedia/me/playlists/${playlistId}`, null, token);
    if (r.status === 200 && r.body?.deleted) ok("DELETE /me/playlists/:id");
    else fail("DELETE /me/playlists/:id", `${r.status}`);
  }

  // ── Cleanup user
  r = await req("DELETE", "/api/auth/account", { password: "QMediaSmoke123!" }, token);
  if (r.status === 200 || r.status === 204) ok("DELETE /account");
  else fail("DELETE /account", `${r.status}`);

  console.log(`\n${passed + failed} assertions — ${passed} PASS  ${failed} FAIL\n`);
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error("crash:", e); process.exit(2); });
