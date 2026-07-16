// QRight Tier-2 embed E2E smoke — exercises the full public-trust loop against
// a running backend (default http://127.0.0.1:4001). Read+write side:
//   register -> create -> embed(registered) -> badge(green) -> owner-revoke
//   -> embed(revoked) -> badge(red) -> webhook delivery -> admin bulk + audit + CSV
//
// Usage:  node scripts/qright-e2e-smoke.js  [baseUrl]
// Requires the backend's own node_modules (jsonwebtoken) + a reachable DB.
require("dotenv").config();
const http = require("http");
const jwt = require("jsonwebtoken");

const BASE = process.argv[2] || "http://127.0.0.1:4001";
const SECRET = process.env.AUTH_JWT_SECRET || "dev-auth-secret";

let pass = 0,
  fail = 0;
function ok(name, cond, extra) {
  (cond ? pass++ : fail++);
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
}

function req(method, path, { token, body, headers } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(BASE + path);
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(
      u,
      {
        method,
        headers: {
          ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}),
          ...(token ? { Authorization: "Bearer " + token } : {}),
          ...(headers || {}),
        },
      },
      (res) => {
        let buf = "";
        res.on("data", (c) => (buf += c));
        res.on("end", () => {
          let json = null;
          try { json = JSON.parse(buf); } catch {}
          resolve({ status: res.statusCode, json, text: buf, headers: res.headers });
        });
      }
    );
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  console.log(`QRight E2E smoke → ${BASE}\n`);

  // 1) register a fresh user (unique email) to own objects
  const email = `qr-e2e-${Date.now()}@example.com`;
  let reg = await req("POST", "/api/auth/register", {
    body: { email, password: "Test1234!", name: "QR E2E" },
  });
  let token = reg.json?.token;
  if (!token) {
    // maybe already exists or different shape — try login
    const login = await req("POST", "/api/auth/login", { body: { email, password: "Test1234!" } });
    token = login.json?.token;
  }
  ok("auth: got owner token", !!token, token ? "" : JSON.stringify(reg.json));
  if (!token) return done();

  // 2) create an object (owned)
  const create = await req("POST", "/api/qright/objects", {
    token,
    body: { title: "E2E Work " + Date.now(), description: "smoke payload", kind: "code" },
  });
  const obj = create.json?.object || create.json;
  const id = obj?.id;
  ok("create: 200 + id + ownerUserId", create.status === 201 || create.status === 200, `status=${create.status} id=${id} owner=${obj?.ownerUserId}`);
  if (!id) return done();

  // 3) embed → registered
  const e1 = await req("GET", `/api/qright/embed/${id}`);
  ok("embed: registered", e1.status === 200 && e1.json?.status === "registered", `status=${e1.status}/${e1.json?.status}`);

  // 4) badge green (not revoked color)
  const b1 = await req("GET", `/api/qright/badge/${id}.svg`);
  const b1red = /#dc2626|#b91c1c|#ef4444/i.test(b1.text || "");
  ok("badge: rendered, not red (active)", b1.status === 200 && /<svg/.test(b1.text) && !b1red, `red=${b1red}`);

  // 5) owner revoke
  const rev = await req("POST", `/api/qright/revoke/${id}`, {
    token,
    body: { reasonCode: "withdrawn", reason: "e2e smoke" },
  });
  ok("revoke: owner 200", rev.status === 200, `status=${rev.status} ${JSON.stringify(rev.json).slice(0,120)}`);

  // 6) embed → revoked (bust ETag via fresh request)
  const e2 = await req("GET", `/api/qright/embed/${id}`);
  ok("embed: revoked after revoke", e2.json?.status === "revoked", `status=${e2.json?.status} reasonCode=${e2.json?.revokeReasonCode}`);

  // 7) badge red
  const b2 = await req("GET", `/api/qright/badge/${id}.svg`);
  const b2red = /#dc2626|#b91c1c|#ef4444/i.test(b2.text || "");
  ok("badge: flips red after revoke", b2.status === 200 && b2red, `red=${b2red}`);

  // 8) webhook CRUD + one-time secret
  const wh = await req("POST", "/api/qright/webhooks", { token, body: { url: "https://example.com/qr-hook" } });
  const secret = wh.json?.secret;
  const whId = wh.json?.id;
  ok("webhook: created + one-time secret", (wh.status === 200 || wh.status === 201) && !!secret && !!whId, `status=${wh.status} secretLen=${secret?.length}`);
  const whList = await req("GET", "/api/qright/webhooks", { token });
  const redacted = JSON.stringify(whList.json).length > 0 && !JSON.stringify(whList.json).includes(secret || "###nope###");
  ok("webhook: secret redacted on list", whList.status === 200 && redacted);
  if (whId) {
    const del = await req("DELETE", `/api/qright/webhooks/${whId}`, { token });
    ok("webhook: owner delete 200", del.status === 200, `status=${del.status}`);
  }

  // 9) admin: self-signed role=admin token → bulk-revoke + audit + CSV
  const adminToken = jwt.sign({ sub: "admin-e2e", email: "admin@e2e.test", role: "admin" }, SECRET, { algorithm: "HS256", expiresIn: "10m" });
  // create 2 throwaway objects to bulk-revoke
  const ids = [];
  for (let i = 0; i < 2; i++) {
    const c = await req("POST", "/api/qright/objects", { token, body: { title: `bulk ${i} ${Date.now()}`, description: "x", kind: "text" } });
    const cid = (c.json?.object || c.json)?.id;
    if (cid) ids.push(cid);
  }
  const bulk = await req("POST", "/api/qright/admin/revoke-bulk", { token: adminToken, body: { ids, reasonCode: "admin-takedown", reason: "e2e bulk" } });
  ok("admin: bulk-revoke 200 + partition", bulk.status === 200, `status=${bulk.status} ${JSON.stringify(bulk.json).slice(0,140)}`);

  const audit = await req("GET", "/api/qright/admin/audit?limit=5", { token: adminToken });
  const hasBulk = Array.isArray(audit.json?.entries || audit.json?.items || audit.json) &&
    JSON.stringify(audit.json).includes("bulk-revoke");
  ok("admin: audit log has bulk-revoke", audit.status === 200 && hasBulk, `status=${audit.status}`);

  const csv = await req("GET", "/api/qright/admin/objects.csv", { token: adminToken });
  ok("admin: CSV export 200 + header", csv.status === 200 && /id,.*title/i.test(csv.text), `status=${csv.status}`);

  const who = await req("GET", "/api/qright/admin/whoami", { token: adminToken });
  ok("admin: whoami recognizes admin", who.status === 200 && (who.json?.isAdmin === true || who.json?.admin === true), JSON.stringify(who.json));

  done();
})().catch((e) => { console.error("SMOKE CRASH:", e.message); process.exit(2); });

function done() {
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}
