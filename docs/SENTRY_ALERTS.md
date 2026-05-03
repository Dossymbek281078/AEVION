# AEVION — Sentry alert rules (alert-as-code)

> **Created** 2026-05-03 · part of `docs/AEVION_MASTER_PLAN.md` § 4 Phase 1 (P1-5).
>
> Sentry alert rules are configured in the Sentry UI per project, not in
> code. This doc is the canonical "what should be there" so we can audit
> the configured rules against expected behaviour and catch drift. When
> Sentry adds Terraform-style sync (or we adopt sentry-cli), this file
> becomes the spec to import.

## § 1 Service tags reference

Every captured exception lands with these tags. Configure rules using them.

| Tag | Source | Values |
|---|---|---|
| `service` | `makeServiceCapture` factory in `src/lib/sentry/platform.ts` | `bureau`, `awards`, `planet`, `pipeline`, `qright` |
| `service` | `qsignV2/sentry` | `qsign-v2` |
| `service` | `qshield/sentry` | `quantum-shield` |
| `route` | per-call ctx | `verify/start`, `seasons`, `protect`, `submit`, etc. |
| `entityId` | per-call ctx | row id when relevant (cert id, season id, shield id) |
| `errorCode` | qsign-v2 only | `SIGN_FAILED`, `KEY_NOT_FOUND`, etc. |
| `requestId` | qsign-v2 only | per-request UUID |

User context: `user.id` is set when an authed caller is in scope.

## § 2 Alert rules to configure

Group rules by severity. Each row: trigger condition + routing + reason.

### P0 — page on-call (PagerDuty)

| ID | Trigger | Action | Why |
|---|---|---|---|
| P0-SIGN-DOWN | `service:qsign-v2 errorCode:SIGN_FAILED` count > 0 in 5 min | PagerDuty AEVION-OPS | Signing pipeline outage = no new certificates can be minted. Every other module's value depends on this. |
| P0-DB-DOWN | Any `event.message` matching `/connection terminated|ECONNREFUSED.*5432/` count > 5 in 5 min | PagerDuty AEVION-OPS | Postgres unreachable. Every authed route 500s. |
| P0-AUTH-REPLAY | New issue with `service:auth route:tokenVersion` (any) | PagerDuty AEVION-OPS | Replay of a revoked token reached protected code path — security regression on PR #80. |

### P1 — Slack #aevion-alerts (oncall ping)

| ID | Trigger | Action | Why |
|---|---|---|---|
| P1-BUREAU-KYC | `service:bureau route:verify/start` issue count > 5 in 1 hour | Slack #aevion-alerts | KYC provider down or misconfigured — Verified-tier upgrades blocked. |
| P1-PLANET-CERT | `service:planet route:cert*` issue count > 5 in 1 hour | Slack #aevion-alerts | Quorum certification path broken — Awards payouts stall. |
| P1-AWARDS-FINALIZE | `service:awards route:finalize` (any) | Slack #aevion-alerts | Season finalize is rare + critical (mints medals + triggers payouts). Any error worth a human look. |
| P1-PIPELINE-PROTECT | `service:pipeline route:protect` issue count > 10 in 1 hour | Slack #aevion-alerts | High volume of protect failures = Tier 1 trust spine degraded. |
| P1-QSHIELD-RECONSTRUCT | `service:quantum-shield route:reconstruct` (any) | Slack #aevion-alerts | Shamir reconstruction failures — possible shard corruption or HMAC drift. Investigate immediately. |
| P1-WEBHOOK-AUTH | `errorCode:WEBHOOK_AUTH_FAILED` count > 10 in 5 min | Slack #aevion-alerts | Either a partner is misconfigured or someone is probing webhook secrets. |

### P2 — daily digest

| ID | Trigger | Action | Why |
|---|---|---|---|
| P2-VOLUME | Per-service total error count by day | Email digest 09:00 UTC | Trend visibility — sudden spikes worth a review. |
| P2-NEW-ISSUE | Any new `issue.first_seen` in last 24h | Email digest 09:00 UTC | Catches regressions that didn't trip thresholds. |
| P2-FIVE-NINES | Per-route 5xx rate > 0.1% over 24h on any Tier 1 route | Email digest 09:00 UTC | SLA early-warning before it hits user-visible thresholds. |

## § 3 Alert silencing — what NOT to alert on

Some 5xx paths are expected noise; alerting on them just trains people
to ignore the channel.

| Pattern | Why ignore |
|---|---|
| `service:bureau route:verify/status` 404 from polling | Frontend polls during KYC; eventual 404 when session expires is normal. |
| `service:awards route:current` 404 | "No open season for this track" is a valid response to a public probe. |
| Rate-limit 429s (any module) | Already surfaced via `Retry-After` header; capturing as Sentry events doubles the noise. |
| `service:quantum-shield route:public` 404 on reserved-id paths | Reserved tokens (`health`, `verify`, `keys`, `revoke`, `sign`) explicitly route to other handlers. |

These should be filtered at the SDK level (via `beforeSend` in
`qsignV2/sentry.ts`) or via Sentry inbound-filter rules — both work, the
SDK approach saves the event quota.

## § 4 Daily smoke + Sentry crosscheck

The cron `daily-smoke.yml` runs against ephemeral pg every 24h. If any
smoke fails, the GitHub Actions run goes red AND a Sentry event tagged
`source:daily-smoke service:<scope>` is emitted by the smoke script.

Configure a fourth rule:

| ID | Trigger | Action |
|---|---|---|
| P0-SMOKE-RED | `tags.source:daily-smoke` count > 0 in 24h | PagerDuty + auto-create GitHub issue |

(The smoke-side emit is not yet wired — file as a follow-up if the daily
smoke fails twice in a row without anyone noticing.)

## § 5 Drift audit checklist

Quarterly, verify the configured rules match this doc:

```
[ ] P0-SIGN-DOWN exists in Sentry → PagerDuty integration is alive
[ ] P0-DB-DOWN matches the regex pattern above
[ ] P0-AUTH-REPLAY is defined (look for "service:auth route:tokenVersion")
[ ] All P1-* rules route to #aevion-alerts (Slack integration must be wired)
[ ] P2 digest is enabled and sent to ops@aevion.app
[ ] Inbound filters cover § 3 silencing patterns
[ ] No rules exist that aren't in this doc (drift in the other direction)
```

When any row above doesn't match the live config, fix the config and
update this doc in the same PR.

## § 6 SENTRY_DSN gating

All capture is no-op when `SENTRY_DSN` is unset (see
`docs/PROD_ENV_CHECKLIST.md` § 2 "Sentry"). Alert rules above are only
relevant in environments where Sentry is actually wired:

- **Production:** `SENTRY_DSN` set → all rules active
- **Staging:** `SENTRY_DSN` set to a staging project → reduced thresholds; or off
- **CI / dev:** unset → no events leave the box

---

End of alert spec. Last edit: 2026-05-03 (initial publish).
