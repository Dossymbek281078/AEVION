/**
 * Ручная проверка личности: поставщик KycProvider поверх ManualKycStore.
 *
 * Включается ТОЛЬКО переменной BUREAU_KYC_PROVIDER=manual. На проде до решения
 * основателя (цена «Проверено» и согласие на просмотр документов сотрудником)
 * переменная остаётся stub — барьер upgrade отвечает 503, как и раньше.
 *
 * Внешнего вебхука нет: решение принимает админ ручкой
 * POST /api/bureau/admin/kyc-manual/:id/decide, а /verify/status забирает его
 * через getSession — тем же путём, что у любого поставщика.
 */
import { getPool } from "../dbPool";
import type { KycProvider, KycResult, KycSession, KycSessionStart } from "./provider";
import { effectiveStatus, ManualKycStore, pgManualKycStore } from "./manualStore";

let store: ManualKycStore | null = null;

export function getManualKycStore(): ManualKycStore {
  if (!store) store = pgManualKycStore(getPool());
  return store;
}

/** Только для тестов: подменить хранилище (память вместо базы). */
export function __setManualKycStore(s: ManualKycStore | null): void {
  store = s;
}

export const manualKycProvider: KycProvider = {
  id: "manual",

  async startSession(input: KycSessionStart): Promise<KycSession> {
    const r = await getManualKycStore().create(
      {
        userId: input.userId,
        email: input.email,
        declaredName: input.declaredName ?? null,
        declaredCountry: input.declaredCountry ?? null,
      },
      new Date(),
    );
    return {
      sessionId: r.id,
      redirectUrl: `/bureau/kyc-manual/${r.id}`,
      status: "pending",
      expiresAt: r.expiresAt,
    };
  },

  async getSession(sessionId: string): Promise<KycResult> {
    const r = await getManualKycStore().get(sessionId);
    if (!r) {
      return {
        status: "expired",
        decidedAt: null,
        reason: "session not found",
        verifiedName: null,
        verifiedDocType: null,
        verifiedCountry: null,
        raw: null,
      };
    }
    // Сырые данные — без байтов и без адреса: kycRawJson лежит в BureauVerification.
    return {
      status: effectiveStatus(r, new Date()),
      decidedAt: r.decidedAt,
      reason: r.reason,
      verifiedName: r.verifiedName,
      verifiedDocType: r.verifiedDocType,
      verifiedCountry: r.verifiedCountry,
      raw: { provider: "manual", reviewedBy: "AEVION staff", decidedAt: r.decidedAt, submittedAt: r.submittedAt },
    };
  },

  parseWebhook() {
    throw new Error("manual KYC has no webhook: decisions come from POST /api/bureau/admin/kyc-manual/:id/decide");
  },
};
