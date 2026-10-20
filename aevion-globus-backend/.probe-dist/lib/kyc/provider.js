"use strict";
/**
 * KYC provider abstraction.
 *
 * The bureau needs identity attestation but should not be locked to a
 * specific KYC vendor. Concrete providers (Sumsub, Veriff, IDnow, Onfido,
 * Persona) implement this interface; the route layer is provider-agnostic.
 *
 * For development and CI we use stubProvider, which returns deterministic
 * "approved" decisions for test sessions. Production deployments select
 * a real provider via env BUREAU_KYC_PROVIDER + the provider's API keys.
 */
Object.defineProperty(exports, "__esModule", { value: true });
