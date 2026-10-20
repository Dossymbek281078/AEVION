import { warnIfStubInProduction } from "../providerGuard";
import { KycProvider } from "./provider";
import { stubKycProvider } from "./stubProvider";
import { sumsubKycProvider } from "./sumsubProvider";
import { manualKycProvider } from "./manualProvider";

export * from "./provider";
export { stubKycProvider, __resetStubKycSessions, __seedStubKycSession } from "./stubProvider";
export { sumsubKycProvider } from "./sumsubProvider";
export { manualKycProvider, getManualKycStore, __setManualKycStore } from "./manualProvider";

/**
 * Selected provider, chosen by env BUREAU_KYC_PROVIDER. Defaults to "stub"
 * — that keeps dev / CI working without configuration but fails loud in
 * production where stub identity attestation would be a security hole
 * (we expect prod to set BUREAU_KYC_PROVIDER=sumsub or similar).
 *
 * The selection is computed lazily so tests can override env per-suite.
 */
export function getKycProvider(): KycProvider {
  const id = (process.env.BUREAU_KYC_PROVIDER || "stub").toLowerCase();
  // Заглушка в проде больше не молчит — см. lib/providerGuard.ts.
  warnIfStubInProduction("BUREAU_KYC_PROVIDER", id);
  switch (id) {
    case "sumsub":
      return sumsubKycProvider;
    // 21.10.2026: документ смотрит сотрудник AEVION (routes/bureauManualKyc.ts).
    case "manual":
      return manualKycProvider;
    case "stub":
      return stubKycProvider;
    default:
      throw new Error(
        `Unknown BUREAU_KYC_PROVIDER=${id}. Supported: stub, sumsub, manual.`,
      );
  }
}
