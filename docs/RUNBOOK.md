# AEVION — operations runbook

> **Created** 2026-05-03 · part of `docs/AEVION_MASTER_PLAN.md` § 4 Phase 1 (P1-4 + P1-5).
>
> Read top to bottom on Day 1 of any incident or rollout. Procedures
> below were drilled against a local dev backend — re-drill quarterly
> against staging once Phase 0 lands.

## § 1 Recovery objectives (RTO / RPO)

| Tier | Module | RTO | RPO | Snapshot frequency | Notes |
|---|---|---|---|---|---|
| 1 | Postgres (all modules) | 30 min | 24 h | Railway daily auto-backup + pg_dump weekly | RPO drops to 1 h once we wire WAL to S3 |
| 1 | JSON file store (legacy: leads, newsletter, partners) | 15 min | 24 h | Manual `npm run backup` daily | Migrate to Postgres before public launch — Railway fs is ephemeral |
| 2 | Sentry events | n/a | n/a | Sentry retention (90d) | No restore — outbound only |
| 2 | Vercel build artefacts | 5 min | n/a | Re-trigger build from main | Build is reproducible from git |
| 3 | Crypto secrets (`QSIGN_*`, `SHARD_HMAC_SECRET`) | 0 (don't lose them) | 0 | 1Password vault + offline paper | **Losing these invalidates every signed cert** |

Definitions:
- **RTO** = maximum acceptable time to restore service after an outage.
- **RPO** = maximum acceptable data loss (in time units before the failure).

## § 2 Backup procedures

### 2.1 Postgres (Tier 1 — all modules)

**Production:** Railway takes a daily snapshot automatically. Manual override:

```bash
# Set DATABASE_URL to the prod / staging URL.
DATABASE_URL=postgres://... \
  pg_dump --format=custom --no-owner --no-privileges \
    --file=aevion-$(date -u +%Y-%m-%dT%H-%M-%SZ).pgdump
```

Custom format (`-F c`) is compressed and supports parallel restore.

**Where to store:** copy the dump to S3 / R2 / GCS (NOT the same Railway
volume — single-point-of-failure defeats the backup). Naming:
`aevion-prod-2026-05-03T14-30-00Z.pgdump`.

**Verify the dump is non-empty:**

```bash
pg_restore --list aevion-prod-2026-05-03T14-30-00Z.pgdump | head -20
# expect: ; Archive created at YYYY-MM-DD ...
#         ; ... a non-zero number of TABLE entries
```

### 2.2 JSON file store (Tier 1 — legacy landing-page leads)

```bash
cd aevion-globus-backend
npm run backup           # → .aevion-backups/<UTC-stamp>/
# or with retention:
node scripts/backup.mjs --keep 10
```

Source dir comes from `AEVION_DATA_DIR` (default `./.aevion-data`). On
Railway you must point this at a persistent volume — see
`docs/PROD_ENV_CHECKLIST.md` § 2 "File-based stores".

## § 3 Restore procedures

### 3.1 Postgres restore (DRILL EVERY 90 DAYS)

```bash
# 1. Stop writes to the target DB (drain traffic / set Railway service to off).

# 2. Drop & recreate the database (or use a fresh one with the same name):
psql "$DATABASE_URL" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'

# 3. Restore from the dump:
pg_restore --no-owner --no-privileges --jobs=4 \
  --dbname="$DATABASE_URL" \
  aevion-prod-2026-05-03T14-30-00Z.pgdump

# 4. Smoke check:
psql "$DATABASE_URL" -c '\dt' | wc -l        # should match the original table count
psql "$DATABASE_URL" -c 'SELECT COUNT(*) FROM "AEVIONUser";'

# 5. Resume traffic.
```

### 3.2 JSON file store restore

```bash
cd aevion-globus-backend
node scripts/restore.mjs --list                      # list snapshots
node scripts/restore.mjs 2026-05-03T14-53-05Z --yes  # apply
```

The current state is itself snapshotted into
`<backups>/<stamp>.pre-restore/` before being overwritten — reversible.

**Drill verification (2026-05-03):**

```
[backup] snapshot 2026-05-03T14-53-05Z — 2 file(s) → .aevion-backups/...
[restore] preserved 2 current file(s) → .aevion-backups/2026-05-03T14-53-35Z.pre-restore
[restore] restored 2 file(s) from 2026-05-03T14-53-05Z → .aevion-data
```

Round-trip: corrupted `users.json` → restore → original content reappears.

## § 4 Crypto secrets — special case

If you lose `QSIGN_HMAC_V1_SECRET` or `QSIGN_ED25519_V1_PRIVATE`:

1. **You cannot re-derive past signatures.** Every QSign-issued certificate
   is permanently unverifiable through that key.
2. **You can issue new certificates** by generating a fresh keypair and
   rotating it in via `POST /api/qsign/v2/keys/rotate` (see QSIGN_V2.md
   § P3). Old certs remain frozen-but-readable as long as the retired key
   row stays in the `QSignKey` table.
3. The same applies to `SHARD_HMAC_SECRET` — old shards become unverifiable.

Storage:
- **Hot copy:** Railway env (encrypted at rest by Railway).
- **Cold copy:** 1Password "AEVION ops" vault, named `qsign/hmac-v1` etc.
- **Paper copy:** print + safe-deposit. Yes, on actual paper. Crypto secrets
  are the one thing that's worth physical isolation.

## § 5 Sentry alert routing

(Wired by `src/lib/sentry/platform.ts` + `src/lib/qsignV2/sentry.ts` on
every 5xx path across bureau / awards / planet / pipeline / qright + qsign-v2 + qshield.)

| Signal | Action |
|---|---|
| `service: <module>` errors > 10/hour | Slack #aevion-alerts (oncall ping) |
| `service: qsign-v2` + `errorCode: SIGN_FAILED` (any) | PagerDuty — signing pipeline outage is P0 |
| `service: bureau` + `route: verify/start` (any) | Slack — KYC provider down |
| `service: awards` + `route: finalize` (any) | Slack — payout pipeline at risk |

(Configure these as Sentry Alert Rules in the AEVION project. Until then,
use the default email digest.)

## § 6 Smoke verification (post-restore / post-deploy)

After any restore or deploy, run the daily smoke pass against the target:

```bash
cd aevion-globus-backend
BASE=https://api.aevion.app npm run smoke:read-only   # safe for prod (read-only)
BASE=http://127.0.0.1:4001 npm run smoke:all          # full pass on ephemeral env
```

The orchestrator runs: tier3 (always), then mutating smokes only when
`READ_ONLY=0`. See `scripts/all-smokes.js` § SMOKES.

For the auth security fix specifically:

```bash
BASE=http://127.0.0.1:4001 npm run smoke:auth-replay
```

Expects: T1 works → /logout revokes → T1 replay returns 401 → fresh login
T2 works.

## § 7 Common operational tasks

### Rotate `AUTH_JWT_SECRET`

1. Generate the new secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
2. Set `AUTH_JWT_SECRET` to the new value on Railway.
3. Redeploy. **Every existing JWT becomes invalid** — users will be
   force-logged-out within ~30 seconds. Communicate the cutover.

### Rotate a QSign v2 key (HMAC or Ed25519)

Per QSIGN_V2.md § P3:

```bash
curl -X POST https://api.aevion.app/api/qsign/v2/keys/rotate \
  -H "Authorization: Bearer <ADMIN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{ "kind": "hmac" }'
```

Active key flips to `retired`; new key becomes `active`. Old certs still
verify against the retired key forever.

### Force-revoke every session for a user (incident response)

There is no admin endpoint for this yet — file a bug via
`docs/AEVION_MASTER_PLAN.md` if you need it. For now, manually update:

```sql
UPDATE "AuthSession" SET "revokedAt" = NOW() WHERE "userId" = '<id>' AND "revokedAt" IS NULL;
```

The next request from any of that user's tokens returns 401.

## § 8 Drill schedule

| Drill | Cadence | Last run | Owner |
|---|---|---|---|
| Postgres restore from prod dump | quarterly | n/a (pre-launch) | aevion-core |
| JSON file store restore | quarterly | 2026-05-03 ✅ | aevion-backend-modules |
| QSign key rotation | semi-annually | n/a (pre-launch) | aevion-backend-modules |
| Auth replay-rejection smoke | every CI run (daily-smoke.yml) | 2026-05-03 ✅ shipped | automated |
| Full smoke pass | daily (08:00 UTC) | continuous | automated |

Update this table after every drill. If a drill fails, file an issue and
keep the failure visible until fixed.

---

End of runbook. Last edit: 2026-05-03 (initial publish).
