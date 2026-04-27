"use client";

// Backend gaps (handled in aevion-globus-backend / aevion-backend-modules sessions, NOT here):
//  - /api/qtrade/* has no JWT middleware → we filter by owner client-side. Unsafe.
//  - /api/qtrade/operations and /transfers have no pagination → max 50 client-side.
//  - No email→accountId resolver → P2P requires full acc_<uuid> input.
//  - /api/ecosystem/earnings endpoint missing → TotalEarningsDashboard uses seeded mock
//    for QRight / CyberChess / Planet streams (banking slice is live).
//  - /api/qright/royalties (+ verify webhook → qtrade transfer) missing → RoyaltyStream is mock.
//  - /api/cyberchess/{results,upcoming} + tournament.finalized webhook missing → ChessWinnings is mock.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";
import { A11yStyles } from "./_components/A11yStyles";
import { AccountIdCard } from "./_components/AccountIdCard";
import { AchievementsPanel } from "./_components/AchievementsPanel";
import { ActivityHeatmap } from "./_components/ActivityHeatmap";
import { ActivityTimeline } from "./_components/ActivityTimeline";
import { AdvisorChat } from "./_components/AdvisorChat";
import { AuditPanel } from "./_components/AuditPanel";
import { AutopilotStatement } from "./_components/AutopilotStatement";
import { BackendStatus } from "./_components/BackendStatus";
import { BalanceProjection } from "./_components/BalanceProjection";
import { DemoModeBanner } from "./_components/DemoModeBanner";
import { BankHero } from "./_components/BankHero";
import { BiometricCard } from "./_components/BiometricCard";
import { ChessWinnings } from "./_components/ChessWinnings";
import { CommandPalette } from "./_components/CommandPalette";
import { ConceptPrimer } from "./_components/ConceptPrimer";
import { DeviceManagement } from "./_components/DeviceManagement";
import { EcosystemPulse } from "./_components/EcosystemPulse";
import { FinancialCopilot } from "./_components/FinancialCopilot";
import { HelpMenu } from "./_components/HelpMenu";
import { MobileTabBar } from "./_components/MobileTabBar";
import { OnboardingTour } from "./_components/OnboardingTour";
import { PeerStanding } from "./_components/PeerStanding";
import { ReferralsPanel } from "./_components/ReferralsPanel";
import { RoundUpStash } from "./_components/RoundUpStash";
import { SectionTabs, TabPanel, useActiveTab } from "./_components/SectionTabs";
import { SnapshotExport } from "./_components/SnapshotExport";
import { TierProgression } from "./_components/TierProgression";
import { TimeTravel } from "./_components/TimeTravel";
import { VoiceCommand } from "./_components/VoiceCommand";
import { WeeklyBrief } from "./_components/WeeklyBrief";
import { GiftMode } from "./_components/GiftMode";
import { MoneyFlowMap } from "./_components/MoneyFlowMap";
import { PaymentRequestPanel } from "./_components/PaymentRequestPanel";
import { RecurringPayments } from "./_components/RecurringPayments";
import { RoyaltyStream } from "./_components/RoyaltyStream";
import { SalaryAdvance } from "./_components/SalaryAdvance";
import { SavingsGoals } from "./_components/SavingsGoals";
import { SocialCircles } from "./_components/SocialCircles";
import { SpendingInsights } from "./_components/SpendingInsights";
import { SplitBills } from "./_components/SplitBills";
import { QuickActions, RoyaltiesExplainer, SecurityRoadmap } from "./_components/StaticSections";
import { SendForm } from "./_components/SendForm";
import { TopupForm } from "./_components/TopupForm";
import { TotalEarningsDashboard } from "./_components/TotalEarningsDashboard";
import { TransactionList } from "./_components/TransactionList";
import { TrustScoreCard } from "./_components/TrustScoreCard";
import { UnifiedAuditFeed } from "./_components/UnifiedAuditFeed";
import { WalletSummary } from "./_components/WalletSummary";
import { WealthConstellation } from "./_components/WealthConstellation";
import { WealthForecast } from "./_components/WealthForecast";
import { useAuthMe } from "./_hooks/useAuthMe";
import { useBank } from "./_hooks/useBank";
import { operationsCsvUrl } from "./_lib/api";
import { BiometricProvider } from "./_lib/BiometricContext";
import { CurrencyProvider } from "./_lib/CurrencyContext";
import { EcosystemDataProvider } from "./_lib/EcosystemDataContext";
import { useI18n } from "@/lib/i18n";
import { PitchValueCallout } from "@/components/PitchValueCallout";
import { decodePaymentRequest } from "./_lib/paymentRequest";

