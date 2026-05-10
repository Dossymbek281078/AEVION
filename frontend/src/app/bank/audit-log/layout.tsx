import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Audit log — AEVION Bank",
  description:
    "Compliance-grade unified ledger view: every operation, every QSign signature, with filters and CSV/JSON export — for regulators, auditors and partners.",
  robots: { index: false, follow: false },
};

export default function AuditLogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
