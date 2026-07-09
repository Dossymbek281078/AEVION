import { fetchOrPaywall } from "@/lib/paywall";
import { PaywallScreen } from "@/components/PaywallScreen";
import QMelaninTrackClient from "./_client";

export default async function Page() {
  const r = await fetchOrPaywall("/api/qmelanin/health");
  if ("paywall" in r) return <PaywallScreen payload={r.paywall} backHref="/modules" />;
  return <QMelaninTrackClient />;
}
