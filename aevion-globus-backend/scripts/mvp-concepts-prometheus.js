#!/usr/bin/env node
/**
 * MVP concepts → Prometheus text exporter.
 *
 * Walks /api/<id>/concept-stats for the 10 ownerless modules and prints
 * Prometheus exposition-format text. Designed for node_exporter
 * --collector.textfile in a 1-2 minute cron (lightweight: 10 GETs).
 *
 * Metrics emitted (one labeled series per module):
 *   mvp_concept_total{module,noun}           gauge — lifetime item count
 *   mvp_concept_last7days{module,noun}       gauge — rolling 7-day window
 *   mvp_concept_check_success{module}        0|1   — HTTP reachability per probe
 *   mvp_concept_check_age_seconds            gauge — 0 (this run is fresh)
 *
 * Read-only. Safe against prod.
 *
 * Usage:
 *   node scripts/mvp-concepts-prometheus.js
 *   BASE=https://aevion-production-a70c.up.railway.app \
 *     node scripts/mvp-concepts-prometheus.js \
 *     > /var/lib/node_exporter/textfile/mvp_concepts.prom
 */

const BASE = (process.env.BASE || process.env.BACKEND_URL || "http://localhost:4001").replace(/\/+$/, "");

// Mirrors the CONCEPTS table in src/routes/mvpConcepts.ts.
const MODULES = [
  { id: "startup-exchange", noun: "listings"   },
  { id: "mapreality",       noun: "claims"     },
  { id: "kids-ai-content",  noun: "items"      },
  { id: "qlife",            noun: "prompts"    },
  { id: "psyapp-deps",      noun: "assessments"},
  { id: "qpersona",         noun: "personas"   },
  { id: "voice-of-earth",   noun: "feeds"      },
  { id: "deepsan",          noun: "runs"       },
  { id: "shadownet",        noun: "posts"      },
  { id: "lifebox",          noun: "capsules"   },
];

function emitHelp(name, help, type) {
  process.stdout.write(`# HELP ${name} ${help}\n`);
  process.stdout.write(`# TYPE ${name} ${type}\n`);
}

async function getJson(path) {
  try {
    const r = await fetch(`${BASE}${path}`);
    if (r.status !== 200) return { ok: false };
    const body = await r.json();
    return { ok: true, body };
  } catch {
    return { ok: false };
  }
}

async function main() {
  const totals = [];
  const last7 = [];
  const probes = [];

  for (const m of MODULES) {
    const r = await getJson(`/api/${m.id}/concept-stats`);
    if (r.ok && typeof r.body?.total === "number") {
      totals.push(`mvp_concept_total{module="${m.id}",noun="${m.noun}"} ${Number(r.body.total)}`);
      last7.push(`mvp_concept_last7days{module="${m.id}",noun="${m.noun}"} ${Number(r.body.last7days ?? 0)}`);
      probes.push(`mvp_concept_check_success{module="${m.id}"} 1`);
    } else {
      probes.push(`mvp_concept_check_success{module="${m.id}"} 0`);
    }
  }

  emitHelp("mvp_concept_total", "Lifetime item count per MVP concept module", "gauge");
  totals.forEach((l) => process.stdout.write(l + "\n"));

  emitHelp("mvp_concept_last7days", "Items created in the rolling 7-day window per module", "gauge");
  last7.forEach((l) => process.stdout.write(l + "\n"));

  emitHelp("mvp_concept_check_success", "1 if /concept-stats endpoint reachable + valid for module, 0 otherwise", "gauge");
  probes.forEach((l) => process.stdout.write(l + "\n"));

  emitHelp("mvp_concept_check_age_seconds", "Seconds since this exporter ran (0 immediately after run)", "gauge");
  process.stdout.write(`mvp_concept_check_age_seconds 0\n`);
}

main().catch((e) => { console.error("crash:", e instanceof Error ? e.message : e); process.exit(2); });
