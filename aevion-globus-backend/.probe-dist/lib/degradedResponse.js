"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.degraded = degraded;
function degraded(reason) {
    return { degraded: true, degradedReason: reason };
}
