import { fetchOrPaywall } from "@/lib/paywall";
import { ServerPaywallScreen } from "@/components/ServerPaywallScreen";
import QMelaninTrackClient from "./_client";

export default async function Page() {
  const r = await fetchOrPaywall("/api/qmelanin/health");
  if ("paywall" in r) return <ServerPaywallScreen payload={r.paywall} backHref="/modules" />;
  return <QMelaninTrackClient />;
}
