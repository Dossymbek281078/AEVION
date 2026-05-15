import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION Bank — Statement",
  description: "Printable wallet statement: balance, transactions, goals, signed operations.",
  robots: { index: false, follow: false },
};

export default function StatementLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
