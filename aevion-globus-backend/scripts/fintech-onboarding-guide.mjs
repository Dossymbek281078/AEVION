#!/usr/bin/env node
/**
 * AEVION fintech onboarding guide — interactive walk-through for new integrators.
 *
 * Prints a checklist of the 5 fintech modules with one-line elevator pitch,
 * the smallest possible REST call to prove each is reachable, the env vars
 * you'd flip to go from sandbox to prod, and the "graduation" task that
 * proves you understand the surface.
 *
 * Zero side effects unless --probe is passed. With --probe each module's
 * public health endpoint is hit and a pass/fail tile is shown.
 *
 * Env:
 *   BASE   backend URL (default https://aevion-production-a70c.up.railway.app)
 *
 * Usage:
 *   node scripts/fintech-onboarding-guide.mjs            print guide
 *   node scripts/fintech-onboarding-guide.mjs --probe    print + live health probes
 *   node scripts/fintech-onboarding-guide.mjs --json     machine-readable output
 *
 * Zone: aevion-core/main owns aevion-globus-backend/scripts/**
 */

const BASE = (process.env.BASE || "https://aevion-production-a70c.up.railway.app").replace(/\/+$/, "");
const args = new Set(process.argv.slice(2));
const PROBE = args.has("--probe");
const JSON_OUT = args.has("--json");

const isTTY = !!process.stdout.isTTY && !JSON_OUT;
const C = {
  reset:  isTTY ? "\x1b[0m"  : "",
  bold:   isTTY ? "\x1b[1m"  : "",
  dim:    isTTY ? "\x1b[2m"  : "",
  red:    isTTY ? "\x1b[31m" : "",
  green:  isTTY ? "\x1b[32m" : "",
  yellow: isTTY ? "\x1b[33m" : "",
  cyan:   isTTY ? "\x1b[36m" : "",
  purple: isTTY ? "\x1b[35m" : "",
  gray:   isTTY ? "\x1b[90m" : "",
};

const MODULES = [
  {
    id: "veilnetx",
    icon: "🌀",
    name: "VeilNetX",
    pitch: "Append-only hash-chained settlement ledger.",
    proof: "GET /api/veilnetx-ledger/head",
    healthPath: "/api/veilnetx-ledger/head",
    env: ["VEILNETX_HMAC_SECRET (server-side, blinds participants)"],
    graduation: "Verify the chain end-to-end: GET /api/veilnetx-ledger/chain/verify",
  },
  {
    id: "qgood",
    icon: "💚",
    name: "QGood",
    pitch: "Transparent charity with VeilNetX-anchored receipts.",
    proof: "GET /api/qgood/campaigns",
    healthPath: "/api/qgood/stats",
    env: ["No extra vars — inherits platform JWT"],
    graduation: "Make a $1 donation and see it appear at /api/veilnetx-ledger/head with kind=donation.",
  },
  {
    id: "qmaskcard",
    icon: "🪪",
    name: "QMaskCard",
    pitch: "Single-use virtual PANs that hide the real funding source.",
    proof: "GET /api/qmaskcard/stats (auth required)",
    healthPath: "/api/qmaskcard/stats",
    env: ["QPAYNET_BRIDGE=on (to route mask charges back to wallet)"],
    graduation: "Issue a mask, charge it once, watch the merchant lock activate.",
  },
  {
    id: "ztide",
    icon: "🌊",
    name: "Z-Tide",
    pitch: "Soft, decaying reputation across all AEVION actions.",
    proof: "GET /api/ztide/leaderboard",
    healthPath: "/api/ztide/stats",
    env: ["ZTIDE_RANK_OVERRIDES (optional admin allowlist for granting rank)"],
    graduation: "Claim a login streak — POST /api/ztide/claim-streak — and watch your rank shift.",
  },
  {
    id: "qchaingov",
    icon: "🗳",
    name: "QChainGov",
    pitch: "Proposal lifecycle + one-vote-per-user voting + admin execution.",
    proof: "GET /api/qchaingov/proposals?status=active",
    healthPath: "/api/qchaingov/stats",
    env: ["QCHAINGOV_ADMIN_EMAILS=you@example.com (controls /execute)"],
    graduation: "Open a proposal, cast a vote, run /tally, /execute as admin.",
  },
];

