"use strict";
/**
 * Payment provider abstraction.
 *
 * Concrete providers (Stripe, Kaspi-Pay, Paddle) implement this interface;
 * the route layer is provider-agnostic. Default in dev/CI is the
 * deterministic stub provider — it auto-completes payments so the upgrade
 * flow runs end-to-end.
 *
 * In production, env BUREAU_PAYMENT_PROVIDER selects a real implementation,
 * which uses signed webhooks to confirm payments asynchronously (the
 * client polls /payment/status until the webhook arrives — never trust
 * the client-reported "paid" claim).
 */
Object.defineProperty(exports, "__esModule", { value: true });
