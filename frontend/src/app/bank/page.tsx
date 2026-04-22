"use client";

// Backend gaps (handled in aevion-globus-backend / aevion-backend-modules sessions, NOT here):
//  - /api/qtrade/* has no JWT middleware → we filter by owner client-side. Unsafe.
//  - /api/qtrade/operations and /transfers have no pagination → max 50 client-side.
//  - No email→accountId resolver → P2P requires full acc_<uuid> input.
//  - /api/ecosystem/earnings endpoint missing → TotalEarningsDashboard uses seeded mock
//    for QRight / CyberChess / Planet streams (banking slice is live).

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";
import { AccountIdCard } from "./_components/AccountIdCard";
import { BankHero } from "./_components/BankHero";
import { PaymentRequestPanel } from "./_components/PaymentRequestPanel";
import { RoyaltyStream } from "./_components/RoyaltyStream";
import { QuickActions, RoyaltiesExplainer, SecurityRoadmap } from "./_components/StaticSections";
import { SendForm } from "./_components/SendForm";
import { TopupForm } from "./_components/TopupForm";
import { TotalEarningsDashboard } from "./_components/TotalEarningsDashboard";
import { TransactionList } from "./_components/TransactionList";
import { TrustScoreCard } from "./_components/TrustScoreCard";
import { WalletSummary } from "./_components/WalletSummary";
import { useAuthMe } from "./_hooks/useAuthMe";
import { useBank } from "./_hooks/useBank";
import { operationsCsvUrl } from "./_lib/api";
import { decodePaymentRequest } from "./_lib/paymentRequest";

function BankContent() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();

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

  const handleSend = async (to: string, amount: number) => {
    const ok = await send(to, amount);
    if (ok) showToast(`Sent ${amount.toFixed(2)} AEC`, "success");
    return ok;
  };

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
    <>
      <div style={{ borderRadius: 20, overflow: "hidden", marginBottom: 24 }}>
        <BankHero email={me?.email} />
        {hasWallet && account ? (
          <WalletSummary account={account} operations={operations} />
        ) : null}
      </div>

      {!authChecked ? (
        <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
          Checking session…
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
            Sign in to open your AEVION Bank account
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
            Your wallet is tied to your AEVION identity. Sign in or create an account — we&apos;ll
            auto-provision an AEC wallet and a Trust Graph profile for you.
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
            Sign in / Register →
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
            Session expired
          </div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>
            Your auth token is no longer valid. Please sign in again.
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
            Sign in again →
          </Link>
        </section>
      ) : null}

      {me && loading && !account ? (
        <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
          Loading your wallet…
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
            Create your AEVION Bank account
          </div>
          <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.6, marginBottom: 16 }}>
            One-click provisioning — tied to {me?.email}. You&apos;ll get a unique account ID, QR
            code, and a Trust Graph profile.
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
            {provisioning ? "Creating…" : "Create wallet"}
          </button>
        </section>
      ) : null}

      {hasWallet && account ? (
        <>
          <TotalEarningsDashboard accountId={account.id} operations={operations} />
          <TrustScoreCard account={account} operations={operations} />
          <RoyaltyStream accountId={account.id} />
          <AccountIdCard
            accountId={account.id}
            onCopy={() => void copyToClipboard(account.id, "Account ID copied")}
          />
          <PaymentRequestPanel
            accountId={account.id}
            onCopy={(msg) => showToast(msg, "success")}
          />

          {prefill ? (
            <div
              style={{
                marginBottom: 12,
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
              marginBottom: 24,
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

          <TransactionList
            myId={account.id}
            operations={operations}
            loading={loading}
            onRefresh={() => void load()}
            csvUrl={operationsCsvUrl()}
            onCopyId={(id) => void copyToClipboard(id)}
          />
        </>
      ) : null}

      <QuickActions />
      <RoyaltiesExplainer />
      <SecurityRoadmap />
    </>
  );
}

export default function AevionBankPage() {
  return (
    <main>
      <ProductPageShell maxWidth={960}>
        <Wave1Nav />
        <Suspense
          fallback={
            <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
              Loading bank…
            </div>
          }
        >
          <BankContent />
        </Suspense>
      </ProductPageShell>
    </main>
  );
}
