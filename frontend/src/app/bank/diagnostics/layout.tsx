import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Diagnostics — AEVION Bank",
  description:
    "Operational health board: backend reachability, endpoint latency, auth state, local audit/signature counts and environment fingerprint — for engineers and on-call.",
  robots: { index: false, follow: false },
};

export default function DiagnosticsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
