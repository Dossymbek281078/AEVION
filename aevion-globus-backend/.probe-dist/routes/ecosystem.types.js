"use strict";
// Shared shapes for the ecosystem ledger (royalty events / chess prizes /
// planet certs). Extracted into a leaf module so the Postgres-aware store
// driver in src/lib/ecosystemStore.ts can import without forming a cycle
// with src/routes/ecosystem.ts.
Object.defineProperty(exports, "__esModule", { value: true });
