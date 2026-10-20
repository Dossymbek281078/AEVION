"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shardDistributionSummary = shardDistributionSummary;
function shardDistributionSummary(input) {
    const threshold = Number(input.threshold) > 0 ? Number(input.threshold) : 2;
    const serverCopies = input.locations.filter((l) => l.serverHasCopy).length;
    return {
        policy: input.policy,
        realDistributed: serverCopies < threshold,
        serverCanReconstructAlone: serverCopies >= threshold,
        shardsOutsideServer: input.locations.length - serverCopies,
        threshold,
        serverCopies,
        locations: input.locations,
        witness: input.witness,
    };
}
