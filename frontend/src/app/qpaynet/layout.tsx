import type { ReactNode } from "react";

export const metadata = {
  title: "QPayNet — Embedded Payments · AEVION",
  description: "Встроенная платёжная инфраструктура AEVION. Кошельки, переводы, merchant API.",
};

export default function QPayNetLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
