import type { ReactNode } from "react";

export const metadata = {
  title: "QContract — Self-Destruct Smart Documents · AEVION",
  description: "Саморазрушающиеся смарт-документы: контроль доступа, срок действия, защита контента.",
};

export default function QContractLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
