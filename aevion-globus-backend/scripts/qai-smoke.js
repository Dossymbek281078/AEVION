#!/usr/bin/env node
/**
 * QAI smoke test — universal AI assistant.
 * Usage: BASE=http://localhost:4001 node scripts/qai-smoke.js
 */
const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/$/, "");
let passed = 0, failed = 0;

function assert(label, cond, info = "") {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else       { console.error(`  ✗ ${label}${info ? " — " + info : ""}`); failed++; }
}

async function req(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(25000) };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  const text = await r.text();
  try { return { status: r.status, body: JSON.parse(text) }; }
  catch { return { status: r.status, body: text }; }
}

async function run() {
  console.log(`\nQAI smoke → ${BASE}\n`);

  console.log("1. Health");
  const h = await req("GET", "/api/qai/health");
  assert("GET /health → 200", h.status === 200, String(h.status));
  assert("ok === true", h.body?.ok === true);

  console.log("\n2. Personas");
  const personas = await req("GET", "/api/qai/personas");
  assert("GET /personas → 200", personas.status === 200);
  assert("personas array", Array.isArray(personas.body?.personas ?? personas.body));

  console.log("\n3. Models");
  const models = await req("GET", "/api/qai/models");
  assert("GET /models → 200", models.status === 200);

  console.log("\n4. Sessions list");
  const sessions = await req("GET", "/api/qai/sessions");
  assert("GET /sessions → 200", sessions.status === 200);
  assert("array response", Array.isArray(sessions.body?.sessions ?? sessions.body?.items ?? sessions.body));

  console.log("\n5. Chat (public)");
  const chat = await req("POST", "/api/qai/chat", { message: "Reply with exactly: PONG" });
  assert("POST /chat → 200", chat.status === 200, String(chat.status));
  const reply = chat.body?.reply ?? chat.body?.content ?? chat.body?.message ?? "";
  assert("reply is string", typeof reply === "string" && reply.length > 0);
  assert("usage object present", chat.body?.usage && typeof chat.body.usage.approxTotalTokens === "number");

  console.log("\n6. Chat with persona");
  const personaChat = await req("POST", "/api/qai/chat", { message: "ping", personaId: "coder" });
  assert("POST /chat with persona → 200", personaChat.status === 200);
  assert("personaId echoed", personaChat.body?.personaId === "coder");

  console.log("\n7. Persona list contains required ids");
  const personaIds = Array.isArray(personas.body?.personas)
    ? personas.body.personas.map((p) => p.id)
    : [];
  const required = ["assistant", "coder", "mentor", "critic"];
  for (const id of required) {
    assert(`persona '${id}' present`, personaIds.includes(id));
  }

  console.log("\n8. Invalid session → 404");
  const notFound = await req("GET", "/api/qai/sessions/does_not_exist_xyz_000");
  assert("GET /sessions/:invalid → 404 or 400", [404, 400].includes(notFound.status), String(notFound.status));

  console.log(`\nQAI: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
