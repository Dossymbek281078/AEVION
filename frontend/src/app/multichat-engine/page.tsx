import { fetchOrPaywall } from "@/lib/paywall";
import { PaywallScreen } from "@/components/PaywallScreen";
import MultichatEnginePage from "./MultichatEngineClient";

export default async function Page() {
  const r = await fetchOrPaywall("/api/multichat/health");
  if ("paywall" in r) return <PaywallScreen payload={r.paywall} backHref="/modules" />;
  return <MultichatEnginePage />;
}
