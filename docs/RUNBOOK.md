# AEVION — operations runbook

> **Created** 2026-05-03 · part of `docs/AEVION_MASTER_PLAN.md` § 4 Phase 1 (P1-4 + P1-5).
>
> Read top to bottom on Day 1 of any incident or rollout. Procedures
> below were drilled against a local dev backend — re-drill quarterly
> against staging once Phase 0 lands.

## § 1 Recovery objectives (RTO / RPO)

| Tier | Module | RTO | RPO | Snapshot frequency | Notes |
|---|---|---|---|---|---|
| 1 | Postgres — **platform** instance (`DATABASE_URL`) | 30 min | 24 h | Railway daily auto-backup + pg_dump weekly | RPO drops to 1 h once we wire WAL to S3 |
| 1 | Postgres — **DevHub project** instance (`DEVHUB_DB_ADMIN_URL`) | **unknown** | **∞ — no backup** | **none** | 🔴 Not backed up in any form (issue #957). See § 1.1 — do not read the row above as covering it |
| 1 | JSON file store (`AEVION_DATA_DIR`) — **включая кошельки и реестр AEV** | 15 min | 24 h | `npm run backup` вручную; расписания нет | См. § 1.2 — команда была потеряна из package.json с 30.04 по 14.08 |
| 2 | Sentry events | n/a | n/a | Sentry retention (90d) | No restore — outbound only |
| 2 | Vercel build artefacts | 5 min | n/a | Re-trigger build from main | Build is reproducible from git |
| 3 | Crypto secrets (`QSIGN_*`, `SHARD_HMAC_SECRET`) | 0 (don't lose them) | 0 | 1Password vault + offline paper | **Losing these invalidates every signed cert** |

### § 1.1 🔴 Two Postgres instances, only one of them is backed up

This section exists because the table above used to say **“Postgres (all
modules)”** in a single row, and the backup procedure in § 2.1 dumps exactly one
connection string. Anyone reading it during an incident would conclude that
DevHub project data is covered. It is not.

**There are two separate instances, deliberately:**

| | connection string | what lives there |
|---|---|---|
| platform | `DATABASE_URL` | our own tables — all modules of the ecosystem |
| DevHub projects | `DEVHUB_DB_ADMIN_URL` | one schema + one role **per user project**, created by `lib/devhubDbProvision.ts` |

The separation is enforced in code: provisioning **refuses** to run when
`DEVHUB_DB_ADMIN_URL` points at the platform database (“must point at an instance
dedicated to user projects”). So a dump of `DATABASE_URL` cannot contain project
data — not partially, not at all.

**State as of 14.08.2026:** the project instance has no backup of any kind
(issue #957). Every user project shares that one instance, isolated only by
schema and role — so losing it loses every project at once, not one of them.

What is already done and should not be redone: the provisioning response and the
DevHub project page tell the user, at the moment they receive the database, that
project databases are not backed up yet (commit `c5dae3446`). The silence was
fixed; the absence was not, on purpose — choosing between a separately billed
service and a permanently larger attack surface is the owner's call.

**How to check the current state in two clicks** (this file cannot know it):
Railway → project → service `devhub-projects-db` → Backups. If a schedule now
exists, the row above must be updated together with a restore rehearsal — an
unrehearsed backup is a belief, not a backup. The condition for removing the
warning from the UI is written next to it in `lib/devhubDbProvision.ts`.

**Manual dump until then** (needs the admin URL, produces one file per instance):

```bash
DEVHUB_DB_ADMIN_URL=postgres://...   pg_dump --format=custom --no-owner --no-privileges     --file=devhub-projects-$(date -u +%Y-%m-%dT%H-%M-%SZ).pgdump
```

Store it **outside** the same Railway volume, same rule as § 2.1.

### § 1.2 Файловое хранилище: что в нём лежит и почему это не «legacy»

Строка выше называла его «legacy: leads, newsletter, partners». Фактический
состав шире, и часть его — денежная:

* `aev_wallets.json`, `aev_ledger.json` — кошельки и append-only реестр AEV.
  Единственное хранилище: Postgres для них только в планах, см. шапку
  `src/routes/aev.ts` («Prisma схема готова для миграции когда DATABASE_URL
  будет задан»).
* `qtrade.json`, `multichat-conversations.json`, `chat-history.json`,
  `cyberchess-tournaments.json`, `smeta_*.json`.

**«Railway fs is ephemeral» больше не соответствует факту.** Замер прода
14.08.2026: `/health` отдаёт `eventsStore.oldest = 2026-05-26` при `uptimeSec`
в 206 секунд — то есть данные переживают перезапуск, у сервиса есть том. Но том
сервиса и том Postgres — разные, а PITR настроен на второй.

**Команда бэкапа существует, но была недоступна четыре месяца.** Коммит
`8d152a864` (30.04) добавил `scripts/backup.mjs`, `scripts/restore.mjs` и три
записи в `package.json`: `backup`, `backup:list`, `restore`. К 14.08 файлы
остались, а записей не было ни одной — ни здесь, ни в пяти других ветках, где
`package.json` правили. Ничего не падало: сборка и тесты зелёные, просто
резервного копирования не было. Записи возвращены; сторож
`tests/scriptEntryPoints.guard.test.ts` не даст им исчезнуть снова.

Проверено на фактических данных: `npm run backup` копирует хранилище в
`.aevion-backups/<UTC>/`, `npm run backup:list` показывает снимки, копия сверена
с источником побайтно.

**Чего по-прежнему нет:** расписания. Команда запускается только руками, и это
надо либо завести задачей, либо не называть в § 1 частотой «daily».

Definitions:
- **RTO** = maximum acceptable time to restore service after an outage.
- **RPO** = maximum acceptable data loss (in time units before the failure).

## § 2 Backup procedures

### 2.1 Postgres — platform instance (Tier 1)

> Covers `DATABASE_URL` only. The DevHub project instance
> (`DEVHUB_DB_ADMIN_URL`) is a separate server and is **not** included — see
> § 1.1. This heading used to say “all modules”, which read as coverage of both.

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
