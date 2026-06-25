import { fetchOrPaywall } from "@/lib/paywall";
import { PaywallScreen } from "@/components/PaywallScreen";
import QCoreAIPage from "./QCoreAIClient";

export default async function Page() {
  const r = await fetchOrPaywall("/api/qcoreai/health");
  if ("paywall" in r) return <PaywallScreen payload={r.paywall} backHref="/modules" />;
  return <QCoreAIPage />;
}
