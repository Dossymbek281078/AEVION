import type { ReactNode } from "react";

export const metadata = {
  title: "AEVION API Keys — manage your API keys",
  description:
    "Create, list, and revoke your AEVION platform API keys. Format: aev_test_* and aev_live_*. Use them to access QRight, QSign, Bureau, QPayNet, and other AEVION APIs.",
};

export default function KeysLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
