"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeServiceCapture = makeServiceCapture;
const Sentry = __importStar(require("@sentry/node"));
const sentry_1 = require("../qsignV2/sentry");
function makeServiceCapture(service) {
    return function captureServiceError(err, ctx = {}) {
        if (!(0, sentry_1.isSentryActive)())
            return;
        try {
            Sentry.withScope((scope) => {
                scope.setTag("service", service);
                if (typeof ctx.route === "string")
                    scope.setTag("route", ctx.route);
                if (typeof ctx.entityId === "string")
                    scope.setTag("entityId", ctx.entityId);
                if (ctx.actorUserId)
                    scope.setUser({ id: String(ctx.actorUserId) });
                for (const [k, v] of Object.entries(ctx)) {
                    if (k === "route" || k === "entityId" || k === "actorUserId")
                        continue;
                    if (v === undefined || v === null)
                        continue;
                    scope.setExtra(k, v);
                }
                Sentry.captureException(err);
            });
        }
        catch {
            /* secondary — swallow so primary error path is unaffected */
        }
    };
}
