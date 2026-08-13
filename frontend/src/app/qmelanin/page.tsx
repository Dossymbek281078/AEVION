import { fetchOrPaywall } from "@/lib/paywall";
import { PaywallScreen } from "@/components/PaywallScreen";
import QMelaninClient from "./_client";
import { PageTracking } from "@/components/PageTracking";

export default async function Page() {
  const r = await fetchOrPaywall("/api/qmelanin/health");
  if ("paywall" in r) return <PaywallScreen payload={r.paywall} backHref="/modules" />;
  return (
    <>
      <PageTracking page="qmelanin" />
      <QMelaninClient />
    </>
  );
}
