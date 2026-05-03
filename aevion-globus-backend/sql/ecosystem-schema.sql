-- Ecosystem ledger Postgres schema.
--
-- Mirrors the in-memory shapes from src/routes/ecosystem.ts so the JSON-backed
-- ledger can migrate to Postgres without changing the API surface. Tables are
-- intentionally append-only: webhooks deliver idempotent inserts keyed by
-- the source-supplied event id (`id` column), and rows never mutate after
-- first write.
--
-- All money columns use NUMERIC(18,2) to match how qtrade rounds to 2dp.
-- Owner email is the join key everywhere (matches req.auth.email scope check).

CREATE TABLE IF NOT EXISTS ecosystem_royalty_events (
  id              TEXT PRIMARY KEY,
  email           TEXT NOT NULL,
  product_key     TEXT NOT NULL,
  period          TEXT NOT NULL,
  amount          NUMERIC(18,2) NOT NULL,
  paid_at         TIMESTAMPTZ NOT NULL,
  transfer_id     TEXT,
  source          TEXT NOT NULL DEFAULT 'qright',
  inserted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_royalty_email_paid_at
  ON ecosystem_royalty_events (email, paid_at DESC);

CREATE TABLE IF NOT EXISTS ecosystem_chess_prizes (
  id              TEXT PRIMARY KEY,
  email           TEXT NOT NULL,
  tournament_id   TEXT NOT NULL,
  place           INTEGER NOT NULL,
  amount          NUMERIC(18,2) NOT NULL,
  finalized_at    TIMESTAMPTZ NOT NULL,
  transfer_id     TEXT,
  source          TEXT NOT NULL DEFAULT 'cyberchess',
  inserted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chess_email_finalized_at
  ON ecosystem_chess_prizes (email, finalized_at DESC);

CREATE TABLE IF NOT EXISTS ecosystem_planet_certs (
  id                    TEXT PRIMARY KEY,
  email                 TEXT NOT NULL,
  artifact_version_id   TEXT NOT NULL,
  amount                NUMERIC(18,2) NOT NULL,
  certified_at          TIMESTAMPTZ NOT NULL,
  source                TEXT NOT NULL DEFAULT 'planet',
  inserted_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_planet_email_certified_at
  ON ecosystem_planet_certs (email, certified_at DESC);

-- Migration tracking — single-row table so we can detect "JSON ledger already
-- migrated" without re-reading the source file.
CREATE TABLE IF NOT EXISTS ecosystem_migration_state (
  id              INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  migrated_at     TIMESTAMPTZ NOT NULL,
  source_file     TEXT NOT NULL,
  royalty_count   INTEGER NOT NULL,
  chess_count     INTEGER NOT NULL,
  planet_count    INTEGER NOT NULL
);
