import * as Sentry from "@sentry/node";
import { isSentryActive } from "../qsignV2/sentry";

/**
 * Per-service capture factory for platform routes (bureau, awards, planet,
 * pipeline, qright, modules). Sentry init is global — done once in
 * src/index.ts via initSentry() — so this layer just tags + captures.
 *
 * Pattern mirrors src/lib/qshield/sentry.ts (which predates the shared init
 * and stays separate to avoid churn). New services should use this factory.
 *
 * Usage:
 *   const captureBureauError = makeServiceCapture("bureau");
 *   // ...
 *   } catch (err) {
 *     captureBureauError(err, { route: "create-cert", entityId: id });
 *     res.status(500).json({ error: "..." });
 *   }
 *
 * Always safe to call — never throws, no-ops when SENTRY_DSN unset.
 */

export type ServiceCaptureCtx = {
  route?: string;
  entityId?: string;
  actorUserId?: string | null;
  [k: string]: unknown;
};

export function makeServiceCapture(service: string) {
  return function captureServiceError(err: unknown, ctx: ServiceCaptureCtx = {}): void {
    if (!isSentryActive()) return;
    try {
      Sentry.withScope((scope) => {
        scope.setTag("service", service);
        if (typeof ctx.route === "string") scope.setTag("route", ctx.route);
        if (typeof ctx.entityId === "string") scope.setTag("entityId", ctx.entityId);
        if (ctx.actorUserId) scope.setUser({ id: String(ctx.actorUserId) });
        for (const [k, v] of Object.entries(ctx)) {
          if (k === "route" || k === "entityId" || k === "actorUserId") continue;
          if (v === undefined || v === null) continue;
          scope.setExtra(k, v);
        }
        Sentry.captureException(err);
      });
    } catch {
      /* secondary — swallow so primary error path is unaffected */
    }
  };
}
