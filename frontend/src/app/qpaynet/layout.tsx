import type { ReactNode } from "react";
import ComplianceBanner from "@/components/ComplianceBanner";

export const metadata = {
  title: "QPayNet — Embedded Payments · AEVION",
  description: "Встроенная платёжная инфраструктура AEVION. Кошельки, переводы, merchant API.",
};

export default function QPayNetLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ComplianceBanner variant="financial" />
      {children}
    </>
  );
}