function BankContent() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useActiveTab();

  const { token, me, checked: authChecked } = useAuthMe();

  const onError = useCallback((msg: string) => showToast(msg, "error"), [showToast]);

  const { account, operations, loading, provisioning, load, provision, send, topup } = useBank(
    me,
    onError,
  );

  const prefill = useMemo(() => {
    if (!searchParams) return null;
    const sp = new URLSearchParams(searchParams.toString());
    return decodePaymentRequest(sp);
  }, [searchParams]);

  const handleSend = useCallback(
    async (to: string, amount: number) => {
      const ok = await send(to, amount);
      if (ok) showToast(`Sent ${amount.toFixed(2)} AEC`, "success");
      return ok;
    },
    [send, showToast],
  );

  const notify = useCallback(
    (msg: string, type: "success" | "error" | "info" = "info") => showToast(msg, type),
    [showToast],
  );

  const handleTopup = async (amount: number) => {
    const ok = await topup(amount);
    if (ok) showToast(`+${amount.toFixed(2)} AEC added`, "success");
    return ok;
  };

  const copyToClipboard = useCallback(
    async (value: string, successMsg = "Copied") => {
      try {
        await navigator.clipboard.writeText(value);
        showToast(successMsg, "success");
      } catch {
        showToast("Clipboard blocked — copy manually", "error");
      }
    },
    [showToast],
  );

  const showAuthEmpty = authChecked && !token;
  const showSessionExpired = authChecked && !!token && !me;
  const showProvision = !!me && !account && !loading;
  const hasWallet = !!me && !!account;

  return (
    <div className="aevion-bank-root">
      <A11yStyles />
      <BackendStatus />
      <CommandPalette
        accountId={account?.id ?? null}
        hasWallet={hasWallet}
        notify={notify}
      />
      <div
        id="bank-anchor-wallet"
        style={{ borderRadius: 20, overflow: "hidden", marginBottom: 24, scrollMarginTop: 20 }}
      >
        <BankHero email={me?.email} />
        {hasWallet && account ? (
          <WalletSummary account={account} operations={operations} />
        ) : null}
      </div>

      {!authChecked ? (
        <div style={{ padding: 40, textAlign: "center", color: "#64748b", fontSize: 14 }}>
          {t("loading.session")}
        </div>
      ) : null}

      {showAuthEmpty ? (
        <section
          style={{
            border: "1px solid rgba(15,23,42,0.1)",
            borderRadius: 16,
            padding: 32,
            marginBottom: 24,
            background: "#fff",
            textAlign: "center" as const,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>
            {t("auth.signIn.title")}
          </div>
          <div
            style={{
              fontSize: 14,
              color: "#64748b",
              lineHeight: 1.6,
              marginBottom: 18,
              maxWidth: 480,
              margin: "0 auto 18px",
            }}
          >
            {t("auth.signIn.desc")}
          </div>
          <Link
            href="/auth"
            style={{
              display: "inline-block",
              padding: "12px 22px",
              borderRadius: 12,
              background: "linear-gradient(135deg,#0d9488,#0ea5e9)",
              color: "#fff",
              fontWeight: 800,
              fontSize: 14,
              textDecoration: "none",
              boxShadow: "0 4px 14px rgba(13,148,136,0.3)",
            }}
          >
            {t("auth.signIn.cta")}
          </Link>
        </section>
      ) : null}

      {showSessionExpired ? (
        <section
          style={{
            border: "1px solid rgba(220,38,38,0.25)",
            borderRadius: 16,
            padding: 24,
            marginBottom: 24,
            background: "rgba(220,38,38,0.04)",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 6, color: "#991b1b" }}>
            {t("auth.expired.title")}
          </div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>
            {t("auth.expired.desc")}
          </div>
          <Link
            href="/auth"
            style={{
              display: "inline-block",
              padding: "10px 18px",
              borderRadius: 10,
              background: "#0f172a",
              color: "#fff",
              fontWeight: 800,
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            {t("auth.expired.cta")}
          </Link>
        </section>
      ) : null}

      {me && loading && !account ? (
        <div style={{ padding: 32, textAlign: "center", color: "#64748b", fontSize: 14 }}>
          {t("loading.wallet")}
        </div>
      ) : null}

      {showProvision ? (
        <section
          style={{
            border: "1px solid rgba(13,148,136,0.25)",
            borderRadius: 16,
            padding: 28,
            marginBottom: 24,
            background: "linear-gradient(135deg, rgba(13,148,136,0.05), rgba(14,165,233,0.04))",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>
            {t("provision.title")}
          </div>
          <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.6, marginBottom: 16 }}>
            {t("provision.desc", { email: me?.email ?? "" })}
          </div>
          <button
            onClick={() => void provision()}
            disabled={provisioning}
            style={{
              padding: "12px 22px",
              borderRadius: 12,
              border: "none",
              background: provisioning ? "#94a3b8" : "linear-gradient(135deg,#0d9488,#0ea5e9)",
              color: "#fff",
              fontWeight: 800,
              fontSize: 14,
              cursor: provisioning ? "default" : "pointer",
              boxShadow: provisioning ? "none" : "0 4px 14px rgba(13,148,136,0.3)",
            }}
          >
            {provisioning ? t("provision.creating") : t("provision.cta")}
          </button>
        </section>
      ) : null}

      {hasWallet && account ? (
        <EcosystemDataProvider accountId={account.id} operations={operations}>
          <DemoModeBanner
            accountId={account.id}
            requested={searchParams?.get("demo") === "1"}
            notify={notify}
          />
          <OnboardingTour
            forceOpen={searchParams?.get("tour") === "1"}
            autoFirstVisit={true}
          />
          <ConceptPrimer />

          <SectionTabs active={activeTab} onChange={setActiveTab} />

          <TabPanel id="overview" active={activeTab}>
            <PitchValueCallout moduleId="bank" variant="dark" compact={true} />
            <BalanceProjection account={account} />
            <div id="bank-anchor-constellation" style={{ scrollMarginTop: 20 }}>
              <WealthConstellation account={account} operations={operations} />
            </div>
            <div id="bank-anchor-ecosystem" style={{ scrollMarginTop: 20 }}>
              <EcosystemPulse accountId={account.id} operations={operations} />
            </div>
            <div id="bank-anchor-flow" style={{ scrollMarginTop: 20 }}>
              <MoneyFlowMap accountId={account.id} operations={operations} />
            </div>
            <AccountIdCard
              accountId={account.id}
              onCopy={() => void copyToClipboard(account.id, "Account ID copied")}
            />
            <PaymentRequestPanel
              accountId={account.id}
              onCopy={(msg) => showToast(msg, "success")}
            />
          </TabPanel>

          <TabPanel id="earn" active={activeTab}>
            <div id="bank-anchor-brief" style={{ scrollMarginTop: 20 }}>
              <WeeklyBrief accountId={account.id} operations={operations} />
            </div>
            <TotalEarningsDashboard />
            <div id="bank-anchor-timetravel" style={{ scrollMarginTop: 20 }}>
              <TimeTravel account={account} operations={operations} />
            </div>
            <div id="bank-anchor-heatmap" style={{ scrollMarginTop: 20 }}>
              <ActivityHeatmap accountId={account.id} operations={operations} />
            </div>
            <div id="bank-anchor-forecast" style={{ scrollMarginTop: 20 }}>
              <WealthForecast account={account} />
            </div>
            <RoyaltyStream />
            <ChessWinnings />
            <SpendingInsights accountId={account.id} operations={operations} />
            <div id="bank-anchor-statement" style={{ scrollMarginTop: 20 }}>
              <AutopilotStatement accountId={account.id} notify={notify} />
            </div>
          </TabPanel>

          <TabPanel id="send" active={activeTab}>
            {prefill ? (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(124,58,237,0.3)",
                  background: "rgba(124,58,237,0.06)",
                  fontSize: 13,
                  color: "#4c1d95",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <strong>Incoming payment request</strong>
                <span style={{ color: "#64748b" }}>
                  Pre-filled below
                  {prefill.amount ? `: ${prefill.amount.toFixed(2)} AEC` : ""}
                  {prefill.memo ? ` · ${prefill.memo}` : ""}
                </span>
              </div>
            ) : null}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 16,
              }}
            >
              <TopupForm onTopup={handleTopup} />
              <SendForm
                myId={account.id}
                balance={account.balance}
                prefill={prefill}
                onSend={handleSend}
                onError={onError}
              />
            </div>

            <RecurringPayments
              myAccountId={account.id}
              balance={account.balance}
              send={send}
              notify={notify}
            />

            <SplitBills myAccountId={account.id} notify={notify} />

            <SocialCircles
              myAccountId={account.id}
              myNickname={me.name || me.email}
              balance={account.balance}
              send={send}
              notify={notify}
            />

            <GiftMode
              myAccountId={account.id}
              balance={account.balance}
              send={send}
              notify={notify}
            />

            <TransactionList
              myId={account.id}
              operations={operations}
              loading={loading}
              onRefresh={() => void load()}
              csvUrl={operationsCsvUrl()}
              onCopyId={(id) => void copyToClipboard(id)}
            />
          </TabPanel>

          <TabPanel id="grow" active={activeTab}>
            <div id="bank-anchor-trust" style={{ scrollMarginTop: 20 }}>
              <TrustScoreCard account={account} operations={operations} />
            </div>
            <div id="bank-anchor-tiers" style={{ scrollMarginTop: 20 }}>
              <TierProgression account={account} operations={operations} notify={notify} />
            </div>
            <PeerStanding account={account} operations={operations} />
            <div id="bank-anchor-achievements" style={{ scrollMarginTop: 20 }}>
              <AchievementsPanel account={account} operations={operations} />
            </div>
            <SavingsGoals accountId={account.id} notify={notify} />
            <RoundUpStash
              myAccountId={account.id}
              operations={operations}
              notify={notify}
            />
            <SalaryAdvance
              account={account}
              operations={operations}
              topup={handleTopup}
              notify={notify}
            />
            <ReferralsPanel account={account} notify={notify} />
          </TabPanel>

          <TabPanel id="security" active={activeTab}>
            <BiometricCard email={me.email} notify={notify} />
            <ActivityTimeline myId={account.id} operations={operations} />
            <div id="bank-anchor-audit-unified" style={{ scrollMarginTop: 20 }}>
              <UnifiedAuditFeed accountId={account.id} operations={operations} notify={notify} />
            </div>
            <AuditPanel notify={notify} />
            <DeviceManagement accountId={account.id} notify={notify} />
            <SnapshotExport account={account} operations={operations} notify={notify} />
          </TabPanel>

          <AdvisorChat account={account} me={me} operations={operations} notify={notify} />
          <FinancialCopilot account={account} operations={operations} notify={notify} />
          <HelpMenu accountId={account.id} notify={notify} />
          <VoiceCommand
            account={account}
            setActiveTab={setActiveTab}
            notify={notify}
          />
          <MobileTabBar />
        </EcosystemDataProvider>
      ) : null}

      <QuickActions />
      <RoyaltiesExplainer />
      <SecurityRoadmap />
    </div>
  );
}

export default function AevionBankPage() {
  return (
    <main>
      <ProductPageShell maxWidth={960}>
        <Wave1Nav />
        <Suspense
          fallback={
            <div style={{ padding: 40, textAlign: "center", color: "#64748b", fontSize: 14 }}>
              Loading bank…
            </div>
          }
        >
          <CurrencyProvider>
            <BiometricProvider>
              <BankContent />
            </BiometricProvider>
          </CurrencyProvider>
        </Suspense>
      </ProductPageShell>
    </main>
  );
}
