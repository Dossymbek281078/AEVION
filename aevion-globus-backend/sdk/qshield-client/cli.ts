#!/usr/bin/env node
/**
 * @aevion/qshield-client — CLI helper.
 *
 *   npx @aevion/qshield-client reconstruct <shieldId> shard1.json [shard2.json ...]
 *   npx @aevion/qshield-client public <shieldId>
 *   npx @aevion/qshield-client health
 *
 * Env:
 *   AEVION_QSHIELD_BASE  default https://aevion-production-a70c.up.railway.app/api/quantum-shield
 *   AEVION_TOKEN         JWT bearer (only required for create / list mine / revoke / audit)
 */

import { readFileSync } from "node:fs";
import {
  QShieldClient,
  parseShardSource,
  type AuthenticatedShard,
} from "./index";

const BASE =
  process.env.AEVION_QSHIELD_BASE ||
  "https://aevion-production-a70c.up.railway.app/api/quantum-shield";
const TOKEN = process.env.AEVION_TOKEN;

function usage(): never {
  console.error(`Usage:
  qshield reconstruct <shieldId> <shard.json> [<shard.json> ...]
  qshield public <shieldId>
  qshield health
  qshield witness <shieldId>

Env:
  AEVION_QSHIELD_BASE  base URL (default: prod)
  AEVION_TOKEN         JWT bearer (for authenticated routes)
`);
  process.exit(2);
}

async function main() {
  const [, , cmd, ...rest] = process.argv;
  if (!cmd) usage();
  const client = new QShieldClient({ baseUrl: BASE, token: TOKEN });

  if (cmd === "health") {
    const h = await client.health();
    console.log(JSON.stringify(h, null, 2));
    return;
  }

  if (cmd === "public") {
    const id = rest[0];
    if (!id) usage();
    const view = await client.getPublic(id);
    console.log(JSON.stringify(view, null, 2));
    return;
  }

  if (cmd === "witness") {
    const id = rest[0];
    if (!id) usage();
    const w = await client.getWitness(id);
    console.log(JSON.stringify(w, null, 2));
    return;
  }

  if (cmd === "reconstruct") {
    const [id, ...files] = rest;
    if (!id || files.length === 0) usage();
    const shards: AuthenticatedShard[] = [];
    for (const f of files) {
      const raw = readFileSync(f, "utf-8");
      const parsed = JSON.parse(raw);
      const found = parseShardSource(parsed);
      if (found.length === 0) {
        console.error(`! ${f}: no shards found in JSON`);
        process.exit(3);
      }
      shards.push(...found);
    }
    if (shards.length < 2) {
      console.error(`! Need at least 2 shards, got ${shards.length}`);
      process.exit(3);
    }
    const idem =
      process.env.AEVION_IDEMPOTENCY_KEY ||
      `cli-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const verdict = await client.reconstruct(id, shards, { idempotencyKey: idem });
    console.log(JSON.stringify(verdict, null, 2));
    if (!verdict.valid) process.exit(1);
    return;
  }

  usage();
}

main().catch((e: unknown) => {
  if (e && typeof e === "object" && "name" in e && (e as { name: string }).name === "QShieldError") {
    const err = e as unknown as { status: number; body: unknown; message: string };
    console.error(`! ${err.message}`);
    if (err.body) console.error(JSON.stringify(err.body, null, 2));
    process.exit(1);
  }
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