async function probe(path) {
  if (!PROBE) return null;
  const t0 = Date.now();
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 5000);
    const r = await fetch(`${BASE}${path}`, { signal: ctl.signal, headers: { Accept: "application/json" } });
    clearTimeout(timer);
    const ms = Date.now() - t0;
    return { ok: r.ok, status: r.status, ms };
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - t0, error: String(e && e.message || e) };
  }
}

function bar() {
  return `${C.gray}${"─".repeat(72)}${C.reset}`;
}

function printHeader() {
  console.log("");
  console.log(`${C.bold}${C.purple}AEVION Fintech — Onboarding Guide${C.reset}`);
  console.log(`${C.gray}Base: ${BASE}${C.reset}`);
  if (PROBE) console.log(`${C.gray}Live probes: on${C.reset}`);
  console.log("");
  console.log(`${C.dim}5 modules · interlocking · ship in this order →${C.reset}`);
  console.log("");
}

function printModule(m, probeResult, idx) {
  console.log(bar());
  console.log(`${C.bold}${m.icon} ${m.name}${C.reset}  ${C.dim}#${idx + 1}/${MODULES.length}${C.reset}`);
  console.log(`  ${C.gray}${m.pitch}${C.reset}`);
  console.log("");
  console.log(`  ${C.bold}Smallest proof of life${C.reset}`);
  console.log(`    ${C.cyan}${m.proof}${C.reset}`);
  if (probeResult) {
    const dot = probeResult.ok ? `${C.green}●${C.reset}` : `${C.red}●${C.reset}`;
    const label = probeResult.ok ? `${C.green}live${C.reset}` : `${C.red}down${C.reset}`;
    const err = probeResult.error ? ` ${C.red}(${probeResult.error})${C.reset}` : "";
    console.log(`    ${dot} ${label} · ${probeResult.status || "—"} · ${probeResult.ms}ms${err}`);
  }
  console.log("");
  console.log(`  ${C.bold}Env to flip${C.reset}`);
  for (const e of m.env) console.log(`    · ${C.yellow}${e}${C.reset}`);
  console.log("");
  console.log(`  ${C.bold}Graduation task${C.reset}`);
  console.log(`    ${C.green}${m.graduation}${C.reset}`);
  console.log("");
}

function printFooter() {
  console.log(bar());
  console.log("");
  console.log(`${C.bold}Next steps${C.reset}`);
  console.log(`  • Read the whitepaper:   ${C.cyan}https://aevion.app/fintech/whitepaper${C.reset}`);
  console.log(`  • Open the dashboard:    ${C.cyan}https://aevion.app/fintech/dashboard${C.reset}`);
  console.log(`  • Run the 6-curl quickstart: ${C.cyan}https://aevion.app/developers/fintech/quickstart${C.reset}`);
  console.log(`  • Troubleshoot:          ${C.cyan}https://aevion.app/developers/fintech/troubleshooting${C.reset}`);
  console.log(`  • OpenAPI spec:          ${C.cyan}${BASE}/api/openapi.json${C.reset}`);
  console.log("");
  console.log(`${C.dim}Once all 5 graduation tasks pass, you've onboarded.${C.reset}`);
  console.log("");
}

async function main() {
  // Collect probe results in parallel up-front
  const probes = await Promise.all(MODULES.map((m) => probe(m.healthPath)));

  if (JSON_OUT) {
    const out = {
      base: BASE,
      probed: PROBE,
      modules: MODULES.map((m, i) => ({
        id: m.id,
        name: m.name,
        pitch: m.pitch,
        proof: m.proof,
        env: m.env,
        graduation: m.graduation,
        probe: probes[i] || null,
      })),
    };
    process.stdout.write(JSON.stringify(out, null, 2) + "\n");
    return;
  }

  printHeader();
  MODULES.forEach((m, i) => printModule(m, probes[i], i));
  printFooter();

  if (PROBE) {
    const downCount = probes.filter((p) => p && !p.ok).length;
    process.exit(downCount === 0 ? 0 : 1);
  }
}

main().catch((e) => {
  console.error(`${C.red}fatal:${C.reset}`, e);
  process.exit(2);
});
