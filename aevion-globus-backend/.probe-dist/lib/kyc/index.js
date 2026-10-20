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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sumsubKycProvider = exports.__seedStubKycSession = exports.__resetStubKycSessions = exports.stubKycProvider = void 0;
exports.getKycProvider = getKycProvider;
const providerGuard_1 = require("../providerGuard");
const stubProvider_1 = require("./stubProvider");
const sumsubProvider_1 = require("./sumsubProvider");
__exportStar(require("./provider"), exports);
var stubProvider_2 = require("./stubProvider");
Object.defineProperty(exports, "stubKycProvider", { enumerable: true, get: function () { return stubProvider_2.stubKycProvider; } });
Object.defineProperty(exports, "__resetStubKycSessions", { enumerable: true, get: function () { return stubProvider_2.__resetStubKycSessions; } });
Object.defineProperty(exports, "__seedStubKycSession", { enumerable: true, get: function () { return stubProvider_2.__seedStubKycSession; } });
var sumsubProvider_2 = require("./sumsubProvider");
Object.defineProperty(exports, "sumsubKycProvider", { enumerable: true, get: function () { return sumsubProvider_2.sumsubKycProvider; } });
/**
 * Selected provider, chosen by env BUREAU_KYC_PROVIDER. Defaults to "stub"
 * — that keeps dev / CI working without configuration but fails loud in
 * production where stub identity attestation would be a security hole
 * (we expect prod to set BUREAU_KYC_PROVIDER=sumsub or similar).
 *
 * The selection is computed lazily so tests can override env per-suite.
 */
function getKycProvider() {
    const id = (process.env.BUREAU_KYC_PROVIDER || "stub").toLowerCase();
    // Заглушка в проде больше не молчит — см. lib/providerGuard.ts.
    (0, providerGuard_1.warnIfStubInProduction)("BUREAU_KYC_PROVIDER", id);
    switch (id) {
        case "sumsub":
            return sumsubProvider_1.sumsubKycProvider;
        case "stub":
            return stubProvider_1.stubKycProvider;
        default:
            throw new Error(`Unknown BUREAU_KYC_PROVIDER=${id}. Supported: stub, sumsub.`);
    }
}
