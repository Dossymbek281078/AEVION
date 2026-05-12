#!/usr/bin/env node
/**
 * QMedia smoke test — tracks, playlists, videos.
 * Usage: BASE=http://localhost:4001 node scripts/qmedia-smoke.js
 *        TEST_JWT=<token> BASE=... node scripts/qmedia-smoke.js
 */
const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/$/, "");
const JWT  = process.env.TEST_JWT || "";
let passed = 0, failed = 0;

function assert(label, cond, info = "") {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else       { console.error(`  ✗ ${label}${info ? " — " + info : ""}`); failed++; }
}

async function req(method, path, body, headers = {}) {
  const opts = { method, headers: { "Content-Type": "application/json", ...headers }, signal: AbortSignal.timeout(8000) };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  const text = await r.text();
  try { return { status: r.status, body: JSON.parse(text) }; }
  catch { return { status: r.status, body: text }; }
}

async function run() {
  console.log(`\nQMedia smoke → ${BASE}\n`);

  console.log("1. Public tracks");
  const tracks = await req("GET", "/api/qmedia/tracks");
  assert("GET /tracks → 200", tracks.status === 200, String(tracks.status));
  assert("tracks array", Array.isArray(tracks.body?.tracks ?? tracks.body));

  console.log("\n2. Playlists");
  const playlists = await req("GET", "/api/qmedia/playlists");
  assert("GET /playlists → 200", playlists.status === 200, String(playlists.status));
  assert("playlists array", Array.isArray(playlists.body?.playlists ?? playlists.body));

  console.log("\n3. Videos");
  const videos = await req("GET", "/api/qmedia/videos");
  assert("GET /videos → 200", videos.status === 200, String(videos.status));
  assert("videos array", Array.isArray(videos.body?.videos ?? videos.body));

  console.log("\n4. Auth gates");
  const noAuthTrack = await req("POST", "/api/qmedia/me/tracks", { title: "Test", url: "https://x.com" });
  assert("POST /me/tracks without auth → 401", noAuthTrack.status === 401, String(noAuthTrack.status));
  const noAuthPlaylist = await req("POST", "/api/qmedia/me/playlists", { name: "Test" });
  assert("POST /me/playlists without auth → 401", noAuthPlaylist.status === 401, String(noAuthPlaylist.status));

  if (JWT) {
    console.log("\n5. Authenticated flow");
    const authH = { Authorization: `Bearer ${JWT}` };
    const myTracks = await req("GET", "/api/qmedia/me/tracks", null, authH);
    assert("GET /me/tracks → 200", myTracks.status === 200);
    assert("my tracks array", Array.isArray(myTracks.body?.tracks ?? myTracks.body));
    const myPlaylists = await req("GET", "/api/qmedia/me/playlists", null, authH);
    assert("GET /me/playlists → 200", myPlaylists.status === 200);
  } else {
    console.log("\n5. [Skipping auth flow — no TEST_JWT]");
  }

  console.log(`\nQMedia: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
