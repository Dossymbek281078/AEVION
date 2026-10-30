import { fetchOrPaywall } from "@/lib/paywall";
import { ServerPaywallScreen } from "@/components/ServerPaywallScreen";
import QCoreAIPage from "./QCoreAIClient";

export default async function Page() {
  const r = await fetchOrPaywall("/api/qcoreai/health");
  if ("paywall" in r) return <ServerPaywallScreen payload={r.paywall} backHref="/modules" />;
  return <QCoreAIPage />;
}
