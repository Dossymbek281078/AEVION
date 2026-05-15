#!/usr/bin/env node
/**
 * Chain integrity → Prometheus text exporter.
 *
 * Fetches `/api/veilnetx-ledger/chain/verify` and prints metrics in the
 * Prometheus exposition format. Designed to run as a scheduled job that
 * writes to a text-file collector (node_exporter --collector.textfile).
 *
 * Metrics emitted:
 *   veilnetx_chain_verified{base="..."}     0|1
 *   veilnetx_chain_length{base="..."}       <int>
 *   veilnetx_chain_broken_at{base="..."}    <int|NaN>  (only when verified=0)
 *   veilnetx_chain_check_age_seconds        0          (this run is fresh)
 *   veilnetx_chain_check_success            0|1        (HTTP reachability)
 *
 * Read-only. Safe against prod.
 *
 * Usage:
 *   node scripts/chain-prometheus.js
 *   BASE=https://aevion-production-a70c.up.railway.app node scripts/chain-prometheus.js \
 *     > /var/lib/node_exporter/textfile/veilnetx_chain.prom
 */

const BASE = (process.env.BASE || process.env.BACKEND_URL || "http://localhost:4001").replace(/\/+$/, "");

function emit(name, help, type, valueLine) {
  process.stdout.write(`# HELP ${name} ${help}\n`);
  process.stdout.write(`# TYPE ${name} ${type}\n`);
  process.stdout.write(`${valueLine}\n`);
}

async function main() {
  const label = `base="${BASE.replace(/"/g, "")}"`;
  let body = null; let httpOk = false;
  try {
    const r = await fetch(`${BASE}/api/veilnetx-ledger/chain/verify`);
    httpOk = r.status === 200;
    if (httpOk) body = await r.json();
  } catch {
    httpOk = false;
  }

  emit("veilnetx_chain_check_success",
    "1 if the verify endpoint was reachable and returned 200, 0 otherwise",
    "gauge",
    `veilnetx_chain_check_success{${label}} ${httpOk ? 1 : 0}`);

  if (!httpOk || !body) {
    process.exit(1);
  }

  emit("veilnetx_chain_verified",
    "1 if chain integrity holds end-to-end, 0 if any entry hash diverges",
    "gauge",
    `veilnetx_chain_verified{${label}} ${body.verified ? 1 : 0}`);

  emit("veilnetx_chain_length",
    "Number of entries currently in the VeilNetX ledger",
    "gauge",
    `veilnetx_chain_length{${label}} ${Number(body.length ?? 0)}`);

  if (body.brokenAt != null) {
    emit("veilnetx_chain_broken_at",
      "Sequence number of the first row whose computed hash diverges from stored (-1 if intact)",
      "gauge",
      `veilnetx_chain_broken_at{${label}} ${Number(body.brokenAt)}`);
  } else {
    emit("veilnetx_chain_broken_at",
      "Sequence number of the first row whose computed hash diverges from stored (-1 if intact)",
      "gauge",
      `veilnetx_chain_broken_at{${label}} -1`);
  }
}

main().catch((e) => { console.error("crash:", e instanceof Error ? e.message : e); process.exit(2); });
